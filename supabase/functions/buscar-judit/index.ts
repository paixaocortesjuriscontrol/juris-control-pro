// supabase/functions/buscar-judit/index.ts
//
// VERSÃO SIMPLIFICADA — somente Judit (cache + crawler), sem DataJud, sem
// heurísticas de pauta/trânsito/resultado. O Crawler Judit já devolve tudo
// que o advogado precisa: status, data_distribuicao, partes (com polo
// ACTIVE/PASSIVE), classe (= tipo de recurso), juiz/relator e órgão julgador.
//
// Contrato com o frontend (campos lidos em DistribuicaoTstForm e exibidos em
// AnaliseJuditTab) preservado nos nomes principais.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
const POLL_TIMEOUT_MS = 20_000;
const CACHE_TTL_DAYS = 7;

// ---------- Helpers ---------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isoToBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = String(iso).substring(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

// ---------- Judit cache (lookup direto, instantâneo) -----------------------

async function juditCache(apiKey: string, cnj: string): Promise<any | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${LAWSUITS_BASE}/${encodeURIComponent(cnj)}`, {
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      await r.text();
      return null;
    }
    const data = await r.json();
    const rd = data?.response_data || data;
    if (!rd || typeof rd !== "object") return null;
    if (!rd.steps?.length && !rd.parties?.length && !rd.courts?.length) return null;
    return rd;
  } catch {
    return null;
  }
}

// ---------- Judit crawler (assíncrono, agrega TODAS as instâncias) ---------

async function juditCriarRequest(apiKey: string, cnj: string): Promise<string | null> {
  const r = await fetch(REQUESTS_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      search: {
        search_type: "lawsuit_cnj",
        search_key: cnj,
        response_type: "lawsuit",
        cache_ttl_in_days: CACHE_TTL_DAYS,
      },
    }),
  });
  if (!r.ok) {
    console.error(`POST /requests ${r.status}: ${await r.text()}`);
    return null;
  }
  const data = await r.json();
  return data?.request_id || null;
}

async function juditPollar(apiKey: string, requestId: string): Promise<any | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let ultima: any = null;
  while (Date.now() < deadline) {
    try {
      const url = new URL(RESPONSES_URL);
      url.searchParams.set("request_id", requestId);
      url.searchParams.set("page_size", "50");
      const r = await fetch(url.toString(), { headers: { "api-key": apiKey } });
      if (r.status === 429) { await sleep(3000); continue; }
      if (!r.ok) { await r.text(); await sleep(POLL_INTERVAL_MS); continue; }
      const data = await r.json();
      ultima = data;
      if (data.request_status === "completed") return data;
      if (data.request_status === "cancelled") return data;
    } catch (e) {
      console.error("polling:", e);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return ultima;
}

// Seleciona a instância TST entre as várias retornadas pelo crawler.
function selecionarTst(pageData: any[]): { rd: any; foiTst: boolean } | null {
  if (!Array.isArray(pageData) || !pageData.length) return null;
  const rds = pageData
    .map((it) => it?.response_data)
    .filter((rd) => rd && typeof rd === "object");
  if (!rds.length) return null;
  // A Judit NÃO marca instância TST via tribunal_acronym (continua TRT da origem).
  // Identificadores reais de TST, em ordem de confiança:
  //   1) crawler.source_name contém " TST "  (ex.: "PJE - TRT - TST - Lawsuit - Auth - 3 instance")
  //   2) courts[0].name começa com "Gabinete do Ministro" (relatores do TST)
  //   3) classifications[0].code é uma classe típica do TST (RR, AIRR, ED-RR, AgR, E-RR, ARR…)
  const TST_CLASSES = new Set([
    "RR", "AIRR", "ED-RR", "EDRR", "AGR-RR", "AGR", "E-RR", "ERR", "ARR", "AIRE", "ED-AIRR",
  ]);
  const isTst = (rd: any) => {
    const src = String(rd?.crawler?.source_name || "").toUpperCase();
    if (/\bTST\b/.test(src)) return true;
    const court = String(rd?.courts?.[0]?.name || "").toLowerCase();
    if (court.startsWith("gabinete do ministro")) return true;
    const clsCode = String(rd?.classifications?.[0]?.code || "").toUpperCase();
    if (TST_CLASSES.has(clsCode)) return true;
    return false;
  };
  const tst = rds.find(isTst);
  if (tst) return { rd: tst, foiTst: true };
  // Sem TST: pega a maior instância (mais steps) como aproximação.
  rds.sort((a, b) => (b?.steps?.length || 0) - (a?.steps?.length || 0));
  return { rd: rds[0], foiTst: false };
}

// ---------- Extração simples direto do response_data Judit -----------------

function extrairPartes(rd: any): {
  poloAtivo: string;
  poloPassivo: string;
  partiesDetail: any[];
} {
  const parties: any[] = Array.isArray(rd?.parties) ? rd.parties : [];
  const ativos: string[] = [];
  const passivos: string[] = [];
  const detail: any[] = [];

  // dedup por documento (ou nome quando não houver)
  const seen = new Set<string>();

  for (const p of parties) {
    const tipo = String(p?.person_type || "").toUpperCase();
    const isAdv = tipo === "ADVOGADO";
    const nome = String(p?.name || "").trim();
    if (!nome) continue;
    const doc = String(p?.main_document || "").replace(/\D/g, "");
    const key = `${doc || nome.toUpperCase()}|${isAdv ? "A" : "P"}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const side = String(p?.side || "").toUpperCase();
    detail.push({
      nome,
      documento: p?.main_document || null,
      tipo_pessoa: p?.person_type || null,
      polo: p?.side || null,
      lado_efetivo: side === "ACTIVE" || side === "PASSIVE" ? side : null,
      is_advogado: isAdv,
    });
    if (isAdv) continue;
    if (side === "ACTIVE") ativos.push(nome);
    else if (side === "PASSIVE") passivos.push(nome);
  }

  return {
    poloAtivo: ativos.join(", "),
    poloPassivo: passivos.join(", "),
    partiesDetail: detail,
  };
}

