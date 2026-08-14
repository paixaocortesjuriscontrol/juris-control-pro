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
import { createClient } from "npm:@supabase/supabase-js@2";
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
// Primeiros polls em ritmo agressivo — a Judit costuma devolver o resultado
// em 2–4s quando o processo já está no cache interno deles.
const POLL_FAST_INTERVAL_MS = 400;
const POLL_FAST_ATTEMPTS = 5;
// Crawler do TST normalmente leva 8–25s. Esperar 60s fazia o clique da
// advogada travar por mais de um minuto (e até ~124s quando havia retentativa
// TST em sequência). 25s cobre a grande maioria dos casos; o que não completar
// nesse tempo cai no melhor dado disponível (cache/fallback).
const POLL_TIMEOUT_MS = 25_000;
// Teto total por requisição — se estourar, respondemos com o que já temos em
// vez de enfileirar outra rodada de crawler.
const REQUEST_BUDGET_MS = 30_000;
// Cache padrão de 3 dias — buscas repetidas no mesmo processo voltam quase
// instantâneas. Quando precisa ignorar o cache, passar `force_refresh: true`
// no body (envia cache_ttl_in_days=0).
const CACHE_TTL_DAYS_DEFAULT = 3;

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

async function juditAppCache(cnj: string, tribunalHint: string | null = null): Promise<any | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return null;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const cutoff = new Date(Date.now() - CACHE_TTL_DAYS_DEFAULT * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("judit_logs")
      .select("raw_response, created_at")
      .eq("processo_numero", cnj)
      .eq("status", "sucesso")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      console.warn("[buscar-judit] app cache falhou:", error.message);
      return null;
    }
    for (const row of data || []) {
      const raw = (row as any)?.raw_response;
      if (!raw || raw?.error) continue;
      if (raw?._judit_meta?.com_anexos === true) continue;
      // Quando a tela pede TST, o cache local NÃO pode devolver uma resposta
      // antiga de TRT/1ª instância. Isso foi a causa de formulários que
      // pareciam “não preencher”: a função respondia rápido, mas com dados que
      // não eram da instância TST. Só aceitamos app-cache se a própria resposta
      // já foi normalizada como TST/crawler_tst.
      // Antes descartávamos qualquer resposta que não fosse TST quando a tela
      // pedia TST — isso fazia cada clique pagar 60–124s de crawler em
      // processos que só têm TRT. Agora aceitamos e marcamos a instância; a
      // busca dirigida ao TST fica no "Forçar atualização".
      const rawTribunal = String(raw?.tribunal || "").toUpperCase();
      const fonte = String(raw?._judit_meta?.fonte || "").toLowerCase();
      const ehTst = rawTribunal === "TST" || fonte === "crawler_tst";
      // Rejeita respostas anteriores que vieram sem nenhum dado útil — senão
      // o app-cache trava o processo em "tudo null" para sempre.
      const temAlgo = !!(
        raw?.relator || raw?.turma || raw?.tipo_recurso ||
        raw?.tipo_recurso_reclamante || raw?.tipo_recurso_banco ||
        raw?.reclamante || raw?.reclamada ||
        (Array.isArray(raw?.parties_detail) && raw.parties_detail.length > 0)
      );
      if (!temAlgo) continue;
      if (tribunalHint === "TST" && !ehTst) {
        raw._instancia_tst = false;
      }
      return raw;
    }
    return null;
  } catch (e) {
    console.warn("[buscar-judit] app cache erro:", (e as Error).message);
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
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
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
    await sleep(attempt <= POLL_FAST_ATTEMPTS ? POLL_FAST_INTERVAL_MS : POLL_INTERVAL_MS);
  }
  return ultima;
}

