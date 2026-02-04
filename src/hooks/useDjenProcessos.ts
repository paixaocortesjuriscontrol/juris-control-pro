/**
 * Hook React para conectar ao DJEN Processos Singleton Engine
 * 
 * Wrapper fino que provê reatividade ao componente React
 */

import { useState, useEffect, useCallback } from "react";
import {
  subscribeDjenProcessos,
  getDjenProcessosProgress,
  isDjenProcessosRunning,
  executarDjenProcessos,
  cancelarDjenProcessos,
  limparEstadoDjenProcessos,
  forceKillDjenProcessos,
  getCheckpointProcessos,
  DjenProcessosProgress,
} from "./useDjenProcessosEngine";

export interface UseDjenProcessosReturn {
  progress: DjenProcessosProgress;
  isRunning: boolean;
  hasCheckpoint: boolean;
  executar: (dataInicio?: string, dataFim?: string, retomar?: boolean) => void;
  cancelar: () => void;
  limpar: () => void;
  forceKill: () => Promise<void>;
}

export function useDjenProcessos(): UseDjenProcessosReturn {
  const [progress, setProgress] = useState<DjenProcessosProgress>(getDjenProcessosProgress);
  const [isRunning, setIsRunning] = useState(isDjenProcessosRunning);

  useEffect(() => {
    // Inscrever para receber atualizações de progresso
    const unsubscribe = subscribeDjenProcessos((p) => {
      setProgress(p);
      setIsRunning(isDjenProcessosRunning());
    });

    return unsubscribe;
  }, []);

  const executar = useCallback((dataInicio?: string, dataFim?: string, retomar = false) => {
    executarDjenProcessos(dataInicio, dataFim, retomar);
  }, []);

  const cancelar = useCallback(() => {
    cancelarDjenProcessos();
  }, []);

  const limpar = useCallback(() => {
    limparEstadoDjenProcessos();
  }, []);

  const forceKill = useCallback(async () => {
    await forceKillDjenProcessos();
  }, []);

  const hasCheckpoint = !!getCheckpointProcessos();

  return {
    progress,
    isRunning,
    hasCheckpoint,
    executar,
    cancelar,
    limpar,
    forceKill,
  };
}
