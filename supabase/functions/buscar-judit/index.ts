// supabase/functions/buscar-judit/index.ts
//
// Substituição da versão anterior. Mudança principal: usa o fluxo ASSÍNCRONO
// documentado da Judit (requests.prod.judit.io/requests + polling em /responses)
// em vez do endpoint legacy lawsuits.production.judit.io/lawsuits/{cnj}.
//
// Por que a versão anterior não achava nada do TST:
//   O endpoint lawsuits/{cnj} é um lookup de cache que retorna 1 instância
//   (geralmente a 1ª, TRT). Não dispara crawler e não agrega instâncias.
//   O fluxo /requests aciona os crawlers e devolve TRT1, TRT2 e TST juntos
//   em page_data[], e aí é só escolher a entrada com tribunal_acronym=TST.
//
// Contrato com o front-end preservado: mesma forma do `result` de retorno.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  extrairOrgaoJulgador,
  derivarTurmaDoRelator,
  derivarRelatorDaTurma,
} from "../_shared/extrair-relator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const JUDIT_BASE = "https://requests.prod.judit.io";
const REQUESTS_URL = `${JUDIT_BASE}/requests`;
const RESPONSES_URL = `${JUDIT_BASE}/responses`;
const LAWSUITS_BASE = "https://lawsuits.production.judit.io/lawsuits";

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 12_000;    // mantém o botão Judit responsivo; DataJud/cache complementam o TST
const CACHE_TTL_DAYS = 7;

// ---------- DataJud fallback (CNJ public API) -----------------------------
const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";

interface DataJudOrgao {
  relator: string | null;
  turma: string | null;
  dataDistribuicao: string | null;
  classe: string | null;
  orgaoJulgador: string | null;
  steps: any[];
  courts: any[];
}

async function consultarDataJud(cnj: string): Promise<DataJudOrgao | null> {
  try {
    const digits = cnj.replace(/\D/g, "");
    // Determinar endpoint pelo segmento de justiça (posição 14, 0-indexed 13)
    const segmento = digits.charAt(13);
    let endpoint = "api_publica_tst";
    if (segmento === "5") {
      // Justiça do Trabalho — tentar TST primeiro
      endpoint = "api_publica_tst";
    }

    const url = `${DATAJUD_BASE}/${endpoint}/_search`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: digits } },
        size: 1,
        _source: ["orgaoJulgador", "classe", "dataAjuizamento", "relator", "movimentos"],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!r.ok) {
      console.log(`[buscar-judit][datajud] HTTP ${r.status}`);
      return null;
    }

    const data = await r.json();
    const hits = data?.hits?.hits || [];
    if (hits.length === 0) {
      console.log("[buscar-judit][datajud] Nenhum resultado");
      return null;
    }

    const src = hits[0]._source;
    const movimentos = Array.isArray(src?.movimentos) ? src.movimentos : [];
    const orgaos = movimentos
      .map((m: any) => m?.orgaoJulgador?.nome)
      .filter((nome: any) => typeof nome === "string" && nome.trim());
    const orgaoRaiz = src?.orgaoJulgador || {};
    const nomeOrgao =
      orgaos.find((nome: string) => /gab\.?\s+d[ao]\s+ministr[ao]|ministr[ao]/i.test(nome)) ||
      orgaos[0] ||
      orgaoRaiz?.nomeOrgao ||
      orgaoRaiz?.nome ||
      "";

    // Extrair turma do nomeOrgao (ex: "6ª Turma", "Gabinete do Ministro X")
    let turma: string | null = null;
    const mTurma = nomeOrgao.match(/(\d+)[ªºa]?\s*turma/i);
    if (mTurma) {
      turma = `${mTurma[1]}ª Turma`;
    } else if (/sdi|sbdi|se[çc][aã]o|tribunal\s+pleno|[oó]rg[aã]o\s+especial/i.test(nomeOrgao)) {
      turma = nomeOrgao;
    }

    // Extrair relator do nomeOrgao (ex: "Gabinete do Ministro Antônio Fabrício...")
    let relator: string | null = null;
    const mGab = nomeOrgao.match(/(?:(?:Gabinete|Gab\.)\s+[-–]?\s*d[oa]\s+)?(?:Ministro|Ministra|Min\.?|Desembargador(?:a)?)\s+(.+)/i);
    if (mGab) {
      relator = mGab[1].trim().replace(/[.,;()\-]+$/, "");
    }

    // Classe processual
    const classe = src?.classe?.nome || null;

    // Data
    const rawDataAjuiz = (src?.dataAjuizamento || "").toString();
    const dataAjuiz = /^\d{8}/.test(rawDataAjuiz)
      ? `${rawDataAjuiz.substring(0, 4)}-${rawDataAjuiz.substring(4, 6)}-${rawDataAjuiz.substring(6, 8)}`
      : rawDataAjuiz.substring(0, 10) || null;

    const steps = movimentos.map((m: any) => {
      const complementos = Array.isArray(m?.complementosTabelados)
        ? m.complementosTabelados
            .flatMap((c: any) => [c?.nome, c?.valor, c?.descricao])
            .filter((v: any) => typeof v === "string" && v.trim())
        : [];
      return ({
      step_date: m?.dataHora || null,
      date: m?.dataHora || null,
      code: m?.codigo ?? null,
      content: [m?.nome, ...complementos, m?.orgaoJulgador?.nome].filter(Boolean).join(" - "),
      title: m?.nome || null,
      orgao_julgador: m?.orgaoJulgador || null,
      raw: m,
    });
    });
    const courts = nomeOrgao ? [{ code: orgaoRaiz?.codigo?.toString?.() || "TST", name: nomeOrgao }] : [];

    console.log(`[buscar-judit][datajud] orgao=${nomeOrgao} relator=${relator} turma=${turma} classe=${classe}`);
    return { relator, turma, dataDistribuicao: dataAjuiz, classe, orgaoJulgador: nomeOrgao || null, steps, courts };
  } catch (e) {
    console.log(`[buscar-judit][datajud] erro: ${(e as Error).message}`);
    return null;
  }
}

// ---------- Cache-first: lookup direto no datalake (instantâneo) ----------

async function juditLookupCache(
  apiKey: string,
  cnj: string,
): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s max
    const r = await fetch(`${LAWSUITS_BASE}/${encodeURIComponent(cnj)}`, {
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!r.ok) {
      await r.text(); // consume body
      return null;
    }
    const data = await r.json();
    // O endpoint retorna um objeto com response_data ou diretamente os dados
    const rd = data?.response_data || data;
    if (!rd || typeof rd !== "object") return null;
    // Verificar se tem dados mínimos úteis
    if (!rd.steps?.length && !rd.courts?.length && !rd.parties?.length) return null;
    console.log(`[buscar-judit] Cache hit! steps=${rd.steps?.length || 0}`);
    return rd;
  } catch (e) {
    console.log(`[buscar-judit] Cache miss/error: ${(e as Error).message}`);
    return null;
  }
}

// ---------- Judit async client --------------------------------------------

async function juditCriarRequest(
  apiKey: string,
  cnj: string,
): Promise<{ request_id: string } | { error: string; status: number }> {
  const body = {
    search: {
      search_type: "lawsuit_cnj",
      search_key: cnj,
      response_type: "lawsuit",
      cache_ttl_in_days: CACHE_TTL_DAYS,
    },
  };

  const r = await fetch(REQUESTS_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text();
    console.error(`POST /requests ${r.status}: ${text}`);
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.error?.message || parsed?.error?.data || parsed?.message || text;
    } catch (_) { /* keep raw */ }
    return { error: msg, status: r.status };
  }
  const data = await r.json();
  return { request_id: data.request_id };
}

