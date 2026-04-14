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

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 110_000;   // edge functions do Supabase limitam ~150s
const CACHE_TTL_DAYS = 7;

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

function selecionarInstancia(pageData: any[]): any | null {
  if (!pageData?.length) return null;

  const rds = pageData
    .map((item) => item?.response_data)
    .filter((rd) => rd && typeof rd === "object");

  if (!rds.length) return null;

  // 1) TST explícito
  const tst = rds.find((rd) => {
    const t = (rd.tribunal_acronym || "").toUpperCase();
    return t === "TST" || t === "STF" || t === "STJ";
  });
  if (tst) return tst;

  // 2) maior instance
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
  // qualquer órgão colegiado reconhecível
  for (const c of courts) {
    const nome = (c?.name || "").toString();
    if (/turma|sdi|subse|seção|câmara|órgão especial/i.test(nome)) return nome;
  }
  return null;
}

function extrairRelator(rd: any): string | null {
  const j = rd.judge;
  if (typeof j === "string" && j.trim()) return j.trim();
  if (j && typeof j === "object" && j.name) return j.name;

  // Ministros do TST aparecem como "parties" com person_type específico
  // apenas em alguns crawlers. Tentamos também steps[].content.
  if (Array.isArray(rd.parties)) {
    const mag = rd.parties.find((p: any) => {
      const t = (p?.person_type || "").toUpperCase();
      return ["MAGISTRADO", "JUIZ", "RELATOR", "DESEMBARGADOR", "MINISTRO"].includes(t);
    });
    if (mag?.name) return mag.name;
  }

  const RX_REL = /(?:relator|relatora|min(?:istro|istra)?\.?)[\s:]+([A-ZÁÉÍÓÚÂÊÔÇÃÕ][A-Za-zÁÉÍÓÚÂÊÔÇÃÕáéíóúâêôçãõ.\s]{5,60})/i;
  for (const s of rd.steps || []) {
    const txt = (s?.content || "").toString();
    const m = txt.match(RX_REL);
    if (m) {
      const cand = m[1].trim().replace(/[.,;]+$/, "");
      if (cand.split(/\s+/).length >= 2) return cand;
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
    const numero_processo = body?.numero_processo;
    if (!numero_processo || typeof numero_processo !== "string") {
      return json({ error: "Número do processo é obrigatório" }, 400);
    }
    const cnj = numero_processo.trim();
    console.log(`[buscar-judit] CNJ=${cnj}`);

    // 1) cria requisição assíncrona
    const requestId = await juditCriarRequest(JUDIT_API_KEY, cnj);
    if (!requestId) {
      return json({ error: "Falha ao criar requisição na Judit" }, 502);
    }
    console.log(`[buscar-judit] request_id=${requestId}`);

    // 2) polling até completed
    const envelope = await juditPollRespostas(JUDIT_API_KEY, requestId);
    if (!envelope) {
      return json({ error: "Sem resposta da Judit (timeout)" }, 504);
    }

    const pageData = envelope.page_data ?? [];
    console.log(
      `[buscar-judit] status=${envelope.request_status} instancias=${pageData.length} acronimos=${pageData
        .map((i: any) => i?.response_data?.tribunal_acronym)
        .join(",")}`,
    );

    const rd = selecionarInstancia(pageData);
    if (!rd) {
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

    console.log(
      `[buscar-judit] selecionado: tribunal=${rd.tribunal_acronym} instance=${rd.instance}`,
    );

    // ---- extração ----
    const tribunalAcronimo = (rd.tribunal_acronym || "").toUpperCase() || null;
    let tribunal: string | null = null;
    if (tribunalAcronimo?.includes("TST")) tribunal = "TST";
    else if (tribunalAcronimo?.includes("STF")) tribunal = "STF";
    else if (tribunalAcronimo?.includes("STJ")) tribunal = "STJ";
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

    // partes
    const parties = Array.isArray(rd.parties) ? rd.parties : [];
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
      _debug: {
        request_id: requestId,
        status_judit: envelope.request_status,
        instancias_retornadas: pageData.length,
        acronimos_retornados: pageData.map(
          (i: any) => i?.response_data?.tribunal_acronym,
        ),
        tribunal_selecionado: rd.tribunal_acronym,
        instance_selecionada: rd.instance,
        distribution_date_br: dataDistribuicaoBR,
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
