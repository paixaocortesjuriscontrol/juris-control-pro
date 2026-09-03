import { createHash } from "node:crypto";

// build: prd-publish
function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// Decodifica entidades HTML comuns e remove tags, deixando texto plano legível.
function sanitizeConteudoKurier(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw);
  const named: Record<string, string> = {
    nbsp: " ", amp: " & ", lt: "<", gt: ">", quot: '"', apos: "'",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
    Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
    atilde: "ã", otilde: "õ", ntilde: "ñ", Atilde: "Ã", Otilde: "Õ", Ntilde: "Ñ",
    acirc: "â", ecirc: "ê", icirc: "î", ocirc: "ô", ucirc: "û",
    Acirc: "Â", Ecirc: "Ê", Icirc: "Î", Ocirc: "Ô", Ucirc: "Û",
    agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù",
    Agrave: "À", Egrave: "È", Igrave: "Ì", Ograve: "Ò", Ugrave: "Ù",
    ccedil: "ç", Ccedil: "Ç", ordm: "º", ordf: "ª", deg: "°",
    middot: "·", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
    lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  };
  const decodeLoose = (value: string) => value
    // Kurier/TJSP chega muitas vezes com entidade sem ponto-e-vírgula e quebrada
    // por \n: "R&Eacute\nU", "&ccedil\n&atilde\no".
    .replace(/&([A-Za-z][A-Za-z0-9]+)\s*;?/g, (full, name) => name in named ? named[name] : full)
    .replace(/&#(\d+);?/g, (_, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)); } catch { return " "; }
    })
    .replace(/&#[xX]([0-9a-fA-F]+);?/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return " "; }
    });

  s = decodeLoose(s);
  // Remove blocos não-texto inteiros
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ")
       .replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Quebras de linha a partir de tags de bloco
  s = s.replace(/<\s*(br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/section|\/article|\/header|\/footer)\s*\/?>/gi, "\n");
  s = s.replace(/<\s*\/td\s*>\s*<\s*td[^>]*>/gi, ": ");
  // Tabular: célula vira espaço
  s = s.replace(/<\s*\/?(td|th)[^>]*>/gi, " ");
  // Remove todas as demais tags
  s = s.replace(/<\/?[a-z][^>]*>/gi, " ");
  // Decodifica entidades nomeadas e numéricas
  s = decodeLoose(s);
  // Colapsa espaços
  s = s.replace(/:\s*:/g, ":").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return s;
}

