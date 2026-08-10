/**
 * Classificação determinística (sem IA) das publicações do TST — as MESMAS regras
 * usadas pelo botão "Docs TST" da tela Análise DJEN.
 * Primeira regra que casa vence: TEMAS_IRR → CEJUSC → DISTRIBUICOES → PAUTA → INTIMACOES → PRAZOS.
 */
export type CategoriaDocTst =
  | "TEMAS_IRR"
  | "PAUTA"
  | "CEJUSC"
  | "DISTRIBUICOES"
  | "INTIMACOES"
  | "PRAZOS";

export const CATEGORIAS_DOC_TST: { key: CategoriaDocTst; label: string; arquivo: string }[] = [
  { key: "TEMAS_IRR", label: "Temas IRR", arquivo: "JURISCONTROL_TEMAS_IRR" },
  { key: "PAUTA", label: "Pauta de Julgamento", arquivo: "JURISCONTROL_PAUTA" },
  { key: "CEJUSC", label: "CEJUSC", arquivo: "JURISCONTROL_CEJUSC" },
  { key: "DISTRIBUICOES", label: "Lista de Distribuição", arquivo: "JURISCONTROL_DISTRIBUICOES" },
  { key: "INTIMACOES", label: "Intimações", arquivo: "JURISCONTROL_INTIMACOES" },
  { key: "PRAZOS", label: "Prazos Gerais", arquivo: "JURISCONTROL_PRAZOS" },
];

export function stripHtmlTst(html?: string | null): string {
  if (!html) return "";
  const txt = String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const el = typeof document !== "undefined" ? document.createElement("textarea") : null;
  if (el) {
    el.innerHTML = txt;
    return el.value.replace(/[ \t]+/g, " ");
  }
  return txt.replace(/[ \t]+/g, " ");
}

export type PublicacaoParaClassificar = {
  conteudo?: string | null;
  tipo_comunicacao?: string | null;
  orgao?: string | null;
};

export function classificarPublicacaoTst(pub: PublicacaoParaClassificar): {
  categoria: CategoriaDocTst;
  tema_irr?: string;
} {
  const texto = stripHtmlTst(pub.conteudo);
  const lower = texto.toLowerCase();
  const tipoCom = (pub.tipo_comunicacao || "").toLowerCase();
  const orgaoTxt = String(pub.orgao || "");

  const textoSemAcento = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const dispMarkerRe =
    /\b(isto\s+posto|acordam\s+os\s+ministros|pelo\s+exposto|pelas\s+razoes\s+expostas|diante\s+do\s+exposto|posto\s+isso|por\s+tais\s+fundamentos|ante\s+o\s+exposto|ex\s+positis|nego\s+seguimento|nego\s+provimento|denego\s+seguimento|dou\s+provimento)\b/gi;
  let dispositivo = textoSemAcento;
  const allMarkers = [...textoSemAcento.matchAll(dispMarkerRe)];
  if (allMarkers.length > 0) {
    const last = allMarkers[allMarkers.length - 1];
    dispositivo = textoSemAcento.slice(last.index ?? 0);
  }
  const sobrestaRe = /\b(sobrestam(?:ento|entos)?|sobrestar|sobrestad[oa]s?|sobresta)\b/i;
  const suspensaoProcRe =
    /\bsuspens(?:ao|o|a)\s+(?:d[oa]s?\s+)?(?:feito|processo|autos|recurso|tramita[cç][aã]o|presente\s+feito)\b/i;
  const suspendoProcRe =
    /\bsuspend[oae][mr]?\s+(?:o\s+|a\s+)?(?:feito|processo|recurso|tramita[cç][aã]o|presente\s+feito|presente\s+processo)\b/i;
  if (sobrestaRe.test(dispositivo) || suspensaoProcRe.test(dispositivo) || suspendoProcRe.test(dispositivo)) {
    const mTema = dispositivo.match(/\btema\s+(?:vinculante\s+)?(?:n[º°o]?\s*)?(\d{1,4})\b/i);
    const temVinculante = /\btema\s+vinculante\b/i.test(dispositivo);
    const temIncJulg = /IncJulgRREmbRep/i.test(
      allMarkers.length > 0 ? texto.slice(allMarkers[allMarkers.length - 1].index ?? 0) : texto
    );
    if (mTema || temVinculante || temIncJulg) {
      const temaLabel = mTema ? `Tema ${mTema[1]}` : temVinculante ? "Tema vinculante" : "IncJulgRREmbRep";
      return { categoria: "TEMAS_IRR", tema_irr: temaLabel };
    }
  }

  const temCejusc = /\bCEJUSC\b/i.test(orgaoTxt) || /\bCEJUSC\b/i.test(texto);
  if (temCejusc && /plataforma\s+zoom/i.test(texto)) return { categoria: "CEJUSC" };

  if (tipoCom.includes("lista de distribui")) return { categoria: "DISTRIBUICOES" };

  const ehCejusc = /\bcejusc\b/i.test(texto);
  const ehAcordao =
    /\bACORDAM\b/i.test(textoSemAcento) ||
    /A\s*C\s*O\s*R\s*D\s*A\s*O/i.test(textoSemAcento) ||
    /\bEMENTA\b/i.test(textoSemAcento) ||
    /\bV\s*O\s*T\s*O\b/i.test(textoSemAcento);
  if (!ehCejusc && !ehAcordao && lower.includes("pauta de julgamento")) return { categoria: "PAUTA" };

  if (tipoCom.includes("intima")) return { categoria: "INTIMACOES" };

  return { categoria: "PRAZOS" };
}

/** Detecta a categoria de um documento manual pelo nome do arquivo / título interno. */
export function detectarCategoriaDoc(nomeArquivo: string, texto: string): CategoriaDocTst | null {
  const alvo = `${nomeArquivo} ${texto.slice(0, 400)}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/temas?[_\s-]*irr|tema\s+irr/.test(alvo)) return "TEMAS_IRR";
  if (/cejusc/.test(alvo)) return "CEJUSC";
  if (/distribui/.test(alvo)) return "DISTRIBUICOES";
  if (/pauta/.test(alvo)) return "PAUTA";
  if (/intima/.test(alvo)) return "INTIMACOES";
  if (/prazo/.test(alvo)) return "PRAZOS";
  return null;
}

/** Extrai números de processo (somente dígitos, 20 posições) de um texto livre. */
export function extrairProcessosDoTexto(texto: string): string[] {
  const set = new Set<string>();
  const mascarados = texto.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [];
  mascarados.forEach((m) => set.add(m.replace(/\D/g, "")));
  const crus = texto.match(/(?<!\d)\d{20}(?!\d)/g) || [];
  crus.forEach((m) => set.add(m));
  return [...set];
}

export function mascararCnj(digitos: string): string {
  const d = String(digitos || "").replace(/\D/g, "");
  if (d.length !== 20) return digitos || "";
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}