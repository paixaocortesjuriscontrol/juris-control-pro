// =============================================================
// Catálogo de Diários de Justiça Estaduais
// Cada tribunal expõe um builder de URL para PDF do caderno na data.
// =============================================================

export type CadernoEstadual = {
  id: string;
  nome: string;
};

export type TribunalEstadualConfig = {
  sigla: string;
  nome: string;
  cadernos: CadernoEstadual[];
  /** Constrói a URL pública do PDF do caderno para a data dada (YYYY-MM-DD). */
  buildUrl: (dataISO: string, caderno: string) => string;
  /** Headers extras (ex.: Referer) que ajudam a passar por anti-bot básico. */
  headers?: Record<string, string>;
};

function formatBR(dataISO: string): string {
  // YYYY-MM-DD -> DD/MM/YYYY
  const [y, m, d] = dataISO.split("-");
  return `${d}/${m}/${y}`;
}

export const TRIBUNAIS_ESTADUAIS: Record<string, TribunalEstadualConfig> = {
  TJMG: {
    sigla: "TJMG",
    nome: "TJMG - Minas Gerais",
    cadernos: [
      { id: "judicial-1", nome: "Judicial - 1ª Instância" },
      { id: "judicial-2", nome: "Judicial - 2ª Instância" },
      { id: "administrativo", nome: "Administrativo" },
    ],
    // Servlet público do DJ-MG. Aceita data em DD/MM/YYYY.
    // Caderno mapeado para o parâmetro do servlet (1 = Judicial 1ª, 2 = Judicial 2ª, 3 = Administrativo).
    buildUrl: (dataISO, caderno) => {
      const map: Record<string, string> = {
        "judicial-1": "1",
        "judicial-2": "2",
        "administrativo": "3",
      };
      const cad = map[caderno] ?? "1";
      return `https://dje.tjmg.jus.br/cadernos/${formatBR(dataISO)}/caderno_${cad}.pdf`;
    },
    headers: {
      Referer: "https://dje.tjmg.jus.br/",
    },
  },
};

export const browserHeaders: Record<string, string> = {
  "Accept": "application/pdf,application/octet-stream,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export function listarTribunais() {
  return Object.values(TRIBUNAIS_ESTADUAIS).map((t) => ({
    sigla: t.sigla,
    nome: t.nome,
    cadernos: t.cadernos,
  }));
}