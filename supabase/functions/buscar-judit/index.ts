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
import { derivarTurmaDoRelator } from "../_shared/extrair-relator.ts";

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
// Crawler do TST normalmente leva 8–25s; o cap antigo de 20s estava cortando
// antes da Judit completar.
const POLL_TIMEOUT_MS = 60_000;
// Cache padrão de 1 dia — buscas repetidas no mesmo processo no mesmo dia
// voltam quase instantâneas. Quando precisa ignorar o cache, passar
// `force_refresh: true` no body (envia cache_ttl_in_days=0).
const CACHE_TTL_DAYS_DEFAULT = 1;

// ---------- Helpers ---------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cnjValido(d: string): boolean {
  if (!/^\d{20}$/.test(d)) return false;
  const rearranjado = `${d.slice(0, 7)}${d.slice(9, 13)}${d.slice(13, 14)}${d.slice(14, 16)}${d.slice(16, 20)}${d.slice(7, 9)}`;
  return BigInt(rearranjado) % 97n === 1n;
}

function normalizarDigitosCnj(d: string): string | null {
  if (d.length === 20) return cnjValido(d) ? d : null;
  for (let i = 0; i <= d.length - 20; i++) {
    const candidato = d.slice(i, i + 20);
    if (cnjValido(candidato)) return candidato;
  }
  if (d.length > 20 && d.length <= 25) {
    for (let i = 0; i < d.length; i++) {
      const candidato = d.slice(0, i) + d.slice(i + 1);
      const normalizado = normalizarDigitosCnj(candidato);
      if (normalizado && cnjValido(normalizado)) return normalizado;
    }
  }
  return null;
}

function isoToBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = String(iso).substring(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

// ---------- Heurística Santander (cliente do escritório) -------------------
// O Banco Santander é SEMPRE reclamada/passiva — independente do que a Judit
// devolva em `side` ou `person_type`. Identificamos pela raiz do CNPJ
// (90.400.888 = Santander Brasil S.A. e subsidiárias do grupo). Inclui também
// variações conhecidas: Santander Leasing, Banco Santander (Brasil), Aymoré.
const SANTANDER_CNPJ_ROOTS = new Set<string>([
  "90400888", // Banco Santander (Brasil) S.A.
  "47866934", // Aymoré Crédito, Financiamento e Investimento
  "59274605", // Santander Leasing
  "33009257", // Santander Brasil Tecnologia
]);
function isSantanderCnpj(doc: string | null | undefined): boolean {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length < 8) return false;
  return SANTANDER_CNPJ_ROOTS.has(d.substring(0, 8));
}
function isSantanderNome(nome: string | null | undefined): boolean {
  const n = String(nome || "").toUpperCase();
  return /\bSANTANDER\b/.test(n) || /\bAYMOR[EÉ]\b/.test(n);
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
  return juditCriarRequestComOpcoes(apiKey, cnj, false, CACHE_TTL_DAYS_DEFAULT);
}

// Remove qualquer campo `attachments` (em qualquer profundidade) do payload bruto
// devolvido pela Judit. A API retorna anexos dentro dos steps mesmo quando
// `with_attachments=false` (vem do cache). Como a UI exibe o _judit_raw, isso
// fazia aparecer "Anexos 99" mesmo sem o usuário marcar "Com anexos".
function stripAttachments(value: any): any {
  if (Array.isArray(value)) return value.map(stripAttachments);
  if (value && typeof value === "object") {
    const out: any = {};
    for (const k of Object.keys(value)) {
      if (k === "attachments") continue;
      out[k] = stripAttachments(value[k]);
    }
    return out;
  }
  return value;
}

function attachmentLogicalKey(nameValue: any, dateValue: any, extValue: any): string {
  const name = String(nameValue || "")
    .trim()
    .replace(/\s*\(C[ÓO]PIA\)\s*/gi, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, "")
    .toUpperCase();
  const date = String(dateValue || "").trim();
  const ext = String(extValue || "").trim().toLowerCase();
  return `${name}::${date}::${ext}`;
}

