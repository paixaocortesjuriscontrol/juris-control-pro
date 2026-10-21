/** Estrutura GOL: a Coordenação GOL lê as publicações e distribui para os grupos. */
export const COORDENACAO_GOL_ID = "f5a0ac48-7461-49c1-9151-219e570831bd";

export type GrupoGolKey = "execucao" | "nne" | "csm" | "especiais";

export function podeDistribuirPublicacaoGol(isAdmin: boolean, coordenacaoId: string | null, origem: string): boolean {
  return (isAdmin || coordenacaoId === COORDENACAO_GOL_ID) && (origem === "termo" || origem === "processo");
}

export const GRUPOS_GOL: { key: GrupoGolKey; nome: string; coordenacaoId: string }[] = [
  { key: "execucao", nome: "Execução", coordenacaoId: "408d691a-dd97-4d18-b3c0-0ffd5c572c21" },
  { key: "nne", nome: "Conhecimento - Norte e Nordeste", coordenacaoId: "b7aba3d4-0f1e-4040-9f64-2c1f38e3d858" },
  { key: "csm", nome: "Conhecimento - Centro, Sul e Minas", coordenacaoId: "c5a10000-0000-4000-8000-000000000001" },
  { key: "especiais", nome: "Casos Especiais (Sindicatos e MPT)", coordenacaoId: "c5a10000-0000-4000-8000-000000000002" },
];

export const TRTS_NORTE_NORDESTE = [5, 6, 7, 8, 11, 13, 14, 16, 19, 20, 21, 22];

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

/** Região do TRT pelo número CNJ (J=5, TR nas posições 15-16). 0 = TST ou desconhecido. */
export function trtDoProcesso(numero?: string | null): number {
  const d = (numero || "").replace(/\D/g, "");
  if (d.length !== 20 || d[13] !== "5") return 0;
  return Number(d.slice(14, 16));
}

export function sugerirGrupoGol(pub: { processo_numero?: string | null; conteudo?: string | null }): GrupoGolKey {
  const txt = semAcento(pub.conteudo || "");
  if (/SINDICATO|MINISTERIO PUBLICO DO TRABALHO|\bMPT\b/.test(txt)) return "especiais";
  if (/EXECUCAO|PENHORA|CALCULOS|LIQUIDACAO|\bRPV\b/.test(txt)) return "execucao";
  return TRTS_NORTE_NORDESTE.includes(trtDoProcesso(pub.processo_numero)) ? "nne" : "csm";
}
