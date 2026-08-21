/**
 * buscar-dejt-pautas
 *
 * Baixa o PDF do caderno Judiciário do DEJT para um (tribunal, dia),
 * extrai o texto, segmenta em blocos de pauta e retorna os blocos que
 * casam com termos/OAB/exclusões dos monitoramentos informados.
 *
 * Não persiste nada — quem grava em publicacoes_djen é o engine browser.
 */

import * as pdfjsLib from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import {
  buildDejtPdfUrls,
  getDejtTribunal,
  ddmmyyyyToIso,
  type DejtCaderno,
} from "../_shared/dejtTribunais.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MonitoramentoInput {
  id: string;
  termos: string[];          // termos / partes / palavras-chave
  /**
   * Condição concomitante no MESMO formato do DJEN Termos:
   *   "GRUPO1 | GRUPO2"  → OR entre grupos
   *   "TERMO_A, TERMO_B" → AND dentro do grupo
   * Se vier preenchida, o bloco da pauta precisa satisfazer pelo menos
   * um dos grupos para virar match para este monitoramento.
   */
  condicaoConcomitante?: string | null;
  exclusoes?: string[];
  oab?: string;              // se vier, casa também por número de OAB
  coordenacao_id?: string | null;
}

interface RequestBody {
  tribunal: string;          // TST | TRTx
  dataDDMMYYYY: string;      // 29/04/2026
  caderno?: DejtCaderno;     // default 'judiciario'
  downloadOnly?: boolean;    // true = atua só como proxy CORS do PDF, sem extrair texto no worker
  monitoramentos: MonitoramentoInput[];
  // Chunk de páginas processado nesta invocação (evita HTTP 546 em cadernos grandes: TRT1/TRT2/TRT5).
  // Se omitidos, processa o PDF inteiro (comportamento legado).
  pageStart?: number;        // 1-based, inclusive
  pageEnd?: number;          // 1-based, inclusive
  // Motor Pautas Servidor: aceita a edição vigente que o DEJT expõe no caminho
  // fixo mesmo quando a data interna difere da pedida. O consumidor decide se
  // processa (controle por tribunal + data de disponibilização já processada).
  aceitarEdicaoVigente?: boolean;
}


interface MatchOut {
  monitoramentoId: string;
  termoMatch: string;
  processo: string | null;
  conteudo: string;
  hash: string;
  dataPublicacao: string;    // ISO
  fonte: string;             // 'dejt-pdf'
  tribunal: string;
}

// ----------------------------------------------------------------------------
// Utils
// ----------------------------------------------------------------------------
function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Muitos cadernos DEJT (notoriamente TRT5, TRT1, TRT2) são gerados com
 * "letter-spacing" no PDF, o que a extração pdfjs devolve como caracteres
 * isolados separados por espaço:
 *   "P E L O   A P L I C A T I V O   J T E"
 *   "O S M A R   M E N D E S   P A I X A O"
 *   "0 0 0 0 0 3 9 - 6 1 . 2 0 1 1 . 5 . 0 5 . 0 0 2 9"
 *
 * Sem tratamento, o regex de CNJ não casa (não vira sub-bloco por processo)
 * e o match de termos falha ("o s m a r m e n d e s" ≠ "osmar mendes").
 *
 * Esta função:
 *  1. Junta pontuação de CNJ que ficou separada dos dígitos por espaços
 *     (ex.: "0000039 - 61 . 2011" → "0000039-61.2011").
 *  2. Colapsa runs de 3+ letras/dígitos isolados separados por espaço único
 *     ("o s m a r" → "osmar", "0 0 0 0 0 3 9" → "0000039").
 */
