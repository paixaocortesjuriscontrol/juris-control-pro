import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Radio, Clock, RefreshCw, StopCircle, CheckCircle2, XCircle, Layers, FileText } from "lucide-react";
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

  // Real-time subscription para historico_monitoramento
  useEffect(() => {
    let disposed = false;

    const checkCurrentExecution = async () => {
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
      }
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

    // Polling como fallback
    const interval = setInterval(checkCurrentExecution, 5000);

    return () => {
      disposed = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
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
      : 0;

    return (
      <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20 animate-pulse">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm font-medium">{titulo}</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {format(toZonedTime(new Date(liveExecution.iniciado_em), 'America/Sao_Paulo'), "HH:mm", { locale: ptBR })}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Processando: {liveExecution.processados}/{liveExecution.total}</span>
            {liveExecution.resultados !== undefined && liveExecution.resultados > 0 && (
              <span className="text-primary">+{liveExecution.resultados}</span>
            )}
          </div>
          <Progress value={percent} className="h-2" />
        </div>
        
        <div className="flex flex-wrap gap-2 text-xs">
          {liveExecution.duracao_segundos !== undefined && liveExecution.duracao_segundos > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {liveExecution.duracao_segundos}s
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
