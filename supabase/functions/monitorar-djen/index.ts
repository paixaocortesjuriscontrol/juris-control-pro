import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

// Max monitoramentos per invocation to stay within compute limits
const MAX_PER_INVOCATION = 10;

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
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 2,
  baseDelay = 1500
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
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

// Extract process number from content using regex patterns
function extractProcessoNumero(conteudo: string, explicitNumero?: string | null): string | null {
  // If explicitly provided, use it
  if (explicitNumero) return explicitNumero;
  
  // Try to extract from content - multiple patterns used in Brazilian courts
  const patterns = [
    // Standard CNJ format: 0000000-00.0000.0.00.0000
    /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/,
    // "Processo" prefix variations
    /Processo\s*(?:n[º°]?\.?\s*)?(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i,
    // Alternative format with slashes
    /(\d{7}\/\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = conteudo.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
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

// Function removed - using fetchDJENResultsWithStats below

interface TribunalStats {
  tribunal: string;
  paginas: number;
  resultados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
}

async function processMonitoramento(
  supabase: any,
  monitoramento: Monitoramento
): Promise<{ novas: number; descartadas: number; duplicatas: number; tribunaisStats: TribunalStats[] }> {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  const tribunaisStats: TribunalStats[] = [];
  const dataAtual = new Date().toISOString().split('T')[0];
  
  // Build search term based on type
  let searchText = '';
  if (monitoramento.tipo === "advogado" && monitoramento.oab) {
    // For advogado, search by OAB number with UF
    const uf = monitoramento.uf || 'DF';
    searchText = `OAB ${monitoramento.oab} ${uf}`;
    console.log(`Advogado search: ${searchText}`);
  } else if (monitoramento.tipo === "palavra-chave") {
    searchText = monitoramento.termo_busca;
  } else if (monitoramento.tipo === "processo") {
    searchText = monitoramento.termo_busca.replace(/\D/g, '');
  }
  
  if (!searchText) {
    console.log(`No search text for monitoramento ${monitoramento.id}`);
    return { ...stats, tribunaisStats };
  }
  
  // Get list of tribunais to search
  const tribunais = monitoramento.tribunais && monitoramento.tribunais.length > 0 
    ? monitoramento.tribunais 
    : ['TODOS'];
  
  console.log(`Searching tribunais: ${tribunais.join(', ')}`);
  
  for (const tribunal of tribunais) {
    const tribunalStat: TribunalStats = {
      tribunal,
      paginas: 0,
      resultados: 0,
      novas: 0,
      descartadas: 0,
      duplicatas: 0,
    };
    
    // Fetch publications for this tribunal with pagination tracking
    const { items: publications, pages } = await fetchDJENResultsWithStats(searchText, tribunal);
    tribunalStat.paginas = pages;
    tribunalStat.resultados = publications.length;
    
    console.log(`Found ${publications.length} publications for tribunal ${tribunal} (${pages} pages)`);
    
    for (const pub of publications) {
      const conteudo = pub.conteudo || pub.texto || pub.teor || pub.descricao || JSON.stringify(pub);
      const hashConteudo = generateHash(conteudo + (pub.dataPublicacao || pub.dataDisponibilizacao || pub.data || ''));
      const dataPublicacao = pub.dataPublicacao || pub.dataDisponibilizacao || pub.dataDJe || pub.dataJornal || pub.data || dataAtual;
      const globalHash = generateGlobalHash(conteudo, dataPublicacao);

      // Check global deduplication
      const { data: existingGlobal } = await supabase
        .from('publicacoes_djen_global_hash')
        .select('id')
        .eq('hash_global', globalHash)
        .maybeSingle();

      if (existingGlobal) {
        stats.duplicatas++;
        tribunalStat.duplicatas++;
        continue;
      }

      // Check concomitant condition
      if (!matchesCondicaoConcomitante(conteudo, monitoramento.condicao_concomitante)) {
        continue;
      }

      // Check exclusion criteria
      const motivoExclusao = shouldExclude(conteudo, monitoramento.exclusoes || []);
      
      // Extract process number from API or content
      const processoNumero = extractProcessoNumero(conteudo, pub.numeroProcesso || pub.processo);
      
      if (motivoExclusao) {
        await supabase.from('publicacoes_djen_descartadas').insert({
          monitoramento_id: monitoramento.id,
          hash_conteudo: hashConteudo,
          data_publicacao: dataPublicacao,
          processo_numero: processoNumero,
          conteudo: conteudo.substring(0, 10000),
          fonte: pub.fonte || pub.orgao || pub.tribunal || 'DJEN',
          motivo_descarte: `Termo de exclusão: ${motivoExclusao}`,
        });

        await supabase.from('publicacoes_djen_global_hash').upsert({
          hash_global: globalHash,
          primeiro_monitoramento_id: monitoramento.id,
        }, { onConflict: 'hash_global', ignoreDuplicates: true });
        
        stats.descartadas++;
        tribunalStat.descartadas++;
        continue;
      }

      // Insert valid publication
      const { data: insertedPub, error: insertError } = await supabase
        .from('publicacoes_djen')
        .insert({
          monitoramento_id: monitoramento.id,
          hash_conteudo: hashConteudo,
          data_publicacao: dataPublicacao,
          processo_numero: processoNumero,
          conteudo: conteudo.substring(0, 10000),
          fonte: pub.fonte || pub.orgao || pub.tribunal || 'DJEN',
        })
        .select('id')
        .single();

      if (!insertError && insertedPub) {
        stats.novas++;
        tribunalStat.novas++;
        
        await supabase.from('publicacoes_djen_global_hash').upsert({
          hash_global: globalHash,
          primeiro_monitoramento_id: monitoramento.id,
          publicacao_id: insertedPub.id,
        }, { onConflict: 'hash_global', ignoreDuplicates: true });
        
        // Create notification (simplified - just for creator)
        await supabase.from('notificacoes').insert({
          usuario_id: monitoramento.criado_por,
          titulo: 'Nova publicação no DJEN',
          mensagem: `Publicação para: "${monitoramento.descricao || monitoramento.termo_busca}"`,
          tipo: 'info',
          link: '/analise-djen',
        });
      }
    }
    
    tribunaisStats.push(tribunalStat);
    
    // Small delay between tribunais
    if (tribunais.length > 1) {
      await delay(800);
    }
  }
  
  console.log(`Monitoramento ${monitoramento.id}: novas=${stats.novas}, descartadas=${stats.descartadas}, duplicatas=${stats.duplicatas}`);
  return { ...stats, tribunaisStats };
}

async function fetchDJENResultsWithStats(searchText: string, siglaTribunal?: string): Promise<{ items: any[]; pages: number }> {
  const dataAtual = new Date().toISOString().split('T')[0];
  const allResults: any[] = [];
  let page = 0;
  const pageSize = 100;
  const maxPages = 50;
  
  while (page < maxPages) {
    const queryParams = new URLSearchParams();
    queryParams.append("texto", searchText);
    queryParams.append("dataDisponibilizacaoInicio", dataAtual);
    queryParams.append("dataDisponibilizacaoFim", dataAtual);
    queryParams.append("pagina", page.toString());
    queryParams.append("itensPorPagina", pageSize.toString());
    
    if (siglaTribunal && siglaTribunal !== 'TODOS' && !siglaTribunal.startsWith('TODOS_')) {
      queryParams.append("siglaTribunal", siglaTribunal);
    }
    
    const fullUrl = `${PJE_COMUNICA_API}/comunicacao?${queryParams.toString()}`;
    
    try {
      const response = await fetchWithRetry(fullUrl, {
        method: "GET",
        headers: browserHeaders,
      });

      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("text/html")) {
        break;
      }

      if (response.ok) {
        const data = await response.json();
        const items = data.items || data.content || data.comunicacoes || data.publicacoes || [];
        const totalElements = data.totalElements ?? data.total ?? 0;
        
        if (!Array.isArray(items) || items.length === 0) {
          break;
        }
        
        allResults.push(...items);
        
        if (allResults.length >= totalElements || items.length < pageSize) {
          page++;
          break;
        }
        
        page++;
        await delay(500);
      } else {
        break;
      }
    } catch (error) {
      console.error(`Fetch error:`, error);
      break;
    }
  }
  
  return { items: allResults, pages: page };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for offset parameter (for paginated processing)
    const url = new URL(req.url);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    console.log(`=== DJEN Monitor (offset: ${offset}) ===`);
    const startTime = Date.now();

    // Fetch active monitoramentos with pagination
    const { data: monitoramentos, error: fetchError } = await supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: true })
      .range(offset, offset + MAX_PER_INVOCATION - 1);

    if (fetchError) {
      throw fetchError;
    }

    const count = monitoramentos?.length || 0;
    console.log(`Processing ${count} monitoramentos (offset ${offset})`);

    let totalNovas = 0;
    let totalDescartadas = 0;
    let totalDuplicatas = 0;
    let processedCount = 0;
    let errorCount = 0;
    let totalPaginas = 0;
    let totalResultados = 0;
    const allTribunaisStats: TribunalStats[] = [];

    for (const mon of (monitoramentos || [])) {
      try {
        processedCount++;
        console.log(`[${processedCount}/${count}] ${mon.descricao || mon.termo_busca}`);
        
        const stats = await processMonitoramento(supabase, mon);
        totalNovas += stats.novas;
        totalDescartadas += stats.descartadas;
        totalDuplicatas += stats.duplicatas;
        
        // Aggregate tribunal stats
        for (const ts of stats.tribunaisStats) {
          totalPaginas += ts.paginas;
          totalResultados += ts.resultados;
          
          // Merge with existing tribunal stats
          const existing = allTribunaisStats.find(t => t.tribunal === ts.tribunal);
          if (existing) {
            existing.paginas += ts.paginas;
            existing.resultados += ts.resultados;
            existing.novas += ts.novas;
            existing.descartadas += ts.descartadas;
            existing.duplicatas += ts.duplicatas;
          } else {
            allTribunaisStats.push({ ...ts });
          }
        }
        
        // Delay between monitoramentos
        await delay(1200);
        
      } catch (error) {
        errorCount++;
        console.error(`Error on ${mon.id}:`, error);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const hasMore = count === MAX_PER_INVOCATION;
    
    // Sort tribunais by resultados descending
    allTribunaisStats.sort((a, b) => b.resultados - a.resultados);
    
    // Update config with detailed stats
    await supabase
      .from('configuracoes_monitoramento')
      .update({ 
        ultima_execucao: new Date().toISOString(),
        metadata: {
          last_run: new Date().toISOString(),
          offset_processado: offset,
          processados: processedCount,
          novas: totalNovas,
          descartadas: totalDescartadas,
          duplicatas: totalDuplicatas,
          erros: errorCount,
          duracao_s: duration,
          has_more: hasMore,
          total_paginas: totalPaginas,
          total_resultados: totalResultados,
          tribunais_stats: allTribunaisStats.slice(0, 20), // Top 20 tribunais
        }
      })
      .eq('tipo', 'djen');
    
    // Save to historico_monitoramento for persistent report
    await supabase.from('historico_monitoramento').insert({
      tipo: 'djen',
      executado_em: new Date().toISOString(),
      processos_verificados: processedCount,
      novos_andamentos: totalNovas,
      processos_com_novos: totalNovas,
      erros: errorCount,
      detalhes: {
        offset,
        descartadas: totalDescartadas,
        duplicatas: totalDuplicatas,
        duracao_s: duration,
        total_paginas: totalPaginas,
        total_resultados: totalResultados,
        tribunais_stats: allTribunaisStats.slice(0, 30),
      },
    });

    console.log(`Done: ${processedCount} processed, ${totalNovas} new, ${totalPaginas} pages, ${duration}s`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: processedCount,
        novasPublicacoes: totalNovas,
        descartadas: totalDescartadas,
        duplicatas: totalDuplicatas,
        erros: errorCount,
        duracaoSegundos: duration,
        totalPaginas,
        totalResultados,
        tribunaisStats: allTribunaisStats,
        hasMore,
        nextOffset: hasMore ? offset + MAX_PER_INVOCATION : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
