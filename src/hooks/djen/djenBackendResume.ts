import { supabase } from "@/integrations/supabase/client";

export type DjenBackendResumeSnapshot = {
  runKey: string;
  total: number;
  current: number;
  novas: number;
  duplicadas: number;
  descartadas: number;
  dataInicioYmd: string | null;
  dataFimYmd: string | null;
  termoAtual: string | null;
  status: string | null;
};

const toNumber = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Snapshot mínimo para retomar a execução DJEN mesmo quando o localStorage foi perdido.
 * Fonte: configuracoes_monitoramento.metadata.
 */
export async function fetchDjenBackendResumeSnapshot(): Promise<DjenBackendResumeSnapshot | null> {
  const { data, error } = await supabase
    .from("configuracoes_monitoramento")
    .select("metadata")
    .eq("tipo", "djen")
    .is("coordenacao_id", null)
    .maybeSingle();

  if (error) return null;

  const md = (data?.metadata as Record<string, any> | null) || {};

  const runKeyRaw =
    (typeof md.run_key === "string" ? md.run_key : null) ||
    (typeof md.data_override === "string" ? md.data_override : null) ||
    (typeof md.data_fim === "string" ? md.data_fim : null);

  if (!runKeyRaw) return null;

  const total = toNumber(md.total);
  const current = toNumber(md.current);

  if (total <= 0 || current <= 0) return null;

  return {
    runKey: runKeyRaw,
    total,
    current,
    novas: toNumber(md.novas),
    duplicadas: toNumber(md.duplicadas),
    descartadas: toNumber(md.descartadas),
    dataInicioYmd: typeof md.data_inicio === "string" ? md.data_inicio : null,
    dataFimYmd: typeof md.data_fim === "string" ? md.data_fim : null,
    termoAtual: typeof md.termoAtual === "string" ? md.termoAtual : null,
    status: typeof md.status === "string" ? md.status : null,
  };
}