function collapseLetterSpacing(s: string): string {
  if (!s) return s;
  let out = s;
  const LETRA = "A-Za-zÀ-ÖØ-öø-ÿ0-9";
  // 1) Runs de 3+ letras/dígitos isolados separados por 1 espaço
  //    ("o s m a r" → "osmar", "p o d e r ã o" → "poderão", "0 0 0 0 0 3 9" → "0000039").
  //    Preserva múltiplos espaços entre palavras.
  const runLetras = new RegExp(
    `(?<![${LETRA}])[${LETRA}](?: [${LETRA}](?![${LETRA}])){2,}`,
    "g",
  );
  // 2) Runs de 2+ dígitos isolados ("6 1" → "61", "0 5" → "05").
  const runDigitos = /(?<!\d)\d(?: \d(?!\d))+/g;
  // 3) Pontuação de CNJ entre dígitos com pelo menos um espaço vizinho
  //    ("39 - 6" → "39-6", "2011 . 5" → "2011.5", "5 . 05" → "5.05").
  //    Exige pelo menos 1 espaço em algum lado para NÃO tocar CNPJ/valores
  //    já bem-formados como "1.5".
  const punctCnj = /(\d)(?:\s+([.\-])\s*|\s*([.\-])\s+)(\d)/g;
  for (let i = 0; i < 6; i++) {
    const prev = out;
    out = out.replace(runLetras, (m) => m.replace(/ /g, ""));
    out = out.replace(runDigitos, (m) => m.replace(/ /g, ""));
    out = out.replace(punctCnj, (_m, a, b, c, d) => `${a}${b || c}${d}`);
    if (out === prev) break;
  }
  return out;
}

// Dedup de pautas: remove rodapé de intimados/destinatários/partes APENAS para
// efeito de cálculo da chave de comparação. O `conteudo` gravado segue completo.
const PAUTA_STRIP_INTIMADOS_RE = /(Intimad[ao]|Destinat[áa]rio|Advogad[ao]|Parte|Reclamante|Reclamad[ao]|Autor|R[eé]u|Requerente|Requerid[ao])\s*\(?s?\)?\s*:/i;
function stripIntimadosPauta(t: string): string {
  const i = (t || "").search(PAUTA_STRIP_INTIMADOS_RE);
  return i > 0 ? t.slice(0, i) : (t || "");
}
function digitsProcessoPauta(p?: string | null): string {
  const d = (p || "").replace(/\D/g, "");
  return d || "sem-processo";
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const CNJ_REGEX = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;
const CNJ_REGEX_GLOBAL = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g;
const MAX_BLOCO_CHARS = 400_000;
const MAX_BUF_FLUSH_CHARS = 800_000;

/**
 * Quebra um bloco grande de pauta em sub-blocos, um por processo (CNJ).
 * Replica o comportamento do engine browser (useDjetPautasParalelaEngine.ts)
 * — sem isso, um único bloco "PAUTA DE JULGAMENTO" com 50 processos só
 * gera 1 match por monitoramento, em vez de 50. Foi a causa da diferença
 * gigante entre DJEN Servidor (poucas pautas) e DJEN Browser (muitas).
 */
function splitBlocoByProcessos(bloco: string): Array<{ processo: string | null; texto: string }> {
  const cnjs: Array<{ value: string; index: number }> = [];
  CNJ_REGEX_GLOBAL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CNJ_REGEX_GLOBAL.exec(bloco)) !== null) {
    cnjs.push({ value: m[0], index: m.index });
  }
  if (cnjs.length === 0) {
    return [{ processo: null, texto: bloco }];
  }
  const headerEnd = cnjs[0].index;
  const header = bloco.slice(0, Math.min(headerEnd, 1500));
  const out: Array<{ processo: string | null; texto: string }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < cnjs.length; i++) {
    const cur = cnjs[i];
    if (seen.has(cur.value)) continue;
    seen.add(cur.value);
    const next = cnjs[i + 1];
    const end = next ? next.index : Math.min(bloco.length, cur.index + 3000);
    const slice = bloco.slice(cur.index, end);
    const texto = (header && cur.index > 0 ? `${header}\n` : "") + slice;
    out.push({ processo: cur.value, texto: texto.length > 8000 ? texto.slice(0, 8000) : texto });
  }
  return out;
}

