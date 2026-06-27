/**
 * buscar-dejt-pautas
 *
 * Baixa o PDF do caderno Judiciário do DEJT para um (tribunal, dia),
 * extrai o texto, segmenta em blocos de pauta e retorna os blocos que
 * casam com termos/OAB/exclusões dos monitoramentos informados.
 *
 * Não persiste nada — quem grava em publicacoes_djen é o engine browser.
 */

import { getDocumentProxy } from "npm:unpdf@0.12.1";
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
}

interface RequestBody {
  tribunal: string;          // TST | TRTx
  dataDDMMYYYY: string;      // 29/04/2026
  caderno?: DejtCaderno;     // default 'judiciario'
  downloadOnly?: boolean;    // true = atua só como proxy CORS do PDF, sem extrair texto no worker
  monitoramentos: MonitoramentoInput[];
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
async function* iteratePdfPages(uint8: Uint8Array): AsyncGenerator<string> {
  interface PdfTextPage {
    getTextContent(): Promise<{ items?: Array<{ str?: string; hasEOL?: boolean }> }>;
    cleanup?: () => void;
  }
  interface PdfDoc {
    numPages?: number;
    getPage(pageNumber: number): Promise<PdfTextPage>;
    destroy?: () => Promise<void> | void;
  }
  const pdf = await getDocumentProxy(uint8, {
    disableFontFace: true,
    useSystemFonts: false,
  } as never) as unknown as PdfDoc;
  try {
    const numPages = pdf.numPages ?? 0;
    for (let i = 1; i <= numPages; i++) {
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

async function fetchPdf(
  tribunal: string,
  dataDDMMYYYY: string,
  caderno: DejtCaderno,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: string }> {
  const urls = buildDejtPdfUrls(tribunal, dataDDMMYYYY, caderno);
  if (urls.length === 0) {
    return { ok: false, reason: "tribunal-sem-url" };
  }
  // Hoje em São Paulo (DEJT publica caderno do dia)
  const todayBrt = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }); // dd/mm/yyyy
  const isToday = dataDDMMYYYY === todayBrt;
  for (const url of urls) {
    try {
      console.log(`[DJET-Pautas] tentando ${url}`);
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/pdf,*/*",
          "Referer": "https://dejt.jt.jus.br/",
        },
      });
      if (!res.ok) {
        console.log(`[DJET-Pautas] HTTP ${res.status} em ${url}`);
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
      // O endpoint público só serve o caderno vigente. Se a data pedida
      // não é hoje, o PDF retornado é de outro dia — descarta.
      if (!isToday) {
        console.log(
          `[DJET-Pautas] data ${dataDDMMYYYY} != hoje (${todayBrt}); ` +
          `endpoint público só serve caderno vigente (last-modified=${lastMod}).`,
        );
        return { ok: false, reason: "data-historica-indisponivel" };
      }
      return { ok: true, bytes: buf };
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
    const fetched = await fetchPdf(tribunal, body.dataDDMMYYYY, caderno);
    if (!fetched.ok) {
      return new Response(
        JSON.stringify({
          ok: true,
          sem_dados: true,
          motivo: fetched.reason,
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

    const processBloco = async (bloco: string) => {
      totalBlocos++;
      // Quebra o bloco em sub-blocos por processo (igual ao engine browser)
      // para casar termos individualmente por CNJ, e não no bloco inteiro.
      const subBlocos = splitBlocoByProcessos(bloco);
      for (const sub of subBlocos) {
        const subNorm = normalize(sub.texto);
        for (const mon of monitoramentos) {
          const hit = matchBlocoMonitoramento(subNorm, mon);
          if (!hit) continue;
          const conteudo = sub.texto.trim();
          const hash = await sha256Hex(
            `${mon.id}|${tribunal}|${dataIso}|${sub.processo || ""}|${conteudo.slice(0, 1024)}`,
          );
          matches.push({
            monitoramentoId: mon.id,
            termoMatch: hit,
            processo: sub.processo,
            conteudo,
            hash,
            dataPublicacao: dataIso,
            fonte: "dejt-pdf",
            tribunal,
          });
        }
      }
    };

    try {
      for await (const pageText of iteratePdfPages(fetched.bytes)) {
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
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[DJET-Pautas] ${tribunal} ${body.dataDDMMYYYY}: ${totalBlocos} blocos`);

    return new Response(
      JSON.stringify({
        ok: true,
        tribunal,
        dataPublicacao: dataIso,
        totalBlocos,
        matches,
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