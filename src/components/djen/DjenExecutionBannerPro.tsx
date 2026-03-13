/**
 * Banner de progresso do DJEN Termos Pro na tela Análise DJEN.
 * Usa o estado reativo do singleton Pro Engine via useDjenTermosPro.
 * 
 * Inclui detecção de execução travada (stale) para mobile/tablet onde
 * o browser pode suspender a aba em background.
 * Também valida contra o backend ao montar/retornar do background.
 */

import { useEffect, useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Clock, CheckCircle2 } from "lucide-react";
import { useDjenTermosPro } from "@/hooks/useDjenTermosPro";
import { getDjenTermosProLastUpdatedAt } from "@/hooks/useDjenTermosProEngine";
import { fetchDjenBackendResumeSnapshot } from "@/hooks/djen/djenBackendResume";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Tempo máximo sem atualização antes de considerar a execução travada (ms) */
const STALE_THRESHOLD_MS = 45_000; // 45 segundos (antes era 2 min — muito lento para mobile)
const STALE_CHECK_INTERVAL_MS = 5_000; // Verificar a cada 5s (antes era 15s)

export function DjenExecutionBannerPro() {
  const { progress, isRunning } = useDjenTermosPro();
  const [isStale, setIsStale] = useState(false);
  const [backendDismissed, setBackendDismissed] = useState(false);

  // Verificar periodicamente se a execução está travada (mobile/tablet background)
  const checkStale = useCallback(() => {
    if (!isRunning && progress.status !== 'executando') {
      setIsStale(false);
      return;
    }
    const lastUpdate = getDjenTermosProLastUpdatedAt();
    if (lastUpdate > 0 && Date.now() - lastUpdate > STALE_THRESHOLD_MS) {
      setIsStale(true);
    } else {
      setIsStale(false);
    }
  }, [isRunning, progress.status]);

  useEffect(() => {
    if (!isRunning && progress.status !== 'executando') {
      setIsStale(false);
      return;
    }

    checkStale();
    const interval = setInterval(checkStale, STALE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isRunning, progress.status, progress.percentage, checkStale]);

  // Ao montar ou retornar do background, validar contra o backend
  // Se o backend diz que a execução terminou mas o singleton ainda mostra "executando",
  // esconder o banner para não confundir o usuário.
  useEffect(() => {
    if (!isRunning && progress.status !== 'executando') {
      setBackendDismissed(false);
      return;
    }

    let cancelled = false;

    const validateBackend = async () => {
      try {
        const snap = await fetchDjenBackendResumeSnapshot();
        // Se não há snapshot no backend, ou status é terminal, a execução já terminou
        if (!cancelled && (!snap || snap.status === 'concluido' || snap.status === 'cancelado' || snap.status === 'erro')) {
          const lastUpdate = getDjenTermosProLastUpdatedAt();
          // Só dismiss se o estado local está parado há mais de 10s
          if (lastUpdate > 0 && Date.now() - lastUpdate > 10_000) {
            setBackendDismissed(true);
          }
        }
      } catch {
        // Se não conseguiu verificar, não faz nada
      }
    };

    validateBackend();

    // Também revalidar quando o usuário retorna à aba (visibilitychange)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkStale();
        validateBackend();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isRunning, progress.status, checkStale]);

  // Esconder se não está executando, se está travado (stale), ou se backend confirmou fim
  if (isStale || backendDismissed) return null;
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