function extrairClasse(rd: any): string | null {
  const cls = Array.isArray(rd?.classifications) ? rd.classifications : [];
  if (cls.length && cls[0]?.name) return String(cls[0].name);
  return null;
}

function extrairOrgaoERelator(rd: any): { orgao: string | null; relator: string | null; turma: string | null } {
  // judge pode vir como string "NÃO INFORMADO", objeto {name}, ou ausente.
  let relator: string | null = null;
  const judge = rd?.judge;
  if (judge && typeof judge === "object" && judge.name) {
    relator = String(judge.name).trim();
  } else if (typeof judge === "string" && judge.trim() && !/n[aã]o\s*informado/i.test(judge)) {
    relator = judge.trim();
  }

  const courts = Array.isArray(rd?.courts) ? rd.courts : [];
  const orgao = courts.length && courts[0]?.name ? String(courts[0].name).trim() : null;

  // No TST o nome do órgão costuma ser "Gabinete do Ministro Fulano" — extrai relator daí.
  if (!relator && orgao) {
    const mGab = orgao.match(/^Gabinete\s+do\s+Ministro\s+(.+)$/i);
    if (mGab) relator = mGab[1].trim();
  }

  // Turma só quando o nome do órgão tem padrão "Nª Turma"
  let turma: string | null = null;
  if (orgao) {
    const m = orgao.match(/(\d+)\s*[ªºa]?\s*turma/i);
    if (m) turma = `${m[1]}ª Turma`;
  }
  return { orgao, relator, turma };
}

function extrairSituacao(rd: any): string | null {
  const s = String(rd?.status || "").toUpperCase();
  if (!s) return null;
  if (s.includes("ATIVO") || s === "ATIVA") return "Ativo";
  if (s.includes("FINALIZADO") || s.includes("ARQUIVADO")) return "Arquivado";
  if (s.includes("BAIXADO")) return "Baixado";
  if (s.includes("SUSPENSO")) return "Suspenso";
  return String(rd?.status || null);
}

