/**
 * Banner de progresso do DJEN Termos Pro na tela Análise DJEN.
 * Usa o estado reativo do singleton Pro Engine via useDjenTermosPro.
 * 
 * Inclui detecção de execução travada (stale) para mobile/tablet onde
 * o browser pode suspender a aba em background.
 */

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Clock, CheckCircle2 } from "lucide-react";
import { useDjenTermosPro } from "@/hooks/useDjenTermosPro";
import { getDjenTermosProLastUpdatedAt } from "@/hooks/useDjenTermosProEngine";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Tempo máximo sem atualização antes de considerar a execução travada (ms) */
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutos

export function DjenExecutionBannerPro() {
  const { progress, isRunning } = useDjenTermosPro();
  const [isStale, setIsStale] = useState(false);

  // Verificar periodicamente se a execução está travada (mobile/tablet background)
  useEffect(() => {
    if (!isRunning && progress.status !== 'executando') {
      setIsStale(false);
      return;
    }

    const checkStale = () => {
      const lastUpdate = getDjenTermosProLastUpdatedAt();
      if (lastUpdate > 0 && Date.now() - lastUpdate > STALE_THRESHOLD_MS) {
        setIsStale(true);
      } else {
        setIsStale(false);
      }
    };

    checkStale();
    const interval = setInterval(checkStale, 15_000);
    return () => clearInterval(interval);
  }, [isRunning, progress.status, progress.percentage]);

  // Esconder se não está executando OU se está travado (stale)
  if (isStale) return null;
  if (!isRunning && progress.status !== 'executando') return null;

  const pct = Math.max(0, Math.min(99, Math.round(progress.percentage)));

  return (
    <div className="rounded-lg border bg-amber-500/5 border-amber-500/20 p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Zap className="h-5 w-5 text-amber-600" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Busca DJEN Pro em execução</span>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-500/30 gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {pct}%
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {progress.tempoDecorrido > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(progress.tempoDecorrido)}
                </span>
              )}
            </div>
          </div>

          <Progress value={pct} className="h-2" />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[60%]">
              {progress.diaAtualYmd && (
                <span className="mr-2">
                  📅 Dia {progress.diaAtualIndice}/{progress.totalDias}
                </span>
              )}
              <span className="text-foreground/70">
                {progress.termoAtual || progress.mensagem || 'Processando...'}
              </span>
            </span>

            <div className="flex items-center gap-3 flex-shrink-0">
              {progress.novas > 0 && (
                <span className="text-amber-600 flex items-center gap-1">
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