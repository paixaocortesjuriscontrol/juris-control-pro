import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Radio, Clock, RefreshCw, StopCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { toast } from "sonner";

export interface LiveExecution {
  id: string;
  status: string;
  tipo: string;
  processados: number;
  total: number;
  resultados?: number;
  erros?: number;
  iniciado_em: string;
  finalizado_em?: string | null;
  duracao_segundos?: number;
  detalhes?: Record<string, any>;
}

function IndeterminateProgress() {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="absolute inset-y-0 left-0 w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary/30" />
      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

interface LiveExecutionPanelProps {
  tipo: string; // 'redistribuicoes' | 'andamentos' | 'distribuicoes' | 'termos'
  titulo?: string;
  onCancel?: () => void;
  showCancel?: boolean;
  executandoManual?: boolean;
  progressoManual?: { current: number; total: number; percentage: number } | null;
}

export function LiveExecutionPanel({
  tipo,
  titulo = "Execução em andamento",
  onCancel,
  showCancel = true,
  executandoManual = false,
  progressoManual = null,
}: LiveExecutionPanelProps) {
  const queryClient = useQueryClient();
  const [liveExecution, setLiveExecution] = useState<LiveExecution | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Real-time subscription para historico_monitoramento + fallback via configuracoes_monitoramento
  // (alguns robôs atualizam apenas configuracoes_monitoramento, sem inserir em historico_monitoramento)
  useEffect(() => {
    let disposed = false;
    let lastCompleteRunSeen: string | null = null;

    const buildExecutionFromConfig = (cfg: any): LiveExecution | null => {
      if (!cfg?.ultima_execucao) return null;

      // Se está pausado/desativado ou cancelado, não exibir como "em andamento"
      if (cfg.ativo === false) return null;

      const metadata = (cfg.metadata as Record<string, any> | null) ?? {};

      // Se está pausado globalmente, não exibir como "em andamento"
      if (metadata.paused_globally === true) return null;

      if (metadata.cancelado === true) return null;
      if (metadata.status === 'cancelado' || metadata.status === 'cancelando') return null;

      const lastRunMs = new Date(cfg.ultima_execucao).getTime();
      const ageMs = Date.now() - lastRunMs;
      
      // Não consideramos execuções muito antigas (30 min para DJEN que demora mais)
      if (ageMs > 30 * 60 * 1000) return null;

      const nextOffset = typeof metadata.next_offset === 'number' ? metadata.next_offset : null;
      const currentTribunalOffset = typeof metadata.current_tribunal_offset === 'number' ? metadata.current_tribunal_offset : null;
      const monitoramentosProcessados = typeof metadata.monitoramentos_processados === 'number' ? metadata.monitoramentos_processados : null;
      const lastBatchSize = typeof metadata.last_batch_size === 'number' ? metadata.last_batch_size : null;

      // Detectamos execução em andamento APENAS quando:
      // - status explícito 'em_andamento' (não flags auxiliares)
      // Isso evita "processos fantasmas" ao usar continuingRun ou offset residual
      const isActivelyRunning = metadata.status === 'em_andamento' && metadata.cancelado !== true;

      // Se não está ativamente rodando, não mostrar o painel
      if (!isActivelyRunning) {
        return null;
      }

      const current =
        nextOffset ??
        currentTribunalOffset ??
        monitoramentosProcessados ??
        0;

      // Total explícito do metadata tem prioridade
      const total = typeof metadata.total === 'number' && metadata.total > 0 
        ? metadata.total 
        : 0;

      const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

      return {
        id: cfg.id,
        status: 'em_andamento',
        tipo: cfg.tipo,
        processados: current,
        total,
        iniciado_em: cfg.ultima_execucao,
        detalhes: {
          ...metadata,
          percentage,
          source: 'configuracoes_monitoramento',
        },
      };
    };

    const checkCurrentExecution = async () => {
      // 0) Fonte de verdade: execucoes_agendadas
      // Evita UI presa em "Iniciando varredura..." quando o orquestrador bloqueia/pausa.
      const { data: exec } = await supabase
        .from('execucoes_agendadas')
        .select('id, tipo, status, iniciado_em, finalizado_em, detalhes')
        .eq('tipo', tipo)
        .eq('status', 'executando')
        .is('finalizado_em', null)
        .order('iniciado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (disposed) return;

      if (exec) {
        const detalhes = (exec.detalhes as Record<string, any> | null) ?? {};
        const progress = (detalhes.progress as any) ?? null;

        const current =
          (typeof progress?.current === 'number' ? progress.current : null) ??
          (typeof detalhes.current === 'number' ? detalhes.current : 0);
        const total =
          (typeof progress?.total === 'number' ? progress.total : null) ??
          (typeof detalhes.total === 'number' ? detalhes.total : 0);

        setLiveExecution({
          id: exec.id,
          status: 'em_andamento',
          tipo: exec.tipo,
          processados: current,
          total,
          iniciado_em: exec.iniciado_em,
          detalhes: { ...detalhes, source: 'execucoes_agendadas' },
        });
        setUpdatedAt(new Date());
        return;
      }

      // Busca execuções em andamento dos últimos 5 minutos
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data } = await supabase
        .from('historico_monitoramento')
        .select('*')
        .eq('tipo', tipo)
        .gte('executado_em', fiveMinAgo)
        .order('executado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (disposed) return;

      if (data) {
        const detalhes = data.detalhes as Record<string, any> | null;
        const isRunning = detalhes?.status === 'em_andamento' || 
                         (data.processos_verificados === 0 && !detalhes?.isComplete);
        
        if (isRunning) {
          setLiveExecution({
            id: data.id,
            status: 'em_andamento',
            tipo: data.tipo,
            processados: detalhes?.current || 0,
            total: (detalhes?.total as number) || data.processos_verificados || 0,
            resultados: data.novos_andamentos || 0,
            erros: data.erros || 0,
            iniciado_em: data.executado_em,
            duracao_segundos: detalhes?.duracao_s || 0,
            detalhes,
          });
          setUpdatedAt(new Date());
        } else {
          setLiveExecution(null);
        }
        return;
      }

      // Fallback: alguns tipos (ex.: termos/distribuicoes) não alimentam historico_monitoramento
      const { data: cfg } = await supabase
        .from('configuracoes_monitoramento')
        .select('id, tipo, ativo, ultima_execucao, metadata')
        .eq('tipo', tipo)
        .is('coordenacao_id', null)
        .maybeSingle();

      if (disposed) return;

      const execFromCfg = buildExecutionFromConfig(cfg);
      setLiveExecution(execFromCfg);
      if (execFromCfg) setUpdatedAt(new Date());
    };

    checkCurrentExecution();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`historico-${tipo}-realtime`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'historico_monitoramento',
          filter: `tipo=eq.${tipo}`
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData) {
            const detalhes = newData.detalhes as Record<string, any> | null;
            const isComplete = detalhes?.isComplete || detalhes?.status === 'concluido';
            
            if (isComplete) {
              setLiveExecution(null);
              queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
              queryClient.invalidateQueries({ queryKey: ['historico-monitoramento'] });
              
              const msg = tipo === 'andamentos' 
                ? `Andamentos: ${newData.processos_verificados} processos, ${newData.novos_andamentos} novos`
                : tipo === 'redistribuicoes'
                ? `Redistribuições: ${newData.processos_verificados} processos verificados`
                : tipo === 'distribuicoes'
                ? `Distribuições: ${newData.novos_andamentos} novas encontradas`
                : tipo === 'termos'
                ? `Monitoração 360: ${newData.processos_verificados} processos, ${newData.novos_andamentos} alertas`
                : `Concluído: ${newData.processos_verificados} verificados`;
              
              toast.success(msg);
            } else {
              setLiveExecution({
                id: newData.id,
                status: 'em_andamento',
                tipo: newData.tipo,
                processados: detalhes?.current || detalhes?.processed || 0,
                total: (detalhes?.total as number) || newData.processos_verificados || 0,
                resultados: newData.novos_andamentos || 0,
                erros: newData.erros || 0,
                iniciado_em: newData.executado_em,
                duracao_segundos: detalhes?.duracao_s || 0,
                detalhes,
              });
              setUpdatedAt(new Date());
            }
          }
        }
      )
      .subscribe();

    const configChannel = supabase
      .channel(`configuracoes-${tipo}-realtime`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'configuracoes_monitoramento',
          filter: `tipo=eq.${tipo}`,
        },
        (payload) => {
          const cfg = payload.new as any;
          const metadata = (cfg?.metadata as Record<string, any> | null) ?? {};

          // Se registrou um "last_complete_run" novo, consideramos execução concluída (e soltamos toast)
          if (metadata.last_complete_run && metadata.last_complete_run !== lastCompleteRunSeen) {
            lastCompleteRunSeen = metadata.last_complete_run;
            const completedAtMs = new Date(metadata.last_complete_run).getTime();
            if (Date.now() - completedAtMs <= 2 * 60 * 1000) {
              setLiveExecution(null);
              queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
              queryClient.invalidateQueries({ queryKey: ['historico-monitoramento'] });
              toast.success(`Execução concluída (${tipo})`);
              return;
            }
          }

          const execFromCfg = buildExecutionFromConfig(cfg);
          setLiveExecution(execFromCfg);
          setUpdatedAt(new Date());
          queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
        }
      )
      .subscribe();

    // Polling como fallback
    const interval = setInterval(checkCurrentExecution, 5000);

    return () => {
      disposed = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
      supabase.removeChannel(configChannel);
    };
  }, [tipo, queryClient]);

  // Se está executando manualmente via frontend loop
  if (executandoManual && progressoManual) {
    const percent = progressoManual.total > 0 
      ? Math.round((progressoManual.current / progressoManual.total) * 100)
      : 0;

    return (
      <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary animate-spin" />
          <span className="text-sm font-medium">{titulo}</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Processando: {progressoManual.current}/{progressoManual.total}</span>
            <span className="text-muted-foreground">{percent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>

        {showCancel && onCancel && (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={onCancel}
            className="w-full"
          >
            <StopCircle className="h-4 w-4 mr-2" />
            Cancelar Execução
          </Button>
        )}
      </div>
    );
  }

  // Se há uma execução em tempo real detectada
  if (liveExecution) {
    const percent = liveExecution.total > 0 
      ? Math.min(100, Math.round((liveExecution.processados / liveExecution.total) * 100))
      : (liveExecution.detalhes?.percentage || 0);

    const hasValidProgress = liveExecution.total > 0 && percent > 0;

    return (
      <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm font-medium">{titulo}</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {format(toZonedTime(new Date(liveExecution.iniciado_em), 'America/Sao_Paulo'), "HH:mm", { locale: ptBR })}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              {hasValidProgress
                ? `Processando: ${liveExecution.processados.toLocaleString('pt-BR')} de ${liveExecution.total.toLocaleString('pt-BR')}`
                : liveExecution.processados > 0
                  ? `Processando lote ${Math.ceil(liveExecution.processados / 1000)}...`
                  : 'Iniciando varredura...'}
            </span>
            {hasValidProgress && (
              <span className="text-primary font-medium">{percent}%</span>
            )}
            {liveExecution.resultados !== undefined && liveExecution.resultados > 0 && (
              <span className="text-green-600 font-medium">+{liveExecution.resultados} alertas</span>
            )}
          </div>
          {hasValidProgress ? (
            <Progress value={percent} className="h-2" />
          ) : (
            <IndeterminateProgress />
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 text-xs">
          {liveExecution.duracao_segundos !== undefined && liveExecution.duracao_segundos > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {liveExecution.duracao_segundos}s
            </Badge>
          )}
          {updatedAt && (
            <Badge variant="secondary" className="gap-1">
              <RefreshCw className="h-3 w-3" />
              atualizado {format(toZonedTime(updatedAt, 'America/Sao_Paulo'), "HH:mm:ss", { locale: ptBR })}
            </Badge>
          )}
          {liveExecution.erros !== undefined && liveExecution.erros > 0 && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              {liveExecution.erros} erros
            </Badge>
          )}
        </div>

        {showCancel && onCancel && (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={onCancel}
            className="w-full mt-2"
          >
            <StopCircle className="h-4 w-4 mr-2" />
            Cancelar Execução
          </Button>
        )}
      </div>
    );
  }

  // Nada em execução
  return null;
}
