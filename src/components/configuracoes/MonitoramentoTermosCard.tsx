import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Radar, Clock, PlayCircle, XCircle } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LiveExecutionPanel } from "./LiveExecutionPanel";
import { HorarioAgendadoInfo } from "./HorarioAgendadoInfo";
import { useNavigate } from "react-router-dom";

interface Props {
  coordenacaoId: string;
}

export function MonitoramentoTermosCard({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { 
    configuracaoTermos, 
    isLoading, 
    atualizarConfiguracao, 
    executarMonitoramento 
  } = useConfiguracoesMonitoramento(coordenacaoId);

  const [disparando, setDisparando] = useState(false);
  const [execucaoId, setExecucaoId] = useState<string | null>(null);
  const canceladoRef = useRef(false);

  const isRunning = useMemo(() => {
    const md = (configuracaoTermos?.metadata as Record<string, any> | null) ?? {};
    return (
      md.status === 'em_andamento' ||
      md.continuingRun === true ||
      (typeof md.next_offset === 'number' && md.next_offset > 0)
    );
  }, [configuracaoTermos?.metadata]);

  const handleCancelar = async () => {
    canceladoRef.current = true;
    toast.info("Cancelando execução...");
    
    // 1) Cancelar DIRETO no banco (execucoes_agendadas) para refletir imediatamente no dashboard
    //    (se não houver execucaoId, tenta cancelar a última execução em andamento do tipo)
    try {
      if (execucaoId) {
        await supabase
          .from('execucoes_agendadas')
          .update({
            status: 'cancelado',
            finalizado_em: new Date().toISOString(),
          })
          .eq('id', execucaoId);
      } else {
        const { data: last } = await supabase
          .from('execucoes_agendadas')
          .select('id')
          .eq('tipo', 'termos')
          .eq('status', 'executando')
          .order('iniciado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (last?.id) {
          await supabase
            .from('execucoes_agendadas')
            .update({
              status: 'cancelado',
              finalizado_em: new Date().toISOString(),
            })
            .eq('id', last.id);
        }
      }
    } catch (e) {
      console.error('Erro ao cancelar execucoes_agendadas:', e);
    }

    // 2) Setar flag de cancelamento no banco para parar auto-continuação
    if (configuracaoTermos?.id) {
      const currentMetadata = (configuracaoTermos.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: { ...currentMetadata, cancelado: true, status: 'cancelando', continuingRun: false },
        })
        .eq('id', configuracaoTermos.id);
    }

    queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
  };

  const handleExecutarCompleto = async () => {
    if (disparando || isRunning) return;
    setDisparando(true);
    canceladoRef.current = false;

    try {
      toast.info('Varredura iniciada! Acompanhe o progresso no painel abaixo.');

      // Resetar offset/estado no banco ANTES de disparar (evita "retomar execução antiga")
      if (configuracaoTermos?.id) {
        const currentMetadata = (configuracaoTermos.metadata as Record<string, any>) || {};
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...currentMetadata,
              next_offset: 0,
              current: 0,
              total: 0,
              percentage: 0,
              cancelado: false,
              status: 'em_andamento',
              continuingRun: true,
            },
            ultima_execucao: new Date().toISOString(),
          })
          .eq('id', configuracaoTermos.id);
      }

      // Criar uma execução (para cancelar direto no banco)
      const { data: execucao } = await supabase
        .from('execucoes_agendadas')
        .insert({
          tipo: 'termos',
          job_name: 'manual-monitorar-termos',
          status: 'executando',
          iniciado_em: new Date().toISOString(),
        })
        .select('id')
        .single();

      const newExecId = execucao?.id ?? null;
      setExecucaoId(newExecId);

      // Dispara em background (não aguardamos; o painel acompanha)
      supabase.functions.invoke('monitorar-termos', {
        body: { completeRun: true, execucaoId: newExecId },
      }).catch((err) => {
        console.error('Erro ao disparar monitorar-termos:', err);
      });

      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
    } catch (error) {
      toast.error(`Erro na varredura: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      canceladoRef.current = false;
    } finally {
      setDisparando(false);
    }
  };

  const handleFrequenciaChange = (frequencia: string) => {
    if (configuracaoTermos) {
      atualizarConfiguracao.mutate({ id: configuracaoTermos.id, frequencia, tipo: 'termos' });
    }
  };

  const handleAtivoChange = (ativo: boolean) => {
    if (configuracaoTermos) {
      atualizarConfiguracao.mutate({ id: configuracaoTermos.id, ativo, tipo: 'termos' });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Radar className="h-6 w-6 text-primary animate-spin" />
          </div>
          <div>
            <CardTitle className="text-lg">Carregando...</CardTitle>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Radar className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">Monitoração 360º</CardTitle>
          <CardDescription>
            Varredura automática de termos estratégicos nas movimentações
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status e Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ativo-termos">Varredura Ativa</Label>
            <p className="text-sm text-muted-foreground">
              {configuracaoTermos?.ativo ? "Executando automaticamente" : "Pausada"}
            </p>
          </div>
          <Switch
            id="ativo-termos"
            checked={configuracaoTermos?.ativo ?? true}
            onCheckedChange={handleAtivoChange}
            disabled={atualizarConfiguracao.isPending}
          />
        </div>

        {/* Frequência */}
        <div className="space-y-2">
          <Label htmlFor="frequencia-termos">Frequência de Execução</Label>
          <Select 
            value={configuracaoTermos?.frequencia || 'diario'} 
            onValueChange={handleFrequenciaChange}
            disabled={atualizarConfiguracao.isPending}
          >
            <SelectTrigger id="frequencia-termos">
              <SelectValue placeholder="Selecione a frequência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário (9h BRT)</SelectItem>
              <SelectItem value="2x_dia">2x ao dia (9h e 18h BRT)</SelectItem>
              <SelectItem value="semanal">Semanal (Segunda 9h BRT)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Horário agendado */}
        <HorarioAgendadoInfo 
          horariosExecucao={configuracaoTermos?.horarios_execucao}
          frequencia={configuracaoTermos?.frequencia}
        />

        {/* Última execução */}
        {configuracaoTermos?.ultima_execucao && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                Última execução: {format(toZonedTime(new Date(configuracaoTermos.ultima_execucao), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            {configuracaoTermos.metadata?.next_offset !== undefined && configuracaoTermos.metadata.next_offset > 0 && (
              <span className="text-xs">
                Progresso: próximo lote a partir do processo #{configuracaoTermos.metadata.next_offset + 1}
              </span>
            )}
             {configuracaoTermos.metadata?.last_complete_run && (
               <span className="text-xs text-primary">
                Última execução completa: {format(toZonedTime(new Date(configuracaoTermos.metadata.last_complete_run), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        )}

        {/* Painel de Execução em Tempo Real */}
        <LiveExecutionPanel
          tipo="termos"
          titulo="Verificando termos estratégicos..."
          onCancel={handleCancelar}
          showCancel
        />

        {/* Botão de execução */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/monitoramento360')}
            className="flex-1"
          >
            Ver alertas
          </Button>
          <Button
            onClick={handleExecutarCompleto}
            disabled={disparando || isRunning}
            className="flex-1"
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            {isRunning ? 'Executando...' : 'Executar Completo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
