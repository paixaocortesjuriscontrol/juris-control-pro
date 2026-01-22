import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, Clock, PlayCircle, XCircle } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { useExecutarMonitoramento } from "@/hooks/useExecutarMonitoramento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LiveExecutionPanel } from "./LiveExecutionPanel";
import { HorarioAgendadoInfo } from "./HorarioAgendadoInfo";
import { BotaoRetomarLote } from "./BotaoRetomarLote";

interface Props {
  coordenacaoId: string;
}

export function MonitoramentoRedistribuicoesCard({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();
  const [confirmReativarOpen, setConfirmReativarOpen] = useState(false);
  const [pendingRunMode, setPendingRunMode] = useState<'novo' | 'retomar' | null>(null);

  const { 
    configuracaoRedistribuicoes, 
    isLoading, 
    atualizarConfiguracao, 
  } = useConfiguracoesMonitoramento(coordenacaoId);

  const { executando, cancelando, executar, cancelar } = useExecutarMonitoramento({
    tipo: 'redistribuicoes',
    configId: configuracaoRedistribuicoes?.id,
  });

  const metadata = configuracaoRedistribuicoes?.metadata as Record<string, any> | null;
  const nextOffset = metadata?.next_offset as number | undefined;
  const totalProcessos = metadata?.total as number | undefined;

  const isPausadoOuDesativado = useMemo(() => {
    const md = metadata ?? {};
    return configuracaoRedistribuicoes?.ativo === false || md.paused_globally === true;
  }, [configuracaoRedistribuicoes?.ativo, metadata]);

  const reativarMonitoramento = async () => {
    if (!configuracaoRedistribuicoes?.id) return;
    const currentMetadata = (metadata ?? {}) as Record<string, any>;

    const { error } = await supabase
      .from('configuracoes_monitoramento')
      .update({
        ativo: true,
        metadata: {
          ...currentMetadata,
          paused_globally: false,
          cancelado: false,
          status: 'idle',
          continuingRun: false,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', configuracaoRedistribuicoes.id);

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
  };

  const handleExecutar = async (mode: 'novo' | 'retomar') => {
    if (isPausadoOuDesativado) {
      setPendingRunMode(mode);
      setConfirmReativarOpen(true);
      return;
    }
    await executar(mode === 'retomar');
  };

  const handleFrequenciaChange = (frequencia: string) => {
    if (configuracaoRedistribuicoes) {
      atualizarConfiguracao.mutate({ id: configuracaoRedistribuicoes.id, frequencia, tipo: 'redistribuicoes' });
    }
  };

  const handleAtivoChange = (ativo: boolean) => {
    if (configuracaoRedistribuicoes) {
      atualizarConfiguracao.mutate({ id: configuracaoRedistribuicoes.id, ativo, tipo: 'redistribuicoes' });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <RefreshCw className="h-6 w-6 text-primary animate-spin" />
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
          <RefreshCw className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">Monitoramento de Redistribuições</CardTitle>
          <CardDescription>
            Verifica automaticamente mudanças de vara nos processos
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status e Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ativo">Monitoramento Ativo</Label>
            <p className="text-sm text-muted-foreground">
              {configuracaoRedistribuicoes?.ativo ? "Executando automaticamente" : "Pausado"}
            </p>
          </div>
          <Switch
            id="ativo"
            checked={configuracaoRedistribuicoes?.ativo ?? true}
            onCheckedChange={handleAtivoChange}
            disabled={atualizarConfiguracao.isPending}
          />
        </div>

        {/* Frequência */}
        <div className="space-y-2">
          <Label htmlFor="frequencia">Frequência de Execução</Label>
          <Select 
            value={configuracaoRedistribuicoes?.frequencia || 'diario'} 
            onValueChange={handleFrequenciaChange}
            disabled={atualizarConfiguracao.isPending}
          >
            <SelectTrigger id="frequencia">
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
          horariosExecucao={configuracaoRedistribuicoes?.horarios_execucao}
          frequencia={configuracaoRedistribuicoes?.frequencia}
        />

        {/* Última execução */}
        {configuracaoRedistribuicoes?.ultima_execucao && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                Última execução: {format(toZonedTime(new Date(configuracaoRedistribuicoes.ultima_execucao), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            {configuracaoRedistribuicoes.metadata?.next_offset !== undefined && configuracaoRedistribuicoes.metadata.next_offset > 0 && (
              <span className="text-xs">
                Progresso: próximo lote a partir do processo #{configuracaoRedistribuicoes.metadata.next_offset + 1}
              </span>
            )}
            {configuracaoRedistribuicoes.metadata?.last_complete_run && (
              <span className="text-xs text-primary">
                Última execução completa: {format(toZonedTime(new Date(configuracaoRedistribuicoes.metadata.last_complete_run), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        )}

        {/* Painel de Execução em Tempo Real */}
        <LiveExecutionPanel
          tipo="redistribuicoes"
          titulo="Verificando redistribuições..."
          onCancel={cancelar}
          showCancel
        />

        {/* Botão de execução */}
        <div className="flex gap-2 flex-wrap">
          <BotaoRetomarLote
            nextOffset={nextOffset}
            total={totalProcessos}
            onRetomar={() => handleExecutar('retomar')}
            disabled={executando || cancelando}
          />
          {executando ? (
            <Button 
              onClick={cancelar} 
              variant="destructive"
              className="flex-1"
              disabled={cancelando}
            >
              <XCircle className="h-4 w-4 mr-2" />
              {cancelando ? 'Cancelando...' : 'Cancelar'}
            </Button>
          ) : (
            <Button 
              onClick={() => handleExecutar('novo')} 
              disabled={executando}
              className="flex-1"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Executar Completo
            </Button>
          )}
        </div>

        <AlertDialog open={confirmReativarOpen} onOpenChange={setConfirmReativarOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Monitoramento está desativado/pausado</AlertDialogTitle>
              <AlertDialogDescription>
                Para executar agora, precisamos reativar o monitoramento (remover pausa global e limpar o estado de cancelamento).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingRunMode(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await reativarMonitoramento();
                    toast.success('Monitoramento reativado. Iniciando execução...');
                    const mode = pendingRunMode;
                    setPendingRunMode(null);
                    await executar(mode === 'retomar');
                  } catch (e: any) {
                    toast.error(`Não foi possível reativar: ${e?.message || 'erro desconhecido'}`);
                  }
                }}
              >
                Reativar e executar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
