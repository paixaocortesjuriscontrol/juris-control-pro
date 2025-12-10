import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileText, Play, Clock, PlayCircle, RefreshCw } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function MonitoramentoAndamentosCard() {
  const { 
    configuracaoAndamentos, 
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
      await executarMonitoramento.mutateAsync('andamentos');
    } finally {
      setExecutando(false);
    }
  };

  const handleExecutarCompleto = async () => {
    setExecutandoCompleto(true);
    setProgresso({ current: 0, total: 0, percentage: 0 });
    
    try {
      let isComplete = false;
      let totalAndamentos = 0;
      let totalChecked = 0;
      
      while (!isComplete) {
        const { data, error } = await supabase.functions.invoke('monitorar-andamentos');
        
        if (error) {
          throw error;
        }
        
        if (data?.progress) {
          setProgresso(data.progress);
        }
        
        totalChecked += data?.results?.checked || 0;
        totalAndamentos += data?.results?.newMovements || 0;
        isComplete = data?.isComplete || false;
        
        if (!isComplete) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      toast.success(`Monitoramento completo: ${totalChecked} processos verificados, ${totalAndamentos} novos andamentos encontrados`);
    } catch (error) {
      toast.error(`Erro no monitoramento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setExecutandoCompleto(false);
      setProgresso(null);
    }
  };

  const handleFrequenciaChange = (frequencia: string) => {
    if (configuracaoAndamentos) {
      atualizarConfiguracao.mutate({ id: configuracaoAndamentos.id, frequencia });
    }
  };

  const handleAtivoChange = (ativo: boolean) => {
    if (configuracaoAndamentos) {
      atualizarConfiguracao.mutate({ id: configuracaoAndamentos.id, ativo });
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
        <div className="p-2 rounded-lg bg-blue-500/10">
          <FileText className="h-6 w-6 text-blue-500" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">Monitoramento de Andamentos</CardTitle>
          <CardDescription>
            Busca novos andamentos nos processos automaticamente
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status e Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ativo-andamentos">Monitoramento Ativo</Label>
            <p className="text-sm text-muted-foreground">
              {configuracaoAndamentos?.ativo ? "Executando automaticamente" : "Pausado"}
            </p>
          </div>
          <Switch
            id="ativo-andamentos"
            checked={configuracaoAndamentos?.ativo ?? true}
            onCheckedChange={handleAtivoChange}
            disabled={atualizarConfiguracao.isPending}
          />
        </div>

        {/* Frequência */}
        <div className="space-y-2">
          <Label htmlFor="frequencia-andamentos">Frequência de Execução</Label>
          <Select 
            value={configuracaoAndamentos?.frequencia || 'diario'} 
            onValueChange={handleFrequenciaChange}
            disabled={atualizarConfiguracao.isPending}
          >
            <SelectTrigger id="frequencia-andamentos">
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
        {configuracaoAndamentos?.ultima_execucao && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                {(() => {
                  try {
                    const meta = JSON.parse(configuracaoAndamentos.ultima_execucao);
                    if (meta.timestamp) {
                      return `Última execução: ${format(new Date(meta.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
                    }
                  } catch {
                    return `Última execução: ${format(new Date(configuracaoAndamentos.ultima_execucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
                  }
                  return null;
                })()}
              </span>
            </div>
            {(() => {
              try {
                const meta = JSON.parse(configuracaoAndamentos.ultima_execucao);
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
              <span>Buscando andamentos...</span>
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
                Buscando lote...
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
