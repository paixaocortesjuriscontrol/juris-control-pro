/**
 * Matching estrito para termos DJEN (parte/palavra-chave).
 *
 * Motivação: termos com "&" podem ter letras isoladas relevantes (ex.: "F & F").
 * Se ignorarmos tokens de 1 char, o termo vira só "DISTRIBUIDORA" e gera falso positivo.
 */

function normalizarParaMatch(texto: string): string {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[&\/\\]/g, " ")
    // Remove pontuação geral para permitir match por palavra (ex: "LTDA." -> "LTDA")
    .replace(/[^0-9A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contemTokenInteiro(conteudoNorm: string, token: string): boolean {
  if (!token) return true;
  const re = new RegExp(`(?:^|\\s)${escapeRegex(token)}(?:\\s|$)`);
  return re.test(conteudoNorm);
}

export function conteudoContemTodasPalavrasDoTermo(conteudo: string, termo: string): boolean {
  if (!conteudo) return false;
  const termoRaw = String(termo || "").trim();
  if (!termoRaw) return true;

  const conteudoNorm = normalizarParaMatch(conteudo);
  const termoNorm = normalizarParaMatch(termoRaw);
  if (!termoNorm) return true;

  // Match rápido: frase completa (já normalizada)
  if (conteudoNorm.includes(termoNorm)) return true;

  const tokens = termoNorm.split(/\s+/).filter(Boolean);
  const allowSingleLetters = /&/.test(termoRaw) && tokens.filter((t) => t.length === 1).length >= 2;
  const palavras = tokens.filter((t) => t.length >= 2 || (allowSingleLetters && t.length === 1));
  if (palavras.length === 0) return true;

  return palavras.every((t) => contemTokenInteiro(conteudoNorm, t));
}
