import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RefreshCw, Settings, Play, Clock } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  const handleExecutarManual = async () => {
    setExecutando(true);
    try {
      await executarMonitoramento.mutateAsync('redistribuicoes');
    } finally {
      setExecutando(false);
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Última execução: {format(new Date(configuracaoRedistribuicoes.ultima_execucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        )}

        {/* Botão de execução manual */}
        <Button 
          onClick={handleExecutarManual} 
          disabled={executando}
          className="w-full"
          variant="outline"
        >
          {executando ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Verificando processos...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Executar Agora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
