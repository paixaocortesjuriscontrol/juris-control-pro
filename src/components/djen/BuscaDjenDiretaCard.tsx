import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, RefreshCw, AlertCircle, CheckCircle, RotateCcw } from "lucide-react";
import { useBuscaDjenDireta } from "@/hooks/useBuscaDjenDireta";
import { cn } from "@/lib/utils";
import { useState } from "react";
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

interface BuscaDjenDiretaCardProps {
  monitoramentosIds?: string[];
  className?: string;
}

export function BuscaDjenDiretaCard({ monitoramentosIds, className }: BuscaDjenDiretaCardProps) {
  const { progresso, executando, executarMonitoramento, cancelarExecucao, verificarCheckpoint, limparCheckpoint } = useBuscaDjenDireta();
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  const porcentagem = progresso.totalMonitoramentos > 0
    ? Math.round((progresso.monitoramentoAtual / progresso.totalMonitoramentos) * 100)
    : 0;

  const checkpoint = verificarCheckpoint();
  const hasCheckpoint = !!checkpoint && progresso.status !== 'executando';
  const checkpointPercent = checkpoint 
    ? Math.round((checkpoint.monitoramentosProcessados.length / (progresso.totalMonitoramentos || 114)) * 100)
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
    if (hasCheckpoint) {
      setShowResumeDialog(true);
    } else {
      executarMonitoramento(monitoramentosIds, false);
    }
  };

  const handleRetomar = () => {
    setShowResumeDialog(false);
    executarMonitoramento(monitoramentosIds, true);
  };

  const handleExecutarDoZero = () => {
    setShowResumeDialog(false);
    limparCheckpoint();
    executarMonitoramento(monitoramentosIds, false);
  };

  return (
    <>
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

          {/* Alerta de checkpoint */}
          {hasCheckpoint && (
            <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-sm">
              <RotateCcw className="h-4 w-4 text-orange-600 flex-shrink-0" />
              <span className="text-orange-700">
                Execução interrompida em <strong>{checkpointPercent}%</strong>
              </span>
            </div>
          )}

          {progresso.status === 'executando' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Fase {progresso.faseAtual}: {progresso.faseAtual === 1 ? 'Buscando' : progresso.faseAtual === 2 ? 'Identificando' : 'Notificando'}</span>
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
            {executando ? (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={cancelarExecucao}
                className="w-full"
              >
                <Square className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleExecutar}
                className="w-full"
              >
                {hasCheckpoint ? (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Continuar ({checkpointPercent}%)
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Executar Busca DJEN
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            💡 Esta busca funciona 100% no navegador, evitando problemas de timeout
          </p>
        </CardContent>
      </Card>

      {/* Dialog de Retomada */}
      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-600" />
              Execução Interrompida
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Uma execução anterior foi interrompida em <strong>{checkpointPercent}%</strong> de progresso.
              </p>
              <p>
                Deseja retomar de onde parou ou começar do zero?
              </p>
              {checkpoint && (
                <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                  <div><strong>Monitoramentos processados:</strong> {checkpoint.monitoramentosProcessados.length}</div>
                  <div><strong>Publicações encontradas:</strong> {checkpoint.totalNovas}</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecutarDoZero}
              className="bg-muted text-foreground hover:bg-muted/80"
            >
              Começar do Zero
            </AlertDialogAction>
            <AlertDialogAction onClick={handleRetomar}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retomar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