async function juditPollRespostas(
  apiKey: string,
  requestId: string,
): Promise<any | null> {
  // CORREÇÃO: request_status fica no NÍVEL RAIZ, não dentro de page_data[i].
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let ultima: any = null;

  while (Date.now() < deadline) {
    try {
      const url = new URL(RESPONSES_URL);
      url.searchParams.set("request_id", requestId);
      url.searchParams.set("page_size", "50");

      const r = await fetch(url.toString(), {
        headers: { "api-key": apiKey },
      });

      if (r.status === 429) {
        await sleep(5000);
        continue;
      }
      if (!r.ok) {
        console.error(`GET /responses ${r.status}: ${await r.text()}`);
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      const data = await r.json();
      ultima = data;
      const status = data.request_status;
      console.log(`Polling ${requestId}: status=${status}, instancias=${(data.page_data || []).length}`);
      if (status === "completed") return data;
      if (status === "cancelled" || status === "cancelling") return data;
    } catch (e) {
      console.error("Polling error:", e);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  console.warn(`Timeout após ${POLL_TIMEOUT_MS}ms, retornando último parcial`);
  return ultima; // devolve parcial: o selecionador ainda pode extrair algo
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// ---------- seleção de instância ------------------------------------------

function temIndicioTST(rd: any): boolean {
  // 0) Se o tribunal_acronym já existe e NÃO é TST, descartar imediatamente.
  // Isso impede que instâncias TRT/TRF sejam confundidas com TST por causa
  // de classificações compartilhadas (ex.: "RO" e "AIRR" também existem no TRT).
  const acronym = (rd?.tribunal_acronym || "").toString().toUpperCase();
  if (acronym && acronym !== "TST") return false;
  if (acronym === "TST") return true;

  const courts = Array.isArray(rd.courts) ? rd.courts : [];
  for (const c of courts) {
    const nome = (c?.name || "").toString();
    // "Ministro" só existe em tribunais superiores; exigir contexto TST
    if (/\bTST\b/i.test(nome)) return true;
    if (/ministr[oa]/i.test(nome) && /TST|TRIBUNAL\s+SUPERIOR/i.test(nome)) return true;
  }
  // classifications EXCLUSIVAS de TST (RR/AIRR/Ag-AIRR/ARR/ED-RR/ED-AIRR)
  // RO e ROAG existem também no TRT — NÃO usar como indicador.
  const classes = Array.isArray(rd.classifications) ? rd.classifications : [];
  for (const cl of classes) {
    const n = (cl?.name || "").toUpperCase();
    if (/^(RR|AIRR|AG-AIRR|ARR|ED-RR|ED-AIRR)$/.test(n)) return true;
  }
  return false;
}

function selecionarInstancia(pageData: any[], tribunalHint?: string | null): any | null {
  if (!pageData?.length) return null;

  const rds = pageData
    .map((item) => item?.response_data)
    .filter((rd) => rd && typeof rd === "object");

  if (!rds.length) return null;

  // 0) Se o front informou tribunal, tentar achar exato pelo acronym
  if (tribunalHint) {
    const hint = tribunalHint.toUpperCase();
    const match = rds.find((rd) => (rd.tribunal_acronym || "").toUpperCase() === hint);
    if (match) {
      console.log(`[buscar-judit] instância selecionada por hint tribunal=${hint}`);
      return match;
    }
    // Se hint=TST, também aceitar por indícios
    if (hint === "TST") {
      const tstInd = rds.find((rd) => temIndicioTST(rd));
      if (tstInd) {
        console.log(`[buscar-judit] instância selecionada por indício TST (hint)`);
        return tstInd;
      }
    }
    // Hint foi informado mas não bateu — match parcial por prefixo (ex: hint=TRT4 cobre TRT04)
    const hintDigits = hint.replace(/\D/g, "");
    const partial = rds.find((rd) => {
      const t = (rd.tribunal_acronym || "").toUpperCase();
      if (!t) return false;
      if (t.startsWith(hint) || hint.startsWith(t)) return true;
      const td = t.replace(/\D/g, "");
      return hintDigits && td && (td === hintDigits || td.endsWith(hintDigits) || hintDigits.endsWith(td))
        && t.replace(/\d/g, "") === hint.replace(/\d/g, "");
    });
    if (partial) {
      console.log(`[buscar-judit] instância selecionada por hint parcial=${hint} -> ${partial.tribunal_acronym}`);
      return partial;
    }
    // Hint informado mas não encontrado: NÃO cair em outro tribunal automaticamente.
    console.log(`[buscar-judit] hint=${hint} não localizado entre instâncias [${rds.map(r=>r.tribunal_acronym).join(",")}] — retornando null`);
    return null;
  }

  // 1) TST/STF/STJ explícito por acronym
  const tst = rds.find((rd) => {
    const t = (rd.tribunal_acronym || "").toUpperCase();
    return t === "TST" || t === "STF" || t === "STJ";
  });
  if (tst) return tst;

  // 2) Detectar TST por indícios (Gabinete de Ministro, classificação AIRR etc)
  const tstIndicio = rds.find((rd) => temIndicioTST(rd));
  if (tstIndicio) return tstIndicio;

  // 3) maior instance
  return rds.reduce((a, b) => ((b.instance ?? 0) > (a.instance ?? 0) ? b : a));
}

// ---------- helpers de parsing --------------------------------------------

function toDateBR(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  } catch {
    return null;
  }
}

function toDateISO(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return iso.substring(0, 10);
  } catch {
    return null;
  }
}

const MAP_RECURSO: Array<[RegExp, string]> = [
  [/agravo.*instrumento.*recurso.*revista/i, "Agravo de Instrumento - Recurso de Revista"],
  [/recurso.*revista.*agravo.*instrumento/i, "Recurso de Revista - Agravo de Instrumento"],
  [/embargos.*declara/i, "Embargos de Declaração"],
  [/embargos/i, "Embargos"],
  [/agravo.*instrumento/i, "Agravo de Instrumento"],
  [/recurso.*revista/i, "Recurso de Revista"],
  [/agravo.*regimental/i, "Agravo Regimental"],
  [/agravo/i, "Agravo"],
];

// Mapeamento de tipos de recurso para abreviações usadas no campo combinado.
const MAP_RECURSO_INTERPOSTO: Array<[RegExp, string]> = [
  [/agravo\s+de\s+instrumento\s+em\s+recurso\s+de\s+revista|agravo\s+de\s+instrumento.*recurso\s+de\s+revista|\bAIRR\b/i, "AIRR"],
  [/embargos?\s+de\s+declara[çc][ãa]o|\bED\b|\bEDcl\b/i, "ED"],
  [/embargos?\s+(?:à|a)\s+execu[çc][ãa]o|\bEE\b/i, "EE"],
  [/embargos\b/i, "E"],
  [/recurso\s+de\s+revista|\bRR\b/i, "RR"],
  [/recurso\s+ordin[áa]rio|\bRO\b/i, "RO"],
  [/agravo\s+regimental|\bAgR\b|\bAGR\b/i, "AgR"],
  [/agravo\s+de\s+petic[ãa]o|\bAP\b/i, "AP"],
  [/agravo\s+interno|\bAgInt\b/i, "AgInt"],
  [/agravo\s+de\s+instrumento|\bAI\b/i, "AI"],
  [/agravo\b/i, "Ag"],
  [/recurso\s+extraordin[áa]rio|\bRE\b/i, "RE"],
  [/recurso\s+especial|\bREsp\b/i, "REsp"],
];

function classificarRecursoInterposto(texto: string): string | null {
  const t = (texto || "").toString();
  for (const [rx, sigla] of MAP_RECURSO_INTERPOSTO) {
    if (rx.test(t)) return sigla;
  }
  return null;
}

function normalizarListaRecursos(value: string | null): string | null {
  const parts = (value || "")
    .split(/\s*\+\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const part of parts) {
    const key = normalizePlain(part);
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(part);
  }
  return clean.length ? clean.join(" + ") : null;
}

/**
 * Mapeia o tipo_pessoa retornado pela Judit para o lado ORIGINAL no processo
 * (ACTIVE = polo ativo / reclamante; PASSIVE = polo passivo / reclamada).
 * Retorna null para tipos genéricos de peça recursal (AGRAVANTE, RECORRENTE,
 * AGRAVADO, RECORRIDO) que não indicam o lado original — esses casos devem
 * cair para o `side` da Judit.
 */
function ladoPorPersonType(personType: string): "ACTIVE" | "PASSIVE" | null {
  const t = (personType || "").toString().toUpperCase().trim();
  if (!t) return null;
  if (/(RECLAMANTE|AUTOR|AUTORA|EXEQUENTE|REQUERENTE|IMPETRANTE)/.test(t)) {
    return "ACTIVE";
  }
  if (/(RECLAMAD|R[ÉE]U|R[ÉE]|EXECUTAD|REQUERID|IMPETRAD|LITISCONSORTE\s+PASSIV)/.test(t)) {
    return "PASSIVE";
  }
  return null;
}

function isParteBanco(nome: string): boolean {
  const n = normalizePlain(nome || "");
  return /\b(BANCO|SANTANDER|BRADESCO|ITAU|ITAÚ|AYMORE|AYMOR[ÉE]|FINANCEIRA|CREDITO,?\s+FINANCIAMENTO|CAIXA\s+ECONOMICA|CAIXA\s+ECONÔMICA|CEF|BANRISUL|SAFRA|BMG|C6\s+BANK|BANCO\s+DO\s+BRASIL)\b/.test(n);
}

/**
 * TST: a Judit retorna `distribution_date` e `judge` da CAPA, que pode ser a
 * distribuição original (anos atrás, em outro tribunal) ou um gabinete que
 * não é mais o atual. Regra do projeto: SEMPRE usar o último step de
 * Distribuição/Redistribuição cujo órgão julgador seja um Gabinete de
 * Ministro. Passagens por Presidência/Vice/Corregedoria NÃO contam como
 * destino final — continuamos buscando o gabinete anterior na linha do tempo.
 */
function extrairUltimaDistribuicaoTst(steps: any[]): {
  data: string | null;
  relator: string | null;
  turma: string | null;
  orgao: string | null;
} | null {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const ehDistribuicao = (s: any): boolean => {
    const code = String(s?.code ?? s?.movement_code ?? "").trim();
    if (code === "26" || code === "36" || code === "51") return true;
    const txt = String(s?.title || s?.content || s?.description || "");
    return /\b(re)?distribui[çc][ãa]o\b/i.test(txt);
  };

  const extrairOrgao = (s: any): string => {
    const direto = s?.orgao_julgador?.nome || s?.orgao_julgador?.name || "";
    if (direto && typeof direto === "string") return direto.trim();
    const content = String(s?.content || "");
    const partes = content.split(/\s+-\s+/);
    return (partes[partes.length - 1] || "").trim();
  };

  const ehGabineteMinistro = (orgao: string): boolean =>
    /\bGAB(?:INETE|\.)?\s+D[OA]\s+MINISTR[OA]?\b/i.test(orgao);

  const ehNaoGabinete = (orgao: string): boolean =>
    /\b(PRESID[ÊE]NCIA|VICE[\s-]*PRESID[ÊE]NCIA|CORREGEDORIA)\b/i.test(orgao);

  // Extrai turma diretamente do texto do step/órgão (ex: "1ª Turma - Gabinete do Ministro X").
  // Esta é a fonte mais confiável, pois reflete a turma ATUAL do ministro
  // (ministros mudam de turma periodicamente, então o mapeamento estático fica defasado).
  const extrairTurmaDoTexto = (texto: string): string | null => {
    if (!texto) return null;
    // Padrão "1ª Turma", "1a Turma", "1 Turma", "PRIMEIRA TURMA"
    const m1 = texto.match(/\b([1-8])[ªa]?\s*Turma\b/i);
    if (m1) return `${m1[1]}ª Turma`;
    const ordinais: Record<string, string> = {
      primeira: "1ª Turma", segunda: "2ª Turma", terceira: "3ª Turma", quarta: "4ª Turma",
      quinta: "5ª Turma", sexta: "6ª Turma", setima: "7ª Turma", sétima: "7ª Turma",
      oitava: "8ª Turma",
    };
    const m2 = texto.match(/\b(primeira|segunda|terceira|quarta|quinta|sexta|s[eé]tima|oitava)\s+turma\b/i);
    if (m2) return ordinais[m2[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] || null;
    return null;
  };

  const ordenados = [...steps]
    .filter((s) => s && (s.step_date || s.date || s.movement_date))
    .sort((a, b) => {
      const da = new Date(a.step_date || a.date || a.movement_date).getTime();
      const db = new Date(b.step_date || b.date || b.movement_date).getTime();
      return db - da;
    });

  for (const s of ordenados) {
    if (!ehDistribuicao(s)) continue;
    const orgao = extrairOrgao(s);
    if (!orgao) continue;
    if (ehNaoGabinete(orgao) && !ehGabineteMinistro(orgao)) continue;
    if (!ehGabineteMinistro(orgao)) continue;

    const m = orgao.match(/GAB(?:INETE|\.)?\s+D[OA]\s+MINISTR[OA]?\s+(.+)$/i);
    const relator = m ? m[1].trim().replace(/[.,;()\-]+$/, "") : null;
    // Prioridade: turma extraída do texto do step (content + órgão) > mapeamento estático.
    // O texto do step costuma vir como "1ª Turma - Gabinete do Ministro X",
    // o que reflete a composição ATUAL do TST.
    const textoCompleto = `${String(s?.content || "")} ${orgao}`;
    const turmaDoTexto = extrairTurmaDoTexto(textoCompleto);
    const turma = turmaDoTexto || (relator ? derivarTurmaDoRelator(relator) : null);

    const rawData = s.step_date || s.date || s.movement_date;
    const data = rawData ? String(rawData).substring(0, 10) : null;

    console.log(`[buscar-judit][tst-ultima-dist] data=${data} orgao="${orgao}" relator=${relator} turma=${turma} (fonte=${turmaDoTexto ? "texto" : "mapa"})`);
    return { data, relator, turma, orgao };
  }

  return null;
}

/**
 * Identifica recursos interpostos por reclamante e por reclamada/banco a partir
 * dos steps (movimentos), em ordem cronológica. Estratégia (1c):
 *  - Detecta o tipo de recurso pelo texto do movimento.
 *  - Identifica o lado pelo texto ("reclamante"/"reclamada/banco") OU por
 *    cruzamento com nomes do polo ativo/passivo presentes em parties.
 * Estratégia (3b): concatena todos em ordem cronológica (ex: "RO + RR").
 */
function extrairRecursosPorParte(
  steps: any[],
  parties: any[],
): { reclamante: string | null; banco: string | null } {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { reclamante: null, banco: null };
  }

  const normalize = (s: string) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

  const nomesAtivo = new Set<string>();
  const nomesPassivo = new Set<string>();
  if (Array.isArray(parties)) {
    for (const p of parties) {
      const ptype = (p?.person_type || "").toString().toUpperCase();
      if (ptype === "ADVOGADO") continue;
      // Prioriza person_type para classificar o lado ORIGINAL da parte.
      // O `side` da Judit reflete a posição na peça recursal corrente
      // (ex.: o banco como AGRAVANTE vira "Active"), o que polui a
      // classificação. Usamos person_type quando ele é claro.
      const ladoOriginal = ladoPorPersonType(ptype);
      const side = isParteBanco(p?.name || "") ? "PASSIVE" : ladoOriginal || (p?.side || "").toString().toUpperCase();
      const nome = normalize(p?.name || "");
      if (!nome || nome.length < 3) continue;
      // Tokens significativos do nome (>3 chars) ajudam a casar com o texto do movimento.
      const tokens = nome.split(/\s+/).filter((t) => t.length >= 4);
      for (const tok of tokens) {
        if (side === "ACTIVE") nomesAtivo.add(tok);
        else if (side === "PASSIVE") nomesPassivo.add(tok);
      }
    }
  }

  // Padrões de identificação de lado pelo texto do movimento.
  const RX_LADO_ATIVO = /\b(reclamante|exequente|autor(?:a)?|recorrente\s+reclamante|agravante\s+reclamante)\b/i;
  const RX_LADO_PASSIVO = /\b(reclamad[oa]|executad[oa]|r[ée]u|r[ée]|banco|santander|bradesco|ita[uú]|caixa\s+econ[oô]mica|empresa|recorrente\s+reclamad[oa]|agravante\s+reclamad[oa])\b/i;

  // Ordena por data ascendente.
  const stepsOrdenados = [...steps]
    .filter((s) => s && (s.step_date || s.date))
    .sort((a, b) => {
      const da = (a.step_date || a.date || "").toString();
      const db = (b.step_date || b.date || "").toString();
      return da.localeCompare(db);
    });

  const recursosReclamante: string[] = [];
  const recursosBanco: string[] = [];

  // Movimentos que indicam interposição/protocolo de recurso.
  // Inclui padrões reais de tribunais: "JUNTADA A PETIÇÃO DE AGRAVO",
  // "JUNTADA A PETIÇÃO DE EMBARGOS DE DECLARAÇÃO",
  // "JUNTADA A PETIÇÃO DE RECURSO DE REVISTA", "INTERPOSTO RECURSO ...".
  const RX_INTERPOSICAO =
    /\b(interp[ôo][es]|interposi[çc][ãa]o|protocol(?:ad[oa]|izad[oa])|juntad[oa]\s+(?:a\s+|de\s+|do\s+)?peti[çc][ãa]o\s+(?:de|do|para)?\s*(?:agravo|embargos|recurso|revista|ordin[áa]rio|extraordin[áa]rio|especial)|recurso\s+(?:de\s+revista|ordin[áa]rio|extraordin[áa]rio|especial|interposto)|agravo\s+(?:de\s+instrumento|interno|regimental|de\s+peti[çc][ãa]o))\b/i;

  // Exclui peças que NÃO são recurso interposto (resposta a recurso da outra parte).
  const RX_NAO_RECURSO =
    /\b(contraminuta|contrarraz[õo]es|contesta[çc][ãa]o|impugna[çc][ãa]o|manifesta[çc][ãa]o|habilita[çc][ãa]o|substabelecimento|peti[çc][ãa]o\s+intercorrente|petic[ãa]o\s+do\s+adv|memori|destaque|sustenta[çc][ãa]o|cota|provid[êe]ncias?)\b/i;

  const detectaLado = (texto: string): { ativo: boolean; passivo: boolean } => {
    const upper = normalize(texto);
    let ativo = RX_LADO_ATIVO.test(texto);
    let passivo = RX_LADO_PASSIVO.test(texto);
    if (!ativo) {
      for (const tok of nomesAtivo) {
        if (upper.includes(tok)) { ativo = true; break; }
      }
    }
    if (!passivo) {
      for (const tok of nomesPassivo) {
        if (upper.includes(tok)) { passivo = true; break; }
      }
    }
    return { ativo, passivo };
  };

  // Detecta o AUTOR explícito do recurso quando o próprio texto do andamento
  // diz "RECURSO/AGRAVO/EMBARGOS ... DE <NOME DA PARTE>" ou
  // "<NOME DA PARTE> INTERPÔS/PROTOCOLOU ...". Tem precedência sobre os
  // movimentos vizinhos: se o texto diz que o recurso é da reclamante, não
  // pode usar uma intimação vizinha ao banco para atribuir o recurso à
  // reclamada (caso típico que invertia a classificação).
  const RX_AUTOR_EXPLICITO =
    /\b(?:recurso(?:\s+(?:de\s+revista|ordin[áa]rio|extraordin[áa]rio|especial))?|agravo(?:\s+(?:de\s+instrumento|interno|regimental|de\s+peti[çc][ãa]o))?|embargos(?:\s+de\s+declara[çc][ãa]o)?|airr|rr|ro|ed|agr)\b[^.\n]{0,120}?\bde\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\.\-&]{3,})/i;

  const autorExplicitoLado = (texto: string): { ativo: boolean; passivo: boolean } | null => {
    const m = texto.match(RX_AUTOR_EXPLICITO);
    if (!m || !m[1]) return null;
    const alvo = normalize(m[1]);
    let ativo = false, passivo = false;
    for (const tok of nomesAtivo) { if (tok && alvo.includes(tok)) { ativo = true; break; } }
    for (const tok of nomesPassivo) { if (tok && alvo.includes(tok)) { passivo = true; break; } }
    if (ativo === passivo) return null;
    return { ativo, passivo };
  };

  for (let i = 0; i < stepsOrdenados.length; i++) {
    const s = stepsOrdenados[i];
    const content = (s?.content || s?.title || s?.description || "").toString();
    if (!content) continue;
    if (RX_NAO_RECURSO.test(content)) continue;
    if (!RX_INTERPOSICAO.test(content)) continue;

    const sigla = classificarRecursoInterposto(content);
    if (!sigla) continue;

    // 1a) Autor EXPLÍCITO no próprio texto ("RECURSO ... DE <NOME>") — tem
    //     precedência absoluta sobre vizinhos/intimações.
    const explicito = autorExplicitoLado(content);
    let ladoAtivo: boolean;
    let ladoPassivo: boolean;
    if (explicito) {
      ladoAtivo = explicito.ativo;
      ladoPassivo = explicito.passivo;
    } else {
      // 1b) Tenta detectar pelo próprio texto.
      const det = detectaLado(content);
      ladoAtivo = det.ativo;
      ladoPassivo = det.passivo;
    }

    // 2) Se ainda ambíguo, NÃO inferir por movimentos vizinhos/intimações.
    // O caso real 0100798-32.2021.5.01.0049 mostrou que usar intimação vizinha
    // como "parte contrária" atribui RO ao banco sem prova de interposição.
    // Política do campo: só preencher quando o próprio movimento confirma o lado.
    if (ladoAtivo === ladoPassivo) {
      ladoAtivo = false;
      ladoPassivo = false;
    }

    const appendUnique = (arr: string[], valor: string) => {
      if (!arr.some((item) => normalizePlain(item) === normalizePlain(valor))) arr.push(valor);
    };

    if (ladoAtivo && !ladoPassivo) {
      appendUnique(recursosReclamante, sigla);
    } else if (ladoPassivo && !ladoAtivo) {
      appendUnique(recursosBanco, sigla);
    }
    // Se ambíguo (ambos ou nenhum lado identificado), NÃO atribui a nenhum
    // lado — preferimos deixar vazio a classificar incorretamente. O usuário
    // pode preencher manualmente.
  }

  return {
    reclamante: recursosReclamante.length ? recursosReclamante.join(" + ") : null,
    banco: recursosBanco.length ? recursosBanco.join(" + ") : null,
  };
}

