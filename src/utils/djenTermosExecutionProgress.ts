export type DjenTermosExecutionProgress = {
  current: number;
  total: number;
  /** 0..100; null quando não há total */
  percentage: number | null;
};

const toNumber = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Progresso do DJEN Termos é contabilizado por termos (não por registros_processados).
 * Então a fonte correta é `detalhes.progress.{current,total,percentage}`.
 */
export function getDjenTermosExecutionProgress(exec: {
  detalhes?: any | null;
}): DjenTermosExecutionProgress {
  const p = exec?.detalhes?.progress as
    | { current?: unknown; total?: unknown; percentage?: unknown }
    | undefined;

  const total = Math.max(0, toNumber(p?.total) ?? 0);
  const currentRaw = Math.max(0, toNumber(p?.current) ?? 0);
  const current = total > 0 ? Math.min(currentRaw, total) : currentRaw;

  const percentageDirect = toNumber(p?.percentage);
  const percentage =
    total > 0
      ? Math.min(100, Math.max(0, Math.round((current / total) * 100)))
      : percentageDirect !== null
        ? Math.min(100, Math.max(0, Math.round(percentageDirect)))
        : null;

  return { current, total, percentage };
}
