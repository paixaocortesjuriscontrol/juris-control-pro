import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FileText, Clock, PlayCircle, RefreshCw, XCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LiveExecutionPanel } from "./LiveExecutionPanel";
import { HorarioAgendadoInfo } from "./HorarioAgendadoInfo";
import { BotaoRetomarLote } from "./BotaoRetomarLote";
import { useExecutarMonitoramento } from "@/hooks/useExecutarMonitoramento";

interface Props {
  coordenacaoId: string;
}

const HORARIOS_DISPONIVEIS = [
  { value: '09:00', label: '09:00' },
  { value: '12:00', label: '12:00' },
  { value: '14:00', label: '14:00' },
  { value: '18:00', label: '18:00' },
  { value: '21:00', label: '21:00' },
];

export function MonitoramentoAndamentosCard({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();
  const [confirmReativarOpen, setConfirmReativarOpen] = useState(false);
  const [pendingRunMode, setPendingRunMode] = useState<'novo' | 'retomar' | null>(null);

  // Query para buscar configuração
  const { data: config, isLoading } = useQuery({
    queryKey: ['config-monitoramento', 'andamentos', coordenacaoId],
    queryFn: async () => {
      let query = supabase
        .from('configuracoes_monitoramento')
        .select('*')
        .eq('tipo', 'andamentos');
      
      if (coordenacaoId) {
        query = query.eq('coordenacao_id', coordenacaoId);
      } else {
        query = query.is('coordenacao_id', null);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Mutation para atualizar horários
  const atualizarHorarios = useMutation({
    mutationFn: async (horarios: string[]) => {
      if (!config?.id) {
        const { error } = await supabase
          .from('configuracoes_monitoramento')
          .insert({
            tipo: 'andamentos',
            coordenacao_id: coordenacaoId || null,
            horarios_execucao: horarios,
            ativo: true,
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('configuracoes_monitoramento')
          .update({ 
            horarios_execucao: horarios,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-monitoramento'] });
      toast.success('Horários atualizados!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const horariosSelecionados = (config?.horarios_execucao as string[]) || [];

  const handleToggleHorario = (horario: string) => {
    const novosHorarios = horariosSelecionados.includes(horario)
      ? horariosSelecionados.filter(h => h !== horario)
      : [...horariosSelecionados, horario];
    
    atualizarHorarios.mutate(novosHorarios);
  };

  const { executando, cancelando, executar, cancelar } = useExecutarMonitoramento({
    tipo: 'andamentos',
    configId: config?.id,
  });

  const metadata = config?.metadata as Record<string, any> | null;
  const nextOffset = metadata?.next_offset as number | undefined;
  const totalProcessos = metadata?.total as number | undefined;

  const isPausadoOuDesativado = useMemo(() => {
    const md = metadata ?? {};
    return config?.ativo === false || md.paused_globally === true;
  }, [config?.ativo, metadata]);

  const reativarMonitoramento = async (mode: 'novo' | 'retomar') => {
    if (!config?.id) return;

    // Se for execução nova, limpar TODOS os dados de progresso
    const resetMetadata = mode === 'novo' 
      ? {
          paused_globally: false,
          cancelado: false,
          status: 'idle',
          continuingRun: false,
          // Limpar progresso antigo para começar do zero
          next_offset: 0,
          current: 0,
          total: 0,
          percentage: 0,
          processados: 0,
          encontrados: 0,
        }
      : {
          // Retomar: manter next_offset, mas resetar flags
          ...(metadata ?? {}),
          paused_globally: false,
          cancelado: false,
          status: 'idle',
          continuingRun: true,
        };

    const { error } = await supabase
      .from('configuracoes_monitoramento')
      .update({
        ativo: true,
        metadata: resetMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id);

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['config-monitoramento'] });
    queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
  };

  const handleExecutar = async (mode: 'novo' | 'retomar') => {
    if (isPausadoOuDesativado) {
      setPendingRunMode(mode);
      setConfirmReativarOpen(true);
      return;
    }
    await executar(mode === 'retomar');
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
      <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Monitoramento de Andamentos
              <span title="Detecta audiências automaticamente">
                  <Calendar className="h-4 w-4 text-primary" />
              </span>
            </CardTitle>
            <CardDescription>
              Busca novos andamentos e detecta audiências automaticamente
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horários de Execução */}
        <div>
          <Label className="text-sm font-medium">Horários de Execução</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Selecione os horários para buscar andamentos e detectar audiências
          </p>
          
          <div className="flex flex-col gap-2">
            {HORARIOS_DISPONIVEIS.map((horario) => (
              <label
                key={horario.value}
                className={`
                  flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                  ${horariosSelecionados.includes(horario.value) 
                    ? 'bg-primary/10 border-primary' 
                    : 'hover:bg-muted'}
                `}
              >
                <Checkbox
                  checked={horariosSelecionados.includes(horario.value)}
                  onCheckedChange={() => handleToggleHorario(horario.value)}
                  disabled={atualizarHorarios.isPending}
                />
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{horario.label}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Horário agendado */}
        <HorarioAgendadoInfo 
          horariosExecucao={config?.horarios_execucao as string[] | null}
          frequencia={config?.frequencia}
        />

        {/* Última execução */}
        {config?.ultima_execucao && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground pt-4 border-t">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                Última execução: {format(toZonedTime(new Date(config.ultima_execucao), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            {config.metadata && typeof config.metadata === 'object' && 'last_complete_run' in config.metadata && config.metadata.last_complete_run && (
              <span className="text-xs text-primary ml-6">
                Última execução completa: {format(toZonedTime(new Date(String(config.metadata.last_complete_run)), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        )}

        {/* Painel de Execução em Tempo Real */}
        <LiveExecutionPanel
          tipo="andamentos"
          titulo="Buscando andamentos e audiências..."
          onCancel={cancelar}
          showCancel
        />

        {/* Botão de execução */}
        <div className="flex gap-2 pt-4 border-t flex-wrap">
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
                    const mode = pendingRunMode ?? 'novo';
                    await reativarMonitoramento(mode);
                    toast.success('Monitoramento reativado. Iniciando execução...');
                    setPendingRunMode(null);
                    // dispara a execução após reativar
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

        {/* Nota explicativa */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Este monitoramento busca andamentos via DataJud/CNJ e detecta automaticamente 
            audiências e intimações nas movimentações, exibindo-as nos painéis correspondentes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