// Seleciona a instância TST entre as várias retornadas pelo crawler.
const TST_CLASSES = new Set([
  "RR", "AIRR", "ED-RR", "EDRR", "AGR-RR", "AGR", "E-RR", "ERR", "ARR", "AIRE", "ED-AIRR",
]);
function isTstRd(rd: any): boolean {
  if (!rd) return false;
  const src = String(rd?.crawler?.source_name || "").toUpperCase();
  if (/\bTST\b/.test(src)) return true;
  const court = String(rd?.courts?.[0]?.name || "").toLowerCase();
  if (/^gabinete\s+d[ao]\s+ministr[ao]\b/.test(court)) return true;
  const clsCode = String(rd?.classifications?.[0]?.code || "").toUpperCase();
  if (TST_CLASSES.has(clsCode)) return true;
  if (String(rd?.tribunal_acronym || "").toUpperCase() === "TST") return true;
  return false;
}
function selecionarTst(pageData: any[]): { rd: any; foiTst: boolean } | null {
  if (!Array.isArray(pageData) || !pageData.length) return null;
  const rds = pageData
    .map((it) => it?.response_data)
    .filter((rd) => rd && typeof rd === "object");
  if (!rds.length) return null;
  const tst = rds.find(isTstRd);
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

// Mapa de siglas comuns (espelha SIGLAS_RECURSO do front, em
// DistribuicaoTstForm.tsx). Garante que a Judit nunca devolva siglas
// abreviadas como "AIRR", "RR", "AIR" — sempre o nome por extenso, que é o
// que o MultiTipoRecurso reconhece como opção válida do dropdown.
const SIGLAS_RECURSO_FULL: Record<string, string> = {
  rr: "Recurso de Revista",
  rrag: "Recurso de Revista com Agravo",
  arr: "Recurso de Revista com Agravo",
  ararr: "Recurso de Revista com Agravo",
  airr: "Agravo de Instrumento",
  aiarr: "Agravo de Instrumento",
  air: "Agravo de Instrumento",
  e: "Embargos à SDI",
  err: "Embargos em Recurso de Revista",
  ro: "Recurso Ordinário",
  rot: "Recurso Ordinário Trabalhista",
  rotsum: "Recurso Ordinário em Procedimento Sumaríssimo",
  rops: "Recurso Ordinário em Procedimento Sumaríssimo",
  roms: "Recurso Ordinário em Mandado de Segurança",
  roar: "Recurso Ordinário em Ação Rescisória",
  ap: "Agravo de Petição",
  ed: "Embargos de Declaração",
  edcl: "Embargos de Declaração",
  ee: "Embargos em Execução",
  ei: "Embargos Infringentes",
  ag: "Agravo",
  agr: "Agravo Regimental",
  agint: "Agravo Interno",
  agi: "Agravo Interno",
  re: "Recurso Extraordinário",
  are: "Agravo em Recurso Extraordinário",
  resp: "Recurso Especial",
  aresp: "Agravo em Recurso Especial",
  ms: "Mandado de Segurança",
  hc: "Habeas Corpus",
  rcl: "Reclamação",
  radesivo: "Recurso Adesivo",
};


// `contextoTst`: no TST a sigla genérica "AI" significa Agravo de Instrumento.
// Fora do TST NÃO expandimos "AI" — a classe de 1ª/2ª instância não é um tipo
// de recurso do TST e não deve virar nome de recurso.
function expandirSiglaRecurso(
  raw: string | null | undefined,
  contextoTst = false,
): string | null {
  if (!raw) return null;
  const txt = String(raw).trim();
  if (!txt) return null;
  const siglas: Record<string, string> = contextoTst
    ? { ...SIGLAS_RECURSO_FULL, ai: "Agravo de Instrumento" }
    : SIGLAS_RECURSO_FULL;

  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  // Quebra por "+" (composições já formatadas) e por "-" (siglas compostas
  // como "ED-RR"). Só quebra por "-" quando TODOS os pedaços são siglas
  // conhecidas, para não destruir nomes legítimos com hífen.
  const partes: string[] = [];
  for (const bloco of txt.split(/\s*\+\s*/)) {
    const b = bloco.trim();
    if (!b) continue;
    const subs = b.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
    if (subs.length > 1 && subs.every((s) => siglas[norm(s)])) {
      partes.push(...subs);
    } else {
      partes.push(b);
    }
  }
  const mapped: string[] = [];
  const vistos = new Set<string>();
  for (const p of partes) {
    const alvo = norm(p);
    const nome = siglas[alvo] || p;
    const k = norm(nome);
    if (vistos.has(k)) continue;
    vistos.add(k);
    mapped.push(nome);
  }
  return mapped.length ? mapped.join(" + ") : null;
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

  // Processo ainda em triagem/Vice-Presidência do TST: o órgão é "Presidência",
  // "Vice-Presidência" ou "Gabinete da Presidência" (sem nome de ministro
  // específico). Nesses casos a Judit devolve o Presidente do TST como ocupante
  // padrão do gabinete — NÃO é o relator definitivo, então não preenchemos
  // relator nem turma para não poluir o cadastro.
  if (orgao && /presid[eê]ncia/i.test(orgao) && !/Gabinete\s+d[ao]\s+Ministr[ao]\s+/i.test(orgao)) {
    relator = null;
    turma = null;
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

// ---------- Detecção de trânsito em julgado por movimentação ---------------
// Regra homologada pelo escritório: considera trânsito quando houver step com
//   1) code CNJ 848, OU texto "Transitado em Julgado"; OU
//   2) texto "Remetidos os Autos para Tribunal Regional do Trabalho" (TST
//      devolvendo autos após julgamento final).
// Se houver step POSTERIOR de reativação (redistribuição, novo recurso,
// inclusão em pauta), o processo volta a Ativo e não marca trânsito.
// Sinais FORTES (certidão real) sempre têm prioridade. Sinais FRACOS (remessa
// de volta à instância de origem, arquivamento definitivo) só são usados quando
// nenhuma certidão existe na resposta da Judit E o processo aparece arquivado/
// baixado — casos em que o trânsito ficou registrado só na instância superior
// (ex.: TST) que a Judit não devolveu.
type MotivoTransito =
  | "movimento_848"
  | "texto_transito"
  | "remessa_trt"
  | "remessa_origem"
  | "arquivamento_definitivo";
const MOTIVOS_FORTES = new Set<MotivoTransito>(["movimento_848", "texto_transito"]);
function stepText(s: any): string {
  return [s?.title, s?.content, s?.description]
    .filter((x) => typeof x === "string")
    .join(" \n ");
}
function stepMatchTransito(s: any): MotivoTransito | null {
  // A Judit devolve o código CNJ da movimentação em `step_type` (não em `code`).
  const codigo = String(
    s?.code ?? s?.movement_code ?? s?.step_type ?? s?.type ?? ""
  ).trim();
  if (codigo === "848") return "movimento_848";
  const t = stepText(s);
  if (!t) return null;
  // Cobre "TRÂNSITO EM JULGADO", "TRANSITADO EM JULGADO", "TRANSITOU EM JULGADO"
  // e "CERTIDÃO DE TRÂNSITO EM JULGADO".
  if (/trans(?:it(?:o|ou|ad[oa]s?)|[íi]t[oa])\s+em\s+julgado/i.test(t)) return "texto_transito";
  if (/tr[âa]nsito\s+em\s+julgado/i.test(t)) return "texto_transito";
  if (/remetid[oa]s?\s+os\s+autos.*tribunal\s+regional\s+do\s+trabalho/i.test(t)) return "remessa_trt";
  // Contrapartida da remessa vinda da instância superior: o TST devolve os autos
  // ("remetidos ... órgão jurisdicional competente") e a origem os recebe
  // ("recebidos os autos para prosseguir"). Sinal fraco.
  if (/remetid[oa]s?\s+os\s+autos.*[óo]rg[ãa]o\s+jurisdicional\s+competente/i.test(t)) return "remessa_origem";
  if (/recebid[oa]s?\s+os\s+autos\s+para\s+prosseguir/i.test(t)) return "remessa_origem";
  // Arquivamento definitivo / baixa definitiva: sinal fraco de trânsito.
  if (/arquivad[oa]s?\s+os\s+autos\s+definitivamente/i.test(t)) return "arquivamento_definitivo";
  if (/arquivamento\s+definitivo/i.test(t)) return "arquivamento_definitivo";
  if (/baixa\s+definitiva/i.test(t)) return "arquivamento_definitivo";
  return null;
}

/**
 * Extrai a data escrita no próprio texto do movimento
 * (ex.: "TRANSITADO EM JULGADO EM 15.05.2026" → "2026-05-15").
 * O `step_date` costuma ser a data de captura/registro, não a data real do trânsito.
 */
function dataTransitoNoTexto(texto: string): string | null {
  const m = texto.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dia = Number(d), mes = Number(mo), ano = Number(y);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1980 || ano > 2100) return null;
  return `${y}-${mo}-${d}`;
}
function stepIsReativacao(s: any): boolean {
  const t = stepText(s);
  if (!t) return false;
  return (
    /distribu[ií]d[oa]\s+por\s+sorteio/i.test(t) ||
    /certid[ãa]o\s+de\s+\(?re\)?distribui[çc][ãa]o/i.test(t) ||
    /inclu[ií]d[oa]\s+em\s+pauta/i.test(t) ||
    /(rr|airr|arr|ed-?rr|ed-?airr|ag-?airr|recurso\s+de\s+revista|agravo\s+de\s+instrumento)/i.test(String(s?.title || "")) &&
      /(interpost|protocol|distribu)/i.test(t)
  );
}
/** O processo está arquivado/baixado em alguma das instâncias devolvidas? */
function rdsIndicamEncerramento(rds: any[]): boolean {
  return rds.some((rd) => {
    const alvo = `${rd?.status ?? ""} ${rd?.phase ?? ""}`.toUpperCase();
    return /ARQUIVAD|BAIXAD|FINALIZAD|ENCERRAD/.test(alvo);
  });
}

function detectarTransitoJulgado(rds: any[]): {
  transitado: boolean | null;
  data: string | null;
  motivo: MotivoTransito | null;
} {
  type Candidato = { ts: number; data: string | null; motivo: MotivoTransito; reativado: boolean };
  let melhorForte: Candidato | null = null;
  let melhorFraco: Candidato | null = null;
  let algumStepAnalisado = false;
  const aceitaFracos = rdsIndicamEncerramento(rds);
  for (const rd of rds) {
    const steps = Array.isArray(rd?.steps) ? rd.steps : [];
    if (!steps.length) continue;
    // Ordena cronologicamente (do mais antigo para o mais recente).
    const ordenados = steps
      .map((s: any) => ({
        s,
        ts: Date.parse(s?.step_date || s?.date || s?.movement_date || "") || 0,
      }))
      .sort((a: any, b: any) => a.ts - b.ts);
    algumStepAnalisado = true;
    // Primeira ocorrência de cada nível de sinal nesta instância.
    let idxForte = -1;
    let motivoForte: MotivoTransito | null = null;
    let idxFraco = -1;
    let motivoFraco: MotivoTransito | null = null;
    for (let i = 0; i < ordenados.length; i++) {
      const motivo = stepMatchTransito(ordenados[i].s);
      if (!motivo) continue;
      if (MOTIVOS_FORTES.has(motivo)) {
        if (idxForte < 0) { idxForte = i; motivoForte = motivo; }
      } else if (idxFraco < 0) {
        idxFraco = i; motivoFraco = motivo;
      }
      if (idxForte >= 0) break; // certidão encontrada: não precisa de sinal fraco
    }
    const houveReativacaoApos = (idx: number) => {
      for (let j = idx + 1; j < ordenados.length; j++) {
        if (stepIsReativacao(ordenados[j].s)) return true;
      }
      return false;
    };
    const montar = (idx: number, motivo: MotivoTransito): Candidato => {
      const step = ordenados[idx].s;
      const ts = ordenados[idx].ts;
      const dataIso = (() => {
        // Prioriza a data mencionada no texto da certidão.
        const noTexto = dataTransitoNoTexto(stepText(step));
        if (noTexto) return noTexto;
        const d = step?.step_date || step?.date || step?.movement_date;
        if (!d) return null;
        try {
          return new Date(d).toISOString().slice(0, 10);
        } catch {
          return null;
        }
      })();
      return { ts, data: dataIso, motivo, reativado: houveReativacaoApos(idx) };
    };
    if (idxForte >= 0 && motivoForte) {
      const c = montar(idxForte, motivoForte);
      if (!melhorForte || c.ts < melhorForte.ts) melhorForte = c;
    } else if (aceitaFracos && idxFraco >= 0 && motivoFraco) {
      const c = montar(idxFraco, motivoFraco);
      // Para sinais fracos preferimos o mais RECENTE (última remessa/arquivamento).
      if (!melhorFraco || c.ts > melhorFraco.ts) melhorFraco = c;
    }
  }
  if (!algumStepAnalisado) return { transitado: null, data: null, motivo: null };
  const melhor = melhorForte ?? melhorFraco;
  if (!melhor) return { transitado: false, data: null, motivo: null };
  if (melhor.reativado) return { transitado: false, data: null, motivo: null };
  return { transitado: true, data: melhor.data, motivo: melhor.motivo };
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
    // Quando o usuário pede "Com anexos", precisamos forçar cache_ttl_in_days=0
    // no crawler — caso contrário a Judit retorna o cache anterior (gerado sem
    // anexos) e a resposta vem com attachments=[]. Forçar TTL=0 garante uma
    // recrawl real que coleta os PDFs.
    const cacheTtlDays = forceRefresh || comAnexos ? 0 : CACHE_TTL_DAYS_DEFAULT;
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

    // 0) Cache local do app: se este processo já foi consultado com sucesso
    // recentemente, não chama a Judit de novo. Isso evita pagar 40–60s em
    // processos cujo lookup direto da Judit ainda não está aquecido.
    if (!comAnexos && !forceRefresh) {
      const appCached = await juditAppCache(cnj, tribunalHint);
      if (appCached) {
        const bodyCached: any = stripAttachments(appCached);
        bodyCached._judit_meta = {
          ...(bodyCached._judit_meta || {}),
          fonte: "app_cache_instant",
          respondido_do_cache: true,
          app_cache: true,
          instancia_tst: appCached?._instancia_tst === false
            ? false
            : (String(appCached?.tribunal || "").toUpperCase() === "TST" || undefined),
          com_anexos: false,
          force_refresh: false,
          elapsed_ms: Date.now() - t0,
        };
        bodyCached.attachments = null;
        delete bodyCached._instancia_tst;
        console.log(`[buscar-judit] app-cache instant response cnj=${cnj}`);
        return json(bodyCached, 200);
      }
    }

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

    // 2) Cache-first: se o cache já é utilizável, responde imediato e dispara
    //    o crawler em background para atualizar o cache da próxima vez.
    let rdSelecionada: any = null;
    let foiTst = false;
    let respondidoDoCache = false;

    // Cache-first: se o cache tem qualquer dado útil, devolve na hora.
    // Antes exigíamos `isTstRd(cached)` quando tribunalHint=TST — mas processos
    // que NÃO têm instância TST (ex.: 0000385-38.2024.5.23.0002, só TRT23)
    // nunca satisfaziam isso e pagavam 30-60s de crawler a cada clique. Agora
    // aceitamos o cache mesmo sem TST e disparamos refresh em background; se
    // surgir TST depois, o próximo clique já vê.
    // Cache-first SÓ quando o cache tem dados realmente úteis para preencher
    // o formulário. Antes bastava ter `parties` ou `steps`, mas isso fazia o
    // app responder instantaneamente com tudo null (ex.: 1001703-15.2023.5.02.0081,
    // cuja cache TRT2 não traz classe/relator/órgão). Agora exigimos pelo menos
    // um sinal extraível (classe OU relator OU órgão OU steps suficientes),
    // OU que seja a instância TST quando o cliente pediu TST.
    const cachedClasse = extrairClasse(cached || {});
    const cachedOrgaoRel = extrairOrgaoERelator(cached || {});
    const cachedTemSinal = !!(
      cachedClasse ||
      cachedOrgaoRel?.relator ||
      cachedOrgaoRel?.turma ||
      cachedOrgaoRel?.orgao ||
      (Array.isArray(cached?.steps) && cached.steps.length >= 5)
    );
    const cacheUsavel =
      cached &&
      !comAnexos &&
      !forceRefresh &&
      (Array.isArray(cached?.parties) && cached.parties.length > 0) &&
      // Aceita cache de qualquer instância desde que haja dado útil, inclusive
      // quando a tela pediu TST. Sem isso, todo processo que ainda só tem TRT
      // pagava 60–124s de crawler a cada clique.
      (isTstRd(cached) || cachedTemSinal);

    if (cacheUsavel) {
      rdSelecionada = cached;
      foiTst = isTstRd(cached);
      respondidoDoCache = true;
      // Removido: refresh em background disparava um POST /requests extra
      // (cobrado como consulta sem anexos) a cada cache-hit, dobrando o
      // volume cobrado. O crawler agora só roda quando o cliente pede
      // `force_refresh: true` ou não há cache utilizável.
      console.log(`[buscar-judit] cache-first instant response (foiTst=${foiTst})`);
    } else {
      // 2b) Crawler async — espera resultado
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
    }

    // 3) Se crawler não trouxe nada, usa cache como rd
    // 2c) Retentativa dirigida ao TST: quando o cliente pediu TST e nenhuma
    // página devolvida é do TST, a Judit costuma ter respondido do cache dela
    // (cached: true) apenas com as instâncias do TRT — e o trânsito em julgado
    // fica registrado só no TST. Refaz o crawler com cache_ttl_in_days=0 para
    // forçar recrawl e agrega as páginas novas ao conjunto analisado.
    let retentativaTst = false;
    let retentativaTstTrouxeTst = false;
    // Só roda no mesmo clique quando o usuário pediu atualização forçada e
    // ainda há orçamento de tempo. No fluxo normal a retentativa é dispensada
    // (o usuário pode clicar em "Forçar atualização" se precisar do TST).
    const orcamentoRestante = REQUEST_BUDGET_MS - (Date.now() - t0);
    if (tribunalHint === "TST" && forceRefresh && orcamentoRestante > 5_000) {
      const paginasAtuais: any[] = Array.isArray(rawCollector.crawler?.page_data)
        ? rawCollector.crawler.page_data
        : [];
      const jaTemTst =
        paginasAtuais.some((it: any) => isTstRd(it?.response_data)) ||
        (rawCollector.cache_lookup && isTstRd(rawCollector.cache_lookup));
      if (!jaTemTst && cacheTtlDays !== 0) {
        retentativaTst = true;
        console.log(`[buscar-judit] retentativa TST (recrawl ttl=0) cnj=${cnj}`);
        const reqIdTst = await juditCriarRequestComOpcoes(apiKey, cnj, false, 0);
        if (reqIdTst) {
          const envTst = await juditPollar(apiKey, reqIdTst);
          const pagesTst: any[] = Array.isArray(envTst?.page_data) ? envTst.page_data : [];
          if (pagesTst.length) {
            const vistos = new Set(
              paginasAtuais.map((it: any) => String(it?.response_id || "")),
            );
            const novas = pagesTst.filter(
              (it: any) => !vistos.has(String(it?.response_id || "")),
            );
            rawCollector.crawler = {
              ...(rawCollector.crawler || {}),
              request_id_retentativa_tst: reqIdTst,
              page_data: [...paginasAtuais, ...novas],
            };
            retentativaTstTrouxeTst = pagesTst.some((it: any) => isTstRd(it?.response_data));
            const selTst = selecionarTst(rawCollector.crawler.page_data);
            if (selTst?.foiTst) {
              rdSelecionada = selTst.rd;
              foiTst = true;
              respondidoDoCache = false;
            }
          }
        }
      }
    }

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
    const classeRaw = extrairClasse(rdSelecionada);
    const classe = expandirSiglaRecurso(classeRaw, foiTst);
    // Tipo de recurso só existe quando a instância selecionada é RECURSAL (TST).
    // Com apenas a 1ª instância, a classe da capa (ex.: "Ação Trabalhista",
    // "Agravo de Instrumento" de execução) NÃO é tipo de recurso do TST e não
    // pode ser aplicada nos campos de recurso.
    const classeRecursal = foiTst ? classe : null;
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

    // Detecção de trânsito em julgado por movimentações (rdSelecionada + demais
    // instâncias — em especial a TRT, que muitas vezes tem o step 848 mesmo
    // quando o TST ainda aparece "Ativo" na capa).
    const rdsParaTransito: any[] = [];
    if (rdSelecionada) rdsParaTransito.push(rdSelecionada);
    const pageDataRaw = rawCollector?.crawler?.page_data;
    if (Array.isArray(pageDataRaw)) {
      for (const it of pageDataRaw) {
        const rd = it?.response_data;
        if (rd && rd !== rdSelecionada) rdsParaTransito.push(rd);
      }
    }
    if (rawCollector?.cache_lookup && rawCollector.cache_lookup !== rdSelecionada) {
      rdsParaTransito.push(rawCollector.cache_lookup);
    }
    const transitoDet = detectarTransitoJulgado(rdsParaTransito);

    // ---------- Reclamante / Reclamada (cruzando com a instância de origem) ----------
    // Na instância TST as partes vêm como RECORRENTE/RECORRIDO (Active/Passive), o que
    // NÃO equivale a reclamante/reclamada — quando o Banco recorre, ele é ACTIVE no TST
    // mas é RECLAMADO na origem. Para evitar a inversão, identificamos reclamante/reclamada
    // pelo person_type da instância 1 (origem). Quando não houver origem disponível,
    // usamos a heurística pelo próprio person_type da instância selecionada.
    const origemRdParties: any = rawCollector.cache_lookup
      ? (Array.isArray(rawCollector.cache_lookup?.parties) && rawCollector.cache_lookup.parties.length > 0
          ? rawCollector.cache_lookup
          : null)
      : null;
    // Fallback: se cache_lookup não tem parties úteis, procura qualquer outra
    // instância no crawler.page_data (tipicamente a instância 1 / origem) que
    // tenha partes com person_type RECLAMANTE/RECLAMADO/AUTOR/RÉU.
    const origemRdFallback: any = origemRdParties
      ? null
      : (rawCollector.crawler?.page_data || [])
          .map((it: any) => it?.response_data)
          .find((rd: any) => {
            if (!rd || rd === rdSelecionada) return false;
            const arr = Array.isArray(rd?.parties) ? rd.parties : [];
            return arr.some((p: any) =>
              /RECLAMANTE|AUTOR|EXEQUENTE|REQUERENTE|RECLAMAD|R[ÉE]U|EXECUTAD|REQUERID/
                .test(String(p?.person_type || "").toUpperCase())
            );
          });
    const origemEfetiva = origemRdParties || origemRdFallback;
    const origemPartiesArr: any[] = Array.isArray(origemEfetiva?.parties) ? origemEfetiva.parties : [];
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
        // person_types da origem (1ª instância)
        if (/RECLAMANTE|AUTOR|EXEQUENTE|REQUERENTE/.test(pt)) { ativosOrigem.push(nome); seenOr.add(k); }
        else if (/RECLAMAD|R[ÉE]U|EXECUTAD|REQUERID/.test(pt)) { passivosOrigem.push(nome); seenOr.add(k); }
        // person_types de instância recursal (TST/TRT): AGRAVANTE/RECORRENTE/EMBARGANTE
        // mapeiam para o polo ATIVO da relação processual (quem recorre = autor do recurso)
        // e AGRAVADO/RECORRIDO/EMBARGADO para o passivo. Isso é o melhor que dá quando
        // não temos a 1ª instância disponível — depois o "override Santander" recoloca
        // o Banco no passivo se necessário, mas o RICARDO (passivo aqui) vira reclamante.
        else if (/AGRAVANTE|RECORRENTE|EMBARGANTE/.test(pt)) { ativosOrigem.push(nome); seenOr.add(k); }
        else if (/AGRAVAD|RECORRID|EMBARGAD/.test(pt)) { passivosOrigem.push(nome); seenOr.add(k); }
      }
    };
    collectByPersonType(origemPartiesArr);
    // Se origem não trouxe, tenta extrair pelo person_type da própria instância selecionada
    if (ativosOrigem.length === 0 && passivosOrigem.length === 0) {
      collectByPersonType(Array.isArray(rdSelecionada?.parties) ? rdSelecionada.parties : []);
    }

    // ---------- Override Santander (cliente do escritório) ----------------
    // O Banco Santander é SEMPRE reclamado. Se aparecer no polo "ativo" por
    // falta de origem, removemos dali e movemos para passivo. Isso corrige o
    // caso clássico onde o Banco recorre no TST (vira ACTIVE) e a origem não
    // está disponível para desambiguar.
    const todasPartes: any[] = Array.isArray(rdSelecionada?.parties) ? rdSelecionada.parties : [];
    const santanderNomes: string[] = [];
    for (const p of todasPartes) {
      const tipo = String(p?.person_type || "").toUpperCase();
      if (tipo === "ADVOGADO") continue;
      const nome = String(p?.name || "").trim();
      if (!nome) continue;
      if (isSantanderCnpj(p?.main_document) || isSantanderNome(nome)) {
        if (!santanderNomes.includes(nome)) santanderNomes.push(nome);
      }
    }
    const removerSantander = (lista: string[]) =>
      lista.filter((n) => !santanderNomes.some((s) => s.toUpperCase() === n.toUpperCase()));
    const ativosLimpos = removerSantander(ativosOrigem);
    const passivosComSantander = (() => {
      const base = passivosOrigem.slice();
      for (const s of santanderNomes) {
        if (!base.some((n) => n.toUpperCase() === s.toUpperCase())) base.push(s);
      }
      return base;
    })();
    const poloAtivoLimpo = removerSantander(poloAtivo ? poloAtivo.split(/,\s*/) : []).join(", ");
    const poloPassivoComSantander = (() => {
      const arr = poloPassivo ? poloPassivo.split(/,\s*/).filter(Boolean) : [];
      for (const s of santanderNomes) {
        if (!arr.some((n) => n.toUpperCase() === s.toUpperCase())) arr.push(s);
      }
      return arr.join(", ");
    })();

    // Detecta cenário ambíguo: múltiplas partes ACTIVE no TST sem origem para
    // desambiguar, OU origem ausente em geral. Marca para revisão humana.
    const tstActiveCount = todasPartes.filter((p) => {
      const pt = String(p?.person_type || "").toUpperCase();
      const side = String(p?.side || "").toUpperCase();
      return pt !== "ADVOGADO" && side === "ACTIVE";
    }).length;
    const origemAusente = origemPartiesArr.length === 0;
    const litisconsorcio = tstActiveCount > 1;
    const requerRevisaoPolo = origemAusente && (litisconsorcio || (foiTst && santanderNomes.length === 0));

    // Helper: preferir nome COMPLETO da instância selecionada quando origem trouxe
    // nome abreviado/iniciais ("R. L. S." em vez de "RICARDO DE LIMA SILVA") ou
    // ocultado ("PARTE OCULTADA NOS TERMOS DA RES. 121 DO CNJ"). Casamos pelo CPF/CNPJ.
    const nomeAbreviadoOuOculto = (n: string) => {
      if (!n) return true;
      if (/PARTE\s+OCULTADA/i.test(n)) return true;
      // "R. L. S." (iniciais com ponto): comprimento curto E só tokens de 1 letra
      const tokens = n.replace(/\./g, "").trim().split(/\s+/).filter(Boolean);
      const todosCurtos = tokens.length > 0 && tokens.every((t) => t.length <= 2);
      if (todosCurtos) return true;
      return false;
    };
    const mapDocNomeCompleto = new Map<string, string>();
    for (const p of todasPartes) {
      const tipo = String(p?.person_type || "").toUpperCase();
      if (tipo === "ADVOGADO") continue;
      const doc = String(p?.main_document || "").replace(/\D/g, "");
      const nome = String(p?.name || "").trim();
      if (doc && nome && !nomeAbreviadoOuOculto(nome)) mapDocNomeCompleto.set(doc, nome);
    }
    const completarNome = (nome: string) => {
      if (!nomeAbreviadoOuOculto(nome)) return nome;
      // procura nas origemPartiesArr o doc desse nome abreviado
      const matchOrigem = origemPartiesArr.find((p) => String(p?.name || "").trim() === nome);
      const doc = matchOrigem ? String(matchOrigem?.main_document || "").replace(/\D/g, "") : "";
      if (doc && mapDocNomeCompleto.has(doc)) return mapDocNomeCompleto.get(doc)!;
      return nome;
    };
    const completarLista = (arr: string[]) => arr.map(completarNome);
    const passivosSemSantander = removerSantander(passivosOrigem);
    const ativosLimposFull = completarLista(ativosLimpos);
    const passivosSemSantanderFull = completarLista(passivosSemSantander);
    const passivosComSantanderFull = completarLista(passivosComSantander);

    // Cenário "Banco recorre" (clássico TST): o BANCO entra como AGRAVANTE (ativo) e
    // o RECLAMANTE original (autor da ação trabalhista) fica como AGRAVADO (passivo).
    // Depois do override Santander, o Banco volta pro passivo; quem sobra em
    // passivosOrigem sem ser Santander É o reclamante original.
    let reclamanteFinal: string | null;
    let reclamadaFinal: string | null;
    if (ativosLimposFull.length === 0 && santanderNomes.length > 0 && passivosSemSantanderFull.length > 0) {
      // Banco recorrendo: passivo (não-Santander) sobe para reclamante; Santander vai pro passivo.
      reclamanteFinal = passivosSemSantanderFull.join(" / ");
      reclamadaFinal = santanderNomes.join(" / ");
    } else {
      reclamanteFinal = ativosLimposFull.length
        ? ativosLimposFull.join(" / ")
        : (poloAtivoLimpo || null);
      reclamadaFinal = passivosComSantanderFull.length
        ? passivosComSantanderFull.join(" / ")
        : (poloPassivoComSantander || null);
    }

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
    // Recorrente: SÓ usa partes com person_type RECORRENTE/AGRAVANTE/EMBARGANTE.
    // Não cai mais em fallback de `poloAtivo`, que poderia salvar strings
    // poluídas como "Ativo: FULANO / Passivo: SANTANDER" no campo dropdown.
    const recorrente = recorrentes.length ? recorrentes.join(", ") : null;

    // Tipo de recurso por parte: cruza person_type da instância TST com o
    // person_type da instância 1 (RECLAMANTE/RECLAMADO). Quem é RECORRENTE no TST
    // e RECLAMANTE na origem -> tipo_recurso_reclamante = classe.
    // Quem é RECORRENTE no TST e RECLAMADO na origem -> tipo_recurso_banco = classe.
    let tipoRecursoReclamante: string | null = null;
    let tipoRecursoBanco: string | null = null;
    let tipoRecursoTerceiro: string | null = null;
    if (classeRecursal) {
      // Mapa documento/nome -> person_type original. Preferimos uma instância
      // que tenha RECLAMANTE/RECLAMADO explícito, porque cache/crawler podem
      // devolver TST como ACTIVE/RECORRENTE para todas as partes.
      const normalizePartyName = (name: any) => String(name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]+/gi, " ")
        .trim()
        .toUpperCase();
      const allRds = [
        rawCollector.cache_lookup,
        ...((rawCollector.crawler?.page_data || []).map((it: any) => it?.response_data)),
      ].filter(Boolean);
      const hasOrigemTypes = (rd: any) => (Array.isArray(rd?.parties) ? rd.parties : [])
        .some((p: any) => /RECLAMANTE|AUTOR|EXEQUENTE|REQUERENTE|RECLAMAD|R[ÉE]U|EXECUTAD|REQUERID/.test(String(p?.person_type || "").toUpperCase()));
      const origemRd: any = allRds.find((rd: any) => rd && rd !== rdSelecionada && hasOrigemTypes(rd))
        || allRds.find((rd: any) => rd && hasOrigemTypes(rd))
        || rawCollector.cache_lookup
        || allRds.find((rd: any) => rd && rd !== rdSelecionada);
      const origemParties: any[] = Array.isArray(origemRd?.parties) ? origemRd.parties : [];
      const origemMap = new Map<string, string>(); // doc -> person_type
      const origemNameMap = new Map<string, string>(); // nome normalizado -> person_type
      for (const p of origemParties) {
        const doc = String(p?.main_document || "").replace(/\D/g, "");
        const pt = String(p?.person_type || "").toUpperCase();
        const nameKey = normalizePartyName(p?.name);
        if (doc && pt && pt !== "ADVOGADO") origemMap.set(doc, pt);
        if (nameKey && pt && pt !== "ADVOGADO") origemNameMap.set(nameKey, pt);
      }
      for (const p of partiesArr) {
        const pt = String(p?.person_type || "").toUpperCase();
        if (!/RECORRENTE|AGRAVANTE|EMBARGANTE/.test(pt)) continue;
        const doc = String(p?.main_document || "").replace(/\D/g, "");
        const origemPt = origemMap.get(doc) || origemNameMap.get(normalizePartyName(p?.name)) || "";
        // Override Santander: se o recorrente é o Banco, é sempre tipo_recurso_banco,
        // independente do que origem ou side digam.
        if (isSantanderCnpj(p?.main_document) || isSantanderNome(p?.name)) {
          tipoRecursoBanco = classeRecursal;
          continue;
        }
        if (/RECLAMANTE|AUTOR|EXEQUENTE/.test(origemPt)) tipoRecursoReclamante = classeRecursal;
        else if (/RECLAMAD|R[ÉE]U|EXECUTAD/.test(origemPt)) {
          // Recorrente é RECLAMADO na origem mas NÃO é o Banco Santander →
          // trata-se de outro reclamado (litisconsorte passivo) recorrendo.
          tipoRecursoTerceiro = classeRecursal;
        }
        else if (/MINIST[ÉE]RIO|MPT|SINDICATO|TERCEIRO|ASSISTENTE|AMICUS/.test(origemPt) ||
                 /MINIST[ÉE]RIO|MPT|SINDICATO/i.test(String(p?.name || ""))) {
          tipoRecursoTerceiro = classeRecursal;
        }
        else {
          // Sem dados de origem e não é Santander: trata como terceiro
          // (litisconsorte passivo / empresa terceirizada / outro réu).
          // No TST todas as partes recorrentes são side=ACTIVE, então
          // usar "side" como discriminador classificaria erradamente
          // qualquer recorrente como Banco. Banco só via override Santander.
          tipoRecursoTerceiro = classeRecursal;
        }
      }
      // NUNCA chutar o lado do recurso: se nenhuma parte recorrente foi
      // identificada, os três campos ficam vazios para preenchimento
      // manual/IA. Preencher "recurso do banco" por suposição gerava dados
      // errados (banco marcado como recorrente sem ter recorrido).
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
      tipo_recurso: classeRecursal,
      tipo_recurso_reclamante: tipoRecursoReclamante,
      tipo_recurso_banco: tipoRecursoBanco,
      tipo_recurso_terceiro: tipoRecursoTerceiro,
      // Campos de pauta/julgamento — não extraímos mais via heurística.
      tem_data_julgamento: "N",
      data_julgamento: null,
      horario_julgamento: null,
      tipo_julgamento: null,
      processo_baixado: situacao === "Arquivado" || situacao === "Baixado" ? "S" : "N",

      // Trânsito em julgado detectado por movimentação (Prompt homologado).
      transito_julgado_detectado: transitoDet.transitado,
      data_transito_julgado_detectada: transitoDet.data,
      motivo_transito: transitoDet.motivo,

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
        fonte: respondidoDoCache
          ? "cache_instant"
          : (foiTst ? "crawler_tst" : (rdSelecionada ? "fallback_outra_instancia" : "vazio")),
        tribunal_selecionado: rdSelecionada?.tribunal_acronym || null,
        instance_selecionada: rdSelecionada?.instance || null,
        instancia_tst: foiTst,
        com_anexos: comAnexos,
        force_refresh: forceRefresh,
        cache_ttl_days: cacheTtlDays,
        elapsed_ms: Date.now() - t0,
        respondido_do_cache: respondidoDoCache,
        santander_detectado: santanderNomes,
        origem_disponivel: !origemAusente,
        litisconsorcio_ativo_tst: litisconsorcio,
        fonte_tipo_recurso: classeRecursal
          ? "classe_instancia_tst"
          : (classe ? "classe_nao_recursal_ignorada" : "nenhuma"),
        requer_revisao_polo: requerRevisaoPolo,
        retentativa_tst: retentativaTst,
        retentativa_tst_trouxe_tst: retentativaTstTrouxeTst,
      },
      requer_revisao_polo: requerRevisaoPolo,
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