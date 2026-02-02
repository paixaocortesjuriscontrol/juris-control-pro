/**
 * Banner que mostra o progresso do monitoramento DJEN Termos
 * quando está em execução. Usado na tela de Análise DJEN.
 */

import { useDjenTermos } from "@/hooks/useDjenTermos";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Newspaper, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function DjenExecutionBanner() {
  const { progress, isRunning } = useDjenTermos();

  // Não mostrar se não está executando
  if (!isRunning && progress.status !== 'executando') {
    return null;
  }

  const percentage = progress.percentage || 0;
  const termoAtual = progress.termoAtual || 'Processando...';
  const diaAtual = progress.diaAtualYmd;
  const tempoDecorrido = progress.tempoDecorrido || 0;

  return (
    <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Newspaper className="h-5 w-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Monitoramento DJEN em execução</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30 gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {percentage}%
              </Badge>
            </div>
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {tempoDecorrido > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(tempoDecorrido)}
                </span>
              )}
              <Link to="/configuracoes">
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  Ver detalhes
                </Button>
              </Link>
            </div>
          </div>
          
          <Progress value={percentage} className="h-2" />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[60%]">
              {diaAtual && (
                <span className="mr-2">
                  📅 Dia {progress.diaAtualIndice}/{progress.totalDias}
                </span>
              )}
              <span className="text-foreground/70">{termoAtual}</span>
            </span>
            
            <div className="flex items-center gap-3 flex-shrink-0">
              {progress.novas > 0 && (
                <span className="text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {progress.novas} novas
                </span>
              )}
              {progress.duplicadas > 0 && (
                <span>↔ {progress.duplicadas} dup.</span>
              )}
              {progress.descartadas > 0 && (
                <span>✗ {progress.descartadas} desc.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