/**
 * Marcadores que iniciam uma pauta no caderno Judiciário.
 * Quebramos o texto sempre que um destes marcadores aparece, formando
 * blocos coesos que correspondem a "uma sessão / uma pauta".
 */
const PAUTA_MARKERS = [
  "PAUTA DE JULGAMENTO",
  "PAUTAS DE JULGAMENTO",
  "SESSÃO ORDINÁRIA",
  "SESSÃO EXTRAORDINÁRIA",
  "SESSÃO TELEPRESENCIAL",
  "SESSÃO DE JULGAMENTO",
  "PAUTA DA SESSÃO",
];

/**
 * Versão streaming do segmentByPauta: recebe pedaços de texto (ex.: páginas)
 * e emite blocos de pauta conforme os marcadores aparecem, sem manter o
 * caderno inteiro na memória.
 */
function makePautaStreamSegmenter() {
  const escaped = PAUTA_MARKERS.map((m) =>
    m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|");
  const markerRe = new RegExp(`(${escaped})`, "gi");
  let buf = "";
  let inBlock = false;

  function* flushSegments(text: string, final: boolean): Generator<string> {
    buf += text;
    while (true) {
      markerRe.lastIndex = 0;
      const first = markerRe.exec(buf);
      if (!first) {
        // Sem marcador: se já estávamos num bloco, mantém acumulando.
        // Se não estávamos e o buffer ficou grande, descarta o início (lixo).
        if (!inBlock && buf.length > 4000) buf = buf.slice(-2000);
        return;
      }
      if (!inBlock) {
        // Descarta tudo antes do primeiro marcador.
        buf = buf.slice(first.index);
        inBlock = true;
      }
      // Procura o próximo marcador depois do início atual para fechar o bloco.
      markerRe.lastIndex = 1;
      const next = markerRe.exec(buf);
      if (!next) {
        // Bloco aberto, mas não temos o próximo marcador ainda.
        if (final) {
          const bloco = buf.length > MAX_BLOCO_CHARS ? buf.slice(0, MAX_BLOCO_CHARS) : buf;
          buf = "";
          inBlock = false;
          yield bloco;
        } else if (buf.length > MAX_BUF_FLUSH_CHARS) {
          // Bloco "infinito" — mesmo limite do engine Browser para não cortar pautas grandes.
          yield buf.slice(0, MAX_BLOCO_CHARS);
          buf = buf.slice(-4000);
          inBlock = false;
        }
        return;
      }
      const bloco = buf.slice(0, next.index);
      yield bloco.length > MAX_BLOCO_CHARS ? bloco.slice(0, MAX_BLOCO_CHARS) : bloco;
      buf = buf.slice(next.index);
      // continua o while: pode haver mais blocos completos no buffer
    }
  }

  return {
    push(text: string): string[] {
      return Array.from(flushSegments(text, false));
    },
    end(): string[] {
      return Array.from(flushSegments("", true));
    },
  };
}

function extractCnj(text: string): string | null {
  const m = text.match(CNJ_REGEX);
  return m ? m[0] : null;
}

// Limite de tamanho do PDF. Subimos para 80MB porque o caderno do TRT2 (SP)
// passou de 65MB e era descartado, deixando a maior corte fora da busca.
const MAX_PDF_BYTES = 80 * 1024 * 1024; // 80 MB

/**
 * Itera as páginas do PDF, retornando o texto de cada uma. Libera cada página
 * imediatamente após o uso para manter RAM/CPU sob controle em cadernos grandes
 * (TRT1/TRT2/TRT5).
 */
async function* iteratePdfPages(
  uint8: Uint8Array,
  opts?: { pageStart?: number; pageEnd?: number; onNumPages?: (n: number) => void },
): AsyncGenerator<string> {
  // IMPORTANTE: usar o mesmo pdfjs-dist do Browser. `unpdf` extraía texto
  // diferente em alguns DEJTs (ex.: TRT10), deixando pautas reais invisíveis
  // no Servidor embora aparecessem no Browser.
  const pdf = await pdfjsLib.getDocument({
    data: uint8,
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    disableWorker: true,
  }).promise;
  try {
    const numPages = pdf.numPages ?? 0;
    if (opts?.onNumPages) opts.onNumPages(numPages);
    const start = Math.max(1, opts?.pageStart ?? 1);
    const end = Math.min(numPages, opts?.pageEnd ?? numPages);
    for (let i = start; i <= end; i++) {
      try {
        const page = await pdf.getPage(i);
        try {
          const content = await page.getTextContent();
          const items = (content?.items || []) as Array<{ str?: string; hasEOL?: boolean }>;
          let buf = "";
          for (const it of items) {
            buf += (it?.str || "");
            buf += it?.hasEOL ? "\n" : " ";
          }
          yield buf;
        } finally {
          try { page.cleanup?.(); } catch { /* ignore */ }
        }
      } catch (e) {
        console.log(`[DJET-Pautas] erro extraindo página ${i}:`, (e as Error)?.message || e);
      }
    }
  } finally {
    try { await pdf.destroy?.(); } catch { /* ignore */ }
  }
}

const MESES_PT: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  março: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

function calcularDataPublicacaoYmd(dataDispYmd: string): string {
  const base = new Date(`${dataDispYmd}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + 1);
  const estaNoRecesso = (d: Date) => {
    const mes = d.getUTCMonth();
    const dia = d.getUTCDate();
    return (mes === 11 && dia >= 20) || (mes === 0 && dia <= 6);
  };
  while (base.getUTCDay() === 0 || base.getUTCDay() === 6) {
    base.setUTCDate(base.getUTCDate() + 1);
  }
  if (estaNoRecesso(base)) {
    if (base.getUTCMonth() === 11) base.setUTCFullYear(base.getUTCFullYear() + 1);
    base.setUTCMonth(0);
    base.setUTCDate(7);
    while (base.getUTCDay() === 0 || base.getUTCDay() === 6) {
      base.setUTCDate(base.getUTCDate() + 1);
    }
  }
  return base.toISOString().slice(0, 10);
}

function parseDataDisponibilizacaoYmd(text: string): string | null {
  const compact = (text || "").replace(/\s+/g, " ");
  const numeric = compact.match(/Data\s+da\s+disponibilizaç[aã]o\s*:\s*(?:[^,.:]+,\s*)?(\d{2})\/(\d{2})\/(\d{4})/i);
  if (numeric) return `${numeric[3]}-${numeric[2]}-${numeric[1]}`;
  const extenso = compact.match(/Data\s+da\s+disponibilizaç[aã]o\s*:\s*(?:[^,.:]+,\s*)?(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (!extenso) return null;
  const mes = MESES_PT[normalize(extenso[2]).replace("marco", "marco")];
  if (!mes) return null;
  return `${extenso[3]}-${mes}-${extenso[1].padStart(2, "0")}`;
}

async function extractDataDisponibilizacaoYmd(uint8: Uint8Array): Promise<string | null> {
  try {
    for await (const pageText of iteratePdfPages(uint8, { pageStart: 1, pageEnd: 1 })) {
      const parsed = parseDataDisponibilizacaoYmd(pageText);
      if (parsed) return parsed;
    }
  } catch (e) {
    console.log("[DJET-Pautas] não foi possível ler a data interna do PDF:", (e as Error)?.message || e);
  }
  return null;
}

// ----------------------------------------------------------------------------
// Download do caderno: acesso direto e, quando bloqueado (403 do WAF do DEJT),
// pelo pool de proxies DJEN (VPS) via rota binária /fetch.
// ----------------------------------------------------------------------------
const PDF_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/pdf,*/*",
  "Referer": "https://dejt.jt.jus.br/",
};

let proxyPoolCache: Array<{ base_url: string; token: string }> | null = null;

async function getProxyPool(): Promise<Array<{ base_url: string; token: string }>> {
  if (proxyPoolCache) return proxyPoolCache;
  proxyPoolCache = [];
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return proxyPoolCache;
    const res = await fetch(
      `${url}/rest/v1/djen_proxy_pool?select=base_url,token,enabled,saude_status&enabled=eq.true&order=created_at.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return proxyPoolCache;
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    proxyPoolCache = (rows || [])
      .filter((r) => typeof r.base_url === "string" && typeof r.token === "string" && r.token)
      .filter((r) => r.saude_status !== "erro" && r.saude_status !== "offline")
      .map((r) => ({ base_url: String(r.base_url).replace(/\/+$/, ""), token: String(r.token) }));
  } catch (e) {
    console.log("[DJET-Pautas] falha ao carregar pool de proxies:", (e as Error)?.message || e);
  }
  return proxyPoolCache;
}

/**
 * Faz GET na URL do caderno. Tenta direto; em 403/451/429 (WAF) ou erro de
 * rede, repete a tentativa por cada VPS do pool DJEN.
 */
async function fetchCaderno(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { method: "GET", headers: PDF_HEADERS });
    if (res.ok) return res;
    console.log(`[DJET-Pautas] HTTP ${res.status} (direto) em ${url}`);
    await res.body?.cancel();
    if (![403, 429, 451, 503].includes(res.status)) return res;
  } catch (e) {
    console.log(`[DJET-Pautas] erro fetch direto ${url}:`, (e as Error)?.message || e);
  }

  const pool = await getProxyPool();
  for (const slot of pool) {
    try {
      const proxied = `${slot.base_url}/fetch?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxied, { headers: { "x-proxy-token": slot.token } });
      if (res.ok) {
        console.log(`[DJET-Pautas] obtido via proxy ${slot.base_url}: ${url}`);
        return res;
      }
      console.log(`[DJET-Pautas] proxy ${slot.base_url} devolveu HTTP ${res.status} para ${url}`);
      await res.body?.cancel();
    } catch (e) {
      console.log(`[DJET-Pautas] erro no proxy ${slot.base_url}:`, (e as Error)?.message || e);
    }
  }
  return null;
}

async function fetchPdf(
  tribunal: string,
  dataDDMMYYYY: string,
  caderno: DejtCaderno,
  aceitarEdicaoVigente = false,
): Promise<
  | { ok: true; bytes: Uint8Array; lastModified: string | null; dataDisponibilizacao: string | null; dataPublicacaoLegal: string | null }
  | { ok: false; reason: string; lastModified?: string | null; dataDisponibilizacao?: string | null; dataPublicacaoLegal?: string | null }
> {

  const urls = buildDejtPdfUrls(tribunal, dataDDMMYYYY, caderno);
  if (urls.length === 0) {
    return { ok: false, reason: "tribunal-sem-url" };
  }
  const requestedIso = ddmmyyyyToIso(dataDDMMYYYY) || dataDDMMYYYY;
  for (const url of urls) {
    try {
      console.log(`[DJET-Pautas] tentando ${url}`);
      const res = await fetchCaderno(url);
      if (!res || !res.ok) {
        continue;
      }

      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      const lastMod = res.headers.get("last-modified") || "";
      const buf = new Uint8Array(await res.arrayBuffer());
      // Verifica magic bytes "%PDF" para garantir
      const isPdfMagic =
        buf.length > 4 &&
        buf[0] === 0x25 && buf[1] === 0x50 &&
        buf[2] === 0x44 && buf[3] === 0x46;
      if (!ctype.includes("application/pdf") && !isPdfMagic) {
        console.log(`[DJET-Pautas] resposta não é PDF (${ctype}) em ${url}`);
        continue;
      }
      if (buf.length > MAX_PDF_BYTES) {
        console.log(
          `[DJET-Pautas] PDF muito grande (${buf.length} bytes > ${MAX_PDF_BYTES}); pulando ${url}`,
        );
        return { ok: false, reason: "pdf-muito-grande" };
      }
      // A data juridicamente relevante do DEJT é a publicação no próximo dia
      // útil após a disponibilização. Ex.: PDF disponibilizado em sex. 03/07
      // é a edição publicada em seg. 06/07. Last-Modified sozinho é enganoso.
      const dataDisponibilizacao = await extractDataDisponibilizacaoYmd(buf);
      const dataPublicacaoLegal = dataDisponibilizacao
        ? calcularDataPublicacaoYmd(dataDisponibilizacao)
        : null;
      const outraData = !!dataDisponibilizacao &&
        dataDisponibilizacao !== requestedIso &&
        dataPublicacaoLegal !== requestedIso;
      if (outraData && aceitarEdicaoVigente) {
        console.log(
          `[DJET-Pautas] aceitando edição vigente para pedido ${dataDDMMYYYY}: ` +
          `disponibilização=${dataDisponibilizacao}, publicação=${dataPublicacaoLegal}, last-modified=${lastMod}`,
        );
      } else if (outraData) {
        console.log(
          `[DJET-Pautas] caderno de outra data para pedido ${dataDDMMYYYY}: ` +
          `disponibilização=${dataDisponibilizacao}, publicação=${dataPublicacaoLegal}, last-modified=${lastMod}`,
        );
        return {
          ok: false,
          reason: dataPublicacaoLegal && dataPublicacaoLegal < requestedIso ? "caderno-nao-atualizado" : "caderno-de-outra-data",
          lastModified: lastMod || null,
          dataDisponibilizacao,
          dataPublicacaoLegal,
        };
      }

      return { ok: true, bytes: buf, lastModified: lastMod || null, dataDisponibilizacao, dataPublicacaoLegal };
    } catch (e) {
      console.log(`[DJET-Pautas] erro fetch ${url}:`, e);
    }
  }
  return { ok: false, reason: "no-pdf" };
}

async function fetchPdfStream(
  tribunal: string,
  dataDDMMYYYY: string,
  caderno: DejtCaderno,
): Promise<{ ok: true; response: Response; url: string; bytes: number | null } | { ok: false; reason: string }> {
  const urls = buildDejtPdfUrls(tribunal, dataDDMMYYYY, caderno);
  if (urls.length === 0) return { ok: false, reason: "tribunal-sem-url" };

  const todayBrt = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (dataDDMMYYYY !== todayBrt) return { ok: false, reason: "data-historica-indisponivel" };

  for (const url of urls) {
    try {
      console.log(`[DJET-Pautas] proxy PDF ${url}`);
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/pdf,*/*",
          "Referer": "https://dejt.jt.jus.br/",
        },
      });
      if (!res.ok) {
        console.log(`[DJET-Pautas] HTTP ${res.status} em ${url}`);
        continue;
      }
      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      if (!ctype.includes("application/pdf")) {
        console.log(`[DJET-Pautas] resposta não é PDF (${ctype}) em ${url}`);
        continue;
      }
      const bytes = Number(res.headers.get("content-length") || "") || null;
      return { ok: true, response: res, url, bytes };
    } catch (e) {
      console.log(`[DJET-Pautas] erro proxy ${url}:`, e);
    }
  }
  return { ok: false, reason: "no-pdf" };
}

/**
 * Verifica se o bloco da pauta atende à condição concomitante do
 * monitoramento. Replica a função `condicaoConcomitanteAtendida` usada
 * no DJEN Termos (engine paralela): grupos separados por `|` em OR,
 * termos dentro de um grupo separados por `,` em AND.
 */
function condicaoConcomitanteAtendidaBloco(
  blocoNorm: string,
  condicao?: string | null,
): boolean {
  if (!condicao) return true;
  const grupos = String(condicao)
    .split("|")
    .map((g) => g.trim())
    .filter(Boolean);
  if (grupos.length === 0) return true;
  return grupos.some((g) => {
    const ts = g.split(",").map((t) => t.trim()).filter(Boolean);
    if (ts.length === 0) return true;
    return ts.every((t) => {
      const tn = normalize(t);
      return tn ? blocoNorm.includes(tn) : false;
    });
  });
}

function matchBlocoMonitoramento(
  blocoNorm: string,
  mon: MonitoramentoInput,
): string | null {
  // Exclusões: se qualquer exclusão aparece, descarta.
  if (mon.exclusoes && mon.exclusoes.length > 0) {
    for (const ex of mon.exclusoes) {
      const exN = normalize(ex);
      if (exN && blocoNorm.includes(exN)) return null;
    }
  }
  // Condição concomitante (OR de grupos AND, igual ao DJEN Termos).
  // Se definida e não atendida, descarta o bloco para este monitoramento.
  if (!condicaoConcomitanteAtendidaBloco(blocoNorm, mon.condicaoConcomitante)) {
    return null;
  }
  // Termos: qualquer match positivo já basta.
  for (const t of mon.termos || []) {
    const tn = normalize(t);
    if (tn && blocoNorm.includes(tn)) return t;
  }
  // OAB: número simples (ex.: "123456/SP" -> casa "oab 123456 sp" / "oab/sp 123456")
  if (mon.oab) {
    const digits = mon.oab.replace(/\D/g, "");
    if (digits && new RegExp(`\\boab\\b[^a-z0-9]{0,8}${digits}\\b`).test(blocoNorm)) {
      return `OAB ${mon.oab}`;
    }
    if (digits && new RegExp(`\\b${digits}\\b[^a-z0-9]{0,8}oab\\b`).test(blocoNorm)) {
      return `OAB ${mon.oab}`;
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth (verify_jwt = true via config). Aqui só validamos que veio.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body || !body.tribunal || !body.dataDDMMYYYY) {
      return new Response(
        JSON.stringify({ error: "tribunal e dataDDMMYYYY são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tribunal = body.tribunal.toUpperCase();
    const tribInfo = getDejtTribunal(tribunal);
    if (!tribInfo) {
      return new Response(
        JSON.stringify({ error: `tribunal '${tribunal}' não suportado pelo DEJT` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const caderno: DejtCaderno = body.caderno || "judiciario";
    const dataIso = ddmmyyyyToIso(body.dataDDMMYYYY) || body.dataDDMMYYYY;
    const monitoramentos = body.monitoramentos || [];

    if (body.downloadOnly) {
      const proxied = await fetchPdfStream(tribunal, body.dataDDMMYYYY, caderno);
      if (!proxied.ok) {
        return new Response(JSON.stringify({ ok: false, sem_dados: true, motivo: proxied.reason, tribunal, dataPublicacao: dataIso }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(proxied.response.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "X-DEJT-PDF-URL": proxied.url,
          ...(proxied.bytes ? { "Content-Length": String(proxied.bytes) } : {}),
        },
      });
    }

    // 1) Baixa PDF (com fallback de URLs)
    const fetched = await fetchPdf(tribunal, body.dataDDMMYYYY, caderno, body.aceitarEdicaoVigente === true);
    if (!fetched.ok) {
      return new Response(
        JSON.stringify({
          ok: true,
          sem_dados: true,
          motivo: fetched.reason,
          lastModified: fetched.lastModified ?? null,
          dataDisponibilizacao: fetched.dataDisponibilizacao ?? null,
          dataPublicacaoLegal: fetched.dataPublicacaoLegal ?? null,
          tribunal,
          dataPublicacao: dataIso,
          matches: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (monitoramentos.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          sem_dados: false,
          motivo: "sem-monitoramentos",
          tribunal,
          dataPublicacao: dataIso,
          totalBlocos: 0,
          matches: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2-4) Extrai página-a-página, segmenta em blocos e casa termos em streaming.
    // Nunca mantém o caderno inteiro em memória — crítico para PDFs grandes
    // (TRT1/TRT2/TRT5) que estouravam o limite de CPU/RAM do worker.
    const matches: MatchOut[] = [];
    let totalBlocos = 0;
    const seg = makePautaStreamSegmenter();
    let numPagesPdf = 0;
    const pageStart = Math.max(1, Number(body.pageStart) || 1);
    const pageEnd = body.pageEnd && Number(body.pageEnd) > 0 ? Number(body.pageEnd) : undefined;

    const processBloco = async (rawBloco: string) => {
      totalBlocos++;
      // Alguns cadernos (TRT5, TRT1, TRT2) vêm com letter-spacing no PDF.
      // Colapsa "O S M A R" → "OSMAR" e "0 0 0 0 0 3 9" → "0000039" antes
      // do split por CNJ e do match de termos.
      const bloco = collapseLetterSpacing(rawBloco);
      // Quebra o bloco em sub-blocos por processo (igual ao engine browser)
      // para casar termos individualmente por CNJ, e não no bloco inteiro.
      const subBlocos = splitBlocoByProcessos(bloco);
      for (const sub of subBlocos) {
        const subNorm = normalize(sub.texto);
        for (const mon of monitoramentos) {
          const hit = matchBlocoMonitoramento(subNorm, mon);
          if (!hit) continue;
          const conteudo = sub.texto.trim();
          // Dedup de pauta = coordenação + processo + conteúdo SEM intimados.
          const hash = await sha256Hex(
            `${mon.coordenacao_id ?? ""}|${digitsProcessoPauta(sub.processo)}|${normalize(stripIntimadosPauta(conteudo))}`,
          );
          matches.push({
            monitoramentoId: mon.id,
            termoMatch: hit,
            processo: sub.processo,
            conteudo,
            hash,
            dataPublicacao: fetched.dataDisponibilizacao || dataIso,
            fonte: "dejt-pdf",
            tribunal,
          });
        }
      }
    };

    try {
      for await (
        const pageText of iteratePdfPages(fetched.bytes, {
          pageStart,
          pageEnd,
          onNumPages: (n) => { numPagesPdf = n; },
        })
      ) {
        for (const bloco of seg.push(pageText)) await processBloco(bloco);
      }
      for (const bloco of seg.end()) await processBloco(bloco);
    } catch (e) {
      console.error("[DJET-Pautas] erro extraindo texto:", e);
      return new Response(
        JSON.stringify({
          ok: true,
          sem_dados: matches.length === 0,
          motivo: "extract-failed",
          erro: String((e as Error)?.message || e),
          tribunal,
          dataPublicacao: dataIso,
          totalBlocos,
          matches,
          numPages: numPagesPdf,
          pageStart,
          pageEnd: pageEnd ?? numPagesPdf,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[DJET-Pautas] ${tribunal} ${body.dataDDMMYYYY} p${pageStart}-${pageEnd ?? numPagesPdf}/${numPagesPdf}: ${totalBlocos} blocos, ${matches.length} match(es)`);

    return new Response(
      JSON.stringify({
        ok: true,
        tribunal,
        dataPublicacao: dataIso,
        dataDisponibilizacao: fetched.dataDisponibilizacao || dataIso,
        dataPublicacaoLegal: fetched.dataPublicacaoLegal || calcularDataPublicacaoYmd(fetched.dataDisponibilizacao || dataIso),
        totalBlocos,
        matches,
        numPages: numPagesPdf,
        pageStart,
        pageEnd: pageEnd ?? numPagesPdf,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[DJET-Pautas] erro inesperado:", e);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: String((e as Error)?.message || e),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});