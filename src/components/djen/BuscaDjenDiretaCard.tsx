import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, RefreshCw, AlertCircle, CheckCircle, Calendar as CalendarIcon, Skull, Trash2 } from "lucide-react";
import { useBuscaDjenDireta } from "@/hooks/useBuscaDjenDireta";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

interface BuscaDjenDiretaCardProps {
  monitoramentosIds?: string[];
  className?: string;
}

export function BuscaDjenDiretaCard({ monitoramentosIds, className }: BuscaDjenDiretaCardProps) {
  const { progresso, isExecutando, executarMonitoramento, cancelar, limparEstado } = useBuscaDjenDireta();
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);

  const porcentagem = progresso.totalMonitoramentos > 0
    ? Math.round((progresso.monitoramentoAtual / progresso.totalMonitoramentos) * 100)
    : 0;

  const getStatusIcon = () => {
    switch (progresso.status) {
      case 'executando':
        return <RefreshCw className="w-4 h-4 animate-spin text-primary" />;
      case 'concluido':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'cancelado':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'erro':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (progresso.status) {
      case 'executando':
        return 'bg-primary/10 text-primary';
      case 'concluido':
        return 'bg-emerald-500/10 text-emerald-600';
      case 'cancelado':
        return 'bg-orange-500/10 text-orange-600';
      case 'erro':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = () => {
    switch (progresso.status) {
      case 'executando':
        return 'Executando...';
      case 'concluido':
        return 'Concluído';
      case 'cancelado':
        return 'Cancelado';
      case 'erro':
        return 'Erro';
      default:
        return 'Aguardando';
    }
  };

  const handleExecutar = () => {
    const toYmd = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : undefined);
    executarMonitoramento(monitoramentosIds, false, toYmd(dataInicio), toYmd(dataFim));
  };

  const handleCaveira = () => {
    cancelar();
    limparEstado();
  };

  const handleLimparTudo = () => {
    limparEstado();
  };

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            📰 Busca DJEN Direta
            {getStatusIcon()}
          </CardTitle>
          {progresso.status !== 'idle' && (
            <Badge variant="secondary" className={getStatusColor()}>
              {getStatusLabel()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Busca publicações no DJEN diretamente, sem depender de Edge Functions complexas. 
          Evita travamentos e timeouts.
        </p>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dataInicio ? format(dataInicio, "dd/MM", { locale: ptBR }) : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataInicio}
                onSelect={setDataInicio}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dataFim ? format(dataFim, "dd/MM", { locale: ptBR }) : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataFim}
                onSelect={setDataFim}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {progresso.status === 'executando' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Buscando publicações...</span>
              <span>{progresso.monitoramentoAtual}/{progresso.totalMonitoramentos} monitoramentos</span>
            </div>
            <Progress value={porcentagem} className="h-2" />
            <p className="text-xs text-muted-foreground">{progresso.mensagem}</p>
          </div>
        )}

        {(progresso.status === 'concluido' || progresso.status === 'cancelado' || progresso.status === 'erro') && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium">{progresso.mensagem}</p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>✅ Novas: {progresso.publicacoesNovas}</span>
              <span>🔄 Duplicadas: {progresso.publicacoesDuplicadas}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleExecutar}
            className="w-full"
            disabled={isExecutando}
          >
            <Play className="w-4 h-4 mr-2" />
            Executar Busca DJEN
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={cancelar}
            className="w-full"
            disabled={!isExecutando}
          >
            <Square className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleCaveira}
            className="w-full"
          >
            <Skull className="w-4 h-4 mr-2" />
            Caveira
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLimparTudo}
            className="w-full"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Limpar tudo
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          💡 Esta busca funciona 100% no navegador, evitando problemas de timeout
        </p>
      </CardContent>
    </Card>
  );
}