// Coleta attachments de TODAS as instâncias retornadas (cache + crawler page_data),
// não só da `rdSelecionada`. A Judit pode devolver os anexos no nível da capa
// (`response_data.attachments`) e/ou dentro dos andamentos.
function coletarAttachments(rdSelecionada: any, rawCollector: any, cnj: string): any[] {
  const fontes: any[] = [];
  if (rdSelecionada) fontes.push(rdSelecionada);
  if (rawCollector?.cache_lookup) fontes.push(rawCollector.cache_lookup);
  const pageData = rawCollector?.crawler?.page_data || [];
  for (const it of pageData) {
    const rd = it?.response_data;
    if (rd && !fontes.includes(rd)) fontes.push(rd);
  }

  const seen = new Set<string>();
  const out: any[] = [];
  for (const rd of fontes) {
    const instance = rd?.instance ?? rd?.crawler?.instance ?? null;
    const directAttachments = Array.isArray(rd?.attachments) ? rd.attachments : [];
    for (const a of directAttachments) {
      if (String(a?.status || "done").toLowerCase() !== "done" || a?.corrupted === true) continue;
      const downloadId = a?.attachment_id || a?.id || a?.step_id;
      if (!downloadId) continue;
      const contentKey = attachmentLogicalKey(a?.attachment_name || a?.name || a?.title, a?.attachment_date || a?.date, a?.extension || a?.ext);
      const idKey = `${instance ?? "?"}::${downloadId}`;
      if (seen.has(contentKey) || seen.has(idKey)) continue;
      seen.add(contentKey);
      seen.add(idKey);
      out.push({
        step_id: downloadId,
        attachment_id: a?.attachment_id || a?.id || downloadId,
        attachment_name: a?.attachment_name || a?.name || a?.title || null,
        attachment_date: a?.attachment_date || a?.date || null,
        extension: a?.extension || a?.ext || null,
        instance,
        cnj,
      });
    }

    const steps = Array.isArray(rd?.steps) ? rd.steps : [];
    for (const s of steps) {
      const atts = Array.isArray(s?.attachments) ? s.attachments : [];
      for (const a of atts) {
        const stepId = s?.step_id || s?.id || a?.step_id || null;
        if (String(a?.status || "done").toLowerCase() !== "done" || a?.corrupted === true) continue;
        const downloadId = a?.attachment_id || a?.id || a?.step_id || stepId;
        if (!downloadId) continue;
        const contentKey = attachmentLogicalKey(a?.name || a?.attachment_name || a?.title, a?.date || a?.attachment_date || s?.step_date, a?.extension || a?.ext);
        const idKey = `${instance ?? "?"}::${downloadId}`;
        if (seen.has(contentKey) || seen.has(idKey)) continue;
        seen.add(contentKey);
        seen.add(idKey);
        out.push({
          step_id: downloadId,
          attachment_id: a?.attachment_id || a?.id || downloadId,
          step_date: s?.step_date || s?.date || null,
          attachment_name: a?.name || a?.attachment_name || a?.title || null,
          attachment_date: a?.date || a?.attachment_date || null,
          extension: a?.extension || a?.ext || null,
          instance,
          cnj,
        });
      }
    }
  }
  return out;
}

