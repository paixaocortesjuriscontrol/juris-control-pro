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
  // IMPORTANT:
  // PJe Comunica sometimes "shifts" the disponibilização date vs. what users see in the Diário (and also has timezone effects).
  // To avoid missing publications, we search in a small rolling window (last 3 UTC days).
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

    if (!Number.isFinite(urlOffset) && completeRun) {
      const { data: configRow } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .limit(1)
        .maybeSingle();

      const meta: any = configRow?.metadata || {};
      const metaOffset = typeof meta?.next_offset === 'number' ? meta.next_offset : 0;
      offset = metaOffset;
    }

    console.log(`=== DJEN Monitor (offset: ${offset}) | scheduled=${scheduled} | completeRun=${completeRun} ===`);
    const startTime = Date.now();

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
      .range(offset, offset + MAX_PER_INVOCATION - 1);

    if (fetchError) {
      throw fetchError;
    }

    const count = monitoramentos?.length || 0;
    const total = totalActive || 0;

    // IMPORTANT: avoid writing "empty batches" to the database.
    // These batches happen when total === MAX_PER_INVOCATION exactly and the client calls nextOffset,
    // causing offset to exceed the total and returning 0 rows (which was creating misleading 1s reports).
    if (count === 0) {
      const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      console.log(`No monitoramentos to process at offset ${offset}. Returning without DB writes.`);
      return new Response(
        JSON.stringify({
          success: true,
          processados: 0,
          novasPublicacoes: 0,
          descartadas: 0,
          duplicatas: 0,
          erros: 0,
          duracaoSegundos: duration,
          totalPaginas: 0,
          totalResultados: 0,
          tribunaisStats: [],
          hasMore: false,
          nextOffset: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      // Soft timeout guard: stop early and let the caller continue with nextOffset.
      if (Date.now() - startTime > SOFT_TIMEOUT_MS) {
        console.log(`Soft timeout reached at ${Math.round((Date.now() - startTime) / 1000)}s. Stopping batch early.`);
        break;
      }

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

        // Reduced delay between monitoramentos for faster completion
        await delay(600);

      } catch (error) {
        errorCount++;
        console.error(`Error on ${mon.id}:`, error);
      }
    }

    const nowIso = new Date().toISOString();
    const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    // Correct hasMore logic
    const hasMore = (offset + processedCount) < total;
    const nextOffset = hasMore ? offset + processedCount : null;

    // Sort tribunais by resultados descending
    allTribunaisStats.sort((a, b) => b.resultados - a.resultados);

    // Load current config metadata to accumulate a full "run" across multiple batches
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

    type DjenRun = {
      run_id: string;
      started_at: string;
      totals: {
        processados: number;
        novas: number;
        descartadas: number;
        duplicatas: number;
        erros: number;
        duracao_s: number;
        total_paginas: number;
        total_resultados: number;
      };
      tribunais: Record<string, TribunalStats>;
    };

    let run: DjenRun | null = (currentMeta?.djen_run as DjenRun) ?? null;
    if (offset === 0 || !run || typeof run !== 'object' || !run.run_id || !run.totals || !run.tribunais) {
      run = {
        run_id: crypto.randomUUID(),
        started_at: nowIso,
        totals: {
          processados: 0,
          novas: 0,
          descartadas: 0,
          duplicatas: 0,
          erros: 0,
          duracao_s: 0,
          total_paginas: 0,
          total_resultados: 0,
        },
        tribunais: {},
      };
    }

    // Accumulate totals for the full run
    run.totals.processados += processedCount;
    run.totals.novas += totalNovas;
    run.totals.descartadas += totalDescartadas;
    run.totals.duplicatas += totalDuplicatas;
    run.totals.erros += errorCount;
    run.totals.duracao_s += duration;
    run.totals.total_paginas += totalPaginas;
    run.totals.total_resultados += totalResultados;

    // Accumulate tribunal breakdown for the full run
    for (const ts of allTribunaisStats) {
      const tribunalKey = ts.tribunal ?? 'TODOS';
      const existing = run.tribunais[tribunalKey];
      run.tribunais[tribunalKey] = existing
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

    const updatedMeta: Record<string, any> = {
      ...currentMeta,
      last_run: nowIso,
      offset_processado: offset,
      processados: processedCount,
      novas: totalNovas,
      descartadas: totalDescartadas,
      duplicatas: totalDuplicatas,
      erros: errorCount,
      duracao_s: duration,
      has_more: hasMore,
      next_offset: nextOffset,
      total_paginas: totalPaginas,
      total_resultados: totalResultados,
      tribunais_stats: allTribunaisStats.slice(0, 20),
      djen_run: hasMore ? run : null,
      last_complete_run: hasMore ? (currentMeta?.last_complete_run ?? null) : nowIso,
    };

    // Update config (only set ultima_execucao when the run starts)
    const updatePayload: Record<string, any> = {
      metadata: updatedMeta,
    };
    if (offset === 0) {
      updatePayload.ultima_execucao = nowIso;
    }

    await supabase
      .from('configuracoes_monitoramento')
      .update(updatePayload)
      .eq('tipo', 'djen');

    // Persist a single report for the full run when it completes (hasMore=false)
    if (!hasMore && run) {
      const tribunaisFinal = Object.values(run.tribunais).sort((a, b) => b.resultados - a.resultados);

      await supabase.from('historico_monitoramento').insert({
        tipo: 'djen',
        executado_em: nowIso,
        processos_verificados: run.totals.processados,
        novos_andamentos: run.totals.novas,
        processos_com_novos: run.totals.novas,
        erros: run.totals.erros,
        detalhes: {
          run_id: run.run_id,
          started_at: run.started_at,
          descartadas: run.totals.descartadas,
          duplicatas: run.totals.duplicatas,
          duracao_s: run.totals.duracao_s,
          total_paginas: run.totals.total_paginas,
          total_resultados: run.totals.total_resultados,
          tribunais_stats: tribunaisFinal.slice(0, 30),
        },
      });
    }

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
        nextOffset,
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
