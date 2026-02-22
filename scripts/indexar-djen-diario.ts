import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

const TRIBUNAIS_TODOS = [
  "TJAC","TJAL","TJAM","TJAP","TJBA","TJCE","TJDFT","TJES","TJGO","TJMA","TJMG","TJMS","TJMT",
  "TJPA","TJPB","TJPE","TJPI","TJPR","TJRJ","TJRN","TJRO","TJRR","TJRS","TJSC","TJSE","TJSP","TJTO",
  "TRF1","TRF2","TRF3","TRF4","TRF5","TRF6",
  "STJ","STF",
  "TST","TRT1","TRT2","TRT3","TRT4","TRT5","TRT6","TRT7","TRT8","TRT9","TRT10","TRT11","TRT12",
  "TRT13","TRT14","TRT15","TRT16","TRT17","TRT18","TRT19","TRT20","TRT21","TRT22","TRT23","TRT24",
];

const TODOS_IDS_CIVEIS = TRIBUNAIS_TODOS.filter((t) => t.startsWith("TJ"));
const TODOS_IDS_TRABALHISTAS = TRIBUNAIS_TODOS.filter((t) => t.startsWith("TRT") || t === "TST");

function expandirTribunais(tribunais: string[]): string[] {
  const expandidos = new Set<string>();
  for (const t of tribunais) {
    if (t === "TODOS_CIVEIS") {
      TODOS_IDS_CIVEIS.forEach((id) => expandidos.add(id));
    } else if (t === "TODOS_TRT") {
      TODOS_IDS_TRABALHISTAS.forEach((id) => expandidos.add(id));
    } else if (t) {
      expandidos.add(t);
    }
  }
  return Array.from(expandidos);
}

const browserHeaders = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://comunica.pje.jus.br",
  Referer: "https://comunica.pje.jus.br/",
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function generateGlobalHash(conteudo: string, dataDisponibilizacao: string): string {
  const normalized = (conteudo + dataDisponibilizacao).toLowerCase().replace(/\s+/g, " ").trim();
  return generateHash(normalized);
}

let globalCooldownUntil = 0;

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

async function waitGlobalCooldown() {
  const now = Date.now();
  if (globalCooldownUntil > now) {
    await delay(globalCooldownUntil - now);
  }
}

async function fetchJsonWithRetry(url: string, timeoutMs = 15000, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await waitGlobalCooldown();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers: browserHeaders, signal: controller.signal });
    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") || "";
    if (res.status === 429) {
      const retryAfter = parseRetryAfterMs(res.headers.get("retry-after"));
      const waitMs = retryAfter ?? (5000 * attempt);
      globalCooldownUntil = Date.now() + waitMs;
      if (attempt < maxRetries) continue;
      throw new Error("HTTP 429 (rate limit)");
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    if (contentType.includes("text/html")) {
      const preview = await res.text().catch(() => "");
      throw new Error(`HTML_BLOCKED: ${preview.slice(0, 80)}`);
    }

    return await res.json();
  }

  throw new Error("fetch_failed");
}

type IndexParams = {
  maxPages: number;
  itemsPerPage: number;
  insertBatchSize: number;
  insertDelayMs: number;
  pageDelayMs: number;
  tribunalDelayMs: number;
  retryCount: number;
  retryDelayMs: number;
};

const defaultParams: IndexParams = {
  maxPages: 200,
  itemsPerPage: 10,
  insertBatchSize: 3,
  insertDelayMs: 300,
  pageDelayMs: 800,
  tribunalDelayMs: 300,
  retryCount: 4,
  retryDelayMs: 8000,
};

const stjOverrides = {
  itemsPerPage: 5,
  insertBatchSize: 2,
  insertDelayMs: 600,
  pageDelayMs: 1500,
};

async function updateRequest(id: string, data: Record<string, any>) {
  const { error } = await supabase
    .from("djen_diario_index_requests")
    .update(data)
    .eq("id", id);
  if (error) throw error;
}

async function getTribunais(): Promise<string[]> {
  const { data: mons } = await supabase
    .from("monitoramentos_djen")
    .select("tribunais")
    .eq("ativo", true);
  const base: string[] = [];
  (mons || []).forEach((m: any) => {
    const ts = Array.isArray(m?.tribunais) ? m.tribunais : [];
    base.push(...ts);
  });
  const tribunais = base.length > 0 ? expandirTribunais(base) : TRIBUNAIS_TODOS;
  return tribunais.length > 0 ? tribunais : TRIBUNAIS_TODOS;
}