function extractKurierIdDjen(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const text = String(value || "");
    if (!text) continue;
    const match = text.match(/\bID\s*COMUNICA[ÇC][AÃ]O\s*[:\-]?\s*(\d{6,})\b/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

type KurierParteParsed = { papel: string; nome: string };

const KURIER_PARTY_LABELS = [
  "RELATOR(?:A)?", "EMBARGANTE", "EMBARGADO", "RECORRENTE", "RECORRIDO",
  "AGRAVANTE", "AGRAVADO", "RECLAMANTE", "RECLAMADO", "AUTOR(?:A)?", "R[ÉE]U",
  "IMPETRANTE", "IMPETRADO", "REQUERENTE", "REQUERIDO", "EXEQUENTE", "EXECUTADO",
  "APELANTE", "APELADO", "INTERESSADO", "ADVOGADOS?",
];

const KURIER_BODY_OPENERS = [
  "D\\s+E\\s+C\\s+I\\s+S\\s+[ÃA]\\s+O", "DECISÃO", "DESPACHO", "SENTENÇA", "ACÓRDÃO", "EMENTA", "RELATÓRIO", "VOTO",
];

function capitalizePapel(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function cleanKurierSegmentName(value: string): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[:\-–—\s]+/, "")
    .replace(/\s+[A-Z]{2,10}\/[A-Z]{2,10}.*$/i, "")
    .replace(/\s+(?:DECISÃO|D\s+E\s+C\s+I\s+S\s+[ÃA]\s+O|DESPACHO|SENTENÇA|ACÓRDÃO)\b.*$/i, "")
    .trim();
}

function isKurierNoiseName(value: string): boolean {
  const v = cleanKurierSegmentName(value);
  if (!v || v.length < 3 || v.length > 160) return true;
  if (/^[A-Z]{2,10}\/[A-Z]{2,10}$/i.test(v)) return true;
  if (/^(TEXTO|PROCESSO|TRIBUNAL|MEIO|ORG[ÃA]O)$/i.test(v)) return true;
  return false;
}

function normalizeKurierInteiroTeor(value: string): string {
  return String(value || "")
    .replace(/\s+((?:Agravante|Agravado|Recorrente|Recorrido|Reclamante|Reclamado|Autor|Autora|Réu|Exequente|Executado|Embargante|Embargado|Apelante|Apelado|Interessado)\s*:)/gi, "\n$1")
    .replace(/\s+(ADVOGADO\s*:)/gi, "\n$1")
    .replace(/\b(D\s+E\s+C\s+I\s+S\s+[ÃA]\s+O)\b/gi, "\n\n$1\n\n")
    .replace(/\s+(PRESSUPOSTOS\s+INTR[ÍI]NSECOS|CONCLUS[ÃA]O|Publique-se\.|Bras[íi]lia,)/gi, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitKurierSlashList(value: string): string[] {
  return String(value || "")
    .split(/\s*\/\s*/g)
    .map((item) => item.replace(/\s+/g, " ").replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim())
    .filter((item) => item.length >= 3 && !/^(?:-|OAB\s+advogado)$/i.test(item));
}

function extractKurierCompactPartesAdvogados(texto: string): { partes: string[]; advogados: string[] } {
  const plain = String(texto || "").replace(/\s+/g, " ").trim();
  const partes: string[] = [];
  const advogados: string[] = [];
  const seenPartes = new Set<string>();
  const seenAdvs = new Set<string>();

  const addParte = (papel: string, nome: string) => {
    const clean = nome.replace(/\s+/g, " ").replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim();
    if (!clean || clean.length < 3) return;
    const key = `${papel}|${clean}`.toUpperCase();
    if (seenPartes.has(key)) return;
    seenPartes.add(key);
    partes.push(`[${papel}] ${clean}`);
  };

  const addAdv = (nome: string) => {
    const clean = nome.replace(/\s+/g, " ").replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim();
    if (!clean || clean.length < 3 || /^OAB\s+advogado$/i.test(clean)) return;
    const key = clean.toUpperCase();
    if (seenAdvs.has(key)) return;
    seenAdvs.add(key);
    advogados.push(clean);
  };

  const poloAtivo = plain.match(/\bPolo\s+Ativo\s+([\s\S]*?)(?=\s+Polo\s+Passivo\b|\s+Parte\s+intima[çc][ãa]o\b|\s+Advogados?\s+polo\b|\s+Data\s+e\s+hora\b|\s+Identificador\s+do\s+documento\b|$)/i)?.[1];
  if (poloAtivo) splitKurierSlashList(poloAtivo).forEach((nome) => addParte("Polo Ativo", nome));

  const poloPassivo = plain.match(/\bPolo\s+Passivo\s+([\s\S]*?)(?=\s+Parte\s+intima[çc][ãa]o\b|\s+Advogados?\s+polo\b|\s+Data\s+e\s+hora\b|\s+Identificador\s+do\s+documento\b|$)/i)?.[1];
  if (poloPassivo) splitKurierSlashList(poloPassivo).forEach((nome) => addParte("Polo Passivo", nome));

  const parteIntimacao = plain.match(/\bParte\s+intima[çc][ãa]o\s+([\s\S]*?)(?=\s+Advogado\s+intima[çc][ãa]o\b|\s+Advogados?\s+polo\b|\s+Data\s+e\s+hora\b|\s+Identificador\s+do\s+documento\b|$)/i)?.[1];
  if (parteIntimacao) splitKurierSlashList(parteIntimacao).forEach((nome) => addParte("Parte intimação", nome));

  const advAtivo = plain.match(/\bAdvogados?\s+polo\s+ativo\s+([\s\S]*?)(?=\s+Advogados?\s+polo\s+passivo\b|\s+Data\s+e\s+hora\b|\s+Identificador\s+do\s+documento\b|\s+Classe\s+do\s+Processo\b|\s+Assunto\b|\s+[ÓO]rg[ãa]o\s+Julgado\b|\s+Prazo\b|\s+Data\s+Limite\b|$)/i)?.[1];
  if (advAtivo) splitKurierSlashList(advAtivo).forEach(addAdv);

  const advPassivo = plain.match(/\bAdvogados?\s+polo\s+passivo\s+([\s\S]*?)(?=\s+Data\s+e\s+hora\b|\s+Identificador\s+do\s+documento\b|\s+Classe\s+do\s+Processo\b|\s+Assunto\b|\s+[ÓO]rg[ãa]o\s+Julgado\b|\s+Prazo\b|\s+Data\s+Limite\b|$)/i)?.[1];
  if (advPassivo) splitKurierSlashList(advPassivo).forEach(addAdv);

  // ---- TJMG / DJMG blob: "Requerente <X>; Requerido(A) <Y>. Adv - <a1>, <a2>, ... = <decisão>"
  // Também aceita "Representante", "Autor", "Recorrente", etc.
  const PAPEIS_TJMG = "Requerente|Requerido(?:\\s*\\(\\s*[AaOo]\\s*\\))?|Representante|Autor(?:a)?|R[ée]u|Recorrente|Recorrido|Executado|Exequente|Interessado|Impetrante|Impetrado|Reclamante|Reclamado|Agravante|Agravado|Apelante|Apelado|Embargante|Embargado";
  const advTjmgMatches = plain.match(/(?:^|[\s.])Adv\s*[-–]\s*([^=]+?)(?=\s*=\s|$)/gi);
  if (advTjmgMatches) {
    // Bloco de partes: da última ocorrência de papel antes de " Adv - " até o " Adv - "
    const advIdx = plain.search(/(?:^|[\s.])Adv\s*[-–]\s+/i);
    if (advIdx > 0) {
      const beforeAdv = plain.slice(0, advIdx);
      const partesRe = new RegExp(`\\b(${PAPEIS_TJMG})\\b\\s+([^;.=]+?)(?=\\s*[;.]|\\s+Adv\\s*[-–]|$)`, "gi");
      let pm: RegExpExecArray | null;
      while ((pm = partesRe.exec(beforeAdv)) !== null) {
        const papelRaw = pm[1].replace(/\s+/g, " ").trim();
        const nome = pm[2].replace(/\s+e\s+outros?(?:\s*\(as\))?$/i, "").trim();
        if (nome && nome.length >= 3 && nome.length <= 200) {
          addParte(capitalizePapel(papelRaw), nome);
        }
      }
    }
    for (const block of advTjmgMatches) {
      const advBody = block.replace(/^(?:.*?)Adv\s*[-–]\s*/i, "");
      advBody.split(/\s*,\s*/g).forEach((nome) => {
        const clean = nome.replace(/\s*=.*$/, "").trim();
        if (clean) addAdv(clean);
      });
    }
  }

  // ---- TJDFT_DJEN blob: "PARTES NOME<Nome> POLO<letra> ID COMUNICAÇÃO... ADVOGADOS NOME<Nome> Nº OAB<num> UF<uf>"
  // Pode ter múltiplos "NOME" seguidos em cada seção.
  const partesBlockTjdft = plain.match(/\bPARTES\s+((?:NOME[\s\S]*?)+?)(?=\s+ADVOGADOS?\b|\s+ID\s+COMUNICA|$)/i)?.[1];
  if (partesBlockTjdft) {
    const re = /NOME([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s'.]{2,120}?)(?=\s+(?:POLO|NOME|ID\s+COMUNICA|Nº\s*OAB)\b|$)/gi;
    let pm: RegExpExecArray | null;
    while ((pm = re.exec(partesBlockTjdft)) !== null) {
      addParte("Parte", pm[1].trim());
    }
  }
  const advBlockTjdft = plain.match(/\bADVOGADOS?\s+((?:NOME[\s\S]*?)+)$/i)?.[1];
  if (advBlockTjdft) {
    const re = /NOME([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s'.]{2,120}?)\s+Nº\s*OAB\s*(\d{2,7})\s+UF\s*([A-Z]{2})/gi;
    let am: RegExpExecArray | null;
    let anyOab = false;
    while ((am = re.exec(advBlockTjdft)) !== null) {
      anyOab = true;
      addAdv(`${am[1].trim()} - OAB ${am[3]}-${am[2]}`);
    }
    if (!anyOab) {
      const re2 = /NOME([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s'.]{2,120}?)(?=\s+(?:NOME|Nº\s*OAB|POLO)\b|$)/gi;
      let am2: RegExpExecArray | null;
      while ((am2 = re2.exec(advBlockTjdft)) !== null) addAdv(am2[1].trim());
    }
  }

  return { partes, advogados };
}

function parseKurierBlobForStorage(conteudo: string): { partes: string[]; advogados: string[]; conteudoNormalizado: string | null } {
  const texto = String(conteudo || "").trim();
  const compact = extractKurierCompactPartesAdvogados(texto);
  const isBlob =
    !/<\s*(html|table|tr|td|p|div|br)\b/i.test(texto) &&
    (/\bDATA\s+DE\s+DISPONIBILIZAÇÃO\d{4}-\d{1,2}-\d{1,2}/i.test(texto) ||
      /\bTIPO\s+DE\s+COMUNICAÇÃO[A-ZÀ-Ÿa-zà-ÿ]/.test(texto) ||
      (/\bORG[ÃA]O[A-ZÀ-Ÿ]/.test(texto) && /\bMEIO[A-ZÀ-Ÿ]/.test(texto)) ||
      /\bTRIBUNAL[A-Z]{2,5}\s+(?:DESPACHO|TEXTO|DECISÃO|SENTENÇA|ACÓRDÃO|RECURSO)/i.test(texto));
  if (!isBlob) return { ...compact, conteudoNormalizado: null };

  const textoIdx = texto.search(/\bTEXTO(?=[A-ZÀ-Ÿ"'(\[])/);
  let miolo = textoIdx >= 0 ? texto.slice(textoIdx).replace(/^TEXTO/, "").trim() : texto;
  const partes: KurierParteParsed[] = [];
  const advogados: string[] = [];
  let inteiroTeor = miolo;

  if (miolo) {
    const bodyRe = new RegExp(`\\s(?:${KURIER_BODY_OPENERS.join("|")})\\b`, "i");
    const bodyMatch = miolo.match(bodyRe);
    let estrutBlock = miolo;
    if (bodyMatch && bodyMatch.index !== undefined) {
      estrutBlock = miolo.slice(0, bodyMatch.index);
      inteiroTeor = miolo.slice(bodyMatch.index + 1);
    } else {
      estrutBlock = "";
    }

    if (estrutBlock) {
      const labelsAlt = KURIER_PARTY_LABELS.join("|");
      const segRe = new RegExp(`\\b(${labelsAlt})\\b\\s+([\\s\\S]*?)(?=\\s+\\b(?:${labelsAlt})\\b|$)`, "gi");
      let m: RegExpExecArray | null;
      while ((m = segRe.exec(estrutBlock)) !== null) {
        const rawLabel = m[1].toUpperCase();
        const rawValue = m[2].trim().replace(/\s+/g, " ");
        if (!rawValue) continue;
        if (/^ADVOGADOS?$/.test(rawLabel)) {
          const advRe = /([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç.\s']+?)\s*[-–]\s*([A-Z]{2})(\d{3,7}[A-Z]?)/g;
          let am: RegExpExecArray | null;
          let foundOab = false;
          while ((am = advRe.exec(rawValue)) !== null) {
            const nome = cleanKurierSegmentName(am[1]);
            const uf = am[2];
            const num = am[3];
            if (nome.length >= 4) {
              foundOab = true;
              advogados.push(`${nome} - OAB ${uf}-${num}`);
            }
          }
          if (!foundOab) {
            const nome = cleanKurierSegmentName(rawValue);
            if (!isKurierNoiseName(nome)) advogados.push(nome);
          }
        } else {
          const nome = cleanKurierSegmentName(rawValue);
          if (!isKurierNoiseName(nome)) partes.push({ papel: capitalizePapel(rawLabel), nome });
        }
      }
    }
  }

  return {
    partes: compact.partes.length ? compact.partes : partes.map((p) => `[${p.papel}] ${p.nome}`),
    advogados: compact.advogados.length ? compact.advogados : advogados,
    conteudoNormalizado: normalizeKurierInteiroTeor(inteiroTeor) || null,
  };
}

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildKurierAuthHeaders,
  buildKurierUrl,
  corsHeaders,
  decryptKurier,
  getKurierBaseUrlFromDb,
  jsonResponse,
} from "../_kurier-shared/crypto.ts";
import {
  condicaoConcomitanteAtendida,
  extrairPalavraChavePura,
  normalizar,
  shouldExclude,
  type Monitoramento,
} from "../_kurier-shared/djenMatch.ts";
import { tribunalPermitidoKurier } from "../_kurier-shared/tribunalSigla.ts";

// Consome publicações pendentes de UMA credencial Kurier em lotes de 50.
// Persiste em kurier_publicacoes_raw (idempotente por id_kurier) e em
// publicacoes_djen (origem='kurier'). Confirma o lote para tirar da fila.
//
// Body: { credencial_id: uuid, max_lotes?: number (default 1) }

interface KurierPub {
  id?: string | number;
  Id?: string | number;
  idPublicacao?: string | number;
  numero_processo?: string;
  NumeroProcesso?: string;
  conteudo?: string;
  Conteudo?: string;
  data_disponibilizacao?: string;
  DataDisponibilizacao?: string;
  data_publicacao?: string;
  DataPublicacao?: string;
  tribunal?: string;
  Tribunal?: string;
  diario?: string;
  Diario?: string;
  termo?: string;
  Termo?: string;
  [k: string]: any;
}

function pickId(p: KurierPub): string | null {
  const raw =
    p.id ?? p.Id ??
    (p as any).idPublicacao ?? (p as any).IdPublicacao ??
    (p as any).idProcesso ?? (p as any).IdProcesso ?? (p as any).IDProcesso ??
    (p as any).IDPublicacao ?? (p as any).id_publicacao ?? (p as any).ID_PUBLICACAO ??
    (p as any).N_RECORTE ?? (p as any).n_recorte ?? (p as any).Recorte ?? (p as any).recorte ??
    (p as any).codigoPublicacao ?? (p as any).CodigoPublicacao ??
    (p as any).codPublicacao ?? (p as any).CodPublicacao ??
    (p as any).cdPublicacao ?? (p as any).CdPublicacao ??
    (p as any).codigo ?? (p as any).Codigo ??
    (p as any).idDocumento ?? (p as any).IdDocumento ??
    (p as any).cdDocumento ?? (p as any).CdDocumento ??
    (p as any).codigoDocumento ?? (p as any).CodigoDocumento ??
    (p as any).numeroDocumento ?? (p as any).NumeroDocumento ??
    (p as any).protocolo ?? (p as any).Protocolo ??
    (p as any).hash ?? (p as any).Hash ??
    (p as any).guid ?? (p as any).Guid;
  if (raw === undefined || raw === null || raw === "") return null;
  return String(raw);
}

function pickStr(p: KurierPub, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = (p as any)[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function pickInt(p: KurierPub, ...keys: string[]): number | null {
  const raw = pickStr(p, ...keys);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function buildConfirmacaoKurier(p: KurierPub): Record<string, number | string> | null {
  const IdProcesso = pickInt(p, "IdProcesso", "idProcesso", "IDProcesso");
  const CodigoTermoPesquisa = pickInt(p, "CodigoTermoPesquisa", "codigoTermoPesquisa");
  const CodigoDiario = pickInt(p, "CodigoDiario", "codigoDiario");
  const CodigoDivisaoDiario = pickInt(p, "CodigoDivisaoDiario", "codigoDivisaoDiario");
  const DataDiario = pickStr(p, "DataDiario", "dataDiario");
  if (IdProcesso && CodigoTermoPesquisa && CodigoDiario && CodigoDivisaoDiario && DataDiario) {
    return { IdProcesso, CodigoTermoPesquisa, CodigoDiario, CodigoDivisaoDiario, DataDiario };
  }
  // Fallback tolerante: o endpoint ConfirmarPublicacoes da Kurier aceita
  // confirmação por IdPublicacao quando os 5 campos estruturados não vêm
  // completos. Sem isso, o item fica preso na fila e bloqueia os novos.
  const IdPublicacao = pickInt(p, "IdPublicacao", "idPublicacao", "IDPublicacao", "id", "Id");
  if (IdPublicacao) {
    return { IdPublicacao };
  }
  return null;
}

function normalizedKey(k: string): string {
  return String(k || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function pickDeep(p: unknown, keys: string[], maxDepth = 4): string | null {
  const targets = new Set(keys.map(normalizedKey));
  const seen = new Set<unknown>();
  const walk = (value: unknown, depth: number): string | null => {
    if (!value || typeof value !== "object" || depth > maxDepth || seen.has(value)) return null;
    seen.add(value);
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (targets.has(normalizedKey(k)) && v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          const found = walk(item, depth + 1);
          if (found) return found;
        }
      } else {
        const found = walk(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(p, 0);
}

function collectSearchableText(value: unknown, maxDepth = 5): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number) => {
    if (v === null || v === undefined || depth > maxDepth) return;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      const s = String(v).trim();
      if (s) parts.push(s);
      return;
    }
    if (typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) for (const item of v) walk(item, depth + 1);
    else for (const [k, item] of Object.entries(v as Record<string, unknown>)) {
      parts.push(k);
      walk(item, depth + 1);
    }
  };
  walk(value, 0);
  return parts.join("\n");
}

function extractProcessoFromText(texto: string): string | null {
  const m = texto.match(/\d{7}[-.\s]?\d{2}[-.\s]?\d{4}[-.\s]?\d[-.\s]?\d{2}[-.\s]?\d{4}/);
  return m ? m[0] : null;
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const s = value.trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}${br[4] ? `T${br[4]}` : "T12:00:00"}.000Z`;
  const dashBr = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (dashBr) return `${dashBr[3]}-${dashBr[2].padStart(2, "0")}-${dashBr[1].padStart(2, "0")}${dashBr[4] ? `T${dashBr[4]}` : "T12:00:00"}.000Z`;
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}${ymd[4] ? `T${ymd[4]}` : "T12:00:00"}.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function hojeLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function extractDateFromText(texto: string, labels: RegExp[]): string | null {
  for (const label of labels) {
    const after = texto.match(label);
    if (!after?.[1]) continue;
    const iso = toIsoDate(after[1].trim());
    if (iso) return iso;
  }
  return null;
}

function containsPhraseOrAnd(searchNorm: string, termo: string | null | undefined): boolean {
  const raw = String(termo || "").trim();
  if (!raw) return false;
  const parts = raw.split("+").map((p) => normalizar(extrairPalavraChavePura(p.trim()))).filter(Boolean);
  if (!parts.length) return false;
  return parts.every((part) => new RegExp(`(?:^|\\s)${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`).test(searchNorm));
}

function termoTokens(raw: string | null | undefined): string[] {
  const norm = normalizar(extrairPalavraChavePura(String(raw || "").trim()));
  return Array.from(new Set(norm.split(/\s+/).filter((t) => t.length >= 3)));
}

function kurierMatchesMonitoramento(searchable: string, monitoramento: Monitoramento): boolean {
  const searchNorm = normalizar(searchable);
  const searchDigits = searchable.replace(/\D/g, "");
  const tipo = monitoramento.tipo;
  const termos = [monitoramento.termo_busca, ...(monitoramento.termos_or || [])].filter(Boolean);

  let ok = false;
  if (tipo === "processo") {
    ok = termos.some((t) => {
      const digits = String(t || "").replace(/\D/g, "");
      return digits ? searchDigits.includes(digits) : containsPhraseOrAnd(searchNorm, t);
    });
  } else if (tipo === "advogado") {
    const oabDigits = String(monitoramento.oab || "").replace(/\D/g, "");
    ok = termos.some((t) => containsPhraseOrAnd(searchNorm, t)) || (!!oabDigits && searchDigits.includes(oabDigits));
  } else {
    // Kurier não traz o mesmo bloco estruturado do DJEN; para parte/palavra-chave,
    // validamos no payload inteiro recebido da Kurier.
    ok = termos.some((t) => containsPhraseOrAnd(searchNorm, t));
  }

  if (!ok) return false;
  return condicaoConcomitanteAtendida(searchable, monitoramento.condicao_concomitante);
}

function extractPublicacoes(payload: any): KurierPub[] {
  if (Array.isArray(payload)) return payload;
  const keys = ["publicacoes", "Publicacoes", "PUBLICACOES", "items", "Itens", "data", "Data", "dados", "Dados", "resultado", "Resultado", "results"];
  for (const k of keys) if (Array.isArray(payload?.[k])) return payload[k];
  for (const v of Object.values(payload || {})) if (Array.isArray(v)) return v as KurierPub[];
  return [];
}

function normalizeProcesso(n: string | null): string | null {
  if (!n) return null;
  const digits = n.replace(/\D/g, "");
  return digits.length >= 15 ? digits : n;
}

const LOTE_SIZE = 50;
const DEFAULT_PROCESSING_BATCH_SIZE = 25;
const MIN_PROCESSING_BATCH_SIZE = 10;
const MAX_PUBS_PER_CALL = 20;
const DELAY_MS = 150;
const MAX_LOTES_PER_CALL = 20;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const token = authHeader.slice("Bearer ".length);
    const isServiceInvocation = token === (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    if (!isServiceInvocation) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      // Valida o JWT localmente (getClaims) em vez de chamar o GoTrue (getUser),
      // que devolve 401 quando a sessão foi revogada no servidor mas o token
      // ainda é assinaturalmente válido.
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      const userId = claimsData?.claims?.sub as string | undefined;
      if (claimsErr || !userId) return jsonResponse({ error: "Unauthorized" }, 401);

      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "coordenador" || r.role === "assistente_coordenador");
      if (!allowed) return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({} as any));
    // expõe o body para o catch externo conseguir logar qual credencial estourou
    try { (globalThis as any).__lastKurierBody = body; } catch {}
    const credencial_id: string | undefined = body.credencial_id;
    // Edge Functions têm orçamento curto de CPU/tempo; cada chamada processa só 1 lote
    // e o frontend faz novas chamadas pequenas até esvaziar a fila da credencial.
    const max_lotes: number = Math.min(MAX_LOTES_PER_CALL, Math.max(1, Number(body.max_lotes ?? 1)));
    // A API Kurier pode devolver 50 itens com textos integrais. Processar somente
    // uma fatia por invocação reduz o pico de CPU/memória; os demais continuam na
    // fila porque apenas os itens processados são confirmados.
    const lote_size: number = Math.min(
      LOTE_SIZE,
      Math.max(MIN_PROCESSING_BATCH_SIZE, Number(body.lote_size ?? DEFAULT_PROCESSING_BATCH_SIZE)),
    );
    const monitoramento_ids: string[] | undefined = Array.isArray(body.monitoramento_ids)
      ? body.monitoramento_ids.filter((x: any) => typeof x === "string" && x)
      : undefined;
    const coordenacao_id: string | undefined = typeof body.coordenacao_id === "string" && body.coordenacao_id
      ? body.coordenacao_id : undefined;
    const data_inicio_body: string | undefined = typeof body.data_inicio === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.data_inicio)
      ? body.data_inicio : undefined;
    const data_fim_body: string | undefined = typeof body.data_fim === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.data_fim)
      ? body.data_fim : undefined;
    const hojeYmd = hojeLocalYmd();
    const data_inicio = data_inicio_body ?? hojeYmd;
    const data_fim = data_fim_body ?? hojeYmd;
    const modo_personalizado = body.modo_personalizado === true;
    // Execução do dia (DJEN Local). Quando informada, gravamos `execucao_id` em
    // cada publicação inserida e registramos a junção em
    // `publicacoes_djen_execucoes` para a tela "Análise DJEN" mostrar as
    // diferenças entre execuções do mesmo dia.
    const execucao_id_local: string | undefined =
      typeof body.execucao_id === "string" && body.execucao_id ? body.execucao_id : undefined;
    // Modo backfill: em vez de consultar a fila Kurier, reprocessa payloads
    // já gravados em kurier_publicacoes_raw com um determinado motivo_descarte.
    // Útil para recuperar itens que foram confirmados na Kurier (saíram da fila)
    // mas descartados localmente por filtro antigo. NÃO confirma nada na Kurier.
    const backfill_raw: boolean = body.backfill_raw === true;
    const backfill_motivo: string = typeof body.backfill_motivo === "string" && body.backfill_motivo
      ? body.backfill_motivo : "fora_janela_disp_antes";
    const backfill_date: string | undefined = typeof body.backfill_date === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(body.backfill_date)
      ? body.backfill_date : undefined;
    // Kurier sempre persiste em publicacoes_djen (tabela canônica da
    // Análise DJEN). O parâmetro persist_mode é ignorado de propósito para
    // não furar dedup/leituras/alertas que dependem desta tabela.
    const persistMode: "browser" = "browser";
    const pubTable = "publicacoes_djen";
    if (!credencial_id) return jsonResponse({ error: "credencial_id obrigatório" }, 400);

    const { data: cred, error: credErr } = await admin
      .from("kurier_credenciais")
      .select("id, login, senha_encrypted, ativo")
      .eq("id", credencial_id)
      .maybeSingle();
    if (credErr || !cred) return jsonResponse({ error: "Credencial não encontrada" }, 404);
    if (!cred.senha_encrypted) return jsonResponse({ error: "Credencial sem senha" }, 400);
    console.log("[kurier-consultar-publicacoes] START", {
      credencial_id: cred.id, login: cred.login,
      data_inicio, data_fim, max_lotes, modo_personalizado, backfill_raw,
    });
    try { (globalThis as any).__lastKurierLogin = cred.login; } catch {}

    const senha = await decryptKurier(cred.senha_encrypted);
    const baseUrl = await getKurierBaseUrlFromDb(admin);

    // CRÍTICO: respeitar o vínculo credencial → coordenações. Cada login Kurier só
    // pode gerar publicações para as coordenações configuradas para ele em
    // kurier_credencial_coordenacoes — senão um login do Santander acaba populando
    // a coordenação do Dr. Thomás (e vice-versa). Carregamos o vínculo ANTES dos
    // monitoramentos para filtrar a query de monitoramentos por coordenação.
    const { data: vincCt, error: vincCtErr } = await admin
      .from("kurier_credencial_coordenacoes")
      .select("coordenacao_id, somente_kurier_only, somente_djen_only")
      .eq("credencial_id", cred.id);
    if (vincCtErr) console.warn("[kurier] erro carregar vínculos credencial→coord:", vincCtErr.message);
    const coordIdsDaCredencial = new Set<string>((vincCt ?? []).map((v: any) => v.coordenacao_id));
    const coordIdsArr = Array.from(coordIdsDaCredencial);
    // Coords com flag "Só termos Kurier" ligada PARA ESTA CREDENCIAL:
    // a busca no Kurier continua trazendo o dia inteiro, mas esta credencial só
    // pode inserir na coordenação publicações que casem com termos marcados
    // como monitoramentos_djen.somente_kurier=true.
    const coordsSoKurier = new Set<string>(
      (vincCt ?? []).filter((v: any) => v.somente_kurier_only).map((v: any) => v.coordenacao_id),
    );
    // Coords com flag "Termos DJEN" ligada PARA ESTA CREDENCIAL:
    // inverso de "Só Kurier" — só aceitam publicações que casem com
    // monitoramentos comuns (somente_kurier != true), os Termos DJEN cadastrados.
    const coordsTermosDjenOnly = new Set<string>(
      (vincCt ?? []).filter((v: any) => v.somente_djen_only).map((v: any) => v.coordenacao_id),
    );

    // Carrega monitoramentos ativos para aplicar os termos do DJEN nas publicações
    // recebidas via Kurier. Sem monitoramento que case, a publicação é descartada
    // (consumida na fila, mas não persistida em publicacoes_djen).
    // ISOLAMENTO POR COORDENAÇÃO: só aceitamos monitoramentos cujo coordenacao_id
    // esteja entre as coordenações vinculadas à credencial. Se a credencial não
    // tem nenhuma coordenação vinculada, NÃO carregamos nenhum monitoramento —
    // isso evita que uma credencial sem vínculo grave publicações em coords
    // alheias por coincidência de termo.
    let monitoramentos: (Monitoramento & { coordenacao_id?: string | null; somente_kurier?: boolean | null })[] = [];
    if (coordIdsArr.length > 0) {
      let monitQuery = admin
        .from("monitoramentos_djen")
        .select("id, tipo, termo_busca, oab, uf, exclusoes, condicao_concomitante, termos_or, descricao, buscar_parte, coordenacao_id, criado_por, somente_kurier, tribunais")
        .eq("ativo", true)
        .in("coordenacao_id", coordIdsArr);
      if (monitoramento_ids?.length) monitQuery = monitQuery.in("id", monitoramento_ids);
      if (coordenacao_id) {
        if (!coordIdsDaCredencial.has(coordenacao_id)) {
          console.warn(`[kurier] coordenacao_id ${coordenacao_id} não vinculada à credencial ${cred.id} — sem monitoramentos`);
          monitQuery = monitQuery.eq("coordenacao_id", "__nenhum__");
        } else {
          monitQuery = monitQuery.eq("coordenacao_id", coordenacao_id);
        }
      }
      const { data: monitsRaw } = await monitQuery;
      const allMonits = (monitsRaw ?? []) as any[];
      // Filtra por coord conforme flags do vínculo desta credencial:
      // - "Só Kurier"      -> apenas monitoramentos com somente_kurier = true
      // - "Termos DJEN"    -> apenas monitoramentos com somente_kurier != true (comuns)
      // - nenhuma das duas -> todos (comportamento padrão)
      monitoramentos = allMonits.filter((m: any) => {
        const coordId = m.coordenacao_id ?? "";
        if (coordsSoKurier.has(coordId)) return m.somente_kurier === true;
        if (coordsTermosDjenOnly.has(coordId)) return m.somente_kurier !== true;
        return true;
      }) as any;
    } else {
      console.warn(`[kurier] credencial ${cred.id} sem coordenações vinculadas — pulando matching de monitoramentos`);
    }
    console.log(`[kurier] monitoramentos carregados: ${monitoramentos.length} (coords vinculadas: ${coordIdsArr.length}; só Kurier: ${coordsSoKurier.size}; só Termos DJEN: ${coordsTermosDjenOnly.size})`);

    // Coordenações com captura total Kurier neste login: recebem TODA publicação
    // dentro da janela, independente de match com monitoramento. A flag agora vive
    // por vínculo (kurier_credencial_coordenacoes.captura_total), permitindo que a
    // mesma coord tenha captura total em um login e busca filtrada em outro.
    let coordsCtRaw: Array<{ id: string; nome: string }> = [];
    if (coordIdsDaCredencial.size > 0) {
      let vincCtQuery = admin
        .from("kurier_credencial_coordenacoes")
        .select("coordenacao_id, coordenacoes!inner(id, nome)")
        .eq("credencial_id", cred.id)
        .eq("captura_total", true)
        // Coords marcadas como "Só Kurier" ou "Termos DJEN" NÃO recebem
        // captura total — só entram publicações que casem com os termos do modo.
        .eq("somente_kurier_only", false)
        .eq("somente_djen_only", false);
      if (coordenacao_id) vincCtQuery = vincCtQuery.eq("coordenacao_id", coordenacao_id);
      const { data: vincCtData } = await vincCtQuery;
      coordsCtRaw = ((vincCtData ?? []) as any[])
        .map((v) => v.coordenacoes)
        .filter((c) => c && coordIdsDaCredencial.has(c.id) && !coordsSoKurier.has(c.id) && !coordsTermosDjenOnly.has(c.id));
    }
    const capturaTotalCoords: Array<{ id: string; monit_id: string }> = [];
    for (const c of coordsCtRaw) {
      const { data: existing } = await admin
        .from("monitoramentos_djen")
        .select("id")
        .eq("coordenacao_id", c.id)
        .eq("termo_busca", "__CAPTURA_TOTAL_KURIER__")
        .maybeSingle();
      let monitId: string | undefined = existing?.id;
      if (!monitId) {
        // criado_por é NOT NULL — reusa o criador de qualquer monitoramento da coord,
        // ou de qualquer monitoramento existente como fallback.
        let criadoPor: string | null = null;
        const { data: anyMonit } = await admin
          .from("monitoramentos_djen")
          .select("criado_por")
          .eq("coordenacao_id", c.id)
          .not("criado_por", "is", null)
          .limit(1)
          .maybeSingle();
        criadoPor = anyMonit?.criado_por ?? null;
        if (!criadoPor) {
          const { data: globalMonit } = await admin
            .from("monitoramentos_djen")
            .select("criado_por")
            .not("criado_por", "is", null)
            .limit(1)
            .maybeSingle();
          criadoPor = globalMonit?.criado_por ?? null;
        }
        if (!criadoPor) {
          console.warn(`[kurier] sem criado_por disponível para sentinel coord ${c.id}, pulando`);
          continue;
        }
        const { data: newM, error: newMErr } = await admin
          .from("monitoramentos_djen")
          .insert({
            coordenacao_id: c.id,
            termo_busca: "__CAPTURA_TOTAL_KURIER__",
            tipo: "palavra-chave",
            ativo: true,
            descricao: "Captura total Kurier (sentinela - não editar)",
            criado_por: criadoPor,
          })
          .select("id")
          .maybeSingle();
        if (newMErr) {
          console.warn(`[kurier] erro criar sentinel captura_total para coord ${c.id}:`, newMErr.message);
          continue;
        }
        monitId = newM?.id;
      }
      if (monitId) capturaTotalCoords.push({ id: c.id, monit_id: monitId });
    }
    console.log(`[kurier] coordenações captura_total: ${capturaTotalCoords.length}`);

    // Pré-indexa monitoramentos por tokens do termo Kurier. Indexar todos os
    // tokens (não só o primeiro) evita perder termos como "310314/OSMAR..."
    // quando o monitoramento foi cadastrado como "OSMAR...".
    const monitsByTermo = new Map<string, (Monitoramento & { coordenacao_id?: string | null; somente_kurier?: boolean | null })[]>();
    for (const m of monitoramentos) {
      const termos = [m.termo_busca, ...(m.termos_or || [])].filter(Boolean) as string[];
      for (const t of termos) {
        for (const key of termoTokens(t)) {
          const arr = monitsByTermo.get(key) || [];
          arr.push(m);
          monitsByTermo.set(key, arr);
        }
      }
    }

    // Registra execução
    const { data: execIns } = await admin
      .from("kurier_execucoes")
      .insert({
        credencial_id: cred.id,
        login_usado: cred.login,
        lote: "consulta",
        iniciado_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    const execId = execIns?.id;

    let totalRecebidas = 0;
    let totalNovas = 0;
    let totalDuplicadas = 0;
    let totalConfirmadas = 0;
    let totalDescartadas = 0;
    let ultimoErro: string | null = null;
    let lotesProcessados = 0;
    let janelaUltrapassada = false;
    // Sinaliza ao worker que não há mais nada na fila desta credencial, para ele
    // parar de fatiar novas chamadas pequenas.
    let filaVazia = false;
    let totalForaJanelaAntes = 0;
    let totalForaJanelaDepois = 0;

    // Modo "personalizado": quando o usuário escolhe um intervalo de datas, usamos
    // o endpoint ConsultarPublicacoesPersonalizado (consulta por data, NÃO confirma)
    // em vez da fila — isso permite re-buscar publicações já confirmadas/drenadas.
    const useDateMode = !!(modo_personalizado && data_inicio && data_fim);
    const datas: string[] = [];
    if (useDateMode) {
      const start = new Date(`${data_inicio}T00:00:00Z`);
      const end = new Date(`${data_fim}T00:00:00Z`);
      // O endpoint Kurier "Personalizado?data=X" filtra pela DATA DE PUBLICAÇÃO
      // (do jornal/diário). Espelhamos exatamente o comportamento da tela
      // Kurier: data_inicio/data_fim são tratados como datas de PUBLICAÇÃO e
      // trazemos TODOS os itens devolvidos pela API, sem filtro local por
      // disponibilização (a tela mostra "X publicações encontradas" — queremos
      // o mesmo número aqui).
      for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
        datas.push(d.toISOString().slice(0, 10));
      }
    }
    const totalIter = backfill_raw ? 1 : (useDateMode ? datas.length : max_lotes);
    console.log(`[kurier] modo=${backfill_raw ? "backfill" : (useDateMode ? "personalizado" : "fila")} iter=${totalIter}`);

    for (let lote = 0; lote < totalIter; lote++) {
      let pubs: KurierPub[] = [];
      let recebidasDaApi = 0;
      if (backfill_raw) {
        // Carrega payloads de descartes anteriores (já confirmados na fila Kurier)
        // para reprocessar com a lógica atual. NÃO faz chamada à API.
        const dataAlvo = backfill_date ?? hojeYmd;
        // `backfill_motivo === "todos"` carrega TODOS os raws do dia daquela
        // credencial, independente de motivo_descarte (inclusive raws bem-sucedidos
        // cujas publicações foram apagadas por engano). Nesse caso a dedup natural
        // por origem+id_externo em publicacoes_djen evita duplicar as que ainda
        // existirem.
        let rawQuery = admin
          .from("kurier_publicacoes_raw")
          .select("payload")
          .eq("credencial_id", cred.id)
          .gte("created_at", `${dataAlvo}T00:00:00Z`)
          .lt("created_at", `${dataAlvo}T23:59:59.999Z`)
          .limit(10000);
        if (backfill_motivo !== "todos") {
          rawQuery = rawQuery.eq("motivo_descarte", backfill_motivo);
        }
        const { data: rawDescartados, error: rawDescErr } = await rawQuery;
        if (rawDescErr) {
          ultimoErro = `backfill load raw lote ${lote}: ${rawDescErr.message}`;
          break;
        }
        pubs = ((rawDescartados ?? []) as any[]).map((r) => r.payload).filter(Boolean);
        console.log(`[kurier][backfill] cred=${cred.id} motivo=${backfill_motivo} data=${dataAlvo} encontrados=${pubs.length}`);
      } else {
        // A fila da Kurier deve ser consultada sem parâmetros de data: algumas
        // credenciais retornam 0 quando a data é enviada, impedindo a drenagem.
        const url = useDateMode
          ? buildKurierUrl(baseUrl, "/api/KJuridico/ConsultarPublicacoesPersonalizado", { data: datas[lote] })
          : buildKurierUrl(baseUrl, "/api/KJuridico/ConsultarPublicacoes", {});

        let resp: Response;
        let texto = "";
        try {
          resp = await fetch(url, { method: "GET", headers: buildKurierAuthHeaders(cred.login, senha) });
          texto = await resp.text();
        } catch (e) {
          ultimoErro = `Falha rede lote ${lote}: ${String(e)}`;
          break;
        }
        if (resp.status < 200 || resp.status >= 300) {
          ultimoErro = resp.status === 401
            ? "HTTP 401 — login ou senha recusados pela Kurier"
            : `HTTP ${resp.status} lote ${lote}: ${texto.trim() ? texto.slice(0, 200) : "resposta sem mensagem"}`;
          break;
        }
        try {
          const j = JSON.parse(texto);
          pubs = extractPublicacoes(j);
          recebidasDaApi = pubs.length;
          if (!useDateMode && pubs.length > lote_size) pubs = pubs.slice(0, lote_size);
        } catch (e) {
          ultimoErro = `JSON inválido lote ${lote}: ${texto.slice(0, 200)}`;
          break;
        }
      }

      if (!pubs.length) {
        // Em modo data, dia sem publicações é normal — só pula para o próximo.
        if (useDateMode) continue;
        filaVazia = true;
        break; // Fila: ausência = fim do backlog
      }

      // Log do shape da primeira publicação do primeiro lote para diagnóstico
      // (só as chaves — imprimir o payload inteiro custa memória/CPU do worker).
      if (lote === 0 && pubs[0]) {
        try {
          console.log(`[kurier] payload keys lote0:`, Object.keys(pubs[0]).join(","));
        } catch {}
      }

      lotesProcessados++;
      totalRecebidas += pubs.length;
      const idsConfirmar: string[] = [];
      const confirmacoes: Record<string, number | string>[] = [];

      const rawRows: any[] = [];
      // Gravação em lote: fora do modo backfill acumulamos as linhas de
      // publicação do lote e inserimos em blocos, em vez de 1 round trip por
      // publicação × coordenação (era o gargalo — ~1s por publicação).
      const batchMode = !backfill_raw;
      const pendentesInsert: any[] = [];
      const pendentesEntradas: {
        p: any;
        idKEff: string;
        keys: string[];
        motivo: string | null;
      }[] = [];
      let itensNaJanelaNesteLote = 0;
      let itensDepoisDaJanelaNesteLote = 0;


      for (const p of pubs) {
        // Janela de datas (cliente envia data_inicio/data_fim em YYYY-MM-DD).
        // A Kurier ignora esses parâmetros no endpoint de fila, então filtramos
        // aqui: ignora publicações fora da janela e confirma na Kurier
        // para não ficar preso repetindo backlog antigo antes das publicações do dia.
        const dispRaw = pickStr(p,
          "data_disponibilizacao", "DataDisponibilizacao", "dataDisponibilizacao",
          "dtDisponibilizacao", "DtDisponibilizacao",
          "dataDisponibilidade", "DataDisponibilidade",
          "DATA_DIVULGACAO", "DATA_DISPONIBILIZACAO");
        const pubRaw = pickStr(p,
          "data_publicacao", "DataPublicacao", "dataPublicacao",
          "dtPublicacao", "DtPublicacao", "DATA_PUBLICACAO");
        const textoKurier = String((p as any).Texto ?? (p as any).texto ?? (p as any).PUBLICACAO ?? "");
        const refIsoOriginal = toIsoDate(dispRaw)
          ?? extractDateFromText(textoKurier, [
            /DATA\s+DE\s+DISPONIBILIZA[ÇC][AÃ]O\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
            /Data\s+de\s+Divulga[çc][aã]o\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
          ]);
        // Se a Kurier não informar a disponibilização, assume a data do filtro
        // (que já cai para hoje quando a tela não envia período). Isso evita
        // descartar/cadastrar captura total com data errada ou nula.
        const refIso = refIsoOriginal ?? toIsoDate(data_inicio);
        const refYmd = refIso ? refIso.slice(0, 10) : null;
        // Filtro de janela:
        // - Fila: ESTRITO por DATA DE DISPONIBILIZAÇÃO. A API Kurier ignora
        //   dataInicio/dataFim no endpoint de fila, então cortamos aqui e
        //   confirmamos o item antigo para liberar a fila.
        // - Personalizado: NENHUM filtro local. O próprio endpoint
        //   "Personalizado?data=X" já filtrou por data de PUBLICAÇÃO; aceitamos
        //   todos os itens retornados (espelhando a tela Kurier que mostra
        //   "X publicações encontradas").
        // Itens "antes da janela" NÃO são mais descartados: a fila Kurier é
        // destrutiva (confirmar = remover), então tudo que sai da fila precisa
        // entrar na pipeline normal de matching/inserção. Mantemos apenas o
        // corte para itens posteriores à janela (esses ficam na fila e voltam
        // no dia correto).
        const antesDaJanela = false;
        const depoisDaJanela = !useDateMode && !!(refYmd && data_fim && refYmd > data_fim);
        const semData = !useDateMode && !refYmd;
        const foraJanela = semData || antesDaJanela || depoisDaJanela;
        if (foraJanela) {
          totalDescartadas++;
          if (antesDaJanela) totalForaJanelaAntes++;
          if (depoisDaJanela) {
            totalForaJanelaDepois++;
            itensDepoisDaJanelaNesteLote++;
          }
          // Confirmamos APENAS itens atrasados (antes da janela) para drenar a
          // fila Kurier. Itens com data futura (depois da janela) NÃO são
          // confirmados — precisam continuar na fila para serem processados
          // no dia correto. Itens sem data também não são confirmados.
          if (!useDateMode && antesDaJanela) {
            const confirmacaoForaJanela = buildConfirmacaoKurier(p);
            if (confirmacaoForaJanela) confirmacoes.push(confirmacaoForaJanela);
            const idKForaJanela = pickId(p);
            if (idKForaJanela) idsConfirmar.push(idKForaJanela);
          }
          // Persiste motivo no raw para auditoria
          const idKRaw = pickId(p) ?? `unknown_${sha256(JSON.stringify(p)).slice(0, 24)}`;
          rawRows.push({
            id_kurier: idKRaw,
            credencial_id: cred.id,
            login_usado: cred.login,
            payload: p as any,
            publicacao_djen_id: null,
            motivo_descarte: antesDaJanela
              ? "fora_janela_disp_antes"
              : depoisDaJanela
              ? "fora_janela_disp_depois"
              : "fora_janela_sem_data",
            recebida_em: new Date().toISOString(),
          });
          continue;
        }
        itensNaJanelaNesteLote++;

        // Kurier sempre traz o conteúdo completo em `Texto`; evita walk recursivo
        // pesado em CPU. Inclui também TermoPesquisa/Processo para matching.
        const searchable = [
          (p as any).Texto ?? (p as any).texto ?? (p as any).PUBLICACAO ?? "",
          (p as any).TermoPesquisa ?? (p as any).NOME_PESQUISADO ?? "",
          (p as any).Processo ?? (p as any).NUMERO_PROCESSO ?? "",
        ].filter(Boolean).join("\n");
        const idK = pickId(p) ?? pickDeep(p, [
          "id", "idPublicacao", "IDPublicacao", "idProcesso", "IdProcesso", "IDProcesso", "codigoPublicacao", "codPublicacao", "cdPublicacao",
          "codigo", "idDocumento", "cdDocumento", "codigoDocumento", "numeroDocumento", "protocolo", "guid", "hash",
        ]);
        // Mesmo sem id reconhecido, persiste o payload para inspecionar depois.
        // Usa fallback hash para evitar perder o payload e poder reprocessar.
        const idKEff = idK ?? `unknown_${sha256(JSON.stringify(p)).slice(0, 24)}`;

        const numero = normalizeProcesso(pickStr(p,
          "numero_processo", "NumeroProcesso", "processo", "Processo",
          "numProcesso", "NumProcesso", "nrProcesso", "NrProcesso",
          "numeroProcesso", "processoNumero", "ProcessoNumero",
          "numeroProcessoFormatado", "NumeroProcessoFormatado",
          "processoCNJ", "ProcessoCNJ", "NUMERO_PROCESSO") ?? pickDeep(p, [
            "numero_processo", "NumeroProcesso", "processo", "Processo",
            "numProcesso", "nrProcesso", "numeroProcesso", "processoNumero",
            "numeroProcessoFormatado", "processoCNJ", "cnj",
          ]) ?? extractProcessoFromText(searchable));
        const conteudoRaw = pickStr(p,
          "conteudo", "Conteudo", "texto", "Texto",
          "mensagem", "Mensagem", "descricao", "Descricao",
          "textoPublicacao", "TextoPublicacao", "corpo", "Corpo",
          "publicacao", "Publicacao", "PUBLICACAO", "movimento", "Movimento",
          "andamento", "Andamento", "intimacao", "Intimacao") ?? searchable;
        const conteudoLimpo = sanitizeConteudoKurier(conteudoRaw);
        const kurierEstruturado = parseKurierBlobForStorage(conteudoLimpo);
        const conteudo = kurierEstruturado.conteudoNormalizado ?? conteudoLimpo;
        const dataDispRaw = pickStr(p,
          "data_disponibilizacao", "DataDisponibilizacao", "dataDisponibilizacao",
          "dtDisponibilizacao", "DtDisponibilizacao",
          "dataDisponibilidade", "DataDisponibilidade",
          "DATA_DIVULGACAO", "DATA_DISPONIBILIZACAO") ?? pickDeep(p, [
            "data_disponibilizacao", "DataDisponibilizacao", "dataDisponibilizacao",
            "dtDisponibilizacao", "dataDisponibilidade", "disponibilizacao",
          ]);
        const dataDisp = toIsoDate(dataDispRaw) ?? refIso;
        const dataPub = pickStr(p,
          "data_publicacao", "DataPublicacao", "dataPublicacao",
          "dtPublicacao", "DtPublicacao", "DATA_PUBLICACAO",
          "dataMovimento", "DataMovimento", "dtMovimento", "DtMovimento") ?? pickDeep(p, [
            "data_publicacao", "DataPublicacao", "dataPublicacao", "dtPublicacao",
            "dataMovimento", "dtMovimento", "publicacao", "data",
          ]);
        const tribunal = pickStr(p,
          "tribunal", "Tribunal", "siglaTribunal", "SiglaTribunal",
          "orgao", "Orgao", "orgaoJulgador", "OrgaoJulgador",
          "JORNAL", "ORGAO_TRIBUNAL") ?? pickDeep(p, [
            "tribunal", "siglaTribunal", "orgao", "orgaoJulgador", "diario",
          ]);

        let publicacaoDjenId: string | null = null;
        let motivoDescarte: string | null = null;
        if (!idK) motivoDescarte = "id_nao_reconhecido";
        let qtdInsercoes = 0;

        if (numero && conteudo) {
          // 1) Matching: Kurier já filtrou pelo TermoPesquisa. Reduz drasticamente
          // o universo de monitoramentos avaliados usando o índice por palavra-chave.
          const termoKurier = String((p as any).TermoPesquisa || (p as any).NOME_PESQUISADO || "").trim();
          const candidatoMap = new Map<string, Monitoramento & { coordenacao_id?: string | null; somente_kurier?: boolean | null }>();
          for (const key of termoTokens(termoKurier)) {
            for (const m of monitsByTermo.get(key) || []) candidatoMap.set(m.id, m);
          }
          const candidatos = candidatoMap.size > 0 ? Array.from(candidatoMap.values()) : monitoramentos;
          let matched: (Monitoramento & { coordenacao_id?: string | null }) | null = null;
          let motivoExcl: string | null = null;
          let bloqueadoPorTribunal = false;
          for (const m of candidatos) {
            try {
              if (!kurierMatchesMonitoramento(searchable || conteudo, m as Monitoramento)) continue;
              // Escopo de tribunais do termo — mesma regra do DJEN Termos Servidor
              // (paralela.js: "tribunal_nao_permitido"). Termo sem tribunais
              // definidos aceita qualquer tribunal; sigla não reconhecida passa.
              const escopo = tribunalPermitidoKurier(tribunal, (m as any).tribunais);
              if (!escopo.permitido) {
                bloqueadoPorTribunal = true;
                continue;
              }
              if (!escopo.reconhecida && ((m as any).tribunais?.length ?? 0) > 0) {
                console.warn(`[kurier] sigla de tribunal não reconhecida: "${tribunal}" (monit ${m.id})`);
              }
              const motivo = shouldExclude(searchable || conteudo, m.exclusoes || [], null, null);
              if (motivo) { motivoExcl = motivo; continue; }
              matched = m;
              break;
            } catch (e) {
              console.warn(`[kurier] erro matching monit ${m.id}:`, String(e));
            }
          }

          // Pré-computa campos comuns para reutilizar nas inserções de match e captura_total.
          const idDjen = extractKurierIdDjen(searchable, conteudoRaw, conteudoLimpo, conteudo);
          const hashConteudo = sha256(`${numero}|${dataDisp ?? dataPub ?? ""}|${conteudo}`);
          const digits = numero.replace(/\D/g, "");
          const basePayload: any = {
            processo_numero: numero,
            conteudo,
            fonte: "kurier",
            id_djen: idDjen,
            hash_conteudo: hashConteudo,
            dedup_processo_digits: digits || null,
            dedup_data_ref: (dataDisp ?? toIsoDate(dataPub) ?? "").slice(0, 10) || null,
            tribunal,
            data_disponibilizacao: dataDisp ?? null,
            data_publicacao: toIsoDate(dataPub) ?? null,
            tipo_publicacao: "intimacao",
            partes_json: kurierEstruturado.partes,
            advogados_json: kurierEstruturado.advogados,
            kurier_login: cred.login ?? null,
            execucao_id: execucao_id_local ?? null,
            id_kurier: idKEff,
          };

          if (matched) {
            // Sempre insere o item Kurier mesmo que já exista vindo do DJEN
            // Termos (id_djen=null dribla o unique coord+id_djen; hash único
            // garante que múltiplas execuções/lotes não colidam). O usuário
            // quer enxergar TODAS as publicações trazidas pela Kurier na tela
            // Análise DJEN, com ou sem captura_total.
            //
            // Exceção: em modo BACKFILL, evitamos reinserir uma publicação
            // que já existe na mesma coordenação (mesmo processo + mesma data
            // de disponibilização). O usuário não quer "ressuscitar" como
            // não-lida algo que já estava na tela e já foi lido ontem.
            if (batchMode) {
              const coordKey = String(matched.coordenacao_id ?? "null");
              const chave = `${coordKey}|${hashConteudo}`;
              pendentesInsert.push({
                ...basePayload,
                id_djen: idDjen,
                hash_conteudo: hashConteudo,
                monitoramento_id: matched.id,
                coordenacao_id: matched.coordenacao_id ?? null,
              });
              chaves.push(chave);
              qtdInsercoes++;
            } else {
            let jaExiste = false;
            if (backfill_raw && digits && basePayload.dedup_data_ref) {
              const { data: dup } = await admin
                .from(pubTable)
                .select("id")
                .eq("coordenacao_id", matched.coordenacao_id ?? null)
                .eq("dedup_processo_digits", digits)
                .eq("dedup_data_ref", basePayload.dedup_data_ref)
                .limit(1)
                .maybeSingle();
              if (dup?.id) {
                jaExiste = true;
                publicacaoDjenId = dup.id;
                totalDuplicadas++;
              }
            }
            const { data: insPub, error: pubErr } = jaExiste ? { data: null, error: null } : await admin
              .from(pubTable)
              .insert({
                ...basePayload,
                id_djen: idDjen,
                hash_conteudo: hashConteudo,
                monitoramento_id: matched.id,
                coordenacao_id: matched.coordenacao_id ?? null,
              })
              .select("id")
              .maybeSingle();

            if (pubErr) {
              if ((pubErr as any).code === "23505") {
                // Duplicado por unique (coordenacao_id, id_djen) — silencia
                totalDuplicadas++;
              } else {
                console.warn(`[kurier] erro insert ${pubTable}:`, pubErr.message);
                motivoDescarte = `erro_insert:${pubErr.message.slice(0, 60)}`;
              }
            } else if (insPub) {
              publicacaoDjenId = insPub.id;
              totalNovas++;
              qtdInsercoes++;
              // 1 raw por publicação inserida — garante rastreio do login_usado
              rawRows.push({
                id_kurier: idKEff,
                credencial_id: cred.id,
                login_usado: cred.login,
                payload: p as any,
                publicacao_djen_id: insPub.id,
                motivo_descarte: null,
                recebida_em: new Date().toISOString(),
              });
            } else {
              // insert sem retorno inesperado: trata como duplicado para não inflar contagem
              totalDuplicadas++;
            }
            }

          } else if (capturaTotalCoords.length === 0) {
            totalDescartadas++;
            motivoDescarte = motivoDescarte ?? (
              motivoExcl
                ? `excluido_por_termo:${motivoExcl}`
                : (bloqueadoPorTribunal ? "tribunal_nao_permitido" : "sem_match_monitoramento")
            );
          }

          // 3) Captura total: garante 1 linha por item recebido em CADA coord
          // com captura_total no login, INDEPENDENTE de já existir no DJEN Termos
          // ou de já ter sido inserido na coord pelo path de match. Para isso
          // forçamos id_djen=null (driblando o unique index coord+id_djen) e
          // damos um hash único por inserção. O usuário quer enxergar TODAS as
          // publicações trazidas pela Kurier na tela Análise DJEN.
          for (const ct of capturaTotalCoords) {
            // Se o item já foi inserido pelo path de match NA MESMA coord,
            // pulamos para não duplicar a mesma linha desnecessariamente. Mas
            // se o match não inseriu (ex.: 23505 por já existir vindo do DJEN
            // Termos OU sem_match), seguimos com a captura total.
            if (matched && (matched.coordenacao_id ?? null) === ct.id && publicacaoDjenId) continue;
            // Backfill: evita reinserir publicação já existente na mesma
            // coord (mesmo processo + mesma data de disponibilização).
            if (backfill_raw && digits && basePayload.dedup_data_ref) {
              const { data: dupCt } = await admin
                .from(pubTable)
                .select("id")
                .eq("coordenacao_id", ct.id)
                .eq("dedup_processo_digits", digits)
                .eq("dedup_data_ref", basePayload.dedup_data_ref)
                .limit(1)
                .maybeSingle();
              if (dupCt?.id) {
                totalDuplicadas++;
                if (!publicacaoDjenId) publicacaoDjenId = dupCt.id;
                continue;
              }
            }
            const { data: insCt, error: ctErr } = await admin
              .from(pubTable)
              .insert({
                ...basePayload,
                id_djen: idDjen,
                hash_conteudo: hashConteudo,
                monitoramento_id: ct.monit_id,
                coordenacao_id: ct.id,
              })
              .select("id")
              .maybeSingle();
            if (ctErr) {
              if ((ctErr as any).code === "23505") {
                // Duplicado por unique (coordenacao_id, id_djen) — silencia
                totalDuplicadas++;
                continue;
              }
              console.warn(`[kurier] erro captura_total insert coord ${ct.id}:`, ctErr.message);
            } else if (insCt) {
              if (!publicacaoDjenId) publicacaoDjenId = insCt.id;
              totalNovas++;
              qtdInsercoes++;
              rawRows.push({
                id_kurier: idKEff,
                credencial_id: cred.id,
                login_usado: cred.login,
                payload: p as any,
                publicacao_djen_id: insCt.id,
                motivo_descarte: null,
                recebida_em: new Date().toISOString(),
              });
            } else {
              totalDuplicadas++;
            }
          }
        } else {
          totalDescartadas++;
          if (!conteudo) motivoDescarte = motivoDescarte ?? "sem_conteudo";
          else if (!numero) motivoDescarte = motivoDescarte ?? "sem_processo";
        }

        // Se nenhuma publicação foi inserida, grava 1 raw de auditoria
        // com motivo de descarte e login_usado preservado.
        if (qtdInsercoes === 0) {
          rawRows.push({
            id_kurier: idKEff,
            credencial_id: cred.id,
            login_usado: cred.login,
            payload: p as any,
            publicacao_djen_id: null,
            motivo_descarte: motivoDescarte ?? "sem_insercao",
            recebida_em: new Date().toISOString(),
          });
        }

        // Em modo data, NÃO confirmamos — o endpoint Personalizado é só leitura
        // e queremos preservar a fila para o monitoramento normal.
        // Em modo backfill, também NÃO confirmamos — o item já foi confirmado
        // no passado (foi por isso que sumiu da fila e teve que ser reprocessado).
        if (!useDateMode && !backfill_raw) {
          const confirmacao = buildConfirmacaoKurier(p);
          if (confirmacao) confirmacoes.push(confirmacao);
          if (idK) idsConfirmar.push(idK);
        }
      }

      if (rawRows.length) {
        // Insere todas as linhas raw — sem unique(id_kurier), múltiplas
        // linhas por id_kurier são permitidas (uma por publicação inserida
        // + uma por descarte), sempre com login_usado da credencial atual.
        const { error: rawErr } = await admin
          .from("kurier_publicacoes_raw")
          .insert(rawRows);
        if (rawErr) console.warn("[kurier] erro insert raw:", rawErr.message);
      }

      // Junção publicação×execução (DJEN Local "Execuções do dia")
      if (execucao_id_local) {
        const pubIdsDoLote = Array.from(
          new Set(
            (rawRows as any[])
              .map((r) => r.publicacao_djen_id)
              .filter((v: any): v is string => !!v),
          ),
        );
        if (pubIdsDoLote.length > 0) {
          const junctionRows = pubIdsDoLote.map((pid) => ({
            publicacao_id: pid,
            execucao_id: execucao_id_local,
            tipo_engine: "kurier",
          }));
          for (let i = 0; i < junctionRows.length; i += 100) {
            const chunk = junctionRows.slice(i, i + 100);
            const { error: junErr } = await admin
              .from("publicacoes_djen_execucoes")
              .upsert(chunk, {
                onConflict: "publicacao_id,execucao_id",
                ignoreDuplicates: true,
              });
            if (junErr) console.warn("[kurier] junção execução falhou:", junErr.message);
          }
        }
      }

      // Confirma o lote
      if (confirmacoes.length) {
        try {
          const confirmUrl = buildKurierUrl(baseUrl, "/api/KJuridico/ConfirmarPublicacoes", {
          });
          const cResp = await fetch(confirmUrl, {
            method: "POST",
            headers: buildKurierAuthHeaders(cred.login, senha, { "Content-Type": "application/json" }),
            body: JSON.stringify(confirmacoes),
          });
          if (cResp.ok) {
            totalConfirmadas += confirmacoes.length;
            await admin
              .from("kurier_publicacoes_raw")
              .update({ confirmada: true, confirmada_em: new Date().toISOString() })
              .in("id_kurier", idsConfirmar);
          } else {
            const cText = await cResp.text().catch(() => "");
            ultimoErro = `Falha confirmacao HTTP ${cResp.status}: ${cText.slice(0, 160)}`;
          }
        } catch (e) {
          ultimoErro = `Falha confirmacao: ${String(e)}`;
        }
      }

      if (!useDateMode && recebidasDaApi < LOTE_SIZE) {
        filaVazia = true;
        break; // último lote da fila
      }
      // Se TODOS os itens deste lote são posteriores à janela, paramos: a fila
      // ultrapassou o dia atual e seguir consumiria itens futuros sem necessidade
      // (eles não devem ser confirmados nem persistidos).
      if (!useDateMode
          && itensNaJanelaNesteLote === 0
          && itensDepoisDaJanelaNesteLote === pubs.length
          && pubs.length > 0) {
        janelaUltrapassada = true;
        console.log(`[kurier] janela ultrapassada — todos os ${pubs.length} itens do lote são posteriores a ${data_fim}; parando.`);
        break;
      }
      console.log(`[kurier] lote ${lote+1}: recebidos=${pubs.length} naJanela=${itensNaJanelaNesteLote} antes=${pubs.length - itensNaJanelaNesteLote - itensDepoisDaJanelaNesteLote} depois=${itensDepoisDaJanelaNesteLote}`);
      // Libera os acumuladores deste lote antes de seguir: sem isso o worker
      // acumula textos integrais de todos os lotes e estoura o limite de recurso.
      pubs = [];
      rawRows.length = 0;
      idsConfirmar.length = 0;
      confirmacoes.length = 0;
      await delay(DELAY_MS);
    }


    await admin
      .from("kurier_credenciais")
      .update({
        ultimo_uso: new Date().toISOString(),
        ultimo_status: ultimoErro
          ? `Erro: ${ultimoErro.slice(0, 120)}`
          : `OK (${totalNovas} novas, ${totalDuplicadas} dup, ${totalConfirmadas} confirm)`,
      })
      .eq("id", cred.id);

    if (execId) {
      await admin
        .from("kurier_execucoes")
        .update({
          total_recebidas: totalRecebidas,
          total_novas: totalNovas,
          total_duplicadas: totalDuplicadas,
          total_descartadas: totalDescartadas,
          total_confirmadas: totalConfirmadas,
          erro: ultimoErro,
          metadata: { lotes_processados: lotesProcessados },
          finalizado_em: new Date().toISOString(),
        })
        .eq("id", execId);
    }

    return jsonResponse({
      ok: !ultimoErro,
      credencial_id: cred.id,
      login: cred.login,
      lotes_processados: lotesProcessados,
      total_recebidas: totalRecebidas,
      total_novas: totalNovas,
      total_duplicadas: totalDuplicadas,
      total_descartadas: totalDescartadas,
      total_confirmadas: totalConfirmadas,
      total_fora_janela_antes: totalForaJanelaAntes,
      total_fora_janela_depois: totalForaJanelaDepois,
      janela_ultrapassada: janelaUltrapassada,
      fila_vazia: filaVazia || janelaUltrapassada,
      erro: ultimoErro,
    });
  } catch (e) {
    const msg = String((e as any)?.message ?? e);
    const stack = String((e as any)?.stack ?? "");
    let credencialId: string | undefined;
    let credencialLogin: string | undefined;
    try {
      // best-effort: re-parse body to surface qual credencial estourou
      // (body já foi consumido acima; ignorar se falhar)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = (globalThis as any).__lastKurierBody;
      credencialId = b?.credencial_id;
      credencialLogin = (globalThis as any).__lastKurierLogin;
    } catch {}
    console.error("[kurier-consultar-publicacoes] FATAL", {
      message: msg,
      stack: stack.slice(0, 2000),
      credencial_id: credencialId,
      credencial_login: credencialLogin,
    });
    return jsonResponse({ error: msg, stack: stack.slice(0, 1500) }, 500);
  }
});