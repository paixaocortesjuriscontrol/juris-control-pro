import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

const TRIBUNAIS_TODOS = [
  // TJs
  'TJAC','TJAL','TJAM','TJAP','TJBA','TJCE','TJDFT','TJES','TJGO','TJMA','TJMG','TJMS','TJMT',
  'TJPA','TJPB','TJPE','TJPI','TJPR','TJRJ','TJRN','TJRO','TJRR','TJRS','TJSC','TJSE','TJSP','TJTO',
  // TRFs
  'TRF1','TRF2','TRF3','TRF4','TRF5','TRF6',
  // Superiores
  'STJ','STF',
  // Trabalhistas
  'TST','TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9','TRT10','TRT11','TRT12',
  'TRT13','TRT14','TRT15','TRT16','TRT17','TRT18','TRT19','TRT20','TRT21','TRT22','TRT23','TRT24',
];

const TODOS_IDS_CIVEIS = TRIBUNAIS_TODOS.filter(t => t.startsWith('TJ'));
const TODOS_IDS_TRABALHISTAS = TRIBUNAIS_TODOS.filter(t => t.startsWith('TRT') || t === 'TST');

function expandirTribunais(tribunais: string[]): string[] {
  const expandidos = new Set<string>();
  for (const t of tribunais) {
    if (t === 'TODOS_CIVEIS') {
      TODOS_IDS_CIVEIS.forEach(id => expandidos.add(id));
    } else if (t === 'TODOS_TRT') {
      TODOS_IDS_TRABALHISTAS.forEach(id => expandidos.add(id));
    } else if (t) {
      expandidos.add(t);
    }
  }
  return Array.from(expandidos);
}

const browserHeaders = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://comunica.pje.jus.br",
  "Referer": "https://comunica.pje.jus.br/",
};

function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function generateGlobalHash(conteudo: string, dataDisponibilizacao: string): string {
  const normalized = (conteudo + dataDisponibilizacao).toLowerCase().replace(/\s+/g, ' ').trim();
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
    await new Promise((r) => setTimeout(r, globalCooldownUntil - now));
  }
}

async function fetchJsonWithRetry(url: string, timeoutMs = 15000, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await waitGlobalCooldown();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers: browserHeaders, signal: controller.signal });
    clearTimeout(timeout);

    const contentType = res.headers.get('content-type') || '';
    if (res.status === 429) {
      const retryAfter = parseRetryAfterMs(res.headers.get('retry-after'));
      const waitMs = retryAfter ?? (5000 * attempt);
      globalCooldownUntil = Date.now() + waitMs;
      if (attempt < maxRetries) continue;
      throw new Error(`HTTP 429 (rate limit)`);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    if (contentType.includes('text/html')) {
      const preview = await res.text().catch(() => '');
      throw new Error(`HTML_BLOCKED: ${preview.slice(0, 80)}`);
    }

    return await res.json();
  }

  throw new Error('fetch_failed');
}

function createCancelChecker(supabase: any, diarioYmd: string, throttleMs = 1000) {
  let lastCheck = 0;
  let cached = false;
  return async () => {
    if (cached) return true;
    const now = Date.now();
    if (now - lastCheck < throttleMs) return cached;
    lastCheck = now;
    const { data } = await supabase
      .from("djen_diario_index")
      .select("cancelado")
      .eq("diario_ymd", diarioYmd)
      .maybeSingle();
    cached = data?.cancelado === true;
    return cached;
  };
}

