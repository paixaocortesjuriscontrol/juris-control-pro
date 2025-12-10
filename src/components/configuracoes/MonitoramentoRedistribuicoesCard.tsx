import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Settings, Play, Clock, PlayCircle } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const frequenciaLabels: Record<string, string> = {
  diario: "Diário (7h)",
  "2x_dia": "2x ao dia (7h e 18h)",
  semanal: "Semanal (Segunda 7h)",
};

export function MonitoramentoRedistribuicoesCard() {
  const { 
    configuracaoRedistribuicoes, 
    isLoading, 
    atualizarConfiguracao, 
    executarMonitoramento 
  } = useConfiguracoesMonitoramento();

  const [executando, setExecutando] = useState(false);
  const [executandoCompleto, setExecutandoCompleto] = useState(false);
  const [progresso, setProgresso] = useState<{ current: number; total: number; percentage: number } | null>(null);

  const handleExecutarManual = async () => {
    setExecutando(true);
    try {
      await executarMonitoramento.mutateAsync('redistribuicoes');
    } finally {
      setExecutando(false);
    }
  };

  const handleExecutarCompleto = async () => {
    setExecutandoCompleto(true);
    setProgresso({ current: 0, total: 0, percentage: 0 });
    
    try {
      let isComplete = false;
      let totalRedistribuicoes = 0;
      let totalChecked = 0;
      
      while (!isComplete) {
        const { data, error } = await supabase.functions.invoke('monitorar-redistribuicoes');
        
        if (error) {
          throw error;
        }
        
        if (data?.progress) {
          setProgresso(data.progress);
        }
        
        totalChecked += data?.results?.checked || 0;
        totalRedistribuicoes += data?.results?.redistributions || 0;
        isComplete = data?.isComplete || false;
        
        // Small delay between batches
        if (!isComplete) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      toast.success(`Monitoramento completo: ${totalChecked} processos verificados, ${totalRedistribuicoes} redistribuições detectadas`);
    } catch (error) {
      toast.error(`Erro no monitoramento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setExecutandoCompleto(false);
      setProgresso(null);
    }
  };

  const handleFrequenciaChange = (frequencia: string) => {
    if (configuracaoRedistribuicoes) {
      atualizarConfiguracao.mutate({ id: configuracaoRedistribuicoes.id, frequencia });
    }
  };

  const handleAtivoChange = (ativo: boolean) => {
    if (configuracaoRedistribuicoes) {
      atualizarConfiguracao.mutate({ id: configuracaoRedistribuicoes.id, ativo });
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
              <SelectItem value="diario">Diário (7h BRT)</SelectItem>
              <SelectItem value="2x_dia">2x ao dia (7h e 18h BRT)</SelectItem>
              <SelectItem value="semanal">Semanal (Segunda 7h BRT)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Última execução */}
        {configuracaoRedistribuicoes?.ultima_execucao && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                {(() => {
                  try {
                    const meta = JSON.parse(configuracaoRedistribuicoes.ultima_execucao);
                    if (meta.timestamp) {
                      return `Última execução: ${format(new Date(meta.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
                    }
                  } catch {
                    // Old format - direct date string
                    return `Última execução: ${format(new Date(configuracaoRedistribuicoes.ultima_execucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
                  }
                  return null;
                })()}
              </span>
            </div>
            {(() => {
              try {
                const meta = JSON.parse(configuracaoRedistribuicoes.ultima_execucao);
                if (meta.next_offset !== undefined && meta.next_offset > 0) {
                  return (
                    <span className="text-xs">
                      Progresso: próximo lote a partir do processo #{meta.next_offset + 1}
                    </span>
                  );
                }
              } catch {
                // Ignore
              }
              return null;
            })()}
          </div>
        )}

        {/* Progresso do monitoramento completo */}
        {executandoCompleto && progresso && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Verificando processos...</span>
              <span>{progresso.current} de {progresso.total} ({progresso.percentage}%)</span>
            </div>
            <Progress value={progresso.percentage} className="h-2" />
          </div>
        )}

        {/* Botões de execução */}
        <div className="flex gap-2">
          <Button 
            onClick={handleExecutarManual} 
            disabled={executando || executandoCompleto}
            className="flex-1"
            variant="outline"
          >
            {executando ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Verificando lote...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Executar Lote
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleExecutarCompleto} 
            disabled={executando || executandoCompleto}
            className="flex-1"
          >
            {executandoCompleto ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Executar Completo
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