async function juditCriarRequestComOpcoes(
  apiKey: string,
  cnj: string,
  comAnexos: boolean,
  cacheTtlDays: number = CACHE_TTL_DAYS_DEFAULT,
): Promise<string | null> {
  // Payload canônico da doc Judit (Busca Processual):
  // with_attachments fica no NÍVEL RAIZ do body, não dentro de search.
  // Padrão é false (consulta barata). Só vai true quando o usuário marca
  // explicitamente "Com anexos" no botão Judit individual.
  const r = await fetch(REQUESTS_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      search: {
        search_type: "lawsuit_cnj",
        search_key: cnj,
        cache_ttl_in_days: cacheTtlDays,
      },
      with_attachments: comAnexos === true,
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
  let backoff429 = 3000;
  let attempts429 = 0;
  while (Date.now() < deadline) {
    try {
      const url = new URL(RESPONSES_URL);
      url.searchParams.set("request_id", requestId);
      url.searchParams.set("page_size", "50");
      const r = await fetch(url.toString(), { headers: { "api-key": apiKey } });
      if (r.status === 429) {
        attempts429++;
        if (attempts429 >= 3) {
          console.warn("[buscar-judit] 429 persistente — abortando polling");
          return ultima;
        }
        await sleep(backoff429);
        backoff429 = Math.min(backoff429 * 2, 12_000);
        continue;
      }
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
    if (/^gabinete\s+d[ao]\s+ministr[ao]\b/.test(court)) return true;
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
    const mGab = orgao.match(/^Gabinete\s+d[ao]\s+Ministr[ao]\s+(.+)$/i);
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
    const comAnexos = body?.com_anexos === true;
    const forceRefresh = body?.force_refresh === true;
    const cacheTtlDays = forceRefresh ? 0 : CACHE_TTL_DAYS_DEFAULT;
    const t0 = Date.now();
    console.log(`[buscar-judit] modo=${comAnexos ? "COM_ANEXOS (caro)" : "sem anexos"} cnj=${numero} cache_ttl=${cacheTtlDays}d`);

    // Normaliza o CNJ para o formato canônico exigido pela Judit:
    // NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos com máscara). A Judit rejeita
    // strings com mais/menos dígitos ou sem máscara em alguns endpoints.
    const apenasDigitos = numero.replace(/\D/g, "");
    const digitosCnj = normalizarDigitosCnj(apenasDigitos);
    if (!digitosCnj) return json({
      error: `CNJ inválido: ${numero} (não foi possível normalizar para 20 dígitos válidos)`,
    }, 200);
    const cnj = `${digitosCnj.slice(0, 7)}-${digitosCnj.slice(7, 9)}.${digitosCnj.slice(9, 13)}.${digitosCnj.slice(13, 14)}.${digitosCnj.slice(14, 16)}.${digitosCnj.slice(16, 20)}`;
    console.log(`[buscar-judit] cnj normalizado=${cnj}`);
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

    const reqId = await juditCriarRequestComOpcoes(apiKey, cnj, comAnexos, cacheTtlDays);
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
      }, 200);
    }

    // ---------- Extração simples ----------
    const { poloAtivo, poloPassivo, partiesDetail } = extrairPartes(rdSelecionada);
    const classe = extrairClasse(rdSelecionada);
    const { orgao, relator, turma } = extrairOrgaoERelator(rdSelecionada);
    // Fallback: no TST a Judit costuma devolver "Gabinete do Ministro Fulano"
    // como nome do órgão, sem expor a Turma. Quando temos relator mas a turma
    // não foi extraída, usamos o mapeamento oficial Relator→Turma do TST.
    let turmaFinal = turma;
    if (!turmaFinal && relator) {
      const derivada = derivarTurmaDoRelator(relator);
      if (derivada) turmaFinal = derivada;
    }
    const situacao = extrairSituacao(rdSelecionada);

    // ---------- Reclamante / Reclamada (cruzando com a instância de origem) ----------
    // Na instância TST as partes vêm como RECORRENTE/RECORRIDO (Active/Passive), o que
    // NÃO equivale a reclamante/reclamada — quando o Banco recorre, ele é ACTIVE no TST
    // mas é RECLAMADO na origem. Para evitar a inversão, identificamos reclamante/reclamada
    // pelo person_type da instância 1 (origem). Quando não houver origem disponível,
    // usamos a heurística pelo próprio person_type da instância selecionada.
    const origemRdParties: any = rawCollector.cache_lookup
      || (rawCollector.crawler?.page_data || [])
          .map((it: any) => it?.response_data)
          .find((rd: any) => rd && rd !== rdSelecionada);
    const origemPartiesArr: any[] = Array.isArray(origemRdParties?.parties) ? origemRdParties.parties : [];
    const ativosOrigem: string[] = [];
    const passivosOrigem: string[] = [];
    const seenOr = new Set<string>();
    const collectByPersonType = (arr: any[]) => {
      for (const p of arr) {
        const pt = String(p?.person_type || "").toUpperCase();
        if (pt === "ADVOGADO") continue;
        const nome = String(p?.name || "").trim();
        if (!nome) continue;
        const doc = String(p?.main_document || "").replace(/\D/g, "");
        const k = `${doc || nome.toUpperCase()}`;
        if (seenOr.has(k)) continue;
        if (/RECLAMANTE|AUTOR|EXEQUENTE|REQUERENTE/.test(pt)) { ativosOrigem.push(nome); seenOr.add(k); }
        else if (/RECLAMAD|R[ÉE]U|EXECUTAD|REQUERID/.test(pt)) { passivosOrigem.push(nome); seenOr.add(k); }
      }
    };
    collectByPersonType(origemPartiesArr);
    // Se origem não trouxe, tenta extrair pelo person_type da própria instância selecionada
    if (ativosOrigem.length === 0 && passivosOrigem.length === 0) {
      collectByPersonType(Array.isArray(rdSelecionada?.parties) ? rdSelecionada.parties : []);
    }
    // Último fallback: usa polo ACTIVE/PASSIVE da instância selecionada
    const reclamanteFinal = ativosOrigem.length ? ativosOrigem.join(" / ") : (poloAtivo || null);
    const reclamadaFinal = passivosOrigem.length ? passivosOrigem.join(" / ") : (poloPassivo || null);

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
      turma: turmaFinal,
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
      // Reclamante/Reclamada já desambiguados — frontend deve preferir esses campos
      // ao invés de filtrar parties_detail por ACTIVE/PASSIVE.
      reclamante: reclamanteFinal,
      reclamada: reclamadaFinal,

      // Auditoria — exibida na aba Análise Judit:
      _judit_meta: {
        fonte: foiTst ? "crawler_tst" : (rdSelecionada ? "fallback_outra_instancia" : "vazio"),
        tribunal_selecionado: rdSelecionada?.tribunal_acronym || null,
        instance_selecionada: rdSelecionada?.instance || null,
        com_anexos: comAnexos,
        force_refresh: forceRefresh,
        cache_ttl_days: cacheTtlDays,
        elapsed_ms: Date.now() - t0,
      },
      attachments: comAnexos
        ? coletarAttachments(rdSelecionada, rawCollector, cnj)
        : null,
      _judit_raw: comAnexos ? rawCollector : stripAttachments(rawCollector),
    };

    console.log(`[buscar-judit] ${cnj} -> tribunal=${result.tribunal} relator=${relator} classe=${classe} situacao=${situacao}`);
    return json(result, 200);
  } catch (e) {
    console.error("[buscar-judit] erro:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}