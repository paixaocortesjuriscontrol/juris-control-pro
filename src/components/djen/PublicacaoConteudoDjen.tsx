import { useState } from "react";
import { ExternalLink, Printer, Copy, FileText, User, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatProcessoNumero } from "@/lib/utils";
import { formatConteudoParaExibicao, conteudoDisplayClasses, conteudoHtmlParaTexto } from "@/utils/formatConteudo";

interface PublicacaoConteudoDjenProps {
  processoNumero: string | null;
  tribunal: string | null;
  fonte: string | null;
  dataDisponibilizacao: string | null;
  dataPublicacao: string | null;
  conteudo: string | null;
  poloAtivo: string | null;
  poloPassivo: string | null;
  monitoramentoOab: string | null;
  monitoramentoUf: string | null;
  monitoramentoTermo: string | null;
  monitoramentoDescricao: string | null;
  className?: string;
  maxHeight?: string;
  // Campos estruturados da API (prioritários sobre regex)
  orgaoEstruturado?: string | null;
  tipoComunicacaoEstruturado?: string | null;
  meioEstruturado?: string | null;
  partesJson?: string[] | null;
  advogadosJson?: string[] | null;
  /** Quando true (controlado pelo pai), exibe publicação sem scroll e não mostra o botão Expandir Geral */
  expandirGeralExterno?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

const formatDate = (dateString: string | null) => {
  if (!dateString) return "-";
  try {
    return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateString;
  }
};

const expandMeio = (m: string | null): string => {
  if (!m) return "Diário de Justiça Eletrônico Nacional";
  if (m === "D") return "Diário de Justiça Eletrônico Nacional";
  return m;
};

/** Limpa polo_passivo que vem contaminado com texto da intimação */
const cleanPolo = (polo: string | null): string | null => {
  if (!polo) return null;
  // Corta no primeiro keyword jurídico que indica início de texto de intimação
  const cutMatch = polo.match(/\b(INTIMAÇÃO|INTIMAÇÃO|DESPACHO|SENTENÇA|DECISÃO|ACÓRDÃO|Fica\s+V\.\s*Sa|AIRR|RR-|ROT-|ARR-|PROCESSO)\b/i);
  if (cutMatch && cutMatch.index && cutMatch.index > 3) {
    return polo.substring(0, cutMatch.index).trim();
  }
  // Se o polo é muito longo, provavelmente está contaminado
  if (polo.length > 120) {
    const firstPeriod = polo.indexOf('.');
    if (firstPeriod > 5 && firstPeriod < 100) {
      // Pode ser "S.A." — check for that
      if (!/S\.A\.$/.test(polo.substring(0, firstPeriod + 1))) {
        return polo.substring(0, firstPeriod + 1).trim();
      }
    }
    return polo.substring(0, 100).trim();
  }
  return polo.trim();
};

// ============================================================================
// REGEX FALLBACK: extração de metadados do conteúdo (publicações antigas)
// ============================================================================

const extractMetadataFromContent = (texto: string | null): {
  orgaoExtraido: string | null;
  tipoComunicacao: string | null;
  meio: string | null;
} => {
  if (!texto) return { orgaoExtraido: null, tipoComunicacao: null, meio: null };
  const plain = texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const orgaoMatch = plain.match(
    /Órgão\s*:\s*(.+?)(?=\s*(?:Data\s+de|Tipo\s+de|Meio\s*:|Processo\s*:|$))/i
  );
  const tipoMatch = plain.match(
    /Tipo\s+de\s+comunica[çc][ãa]o\s*:\s*(.+?)(?=\s*(?:Meio\s*:|Processo\s*:|Data|$))/i
  );
  const meioMatch = plain.match(
    /Meio\s*:\s*(.+?)(?=\s*(?:Processo\s*:|Data|Tipo|Advogado|$))/i
  );

  return {
    orgaoExtraido: orgaoMatch?.[1]?.trim() || null,
    tipoComunicacao: tipoMatch?.[1]?.trim() || null,
    meio: meioMatch?.[1]?.trim() || null,
  };
};

const pareceNomeParte = (value: string): boolean => {
  const v = String(value || "").replace(/\s+/g, " ").trim();
  if (!v) return false;
  if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]/.test(v)) return false;
  const upper = v.toUpperCase();
  if (upper.startsWith("DJEN") || upper.includes("DJEN DO")) return false;
  if (upper.includes("OAB")) return false;
  if (v.length > 140) return false;
  const tokens = v.split(" ").filter((t) => /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(t));
  const meaningful = tokens.filter((t) => t.length >= 2);
  const hasMinWords = meaningful.length >= 2;
  const hasSuffix = /\b(LTDA|S\.?A\.?|S\/A|EIRELI|ME|EPP)\b/i.test(v);
  return hasMinWords || hasSuffix;
};

