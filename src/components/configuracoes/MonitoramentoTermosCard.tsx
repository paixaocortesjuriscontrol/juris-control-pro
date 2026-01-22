import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

  const [executandoCompleto, setExecutandoCompleto] = useState(false);
  const canceladoRef = useRef(false);

  const handleCancelar = async () => {
    canceladoRef.current = true;
    toast.info("Cancelando execução...");
    
    // Setar flag de cancelamento no banco para parar auto-continuação
    if (configuracaoTermos?.id) {
      const currentMetadata = (configuracaoTermos.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({ 
          metadata: { ...currentMetadata, cancelado: true, status: 'cancelando' }
        })
        .eq('id', configuracaoTermos.id);
    }
  };

  const handleExecutarCompleto = async () => {
    setExecutandoCompleto(true);
    canceladoRef.current = false;

    try {
      // Mostrar feedback imediato - a execução vai rodar em background
      toast.info('Varredura iniciada! Acompanhe o progresso no painel abaixo.');
      
      // Invalidar queries para forçar o painel a verificar status
      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });

      // Dispara a edge function em background (fire and forget)
      // O painel LiveExecutionPanel vai acompanhar via realtime
      supabase.functions.invoke('monitorar-termos', {
        body: { completeRun: true }
      }).then(({ data, error }) => {
        // Este callback só executa quando a edge function REALMENTE termina
        // (pode demorar vários minutos se houver muitos lotes)
        if (error) {
          console.error('Erro na varredura:', error);
          toast.error(`Erro na varredura: ${error.message}`);
        } else if (data?.cancelled) {
          toast.info('Varredura cancelada.');
        }
        // NÃO mostramos toast de sucesso aqui - o LiveExecutionPanel já faz isso
        
        setExecutandoCompleto(false);
        canceladoRef.current = false;
        queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
        queryClient.invalidateQueries({ queryKey: ['alertas-monitoramento'] });
      }).catch(err => {
        console.error('Erro na varredura:', err);
        toast.error(`Erro na varredura: ${err.message}`);
        setExecutandoCompleto(false);
      });
      
    } catch (error) {
      toast.error(`Erro na varredura: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setExecutandoCompleto(false);
      canceladoRef.current = false;
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
              <span className="text-xs text-green-600">
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
          {executandoCompleto ? (
            <Button 
              onClick={handleCancelar} 
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          ) : (
            <Button 
              onClick={handleExecutarCompleto} 
              disabled={executandoCompleto}
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
