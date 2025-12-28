import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_COMUNICA_URL = "https://comunica.pje.jus.br";
const JINA_READER_URL = "https://r.jina.ai";

// Limit to prevent timeout
const MAX_DAYS_PER_CALL = 7;
const MAX_MONITORAMENTOS_PER_CALL = 3;

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

interface JinaSearchResult {
  data: string;
  tipo: string;
  conteudo: string;
  processo?: string;
  tribunal?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

// Extract CNJ process number from text
function extractProcessNumber(text: string): string | null {
  const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
  const match = text.match(cnjRegex);
  return match ? match[0] : null;
}

// Parse Jina response to extract publications
function parseJinaResponse(text: string, searchTerm: string, targetDate: string): JinaSearchResult[] {
  const results: JinaSearchResult[] = [];
  
  // Split by common separators in DJEN listings
  const sections = text.split(/(?=\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})|(?=Processo:)|(?=INTIMAÇÃO)|(?=DESPACHO)|(?=SENTENÇA)|(?=DECISÃO)/gi);
  
  for (const section of sections) {
    if (section.length < 50) continue;
    
    // Check if this section contains our search term
    if (!section.toUpperCase().includes(searchTerm.toUpperCase())) continue;
    
    const processo = extractProcessNumber(section);
    
    // Determine the type
    let tipo = "Publicação";
    if (/INTIMAÇÃO/i.test(section)) tipo = "Intimação";
    else if (/DESPACHO/i.test(section)) tipo = "Despacho";
    else if (/SENTENÇA/i.test(section)) tipo = "Sentença";
    else if (/DECISÃO/i.test(section)) tipo = "Decisão";
    
    results.push({
      data: targetDate,
      tipo,
      conteudo: section.trim().substring(0, 5000),
      processo: processo || undefined,
      tribunal: "DJEN",
    });
  }
  
  return results;
}

async function fetchWithJina(searchTerm: string, dataInicio: string, dataFim: string, jinaApiKey: string): Promise<JinaSearchResult[]> {
  const allResults: JinaSearchResult[] = [];
  
  // Build search URL for PJE Comunica
  const targetUrl = `${PJE_COMUNICA_URL}/?texto=${encodeURIComponent(searchTerm)}&dataInicio=${dataInicio}&dataFim=${dataFim}`;
  const jinaUrl = `${JINA_READER_URL}/${targetUrl}`;
  
  console.log(`Fetching via Jina: ${targetUrl}`);
  
  try {
    const response = await fetch(jinaUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jinaApiKey}`,
        "Accept": "text/plain",
        "X-Return-Format": "text",
        "X-Wait-For-Selector": ".resultado-busca, .comunicacao-item, .publicacao",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Jina error ${response.status}:`, errorText.substring(0, 500));
      return [];
    }
    
    const text = await response.text();
    console.log(`Jina returned ${text.length} chars`);
    
    if (text.length < 100) {
      console.log("Response too short, likely no results");
      return [];
    }
    
    // Parse the response to extract publications
    const parsed = parseJinaResponse(text, searchTerm, dataInicio);
    console.log(`Parsed ${parsed.length} publications`);
    
    allResults.push(...parsed);
    
  } catch (error) {
    console.error("Jina fetch error:", error);
  }
  
  return allResults;
}

