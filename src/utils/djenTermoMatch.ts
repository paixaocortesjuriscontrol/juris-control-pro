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
  // IMPORTANTE: verificar no termo ORIGINAL (não normalizado) se tinha "&"
  const termoOriginalTemAmpersand = /&/.test(termoRaw);
  const allowSingleLetters = termoOriginalTemAmpersand && tokens.filter((t) => t.length === 1).length >= 2;
  const palavras = tokens.filter((t) => t.length >= 2 || (allowSingleLetters && t.length === 1));
  if (palavras.length === 0) return true;

  // VALIDAÇÃO ESTRITA: 100% das palavras devem estar presentes
  // Usar includes ao invés de regex para ser menos restritivo e mais rápido
  return palavras.every((t) => conteudoNorm.includes(t));
}
