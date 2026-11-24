/** Rascunho local de formulários (só no navegador). Expira em 7 dias. */
export const RASCUNHO_VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

export interface Rascunho<T> { salvoEm: number; valores: T }

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const store = (): Store | null => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; } };

export function lerRascunho<T>(chave: string, agora = Date.now(), s: Store | null = store()): Rascunho<T> | null {
  if (!s) return null;
  try {
    const raw = s.getItem(chave);
    if (!raw) return null;
    const r = JSON.parse(raw) as Rascunho<T>;
    if (!r?.salvoEm || agora - r.salvoEm > RASCUNHO_VALIDADE_MS) { s.removeItem(chave); return null; }
    return r;
  } catch { return null; }
}

export function gravarRascunho<T>(chave: string, valores: T, agora = Date.now(), s: Store | null = store()) {
  try { s?.setItem(chave, JSON.stringify({ salvoEm: agora, valores })); } catch { /* cheio ou bloqueado */ }
}

export function apagarRascunho(chave: string, s: Store | null = store()) {
  try { s?.removeItem(chave); } catch { /* ignore */ }
}
