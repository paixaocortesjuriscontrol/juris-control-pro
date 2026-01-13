/**
 * Utilitário para normalizar conteúdo HTML de intimações/publicações jurídicas.
 * Converte tags HTML em quebras de linha e remove formatação desnecessária,
 * preparando o texto para ser exibido com whitespace-pre-wrap.
 */

const decodeHtmlEntities = (value: string): string => {
  if (!value) return value;
  try {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  } catch {
    return value;
  }
};

/**
 * Normaliza conteúdo HTML para texto puro com quebras de linha.
 * Remove scripts, estilos, converte <br>, <p>, <li> etc. em \n.
 * O resultado deve ser renderizado com whitespace-pre-wrap.
 */
export const formatConteudoParaExibicao = (conteudo: string | null | undefined): string => {
  const raw = conteudo || "Sem conteúdo";

  let s = raw;

  // Remove blocos que não devem ser exibidos
  s = s
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  // Normaliza quebras e alguns blocos comuns
  s = s
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<\/(div|tr|table|ul|ol|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<(div|tr|table|ul|ol|h[1-6]|blockquote)[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "");

  s = decodeHtmlEntities(s)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
};

/**
 * Classes CSS padrão para renderizar conteúdo normalizado.
 */
export const conteudoDisplayClasses = 
  "w-full max-w-full text-left leading-relaxed break-words [overflow-wrap:anywhere] whitespace-pre-wrap";