async function runIndexacao(dataYmd: string, params: IndexParams) {
  const tribunais = (await getTribunais()).map((t) => t.toUpperCase());
  const { data: indexRow } = await supabase
    .from("djen_diario_index")
    .select("started_at")
    .eq("diario_ymd", dataYmd)
    .maybeSingle();
  const startedAt = indexRow?.started_at || new Date().toISOString();

  await supabase
    .from("djen_diario_index")
    .upsert({
      diario_ymd: dataYmd,
      status: "em_andamento",
      cancelado: false,
      total_tribunais: tribunais.length,
      tribunais_processados: 0,
      started_at: startedAt,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "diario_ymd" });

  let totalInseridas = 0;
  let tribunaisProcessados = 0;
  const tribunaisComErro: string[] = [];

  const processTribunalPage = async (
    tribunal: string,
    page: number
  ): Promise<{ done: boolean; nextPage: number; inserted: number; emptyFirstPage: boolean }> => {
    const isStj = tribunal === "STJ";
    const effectiveItemsPerPage = isStj ? stjOverrides.itemsPerPage : params.itemsPerPage;
    const effectiveInsertBatchSize = isStj ? stjOverrides.insertBatchSize : params.insertBatchSize;
    const effectiveInsertDelayMs = isStj ? stjOverrides.insertDelayMs : params.insertDelayMs;
    const effectivePageDelayMs = isStj ? stjOverrides.pageDelayMs : params.pageDelayMs;

    const queryParams = new URLSearchParams();
    queryParams.set("siglaTribunal", tribunal);
    queryParams.set("dataDisponibilizacaoInicio", dataYmd);
    queryParams.set("dataDisponibilizacaoFim", dataYmd);
    queryParams.set("pagina", page.toString());
    queryParams.set("itensPorPagina", String(effectiveItemsPerPage));

    const url = `${PJE_COMUNICA_API}/comunicacao?${queryParams.toString()}`;
    console.log(`[DJEN Index] ${tribunal} page ${page} fetching...`);
    const data: any = await fetchJsonWithRetry(url);
    const items = data?.comunicacoes || data?.items || data || [];
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`[DJEN Index] ${tribunal} page ${page} empty`);
      return { done: true, nextPage: page, inserted: 0, emptyFirstPage: page === 0 };
    }

    const batch = items.map((pub: any) => {
      const pubObj = pub.comunicacao || pub;
      const conteudo = pubObj.conteudo || pubObj.texto || pubObj.teor || pub.conteudo || pub.texto || pub.teor || pub.descricao || JSON.stringify(pub);
      const dataDisponibilizacao =
        pub.dataDisponibilizacao || pubObj.dataDisponibilizacao ||
        pub.dataDJe || pubObj.dataDJe ||
        pub.dtDisponibilizacao || pubObj.dtDisponibilizacao ||
        pub.dataDisp || pubObj.dataDisp ||
        dataYmd;
      const dataPublicacao =
        pub.dataPublicacao || pubObj.dataPublicacao ||
        pub.dataJornal || pubObj.dataJornal ||
        pub.dtPublicacao || pubObj.dtPublicacao ||
        pub.data || pubObj.data ||
        null;
      const processoNumero = pub.numeroProcesso || pub.processo || null;

      return {
        diario_ymd: dataYmd,
        tribunal,
        data_disponibilizacao: dataDisponibilizacao,
        data_publicacao: dataPublicacao,
        processo_numero: processoNumero,
        conteudo,
        hash_global: generateGlobalHash(conteudo, dataDisponibilizacao),
        raw_json: pub,
      };
    });

    let inserted = 0;
    for (let i = 0; i < batch.length; i += effectiveInsertBatchSize) {
      const slice = batch.slice(i, i + effectiveInsertBatchSize);
      const { error } = await supabase
        .from("djen_diario_publicacoes")
        .upsert(slice, { onConflict: "hash_global", ignoreDuplicates: true });
      if (error) throw error;
      inserted += slice.length;
      if (effectiveInsertDelayMs > 0) {
        await delay(effectiveInsertDelayMs);
      }
    }

    if (effectivePageDelayMs > 0) {
      await delay(effectivePageDelayMs);
    }

    console.log(`[DJEN Index] ${tribunal} page ${page} ok (inserted=${inserted})`);
    return { done: false, nextPage: page + 1, inserted, emptyFirstPage: false };
  };

  const estados = tribunais.map((tribunal) => ({
    tribunal,
    page: 0,
    done: false,
    finalized: false,
    retryAttempts: 0,
    retryAt: 0,
  }));

  while (estados.some((t) => !t.done)) {
    for (const state of estados) {
      if (state.done) continue;
      const nowMs = Date.now();
      if (state.retryAt && state.retryAt > nowMs) continue;

      const tribunalUpper = state.tribunal.toUpperCase();
      await supabase
        .from("djen_diario_index_tribunais")
        .upsert({
          diario_ymd: dataYmd,
          tribunal: tribunalUpper,
          status: "em_andamento",
          paginas_processadas: state.page,
          max_pages: null,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: "diario_ymd,tribunal" });

      try {
        const result = await processTribunalPage(tribunalUpper, state.page);
        totalInseridas += result.inserted;
        state.page = result.nextPage;
        state.retryAttempts = 0;
        state.retryAt = 0;
        if (result.done || state.page >= params.maxPages) {
          await supabase
            .from("djen_diario_index_tribunais")
            .upsert({
              diario_ymd: dataYmd,
              tribunal: tribunalUpper,
              status: "concluido",
              paginas_processadas: state.page,
              max_pages: result.emptyFirstPage ? 0 : null,
              atualizado_em: new Date().toISOString(),
            }, { onConflict: "diario_ymd,tribunal" });
          state.done = true;
          state.finalized = true;
          tribunaisProcessados += 1;
        } else {
          await supabase
            .from("djen_diario_index_tribunais")
            .upsert({
              diario_ymd: dataYmd,
              tribunal: tribunalUpper,
              status: "em_andamento",
              paginas_processadas: state.page,
              max_pages: null,
              atualizado_em: new Date().toISOString(),
            }, { onConflict: "diario_ymd,tribunal" });
        }
      } catch (e: any) {
        state.retryAttempts += 1;
        const msg = `${e?.message || "erro"} (tentativa ${state.retryAttempts}/${params.retryCount + 1})`;
        await supabase
          .from("djen_diario_index_tribunais")
          .upsert({
            diario_ymd: dataYmd,
            tribunal: tribunalUpper,
            status: "erro",
            paginas_processadas: state.page,
            max_pages: null,
            erro_mensagem: msg,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: "diario_ymd,tribunal" });

        if (state.retryAttempts > params.retryCount) {
          tribunaisComErro.push(`${tribunalUpper}:${e?.message || "erro"}`);
          state.done = true;
          state.finalized = true;
          tribunaisProcessados += 1;
        } else {
          state.retryAt = Date.now() + params.retryDelayMs * state.retryAttempts;
        }
      }

      await supabase
        .from("djen_diario_index")
        .upsert({
          diario_ymd: dataYmd,
          status: "em_andamento",
          total_publicacoes: totalInseridas,
          total_tribunais: tribunais.length,
          tribunais_processados: tribunaisProcessados,
          started_at: startedAt,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: "diario_ymd" });

      if (params.tribunalDelayMs > 0) {
        await delay(params.tribunalDelayMs);
      }
    }
  }

  const erroMsgBase = tribunaisComErro.length > 0
    ? `Tribunais com erro: ${tribunaisComErro.slice(0, 15).join(", ")}${tribunaisComErro.length > 15 ? "..." : ""}`
    : null;
  const nenhumTribunal = tribunais.length === 0;
  const nadaProcessado = tribunaisProcessados === 0;
  const todosErro = tribunais.length > 0 && tribunaisComErro.length === tribunais.length;
  const nenhumResultado = totalInseridas === 0 && (todosErro || nadaProcessado);
  const statusFinal = (nenhumTribunal || nenhumResultado) ? "erro" : "concluido";
  const erroMsg = nenhumTribunal
    ? "Nenhum tribunal configurado para indexação"
    : nenhumResultado
      ? "Indexação terminou sem processar tribunais válidos"
      : erroMsgBase;

  await supabase
    .from("djen_diario_index")
    .upsert({
      diario_ymd: dataYmd,
      status: statusFinal,
      total_publicacoes: totalInseridas,
      total_tribunais: tribunais.length,
      tribunais_processados: tribunais.length,
      started_at: startedAt,
      atualizado_em: new Date().toISOString(),
      erro_mensagem: erroMsg,
    }, { onConflict: "diario_ymd" });

  return { success: true, total: totalInseridas };
}

