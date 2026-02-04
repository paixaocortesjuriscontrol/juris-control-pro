/**
 * Matching estrito para termos DJEN (parte/palavra-chave).
 *
 * IMPORTANTE: exige FRASE EXATA na ordem - "Super Quadra" só casa se o texto
 * contiver exatamente "Super Quadra" (não "Quadra Super", nem palavras separadas).
 * Evita "enquadramento"/"enquadrar" (substring "quadra").
 */

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizarParaMatch(texto: string): string {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[&\/\\]/g, " ")
    .replace(/[^0-9A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Verifica se a frase exata aparece no texto (normalizado), na ordem correta, com limites de palavra. */
function contemFraseExata(conteudoNorm: string, termoNorm: string): boolean {
  if (!termoNorm) return true;
  const re = new RegExp(`(?:^|\\s)${escapeRegex(termoNorm)}(?:\\s|$)`);
  return re.test(conteudoNorm);
}

export function conteudoContemTodasPalavrasDoTermo(conteudo: string, termo: string): boolean {
  if (!conteudo) return false;
  const termoRaw = String(termo || "").trim();
  if (!termoRaw) return true;

  const conteudoNorm = normalizarParaMatch(conteudo);
  const termoNorm = normalizarParaMatch(termoRaw);
  if (!termoNorm) return true;

  return contemFraseExata(conteudoNorm, termoNorm);
}

/** Para filtros de busca: verifica se texto contém a frase exata (aceita null/undefined). */
export function conteudoContemFraseExata(conteudo: string | null | undefined, termo: string | null | undefined): boolean {
  if (!termo?.trim()) return true;
  if (!conteudo) return false;
  return conteudoContemTodasPalavrasDoTermo(conteudo, termo.trim());
}
