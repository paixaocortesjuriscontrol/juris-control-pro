export type ExecutionProgress = {
  current: number;
  total: number;
  /** null quando não há total para calcular */
  percentage: number | null;
};

/**
 * Normaliza progresso de execuções (fonte única) e evita oscilação.
 *
 * Regra: usamos o maior valor disponível entre `detalhes.progress.current` e
 * `registros_processados` (cumulativo do orquestrador). Isso impede o
 * percentual de “voltar” quando `detalhes.progress` é sobrescrito com valores
 * parciais por lote.
 */
export function getExecutionProgress(exec: {
  detalhes?: any | null;
  registros_processados?: number | null;
  total_lotes?: number | null;
  lotes_processados?: number | null;
}): ExecutionProgress {
  const p = exec?.detalhes?.progress as
    | { current?: unknown; total?: unknown; percentage?: unknown }
    | undefined;

  const total =
    (typeof p?.total === 'number' && p.total > 0 ? p.total : 0) ||
    (typeof exec.total_lotes === 'number' && exec.total_lotes > 0 ? exec.total_lotes : 0) ||
    0;

  const candidates: number[] = [];
  if (typeof p?.current === 'number' && p.current > 0) candidates.push(p.current);
  if (typeof exec.registros_processados === 'number' && exec.registros_processados > 0) {
    candidates.push(exec.registros_processados);
  }
  if (typeof exec.lotes_processados === 'number' && exec.lotes_processados > 0) {
    candidates.push(exec.lotes_processados);
  }

  const currentRaw = candidates.length ? Math.max(...candidates) : 0;
  const current = total > 0 ? Math.min(currentRaw, total) : currentRaw;

  const percentage = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : null;

  return { current, total, percentage };
}