async function processNextRequest() {
  const { data, error } = await supabase
    .from("djen_diario_index_requests")
    .select("id, data_ymd, status")
    .eq("status", "pendente")
    .order("requested_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[DJEN Index] Error fetching request:", error.message);
    return false;
  }
  if (!data) return false;

  console.log(`[DJEN Index] Starting request ${data.id} for ${data.data_ymd}`);
  await updateRequest(data.id, {
    status: "em_andamento",
    started_at: new Date().toISOString(),
  });

  try {
    await runIndexacao(data.data_ymd, defaultParams);
    await updateRequest(data.id, {
      status: "concluido",
      finished_at: new Date().toISOString(),
      erro_mensagem: null,
    });
    console.log(`[DJEN Index] Completed request ${data.id}`);
  } catch (e: any) {
    await updateRequest(data.id, {
      status: "erro",
      finished_at: new Date().toISOString(),
      erro_mensagem: e?.message || "erro",
    });
    console.error(`[DJEN Index] Failed request ${data.id}:`, e?.message || e);
  }

  return true;
}

async function main() {
  const intervalMs = Number(process.env.DJEN_INDEX_POLL_INTERVAL_MS || 5000);
  console.log(`[DJEN Index] Worker started. Poll interval ${intervalMs}ms`);
  let idleCycles = 0;
  while (true) {
    const processed = await processNextRequest();
    if (!processed) {
      idleCycles += 1;
      if (idleCycles % 12 === 0) {
        console.log("[DJEN Index] Waiting for requests...");
      }
      await delay(intervalMs);
    } else {
      idleCycles = 0;
    }
  }
}

main().catch((e) => {
  console.error("[DJEN Index] Worker fatal error:", e);
  process.exit(1);
});
