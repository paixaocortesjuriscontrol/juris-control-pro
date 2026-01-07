import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

// Limit to prevent timeout
const MAX_DAYS_PER_CALL = 7;
const MAX_MONITORAMENTOS_PER_CALL = 5;

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

const browserHeaders = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://comunica.pje.jus.br",
  "Referer": "https://comunica.pje.jus.br/",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3,
  baseDelay = 3000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add random delay to appear more human-like
      await delay(Math.random() * 1000 + 500);
      
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limited. Waiting ${waitTime}ms (retry ${attempt + 1})`);
        await delay(waitTime);
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const waitTime = baseDelay * Math.pow(2, attempt);
      console.log(`Fetch error, waiting ${waitTime}ms:`, error);
      await delay(waitTime);
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function generateGlobalHash(conteudo: string, dataPublicacao: string): string {
  const normalized = (conteudo + dataPublicacao).toLowerCase().replace(/\s+/g, ' ').trim();
  return generateHash(normalized);
}

function shouldExclude(conteudo: string, exclusoes: string[]): string | null {
  if (!exclusoes || exclusoes.length === 0) return null;
  
  const conteudoUpper = conteudo.toUpperCase();
  for (const termo of exclusoes) {
    if (conteudoUpper.includes(termo.toUpperCase())) {
      return termo;
    }
  }
  return null;
}

function matchesCondicaoConcomitante(conteudo: string, condicao: string | undefined): boolean {
  if (!condicao) return true;
  
  const conteudoUpper = conteudo.toUpperCase();
  const termos = condicao.split(',').map(t => t.trim().toUpperCase());
  
  return termos.every(termo => conteudoUpper.includes(termo));
}

// Get dates between start and end (limited)
function getDateRange(startDate: string, endDate: string, maxDays: number): { dates: string[], hasMore: boolean, nextStart: string | null } {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  const actualEnd = end > today ? today : end;
  
  const current = new Date(start);
  let count = 0;
  
  while (current <= actualEnd && count < maxDays) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
    count++;
  }
  
  const hasMore = current <= actualEnd;
  const nextStart = hasMore ? current.toISOString().split('T')[0] : null;
  
  return { dates, hasMore, nextStart };
}

async function fetchDJENResultsForDateRange(searchText: string, dataInicio: string, dataFim: string): Promise<any[]> {
  const queryParams = new URLSearchParams();
  queryParams.append("texto", searchText);
  queryParams.append("dataDisponibilizacaoInicio", dataInicio);
  queryParams.append("dataDisponibilizacaoFim", dataFim);
  
  const endpoints = [
    `${PJE_COMUNICA_API}/comunicacao`,
    `${PJE_COMUNICA_API}/comunicacao/consulta`,
  ];
  
  console.log(`Fetching: "${searchText}" from ${dataInicio} to ${dataFim}`);
  
  for (const endpoint of endpoints) {
    const fullUrl = `${endpoint}?${queryParams.toString()}`;
    
    try {
      const response = await fetchWithRetry(fullUrl, {
        method: "GET",
        headers: browserHeaders,
      });

      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("text/html")) {
        console.log(`HTML response from ${endpoint}, trying next...`);
        continue;
      }

      if (response.ok) {
        const data = await response.json();
        const items = data.items || data.content || data.comunicacoes || data.publicacoes || [];
        console.log(`Got ${items.length} items`);
        return Array.isArray(items) ? items : [];
      }

      if (response.status === 422 || response.status === 404) {
        console.log(`No results (${response.status})`);
        return [];
      }
      
      console.log(`Error ${response.status} from ${endpoint}`);
    } catch (error) {
      console.error(`Error on ${endpoint}:`, error);
    }
    
    await delay(1000);
  }

  return [];
}

async function processMonitoramentoForDateRange(
  supabase: any,
  monitoramento: Monitoramento,
  dataInicio: string,
  dataFim: string
): Promise<{ novas: number; descartadas: number; duplicatas: number }> {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  
  let searchTerm = monitoramento.termo_busca;
  
  if (monitoramento.tipo === "processo") {
    searchTerm = monitoramento.termo_busca.replace(/\D/g, '');
  }
  
  const publications = await fetchDJENResultsForDateRange(searchTerm, dataInicio, dataFim);
  
  for (const pub of publications) {
    const conteudo = pub.conteudo || pub.texto || pub.teor || pub.descricao || JSON.stringify(pub);
    const dataPublicacao = pub.dataPublicacao || pub.dataDisponibilizacao || pub.dataDJe || pub.dataJornal || pub.data || dataInicio;
    const hashConteudo = generateHash(conteudo + dataPublicacao);
    const globalHash = generateGlobalHash(conteudo, dataPublicacao);

    // Check global deduplication
    const { data: existingGlobal } = await supabase
      .from('publicacoes_djen_global_hash')
      .select('id')
      .eq('hash_global', globalHash)
      .maybeSingle();

    if (existingGlobal) {
      stats.duplicatas++;
      continue;
    }

    // Check concomitant condition
    if (!matchesCondicaoConcomitante(conteudo, monitoramento.condicao_concomitante)) {
      continue;
    }

    // Check exclusion criteria
    const motivoExclusao = shouldExclude(conteudo, monitoramento.exclusoes || []);
    
    if (motivoExclusao) {
      await supabase.from('publicacoes_djen_descartadas').insert({
        monitoramento_id: monitoramento.id,
        hash_conteudo: hashConteudo,
        data_publicacao: dataPublicacao,
        processo_numero: pub.numeroProcesso || pub.processo || null,
        conteudo: conteudo,
        fonte: pub.fonte || pub.orgao || pub.tribunal || 'DJEN',
        motivo_descarte: `Termo de exclusão: ${motivoExclusao}`,
      });

      await supabase.from('publicacoes_djen_global_hash').upsert({
        hash_global: globalHash,
        primeiro_monitoramento_id: monitoramento.id,
      }, { onConflict: 'hash_global', ignoreDuplicates: true });
      
      stats.descartadas++;
      continue;
    }

    // Insert valid publication
    const { data: insertedPub, error: insertError } = await supabase
      .from('publicacoes_djen')
      .insert({
        monitoramento_id: monitoramento.id,
        hash_conteudo: hashConteudo,
        data_publicacao: dataPublicacao,
        processo_numero: pub.numeroProcesso || pub.processo || null,
        conteudo: conteudo,
        fonte: pub.fonte || pub.orgao || pub.tribunal || 'DJEN',
        lida: false,
      })
      .select('id')
      .single();

    if (!insertError && insertedPub) {
      stats.novas++;
      
      await supabase.from('publicacoes_djen_global_hash').upsert({
        hash_global: globalHash,
        primeiro_monitoramento_id: monitoramento.id,
        publicacao_id: insertedPub.id,
      }, { onConflict: 'hash_global', ignoreDuplicates: true });
    }
  }
  
  return stats;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { dataInicio, dataFim, monitoramentoId, offset = 0 } = body;
    
    if (!dataInicio || !dataFim) {
      return new Response(
        JSON.stringify({ error: "dataInicio e dataFim são obrigatórios (formato: YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`=== DJEN Backfill: ${dataInicio} to ${dataFim} (offset: ${offset}) ===`);
    const startTime = Date.now();

    // Get date range (limited)
    const { dates, hasMore: hasMoreDates, nextStart } = getDateRange(dataInicio, dataFim, MAX_DAYS_PER_CALL);
    console.log(`Processing ${dates.length} days`);

    // Fetch monitoramentos with pagination
    let query = supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: true })
      .range(offset, offset + MAX_MONITORAMENTOS_PER_CALL - 1);
    
    if (monitoramentoId) {
      query = supabase
        .from('monitoramentos_djen')
        .select('*')
        .eq('id', monitoramentoId);
    }
    
    const { data: monitoramentos, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    const monCount = monitoramentos?.length || 0;
    console.log(`Processing ${monCount} monitoramentos (offset ${offset})`);

    let totalNovas = 0;
    let totalDescartadas = 0;
    let totalDuplicatas = 0;
    let errorCount = 0;

    // Process each monitoramento for the full date range
    for (const mon of (monitoramentos || [])) {
      try {
        console.log(`\nProcessing: ${mon.descricao || mon.termo_busca}`);
        
        const stats = await processMonitoramentoForDateRange(
          supabase, 
          mon, 
          dates[0], 
          dates[dates.length - 1]
        );
        
        totalNovas += stats.novas;
        totalDescartadas += stats.descartadas;
        totalDuplicatas += stats.duplicatas;
        
        // Delay between monitoramentos
        await delay(2000);
        
      } catch (error) {
        errorCount++;
        console.error(`Error on ${mon.id}:`, error);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const hasMoreMonitoramentos = monCount === MAX_MONITORAMENTOS_PER_CALL;
    
    console.log(`\n=== Batch Complete ===`);
    console.log(`Days: ${dates[0]} to ${dates[dates.length - 1]}`);
    console.log(`Monitoramentos: ${monCount}`);
    console.log(`New: ${totalNovas}, Discarded: ${totalDescartadas}, Duplicates: ${totalDuplicatas}`);
    console.log(`Errors: ${errorCount}, Duration: ${duration}s`);

    return new Response(
      JSON.stringify({
        success: true,
        dataInicio: dates[0],
        dataFim: dates[dates.length - 1],
        diasProcessados: dates.length,
        monitoramentosProcessados: monCount,
        novasPublicacoes: totalNovas,
        descartadas: totalDescartadas,
        duplicatas: totalDuplicatas,
        erros: errorCount,
        duracaoSegundos: duration,
        // Pagination info
        hasMoreMonitoramentos,
        hasMoreDates,
        nextOffset: hasMoreMonitoramentos ? offset + MAX_MONITORAMENTOS_PER_CALL : 0,
        nextDataInicio: !hasMoreMonitoramentos && hasMoreDates ? nextStart : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
