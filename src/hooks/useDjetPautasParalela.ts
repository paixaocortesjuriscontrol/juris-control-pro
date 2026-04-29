/**
 * Hook React para o DJET Pautas Paralela Engine.
 * Wrapper reativo do singleton (cópia simétrica de useDjenTermosParalela).
 */

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type DjetPautasParalelaProgress,
  executarDjetPautasParalela,
  cancelarDjetPautasParalela,
  limparEstadoDjetPautasParalela,
  forceKillDjetPautasParalela,
  resetTotalDjetPautasParalela,
  getDjetPautasParalelaProgress,
  isDjetPautasParalelaRunning,
  getCheckpointDjetPautas,
  subscribeDjetPautasParalela,
} from "./useDjetPautasParalelaEngine";

export type { DjetPautasParalelaProgress };

export function useDjetPautasParalela() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<DjetPautasParalelaProgress>(getDjetPautasParalelaProgress);
  const [isRunning, setIsRunning] = useState(isDjetPautasParalelaRunning);

  useEffect(() => {
    const unsub = subscribeDjetPautasParalela((p) => {
      setProgress(p);
      setIsRunning(isDjetPautasParalelaRunning());
      if (p.status === "concluido") {
        queryClient.invalidateQueries({ queryKey: ["publicacoes-djen"] });
        queryClient.invalidateQueries({ queryKey: ["analise-djen"] });
        queryClient.invalidateQueries({ queryKey: ["publicacoes-unificadas"] });
        queryClient.invalidateQueries({ queryKey: ["notificacoes-counts"] });
        if (p.novas > 0) toast.success(`DJET Pautas: ${p.novas} novas pautas encontradas!`);
      }
      if (p.status === "erro") toast.error(p.mensagem || "Erro DJET Pautas");
    });

    const clockIntv = setInterval(() => {
      setProgress((current) => {
        if (current.status !== "executando") return current;
        const startedAt = current.iniciadoEm ? new Date(current.iniciadoEm).getTime() : 0;
        return {
          ...current,
          tempoDecorrido: startedAt > 0
            ? Math.floor(Math.max(0, Date.now() - startedAt) / 1000)
            : current.tempoDecorrido + 1,
        };
      });
      setIsRunning(isDjetPautasParalelaRunning());
    }, 1_000);

    return () => {
      unsub();
      clearInterval(clockIntv);
    };
  }, [queryClient]);

  const checkpoint = getCheckpointDjetPautas();
  const canResume = !!checkpoint && progress.status !== "executando";

  const executar = useCallback((dataInicioYmd?: string, dataFimYmd?: string, coordenacaoId?: string, monitoramentoIds?: string[]) => {
    executarDjetPautasParalela(dataInicioYmd, dataFimYmd, false, coordenacaoId, monitoramentoIds);
    toast.info("DJET Pautas Paralela iniciado");
  }, []);

  const retomar = useCallback((coordenacaoId?: string, monitoramentoIds?: string[]) => {
    if (!checkpoint) return;
    executarDjetPautasParalela(checkpoint.dataInicioYmd, checkpoint.dataFimYmd, true, coordenacaoId, monitoramentoIds);
    toast.info("DJET Pautas retomando...");
  }, [checkpoint]);

  const cancelar = useCallback(async () => {
    await cancelarDjetPautasParalela();
    toast.info("DJET Pautas cancelada.");
  }, []);
  const limpar = useCallback(() => limparEstadoDjetPautasParalela(), []);
  const forceKill = useCallback(async (clearCheckpoint = false) => {
    await forceKillDjetPautasParalela(clearCheckpoint);
    toast.success(clearCheckpoint ? "DJET Pautas finalizada e checkpoint limpo" : "DJET Pautas parada.");
  }, []);

  const resetTotal = useCallback(async () => {
    await resetTotalDjetPautasParalela();
    toast.success("Reset Total: estado e checkpoint limpos.");
  }, []);

  return {
    progress,
    isRunning,
    canResume,
    checkpoint,
    executar,
    retomar,
    cancelar,
    limpar,
    forceKill,
    resetTotal,
  };
}