/**
 * Kurier Scheduler — versão simplificada por intervalo (não por horário fixo).
 * Lê configuracoes_monitoramento (tipo='kurier'): se ativo=true, dispara o
 * engine a cada `frequencia` (minutos). Persiste ultima_execucao.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { executarDjenTermosKurier, isDjenTermosKurierRunning } from "./useDjenTermosKurierEngine";

export interface KurierSchedulerConfig {
  id: string | null;
  ativo: boolean;
  frequenciaMin: number;
  ultimaExecucao: string | null;
  baseUrl: string;
}

const DEFAULT_BASE_URL = "https://www.kurierservicos.com.br/wsservicos";

function parseFrequencia(f: string | null): number {
  if (!f) return 30;
  const m = /^(\d+)\s*(min|h|d)?$/i.exec(f.trim());
  if (!m) return Number(f) || 30;
  const n = Number(m[1]);
  const unit = (m[2] ?? "min").toLowerCase();
  if (unit === "h") return n * 60;
  if (unit === "d") return n * 60 * 24;
  return n;
}

let lastTriggerAt = 0;

export function useDjenTermosKurierScheduler() {
  const [config, setConfig] = useState<KurierSchedulerConfig>({
    id: null, ativo: false, frequenciaMin: 30, ultimaExecucao: null, baseUrl: DEFAULT_BASE_URL,
  });

  async function reload() {
    const { data } = await (supabase as any)
      .from("configuracoes_monitoramento")
      .select("id, ativo, frequencia, ultima_execucao, metadata")
      .eq("tipo", "kurier")
      .maybeSingle();
    if (data) {
      setConfig({
        id: data.id,
        ativo: !!data.ativo,
        frequenciaMin: parseFrequencia(data.frequencia),
        ultimaExecucao: data.ultima_execucao,
        baseUrl: (data.metadata?.base_url as string) || DEFAULT_BASE_URL,
      });
    }
  }

  async function saveConfig(patch: Partial<{ ativo: boolean; frequenciaMin: number; baseUrl: string }>) {
    const next: any = {};
    if (patch.ativo !== undefined) next.ativo = patch.ativo;
    if (patch.frequenciaMin !== undefined) next.frequencia = `${patch.frequenciaMin}min`;
    if (patch.baseUrl !== undefined) {
      const { data: cur } = await (supabase as any)
        .from("configuracoes_monitoramento")
        .select("metadata")
        .eq("tipo", "kurier")
        .maybeSingle();
      next.metadata = { ...(cur?.metadata ?? {}), base_url: patch.baseUrl };
    }
    await (supabase as any)
      .from("configuracoes_monitoramento")
      .update(next)
      .eq("tipo", "kurier");
    await reload();
  }

  useEffect(() => {
    void reload();
    const intv = setInterval(async () => {
      if (!config.ativo || isDjenTermosKurierRunning()) return;
      const intervalMs = Math.max(60_000, config.frequenciaMin * 60_000);
      const lastMs = config.ultimaExecucao ? new Date(config.ultimaExecucao).getTime() : 0;
      const now = Date.now();
      if (now - Math.max(lastMs, lastTriggerAt) < intervalMs) return;
      lastTriggerAt = now;
      await (supabase as any)
        .from("configuracoes_monitoramento")
        .update({ ultima_execucao: new Date().toISOString() })
        .eq("tipo", "kurier");
      await reload();
      // Sempre dispara para HOJE em MODO FILA (ConsultarPublicacoes). O modo
      // personalizado filtra pela DATA DE PUBLICAÇÃO do jornal e perde itens
      // disponibilizados hoje; a fila devolve a sequência ordenada com
      // data_disponibilizacao correta e permite drenar lotes de 50 até alcançar
      // o dia atual.
      const d = new Date();
      const hojeYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      void executarDjenTermosKurier(false, undefined, undefined, hojeYmd, hojeYmd, false, false);
    }, 30_000);
    return () => clearInterval(intv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.ativo, config.frequenciaMin, config.ultimaExecucao]);

  return { config, reload, saveConfig };
}