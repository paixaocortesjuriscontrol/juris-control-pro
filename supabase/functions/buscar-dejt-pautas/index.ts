/**
 * buscar-dejt-pautas
 *
 * Baixa o PDF do caderno Judiciário do DEJT para um (tribunal, dia),
 * extrai o texto, segmenta em blocos de pauta e retorna os blocos que
 * casam com termos/OAB/exclusões dos monitoramentos informados.
 *
 * Não persiste nada — quem grava em publicacoes_djen é o engine browser.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
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

function segmentByPauta(fullText: string): string[] {
  if (!fullText) return [];
  // Constrói um regex global que captura qualquer marcador (case-insensitive),
  // sem perder o conteúdo. Usamos split com lookahead.
  const escaped = PAUTA_MARKERS.map((m) =>
    m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|");
  const re = new RegExp(`(?=(${escaped}))`, "gi");
  const parts = fullText.split(re).filter(Boolean);

  // O split com lookahead pode duplicar o marcador entre os elementos;
  // filtramos só os blocos que efetivamente começam com um marcador.
  const blocks: string[] = [];
  for (const p of parts) {
    const head = p.slice(0, 80).toUpperCase();
    if (PAUTA_MARKERS.some((m) => head.includes(m))) {
      // Limita tamanho para evitar blocos gigantes (cap em 8 KB)
      blocks.push(p.length > 8000 ? p.slice(0, 8000) : p);
    }
  }
  return blocks;
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
  const pdf = await getDocumentProxy(uint8, {
    disableFontFace: true,
    useSystemFonts: false,
  } as any);
  try {
    const numPages = (pdf as any).numPages ?? 0;
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await (pdf as any).getPage(i);
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
          try { (page as any)?.cleanup?.(); } catch { /* ignore */ }
        }
      } catch (e) {
        console.log(`[DJET-Pautas] erro extraindo página ${i}:`, (e as Error)?.message || e);
      }
    }
  } finally {
    try { await (pdf as any)?.destroy?.(); } catch { /* ignore */ }
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

    // 2) Extrai texto
    let fullText = "";
    try {
      fullText = await bufferToText(fetched.bytes);
    } catch (e) {
      console.error("[DJET-Pautas] erro extraindo texto:", e);
      return new Response(
        JSON.stringify({
          ok: true,
          sem_dados: true,
          motivo: "extract-failed",
          erro: String((e as Error)?.message || e),
          tribunal,
          dataPublicacao: dataIso,
          matches: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Segmenta em blocos de pauta
    const blocos = segmentByPauta(fullText);
    console.log(`[DJET-Pautas] ${tribunal} ${body.dataDDMMYYYY}: ${blocos.length} blocos`);

    if (blocos.length === 0 || monitoramentos.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          sem_dados: blocos.length === 0,
          motivo: blocos.length === 0 ? "sem-pauta" : "sem-monitoramentos",
          tribunal,
          dataPublicacao: dataIso,
          totalBlocos: blocos.length,
          matches: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4) Casa termos
    const matches: MatchOut[] = [];
    for (const bloco of blocos) {
      const blocoNorm = normalize(bloco);
      const processo = extractCnj(bloco);
      for (const mon of monitoramentos) {
        const hit = matchBlocoMonitoramento(blocoNorm, mon);
        if (!hit) continue;
        const conteudo = bloco.trim();
        const hash = await sha256Hex(
          `${mon.id}|${tribunal}|${dataIso}|${processo || ""}|${conteudo.slice(0, 1024)}`,
        );
        matches.push({
          monitoramentoId: mon.id,
          termoMatch: hit,
          processo,
          conteudo,
          hash,
          dataPublicacao: dataIso,
          fonte: "dejt-pdf",
          tribunal,
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        tribunal,
        dataPublicacao: dataIso,
        totalBlocos: blocos.length,
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