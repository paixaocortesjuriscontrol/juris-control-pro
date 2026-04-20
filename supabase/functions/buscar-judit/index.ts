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

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;    // 30s — reduzido, pois cache-first resolve maioria
const CACHE_TTL_DAYS = 7;

// ---------- DataJud fallback (CNJ public API) -----------------------------
const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";

interface DataJudOrgao {
  relator: string | null;
  turma: string | null;
  dataDistribuicao: string | null;
  classe: string | null;
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
    const timeout = setTimeout(() => controller.abort(), 15000);

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: digits } },
        size: 1,
        _source: ["orgaoJulgador", "classe", "dataAjuizamento", "relator"],
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
    const orgao = src?.orgaoJulgador || {};
    const codigoOrgao = orgao?.codigoOrgao?.toString() || "";
    const nomeOrgao = orgao?.nomeOrgao || "";

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
    const mGab = nomeOrgao.match(/(?:Gabinete\s+[-–]?\s*d[oa]\s+)?(?:Ministro|Ministra|Min\.?|Desembargador(?:a)?)\s+(.+)/i);
    if (mGab) {
      relator = mGab[1].trim().replace(/[.,;()\-]+$/, "");
    }

    // Classe processual
    const classe = src?.classe?.nome || null;

    // Data
    const dataAjuiz = src?.dataAjuizamento?.substring(0, 10) || null;

    console.log(`[buscar-judit][datajud] orgao=${nomeOrgao} relator=${relator} turma=${turma} classe=${classe}`);
    return { relator, turma, dataDistribuicao: dataAjuiz, classe };
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
): Promise<string | null> {
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
    console.error(`POST /requests ${r.status}: ${await r.text()}`);
    return null;
  }
  const data = await r.json();
  return data.request_id ?? null;
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
  const courts = Array.isArray(rd.courts) ? rd.courts : [];
  for (const c of courts) {
    const nome = (c?.name || "").toString();
    if (/ministro|min\./i.test(nome)) return true;
    if (/\bTST\b/i.test(nome)) return true;
  }
  // classifications com "RR", "AIRR", "Ag-AIRR" etc indicam TST
  const classes = Array.isArray(rd.classifications) ? rd.classifications : [];
  for (const cl of classes) {
    const n = (cl?.name || "").toUpperCase();
    if (/^(RR|AIRR|AG-AIRR|ARR|ED-RR|ED-AIRR|RO|ROAG)$/.test(n)) return true;
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
    
    // Cache só é útil se o tribunal bater com o hint (cache retorna 1 instância, geralmente TRT)
    const cacheMatchesHint = cachedRd && (!tribunalHint || 
      (cachedRd.tribunal_acronym || "").toUpperCase() === tribunalHint.toUpperCase() ||
      (tribunalHint.toUpperCase() === "TST" && temIndicioTST(cachedRd)));
    
    if (cachedRd && cacheMatchesHint) {
      rd = cachedRd;
      console.log(`[buscar-judit] Usando dados do cache direto (tribunal=${cachedRd.tribunal_acronym})`);
    } else {
      // Fallback: fluxo assíncrono (crawler) — retorna TODAS as instâncias
      if (cachedRd && !cacheMatchesHint) {
        console.log(`[buscar-judit] Cache descartado: tribunal_cache=${cachedRd.tribunal_acronym} hint=${tribunalHint}`);
      }
      debugStatus = "async_poll";
      requestId = await juditCriarRequest(JUDIT_API_KEY, cnj);
      if (!requestId) {
        return json({ error: "Falha ao criar requisição na Judit" }, 502);
      }
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
        // Se não achou instância TST mas tem cache, usar o cache como fallback
        if (cachedRd) {
          console.log(`[buscar-judit] TST não encontrado, usando cache como fallback`);
          rd = cachedRd;
        } else {
          return json(
            {
              error: "Processo não encontrado na Judit",
              _debug: {
                request_id: requestId,
                status_judit: envelope.request_status,
                instancias_retornadas: pageData.length,
              },
            },
            404,
          );
        }
      }

      console.log(
        `[buscar-judit] selecionado: tribunal=${rd.tribunal_acronym} instance=${rd.instance}`,
      );
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
    const dataDistribuicaoBR = toDateBR(rd.distribution_date);
    const dataDistribuicaoISO = toDateISO(rd.distribution_date);

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
    // Deduplicar: chave = documento normalizado (se houver) OU name+side+person_type
    const seen = new Set<string>();
    const parties: any[] = [];
    for (const p of partiesPool) {
      const doc = (p?.main_document || "").toString().replace(/\D/g, "");
      const name = (p?.name || "").toString().trim().toUpperCase();
      const side = (p?.side || "").toString().toUpperCase();
      const ptype = (p?.person_type || "").toString().toUpperCase();
      const key = doc ? `doc:${doc}:${ptype}` : `nm:${name}:${side}:${ptype}`;
      if (!key || key === "nm:::") continue;
      if (seen.has(key)) continue;
      seen.add(key);
      parties.push(p);
    }
    console.log(`[buscar-judit] partes unidas: pool=${partiesPool.length} dedup=${parties.length}`);
    const poloAtivo = parties
      .filter((p: any) =>
        (p?.side || "").toUpperCase() === "ACTIVE" &&
        (p?.person_type || "").toUpperCase() !== "ADVOGADO"
      )
      .map((p: any) => p?.name)
      .filter(Boolean)
      .join(", ");
    const poloPassivo = parties
      .filter((p: any) =>
        (p?.side || "").toUpperCase() === "PASSIVE" &&
        (p?.person_type || "").toUpperCase() !== "ADVOGADO"
      )
      .map((p: any) => p?.name)
      .filter(Boolean)
      .join(", ");

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
    const PAUTA = /pauta|sess[aã]o de julgamento|inclu[ií]d[oa] em pauta|designad[oa].*julgamento|julgamento.*designad/i;
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

    for (const step of steps) {
      const content = (step?.content || step?.title || step?.description || "").toString();
      const stepDate = step?.step_date || step?.date || null;

      if (PAUTA.test(content) && !dataJulgamento) {
        const dm = content.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dm) {
          const [d, m, y] = dm[1].split("/");
          dataJulgamento = `${y}-${m}-${d}`;
        } else if (stepDate) {
          dataJulgamento = stepDate.substring(0, 10);
        }
        temDataJulgamento = "S";
        const hm = content.match(/(\d{1,2})[h:](\d{2})/);
        if (hm) horarioJulgamento = `${hm[1].padStart(2, "0")}:${hm[2]}`;
        if (/virtual/i.test(content)) tipoJulgamento = "Virtual";
        else if (/telepresencial/i.test(content)) tipoJulgamento = "Telepresencial";
        else if (/h[ií]brid/i.test(content)) tipoJulgamento = "Híbrido";
        else if (/presencial/i.test(content)) tipoJulgamento = "Presencial";
      }

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

    const result = {
      dossie: null, // Judit não tem dossiê Santander
      tipo_recurso: classificacao,
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
