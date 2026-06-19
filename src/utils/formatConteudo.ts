import React from "react";

/**
 * Utilitário para normalizar conteúdo HTML de intimações/publicações jurídicas.
 * Converte tags HTML em quebras de linha e remove formatação desnecessária,
 * preparando o texto para ser exibido com whitespace-pre-wrap.
 */

export const decodeHtmlEntities = (value: string): string => {
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
 * Strip HTML tags AND decode HTML entities (named + numeric) into plain text.
 * Usar em geradores de PDF/DOCX/exportação e em qualquer lugar que renderize
 * o conteúdo como texto puro (sem HTML), para não vazar entidades cruas como
 * "&atilde;", "&ccedil;", "&aacute;" na saída.
 */
export const stripHtmlAndDecodeEntities = (
  value: string | null | undefined,
): string => {
  if (!value) return "";
  // 1) Remove tags HTML
  const noTags = String(value).replace(/<[^>]*>/g, " ");
  // 2) Decodifica entidades (named + numéricas) via DOM
  const decoded = decodeHtmlEntities(noTags);
  // 3) Normaliza espaços
  return decoded.replace(/\s+/g, " ").trim();
};

/**
 * Normaliza conteúdo HTML para texto puro com quebras de linha.
 * Remove scripts, estilos, converte <br>, <p>, <li> etc. em \n.
 * O resultado deve ser renderizado com whitespace-pre-wrap.
 */
export const formatConteudoParaExibicao = (conteudo: string | null | undefined, stripMetadataHeader = false): string => {
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

  // Opcionalmente remove cabeçalho de metadados injetado no corpo (Órgão:, Data de disponibilização:, etc.)
  if (stripMetadataHeader) {
    s = stripMetadataFromContent(s);
  }

  return s;
};

/**
 * Converte conteúdo (possivelmente HTML) em texto puro com quebras de linha,
 * sem remover metadados. Use para extração de partes/advogados para que os regex
 * rodem sobre o mesmo texto que o usuário vê na exibição.
 */
export function conteudoHtmlParaTexto(conteudo: string | null | undefined): string {
  return formatConteudoParaExibicao(conteudo ?? "", false);
}

/**
 * Remove cabeçalho de metadados que foi injetado no corpo do conteúdo da publicação.
 * Identifica e remove linhas como "Órgão: ...", "Data de disponibilização: ...",
 * "Tipo de comunicação: ...", "Meio: ...", "Processo: ...", "Advogados:" e lista de nomes que seguem.
 */
const stripMetadataFromContent = (text: string): string => {
  const lines = text.split('\n');
  let startIdx = 0;
  
  // Padrões de metadados que aparecem no início do conteúdo
  const metaPatterns = [
    /^Órgão\s*:/i,
    /^Data\s+de\s+disponibiliza/i,
    /^Data\s+de\s+publica/i,
    /^Tipo\s+de\s+comunica/i,
    /^Meio\s*:/i,
    /^Processo\s*:/i,
    /^Fonte\s*:/i,
    /^Inteiro\s+teor\s*:/i,
  ];
  
  // Percorre linhas do início procurando metadados
  for (let i = 0; i < lines.length && i < 20; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) { startIdx = i + 1; continue; }
    
    const isMeta = metaPatterns.some(p => p.test(trimmed));
    if (isMeta) { startIdx = i + 1; continue; }
    
    // Seção "Advogados:" seguida de nomes
    if (/^Advogados?\s*:/i.test(trimmed)) {
      startIdx = i + 1;
      // Pular as linhas seguintes que são nomes de advogados (all caps, curtas)
      while (startIdx < lines.length && startIdx < i + 15) {
        const nextLine = lines[startIdx].trim();
        if (!nextLine) { startIdx++; continue; }
        // Se parece nome (ALL CAPS, < 100 chars, sem pontuação de sentença)
        if (nextLine.length < 100 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(nextLine) && !/[.;]$/.test(nextLine) && !/\b(DECISÃO|DESPACHO|ACÓRDÃO|SENTENÇA|CERTIDÃO|EDITAL|PODER|INTIMAÇÃO)\b/i.test(nextLine)) {
          startIdx++;
        } else {
          break;
        }
      }
      continue;
    }
    
    // Linha que é apenas o número do processo (20 dígitos)
    if (/^\d{20}$/.test(trimmed) || /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(trimmed)) {
      startIdx = i + 1;
      continue;
    }
    
    // Se chegou numa linha que não é metadado, parou
    break;
  }
  
  if (startIdx === 0) return text;

  const stripped = lines.slice(startIdx).join('\n').replace(/^\n+/, '').trim();
  // Fallback: se o strip "engoliu" todo o conteúdo (ocorre quando o texto vem
  // em uma única linha, como nas publicações do Kurier que começam com
  // "Data de Publicacao ..."), preserva o texto original em vez de devolver
  // um painel vazio para o usuário.
  return stripped || text;
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

/**
 * Normaliza uma string removendo acentos para comparação case-insensitive.
 */
const normalizeForHighlight = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Divide um texto em partes, destacando (em negrito) as ocorrências do termo de busca.
 * Retorna um array de React elements para ser renderizado diretamente.
 * A busca é case-insensitive e ignora acentos.
 */
export function highlightTermInContent(
  text: string,
  term: string | null | undefined
): React.ReactNode {
  if (!term || !text) return text;

  const termClean = term.trim();
  if (!termClean) return text;

  const termNorm = normalizeForHighlight(termClean);
  const textNorm = normalizeForHighlight(text);

  // Find all occurrences in the normalized version
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let searchFrom = 0;

  while (searchFrom < textNorm.length) {
    const idx = textNorm.indexOf(termNorm, searchFrom);
    if (idx === -1) break;

    // Add text before match
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }

    // Add highlighted match (using original text casing)
    const matchEnd = idx + termClean.length;
    parts.push(
      React.createElement(
        "mark",
        {
          key: `hl-${idx}`,
          className: "font-bold bg-yellow-200 dark:bg-yellow-800/60 text-foreground rounded-sm px-0.5",
        },
        text.slice(idx, matchEnd)
      )
    );

    lastIndex = matchEnd;
    searchFrom = matchEnd;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// ============================================================================
// PARSER: blob "searchable" do Kurier
// ----------------------------------------------------------------------------
// Quando o payload do Kurier não traz um campo de texto identificável, a
// edge function persiste em `conteudo` um blob com todos os campos do objeto
// serializados em sequência, sem pontuação ou quebras:
//
//   "Data de Publicacao 19-06-2026 Data de Divulgação 18-06-2026
//    PROCESSO0001710-57.2001.4.01.4300 ORGÃOSPF COORDENADORIA ... 
//    DATA DE DISPONIBILIZAÇÃO2026-06-18 TIPO DE COMUNICAÇÃOIntimação
//    MEIODiário ... TRIBUNALSTJ DESPACHO / DECISÃO RECURSO ESPECIAL
//    TEXTOEDcl no AgInt no REsp ... RELATORA MINISTRA REGINA ...
//    EMBARGANTE INVESTCO S/A ADVOGADOS CARLOS JOSE ELIAS JUNIOR - DF010424
//    ... EMBARGADO SINOMAR ... DECISÃO Vistos. Trata-se ..."
//
// Este parser identifica esse formato e extrai metadados, partes, advogados
// e o inteiro teor para apresentação estruturada (igual ao DJEN).
// ============================================================================

export interface KurierParteParsed {
  papel: string; // "Embargante", "Relator", "Reclamante" ...
  nome: string;
}

export interface KurierBlobParsed {
  isKurier: boolean;
  meta: {
    orgao: string | null;
    dataDisp: string | null;
    tipoComunicacao: string | null;
    meio: string | null;
    tribunal: string | null;
    processo: string | null;
  };
  partes: KurierParteParsed[];
  advogados: string[];
  inteiroTeor: string;
}

const KURIER_PARTY_LABELS = [
  "RELATOR(?:A)?",
  "EMBARGANTE",
  "EMBARGADO",
  "RECORRENTE",
  "RECORRIDO",
  "AGRAVANTE",
  "AGRAVADO",
  "RECLAMANTE",
  "RECLAMADO",
  "AUTOR(?:A)?",
  "R[ÉE]U",
  "IMPETRANTE",
  "IMPETRADO",
  "REQUERENTE",
  "REQUERIDO",
  "EXEQUENTE",
  "EXECUTADO",
  "APELANTE",
  "APELADO",
  "INTERESSADO",
  "ADVOGADOS?",
];

const KURIER_BODY_OPENERS = [
  "DECISÃO",
  "DESPACHO",
  "SENTENÇA",
  "ACÓRDÃO",
  "EMENTA",
  "RELATÓRIO",
  "VOTO",
];

const capitalizePapel = (s: string): string => {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const isKurierBlob = (texto: string): boolean => {
  // Conteúdo HTML estruturado: não tratar como blob Kurier.
  if (/<\s*(html|table|tr|td|p|div|br)\b/i.test(texto)) return false;
  // Assinatura forte: label glued ao valor (sem separador).
  return (
    /\bDATA\s+DE\s+DISPONIBILIZAÇÃO\d{4}-\d{1,2}-\d{1,2}/i.test(texto) ||
    /\bTIPO\s+DE\s+COMUNICAÇÃO[A-ZÀ-Ÿa-zà-ÿ]/.test(texto) ||
    (/\bORG[ÃA]O[A-ZÀ-Ÿ]/.test(texto) && /\bMEIO[A-ZÀ-Ÿ]/.test(texto)) ||
    /\bTRIBUNAL[A-Z]{2,5}\s+(?:DESPACHO|TEXTO|DECISÃO|SENTENÇA|ACÓRDÃO|RECURSO)/i.test(texto)
  );
};

/** Extrai um campo "LABELvalor" do cabeçalho — captura tudo até o próximo label conhecido. */
const extractGluedField = (
  texto: string,
  label: RegExp,
  stopLabels: string[],
): string | null => {
  // Sem `\b` no final — labels terminam em letras acentuadas (Ã/Ç) e são
  // seguidos por dígitos/letras, casos onde `\b` não dispara em JS regex.
  const stops = stopLabels.join("|");
  const re = new RegExp(
    `${label.source}\\s*([\\s\\S]*?)(?=\\s+(?:${stops})|$)`,
    "i",
  );
  const m = texto.match(re);
  return m?.[1]?.trim().replace(/\s+/g, " ") || null;
};

export function parseKurierBlob(
  conteudo: string | null | undefined,
): KurierBlobParsed {
  const empty: KurierBlobParsed = {
    isKurier: false,
    meta: { orgao: null, dataDisp: null, tipoComunicacao: null, meio: null, tribunal: null, processo: null },
    partes: [],
    advogados: [],
    inteiroTeor: "",
  };
  const texto = String(conteudo || "").trim();
  if (!texto) return empty;
  if (!isKurierBlob(texto)) return empty;

  // ── Divisão em "header" (antes de TEXTO) e "miolo" (depois de TEXTO) ──
  // "TEXTO" é a sentinela que separa metadados do conteúdo estruturado.
  const textoIdx = texto.search(/\bTEXTO(?=[A-ZÀ-Ÿ"'(\[])/);
  const header = textoIdx >= 0 ? texto.slice(0, textoIdx) : texto;
  let miolo = textoIdx >= 0 ? texto.slice(textoIdx).replace(/^TEXTO/, "").trim() : "";

  // Labels conhecidos do header (para servirem de "stop" uns para os outros)
  const headerLabels = [
    "PROCESSO", "ORG[ÃA]O", "DATA\\s+DE\\s+DISPONIBILIZAÇÃO",
    "DATA\\s+DE\\s+DIVULGAÇÃO", "DATA\\s+DE\\s+PUBLICACAO",
    "TIPO\\s+DE\\s+COMUNICAÇÃO", "MEIO", "TRIBUNAL",
    "DESPACHO\\s*/\\s*DECISÃO", "RECURSO\\s+ESPECIAL", "TEXTO",
  ];

  const processo = extractGluedField(header, /\bPROCESSO/i, headerLabels);
  const orgao = extractGluedField(header, /\bORG[ÃA]O/i, headerLabels);
  const dataDisp = extractGluedField(header, /\bDATA\s+DE\s+DISPONIBILIZAÇÃO/i, headerLabels);
  const tipoComunicacao = extractGluedField(header, /\bTIPO\s+DE\s+COMUNICAÇÃO/i, headerLabels);
  const meio = extractGluedField(header, /\bMEIO/i, headerLabels);
  const tribunal = extractGluedField(header, /\bTRIBUNAL/i, headerLabels);

  // ── Parse do miolo: partes + advogados + corpo ──────────────────────
  const partes: KurierParteParsed[] = [];
  const advogados: string[] = [];
  let inteiroTeor = miolo;

  if (miolo) {
    // Localiza início do corpo da decisão (primeiro DECISÃO/DESPACHO/etc.
    // PRECEDIDO de espaço, para não confundir com label "DECISÃO" colado).
    const bodyOpenersAlt = KURIER_BODY_OPENERS.join("|");
    const bodyRe = new RegExp(`\\s(?:${bodyOpenersAlt})\\b`, "i");
    const bodyMatch = miolo.match(bodyRe);
    let estrutBlock = miolo;
    if (bodyMatch && bodyMatch.index !== undefined) {
      estrutBlock = miolo.slice(0, bodyMatch.index);
      inteiroTeor = miolo.slice(bodyMatch.index + 1); // +1 pula o espaço
    } else {
      // sem opener: deixa o miolo inteiro como inteiro teor; sem extração estrut
      estrutBlock = "";
      inteiroTeor = miolo;
    }

    // Quebra estrutBlock em segmentos "LABEL valor" usando lookahead nos labels
    if (estrutBlock) {
      const labelsAlt = KURIER_PARTY_LABELS.join("|");
      const segRe = new RegExp(
        `\\b(${labelsAlt})\\b\\s+([\\s\\S]*?)(?=\\s+\\b(?:${labelsAlt})\\b|$)`,
        "gi",
      );
      let m: RegExpExecArray | null;
      while ((m = segRe.exec(estrutBlock)) !== null) {
        const rawLabel = m[1].toUpperCase();
        const rawValue = m[2].trim().replace(/\s+/g, " ");
        if (!rawValue) continue;

        if (/^ADVOGADOS?$/.test(rawLabel)) {
          // Divide por "NOME - UF + dígitos[A?]"
          const advRe = /([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç.\s']+?)\s*[-–]\s*([A-Z]{2})(\d{3,7}[A-Z]?)/g;
          let am: RegExpExecArray | null;
          while ((am = advRe.exec(rawValue)) !== null) {
            const nome = am[1].trim().replace(/\s+/g, " ");
            const uf = am[2];
            const num = am[3];
            if (nome.length >= 4) {
              advogados.push(`${nome} - OAB ${uf}-${num}`);
            }
          }
        } else {
          partes.push({ papel: capitalizePapel(rawLabel), nome: rawValue });
        }
      }
    }
  }

  return {
    isKurier: true,
    meta: { orgao, dataDisp, tipoComunicacao, meio, tribunal, processo },
    partes,
    advogados,
    inteiroTeor: inteiroTeor.trim(),
  };
}