async function processMonitoramentoForDateRange(
  supabase: any,
  monitoramento: Monitoramento,
  dataInicio: string,
  dataFim: string,
  jinaApiKey: string
): Promise<{ novas: number; descartadas: number; duplicatas: number }> {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  
  let searchTerm = monitoramento.termo_busca;
  
  if (monitoramento.tipo === 'advogado' && monitoramento.oab) {
    searchTerm = monitoramento.uf ? `OAB ${monitoramento.uf} ${monitoramento.oab}` : `OAB ${monitoramento.oab}`;
  }
  
  console.log(`Processing "${monitoramento.descricao || searchTerm}" from ${dataInicio} to ${dataFim}`);
  
  // Fetch using Jina
  const results = await fetchWithJina(searchTerm, dataInicio, dataFim, jinaApiKey);
  
  if (results.length === 0) {
    console.log("No results found via Jina");
    return stats;
  }
  
  for (const item of results) {
    const conteudo = item.conteudo || "";
    
    if (conteudo.length < 20) continue;
    
    const dataPublicacao = item.data || dataInicio;
    const hashConteudo = generateHash(conteudo);
    const hashGlobal = generateGlobalHash(conteudo, dataPublicacao);
    
    // Check global hash
    const { data: existingGlobal } = await supabase
      .from('publicacoes_djen_global_hash')
      .select('id')
      .eq('hash_global', hashGlobal)
      .maybeSingle();
    
    if (existingGlobal) {
      stats.duplicatas++;
      continue;
    }
    
    // Check exclusions
    const exclusaoEncontrada = shouldExclude(conteudo, monitoramento.exclusoes || []);
    if (exclusaoEncontrada) {
      await supabase
        .from('publicacoes_djen_descartadas')
        .insert({
          monitoramento_id: monitoramento.id,
          hash_conteudo: hashConteudo,
          conteudo,
          data_publicacao: dataPublicacao,
          processo_numero: item.processo,
          fonte: item.tribunal || "DJEN",
          motivo_descarte: `Termo excluído: ${exclusaoEncontrada}`,
        });
      stats.descartadas++;
      continue;
    }
    
    // Check concomitant condition
    if (!matchesCondicaoConcomitante(conteudo, monitoramento.condicao_concomitante)) {
      await supabase
        .from('publicacoes_djen_descartadas')
        .insert({
          monitoramento_id: monitoramento.id,
          hash_conteudo: hashConteudo,
          conteudo,
          data_publicacao: dataPublicacao,
          processo_numero: item.processo,
          fonte: item.tribunal || "DJEN",
          motivo_descarte: `Condição concomitante não atendida: ${monitoramento.condicao_concomitante}`,
        });
      stats.descartadas++;
      continue;
    }
    
    // Insert the publication
    const { data: novaPub, error } = await supabase
      .from('publicacoes_djen')
      .insert({
        monitoramento_id: monitoramento.id,
        hash_conteudo: hashConteudo,
        conteudo,
        data_publicacao: dataPublicacao,
        processo_numero: item.processo,
        fonte: item.tribunal || "DJEN",
      })
      .select('id')
      .maybeSingle();
    
    if (error) {
      if (error.code === '23505') {
        stats.duplicatas++;
      } else {
        console.error("Insert error:", error);
      }
      continue;
    }
    
    // Register global hash
    await supabase
      .from('publicacoes_djen_global_hash')
      .insert({
        hash_global: hashGlobal,
        primeiro_monitoramento_id: monitoramento.id,
        publicacao_id: novaPub?.id,
      });
    
    stats.novas++;
  }
  
  return stats;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const jinaApiKey = Deno.env.get('JINA_API_KEY');
    
    if (!jinaApiKey) {
      throw new Error("JINA_API_KEY not configured");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await req.json();
    const { dataInicio, dataFim, monitoramentoId, offset = 0 } = body;
    
    if (!dataInicio || !dataFim) {
      throw new Error("dataInicio and dataFim are required");
    }
    
    console.log(`=== Backfill DJEN via Jina: ${dataInicio} to ${dataFim} ===`);
    
    // Get date range (limited)
    const { dates, hasMore: hasMoreDates, nextStart } = getDateRange(dataInicio, dataFim, MAX_DAYS_PER_CALL);
    console.log(`Processing ${dates.length} days, hasMore: ${hasMoreDates}`);
    
    // Fetch monitoramentos
    let query = supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true)
      .range(offset, offset + MAX_MONITORAMENTOS_PER_CALL - 1);
    
    if (monitoramentoId) {
      query = supabase
        .from('monitoramentos_djen')
        .select('*')
        .eq('id', monitoramentoId)
        .eq('ativo', true);
    }
    
    const { data: monitoramentos, error: fetchError } = await query;
    
    if (fetchError) {
      throw new Error(`Error fetching monitoramentos: ${fetchError.message}`);
    }
    
    if (!monitoramentos || monitoramentos.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No active monitoramentos found",
        stats: { novas: 0, descartadas: 0, duplicatas: 0 },
        hasMore: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`Processing ${monitoramentos.length} monitoramentos`);
    
    const totalStats = { novas: 0, descartadas: 0, duplicatas: 0, erros: 0 };
    const processedMonitoramentos: string[] = [];
    
    // Process date range for each monitoramento
    const batchDataInicio = dates[0];
    const batchDataFim = dates[dates.length - 1];
    
    for (const mon of monitoramentos) {
      try {
        console.log(`\n--- Monitoramento: ${mon.descricao || mon.termo_busca} ---`);
        
        const stats = await processMonitoramentoForDateRange(
          supabase,
          mon,
          batchDataInicio,
          batchDataFim,
          jinaApiKey
        );
        
        totalStats.novas += stats.novas;
        totalStats.descartadas += stats.descartadas;
        totalStats.duplicatas += stats.duplicatas;
        
        processedMonitoramentos.push(mon.id);
        
        // Delay between monitoramentos
        await delay(2000);
        
      } catch (monError) {
        console.error(`Error processing ${mon.id}:`, monError);
        totalStats.erros++;
      }
    }
    
    // Check if more monitoramentos exist
    const { count: totalCount } = await supabase
      .from('monitoramentos_djen')
      .select('*', { count: 'exact', head: true })
      .eq('ativo', true);
    
    const hasMoreMonitoramentos = !monitoramentoId && (offset + monitoramentos.length) < (totalCount || 0);
    
    const result = {
      success: true,
      stats: totalStats,
      processedMonitoramentos: processedMonitoramentos.length,
      totalMonitoramentos: totalCount,
      hasMoreDates,
      hasMoreMonitoramentos,
      nextOffset: hasMoreMonitoramentos ? offset + MAX_MONITORAMENTOS_PER_CALL : null,
      nextDataInicio: nextStart,
      processedDateRange: { inicio: batchDataInicio, fim: batchDataFim },
    };
    
    console.log("\n=== Backfill complete ===", result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