function inferirRecursosRecorrentesPorPartes(
  parties: any[],
  sigla: string | null,
): { reclamante: string | null; banco: string | null } {
  if (!sigla || !Array.isArray(parties)) return { reclamante: null, banco: null };
  const ladoOriginalPorParte = new Map<string, "ACTIVE" | "PASSIVE">();
  for (const p of parties) {
    const nome = (p?.name || "").toString().trim();
    if (!nome || (p?.person_type || "").toString().toUpperCase() === "ADVOGADO") continue;
    const doc = (p?.main_document || "").toString().replace(/\D/g, "");
    const key = doc || normalizePlain(nome);
    const lado = isParteBanco(nome) ? "PASSIVE" : ladoPorPersonType((p?.person_type || "").toString());
    if (lado && !ladoOriginalPorParte.has(key)) ladoOriginalPorParte.set(key, lado);
  }
  let reclamante = false;
  let banco = false;
  for (const p of parties) {
    const ptype = (p?.person_type || "").toString().toUpperCase();
    if (ptype === "ADVOGADO") continue;
    const ehRecorrente = /(RECORRENTE|AGRAVANTE|EMBARGANTE|RECORRIDO\s+ADESIVO|RECURSO)/.test(ptype);
    if (!ehRecorrente) continue;
    const nome = (p?.name || "").toString();
    if (isParteBanco(nome)) {
      banco = true;
      continue;
    }
    const doc = (p?.main_document || "").toString().replace(/\D/g, "");
    const key = doc || normalizePlain(nome);
    const ladoConsolidado = ladoOriginalPorParte.get(key);
    if (ladoConsolidado === "PASSIVE") { banco = true; continue; }
    if (ladoConsolidado === "ACTIVE") { reclamante = true; continue; }
    const ladoOriginal = ladoPorPersonType(ptype);
    const side = (p?.side || "").toString().toUpperCase();
    if (ladoOriginal === "PASSIVE") banco = true;
    else if (ladoOriginal === "ACTIVE" || side === "ACTIVE") reclamante = true;
    else if (side === "PASSIVE") banco = true;
  }
  return { reclamante: reclamante ? sigla : null, banco: banco ? sigla : null };
}

