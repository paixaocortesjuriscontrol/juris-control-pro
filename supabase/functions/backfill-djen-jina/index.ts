import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keep each call small so it returns fast and cancellation is responsive
const MAX_DAYS_PER_CALL = 1;
const MAX_MONITORAMENTOS_PER_CALL = 1;

interface Monitoramento {
  id: string;
  tipo: string;
  termo_busca: string;
  oab?: string;
  uf?: string;
  criado_por: string;
  coordenacao_id?: string;
  exclusoes?: string[];
  condicao_concomitante?: string;
  tribunais?: string[];
  descricao?: string;
}

function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function generateGlobalHash(conteudo: string, dataPublicacao: string): string {
  const normalized = (conteudo + dataPublicacao).toLowerCase().replace(/\s+/g, " ").trim();
  return generateHash(normalized);
}

function shouldExclude(conteudo: string, exclusoes: string[] | null | undefined): string | null {
  if (!exclusoes || exclusoes.length === 0) return null;
  const conteudoUpper = conteudo.toUpperCase();
  for (const termo of exclusoes) {
    if (conteudoUpper.includes(String(termo).toUpperCase())) return termo;
  }
  return null;
}

function matchesCondicaoConcomitante(conteudo: string, condicao: string | null | undefined): boolean {
  if (!condicao) return true;
  const conteudoUpper = conteudo.toUpperCase();
  const termos = condicao.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  return termos.every((t) => conteudoUpper.includes(t));
}

function getDateRange(startDate: string, endDate: string, maxDays: number): { dates: string[]; hasMore: boolean; nextStart: string | null } {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const actualEnd = end > today ? today : end;

  const current = new Date(start);
  let count = 0;

  while (current <= actualEnd && count < maxDays) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
    count++;
  }

  const hasMore = current <= actualEnd;
  const nextStart = hasMore ? current.toISOString().split("T")[0] : null;

  return { dates, hasMore, nextStart };
}

function normalizeBuscarDjenResults(result: any): any[] {
  const raw = result?.publicacoes || result?.comunicacoes || result?.items || result?.content || [];
  return Array.isArray(raw) ? raw : [];
}

function normalizeConteudo(item: any): string {
  return (item?.conteudo || item?.texto || item?.teor || item?.conteudoHtml || item?.descricao || "").toString();
}

function normalizeData(item: any, fallback: string): string {
  return (
    item?.data ||
    item?.dataDisponibilizacao ||
    item?.dataPublicacao ||
    item?.data_publicacao ||
    fallback
  ).toString();
}

function normalizeProcesso(item: any): string | null {
  return (item?.processo || item?.numeroProcesso || item?.processo_numero || null) as string | null;
}