const pareceNomeAdvogado = (value: string): boolean => {
  const v = String(value || "").replace(/\s+/g, " ").trim();
  if (!v) return false;
  if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(v)) return false;
  const upper = v.toUpperCase();
  if (upper.startsWith("DJEN") || upper.includes("DJEN DO")) return false;
  if (v.length > 90) return false;
  const tokens = v.split(" ").filter((t) => /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(t));
  const meaningful = tokens.filter((t) => t.length >= 2);
  return meaningful.length >= 2;
};

/**
 * Extrai partes e advogados do conteúdo da publicação e dos campos estruturados.
 * Estratégia: 
 *   1. Partes: polo_ativo/passivo, bloco "Advogados:" no header (que na verdade contém partes),
 *      advogados_json sem OAB, e padrões rotulados (AGRAVANTE, RECLAMANTE, etc.)
 *   2. Advogados: advogados_json com OAB, padrões OAB no texto, e padrões "Dr./Dra." no texto
 */
const extractPartesAndAdvogados = (
  texto: string | null,
  poloAtivo: string | null,
  poloPassivo: string | null,
  advogadosJson: string[] | null,
): { partes: string[]; advogados: string[] } => {
  const partes: string[] = [];
  const advogados: string[] = [];
  const advSet = new Set<string>();
  const partesSet = new Set<string>();

  const addParte = (nome: string) => {
    const clean = nome.trim();
    if (!clean || !pareceNomeParte(clean)) return;
    const key = clean.toUpperCase();
    if (partesSet.has(key)) return;
    partes.push(clean);
    partesSet.add(key);
  };

  const addAdvogado = (entry: string, dedup_key?: string) => {
    const key = dedup_key || entry.toUpperCase();
    if (advSet.has(key)) return;
    advSet.add(key);
    advogados.push(entry);
  };

  // ── 1. Partes dos polos ───────────────────────────────────────────────
  addParte(cleanPolo(poloAtivo) || '');
  addParte(cleanPolo(poloPassivo) || '');

  // ── 2. Partes do bloco "Advogado(s):" ou "Advogado(s)" (sem dois pontos) no header ──
  if (texto) {
    const headerMatch = texto.match(/Advogados?\s*(?:\(\s*s\s*\))?\s*(?:\s*:\s*)?\s*\n([\s\S]*?)(?=\n\s*\n|\nPODER\b|\nINTIMAÇÃO\b|\nDESPACHO\b|\nSENTENÇA\b|\nDECISÃO\b|\nACÓRDÃO\b|\nEDITAL\b|\nCERTIDÃO\b|$)/i);
    if (headerMatch?.[1]) {
      const linhas = headerMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
      for (const linha of linhas) {
        if (/OAB/i.test(linha)) {
          // É um advogado real com OAB
          addAdvogado(linha);
        } else {
          addParte(linha);
        }
      }
    }
  }

  // ── 3. Partes do advogados_json (itens sem OAB são partes) ────────────
  if (advogadosJson && Array.isArray(advogadosJson)) {
    for (const item of advogadosJson) {
      const s = String(item || '').trim();
      if (!s) continue;
      if (/OAB/i.test(s)) {
        addAdvogado(s);
      } else {
        addParte(s);
      }
    }
  }

  // ── 3b. Advogados no formato do DJEN: "ADVOGADO: NOME" ou "ADVOGADO: NOME - OAB UF-12345" (em qualquer linha do conteúdo)
  if (texto) {
    const lines = texto.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*ADVOGADO\s*:\s*(.+)$/im);
      if (!m?.[1]) continue;
      const valor = m[1].trim();
      if (!valor || valor.length < 3) continue;
      if (/OAB\s*[\/\-\s]*\d/i.test(valor)) {
        addAdvogado(valor, valor.replace(/\s+/g, " ").toUpperCase());
      } else {
        addAdvogado(valor, valor.replace(/\s+/g, " ").toUpperCase());
      }
    }
  }

  // ── 4. Partes de padrões rotulados no texto ───────────────────────────
  if (texto && partes.length === 0) {
    const plainText = texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const labelPatterns: RegExp[] = [
      /AGRAVANTE[:\s]+([^\n]+?)(?=\s+(?:AGRAVADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /AGRAVADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /RECLAMANTE[:\s]+([^\n]+?)(?=\s+(?:RECLAMADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /RECLAMADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /EXEQUENTE[:\s]+([^\n]+?)(?=\s+(?:EXECUTADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /EXECUTADO[:\s]+([^\n]+?)(?=\s+(?:E OUTROS|INTIMAÇÃO|ADV|ADVOGADO|OAB|\d{7}|$))/i,
      /AUTOR[:\s]+([^\n]+?)(?=\s+(?:R[ÉE]U|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /R[ÉE]U[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /REQUERENTE[:\s]+([^\n]+?)(?=\s+(?:REQUERIDO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /REQUERIDO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /IMPETRANTE[:\s]+([^\n]+?)(?=\s+(?:IMPETRADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /IMPETRADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /EMBARGANTE[:\s]+([^\n]+?)(?=\s+(?:EMBARGADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /EMBARGADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /APELANTE[:\s]+([^\n]+?)(?=\s+(?:APELADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /APELADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
    ];
    for (const pattern of labelPatterns) {
      const match = plainText.match(pattern);
      if (!match?.[1]) continue;
      const candidato = match[1].trim().replace(/\s+E\s+OUTROS.*$/i, "");
      addParte(candidato);
    }
  }

  // ── 5. Advogados via regex OAB no texto ───────────────────────────────
  if (texto) {
    const plainText = texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    // Primeiro: varrer TODO o texto por "DR./DRA. NOME - OAB UF-NUM" (formato exato do DJEN)
    const globalOabFirst = texto.matchAll(/\s*((?:DR\.?|DRA\.?)\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*[-–—]\s*OAB\s*\/?\s*([A-Z]{2})\s*[-–—]?\s*(\d[\d.]*)/gi);
    for (const match of globalOabFirst) {
      const nome = (match[1] || "").trim();
      const uf = (match[2] || "").toUpperCase();
      const num = (match[3] || "").trim();
      if (nome.length >= 4 && uf && num) addAdvogado(`${nome} - OAB ${uf}-${num}`, `${uf}-${num}`);
    }

    const acceptNome = (nome: string) => {
      const n = nome.trim();
      if (!n || n.length < 4) return false;
      if (/^(DJEN|OAB|PARTES?|ADVOGADOS?)$/i.test(n)) return false;
      return true;
    };

    // Formato: NOME (OAB 12345/SP) ou NOME (OAB: 12345/SP)
    for (const match of plainText.matchAll(
      /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*\(OAB[:\s]*(\d{1,10})\s*\/?\s*([A-Z]{2})(?:-[A-Z])?\)/g
    )) {
      const nome = (match[1] || "").trim();
      const numero = (match[2] || "").trim();
      const uf = (match[3] || "").toUpperCase();
      if (numero && uf && (pareceNomeAdvogado(nome) || acceptNome(nome))) {
        addAdvogado(`${nome} - OAB ${uf}-${numero}`, `${numero}-${uf}`);
      }
    }

    // Formato: NOME - OAB UF-12345 ou NOME OAB: UF-12345 (ex.: EVANDRO FERREIRA SALVI - OAB SP-246470)
    for (const match of plainText.matchAll(
      /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*-?\s*OAB[:\s]*([A-Z]{2})[:\s-]*(\d{1,10})/gi
    )) {
      const nome = (match[1] || "").trim();
      const uf = (match[2] || "").toUpperCase();
      const numero = (match[3] || "").trim();
      if (numero && uf && (pareceNomeAdvogado(nome) || acceptNome(nome))) {
        addAdvogado(`${nome} - OAB ${uf}-${numero}`, `${numero}-${uf}`);
      }
    }

    // Formato do corpo do texto: "Dr(a). NOME - OAB/UF n.° 12345" (ex.: termo de audiência)
    for (const match of texto.matchAll(
      /Dr\.?\s*\(?a?\)?\s*\.?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*[-–]\s*OAB\s*\/?\s*([A-Z]{2})\s*n\.?\s*°?\s*\.?\s*(\d{1,10})/gi
    )) {
      const nome = (match[1] || "").trim();
      const uf = (match[2] || "").toUpperCase();
      const numero = (match[3] || "").trim();
      if (nome.length >= 4 && numero && uf) {
        addAdvogado(`${nome} - OAB ${uf}-${numero}`, `${numero}-${uf}`);
      }
    }

    // Formato multi-linha do DJEN: "Advogado(s)" ou "Advogado(s):" + quebra + lista
    const advBlock = texto.match(/Advogados?\s*(?:\(\s*s\s*\))?\s*(?:\s*:\s*)?\s*\n([\s\S]*?)(?=\n\s*\n|\nParte\s*\(\s*s\s*\)|\nPARTES?\s*:|\nPODER\b|\nINTIMAÇÃO\b|\nDESPACHO\b|\nSENTENÇA\b|\nDECISÃO\b|\nACÓRDÃO\b|$)/i);
    if (advBlock?.[1]) {
      for (const line of advBlock[1].split(/\n/)) {
        const t = line.trim();
        const m1 = t.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^OAB\n]{3,}?)\s+N[ºª°]?\s*OAB\s*:\s*(\d+)\s+UF\s*:\s*([A-Z]{2})/i);
        const m2 = t.match(/([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-záéíóúâêôãõç\s]+?)\s*-?\s*OAB\s*([A-Z]{2})[-\s]*(\d{1,10})/i);
        if (m1) {
          const nome = (m1[1] || "").trim();
          const numero = (m1[2] || "").trim();
          const uf = (m1[3] || "").toUpperCase();
          if (nome && numero && uf) addAdvogado(`${nome} - OAB ${uf}-${numero}`, `${numero}-${uf}`);
        } else if (m2) {
          const nome = (m2[1] || "").trim();
          const uf = (m2[2] || "").toUpperCase();
          const numero = (m2[3] || "").trim();
          if (nome && numero && uf) addAdvogado(`${nome} - OAB ${uf}-${numero}`, `${numero}-${uf}`);
        }
      }
    }

    // Bloco "Advogado(s)" ou "Advogado(s):" em uma só linha
    const advSectionOneLine = plainText.match(/\bAdvogados?\s*(?:\(\s*s\s*\))?\s*(?:\s*:\s*)?\s*([^\n]+?)(?=\s+Parte\s*\(|\s+Conteúdo\s+Integral|$)/i);
    if (advSectionOneLine?.[1] && advogados.length === 0) {
      const block = advSectionOneLine[1].trim();
      const parts = block.split(/(?=\s*(?:DR\.|DRA\.)\s+)/gi).map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        const m = p.match(/^((?:DR\.?|DRA\.?)\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*[-–—]\s*OAB\s*([A-Z]{2})\s*[-–—]?\s*(\d[\d.]*)/i);
        if (m) {
          const nome = (m[1] || "").trim();
          const uf = (m[2] || "").toUpperCase();
          const num = (m[3] || "").trim();
          if (nome.length >= 4 && uf && num) addAdvogado(`${nome} - OAB ${uf}-${num}`, `${uf}-${num}`);
        }
      }
    }

    // Reforço: mesmo padrão no texto colapsado (uma linha) e traço largo (—)
    if (advogados.length === 0) {
      const globalOab = texto.matchAll(/\s*((?:DR\.?|DRA\.?)\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*[-–—]\s*OAB\s*\/?\s*([A-Z]{2})\s*[-–—]?\s*(\d[\d.]*)/gi);
      for (const match of globalOab) {
        const nome = (match[1] || "").trim();
        const uf = (match[2] || "").toUpperCase();
        const num = (match[3] || "").trim();
        if (nome.length >= 4 && uf && num) addAdvogado(`${nome} - OAB ${uf}-${num}`, `${uf}-${num}`);
      }
    }

    // Fallback extra: regex permissivo (hífen, en-dash, em-dash; qualquer caractere no nome) para edge cases
    if (advogados.length === 0) {
      const permissive = texto.matchAll(/(?:DR\.?|DRA\.?)\s*([^-\n]+?)\s*[-–—]\s*OAB\s+([A-Z]{2})[-–—]?\s*(\d[\d.]*)/gi);
      for (const match of permissive) {
        const nome = (match[1] || "").trim();
        const uf = (match[2] || "").toUpperCase();
        const num = (match[3] || "").trim();
        if (nome.length >= 4 && uf && num && !/^(PARTE|ADVOGADO|CONTEÚDO|INTIMAÇÃO)$/i.test(nome)) {
          addAdvogado(`${nome} - OAB ${uf}-${num}`, `${uf}-${num}`);
        }
      }
    }
  }

  return { partes, advogados };
};

/**
 * Mesma lógica da tela: retorna Partes e Advogados para exibição (tela ou PDF).
 * Usa partes_json e advogados_json do Supabase; fallback para extração do conteúdo quando necessário.
 */
export function getPartesEAdvogadosParaExibicao(
  partesJson: string[] | null | undefined,
  advogadosJson: string[] | null | undefined,
  conteudo: string | null,
  poloAtivo: string | null,
  poloPassivo: string | null
): { partes: string[]; advogados: string[] } {
  // Normalizar partes: podem vir como strings OU objetos {nome, polo} de dados antigos
  const partesDoBanco = Array.isArray(partesJson) ? partesJson.map((x: any) => {
    if (typeof x === 'object' && x !== null && x.nome) {
      const polo = x.polo === 'A' ? 'Reclamante' : x.polo === 'P' ? 'Reclamado' : x.polo || '';
      return polo ? `[${polo}] ${x.nome}` : x.nome;
    }
    return String(x || "").trim();
  }).filter(Boolean) : [];
  const advogadosDoBanco = Array.isArray(advogadosJson) ? advogadosJson.map((x: any) => String(x || "").trim()).filter(Boolean) : [];
  const itemPareceParte = (s: string) =>
    /\b(BANCO|S\.A\.|S\/A|LTDA|RECUPERAÇÃO|CONTAX|INSTITUIÇÃO)\b/i.test(s) ||
    (!/\bOAB\b|\bDR\.|\bDRA\./i.test(s) && s.split(/\s+/).filter(Boolean).length >= 2);
  const conteudoParaExtracao = conteudo ? conteudoHtmlParaTexto(conteudo) : null;
  let partes: string[];
  let advogados: string[];
  if (partesDoBanco.length > 0) {
    partes = partesDoBanco;
    advogados = advogadosDoBanco.length > 0 ? advogadosDoBanco : [];
  } else if (advogadosDoBanco.length > 0) {
    const comoPartes = advogadosDoBanco.filter(itemPareceParte);
    const soAdvogados = advogadosDoBanco.filter((s) => /\bOAB\b|\bDR\.|\bDRA\./i.test(s));
    partes = comoPartes.length > 0 ? comoPartes : [];
    advogados = comoPartes.length > 0 ? soAdvogados : advogadosDoBanco;
  } else {
    const extraido = extractPartesAndAdvogados(conteudoParaExtracao, poloAtivo, poloPassivo, advogadosJson);
    partes = extraido.partes;
    advogados = extraido.advogados;
  }
  // Fallback: se o banco não tem advogados, extrair do conteúdo (ex.: bloco "Advogado(s)" no DJEN)
  if (advogados.length === 0 && conteudoParaExtracao) {
    const extraido = extractPartesAndAdvogados(conteudoParaExtracao, poloAtivo, poloPassivo, advogadosJson);
    advogados = extraido.advogados;
  }
  return { partes, advogados };
}

/**
 * Remove cabeçalhos de metadados repetidos do início do conteúdo
 * (Órgão:, Data de disponibilização:, Tipo de comunicação:, Meio:, Processo:, Advogados:)
 * para evitar duplicação com a sidebar de metadados.
 */
const stripMetadataFromContent = (texto: string | null): string | null => {
  if (!texto) return texto;
  let plain = texto;
  // Remove linhas de cabeçalho comuns no início
  const headerPattern = /^(\s*(Órgão\s*:|Data\s+de\s+(disponibilização|publicação)\s*:|Tipo\s+de\s+comunica[çc][ãa]o\s*:|Meio\s*:|Processo\s*:|Advogados?\s*:|Destinat[áa]rio\s*\(?\s*s?\s*\)?\s*:)[^\n]*\n?)+/im;
  plain = plain.replace(headerPattern, '');
  // Remove bloco "Advogados:" ou "Destinatário(s):" com nomes em sequência (sem OAB)
  plain = plain.replace(/(?:Advogados?|Destinat[áa]rio\s*\(?\s*s?\s*\)?)\s*:\s*\n(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n]*\n?){1,10}/i, '');
  // Remove bloco "Parte(s):" com nomes em sequência (injetado por buildDjenLikeConteudo)
  plain = plain.replace(/Parte\s*\(?\s*s?\s*\)?\s*:?\s*\n(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n]*\n?){1,30}/i, '');
  return plain.trim() || texto;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function PublicacaoConteudoDjen({
  processoNumero,
  tribunal,
  fonte,
  dataDisponibilizacao,
  dataPublicacao,
  conteudo,
  poloAtivo,
  poloPassivo,
  monitoramentoOab,
  monitoramentoUf,
  monitoramentoTermo,
  monitoramentoDescricao,
  className,
  maxHeight,
  orgaoEstruturado,
  tipoComunicacaoEstruturado,
  meioEstruturado,
  partesJson,
  advogadosJson,
  expandirGeralExterno,
}: PublicacaoConteudoDjenProps) {
  // Usar dados estruturados com fallback para regex
  const contentMeta = extractMetadataFromContent(conteudo);

  const orgao = orgaoEstruturado || contentMeta.orgaoExtraido || fonte || tribunal || "-";
  const tipoComunicacao = tipoComunicacaoEstruturado || contentMeta.tipoComunicacao || "Intimação";
  const meioPublicacao = expandMeio(meioEstruturado || contentMeta.meio);

  const { partes: partesFinais, advogados } = getPartesEAdvogadosParaExibicao(
    partesJson, advogadosJson, conteudo, poloAtivo, poloPassivo
  );

  // Conteúdo limpo (sem cabeçalhos de metadados duplicados)
  const conteudoLimpo = stripMetadataFromContent(conteudo);

  const [expandirGeralLocal, setExpandirGeralLocal] = useState(false);
  const expandirGeral = expandirGeralExterno ?? expandirGeralLocal;
  const controleLocal = expandirGeralExterno === undefined;

  const handleCopy = (withFormatting: boolean) => {
    const text = withFormatting
      ? conteudo || ""
      : conteudo?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "";
    navigator.clipboard.writeText(text);
    toast.success(withFormatting ? "Copiado com formatação" : "Copiado sem formatação");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Publicação ${processoNumero || ""}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12pt; }
            h1 { font-size: 14pt; color: #1e40af; margin-bottom: 20px; }
            .meta { margin-bottom: 20px; line-height: 1.8; }
            .meta strong { color: #374151; }
            .conteudo { border-top: 1px solid #e5e7eb; padding-top: 20px; line-height: 1.6; }
            .partes { margin: 15px 0; }
            .partes li { list-style: none; padding: 5px 0; }
          </style>
        </head>
        <body>
          <h1>Processo ${processoNumero || "-"}</h1>
          <div class="meta">
            <p><strong>Órgão:</strong> ${orgao}</p>
            <p><strong>Data de disponibilização:</strong> ${formatDate(dataDisponibilizacao)}</p>
            <p><strong>Tipo de comunicação:</strong> ${tipoComunicacao}</p>
            <p><strong>Meio:</strong> ${meioPublicacao}</p>
          </div>
          ${partesFinais.length > 0 ? `<div class="partes"><strong>Parte(s):</strong><ul>${partesFinais.map((p) => `<li>${p}</li>`).join("")}</ul></div>` : ""}
          ${advogados.length > 0 ? `<div class="partes"><strong>Advogado(s):</strong><ul>${advogados.map((a) => `<li>${a}</li>`).join("")}</ul></div>` : ""}
          <div class="conteudo">${conteudo || ""}</div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className={cn("space-y-0", className)}>
      {/* Cabeçalho no estilo DJEN: número do processo à esquerda (azul), botões à direita */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
        <h2 className="text-base md:text-lg font-semibold text-primary shrink-0">
          Processo {formatProcessoNumero(processoNumero)}
        </h2>
        <div className="flex items-center gap-1.5">
          {controleLocal && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandirGeralLocal((e) => !e)}
              className="text-xs h-8"
              title={expandirGeral ? "Recolher publicação" : "Mostrar publicação completa sem scroll"}
            >
              {expandirGeral ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 mr-1.5" />
                  Recolher
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
                  Expandir Geral
                </>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs h-8">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleCopy(true)} className="text-xs h-8">
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copiar
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleCopy(false)} className="text-xs h-8">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Copiar sem formatação
          </Button>
        </div>
      </div>

      {/* Layout igual ao DJEN: coluna esquerda = metadados; coluna direita = inteiro teor */}
      <div
        className={cn(
          "flex flex-col lg:flex-row gap-0",
          !expandirGeral && "overflow-hidden"
        )}
        style={!expandirGeral && maxHeight ? { maxHeight } : undefined}
      >
        {/* Coluna esquerda – Órgão, Data de disponibilização, Tipo de comunicação, Meio, Inteiro teor, Parte(s), Advogado(s) */}
        <aside
          className={cn(
            "lg:w-[300px] xl:w-[340px] shrink-0 lg:border-r border-border bg-muted/20 p-4 space-y-3 text-sm",
            !expandirGeral && "lg:overflow-y-auto"
          )}
        >
          <div>
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Órgão</p>
            <p className="font-medium break-words">{orgao}</p>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Data de disponibilização</p>
            <p>{formatDate(dataDisponibilizacao)}</p>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Tipo de comunicação</p>
            <p>{tipoComunicacao}</p>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Meio</p>
            <p>{meioPublicacao}</p>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Inteiro teor</p>
            <a
              href={`https://comunicaapi.pje.jus.br/v1/comunicacoes/${processoNumero || ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Clique aqui
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Parte(s) – exatamente como no portal DJEN */}
          <div>
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1.5">Parte(s)</p>
            {partesFinais.length > 0 ? (
              <ul className="space-y-1.5">
                {partesFinais.map((parte, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="break-words">{parte}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4 shrink-0" />
                —
              </p>
            )}
          </div>

          {/* Advogado(s) – sempre visível na coluna esquerda (estilo DJEN) */}
          <div>
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1.5">Advogado(s)</p>
            {advogados.length > 0 ? (
              <ul className="space-y-1.5">
                {advogados.map((adv, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="break-words">{adv}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4 shrink-0" />
                —
              </p>
            )}
          </div>
        </aside>

        {/* Coluna direita – Inteiro teor (texto completo) */}
        <main
          className={cn(
            "flex-1 min-w-0 p-4",
            !expandirGeral && "lg:overflow-y-auto"
          )}
        >
          <div
            className={cn(
              "p-4 bg-background rounded-md border text-sm leading-relaxed",
              conteudoDisplayClasses
            )}
          >
            {formatConteudoParaExibicao(conteudoLimpo, true)}
          </div>
        </main>
      </div>
    </div>
  );
}