function extrairClassificacao(rd: any): string | null {
  // schema oficial: classifications é array
  const classes = Array.isArray(rd.classifications) ? rd.classifications : [];
  const nomes = classes.map((c: any) => c?.name ?? "").join(" | ").toLowerCase();

  for (const [rx, rotulo] of MAP_RECURSO) {
    if (rx.test(nomes)) return rotulo;
  }
  if (classes.length && classes[0]?.name) return classes[0].name;

  // fallbacks defensivos se o schema vier diferente
  if (typeof rd.classification === "string") return rd.classification;
  if (rd.classification?.name) return rd.classification.name;
  return null;
}

function extrairTurma(rd: any): string | null {
  const courts = Array.isArray(rd.courts) ? rd.courts : [];
  for (const c of courts) {
    const nome = (c?.name || "").toString();
    const m = nome.match(/(\d+)\s*[ªa]?\s*turma/i);
    if (m) return `${m[1]}ª Turma`;
  }
  for (const c of courts) {
    const nome = (c?.name || "").toString().trim();
    if (/vice[-\s]?presid[êe]ncia/i.test(nome)) return "Vice-Presidente";
    if (/corregedor(?:ia|[-\s]?geral)?/i.test(nome)) return "Corregedor-Geral";
    if (/presid[êe]ncia/i.test(nome) && !/vice[-\s]?presid[êe]ncia/i.test(nome)) return "Presidente";
    if (/cejusc/i.test(nome)) return "CEJUSC Turma";
    if (/turma|sdi|subse|seção|câmara|órgão especial/i.test(nome)) return nome;
  }
  return null;
}

function extrairRelator(rd: any): string | null {
  const j = rd.judge;
  const INVALIDOS = ["NÃO INFORMADO", "NAO INFORMADO", "N/A", "DESCONHECIDO", ""];
  if (typeof j === "string" && j.trim() && !INVALIDOS.includes(j.trim().toUpperCase())) return j.trim();
  if (j && typeof j === "object" && j.name && !INVALIDOS.includes((j.name || "").toUpperCase())) return j.name;

  // Extrair de courts: "Gabinete do Ministro X" ou "Gabinete - Desembargadora Y"
  const courts = Array.isArray(rd.courts) ? rd.courts : [];
  for (const c of courts) {
    const nome = (c?.name || "").toString();
    // Padrão: "Gabinete do Ministro X", "Gabinete - Desembargadora do Trabalho Y"
    const mGab = nome.match(/(?:Gabinete\s+[-–]?\s*d[oa]\s+)?(?:Ministro|Ministra|Min\.?|Desembargador(?:a)?(?:\s+do\s+Trabalho)?|Des\.?)\s+(.+)/i);
    if (mGab) {
      const cand = mGab[1].trim().replace(/[.,;()\-]+$/, "");
      if (cand.split(/\s+/).length >= 2) return cand;
    }
  }

  // Ministros/Desembargadores/órgãos administrativos do TST podem aparecer em parties
  if (Array.isArray(rd.parties)) {
    const mag = rd.parties.find((p: any) => {
      const t = (p?.person_type || "").toUpperCase();
      return ["MAGISTRADO", "JUIZ", "RELATOR", "DESEMBARGADOR", "MINISTRO"].includes(t);
    });
    if (mag?.name) return mag.name;
  }

  const turmaAdmin = extrairTurma(rd);
  if (turmaAdmin) {
    const relatorDerivado = derivarRelatorDaTurma(turmaAdmin);
    if (relatorDerivado) return relatorDerivado;
  }

  // Padrão genérico: "relator/min./ministro NOME" em steps
  const RX_REL = /(?:relator|relatora|min(?:istro|istra)?\.?|desembargador(?:a)?)[\s:]+([A-ZÁÉÍÓÚÂÊÔÇÃÕ][A-Za-zÁÉÍÓÚÂÊÔÇÃÕáéíóúâêôçãõ.\s]{5,80})/i;
  // Padrão CONCLUSOS: "CONCLUSOS OS AUTOS PARA DESPACHO (GENÉRICA) A NOME"
  const RX_CONCLUSOS = /CONCLUSOS\s+(?:OS\s+AUTOS\s+)?(?:PARA\s+\w+\s+)?(?:\([^)]*\)\s+)?(?:A|AO)\s+([A-ZÁÉÍÓÚÂÊÔÇÃÕ][A-Za-zÁÉÍÓÚÂÊÔÇÃÕáéíóúâêôçãõ\s.]{5,80})/i;
  // Padrão MIN. NOME genérico
  const RX_MIN = /(?:^|\s)MIN(?:ISTR[AO])?\.?\s+([A-ZÁÉÍÓÚÂÊÔÇÃÕ][A-Za-zÁÉÍÓÚÂÊÔÇÃÕáéíóúâêôçãõ\s.]{5,80})/i;

  for (const s of rd.steps || []) {
    const txt = (s?.content || "").toString();
    for (const rx of [RX_REL, RX_CONCLUSOS, RX_MIN]) {
      const m = txt.match(rx);
      if (m) {
        const cand = m[1].trim().replace(/[.,;]+$/, "");
        if (cand.split(/\s+/).length >= 2) return cand;
      }
    }
  }
  return null;
}

