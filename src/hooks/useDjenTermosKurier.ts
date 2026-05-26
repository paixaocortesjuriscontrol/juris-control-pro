import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cancelarDjenTermosKurier,
  executarDjenTermosKurier,
  forceKillDjenTermosKurier,
  getCheckpointKurier,
  getDjenTermosKurierProgress,
  hydrateDjenTermosKurierFromBackend,
  isDjenTermosKurierRunning,
  limparEstadoDjenTermosKurier,
  resetTotalDjenTermosKurier,
  subscribeDjenTermosKurier,
  type KurierProgress,
} from "./useDjenTermosKurierEngine";

export type { KurierProgress };

export function useDjenTermosKurier() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<KurierProgress>(getDjenTermosKurierProgress);
  const [isRunning, setIsRunning] = useState(isDjenTermosKurierRunning);
  const lastStatusRef = useRef<string>(getDjenTermosKurierProgress().status);

  useEffect(() => {
    const unsub = subscribeDjenTermosKurier(async (p) => {
      setProgress(p);
      setIsRunning(isDjenTermosKurierRunning());
      const prev = lastStatusRef.current;
      lastStatusRef.current = p.status;
      if (p.status === "concluido" && prev !== "concluido") {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["publicacoes-djen"] }),
          qc.invalidateQueries({ queryKey: ["publicacoes-unificadas"] }),
          qc.invalidateQueries({ queryKey: ["publicacoes-unificadas-stats"] }),
          qc.invalidateQueries({ queryKey: ["publicacoes-unificadas-stats-header"] }),
          qc.invalidateQueries({ queryKey: ["kurier-credenciais"] }),
        ]);
        if (p.novas > 0) toast.success(`Kurier: ${p.novas} novas publicações`);
      }
      if (p.status === "erro" && prev !== "erro") toast.error(p.mensagem || "Erro Kurier");
    });
    void hydrateDjenTermosKurierFromBackend();
    const clk = setInterval(() => {
      setProgress((cur) => {
        if (cur.status !== "executando") return cur;
        const startMs = cur.iniciadoEm ? new Date(cur.iniciadoEm).getTime() : 0;
        return { ...cur, tempoDecorrido: startMs > 0 ? Math.floor((Date.now() - startMs) / 1000) : cur.tempoDecorrido + 1 };
      });
    }, 1000);
    return () => { unsub(); clearInterval(clk); };
  }, [qc]);

  const checkpoint = getCheckpointKurier();
  const canResume = !!checkpoint && progress.status !== "executando";

  const executar = useCallback((dataInicioYmd?: string, dataFimYmd?: string) => {
    void executarDjenTermosKurier(false, undefined, undefined, dataInicioYmd, dataFimYmd);
    toast.info("Kurier iniciado");
  }, []);
  const retomar = useCallback((dataInicioYmd?: string, dataFimYmd?: string) => {
    if (!checkpoint) return;
    void executarDjenTermosKurier(true, undefined, undefined, dataInicioYmd, dataFimYmd);
    toast.info("Kurier retomando…");
  }, [checkpoint]);
  const cancelar = useCallback(async () => { await cancelarDjenTermosKurier(); toast.info("Kurier cancelado"); }, []);
  const limpar = useCallback(() => limparEstadoDjenTermosKurier(), []);
  const forceKill = useCallback(async (clear = false) => { await forceKillDjenTermosKurier(clear); toast.success("Kurier finalizado"); }, []);
  const resetTotal = useCallback(async () => { await resetTotalDjenTermosKurier(); toast.success("Kurier resetado"); }, []);

  return { progress, isRunning, canResume, checkpoint, executar, retomar, cancelar, limpar, forceKill, resetTotal };
}