async function upsertTribunalStatus(
  supabase: any,
  diarioYmd: string,
  tribunal: string,
  status: string,
  paginasProcessadas: number,
  maxPages: number,
  erroMensagem?: string | null
) {
  await supabase
    .from("djen_diario_index_tribunais")
    .upsert({
      diario_ymd: diarioYmd,
      tribunal,
      status,
      paginas_processadas: paginasProcessadas,
      max_pages: maxPages,
      erro_mensagem: erroMensagem || null,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "diario_ymd,tribunal" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const dataYmd = (body?.dataYmd as string | undefined) || new Date().toISOString().slice(0, 10);
    let tribunais = (body?.tribunais as string[] | undefined) || null;
    const maxPages = Number.isFinite(body?.maxPages) ? Math.max(1, Number(body.maxPages)) : 200;
    const concurrentTribunais = Number.isFinite(body?.concurrentTribunais)
      ? Math.max(1, Math.min(5, Number(body.concurrentTribunais)))
      : 1;
    const pageDelayMs = Number.isFinite(body?.pageDelayMs) ? Math.max(0, Number(body.pageDelayMs)) : 400;
    const force = body?.force === true;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!force) {
      const { data: existing } = await supabase
        .from("djen_diario_index")
        .select("status")
        .eq("diario_ymd", dataYmd)
        .maybeSingle();
      if (existing?.status === 'concluido') {
        return new Response(
          JSON.stringify({ success: true, status: 'ja_indexado' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (force) {
      await supabase
        .from("djen_diario_index_tribunais")
        .delete()
        .eq("diario_ymd", dataYmd);
      await supabase
        .from("djen_diario_index")
        .upsert({
          diario_ymd: dataYmd,
          status: "pendente",
          cancelado: false,
          erro_mensagem: null,
          total_publicacoes: 0,
          total_tribunais: 0,
          tribunais_processados: 0,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: "diario_ymd" });
    }

    if (!tribunais) {
      const { data: mons } = await supabase
        .from("monitoramentos_djen")
        .select("tribunais")
        .eq("ativo", true);
      const base: string[] = [];
      (mons || []).forEach((m: any) => {
        const ts = Array.isArray(m?.tribunais) ? m.tribunais : [];
        base.push(...ts);
      });
      tribunais = base.length > 0 ? expandirTribunais(base) : TRIBUNAIS_TODOS;
    }
    tribunais = tribunais.length > 0 ? tribunais : TRIBUNAIS_TODOS;

    await supabase
      .from("djen_diario_index")
      .upsert({
        diario_ymd: dataYmd,
        status: "em_andamento",
        cancelado: false,
        total_tribunais: tribunais.length,
        tribunais_processados: 0,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "diario_ymd" });

    let totalInseridas = 0;

    let tribunaisProcessados = 0;
    const tribunaisComErro: string[] = [];
    const shouldCancel = createCancelChecker(supabase, dataYmd);

    const processTribunal = async (tribunal: string) => {
      if (await shouldCancel()) return;
      await upsertTribunalStatus(supabase, dataYmd, tribunal, "em_andamento", 0, maxPages);
      try {
        let page = 0;
        while (page < maxPages) {
          if (await shouldCancel()) break;
          const queryParams = new URLSearchParams();
          queryParams.set('siglaTribunal', tribunal);
          queryParams.set('dataDisponibilizacaoInicio', dataYmd);
          queryParams.set('dataDisponibilizacaoFim', dataYmd);
          queryParams.set('pagina', page.toString());
          queryParams.set('itensPorPagina', '100');

          const url = `${PJE_COMUNICA_API}/comunicacao?${queryParams.toString()}`;
          if (await shouldCancel()) break;
          const data: any = await fetchJsonWithRetry(url);
          if (await shouldCancel()) break;

          const items = data?.comunicacoes || data?.items || data || [];
          if (!Array.isArray(items) || items.length === 0) break;

          const batch = items.map((pub: any) => {
            const pubObj = pub.comunicacao || pub;
            const conteudo = pub.conteudo || pub.texto || pub.teor || pub.descricao || JSON.stringify(pub);
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

          const { error } = await supabase
            .from("djen_diario_publicacoes")
            .upsert(batch, { onConflict: "hash_global", ignoreDuplicates: true });
          if (error) throw error;

          totalInseridas += batch.length;
          await upsertTribunalStatus(supabase, dataYmd, tribunal, "em_andamento", page + 1, maxPages);
          const cancelNow = await shouldCancel();
          await supabase
            .from("djen_diario_index")
            .upsert({
              diario_ymd: dataYmd,
              status: cancelNow ? "cancelado" : "em_andamento",
              total_publicacoes: totalInseridas,
              total_tribunais: tribunais.length,
              tribunais_processados: tribunaisProcessados,
              atualizado_em: new Date().toISOString(),
              erro_mensagem: cancelNow ? "Cancelado pelo usuário" : null,
            }, { onConflict: "diario_ymd" });
          if (cancelNow) break;
          page++;
          if (pageDelayMs > 0) {
            await new Promise((r) => setTimeout(r, pageDelayMs));
          }
        }
        if (await shouldCancel()) {
          await upsertTribunalStatus(supabase, dataYmd, tribunal, "cancelado", page, maxPages, "Cancelado pelo usuário");
        } else {
          await upsertTribunalStatus(supabase, dataYmd, tribunal, "concluido", page, maxPages);
        }
      } catch (e: any) {
        tribunaisComErro.push(`${tribunal}:${e?.message || 'erro'}`);
        await upsertTribunalStatus(supabase, dataYmd, tribunal, "erro", 0, maxPages, e?.message || 'erro');
      } finally {
        tribunaisProcessados += 1;
        const cancelNow = await shouldCancel();
        await supabase
          .from("djen_diario_index")
          .upsert({
            diario_ymd: dataYmd,
            status: cancelNow ? "cancelado" : "em_andamento",
            total_publicacoes: totalInseridas,
            total_tribunais: tribunais.length,
            tribunais_processados: tribunaisProcessados,
            atualizado_em: new Date().toISOString(),
            erro_mensagem: cancelNow ? "Cancelado pelo usuário" : null,
          }, { onConflict: "diario_ymd" });
      }
    };

    for (let i = 0; i < tribunais.length; i += concurrentTribunais) {
      if (await shouldCancel()) break;
      const chunk = tribunais.slice(i, i + concurrentTribunais);
      await Promise.all(chunk.map(processTribunal));
    }

    const foiCancelado = await shouldCancel();
    const erroMsgBase = tribunaisComErro.length > 0
      ? `Tribunais com erro: ${tribunaisComErro.slice(0, 15).join(', ')}${tribunaisComErro.length > 15 ? '...' : ''}`
      : null;
    const nenhumTribunal = tribunais.length === 0;
    const nadaProcessado = tribunaisProcessados === 0;
    const todosErro = tribunais.length > 0 && tribunaisComErro.length === tribunais.length;
    const nenhumResultado = totalInseridas === 0 && (todosErro || nadaProcessado);
    const statusFinal = foiCancelado
      ? "cancelado"
      : (nenhumTribunal || nenhumResultado)
        ? "erro"
        : "concluido";
    const erroMsg = foiCancelado
      ? "Cancelado pelo usuário"
      : nenhumTribunal
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
        atualizado_em: new Date().toISOString(),
        erro_mensagem: erroMsg,
      }, { onConflict: "diario_ymd" });

    return new Response(
      JSON.stringify({ success: true, total: totalInseridas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
