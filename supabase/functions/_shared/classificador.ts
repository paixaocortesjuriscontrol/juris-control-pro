/**
 * Classificador determinístico de movimentações processuais.
 * Usa códigos CNJ (TPU) e regex na descrição para identificar:
 * - Decisões recorríveis (acórdãos, sentenças de mérito)
 * - Recursos interpostos
 * - Certidões de trânsito em julgado
 *
 * As listas de códigos são provisórias e devem ser refinadas com dados reais da TPU.
 */

export type MovimentoBruto = {
  codigo?: string | null;
  descricao: string;
  data: string;
};

export type ClassificacaoMovimento = {
  eh_decisao_recorrivel: boolean;
  eh_recurso_interposto: boolean;
  eh_certidao_transito: boolean;
};

// ============================================================
// CÓDIGOS CNJ (TPU) — agrupar por semântica para facilitar manutenção
// ============================================================

/** Julgamento de mérito, acórdão, sentença */
export const CODIGOS_DECISAO_RECORRIVEL = [
  "219", // Julgamento com resolução de mérito
  "220", // Julgamento sem resolução de mérito (extintivo)
  "221", // Julgamento
  "385", // Acórdão
  "386", // Decisão monocrática
  "471", // Sentença ou acórdão (publicação)
  "472", // Sentença
];

/** Interposição de recurso */
export const CODIGOS_RECURSO_INTERPOSTO = [
  "118", // Petição de recurso
  "119", // Interposição de recurso
  "120", // Recurso protocolado
];

/** Certidão de trânsito em julgado — código específico */
export const CODIGO_CERTIDAO_TRANSITO = "848";

// ============================================================
// REGEX — descrições normalizadas (minúsculo, sem acento)
// ============================================================

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove diacríticos
}

const REGEX_DECISAO_RECORRIVEL = new RegExp(
  [
    "acordao",
    "julgado procedente",
    "julgado improcedente",
    "sentenca publicada",
    "decisao monocratica",
    "negado provimento",
    "dado provimento",
    "negar provimento",
    "dar provimento",
    "desprovimento",
    "improvimento",
  ]
    .join("|"),
  "i"
);

const REGEX_RECURSO_INTERPOSTO = new RegExp(
  [
    "recurso de revista",
    "recurso ordinario",
    "agravo de instrumento",
    "embargos de declaracao",
    "recurso extraordinario",
    "interposicao de recurso",
    "peticao de recurso",
    "recurso protocolado",
    "agravo de peticao",
    "agravo interno",
    "recurso adesivo",
  ]
    .join("|"),
  "i"
);

const REGEX_CERTIDAO_TRANSITO = new RegExp(
  [
    "certidao de transito em julgado",
    "transitado em julgado",
    "certifico o transito",
    "certidao de transito",
    "transito em julgado certificado",
  ]
    .join("|"),
  "i"
);

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

export function classificarMovimento(mov: MovimentoBruto): ClassificacaoMovimento {
  const codigo = (mov.codigo || "").trim();
  const descNorm = normalizar(mov.descricao);

  const codigoSet = new Set(CODIGOS_DECISAO_RECORRIVEL);
  const recursoSet = new Set(CODIGOS_RECURSO_INTERPOSTO);

  const eh_decisao_recorrivel =
    codigoSet.has(codigo) || REGEX_DECISAO_RECORRIVEL.test(descNorm);

  const eh_recurso_interposto =
    recursoSet.has(codigo) || REGEX_RECURSO_INTERPOSTO.test(descNorm);

  const eh_certidao_transito =
    (codigo === CODIGO_CERTIDAO_TRANSITO &&
      /transito em julgado/i.test(descNorm)) ||
    REGEX_CERTIDAO_TRANSITO.test(descNorm);

  return {
    eh_decisao_recorrivel,
    eh_recurso_interposto,
    eh_certidao_transito,
  };
}
