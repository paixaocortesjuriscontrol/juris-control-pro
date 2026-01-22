import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Radar, Clock, PlayCircle, XCircle } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { useExecutarMonitoramento } from "@/hooks/useExecutarMonitoramento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { LiveExecutionPanel } from "./LiveExecutionPanel";
import { HorarioAgendadoInfo } from "./HorarioAgendadoInfo";
import { BotaoRetomarLote } from "./BotaoRetomarLote";
import { useNavigate } from "react-router-dom";

interface Props {
  coordenacaoId: string;
}

export function MonitoramentoTermosCard({ coordenacaoId }: Props) {
  const navigate = useNavigate();
  const { 
    configuracaoTermos, 
    isLoading, 
    atualizarConfiguracao, 
  } = useConfiguracoesMonitoramento(coordenacaoId);

  const { executando, cancelando, executar, cancelar } = useExecutarMonitoramento({
    tipo: 'termos',
    configId: configuracaoTermos?.id,
  });

  const metadata = configuracaoTermos?.metadata as Record<string, any> | null;
  const nextOffset = metadata?.next_offset as number | undefined;
  const totalProcessos = metadata?.total as number | undefined;

  const isRunning = useMemo(() => {
    const md = metadata ?? {};
    return (
      (md.status === 'em_andamento' && md.cancelado !== true && md.paused_globally !== true) ||
      executando
    );
  }, [metadata, executando]);

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
          onCancel={cancelar}
          showCancel
        />

        {/* Botão de execução */}
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/monitoramento360')}
          >
            Ver alertas
          </Button>
          <BotaoRetomarLote
            nextOffset={nextOffset}
            total={totalProcessos}
            onRetomar={() => executar(true)}
            disabled={executando || cancelando || isRunning}
          />
          {isRunning ? (
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
              onClick={() => executar(false)}
              disabled={executando || isRunning}
              className="flex-1"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Executar Completo
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
