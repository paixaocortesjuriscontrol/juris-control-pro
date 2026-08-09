// supabase/functions/busca-judit-processos-e-casos/index.ts
//
// Função EXCLUSIVA da tela "Processos e Casos". Totalmente INDEPENDENTE de
// `buscar-judit` (que serve Dados Benner / Distribuição TST).
// Objetivo: consultar a API Judit (cache + crawler async) e devolver o conjunto
// MAIS COMPLETO possível de campos que o formulário "Visão Geral" do processo
// interno (src/components/processos/ProcessoVisaoGeralForm.tsx) consegue exibir,
// incluindo os ANDAMENTOS normalizados (para a aba Andamentos).
//
// Campos retornados (todos opcionais — só preenchidos quando a Judit traz dado):
//   Identificação:   assunto, classe, natureza, area, fase, status
//   Tribunal/Órgão:  tribunal, justica, instancia, esfera, sistema,
//                    orgao_julgador, vara, comarca, uf, materia
//   Partes:          polo_ativo, polo_passivo, terceiro_envolvido,
//                    reclamante, reclamados, pedidos
//   Datas:           data_distribuicao, data_recebimento, data_citacao
//   Financeiro:      valor_causa
//   Andamentos:      movimentacoes[] { data, descricao, codigo, raw }
//   Extras p/ UI:    parties_detail, advogados, attachments, _judit_raw, _judit_meta

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
const POLL_TIMEOUT_MS = 60_000;
const CACHE_TTL_DAYS_DEFAULT = 1;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cnjValido(d: string): boolean {
  if (!/^\d{20}$/.test(d)) return false;
  const rearr = `${d.slice(0,7)}${d.slice(9,13)}${d.slice(13,14)}${d.slice(14,16)}${d.slice(16,20)}${d.slice(7,9)}`;
  return BigInt(rearr) % 97n === 1n;
}
function normalizarDigitosCnj(d: string): string | null {
  if (d.length === 20) return cnjValido(d) ? d : null;
  for (let i = 0; i <= d.length - 20; i++) {
    const c = d.slice(i, i + 20);
    if (cnjValido(c)) return c;
  }
  return null;
}
function isoToBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = String(iso).substring(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}
function isoToInput(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = String(iso).substring(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

async function juditCache(apiKey: string, cnj: string): Promise<any | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${LAWSUITS_BASE}/${encodeURIComponent(cnj)}`, {
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) { await r.text(); return null; }
    const data = await r.json();
    const rd = data?.response_data || data;
    if (!rd || typeof rd !== "object") return null;
    if (!rd.steps?.length && !rd.parties?.length && !rd.courts?.length) return null;
    return rd;
  } catch { return null; }
}

async function juditCriarRequest(apiKey: string, cnj: string, cacheTtl: number, withAttachments = false): Promise<string | null> {
  const r = await fetch(REQUESTS_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      search: { search_type: "lawsuit_cnj", search_key: cnj, cache_ttl_in_days: cacheTtl },
      with_attachments: withAttachments,
    }),
  });
  if (!r.ok) { console.error(`POST /requests ${r.status}: ${await r.text()}`); return null; }
  const data = await r.json();
  return data?.request_id || null;
}

async function juditPollar(apiKey: string, requestId: string): Promise<any | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let ultima: any = null;
  let attempts429 = 0;
  let backoff = POLL_INTERVAL_MS;
  while (Date.now() < deadline) {
    try {
      const url = new URL(RESPONSES_URL);
      url.searchParams.set("request_id", requestId);
      url.searchParams.set("page_size", "50");
      const r = await fetch(url.toString(), { headers: { "api-key": apiKey } });
      if (r.status === 429) {
        if (++attempts429 >= 3) return ultima;
        await sleep(backoff); backoff = Math.min(backoff * 2, 12_000); continue;
      }
      if (!r.ok) { await r.text(); await sleep(POLL_INTERVAL_MS); continue; }
      const data = await r.json();
      ultima = data;
      if (data.request_status === "completed" || data.request_status === "cancelled") return data;
    } catch (e) { console.error("polling:", e); }
    await sleep(POLL_INTERVAL_MS);
  }
  return ultima;
}

// Seleciona a instância MAIS COMPLETA (mais steps) — para o processo interno
// queremos a fotografia mais rica possível. Não privilegiamos TST.
function selecionarMelhorInstancia(pageData: any[], cached: any): any | null {
  const rds: any[] = [];
  if (cached) rds.push(cached);
  for (const it of pageData || []) {
    if (it?.response_data) rds.push(it.response_data);
  }
  if (!rds.length) return null;
  rds.sort((a, b) => (b?.steps?.length || 0) - (a?.steps?.length || 0));
  return rds[0];
}

// ---------- Derivações --------------------------------------------------------

function justicaPorTribunal(tribAcr: string | null | undefined): string | null {
  const t = String(tribAcr || "").toUpperCase();
  if (!t) return null;
  if (t === "TST" || /^TRT\d*$/.test(t)) return "Trabalhista";
  if (t === "STJ" || t === "STF") return "Superior";
  if (/^TRF\d*$/.test(t)) return "Federal";
  if (/^TJ[A-Z]{2}$/.test(t)) return "Estadual";
  if (/^TRE[A-Z]{0,2}$/.test(t)) return "Eleitoral";
  if (t === "STM") return "Militar";
  return null;
}
function esferaPorTribunal(tribAcr: string | null | undefined): string | null {
  const t = String(tribAcr || "").toUpperCase();
  if (!t) return null;
  if (t === "TST" || /^TRT\d*$/.test(t) || t === "STJ" || t === "STF" || /^TRF\d*$/.test(t)) return "Federal";
  if (/^TJ[A-Z]{2}$/.test(t)) return "Estadual";
  return null;
}
function instanciaPorTribunal(tribAcr: string | null | undefined, orgao: string | null | undefined): string | null {
  const t = String(tribAcr || "").toUpperCase();
  if (t === "TST" || t === "STJ" || t === "STF") return "Superior";
  if (/^TRT\d*$/.test(t) || /^TRF\d*$/.test(t)) return "2ª Instância";
  const o = String(orgao || "").toLowerCase();
  if (/vara|juizado|comarca/.test(o)) return "1ª Instância";
  if (/c[âa]mara|turma|se[çc][ãa]o/.test(o)) return "2ª Instância";
  return null;
}
function areaPorJustica(j: string | null): string | null {
  if (!j) return null;
  if (j === "Trabalhista") return "Trabalhista";
  if (j === "Federal") return "Cível Federal";
  if (j === "Estadual") return "Cível";
  if (j === "Eleitoral") return "Eleitoral";
  return null;
}
function sistemaDoCrawler(rd: any): string | null {
  const src = String(rd?.crawler?.source_name || "").toUpperCase();
  if (!src) return null;
  if (src.includes("PJE")) return "PJe";
  if (src.includes("PROJUDI")) return "Projudi";
  if (src.includes("ESAJ") || src.includes("E-SAJ")) return "eSAJ";
  if (src.includes("EPROC")) return "eProc";
  if (src.includes("TUCUJURIS")) return "Tucujuris";
  if (src.includes("THEMIS")) return "Themis";
  return null;
}
function ufDoTribunal(tribAcr: string | null | undefined): string | null {
  const t = String(tribAcr || "").toUpperCase();
  const m = t.match(/^TJ([A-Z]{2})$/) || t.match(/^TRE([A-Z]{2})$/);
  if (m) return m[1];
  return null;
}

function extrairPartes(rd: any) {
  const parties: any[] = Array.isArray(rd?.parties) ? rd.parties : [];
  const ativos: string[] = [];
  const passivos: string[] = [];
  const terceiros: string[] = [];
  const advogados: any[] = [];
  const detail: any[] = [];
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
    if (isAdv) { advogados.push({ nome, oab: p?.lawyer_documents || p?.oab || null }); continue; }
    if (/RECLAMANTE|AUTOR|EXEQUENTE|REQUERENTE|RECORRENTE|AGRAVANTE|EMBARGANTE/.test(tipo) || side === "ACTIVE") ativos.push(nome);
    else if (/RECLAMAD|R[ÉE]U|EXECUTAD|REQUERID|RECORRID|AGRAVAD|EMBARGAD/.test(tipo) || side === "PASSIVE") passivos.push(nome);
    else terceiros.push(nome);
  }
  return {
    polo_ativo: ativos.join(" / "),
    polo_passivo: passivos.join(" / "),
    terceiro_envolvido: terceiros.join(" / "),
    advogados,
    parties_detail: detail,
  };
}

function extrairClasse(rd: any): string | null {
  const cls = Array.isArray(rd?.classifications) ? rd.classifications : [];
  if (cls.length && cls[0]?.name) return String(cls[0].name);
  return null;
}
function extrairAssunto(rd: any): string | null {
  const subs = Array.isArray(rd?.subjects) ? rd.subjects : [];
  if (!subs.length) return null;
  const nomes = subs.map((s: any) => String(s?.name || "").trim()).filter(Boolean);
  return nomes.length ? nomes.join(" / ") : null;
}
function extrairPedidos(rd: any): string | null {
  // A Judit não tem campo "pedidos" estruturado. Usamos os assuntos secundários
  // (subjects) como aproximação razoável para o campo Pedidos do form.
  const subs = Array.isArray(rd?.subjects) ? rd.subjects : [];
  if (subs.length <= 1) return null;
  const nomes = subs.map((s: any) => String(s?.name || "").trim()).filter(Boolean);
  return nomes.length > 1 ? nomes.join("; ") : null;
}
function extrairOrgaoComarca(rd: any): { orgao: string | null; comarca: string | null; vara: string | null } {
  const courts = Array.isArray(rd?.courts) ? rd.courts : [];
  const c0 = courts[0] || {};
  const orgao = c0?.name ? String(c0.name).trim() : null;
  const comarca = c0?.city || c0?.district || c0?.county || null;
  // Vara é tipicamente o próprio orgao_julgador; se for Câmara/Turma, devolvemos null
  let vara: string | null = null;
  if (orgao && /\bvara\b|\bju[ií]zo\b|\bjuizado\b/i.test(orgao)) vara = orgao;
  return { orgao, comarca: comarca ? String(comarca) : null, vara };
}
function extrairSituacao(rd: any): string | null {
  const s = String(rd?.status || "").toUpperCase();
  if (!s) return null;
  if (s.includes("ATIVO") || s === "ATIVA") return "ativo";
  if (s.includes("ARQUIVADO") || s.includes("FINALIZADO")) return "arquivado_definitivamente";
  if (s.includes("SUSPENSO")) return "suspenso";
  if (s.includes("BAIXADO")) return "encerrado";
  return null;
}
function extrairFase(rd: any): string | null {
  // Usa o último step relevante como pista de fase
  const steps = Array.isArray(rd?.steps) ? rd.steps : [];
  if (!steps.length) return null;
  // Os steps podem vir em ordem cronológica; pegamos o último
  const last = steps[steps.length - 1];
  const content = String(last?.content || last?.description || "").trim();
  if (!content) return null;
  // Limita a 120 chars
  return content.length > 120 ? content.slice(0, 117) + "..." : content;
}
function extrairDataCitacao(rd: any): string | null {
  const steps = Array.isArray(rd?.steps) ? rd.steps : [];
  for (const s of steps) {
    const txt = String(s?.content || s?.description || "").toLowerCase();
    if (/cita[çc][ãa]o/.test(txt)) {
      const dt = isoToInput(s?.step_date || s?.date);
      if (dt) return dt;
    }
  }
  return null;
}
function extrairDataRecebimento(rd: any): string | null {
  const steps = Array.isArray(rd?.steps) ? rd.steps : [];
  // steps mais antigos primeiro: pega o primeiro step do processo
  // (autuação / distribuição / recebimento)
  const ordered = steps.slice().sort((a: any, b: any) => {
    const da = new Date(a?.step_date || a?.date || 0).getTime();
    const db = new Date(b?.step_date || b?.date || 0).getTime();
    return da - db;
  });
  for (const s of ordered) {
    const txt = String(s?.content || s?.description || "").toLowerCase();
    if (/recebid|autuaç|autuad|registrad/.test(txt)) {
      const dt = isoToInput(s?.step_date || s?.date);
      if (dt) return dt;
    }
  }
  return null;
}

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

// ---------- Handler -----------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("JUDIT_API_KEY");
    if (!apiKey) return json({ error: "JUDIT_API_KEY não configurada" }, 500);

    const body = await req.json().catch(() => ({}));
    const numero = String(body?.numero_processo || "").trim();
    if (!numero) return json({ error: "numero_processo é obrigatório" }, 400);
    const forceRefresh = body?.force_refresh === true;
    const withAttachments = body?.with_attachments === true || body?.com_anexos === true;
    const cacheTtl = forceRefresh ? 0 : CACHE_TTL_DAYS_DEFAULT;
    const t0 = Date.now();

    const digitos = normalizarDigitosCnj(numero.replace(/\D/g, ""));
    if (!digitos) return json({ error: `CNJ inválido: ${numero}` }, 200);
    const cnj = `${digitos.slice(0,7)}-${digitos.slice(7,9)}.${digitos.slice(9,13)}.${digitos.slice(13,14)}.${digitos.slice(14,16)}.${digitos.slice(16,20)}`;
    console.log(`[judit-processo-interno] cnj=${cnj} cache_ttl=${cacheTtl}d`);

    const raw: { cache_lookup: any; crawler: any } = { cache_lookup: null, crawler: null };
    const cached = await juditCache(apiKey, cnj);
    if (cached) raw.cache_lookup = cached;

    const reqId = await juditCriarRequest(apiKey, cnj, cacheTtl, withAttachments);
    if (reqId) {
      const env = await juditPollar(apiKey, reqId);
      if (env) {
        raw.crawler = {
          request_id: reqId,
          request_status: env.request_status,
          page_data: env.page_data || [],
        };
      }
    }

    const rd = selecionarMelhorInstancia(raw.crawler?.page_data || [], cached);
    if (!rd) {
      return json({ error: "Judit não retornou dados para este processo", _judit_raw: raw }, 200);
    }

    const tribAcr = rd?.tribunal_acronym || null;
    const { polo_ativo, polo_passivo, terceiro_envolvido, advogados, parties_detail } = extrairPartes(rd);
    const classe = extrairClasse(rd);
    const assunto = extrairAssunto(rd);
    const pedidos = extrairPedidos(rd);
    const { orgao, comarca, vara } = extrairOrgaoComarca(rd);
    const status = extrairSituacao(rd);
    const fase = extrairFase(rd);
    const data_distribuicao = isoToInput(rd?.distribution_date);
    const data_recebimento = extrairDataRecebimento(rd);
    const data_citacao = extrairDataCitacao(rd);
    const valor_causa = rd?.amount != null ? Number(rd.amount) : (rd?.value != null ? Number(rd.value) : null);

    const justica = justicaPorTribunal(tribAcr);
    const esfera = esferaPorTribunal(tribAcr);
    const instancia = instanciaPorTribunal(tribAcr, orgao);
    const area = areaPorJustica(justica);
    const sistema = sistemaDoCrawler(rd);
    const uf = ufDoTribunal(tribAcr) || (rd?.courts?.[0]?.state || null);

    // Coleta anexos quando solicitado — varre TODAS as fontes (capa + steps de
    // todas as instâncias) como a buscar-judit já faz. A Judit pode devolver
    // anexos em `response_data.attachments` (capa) e/ou dentro dos `steps`.
    let attachments: any[] = [];
    if (withAttachments) {
      const fontes: any[] = [];
      if (cached) fontes.push(cached);
      for (const it of raw.crawler?.page_data || []) {
        if (it?.response_data && !fontes.includes(it.response_data)) fontes.push(it.response_data);
      }
      const seen = new Set<string>();
      const pushAtt = (a: any, instance: any, sDate: string | null) => {
        if (!a || typeof a !== "object") return;
        if (String(a?.status || "done").toLowerCase() !== "done" || a?.corrupted === true) return;
        const id = String(a?.attachment_id || a?.id || a?.step_id || "");
        if (!id) return;
        const key = `${instance ?? "?"}::${id}`;
        if (seen.has(key)) return;
        seen.add(key);
        attachments.push({
          cnj,
          instance: instance != null ? String(instance) : null,
          step_id: a?.step_id ? String(a.step_id) : null,
          attachment_id: id,
          attachment_name: a?.attachment_name || a?.name || a?.title || null,
          attachment_date: a?.attachment_date || a?.date || sDate || null,
          extension: a?.extension || a?.ext || null,
          status: a?.status || "done",
          corrupted: a?.corrupted ?? false,
          url: a?.url || a?.download_url || null,
          raw: a,
        });
      };
      for (const inst of fontes) {
        const instance = inst?.instance ?? null;
        // 1) Anexos no nível capa
        const direct = Array.isArray(inst?.attachments) ? inst.attachments : [];
        for (const a of direct) pushAtt(a, instance, null);
        // 2) Anexos dentro dos andamentos
        const steps = Array.isArray(inst?.steps) ? inst.steps : [];
        for (const s of steps) {
          const atts = Array.isArray(s?.attachments) ? s.attachments : [];
          const sDate = s?.step_date || s?.date || null;
          for (const a of atts) pushAtt({ ...a, step_id: a?.step_id || s?.step_id || s?.id }, instance, sDate);
        }
      }
      console.log(`[judit-processo-interno] anexos coletados: ${attachments.length} (with_attachments=${withAttachments})`);
    }

    const result = {
      // Identificação
      assunto,
      classe,
      natureza: classe,
      area,
      fase,
      status,
      // Tribunal / órgão
      tribunal: tribAcr,
      justica,
      instancia,
      esfera,
      sistema,
      orgao_julgador: orgao,
      vara,
      comarca,
      uf,
      materia: assunto,
      // Partes
      polo_ativo,
      polo_passivo,
      terceiro_envolvido,
      reclamante: polo_ativo,
      reclamados: polo_passivo,
      pedidos,
      // Datas
      data_distribuicao,
      data_recebimento,
      data_citacao,
      data_distribuicao_br: isoToBR(rd?.distribution_date),
      // Financeiro
      valor_causa,
      // Extras
      advogados,
      parties_detail,
      _judit_meta: {
        tribunal_selecionado: tribAcr,
        instance: rd?.instance || null,
        source_name: rd?.crawler?.source_name || null,
        elapsed_ms: Date.now() - t0,
        cache_ttl_days: cacheTtl,
      },
      _judit_raw: stripAttachments(raw),
      attachments,
    };

    console.log(`[judit-processo-interno] ${cnj} -> tribunal=${tribAcr} classe=${classe} status=${status}`);
    return json(result, 200);
  } catch (e) {
    console.error("[judit-processo-interno] erro:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}