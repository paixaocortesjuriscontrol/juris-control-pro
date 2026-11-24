export interface VinculoProc { processo_id: string; usuario_id: string; coordenacao_id: string | null; papel: string | null }
export interface Membro { usuario_id: string; coordenacao_id: string; cargo: string | null }

export const ehResponsavel = (papel: string | null) =>
  (papel || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "responsavel";

/** Conta processos distintos por usuário (geral) e por usuário+coordenação. */
export function agregarVinculos(vinculos: VinculoProc[]) {
  const geral = new Map<string, { resp: Set<string>; env: Set<string> }>();
  const porCoord = new Map<string, { resp: Set<string>; env: Set<string> }>();
  const procCoord = new Map<string, Set<string>>();
  const get = (m: typeof geral, k: string) => {
    let v = m.get(k); if (!v) { v = { resp: new Set(), env: new Set() }; m.set(k, v); } return v;
  };
  for (const v of vinculos) {
    const r = ehResponsavel(v.papel);
    const g = get(geral, v.usuario_id);
    (r ? g.resp : g.env).add(v.processo_id);
    if (v.coordenacao_id) {
      const c = get(porCoord, `${v.usuario_id}|${v.coordenacao_id}`);
      (r ? c.resp : c.env).add(v.processo_id);
      let s = procCoord.get(v.coordenacao_id); if (!s) { s = new Set(); procCoord.set(v.coordenacao_id, s); } s.add(v.processo_id);
    }
  }
  const cnt = (x?: { resp: Set<string>; env: Set<string> }) => {
    if (!x) return { responsavel: 0, envolvido: 0, total: 0 };
    const tot = new Set([...x.resp, ...x.env]).size;
    return { responsavel: x.resp.size, envolvido: x.env.size, total: tot };
  };
  return {
    geral: (u: string) => cnt(geral.get(u)),
    coord: (u: string, c: string) => cnt(porCoord.get(`${u}|${c}`)),
    processosCoord: (c: string) => procCoord.get(c)?.size ?? 0,
  };
}

