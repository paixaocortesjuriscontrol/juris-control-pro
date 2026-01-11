import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

// Max monitoramentos per invocation.
// Keep this conservative to avoid edge-function timeouts on heavier queries.
const MAX_PER_INVOCATION = 10;

// Soft time limit (ms) to ensure we respond before the platform/browser cuts the request.
const SOFT_TIMEOUT_MS = 75_000;

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

// Detect audiência in publication content
interface AudienciaInfo {
  dataAudiencia: string | null;
  tipoAudiencia: string | null;
  localAudiencia: string | null;
  contexto: string;
}

function detectAudiencia(conteudo: string): AudienciaInfo | null {
  const conteudoLower = conteudo.toLowerCase();
  
  // Check for "audiência" term
  const audienciaTerms = [
    'audiência',
    'audiencia',
    'sessão de julgamento',
    'sessao de julgamento',
    'pauta de julgamento',
  ];
  
  const hasAudiencia = audienciaTerms.some(term => conteudoLower.includes(term));
  if (!hasAudiencia) return null;
  
  // Extract context around the term
  let contexto = '';
  for (const term of audienciaTerms) {
    const index = conteudoLower.indexOf(term);
    if (index !== -1) {
      const start = Math.max(0, index - 100);
      const end = Math.min(conteudo.length, index + term.length + 200);
      contexto = (start > 0 ? '...' : '') + 
                 conteudo.slice(start, end) + 
                 (end < conteudo.length ? '...' : '');
      break;
    }
  }
  
  // Try to extract date from context
  let dataAudiencia: string | null = null;
  
  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = contexto.match(pattern);
    if (match) {
      // Convert to ISO date if possible
      if (match[2] && isNaN(parseInt(match[2]))) {
        // Month is text
        const months: Record<string, string> = {
          'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
          'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
          'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
        };
        const month = months[match[2].toLowerCase()] || '01';
        dataAudiencia = `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
      } else {
        dataAudiencia = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
      break;
    }
  }
  
  // Try to extract type
  let tipoAudiencia: string | null = null;
  const tipoPatterns = [
    /audiência\s+de\s+(conciliação|instrução|julgamento|instrução e julgamento|una|inicial|custódia)/i,
    /audiencia\s+de\s+(conciliacao|instrucao|julgamento|instrucao e julgamento|una|inicial|custodia)/i,
  ];
  
  for (const pattern of tipoPatterns) {
    const match = conteudo.match(pattern);
    if (match) {
      tipoAudiencia = match[1];
      break;
    }
  }
  
  // Try to extract location
  let localAudiencia: string | null = null;
  const localPatterns = [
    /(?:local|sala|endereço|endereco|forum|fórum)[\s:]+([^,\n]{10,60})/i,
    /(?:na|no|em)\s+(?:sala|fórum|forum)\s+([^,\n]{5,50})/i,
  ];
  
  for (const pattern of localPatterns) {
    const match = conteudo.match(pattern);
    if (match) {
      localAudiencia = match[1].trim();
      break;
    }
  }
  
  return {
    dataAudiencia,
    tipoAudiencia,
    localAudiencia,
    contexto,
  };
}

// Function removed - using fetchDJENResultsWithStats below

interface TribunalStats {
  tribunal: string | null;
  paginas: number;
  resultados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
}

// Search parameters interface for PJe Comunica API
interface SearchParams {
  texto?: string;
  numeroOab?: string;
  ufOab?: string;
  // Matches the "Nome do advogado" field on https://comunica.pje.jus.br/consulta
  nomeAdvogado?: string;
  siglaTribunal?: string | null;
}

async function processMonitoramento(
  supabase: any,
  monitoramento: Monitoramento
): Promise<{ novas: number; descartadas: number; duplicatas: number; tribunaisStats: TribunalStats[] }> {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  const tribunaisStats: TribunalStats[] = [];
  const dataAtual = new Date().toISOString().split('T')[0];
  
  // Build search params based on type
  // IMPORTANT: the Comunica UI filters (https://comunica.pje.jus.br/consulta) uses structured OAB filters.
  // When we search "all tribunals" the result-set can be large; prefer OAB params to avoid missing items due to pagination caps.
  const searchCandidates: Array<Omit<SearchParams, 'siglaTribunal'>> = [];

  if (monitoramento.tipo === "advogado") {
    const termo = (monitoramento.termo_busca || "").trim();
    const hasNome = termo.length >= 3 && /[A-Za-zÀ-ÿ]/.test(termo);

    if (monitoramento.oab) {
      const uf = (monitoramento.uf || "DF").toUpperCase();
      const numeroOab = monitoramento.oab.replace(/\D/g, "");

      // 1) Prefer dedicated parameters (matches the Comunica filters)
      searchCandidates.push({ numeroOab, ufOab: uf });

      // 2) Fallbacks: API variants / indexing differences
      searchCandidates.push({ texto: `OAB ${uf}-${numeroOab}` });
      searchCandidates.push({ texto: `OAB ${numeroOab} ${uf}` });
      searchCandidates.push({ texto: numeroOab });
    }

    // 3) Name-based search (matches the Comunica UI field "Nome do advogado")
    if (hasNome) {
      searchCandidates.push({ nomeAdvogado: termo });
      // fallback (some endpoints/indexes still work better with a generic text query)
      searchCandidates.push({ texto: termo });
    }

    console.log(
      `Advogado search candidates: oab=${monitoramento.oab || "(none)"}, uf=${(monitoramento.uf || "DF").toUpperCase()}, nome=${hasNome ? termo : "(none)"}`
    );
  } else if (monitoramento.tipo === "palavra-chave") {
    searchCandidates.push({ texto: monitoramento.termo_busca });
  } else if (monitoramento.tipo === "processo") {
    searchCandidates.push({ texto: monitoramento.termo_busca.replace(/\D/g, "") });
  } else if (monitoramento.tipo === "parte") {
    // Busca por nome da parte (empresa, pessoa, etc.)
    // Uses generic text search - API will match against all parties in publications
    const termo = (monitoramento.termo_busca || "").trim();
    if (termo.length >= 3) {
      searchCandidates.push({ texto: termo });
      console.log(`Parte search: "${termo}"`);
    }
  }

  if (searchCandidates.length === 0) {
    console.log(`No search params for monitoramento ${monitoramento.id}`);
    return { ...stats, tribunaisStats };
  }

  // Get list of tribunais to search
  // When tribunais is empty/null, we pass [null] to search ALL tribunals without filter
  const tribunais = monitoramento.tribunais && monitoramento.tribunais.length > 0
    ? monitoramento.tribunais
    : [null]; // null means search all tribunals (no siglaTribunal filter)

  console.log(`Searching tribunais: ${tribunais.length === 1 && tribunais[0] === null ? 'TODOS (sem filtro)' : tribunais.join(', ')}`);

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
    let publications: any[] = [];
    let pages = 0;

    for (const candidate of searchCandidates) {
      const searchParams: SearchParams = { ...candidate, siglaTribunal: tribunal };
      const result = await fetchDJENResultsWithStats(searchParams);
      publications = result.items;
      pages = result.pages;
      if (publications.length > 0) break;
    }

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
          conteudo: conteudo,
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
          conteudo: conteudo,
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
        
        // Check for "audiência" term and create alert
        const audienciaInfo = detectAudiencia(conteudo);
        if (audienciaInfo) {
          await supabase.from('audiencias_detectadas').insert({
            publicacao_id: insertedPub.id,
            monitoramento_id: monitoramento.id,
            processo_numero: processoNumero,
            data_audiencia: audienciaInfo.dataAudiencia,
            tipo_audiencia: audienciaInfo.tipoAudiencia,
            local_audiencia: audienciaInfo.localAudiencia,
            contexto: audienciaInfo.contexto,
            conteudo_publicacao: conteudo,
            status: 'pendente',
          });
          
          // Notification for audiência detection
          await supabase.from('notificacoes').insert({
            usuario_id: monitoramento.criado_por,
            titulo: '📅 Audiência Detectada!',
            mensagem: `Audiência encontrada: ${audienciaInfo.contexto?.substring(0, 100) || 'Ver detalhes'}`,
            tipo: 'warning',
            link: '/painel-audiencias',
          });
        }
        
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

async function fetchDJENResultsWithStats(
  params: SearchParams
): Promise<{ items: any[]; pages: number }> {
  // Use only TODAY in Brasilia timezone (UTC-3) to avoid duplicates and excessive data.
  // The nomeAdvogado parameter now correctly finds publications, so we don't need the 3-day window.
  const now = new Date();
  // Adjust to Brasilia timezone (UTC-3)
  const brasiliaOffset = -3 * 60 * 60 * 1000;
  const brasiliaTime = new Date(now.getTime() + brasiliaOffset + now.getTimezoneOffset() * 60 * 1000);
  const todayBrasilia = brasiliaTime.toISOString().split('T')[0];
  
  const startDate = todayBrasilia;
  const endDate = todayBrasilia;

  const allResults: any[] = [];
  let page = 0;
  const pageSize = 100;
  const maxPages = 50;

  while (page < maxPages) {
    const queryParams = new URLSearchParams();
    
    // Prefer nomeAdvogado when provided (matches the Comunica UI "Nome do advogado")
    // Then fallback to structured OAB, then to generic text.
    if (params.nomeAdvogado) {
      queryParams.append("nomeAdvogado", params.nomeAdvogado);
    } else if (params.numeroOab) {
      queryParams.append("numeroOab", params.numeroOab);
      if (params.ufOab) {
        queryParams.append("ufOab", params.ufOab);
      }
    } else if (params.texto) {
      queryParams.append("texto", params.texto);
    }

    queryParams.append("dataDisponibilizacaoInicio", startDate);
    queryParams.append("dataDisponibilizacaoFim", endDate);
    queryParams.append("pagina", page.toString());
    queryParams.append("itensPorPagina", pageSize.toString());
    
    if (params.siglaTribunal && params.siglaTribunal !== 'TODOS' && !params.siglaTribunal.startsWith('TODOS_')) {
      queryParams.append("siglaTribunal", params.siglaTribunal);
    }
    
    const fullUrl = `${PJE_COMUNICA_API}/comunicacao?${queryParams.toString()}`;
    console.log(`Fetching: ${fullUrl}`);
    
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

    const url = new URL(req.url);

    // Body flags (cron usa { scheduled: true })
    const body = await req.json().catch(() => ({} as any));
    const scheduled = body?.scheduled === true;
    const completeRun = body?.completeRun === true || scheduled;

    // Se não vier offset na URL, usar o next_offset persistido (para execuções agendadas/complete)
    const urlOffsetRaw = url.searchParams.get('offset');
    const urlOffset = urlOffsetRaw !== null ? Number.parseInt(urlOffsetRaw, 10) : NaN;

    let offset = Number.isFinite(urlOffset) ? urlOffset : 0;

    // For completeRun, always start from 0 to ensure full cycle
    if (completeRun) {
      offset = 0;
      console.log(`=== DJEN Monitor COMPLETE RUN starting from offset 0 ===`);
    }

    console.log(`=== DJEN Monitor (offset: ${offset}) | scheduled=${scheduled} | completeRun=${completeRun} ===`);
    const runStartTime = Date.now();
    const runId = crypto.randomUUID();

    // Accumulated totals for the full run
    let grandTotalNovas = 0;
    let grandTotalDescartadas = 0;
    let grandTotalDuplicatas = 0;
    let grandTotalProcessed = 0;
    let grandTotalErrors = 0;
    let grandTotalPaginas = 0;
    let grandTotalResultados = 0;
    const grandTribunaisStats: Record<string, TribunalStats> = {};

    let currentOffset = offset;
    let hasMore = true;
    let batchCount = 0;
    const MAX_BATCHES = 20; // Safety limit to avoid infinite loops

    // Loop for completeRun to process all monitoramentos
    while (hasMore && (!completeRun || batchCount < MAX_BATCHES)) {
      batchCount++;
      const batchStartTime = Date.now();

      // Check global timeout (leave buffer for response)
      if (Date.now() - runStartTime > SOFT_TIMEOUT_MS) {
        console.log(`Global soft timeout reached at ${Math.round((Date.now() - runStartTime) / 1000)}s. Stopping.`);
        break;
      }

      // Total active monitoramentos (used to compute hasMore correctly)
      const { count: totalActive, error: countError } = await supabase
        .from('monitoramentos_djen')
        .select('id', { count: 'exact', head: true })
        .eq('ativo', true);

      if (countError) {
        throw countError;
      }

      // Fetch active monitoramentos with pagination
      const { data: monitoramentos, error: fetchError } = await supabase
        .from('monitoramentos_djen')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: true })
        .range(currentOffset, currentOffset + MAX_PER_INVOCATION - 1);

      if (fetchError) {
        throw fetchError;
      }

      const count = monitoramentos?.length || 0;
      const total = totalActive || 0;

      // No more monitoramentos to process
      if (count === 0) {
        console.log(`Batch ${batchCount}: No monitoramentos at offset ${currentOffset}. Cycle complete.`);
        hasMore = false;
        break;
      }

      console.log(`Batch ${batchCount}: Processing ${count} monitoramentos (offset ${currentOffset}, total ${total})`);

      let totalNovas = 0;
      let totalDescartadas = 0;
      let totalDuplicatas = 0;
      let processedCount = 0;
      let errorCount = 0;
      let totalPaginas = 0;
      let totalResultados = 0;

      for (const mon of (monitoramentos || [])) {
        // Soft timeout guard per batch
        if (Date.now() - batchStartTime > 60_000) {
          console.log(`Batch timeout at ${Math.round((Date.now() - batchStartTime) / 1000)}s. Stopping batch.`);
          break;
        }

        try {
          processedCount++;
          console.log(`[${batchCount}.${processedCount}/${count}] ${mon.descricao || mon.termo_busca}`);

          const stats = await processMonitoramento(supabase, mon);
          totalNovas += stats.novas;
          totalDescartadas += stats.descartadas;
          totalDuplicatas += stats.duplicatas;

          // Aggregate tribunal stats
          for (const ts of stats.tribunaisStats) {
            totalPaginas += ts.paginas;
            totalResultados += ts.resultados;

            const tribunalKey = ts.tribunal ?? 'TODOS';
            const existing = grandTribunaisStats[tribunalKey];
            grandTribunaisStats[tribunalKey] = existing
              ? {
                  tribunal: tribunalKey,
                  paginas: (existing.paginas || 0) + (ts.paginas || 0),
                  resultados: (existing.resultados || 0) + (ts.resultados || 0),
                  novas: (existing.novas || 0) + (ts.novas || 0),
                  descartadas: (existing.descartadas || 0) + (ts.descartadas || 0),
                  duplicatas: (existing.duplicatas || 0) + (ts.duplicatas || 0),
                }
              : { ...ts, tribunal: tribunalKey };
          }

          // Reduced delay between monitoramentos for faster completion
          await delay(600);

        } catch (error) {
          errorCount++;
          console.error(`Error on ${mon.id}:`, error);
        }
      }

      // Update grand totals
      grandTotalNovas += totalNovas;
      grandTotalDescartadas += totalDescartadas;
      grandTotalDuplicatas += totalDuplicatas;
      grandTotalProcessed += processedCount;
      grandTotalErrors += errorCount;
      grandTotalPaginas += totalPaginas;
      grandTotalResultados += totalResultados;

      // Determine if there are more monitoramentos
      hasMore = (currentOffset + processedCount) < total;
      currentOffset += processedCount;

      console.log(`Batch ${batchCount} done: ${processedCount} processed, ${totalNovas} new. hasMore=${hasMore}`);

      // If not completeRun, exit after first batch
      if (!completeRun) {
        break;
      }

      // Small delay between batches
      if (hasMore) {
        await delay(1000);
      }
    }

    const nowIso = new Date().toISOString();
    const totalDuration = Math.max(1, Math.round((Date.now() - runStartTime) / 1000));

    // Sort tribunais by resultados descending
    const allTribunaisStats = Object.values(grandTribunaisStats).sort((a, b) => b.resultados - a.resultados);

    // Update config metadata
    const { data: configRow, error: configError } = await supabase
      .from('configuracoes_monitoramento')
      .select('id, metadata')
      .eq('tipo', 'djen')
      .limit(1)
      .maybeSingle();

    if (configError) {
      throw configError;
    }

    const currentMeta = (configRow?.metadata ?? {}) as Record<string, any>;

    const updatedMeta: Record<string, any> = {
      ...currentMeta,
      last_run: nowIso,
      offset_processado: currentOffset,
      processados: grandTotalProcessed,
      novas: grandTotalNovas,
      descartadas: grandTotalDescartadas,
      duplicatas: grandTotalDuplicatas,
      erros: grandTotalErrors,
      duracao_s: totalDuration,
      has_more: hasMore,
      next_offset: hasMore ? currentOffset : 0,
      total_paginas: grandTotalPaginas,
      total_resultados: grandTotalResultados,
      tribunais_stats: allTribunaisStats.slice(0, 20),
      djen_run: hasMore ? { run_id: runId, started_at: nowIso } : null,
      last_complete_run: hasMore ? (currentMeta?.last_complete_run ?? null) : nowIso,
    };

    await supabase
      .from('configuracoes_monitoramento')
      .update({
        metadata: updatedMeta,
        ultima_execucao: nowIso,
      })
      .eq('tipo', 'djen');

    // Persist a single report when the run completes (hasMore=false) or after processing
    if (!hasMore || grandTotalProcessed > 0) {
      await supabase.from('historico_monitoramento').insert({
        tipo: 'djen',
        executado_em: nowIso,
        processos_verificados: grandTotalProcessed,
        novos_andamentos: grandTotalNovas,
        processos_com_novos: grandTotalNovas,
        erros: grandTotalErrors,
        detalhes: {
          run_id: runId,
          started_at: new Date(runStartTime).toISOString(),
          batches: batchCount,
          descartadas: grandTotalDescartadas,
          duplicatas: grandTotalDuplicatas,
          duracao_s: totalDuration,
          total_paginas: grandTotalPaginas,
          total_resultados: grandTotalResultados,
          tribunais_stats: allTribunaisStats.slice(0, 30),
        },
      });
    }

    console.log(`=== COMPLETE: ${grandTotalProcessed} processed in ${batchCount} batches, ${grandTotalNovas} new, ${totalDuration}s ===`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: grandTotalProcessed,
        novasPublicacoes: grandTotalNovas,
        descartadas: grandTotalDescartadas,
        duplicatas: grandTotalDuplicatas,
        erros: grandTotalErrors,
        duracaoSegundos: totalDuration,
        totalPaginas: grandTotalPaginas,
        totalResultados: grandTotalResultados,
        tribunaisStats: allTribunaisStats,
        hasMore,
        nextOffset: hasMore ? currentOffset : null,
        batches: batchCount,
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
