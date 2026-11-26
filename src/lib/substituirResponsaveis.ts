/** Pessoas novas no item (como responsável ou envolvida) e responsáveis anteriores que continuam marcados. */
export function analisarRepasse(params: {
  originalResp: string[];
  originalEnv: string[];
  resp: string[];
  env: string[];
  fixos?: string[];
}) {
  const fixos = new Set(params.fixos ?? []);
  const antes = new Set([...params.originalResp, ...params.originalEnv]);
  const novasPessoas = Array.from(new Set([...params.resp, ...params.env])).filter(
    (id) => !antes.has(id) && !fixos.has(id),
  );
  const anteriores = params.originalResp.filter((id) => params.resp.includes(id) && !fixos.has(id));
  return { novasPessoas, anteriores, perguntar: novasPessoas.length > 0 && anteriores.length > 0 };
}

/** Substitui: as pessoas novas viram responsáveis e os responsáveis anteriores saem. */
export function aplicarSubstituicao(resp: string[], env: string[], novasPessoas: string[], anteriores: string[]) {
  const novoResp = Array.from(new Set([...novasPessoas, ...resp.filter((id) => !anteriores.includes(id))]));
  const novoEnv = env.filter((id) => !novasPessoas.includes(id));
  return { resp: novoResp, env: novoEnv };
}
