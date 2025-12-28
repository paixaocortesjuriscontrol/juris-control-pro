import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

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

// Browser-like headers to avoid blocking
const browserHeaders = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://comunica.pje.jus.br",
  "Referer": "https://comunica.pje.jus.br/",
};

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry with exponential backoff
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3,
  baseDelay = 2000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited, wait and retry
      if (response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limited (429). Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await delay(waitTime);
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const waitTime = baseDelay * Math.pow(2, attempt);
      console.log(`Fetch error. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}:`, error);
      await delay(waitTime);
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// Generate hash for publication content to detect duplicates
function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Generate global hash for deduplication across monitoramentos
function generateGlobalHash(conteudo: string, dataPublicacao: string): string {
  const normalized = (conteudo + dataPublicacao).toLowerCase().replace(/\s+/g, ' ').trim();
  return generateHash(normalized);
}

// Check if content should be excluded based on exclusion criteria
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

// Check if content matches concomitant condition
function matchesCondicaoConcomitante(conteudo: string, condicao: string | undefined): boolean {
  if (!condicao) return true;
  
  const conteudoUpper = conteudo.toUpperCase();
  const termos = condicao.split(',').map(t => t.trim().toUpperCase());
  
  return termos.every(termo => conteudoUpper.includes(termo));
}

async function searchDJEN(monitoramento: Monitoramento): Promise<{ items: any[], dataAtual: string }> {
  const results: any[] = [];
  const dataAtual = new Date().toISOString().split('T')[0];
  
  if (monitoramento.tipo === "advogado") {
    if (monitoramento.oab) {
      const ufsToSearch = monitoramento.uf === 'TODAS' 
        ? ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']
        : (monitoramento.uf?.split(',') || ['DF']);
      
      for (const uf of ufsToSearch) {
        const searchText = `OAB ${monitoramento.oab} ${uf.toUpperCase()}`;
        const ufResults = await fetchDJENResults(searchText, monitoramento.id);
        results.push(...ufResults);
        // Delay between UF searches to avoid rate limiting
        await delay(1000);
      }
    }
    
    if (monitoramento.termo_busca && monitoramento.termo_busca !== monitoramento.oab) {
      const nameResults = await fetchDJENResults(monitoramento.termo_busca, monitoramento.id);
      results.push(...nameResults);
    }
    
    return { items: results, dataAtual };
  }
  
  let searchText: string;
  
  switch (monitoramento.tipo) {
    case "palavra-chave":
      searchText = monitoramento.termo_busca;
      break;
    case "processo":
      searchText = monitoramento.termo_busca.replace(/\D/g, '');
      break;
    default:
      return { items: [], dataAtual };
  }

  const items = await fetchDJENResults(searchText, monitoramento.id);
  return { items, dataAtual };
}

async function fetchDJENResults(searchText: string, monitoramentoId: string): Promise<any[]> {
  const dataAtual = new Date().toISOString().split('T')[0];
  
  const queryParams = new URLSearchParams();
  queryParams.append("texto", searchText);
  queryParams.append("dataDisponibilizacaoInicio", dataAtual);
  queryParams.append("dataDisponibilizacaoFim", dataAtual);
  
  // Try endpoints in order of reliability
  const endpoints = [
    `${PJE_COMUNICA_API}/comunicacao`,
    `${PJE_COMUNICA_API}/comunicacoes`,
  ];

  const fullQueryString = queryParams.toString();
  
  for (const endpoint of endpoints) {
    const fullUrl = `${endpoint}?${fullQueryString}`;
    console.log(`Searching DJEN: ${fullUrl}`);
    
    try {
      const response = await fetchWithRetry(fullUrl, {
        method: "GET",
        headers: browserHeaders,
      });

      const contentType = response.headers.get("content-type") || "";
      console.log("Response status:", response.status, "Content-Type:", contentType);
      
      if (contentType.includes("text/html")) {
        console.log("Got HTML response, trying next endpoint...");
        continue;
      }

      if (response.ok) {
        const data = await response.json();
        console.log("Success! Got JSON response with", data.items?.length || data.content?.length || 0, "items");
        
        const items = data.items || data.content || data.comunicacoes || data.publicacoes || [];
        
        if (Array.isArray(items)) {
          return items;
        }
        
        return [];
      }

      if (response.status === 422 || response.status === 404) {
        console.log("No results for this search");
        return [];
      }

      console.error(`DJEN API error: ${response.status}`);
    } catch (error) {
      console.error(`Error with endpoint ${endpoint}:`, error);
    }
    
    // Delay between endpoint attempts
    await delay(500);
  }

  console.log("All endpoints failed, returning empty results");
  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("=== Starting DJEN monitoring job ===");
    const startTime = Date.now();

    // Fetch all active monitoramentos
    const { data: monitoramentos, error: fetchError } = await supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error("Error fetching monitoramentos:", fetchError);
      throw fetchError;
    }

    const totalMonitoramentos = monitoramentos?.length || 0;
    console.log(`Found ${totalMonitoramentos} active monitoramentos`);

    let totalNewPublications = 0;
    let totalDescartadas = 0;
    let totalDuplicatasGlobais = 0;
    let processedCount = 0;
    let errorCount = 0;

    // Process monitoramentos in batches of 5 with delay between batches
    const BATCH_SIZE = 5;
    const BATCH_DELAY = 3000; // 3 seconds between batches
    const ITEM_DELAY = 1500; // 1.5 seconds between items
    
    for (let i = 0; i < (monitoramentos?.length || 0); i += BATCH_SIZE) {
      const batch = monitoramentos!.slice(i, i + BATCH_SIZE);
      
      console.log(`\n--- Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(totalMonitoramentos / BATCH_SIZE)} ---`);
      
      for (const monitoramento of batch) {
        try {
          processedCount++;
          console.log(`\n[${processedCount}/${totalMonitoramentos}] Processing: ${monitoramento.descricao || monitoramento.termo_busca}`);
          
          const { items: publications, dataAtual } = await searchDJEN(monitoramento);
          console.log(`Found ${publications.length} publications`);

          for (const pub of publications) {
            const conteudo = pub.conteudo || pub.texto || pub.teor || pub.descricao || JSON.stringify(pub);
            const hashConteudo = generateHash(conteudo + (pub.dataPublicacao || pub.dataDisponibilizacao || pub.data || ''));
            const dataPublicacao = pub.dataPublicacao || pub.dataDisponibilizacao || pub.dataDJe || pub.dataJornal || pub.data || dataAtual;

            // 1. Check global deduplication first
            const globalHash = generateGlobalHash(conteudo, dataPublicacao);
            const { data: existingGlobal } = await supabase
              .from('publicacoes_djen_global_hash')
              .select('id')
              .eq('hash_global', globalHash)
              .maybeSingle();

            if (existingGlobal) {
              totalDuplicatasGlobais++;
              continue;
            }

            // 2. Check concomitant condition
            if (!matchesCondicaoConcomitante(conteudo, monitoramento.condicao_concomitante)) {
              continue;
            }

            // 3. Check exclusion criteria
            const motivoExclusao = shouldExclude(conteudo, monitoramento.exclusoes || []);
            
            if (motivoExclusao) {
              console.log(`Excluded by term: ${motivoExclusao}`);
              
              const { error: descartadaError } = await supabase
                .from('publicacoes_djen_descartadas')
                .insert({
                  monitoramento_id: monitoramento.id,
                  hash_conteudo: hashConteudo,
                  data_publicacao: dataPublicacao,
                  processo_numero: pub.numeroProcesso || pub.processo || null,
                  conteudo: conteudo.substring(0, 10000),
                  fonte: pub.fonte || pub.orgao || pub.tribunal || 'DJEN',
                  motivo_descarte: `Termo de exclusão: ${motivoExclusao}`,
                });

              if (!descartadaError) {
                totalDescartadas++;
                await supabase.from('publicacoes_djen_global_hash').upsert({
                  hash_global: globalHash,
                  primeiro_monitoramento_id: monitoramento.id,
                }, { onConflict: 'hash_global', ignoreDuplicates: true });
              }
              
              continue;
            }

            // 4. Insert valid publication
            const { data: insertedPub, error: insertError } = await supabase
              .from('publicacoes_djen')
              .insert({
                monitoramento_id: monitoramento.id,
                hash_conteudo: hashConteudo,
                data_publicacao: dataPublicacao,
                processo_numero: pub.numeroProcesso || pub.processo || null,
                conteudo: conteudo.substring(0, 10000),
                fonte: pub.fonte || pub.orgao || pub.tribunal || 'DJEN',
              })
              .select('id')
              .single();

            if (!insertError && insertedPub) {
              totalNewPublications++;
              console.log(`✓ New publication saved: ${insertedPub.id}`);
              
              await supabase.from('publicacoes_djen_global_hash').upsert({
                hash_global: globalHash,
                primeiro_monitoramento_id: monitoramento.id,
                publicacao_id: insertedPub.id,
              }, { onConflict: 'hash_global', ignoreDuplicates: true });
              
              // Notify users
              const usersToNotify: string[] = [monitoramento.criado_por];
              
              const { data: adminUsers } = await supabase
                .from('user_roles')
                .select('user_id')
                .in('role', ['admin', 'coordenador']);
              
              adminUsers?.forEach((u: any) => {
                if (!usersToNotify.includes(u.user_id)) {
                  usersToNotify.push(u.user_id);
                }
              });

              if (monitoramento.coordenacao_id) {
                const { data: membros } = await supabase
                  .from('membros_coordenacao')
                  .select('usuario_id')
                  .eq('coordenacao_id', monitoramento.coordenacao_id);
                
                membros?.forEach((m: any) => {
                  if (!usersToNotify.includes(m.usuario_id)) {
                    usersToNotify.push(m.usuario_id);
                  }
                });
              }

              for (const userId of usersToNotify) {
                await supabase.from('notificacoes').insert({
                  usuario_id: userId,
                  titulo: 'Nova publicação no DJEN',
                  mensagem: `Encontrada publicação para: "${monitoramento.descricao || monitoramento.termo_busca}"`,
                  tipo: 'info',
                  link: '/analise-djen',
                  dados: {
                    monitoramento_id: monitoramento.id,
                    processo: pub.numeroProcesso || pub.processo,
                    preview: conteudo.substring(0, 200),
                  },
                });
              }
            }
          }
          
          // Delay between monitoramentos
          await delay(ITEM_DELAY);
          
        } catch (monError) {
          errorCount++;
          console.error(`Error processing monitoramento ${monitoramento.id}:`, monError);
        }
      }
      
      // Delay between batches
      if (i + BATCH_SIZE < (monitoramentos?.length || 0)) {
        console.log(`Waiting ${BATCH_DELAY}ms before next batch...`);
        await delay(BATCH_DELAY);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    
    // Update monitoring configuration
    await supabase
      .from('configuracoes_monitoramento')
      .update({ 
        ultima_execucao: new Date().toISOString(),
        metadata: {
          last_complete_run: new Date().toISOString(),
          monitoramentos_processados: processedCount,
          novas_publicacoes: totalNewPublications,
          descartadas: totalDescartadas,
          duplicatas_globais: totalDuplicatasGlobais,
          erros: errorCount,
          duracao_segundos: duration,
        }
      })
      .eq('tipo', 'djen');

    console.log(`\n=== Monitoring complete ===`);
    console.log(`Duration: ${duration}s`);
    console.log(`Processed: ${processedCount}/${totalMonitoramentos}`);
    console.log(`New: ${totalNewPublications}, Discarded: ${totalDescartadas}, Duplicates: ${totalDuplicatasGlobais}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        monitoramentosProcessados: processedCount,
        totalMonitoramentos,
        novasPublicacoes: totalNewPublications,
        descartadas: totalDescartadas,
        duplicatasGlobais: totalDuplicatasGlobais,
        erros: errorCount,
        duracaoSegundos: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Monitoring error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
