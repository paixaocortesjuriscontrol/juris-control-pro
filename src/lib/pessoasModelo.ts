/** Soma os responsáveis/envolvidos fixos do modelo aos já escolhidos, sem tirar ninguém. */
export function aplicarPessoasModelo(
  m: { padroes?: unknown },
  setResp: (fn: (prev: string[]) => string[]) => void,
  setEnv: (fn: (prev: string[]) => string[]) => void,
) {
  const pd = ((m as any)?.padroes ?? {}) as Record<string, any>;
  const resp: string[] = Array.isArray(pd.responsaveis_ids) ? pd.responsaveis_ids : [];
  const env: string[] = Array.isArray(pd.envolvidos_ids) ? pd.envolvidos_ids : [];
  if (resp.length) setResp((prev) => Array.from(new Set([...prev, ...resp])));
  if (env.length) setEnv((prev) => Array.from(new Set([...prev, ...env])));
}