async function processMonitoramentoForDateRange(supabase: any, mon: Monitoramento, dataInicio: string, dataFim: string) {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0, erros: 0 };

  const tipoBuscar = mon.tipo === "advogado" ? "advogado" : "palavra-chave";
  const body: any = {
    tipo: tipoBuscar,
    palavraChave: mon.tipo !== "advogado" ? mon.termo_busca : undefined,
    oab: mon.tipo === "advogado" ? mon.oab : undefined,
    uf: mon.tipo === "advogado" ? mon.uf : undefined,
    dataInicio,
    dataFim,
  };

  const { data: buscarData, error: buscarError } = await supabase.functions.invoke("buscar-djen", { body });
  if (buscarError) {
    console.error("buscar-djen invoke error:", buscarError);
    stats.erros++;
    return stats;
  }

  if (!buscarData?.success) {
    console.error("buscar-djen returned failure:", buscarData?.error);
    stats.erros++;
    return stats;
  }

  const items = normalizeBuscarDjenResults(buscarData);
  if (items.length === 0) return stats;

  // Precompute hashes and check global duplicates in bulk (chunked)
  const prepared = items
    .map((item: any) => {
      const conteudo = normalizeConteudo(item);
      if (!conteudo || conteudo.length < 20) return null;
      const dataPub = normalizeData(item, dataInicio);
      const hashConteudo = generateHash(conteudo);
      const hashGlobal = generateGlobalHash(conteudo, dataPub);
      return { item, conteudo, dataPub, hashConteudo, hashGlobal };
    })
    .filter(Boolean) as Array<{ item: any; conteudo: string; dataPub: string; hashConteudo: string; hashGlobal: string }>;

  if (prepared.length === 0) return stats;

  const existingGlobal = new Set<string>();
  const globals = prepared.map((p) => p.hashGlobal);
  const chunkSize = 200;
  for (let i = 0; i < globals.length; i += chunkSize) {
    const chunk = globals.slice(i, i + chunkSize);
    const { data: existing, error } = await supabase
      .from("publicacoes_djen_global_hash")
      .select("hash_global")
      .in("hash_global", chunk);

    if (error) {
      console.error("global hash select error:", error);
      stats.erros++;
      continue;
    }
    (existing || []).forEach((r: any) => existingGlobal.add(r.hash_global));
  }

  for (const p of prepared) {
    if (existingGlobal.has(p.hashGlobal)) {
      stats.duplicatas++;
      continue;
    }

    const processo = normalizeProcesso(p.item);
    const fonte = (p.item?.tribunal || p.item?.orgao || p.item?.fonte || "DJEN").toString();

    const excl = shouldExclude(p.conteudo, mon.exclusoes);
    if (excl) {
      const { error } = await supabase.from("publicacoes_djen_descartadas").insert({
        monitoramento_id: mon.id,
        hash_conteudo: p.hashConteudo,
        conteudo: p.conteudo,
        data_publicacao: p.dataPub,
        processo_numero: processo,
        fonte,
        motivo_descarte: `Termo excluído: ${excl}`,
      });
      if (error) stats.erros++;
      else stats.descartadas++;
      continue;
    }

    if (!matchesCondicaoConcomitante(p.conteudo, mon.condicao_concomitante)) {
      const { error } = await supabase.from("publicacoes_djen_descartadas").insert({
        monitoramento_id: mon.id,
        hash_conteudo: p.hashConteudo,
        conteudo: p.conteudo,
        data_publicacao: p.dataPub,
        processo_numero: processo,
        fonte,
        motivo_descarte: `Condição concomitante não atendida: ${mon.condicao_concomitante}`,
      });
      if (error) stats.erros++;
      else stats.descartadas++;
      continue;
    }

    const { error: insErr } = await supabase.from("publicacoes_djen").insert({
      monitoramento_id: mon.id,
      hash_conteudo: p.hashConteudo,
      conteudo: p.conteudo,
      data_publicacao: p.dataPub,
      processo_numero: processo,
      fonte,
    });

    if (insErr) {
      // Most common: unique violation
      stats.duplicatas++;
      continue;
    }

    const { error: ghErr } = await supabase.from("publicacoes_djen_global_hash").insert({
      hash_global: p.hashGlobal,
      primeiro_monitoramento_id: mon.id,
      publicacao_id: null,
    });

    if (ghErr) {
      // If global hash insert fails (already exists), count as duplicate
      stats.duplicatas++;
    } else {
      stats.novas++;
      existingGlobal.add(p.hashGlobal);
    }
  }

  return stats;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { dataInicio, dataFim, monitoramentoId, offset = 0 } = body;

    if (!dataInicio || !dataFim) throw new Error("dataInicio and dataFim are required");

    const { dates, hasMore: hasMoreDates, nextStart } = getDateRange(dataInicio, dataFim, MAX_DAYS_PER_CALL);
    const batchDataInicio = dates[0];
    const batchDataFim = dates[dates.length - 1];

    let query = supabase
      .from("monitoramentos_djen")
      .select("*")
      .eq("ativo", true)
      .range(offset, offset + MAX_MONITORAMENTOS_PER_CALL - 1);

    if (monitoramentoId) {
      query = supabase.from("monitoramentos_djen").select("*").eq("id", monitoramentoId).eq("ativo", true);
    }

    const { data: monitoramentos, error: fetchError } = await query;
    if (fetchError) throw new Error(`Error fetching monitoramentos: ${fetchError.message}`);

    if (!monitoramentos || monitoramentos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, stats: { novas: 0, descartadas: 0, duplicatas: 0, erros: 0 }, hasMoreDates: false, hasMoreMonitoramentos: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalStats = { novas: 0, descartadas: 0, duplicatas: 0, erros: 0 };

    for (const mon of monitoramentos as Monitoramento[]) {
      const s = await processMonitoramentoForDateRange(supabase, mon, batchDataInicio, batchDataFim);
      totalStats.novas += s.novas;
      totalStats.descartadas += s.descartadas;
      totalStats.duplicatas += s.duplicatas;
      totalStats.erros += s.erros;
    }

    const { count: totalCount } = await supabase
      .from("monitoramentos_djen")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true);

    const hasMoreMonitoramentos = !monitoramentoId && offset + monitoramentos.length < (totalCount || 0);

    return new Response(
      JSON.stringify({
        success: true,
        stats: totalStats,
        processedMonitoramentos: monitoramentos.length,
        totalMonitoramentos: totalCount,
        hasMoreDates,
        hasMoreMonitoramentos,
        nextOffset: hasMoreMonitoramentos ? offset + MAX_MONITORAMENTOS_PER_CALL : null,
        nextDataInicio: nextStart,
        processedDateRange: { inicio: batchDataInicio, fim: batchDataFim },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
