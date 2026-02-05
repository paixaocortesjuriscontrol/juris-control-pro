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

  // Detectar e limpar HTML truncado (tags incompletas no final)
  // Isso acontece quando a API retorna conteúdo cortado no meio de uma tag HTML
  const truncatedTagMatch = s.match(/<[a-z][^>]*$/i);
  if (truncatedTagMatch) {
    // Remove a tag incompleta do final
    s = s.slice(0, truncatedTagMatch.index);
  }
  
  // Remove atributos incompletos no final (ex: style="widt)
  const truncatedAttrMatch = s.match(/\s+[a-z-]+\s*=\s*["'][^"']*$/i);
  if (truncatedAttrMatch) {
    s = s.slice(0, truncatedAttrMatch.index);
  }

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

/**
 * Formata uma data como "dd/MM" ignorando timezone (trata como data pura).
 * Útil para data_disponibilizacao e data_publicacao que são datas sem hora.
 */
export const formatDateOnly = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  try {
    // Extrai apenas YYYY-MM-DD da string (ignora timezone)
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, , month, day] = match;
      return `${day}/${month}`;
    }
    return dateString;
  } catch {
    return dateString;
  }
};

/**
 * Formata uma data como "dd/MM/yyyy" ignorando timezone (trata como data pura).
 */
export const formatDateOnlyFull = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  try {
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
    return dateString;
  } catch {
    return dateString;
  }
};