function normalizePlain(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function parseTstDate(value: unknown): Date | null {
  const raw = String(value ?? "").trim();
  const m = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || "12"}:${m[5] || "00"}:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

function mapMeioJulgamento(code: unknown): string | null {
  const c = String(code ?? "").trim().toUpperCase();
  if (c === "V" || c === "VIRTUAL") return "Virtual";
  if (c === "T" || c === "TELEPRESENCIAL") return "Telepresencial";
  if (c === "P" || c === "PRESENCIAL") return "Presencial";
  if (c === "H" || c.includes("HIBRID") || c.includes("HÍBRID")) return "Híbrido";
  return c || null;
}

async function consultarPautaPublicaTst(cnj: string, turma: string | null, stepDateIso: string | null): Promise<{ data: string; horario: string | null; tipo: string | null } | null> {
  if (!turma || !stepDateIso) return null;
  const digits = cnj.replace(/\D/g, "");
  const stepDate = new Date(stepDateIso.substring(0, 10) + "T12:00:00Z");
  if (isNaN(stepDate.getTime())) return null;
  const year = stepDate.getUTCFullYear();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`https://pautaws.tst.jus.br/rest/pautas/${year}`, { signal: controller.signal });
    if (!r.ok) return null;
    const pautas = await r.json();
    if (!Array.isArray(pautas)) return null;
    const turmaNorm = normalizePlain(turma).replace(/\s+/g, " ");
    const candidatos = pautas
      .map((p: any) => {
        const orgao = normalizePlain(p?.orgaoJudicante?.desOrgaoJudicante || "").replace(/\s+/g, " ");
        const tipo = mapMeioJulgamento(p?.codMeioJulgamento);
        // Em julgamento virtual, o formulário deve usar o início da janela de julgamento;
        // em sessões presenciais/telepresenciais, usa a data efetiva da sessão.
        const isVirtual = String(tipo || "").toUpperCase().includes("VIRTUAL");
        const dataBase = isVirtual
          ? (parseTstDate(p?.dtaInicioSessao) || parseTstDate(p?.dtaSessao))
          : (parseTstDate(p?.dtaSessao) || parseTstDate(p?.dtaInicioSessao));
        const divulgacao = parseTstDate(p?.dtaDivulgacao);
        const publicacao = parseTstDate(p?.dtaPublicacao);
        const diffs = [divulgacao, publicacao].filter(Boolean).map((d: any) => Math.abs(d.getTime() - stepDate.getTime()));
        const pubDiff = diffs.length ? Math.min(...diffs) : Number.MAX_SAFE_INTEGER;
        return { p, orgao, tipo, dataBase, pubDiff };
      })
      .filter((x: any) => x.dataBase && x.dataBase.getTime() >= stepDate.getTime())
      .filter((x: any) => x.orgao.includes(turmaNorm) || turmaNorm.includes(x.orgao));
    // Ordena por maior probabilidade: para pauta virtual, a data relevante é o
    // início da janela; quando existir origem PJE, ela costuma ser a fonte que
    // contém a janela correta exibida nos andamentos do processo.
    const pool = [...candidatos].sort((a: any, b: any) =>
      a.pubDiff - b.pubDiff ||
      (String(b.p?.sistemaOrigem || "").toUpperCase() === "PJE" ? 1 : 0) -
      (String(a.p?.sistemaOrigem || "").toUpperCase() === "PJE" ? 1 : 0) ||
      a.dataBase.getTime() - b.dataBase.getTime(),
    );
    console.log(`[buscar-judit] pauta TST: ${pool.length} sessões candidatas para turma="${turma}" stepDate=${stepDateIso}`);
    let chosen: any = null;
    for (const cand of pool.slice(0, 8)) {
      const org = cand.p?.orgaoJudicante || {};
      const sessao = `${org.codOrgaoJudicante}-${cand.p?.anoPauta}-${cand.p?.numPauta}-${cand.p?.tipSessao}`;
      const pc = new AbortController();
      const pt = setTimeout(() => pc.abort(), 900);
      try {
        const pr = await fetch(`https://pautaws.tst.jus.br/rest/processospauta/tst?sessao=${encodeURIComponent(sessao)}`, { signal: pc.signal });
        if (pr.ok) {
          const items = await pr.json();
          if (digits && normalizePlain(JSON.stringify(items || [])).replace(/\D/g, "").includes(digits)) {
            console.log(`[buscar-judit] CNJ ${cnj} encontrado em sessão ${sessao} (data=${cand.p?.dtaSessao}, meio=${cand.tipo})`);
            chosen = cand;
            break;
          }
        }
      } catch (_) { /* segue tentando próxima sessão */ }
      finally { clearTimeout(pt); }
    }
    if (!chosen) {
      // A API pública frequentemente não lista processos de sessões PJE/virtuais,
      // embora a pauta agregada traga a janela correta. Para não voltar à data
      // de publicação (ex.: 26/03), aceita apenas candidato virtual próximo da
      // publicação/inclusão em pauta. Havendo várias publicações próximas, usa a
      // ÚLTIMA janela virtual encontrada após o andamento — é a remarcação mais
      // recente e corrige casos como 27/04/2026 em vez de 06/04/2026.
      chosen = pool
        .filter((cand: any) =>
          String(cand.tipo || "").toUpperCase().includes("VIRTUAL") &&
          cand.pubDiff <= 7 * 24 * 60 * 60 * 1000 &&
          cand.dataBase.getTime() > stepDate.getTime()
        )
        .sort((a: any, b: any) =>
          b.dataBase.getTime() - a.dataBase.getTime() ||
          (String(b.p?.sistemaOrigem || "").toUpperCase() === "PJE" ? 1 : 0) -
          (String(a.p?.sistemaOrigem || "").toUpperCase() === "PJE" ? 1 : 0)
        )[0] || null;
      if (!chosen) {
        console.log(`[buscar-judit] CNJ ${cnj} não localizado em sessão verificada — sem data de julgamento confiável`);
        return null;
      }
      console.log(`[buscar-judit] pauta TST virtual aplicada por janela provável (sem lista de processos): data=${chosen.dataBase.toISOString().slice(0, 10)} meio=${chosen.tipo}`);
    }
    const iso = chosen.dataBase.toISOString().slice(0, 10);
    const rawDate = String(chosen.tipo || "").toUpperCase().includes("VIRTUAL")
      ? (chosen.p?.dtaInicioSessao || chosen.p?.dtaSessao)
      : (chosen.p?.dtaSessao || chosen.p?.dtaInicioSessao);
    const hm = String(rawDate ?? "").match(/\s(\d{2}):(\d{2})/);
    const horario = hm && hm[1] !== "00" ? `${hm[1]}:${hm[2]}` : null;
    return { data: iso, horario, tipo: chosen.tipo };
  } catch (e) {
    console.log(`[buscar-judit] pauta pública TST indisponível: ${(e as Error).message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- handler --------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const JUDIT_API_KEY = Deno.env.get("JUDIT_API_KEY");
    if (!JUDIT_API_KEY) {
      return json({ error: "JUDIT_API_KEY não configurada" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const numero_processo = body?.numero_processo || body?.numero_cnj;
    const tribunalHint = body?.tribunal || null;
    if (!numero_processo || typeof numero_processo !== "string") {
      return json({ error: "Número do processo é obrigatório" }, 400);
    }
    const cnj = numero_processo.trim();
    console.log(`[buscar-judit] CNJ=${cnj} tribunal_hint=${tribunalHint}`);

    // ===== ESTRATÉGIA CACHE-FIRST =====
    // 1) Tenta lookup direto no datalake (instantâneo, ~1-3s)
    let rd: any = null;
    let requestId: string | null = null;
    let debugStatus = "cache_hit";
    let debugInstancias = 0;
    let allInstancesPageData: any[] = []; // guarda TODAS as instâncias do async para unir partes

    const cachedRd = await juditLookupCache(JUDIT_API_KEY, cnj);
    
    // Cache da Judit retorna apenas 1 instância (geralmente a originária — TRT/Vara).
    // Para preencher corretamente recorrente / tipo_recurso / trânsito / data
    // de distribuição, precisamos das DEMAIS instâncias (TST quando houver RR
    // recente). Por isso só usamos o cache direto quando há hint EXPLÍCITO e o
    // cache cobre exatamente esse hint. Sem hint => sempre crawler async para
    // ter TRT+TST juntos. (Caso real: 0001695-95.2013.5.01.0481 — cache só
    // tinha TRT1 antigo e mascarava o RR distribuído no TST em 10/12/2025.)
    const cacheMatchesHint = cachedRd && tribunalHint && (
      (cachedRd.tribunal_acronym || "").toUpperCase() === tribunalHint.toUpperCase() ||
      (tribunalHint.toUpperCase() === "TST" && temIndicioTST(cachedRd))
    );

    if (cachedRd && cacheMatchesHint) {
      rd = cachedRd;
      console.log(`[buscar-judit] Usando cache direto (hint=${tribunalHint} casa com tribunal=${cachedRd.tribunal_acronym})`);
    } else {
      // Fallback: fluxo assíncrono (crawler) — retorna TODAS as instâncias
      if (cachedRd) {
        console.log(`[buscar-judit] Cache descartado (cache=${cachedRd.tribunal_acronym}, hint=${tribunalHint || "<nenhum>"}) — forçando crawler para obter TODAS as instâncias`);
      }
      debugStatus = "async_poll";
      const criar = await juditCriarRequest(JUDIT_API_KEY, cnj);
      if ("error" in criar) {
        const isLimite = /MAX_CONSUMPTION|LIMIT|QUOTA/i.test(criar.error);
        return json({
          error: isLimite
            ? "Limite do plano Judit atingido. Verifique seu consumo no painel Judit."
            : `Falha ao criar requisição na Judit: ${criar.error}`,
          judit_status: criar.status,
          judit_error: criar.error,
        }, criar.status === 422 ? 402 : 502);
      }
      requestId = criar.request_id;
      console.log(`[buscar-judit] request_id=${requestId}`);

      const envelope = await juditPollRespostas(JUDIT_API_KEY, requestId);
      if (!envelope) {
        return json({ error: "Sem resposta da Judit (timeout)" }, 504);
      }

      const pageData = envelope.page_data ?? [];
      allInstancesPageData = pageData;
      debugStatus = envelope.request_status;
      debugInstancias = pageData.length;
      console.log(
        `[buscar-judit] status=${envelope.request_status} instancias=${pageData.length} acronimos=${pageData
          .map((i: any) => i?.response_data?.tribunal_acronym)
          .join(",")}`,
      );

      rd = selecionarInstancia(pageData, tribunalHint);
      
      // Se o async retornou dados com 0 steps (pending/timeout) e temos cache com steps,
      // mesclar: usar instância do async mas steps do cache para extração
      if (rd && (!rd.steps || rd.steps.length === 0) && cachedRd && cachedRd.steps?.length > 0) {
        console.log(`[buscar-judit] Mesclando: instância async (${rd.tribunal_acronym}) + steps do cache (${cachedRd.steps.length})`);
        rd = { ...rd, steps: cachedRd.steps, parties: rd.parties?.length ? rd.parties : cachedRd.parties };
      }
      
      if (!rd) {
        // Hint não bateu — fazer fallback para a melhor instância disponível
        // (preferindo a maior `instance`) ou para o cache, em vez de 404.
        const rdsAll = pageData
          .map((i: any) => i?.response_data)
          .filter((x: any) => x && typeof x === "object");
        if (tribunalHint?.toString().trim().toUpperCase() === "TST") {
          console.log(`[buscar-judit] Hint=TST não localizado no async; usando DataJud TST em vez de cair em TRT.`);
          const datajud = await consultarDataJud(cnj);
          if (datajud && (datajud.relator || datajud.turma || datajud.classe || datajud.steps?.length)) {
            rd = {
              tribunal_acronym: "TST",
              classifications: datajud.classe ? [{ name: datajud.classe }] : [],
              distribution_date: datajud.dataDistribuicao,
              judge: datajud.relator ? { name: datajud.relator } : null,
              courts: datajud.courts || [],
              steps: datajud.steps || [],
              parties: cachedRd?.parties || [],
              status: cachedRd?.status || null,
            };
            console.log(`[buscar-judit] rd preenchido via DataJud TST (relator=${datajud.relator})`);
          }
        }
        // Só procurar fallbacks se rd ainda estiver vazio (DataJud TST não preencheu)
        if (!rd) {
          if (rdsAll.length > 0) {
            rd = rdsAll.reduce((a: any, b: any) => ((b.instance ?? 0) > (a.instance ?? 0) ? b : a));
            console.log(`[buscar-judit] Hint=${tribunalHint} não localizado; usando melhor instância disponível: ${rd.tribunal_acronym}`);
          } else if (cachedRd) {
            rd = cachedRd;
            console.log(`[buscar-judit] Hint=${tribunalHint} não localizado e async vazio; usando cache (${cachedRd.tribunal_acronym})`);
          } else {
            return json(
              {
                error: "Processo não encontrado na Judit",
                _debug: {
                  request_id: requestId,
                  status_judit: envelope.request_status,
                  instancias_retornadas: pageData.length,
                  tribunal_hint: tribunalHint,
                },
              },
              404,
            );
          }
        }
      }

      console.log(
        `[buscar-judit] selecionado: tribunal=${rd.tribunal_acronym} instance=${rd.instance}`,
      );
    }

    const tribunalHintNormalizado = tribunalHint ? tribunalHint.toString().trim().toUpperCase() : null;
    let datajudAutoritativo: DataJudOrgao | null = null;
    if (tribunalHintNormalizado === "TST" && (rd?.tribunal_acronym || "").toString().toUpperCase() !== "TST") {
      console.log(`[buscar-judit] Judit não retornou instância TST (selecionou ${rd?.tribunal_acronym || "null"}); consultando DataJud TST antes de preencher.`);
      datajudAutoritativo = await consultarDataJud(cnj);
      if (datajudAutoritativo && (datajudAutoritativo.relator || datajudAutoritativo.turma || datajudAutoritativo.classe)) {
        rd = {
          ...rd,
          tribunal_acronym: "TST",
          classifications: datajudAutoritativo.classe ? [{ name: datajudAutoritativo.classe }] : rd.classifications,
          distribution_date: datajudAutoritativo.dataDistribuicao || rd.distribution_date,
          judge: datajudAutoritativo.relator ? { name: datajudAutoritativo.relator } : rd.judge,
          courts: datajudAutoritativo.courts?.length ? datajudAutoritativo.courts : rd.courts,
          steps: datajudAutoritativo.steps?.length ? datajudAutoritativo.steps : rd.steps,
        };
        console.log(`[buscar-judit] Usando DataJud TST como fonte autoritativa: relator=${datajudAutoritativo.relator} turma=${datajudAutoritativo.turma}`);
      }
    }

    // ---- extração ----
    const tribunalAcronimo = (rd.tribunal_acronym || "").toUpperCase() || null;
    let tribunal: string | null = null;
    if (tribunalAcronimo?.includes("TST")) tribunal = "TST";
    else if (tribunalAcronimo?.includes("STF")) tribunal = "STF";
    else if (tribunalAcronimo?.includes("STJ")) tribunal = "STJ";
    else if (temIndicioTST(rd)) tribunal = "TST";
    else tribunal = tribunalAcronimo;

    const classificacao = extrairClassificacao(rd);
    let dataDistribuicaoBR = toDateBR(rd.distribution_date);
    let dataDistribuicaoISO = toDateISO(rd.distribution_date);

    let relator = extrairRelator(rd);
    let turma = extrairTurma(rd);

    // fallback: helpers do projeto lendo os steps
    const steps = Array.isArray(rd.steps) ? rd.steps : [];
    console.log(`[buscar-judit] total_steps=${steps.length}`);
    if (steps.length > 0) {
      console.log(
        "[buscar-judit] amostra steps:",
        JSON.stringify(
          steps.slice(0, 3).map((s: any) => ({
            date: s.step_date,
            content: (s.content || "").toString().substring(0, 160),
          })),
        ),
      );
    }

    if (!relator || !turma) {
      try {
        const oj = extrairOrgaoJulgador(steps);
        if (!relator && oj?.relator) relator = oj.relator;
        if (!turma && oj?.turma) turma = oj.turma;
      } catch (e) {
        console.warn("extrairOrgaoJulgador falhou:", (e as Error).message);
      }
    }

    // relator <-> turma via mapeamento TST (helpers do projeto)
    if (relator && !turma) {
      const t = derivarTurmaDoRelator(relator);
      if (t) turma = t;
    }
    if (turma && !relator) {
      const r = derivarRelatorDaTurma(turma);
      if (r) relator = r;
    }

    // ===== CORREÇÃO TURMA TST =====
    // Se o tribunal final é TST e o relator está no mapeamento determinístico TST,
    // SEMPRE usar a turma derivada do relator (sobrescrevendo qualquer turma
    // extraída de courts, que pode pertencer a outra instância — TRT/TRF).
    if (tribunal === "TST" && relator) {
      const turmaTst = derivarTurmaDoRelator(relator);
      if (turmaTst && turmaTst !== turma) {
        console.log(`[buscar-judit] Turma corrigida via mapeamento TST: '${turma}' -> '${turmaTst}' (relator=${relator})`);
        turma = turmaTst;
      }
    }

    // ===== ÚLTIMA (RE)DISTRIBUIÇÃO TST =====
    // A capa da Judit traz a distribuição original (que pode ser de anos atrás
    // ou de outro tribunal). Para o TST, percorremos os steps e usamos o
    // último movimento de Distribuição/Redistribuição cujo órgão seja um
    // Gabinete de Ministro. Isso corrige relator/turma/data quando o processo
    // foi redistribuído entre gabinetes (ignorando passagens por Presidência,
    // Vice-Presidência ou Corregedoria, que não são destino final).
    if (tribunal === "TST") {
      const ultima = extrairUltimaDistribuicaoTst(steps);
      if (ultima) {
        if (ultima.data) {
          rd.distribution_date = ultima.data;
          dataDistribuicaoISO = toDateISO(ultima.data);
          dataDistribuicaoBR = toDateBR(ultima.data);
        }
        if (ultima.relator) relator = ultima.relator;
        if (ultima.turma) turma = ultima.turma;
      }
    }

    // ===== SANITIZAÇÃO TURMA TST =====
    // Quando o processo é TST, descartar turmas que claramente vieram de outra
    // instância (TRT, varas, regiões). Isso evita exibir "7ª Turma" quando essa
    // 7ª Turma na verdade é do TRT capturado nos courts/steps.
    if (tribunal === "TST" && turma) {
      const turmaUpper = turma.toUpperCase();
      const ehDeOutraInstancia =
        /\bTRT\b|REGI[ÃA]O|VARA\s+DO\s+TRABALHO|\bTRF\b|\bTJ[A-Z]{2}\b|JUIZ(?:ADO)?\s+DO\s+TRABALHO/i.test(turma);
      // Lista de turmas válidas no TST
      const ehTurmaTstValida =
        /^[1-8]ª\s*TURMA$/i.test(turma.trim()) ||
        /^(PRESIDENTE|VICE-?PRESIDENTE|CORREGEDOR(-GERAL)?|SBDI[-\s]?[12I]+|SDI[-\s]?[12I]+|TRIBUNAL\s+PLENO|[OÓ]RG[ÃA]O\s+ESPECIAL|SE[ÇC][ÃA]O\s+ESPECIALIZADA)$/i.test(turma.trim());

      if (ehDeOutraInstancia || !ehTurmaTstValida) {
        console.log(`[buscar-judit] Turma '${turma}' descartada (não é turma válida do TST). Tentando derivar do relator...`);
        const turmaDerivada = relator ? derivarTurmaDoRelator(relator) : null;
        if (turmaDerivada) {
          console.log(`[buscar-judit] Turma TST derivada do relator: ${turmaDerivada}`);
          turma = turmaDerivada;
        } else {
          console.log(`[buscar-judit] Sem mapeamento TST para o relator '${relator}'. Turma definida como null.`);
          turma = null;
        }
      }
    }

    // ===== FALLBACK DATAJUD =====
    // Se relator ou turma ainda estão vazios, consulta DataJud (CNJ) como complemento
    if (!relator || !turma) {
      console.log(`[buscar-judit] Relator/turma incompletos após Judit, tentando DataJud...`);
      const datajud = await consultarDataJud(cnj);
      if (datajud) {
        if (!relator && datajud.relator) {
          relator = datajud.relator;
          console.log(`[buscar-judit] Relator obtido do DataJud: ${relator}`);
        }
        if (!turma && datajud.turma) {
          turma = datajud.turma;
          console.log(`[buscar-judit] Turma obtida do DataJud: ${turma}`);
        }
        // Se DataJud trouxe classe e a Judit não, usar
        if (!classificacao && datajud.classe) {
          // Não reatribuímos classificacao aqui pois é const-like, mas logamos
          console.log(`[buscar-judit] Classe do DataJud: ${datajud.classe}`);
        }
        // Inferência bidirecional após DataJud
        if (relator && !turma) {
          const t = derivarTurmaDoRelator(relator);
          if (t) turma = t;
        }
        if (turma && !relator) {
          const r = derivarRelatorDaTurma(turma);
          if (r) relator = r;
        }
      }
    }

    console.log(`[buscar-judit] extração final relator=${relator || 'null'} turma=${turma || 'null'}`);

    // partes — UNIR de todas as instâncias retornadas (cache + page_data),
    // pois Judit às vezes popula advogados em uma instância e não em outra.
    const partiesPool: any[] = [];
    const pushParties = (arr: any) => {
      if (Array.isArray(arr)) for (const p of arr) if (p) partiesPool.push(p);
    };
    pushParties(rd.parties);
    if (cachedRd && cachedRd !== rd) pushParties(cachedRd.parties);
    // Unir partes de TODAS as instâncias retornadas pelo fluxo async
    for (const item of allInstancesPageData) {
      const otherRd = item?.response_data;
      if (otherRd && otherRd !== rd) pushParties(otherRd.parties);
    }
    // Deduplicar: chave = documento normalizado (se houver) OU nome. Não incluir
    // side/person_type na chave: a mesma parte pode aparecer como AGRAVANTE,
    // AGRAVADO, RECLAMANTE e RECORRENTE, mas deve ser enviada uma única vez ao
    // frontend com lado_efetivo consolidado.
    const seen = new Map<string, number>();
    const parties: any[] = [];
    for (const p of partiesPool) {
      const doc = (p?.main_document || "").toString().replace(/\D/g, "");
      const name = (p?.name || "").toString().trim().toUpperCase();
      const key = doc ? `doc:${doc}` : `nm:${name}`;
      if (!name) continue;
      const existingIdx = seen.get(key);
      if (existingIdx === undefined) {
        parties.push(p);
        seen.set(key, parties.length - 1);
        continue;
      }
      const currentType = (parties[existingIdx]?.person_type || "").toString().toUpperCase();
      const newType = (p?.person_type || "").toString().toUpperCase();
      if (ladoPorPersonType(newType) && !ladoPorPersonType(currentType)) {
        parties[existingIdx] = p;
      }
    }
    console.log(`[buscar-judit] partes unidas: pool=${partiesPool.length} dedup=${parties.length}`);
    // Lado efetivo de cada parte: prioriza person_type ORIGINAL
    // (RECLAMANTE/RECLAMADO/AUTOR/RÉU/EXEQUENTE/EXECUTADO) sobre o `side` da
    // Judit. O `side` reflete a posição na peça recursal e mistura
    // banco/reclamante quando ambos figuram como AGRAVANTE/RECORRENTE.
    const ladoEfetivo = (p: any): "ACTIVE" | "PASSIVE" | null => {
      const ptype = (p?.person_type || "").toUpperCase();
      if (ptype === "ADVOGADO") return null;
      const porTipo = ladoPorPersonType(ptype);
      if (porTipo) return porTipo;
      const side = (p?.side || "").toUpperCase();
      return side === "ACTIVE" || side === "PASSIVE" ? side : null;
    };
    // Decide o lado FINAL de cada parte única (chave = documento). Quando a
    // mesma parte aparece com vários person_type (ex.: RECLAMANTE + RECORRIDO),
    // o lado original vence — registros com person_type = RECLAMANTE/RECLAMADO/
    // AUTOR/RÉU/EXEQUENTE/EXECUTADO têm prioridade absoluta sobre rótulos de
    // peça recursal (AGRAVANTE/AGRAVADO/RECORRENTE/RECORRIDO).
    const ladoPorParte = new Map<string, { nome: string; lado: "ACTIVE" | "PASSIVE"; original: boolean }>();
    for (const p of parties) {
      const ptype = (p?.person_type || "").toUpperCase();
      if (ptype === "ADVOGADO") continue;
      const lado = ladoEfetivo(p);
      if (!lado) continue;
      const nome = (p?.name || "").toString().trim();
      if (!nome) continue;
      const doc = (p?.main_document || "").toString().replace(/\D/g, "");
      const key = doc || nome.toUpperCase();
      const original = ladoPorPersonType(ptype) !== null; // true para RECLAMANTE/RECLAMADO/etc.
      const atual = ladoPorParte.get(key);
      // Mantém o registro se ainda não existe, OU se o novo é "original" e o atual não é.
      if (!atual || (original && !atual.original)) {
        ladoPorParte.set(key, { nome, lado, original });
      }
    }
    const ativosUnicos: string[] = [];
    const passivosUnicos: string[] = [];
    for (const { nome, lado } of ladoPorParte.values()) {
      if (lado === "ACTIVE") ativosUnicos.push(nome);
      else passivosUnicos.push(nome);
    }
    const poloAtivo = ativosUnicos.join(", ");
    const poloPassivo = passivosUnicos.join(", ");
    console.log(`[buscar-judit] polo_ativo="${poloAtivo}" polo_passivo="${poloPassivo}"`);

    // situação
    const rawStatus = rd.status || null;
    let situacaoProcesso: string | null = null;
    if (rawStatus) {
      const s = rawStatus.toString().toUpperCase();
      if (s.includes("ATIVO") || s === "ATIVA") situacaoProcesso = "Ativo";
      else if (s.includes("FINALIZADO") || s.includes("ARQUIVADO")) situacaoProcesso = "Arquivado";
      else if (s.includes("BAIXADO")) situacaoProcesso = "Baixado";
      else if (s.includes("SUSPENSO")) situacaoProcesso = "Suspenso";
    }

    // análise dos steps
    // Identifica movimentos relacionados ao agendamento de sessão de julgamento.
    // Inclui variações como "incluído em pauta", "pautado para", "designada sessão",
    // "marcado julgamento" etc. Esses movimentos contêm tanto a data em que o ato
    // foi praticado (step_date) quanto a data futura agendada (no texto).
    const PAUTA = /pauta|sess[aã]o\s+de\s+julgamento|inclu[ií]d[oa]\s+em\s+pauta|designad[oa].*julgamento|julgamento.*designad|pautad[oa]\s+para|marcad[oa]\s+(?:o\s+)?julgamento|agendad[oa]\s+(?:o\s+)?julgamento/i;
    // Movimentos de remoção/cancelamento que invalidam pauta anterior.
    const PAUTA_CANCEL = /retirad[oa]\s+de\s+pauta|cancelad[oa]\s+(?:a\s+)?(?:sess[aã]o|pauta|julgamento)|adiad[oa]\s+(?:o\s+)?julgamento/i;
    const SEM_TRANSC = /sem transcend[eê]ncia|transcend[eê]ncia n[aã]o reconhecida/i;
    const NAO_CONHECIDO = /n[aã]o conhec|recurso.*n[aã]o.*conhecid/i;
    const CONH_PROV = /conhecid[oa].*provid[oa]|dar provimento|recurso.*provid/i;
    const CONH_NAO_PROV = /conhecid[oa].*n[aã]o.*provid|negar provimento|desprovid|improvid/i;
    const BAIXA = /baixa definitiva|remetidos os autos [àa] origem|baixados? os autos|autos.*devolvidos|certid[aã]o de tr[aâ]nsito|tr[aâ]nsito em julgado/i;

    let dataJulgamento: string | null = null;
    let horarioJulgamento: string | null = null;
    let tipoJulgamento: string | null = null;
    let temDataJulgamento = "N";
    let resultadoSemTranscendencia = false;
    let resultadoNaoConhecido = false;
    let resultadoConhecidoProvido = false;
    let resultadoConhecidoNaoProvido = false;
    let processoBaixado = "N";

    // ----- Extração de Pauta de Julgamento -----
    //
    // Regra: queremos a DATA AGENDADA para o julgamento (futura), o horário e
    // a modalidade (Virtual/Presencial/Telepresencial/Híbrido). NUNCA usar
    // step_date como data de julgamento — step_date é a data em que o ato de
    // marcação foi praticado, não a data da sessão.
    //
    // Regras de prioridade:
    //   1. Considera o ÚLTIMO movimento de pauta (em ordem cronológica), pois
    //      remarcações sobrescrevem a anterior. Se houver "retirado de pauta"
    //      mais recente, descarta o agendamento.
    //   2. Procura datas mencionadas no texto após marcadores como "para",
    //      "dia", "sessão de", "julgamento de", "designada para".
    //   3. Se houver várias datas no texto, prefere a data POSTERIOR à data
    //      do andamento (step_date) — essa é a sessão futura.
    //   4. Extrai horário (HH:MM, HHhMM, HHh, "às HH horas") e modalidade.

    function parseDM(s: string): Date | null {
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return null;
      const d = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00Z`);
      return isNaN(d.getTime()) ? null : d;
    }

    function extractScheduledDate(content: string, stepDateIso: string | null): string | null {
      const isPublicationOnly = /disponibiliza[çc][aã]o|publica[çc][aã]o|di[aá]rio\s+da\s+justi[çc]a|dje|dejt/i.test(content)
        && !/inclu[ií]d[oa].*pauta|pautad[oa]|marcad[oa]|designad[oa]|sess[aã]o\s+de\s+julgamento|julgamento\s+(?:de|do\s+dia)/i.test(content);
      if (isPublicationOnly) return null;

      // 1) Tenta achar data precedida por marcadores explícitos de agendamento.
      const marcador = /(?:para(?:\s+(?:o\s+dia|a\s+sess[aã]o(?:\s+de)?|julgamento(?:\s+do\s+dia)?))?|designad[oa](?:\s+para)?|sess[aã]o\s+de(?:\s+julgamento(?:\s+do\s+dia)?)?|julgamento\s+(?:de|do\s+dia)|pautad[oa]\s+para|marcad[oa]\s+para|agendad[oa]\s+para)\s+(?:o\s+dia\s+)?(\d{2}\/\d{2}\/\d{4})/i;
      const mm = content.match(marcador);
      if (mm) return mm[1];

      // 2) Pega todas as datas e prefere a posterior ao step_date.
      const all = Array.from(content.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)).map((m) => m[1]);
      if (all.length === 0) return null;
      const stepDt = stepDateIso ? new Date(stepDateIso.substring(0, 10) + "T12:00:00Z") : null;
      if (stepDt) {
        const futuras = all
          .map((s) => ({ s, d: parseDM(s) }))
          .filter((x) => x.d && x.d.getTime() > stepDt.getTime())
          .sort((a, b) => a.d!.getTime() - b.d!.getTime());
        if (futuras.length > 0) return futuras[0].s;
        return null;
      }
      if (/disponibiliza[çc][aã]o|publica[çc][aã]o|di[aá]rio\s+da\s+justi[çc]a|dje|dejt/i.test(content)) return null;
      // 3) Última data mencionada como heurística final.
      return all[all.length - 1];
    }

    function extractHorario(content: string): string | null {
      // Formatos aceitos: 14:30, 14h30, 14h, 9:00, "às 14 horas", "às 14h"
      const hm = content.match(/\b(\d{1,2})\s*[:hH]\s*(\d{2})\b/);
      if (hm) return `${hm[1].padStart(2, "0")}:${hm[2]}`;
      const hOnly = content.match(/\b(?:[àa]s\s+)?(\d{1,2})\s*(?:h(?:oras?)?|horas?)\b/i);
      if (hOnly) return `${hOnly[1].padStart(2, "0")}:00`;
      return null;
    }

    function extractTipo(content: string): string | null {
      if (/virtual/i.test(content)) return "Virtual";
      if (/telepresencial/i.test(content)) return "Telepresencial";
      if (/h[ií]brid/i.test(content)) return "Híbrido";
      if (/presencial/i.test(content)) return "Presencial";
      return null;
    }

    // Coleta movimentos de pauta com índice cronológico (steps já vem ordenado;
    // assumimos ordem cronológica crescente). Se houver cancelamento DEPOIS do
    // último agendamento, descartamos.
    type PautaHit = { idx: number; content: string; stepDate: string | null };
    const pautaHits: PautaHit[] = [];
    let lastCancelIdx = -1;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const content = (step?.content || step?.title || step?.description || "").toString();
      const stepDate = step?.step_date || step?.date || null;
      if (PAUTA_CANCEL.test(content)) lastCancelIdx = i;
      if (PAUTA.test(content)) pautaHits.push({ idx: i, content, stepDate });
    }
    // Filtra apenas hits posteriores ao último cancelamento.
    const validPauta = pautaHits.filter((h) => h.idx > lastCancelIdx);
    if (validPauta.length > 0) {
      // Usa o ÚLTIMO movimento de pauta válido (remarcações).
      const chosen = validPauta[validPauta.length - 1];
      const dm = extractScheduledDate(chosen.content, chosen.stepDate);
      if (dm) {
        const [d, m, y] = dm.split("/");
        dataJulgamento = `${y}-${m}-${d}`;
        temDataJulgamento = "S";
      }
      horarioJulgamento = extractHorario(chosen.content);
      tipoJulgamento = extractTipo(chosen.content);

      // Fallback: se não achou horário/tipo no movimento principal, varre os
      // demais movimentos de pauta (mais recentes primeiro).
      if (!horarioJulgamento || !tipoJulgamento) {
        for (let i = validPauta.length - 2; i >= 0; i--) {
          if (!horarioJulgamento) horarioJulgamento = extractHorario(validPauta[i].content);
          if (!tipoJulgamento) tipoJulgamento = extractTipo(validPauta[i].content);
          if (horarioJulgamento && tipoJulgamento) break;
        }
      }
      console.log(
        `[buscar-judit] pauta detectada -> data=${dataJulgamento} hora=${horarioJulgamento} tipo=${tipoJulgamento} | hits=${validPauta.length} cancel_idx=${lastCancelIdx}`,
      );
    }

    const pautaReferencia = validPauta.length > 0 ? validPauta[validPauta.length - 1].stepDate : null;
    if (tribunalAcronimo === "TST" && pautaReferencia) {
      const pautaOficialTst = await consultarPautaPublicaTst(cnj, turma, pautaReferencia);
      if (pautaOficialTst) {
        dataJulgamento = pautaOficialTst.data;
        horarioJulgamento = pautaOficialTst.horario || horarioJulgamento;
        tipoJulgamento = pautaOficialTst.tipo || tipoJulgamento;
        temDataJulgamento = "S";
        console.log(`[buscar-judit] pauta oficial TST aplicada -> data=${dataJulgamento} hora=${horarioJulgamento} tipo=${tipoJulgamento}`);
      }
    }

    // Demais resultados (transcendência, conhecimento, baixa) — varre todos os steps.
    for (const step of steps) {
      const content = (step?.content || step?.title || step?.description || "").toString();

      if (SEM_TRANSC.test(content)) resultadoSemTranscendencia = true;
      if (CONH_NAO_PROV.test(content)) resultadoConhecidoNaoProvido = true;
      else if (CONH_PROV.test(content)) resultadoConhecidoProvido = true;
      if (NAO_CONHECIDO.test(content) && !resultadoConhecidoProvido && !resultadoConhecidoNaoProvido) {
        resultadoNaoConhecido = true;
      }
      if (BAIXA.test(content)) processoBaixado = "S";
    }

    if (processoBaixado === "S") {
      const hasTransito = steps.some((s: any) =>
        /tr[aâ]nsito em julgado|certid[aã]o de tr[aâ]nsito/i.test(
          (s?.content || "").toString(),
        )
      );
      situacaoProcesso = hasTransito ? "Trânsito em Julgado" : "Baixado";
    }

    const lastStep = rd.last_step || null;
    const comarca = rd.county || null;
    const courts = rd.courts || null;

    // Recursos por parte (1c + 3b): identifica recursos do reclamante e da reclamada
    // pelo texto do andamento + cruzamento com nomes do polo, concatenando em ordem
    // cronológica (ex: "RO + RR").
    // IMPORTANTE: a Judit retorna 1 objeto por instância. Os movimentos de
    // interposição (RO, RR, AIRR…) ficam na instância em que foram protocolados
    // (TRT/Vara), mas a instância "selecionada" para os demais campos costuma ser
    // a mais alta (ex.: TST). Para identificar corretamente quem recorreu,
    // precisamos varrer os steps de TODAS as instâncias retornadas (+ cache),
    // não apenas da instância escolhida.
    const stepsAgregados: any[] = [];
    const stepsSeen = new Set<string>();
    const pushSteps = (arr: any[] | undefined | null) => {
      if (!Array.isArray(arr)) return;
      for (const s of arr) {
        if (!s) continue;
        const key = `${s.step_date || s.date || ""}|${(s.content || s.title || s.description || "").toString().slice(0, 200)}`;
        if (stepsSeen.has(key)) continue;
        stepsSeen.add(key);
        stepsAgregados.push(s);
      }
    };
    pushSteps(steps);
    if (cachedRd && cachedRd !== rd) pushSteps(cachedRd.steps);
    for (const item of allInstancesPageData) {
      const otherRd = item?.response_data;
      if (!otherRd || otherRd === rd) continue;
      pushSteps(otherRd.steps);
    }
    const detalheInstancias = (allInstancesPageData || []).map((item: any) => ({
      tr: item?.response_data?.tribunal_acronym,
      inst: item?.response_data?.instance,
      steps: Array.isArray(item?.response_data?.steps) ? item.response_data.steps.length : 0,
    }));
    console.log(`[buscar-judit] steps_agregados_para_recursos=${stepsAgregados.length} (instancia_selecionada=${steps.length}) instancias=${JSON.stringify(detalheInstancias)} cached_steps=${cachedRd?.steps?.length || 0}`);
    const recursosPorParte = extrairRecursosPorParte(stepsAgregados, parties);
    // POLÍTICA: tipo de recurso vem APENAS de movimentos confirmados pela Judit
    // (interposição explícita, com identificação de lado). Sem fallback por
    // classificação da capa, sem inferência por person_type. Se a Judit não
    // confirmar, os campos ficam null — o frontend sobrescreve valores antigos.

    recursosPorParte.reclamante = normalizarListaRecursos(recursosPorParte.reclamante);
    recursosPorParte.banco = normalizarListaRecursos(recursosPorParte.banco);

    const tipoRecursoCombinado =
      recursosPorParte.reclamante && recursosPorParte.banco
        ? recursosPorParte.reclamante === recursosPorParte.banco
          ? recursosPorParte.reclamante
          : `${recursosPorParte.reclamante} - ${recursosPorParte.banco}`
        : recursosPorParte.reclamante || recursosPorParte.banco || null;

    const fonteTipoRecurso: "judit" | "nenhuma" =
      recursosPorParte.reclamante || recursosPorParte.banco ? "judit" : "nenhuma";
    const motivoVazio: string | null = fonteTipoRecurso === "nenhuma"
      ? "judit_sem_interposicao_identificada"
      : null;
    console.log(`[buscar-judit] tipo_recurso fonte=${fonteTipoRecurso} reclamante=${recursosPorParte.reclamante} banco=${recursosPorParte.banco}`);

    const result = {
      dossie: null, // Judit não tem dossiê Santander
      // Tipo de recurso APENAS quando confirmado por movimento Judit.
      // Sem fallback para `classificacao` (classe da capa) — esta é apenas
      // a classe processual atual, não comprova quem interpôs o recurso.
      tipo_recurso: tipoRecursoCombinado,
      tipo_recurso_reclamante: recursosPorParte.reclamante,
      tipo_recurso_banco: recursosPorParte.banco,
      _judit_meta: {
        fonte_tipo_recurso: fonteTipoRecurso,
        motivo_vazio: motivoVazio,
        classe_capa: classificacao ?? null,
      },
      // o cliente Lovable espera yyyy-MM-dd no input de data; mantemos ISO.
      // Se quiser pt-BR, troque por dataDistribuicaoBR.
      data_distribuicao: dataDistribuicaoISO,
      relator,
      turma,
      tribunal,
      tribunal_acronimo: tribunalAcronimo,
      recorrente: poloAtivo || null,
      polo_passivo: poloPassivo || null,
      situacao_processo: situacaoProcesso,
      comarca,
      vara: courts,
      tem_data_julgamento: temDataJulgamento,
      data_julgamento: dataJulgamento,
      horario_julgamento: horarioJulgamento,
      tipo_julgamento: tipoJulgamento,
      resultado_sem_transcendencia: resultadoSemTranscendencia,
      resultado_nao_conhecido: resultadoNaoConhecido,
      resultado_conhecido_provido: resultadoConhecidoProvido,
      resultado_conhecido_nao_provido: resultadoConhecidoNaoProvido,
      resultado_outra: null,
      processo_baixado: processoBaixado,
      ultimo_andamento: lastStep
        ? { data: lastStep.step_date, conteudo: lastStep.content }
        : null,
      raw_status: rawStatus,
      raw_classification: classificacao,
      raw_courts: courts,
      total_steps: steps.length,
      parties_detail: parties.map((p: any) => ({
        nome: p?.name || '',
        documento: p?.main_document || null,
        tipo_pessoa: p?.person_type || null,
        polo: p?.side || null,
        // Lado efetivo CONSOLIDADO por parte (mesmo doc): respeita o lado
        // original quando disponível, evitando que o frontend re-misture.
        lado_efetivo: (() => {
          const doc = (p?.main_document || "").toString().replace(/\D/g, "");
          const key = doc || (p?.name || "").toString().trim().toUpperCase();
          const consolidado = ladoPorParte.get(key);
          return consolidado ? consolidado.lado : ladoEfetivo(p);
        })(),
        is_advogado: (p?.person_type || '').toUpperCase() === 'ADVOGADO',
      })),
      _debug: {
        request_id: requestId,
        status_judit: debugStatus,
        instancias_retornadas: debugInstancias,
        tribunal_selecionado: rd.tribunal_acronym,
        instance_selecionada: rd.instance,
        distribution_date_br: dataDistribuicaoBR,
        judge_bruto: rd.judge ?? null,
        courts_brutos: (rd.courts || []).map((c: any) => c?.name || c),
        steps_amostra: (steps || []).slice(0, 8).map((s: any) => ({
          data: s.step_date,
          content: (s.content || "").toString().substring(0, 250),
        })),
      },
    };

    console.log("[buscar-judit] resultado:", JSON.stringify(result));
    return json(result, 200);
  } catch (error) {
    console.error("[buscar-judit] erro:", error);
    return json({ error: (error as Error).message || "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
