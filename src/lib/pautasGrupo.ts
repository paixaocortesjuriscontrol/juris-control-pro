/**
 * Grupo responsável por uma pauta (Coordenação Dra. Renata Oficial).
 * - Grupo Dra. Tatiana: Terceiros, Coligadas, Acordos e Sudeste (TRT 1, 2, 3, 15, 17).
 * - Grupo Dra. Renata: Corporativos, Complementação e Outros Estados.
 * Equipes genéricas (Execução, Ações Especiais, Redes, núcleos regionais) seguem o TRT.
 */
export type GrupoPauta = "tatiana" | "renata" | null;

const TRT_SUDESTE = new Set([1, 2, 3, 15, 17]);

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function porEquipe(txt: string): GrupoPauta {
  if (/terceir|coligad|acordo/.test(txt)) return "tatiana";
  if (/corporativ|complementa/.test(txt)) return "renata";
  return null;
}

export function trtDoProcesso(numero?: string | null): number | null {
  const d = String(numero || "").replace(/\D/g, "");
  if (d.length !== 20 || d[13] !== "5") return null;
  const n = Number(d.slice(14, 16));
  return n > 0 ? n : null;
}

export function grupoDaPauta(equipe?: string | null, processoNumero?: string | null): GrupoPauta {
  const e = norm(String(equipe || ""));
  if (e.includes("nao localizado")) return null;
  const parenteses = e.match(/\(([^)]*)\)/)?.[1];
  if (parenteses) {
    const g = porEquipe(parenteses);
    if (g) return g;
  }
  const g = porEquipe(e);
  if (g) return g;
  const trt = trtDoProcesso(processoNumero);
  if (trt == null) return null;
  return TRT_SUDESTE.has(trt) ? "tatiana" : "renata";
}

export const ROTULO_GRUPO: Record<"tatiana" | "renata", string> = {
  tatiana: "Grupo Dra. Tatiana",
  renata: "Grupo Dra. Renata",
};