// ---------- Handler --------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("JUDIT_API_KEY");
    if (!apiKey) return json({ error: "JUDIT_API_KEY não configurada" }, 500);

    const body = await req.json().catch(() => ({}));
    const numero = String(body?.numero_processo || "").trim();
    if (!numero) return json({ error: "numero_processo é obrigatório" }, 400);
    const tribunalHint = String(body?.tribunal || "").trim().toUpperCase() || null;

    const cnj = numero;
    const rawCollector: { cache_lookup: any; crawler: any } = {
      cache_lookup: null,
      crawler: null,
    };

    // 1) Cache (instantâneo)
    const cached = await juditCache(apiKey, cnj);
    if (cached) {
      rawCollector.cache_lookup = cached;
      console.log(`[buscar-judit] cache hit (tribunal=${cached?.tribunal_acronym})`);
    }

    // 2) Crawler async — sempre dispara para garantir TST e dados frescos
    let rdSelecionada: any = null;
    let foiTst = false;

    const reqId = await juditCriarRequest(apiKey, cnj);
    if (reqId) {
      const envelope = await juditPollar(apiKey, reqId);
      if (envelope) {
        const pageData = envelope.page_data || [];
        rawCollector.crawler = {
          request_id: reqId,
          request_status: envelope.request_status,
          page: envelope.page,
          all_count: envelope.all_count,
          page_count: envelope.page_count,
          all_pages_count: envelope.all_pages_count,
          page_data: pageData,
        };
        const sel = selecionarTst(pageData);
        if (sel) {
          rdSelecionada = sel.rd;
          foiTst = sel.foiTst;
        }
      }
    }

    // 3) Se crawler não trouxe nada, usa cache como rd
    if (!rdSelecionada && cached) {
      rdSelecionada = cached;
      foiTst = String(cached?.tribunal_acronym || "").toUpperCase() === "TST";
    }

    if (!rdSelecionada) {
      return json({
        error: "Judit não retornou dados para este processo",
        _judit_raw: rawCollector,
      }, 404);
    }

    // ---------- Extração simples ----------
    const { poloAtivo, poloPassivo, partiesDetail } = extrairPartes(rdSelecionada);
    const classe = extrairClasse(rdSelecionada);
    const { orgao, relator, turma } = extrairOrgaoERelator(rdSelecionada);
    const situacao = extrairSituacao(rdSelecionada);

    // Data de distribuição = data em que o processo chegou no órgão atual (instância
    // selecionada). Quando temos a instância TST, isto corresponde à data em que o
    // recurso foi distribuído lá (ex.: 10/12/2025), e NÃO à data da inicial do
    // processo originário.
    const dataDistISO = rdSelecionada?.distribution_date
      ? String(rdSelecionada.distribution_date).substring(0, 10)
      : null;
    const dataDistBR = isoToBR(dataDistISO);

    // Recorrente: na instância TST as partes vêm com person_type RECORRENTE/RECORRIDO
    // (e side Active/Passive). Quem está com person_type=RECORRENTE é quem recorre.
    const partiesArr: any[] = Array.isArray(rdSelecionada?.parties) ? rdSelecionada.parties : [];
    const recorrentes = [...new Set(
      partiesArr
        .filter((p) => /RECORRENTE|AGRAVANTE|EMBARGANTE/i.test(String(p?.person_type || "")))
        .map((p) => String(p?.name || "").trim())
        .filter(Boolean)
    )];
    const recorrente = recorrentes.length ? recorrentes.join(", ") : (poloAtivo || null);

    // Tipo de recurso por parte: cruza person_type da instância TST com o
    // person_type da instância 1 (RECLAMANTE/RECLAMADO). Quem é RECORRENTE no TST
    // e RECLAMANTE na origem -> tipo_recurso_reclamante = classe.
    // Quem é RECORRENTE no TST e RECLAMADO na origem -> tipo_recurso_banco = classe.
    let tipoRecursoReclamante: string | null = null;
    let tipoRecursoBanco: string | null = null;
    if (classe) {
      // Mapa documento -> person_type original (instância 1, que está em rawCollector
      // ou no cache_lookup). Usa o cache_lookup quando disponível, senão a primeira
      // entrada do crawler que NÃO seja a instância TST.
      const origemRd: any = rawCollector.cache_lookup
        || (rawCollector.crawler?.page_data || [])
            .map((it: any) => it?.response_data)
            .find((rd: any) => rd && rd !== rdSelecionada);
      const origemParties: any[] = Array.isArray(origemRd?.parties) ? origemRd.parties : [];
      const origemMap = new Map<string, string>(); // doc -> person_type
      for (const p of origemParties) {
        const doc = String(p?.main_document || "").replace(/\D/g, "");
        const pt = String(p?.person_type || "").toUpperCase();
        if (doc && pt && pt !== "ADVOGADO") origemMap.set(doc, pt);
      }
      for (const p of partiesArr) {
        const pt = String(p?.person_type || "").toUpperCase();
        if (!/RECORRENTE|AGRAVANTE|EMBARGANTE/.test(pt)) continue;
        const doc = String(p?.main_document || "").replace(/\D/g, "");
        const origemPt = origemMap.get(doc) || "";
        if (/RECLAMANTE|AUTOR|EXEQUENTE/.test(origemPt)) tipoRecursoReclamante = classe;
        else if (/RECLAMAD|R[ÉE]U|EXECUTAD/.test(origemPt)) tipoRecursoBanco = classe;
        else {
          // sem dados de origem: usa side (Active = recorrente original = Banco em
          // recursos do Banco; Passive = Reclamante)
          const side = String(p?.side || "").toUpperCase();
          if (side === "ACTIVE") tipoRecursoBanco = classe;
          else if (side === "PASSIVE") tipoRecursoReclamante = classe;
        }
      }
      // Fallback: se nenhum dos dois preenchido mas há classe, marca o lado ativo.
      if (!tipoRecursoReclamante && !tipoRecursoBanco) {
        tipoRecursoBanco = classe; // Banco é o cliente; assume que é ele recorrendo
      }
    }

    const result = {
      // Campos consumidos pelo DistribuicaoTstForm:
      dossie: null,
      data_distribuicao: dataDistISO,
      relator: relator,
      turma: turma,
      // Regras:
      //  - Se identificamos a instância TST, retorna "TST".
      //  - Se o caller pediu "TST" mas NÃO achamos instância TST, retorna null
      //    (não sobrescreve a escolha manual do usuário no form).
      //  - Caso contrário, devolve o acrônimo da instância selecionada.
      tribunal: foiTst
        ? "TST"
        : (tribunalHint === "TST" ? null : (rdSelecionada?.tribunal_acronym || null)),
      tribunal_acronimo: rdSelecionada?.tribunal_acronym || null,
      recorrente: recorrente,
      polo_passivo: poloPassivo || null,
      situacao_processo: situacao,
      tipo_recurso: classe,
      tipo_recurso_reclamante: tipoRecursoReclamante,
      tipo_recurso_banco: tipoRecursoBanco,
      // Campos de pauta/julgamento — não extraímos mais via heurística.
      tem_data_julgamento: "N",
      data_julgamento: null,
      horario_julgamento: null,
      tipo_julgamento: null,
      processo_baixado: situacao === "Arquivado" || situacao === "Baixado" ? "S" : "N",

      // Metadados úteis para a UI:
      orgao_julgador: orgao,
      classe_capa: classe,
      data_distribuicao_br: dataDistBR,
      parties_detail: partiesDetail,

      // Auditoria — exibida na aba Análise Judit:
      _judit_meta: {
        fonte: foiTst ? "crawler_tst" : (rdSelecionada ? "fallback_outra_instancia" : "vazio"),
        tribunal_selecionado: rdSelecionada?.tribunal_acronym || null,
        instance_selecionada: rdSelecionada?.instance || null,
      },
      _judit_raw: rawCollector,
    };

    console.log(`[buscar-judit] ${cnj} -> tribunal=${result.tribunal} relator=${relator} classe=${classe} situacao=${situacao}`);
    return json(result, 200);
  } catch (e) {
    console.error("[buscar-judit] erro:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}