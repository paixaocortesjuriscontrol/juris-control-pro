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

async function fetchDJENResults(searchText: string): Promise<any[]> {
  const dataAtual = new Date().toISOString().split('T')[0];
  
  const queryParams = new URLSearchParams();
  queryParams.append("texto", searchText);
  queryParams.append("dataDisponibilizacaoInicio", dataAtual);
  queryParams.append("dataDisponibilizacaoFim", dataAtual);
  
  const fullUrl = `${PJE_COMUNICA_API}/comunicacao?${queryParams.toString()}`;
  console.log(`Fetching: ${fullUrl}`);
  
  try {
    const response = await fetchWithRetry(fullUrl, {
      method: "GET",
      headers: browserHeaders,
    });

    const contentType = response.headers.get("content-type") || "";
    
    if (contentType.includes("text/html")) {
      console.log("Got HTML response, skipping");
      return [];
    }

    if (response.ok) {
      const data = await response.json();
      const items = data.items || data.content || data.comunicacoes || data.publicacoes || [];
      console.log(`Got ${items.length} items`);
      return Array.isArray(items) ? items : [];
    }

    if (response.status === 422 || response.status === 404) {
      return [];
    }

    console.error(`API error: ${response.status}`);
  } catch (error) {
    console.error(`Fetch error:`, error);
  }

  return [];
}

async function processMonitoramento(
  supabase: any,
  monitoramento: Monitoramento
): Promise<{ novas: number; descartadas: number; duplicatas: number }> {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  const dataAtual = new Date().toISOString().split('T')[0];
  
  let searchTerms: string[] = [];
  
  if (monitoramento.tipo === "advogado" && monitoramento.oab) {
    // For advogado, just search by name (simplified to avoid too many requests)
    if (monitoramento.termo_busca) {
      searchTerms.push(monitoramento.termo_busca);
    }
  } else if (monitoramento.tipo === "palavra-chave") {
    searchTerms.push(monitoramento.termo_busca);
  } else if (monitoramento.tipo === "processo") {
    searchTerms.push(monitoramento.termo_busca.replace(/\D/g, ''));
  }
  
  for (const term of searchTerms) {
    const publications = await fetchDJENResults(term);
    
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
    
    // Small delay between search terms
    await delay(800);
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

    for (const mon of (monitoramentos || [])) {
      try {
        processedCount++;
        console.log(`[${processedCount}/${count}] ${mon.descricao || mon.termo_busca}`);
        
        const stats = await processMonitoramento(supabase, mon);
        totalNovas += stats.novas;
        totalDescartadas += stats.descartadas;
        totalDuplicatas += stats.duplicatas;
        
        // Delay between monitoramentos
        await delay(1200);
        
      } catch (error) {
        errorCount++;
        console.error(`Error on ${mon.id}:`, error);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const hasMore = count === MAX_PER_INVOCATION;
    
    // Update config
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
        }
      })
      .eq('tipo', 'djen');

    console.log(`Done: ${processedCount} processed, ${totalNovas} new, ${duration}s`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: processedCount,
        novasPublicacoes: totalNovas,
        descartadas: totalDescartadas,
        duplicatas: totalDuplicatas,
        erros: errorCount,
        duracaoSegundos: duration,
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
