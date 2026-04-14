/**
 * Extrai turma e relator a partir das descrições dos movimentos processuais.
 *
 * Quando a API da Judit não traz esses campos na raiz do objeto,
 * a informação costuma aparecer nos movimentos de distribuição ou
 * redistribuição ao relator.
 */

export interface MovimentoBruto {
  step_date?: string;
  date?: string;
  movement_date?: string;
  content?: string;
  title?: string;
  description?: string;
  code?: string | number;
  movement_code?: string | number;
  [key: string]: unknown;
}

export type FonteOrgao =
  | "movimento_distribuicao"
  | "movimento_redistribuicao"
  | "nao_encontrado";

export interface OrgaoJulgadorResult {
  turma: string | null;
  relator: string | null;
  data_distribuicao: string | null;
  fonte: FonteOrgao;
}

// Códigos CNJ de distribuição / redistribuição (podem precisar refinamento com dados reais)
const CODIGOS_DISTRIBUICAO = ["51", "36", "26", "36"];

// Regex para detectar movimentos de distribuição/redistribuição
const DISTRIBUICAO_REGEX = /distribu[ií]/i;
const REDISTRIBUICAO_REGEX = /redistribu/i;

// Regex para extrair relator (precisam ser refinados com dados reais)
const RELATOR_REGEX =
  /(?:ministr[ao]|des(?:embargador)?\.?\s*(?:federal)?|min\.?)\s+(.+?)(?:\s*[-–,.]|\s*$)/i;

// "Relator" seguido de nome (ex: "Relator Mauricio...")
const RELATOR_TITULO_REGEX =
  /(?:relator[a]?)\s+(.+?)(?:\s*[-–,.]|\s*$)/i;

// Regex alternativa: "ao Ministro NOME - TURMA" ou "para o Ministro NOME"
const RELATOR_ALT_REGEX =
  /(?:ao|para\s+o|para\s+a)\s+(?:ministr[ao]|relator[a]?|des(?:embargador)?\.?\s*(?:federal)?|min\.?)\s+(.+?)(?:\s*[-–]|\s*$)/i;

// Regex para extrair turma (precisam ser refinados com dados reais)
const TURMA_REGEX =
  /(\d+[ªºa]?\s*turma|sbdi[-\s]?[ivx\d]+|sdi[-\s]?[ivx\d]+|orgao\s+especial|[oó]rg[aã]o\s+especial|tribunal\s+pleno|se[çc][aã]o\s+especializada)/i;

function getStepDate(step: MovimentoBruto): string | null {
  return step.step_date || step.date || step.movement_date || null;
}

function getStepContent(step: MovimentoBruto): string {
  const raw = step.content || step.title || step.description || "";
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

function getStepCode(step: MovimentoBruto): string | null {
  const code = step.code || step.movement_code;
  return code != null ? String(code) : null;
}

function isDistribuicao(content: string, code: string | null): boolean {
  if (code && CODIGOS_DISTRIBUICAO.includes(code)) return true;
  return DISTRIBUICAO_REGEX.test(content);
}

function isRedistribuicao(content: string): boolean {
  return REDISTRIBUICAO_REGEX.test(content);
}

function extrairRelatorDoTexto(texto: string): string | null {
  // Tenta a regex alternativa primeiro (mais específica: "ao Ministro X")
  let match = RELATOR_ALT_REGEX.exec(texto);
  if (match?.[1]) {
    return limparNome(match[1]);
  }
  // Tenta regex padrão (Ministro, Desembargador, Min.)
  match = RELATOR_REGEX.exec(texto);
  if (match?.[1]) {
    return limparNome(match[1]);
  }
  // Tenta "Relator NOME" (pode capturar "Relator" como título)
  match = RELATOR_TITULO_REGEX.exec(texto);
  if (match?.[1]) {
    return limparNome(match[1]);
  }
  return null;
}

function limparNome(nome: string): string {
  // Remove turma que pode ter sido capturada junto (ex: "Fulano - 6ª Turma")
  let limpo = nome.replace(/\s*[-–]\s*\d+[ªºa]?\s*turma.*/i, "").trim();
  // Remove pontuação final
  limpo = limpo.replace(/[.,;:]+$/, "").trim();
  // Remove "Dr." / "Dra." prefixo redundante
  limpo = limpo.replace(/^(?:dr[a]?\.?\s*)/i, "").trim();
  return limpo || nome.trim();
}

function extrairTurmaDoTexto(texto: string): string | null {
  const match = TURMA_REGEX.exec(texto);
  if (match?.[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extrai turma, relator e data de distribuição a partir dos movimentos brutos.
 *
 * Ordena do mais recente para o mais antigo e procura o primeiro movimento de
 * distribuição ou redistribuição que contenha a informação.
 */
export function extrairOrgaoJulgador(
  movimentos: MovimentoBruto[]
): OrgaoJulgadorResult {
  if (!movimentos || movimentos.length === 0) {
    return {
      turma: null,
      relator: null,
      data_distribuicao: null,
      fonte: "nao_encontrado",
    };
  }

  // Ordena do mais recente para o mais antigo
  const sorted = [...movimentos].sort((a, b) => {
    const da = getStepDate(a) || "";
    const db = getStepDate(b) || "";
    return db.localeCompare(da);
  });

  for (const step of sorted) {
    const content = getStepContent(step);
    const code = getStepCode(step);
    const isRedist = isRedistribuicao(content);
    const isDist = isDistribuicao(content, code);

    if (!isDist && !isRedist) continue;

    const relator = extrairRelatorDoTexto(content);
    const turma = extrairTurmaDoTexto(content);
    const data = getStepDate(step)?.substring(0, 10) || null;

    // Só retorna se encontrou pelo menos relator ou turma
    if (relator || turma) {
      return {
        turma,
        relator,
        data_distribuicao: data,
        fonte: isRedist ? "movimento_redistribuicao" : "movimento_distribuicao",
      };
    }
  }

  return {
    turma: null,
    relator: null,
    data_distribuicao: null,
    fonte: "nao_encontrado",
  };
}
