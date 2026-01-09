import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Single optimized endpoint
const PJE_COMUNICA_ENDPOINT = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const BATCH_SIZE = 50; // Increased batch for parallel processing
const CONCURRENT_REQUESTS = 10; // Number of parallel requests
const PAGE_SIZE = 100; // Max page size
const MAX_PAGES = 2; // Limit pages per process

// Browser-like headers
const browserHeaders = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Origin': 'https://comunica.pje.jus.br',
  'Referer': 'https://comunica.pje.jus.br/',
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
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

// Detect audiência in publication content
interface AudienciaInfo {
  dataAudiencia: string | null;
  hora: string | null;
  tipoAudiencia: string | null;
  localAudiencia: string | null;
  contexto: string;
}

function detectAudiencia(conteudo: string): AudienciaInfo | null {
  const conteudoLower = conteudo.toLowerCase();
  
  const audienciaTerms = ['audiência', 'audiencia', 'sessão de julgamento', 'pauta de julgamento'];
  const hasAudiencia = audienciaTerms.some(term => conteudoLower.includes(term));
  if (!hasAudiencia) return null;
  
  let contexto = '';
  for (const term of audienciaTerms) {
    const index = conteudoLower.indexOf(term);
    if (index !== -1) {
      const start = Math.max(0, index - 100);
      const end = Math.min(conteudo.length, index + term.length + 200);
      contexto = (start > 0 ? '...' : '') + conteudo.slice(start, end) + (end < conteudo.length ? '...' : '');
      break;
    }
  }
  
  let dataAudiencia: string | null = null;
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = contexto.match(pattern);
    if (match) {
      if (match[2] && isNaN(parseInt(match[2]))) {
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
  
  let hora: string | null = null;
  const horaMatch = contexto.match(/(\d{1,2})[h:](\d{2})/);
  if (horaMatch) {
    hora = `${horaMatch[1].padStart(2, '0')}:${horaMatch[2]}`;
  }
  
  let tipoAudiencia: string | null = null;
  const tipoMatch = conteudo.match(/audiência\s+de\s+(conciliação|instrução|julgamento|instrução e julgamento|una|inicial|custódia)/i);
  if (tipoMatch) {
    tipoAudiencia = tipoMatch[1];
  }
  
  let localAudiencia: string | null = null;
  const localMatch = conteudo.match(/(?:local|sala|forum|fórum)[\s:]+([^,\n]{10,60})/i);
  if (localMatch) {
    localAudiencia = localMatch[1].trim();
  }
  
  return { dataAudiencia, hora, tipoAudiencia, localAudiencia, contexto };
}

// Detect intimação in publication content
interface IntimacaoInfo {
  tipoIntimacao: string | null;
  prazoDias: number | null;
  contexto: string;
  hashDedup: string;
}

// Calcular primeiro dia útil considerando recesso forense (20/dez a 6/jan)
function calcularPrimeiroDiaUtil(dataBase: Date, diasUteisAdicionar: number = 0): Date {
  const resultado = new Date(dataBase);
  
  // Função para verificar se está no recesso
  const estaNoRecesso = (d: Date): boolean => {
    const mes = d.getMonth(); // 0-11
    const dia = d.getDate();
    return (mes === 11 && dia >= 20) || (mes === 0 && dia <= 6);
  };
  
  // Função para avançar para próximo dia útil
  const proximoDiaUtil = (d: Date): Date => {
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    if (estaNoRecesso(d)) {
      d.setMonth(0); // Janeiro
      d.setDate(7);
      if (d.getMonth() === 11) d.setFullYear(d.getFullYear() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
    }
    return d;
  };
  
  // Ajustar data base para dia útil
  proximoDiaUtil(resultado);
  
  // Adicionar dias úteis
  let contador = 0;
  while (contador < diasUteisAdicionar) {
    resultado.setDate(resultado.getDate() + 1);
    proximoDiaUtil(resultado);
    contador++;
  }
  
  return resultado;
}

// Gerar hash MD5 simples para deduplicação
function generateDedupHash(processoNumero: string, tipoIntimacao: string, conteudo: string): string {
  const str = `${processoNumero}|${tipoIntimacao}|${conteudo.slice(0, 500)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function detectIntimacao(conteudo: string, processoNumero: string): IntimacaoInfo | null {
  const conteudoLower = conteudo.toLowerCase();
  
  const intimacaoTerms = ['intimação', 'intimacao', 'intima-se', 'fica intimado', 'prazo de'];
  const hasIntimacao = intimacaoTerms.some(term => conteudoLower.includes(term));
  if (!hasIntimacao) return null;
  
  let contexto = '';
  for (const term of intimacaoTerms) {
    const index = conteudoLower.indexOf(term);
    if (index !== -1) {
      const start = Math.max(0, index - 50);
      const end = Math.min(conteudo.length, index + term.length + 150);
      contexto = (start > 0 ? '...' : '') + conteudo.slice(start, end) + (end < conteudo.length ? '...' : '');
      break;
    }
  }
  
  let prazoDias: number | null = null;
  const prazoPatterns = [/prazo\s+de\s+(\d+)\s*(?:dias?|d)/i, /(\d+)\s*dias?\s+(?:úteis|uteis)/i];
  
  for (const pattern of prazoPatterns) {
    const match = contexto.match(pattern);
    if (match) {
      prazoDias = parseInt(match[1]);
      break;
    }
  }
  
  let tipoIntimacao: string | null = null;
  if (conteudoLower.includes('manifestar')) tipoIntimacao = 'Manifestação';
  else if (conteudoLower.includes('recurso')) tipoIntimacao = 'Recurso';
  else if (conteudoLower.includes('contestar') || conteudoLower.includes('contestação')) tipoIntimacao = 'Contestação';
  else if (conteudoLower.includes('pagamento') || conteudoLower.includes('pagar')) tipoIntimacao = 'Pagamento';
  else if (conteudoLower.includes('cumprimento')) tipoIntimacao = 'Cumprimento de Sentença';
  else tipoIntimacao = 'Intimação';
  
  const hashDedup = generateDedupHash(processoNumero, tipoIntimacao || '', conteudo);
  
  return { tipoIntimacao, prazoDias, contexto, hashDedup };
}

// Fast single-request search per process
async function searchDJENByProcesso(
  numeroProcesso: string,
  dataInicio?: string,
  dataFim?: string,
): Promise<any[]> {
  const params = new URLSearchParams();
  params.append('texto', numeroProcesso);
  params.append('pagina', '0');
  params.append('tamanhoPagina', PAGE_SIZE.toString());
  if (dataInicio) params.append('dataDisponibilizacaoInicio', dataInicio);
  if (dataFim) params.append('dataDisponibilizacaoFim', dataFim);

  const url = `${PJE_COMUNICA_ENDPOINT}?${params.toString()}`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: browserHeaders,
    });

    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
      return [];
    }

    const data = await response.json();
    const items = data.items || data.content || data.comunicacoes || [];
    
    // If there's more pages and we got a full page, fetch one more
    if (Array.isArray(items) && items.length === PAGE_SIZE && MAX_PAGES > 1) {
      const params2 = new URLSearchParams(params);
      params2.set('pagina', '1');
      const url2 = `${PJE_COMUNICA_ENDPOINT}?${params2.toString()}`;
      
      try {
        const response2 = await fetchWithTimeout(url2, { method: 'GET', headers: browserHeaders });
        if (response2.ok) {
          const data2 = await response2.json();
          const items2 = data2.items || data2.content || data2.comunicacoes || [];
          if (Array.isArray(items2)) {
            items.push(...items2);
          }
        }
      } catch {
        // Ignore second page errors
      }
    }

    return Array.isArray(items) ? items : [];
  } catch (error) {
    // Timeout or network error - skip silently
    return [];
  }
}

// Process a batch of processes in parallel
async function processProcessosBatch(
  processos: Array<{ id: string; numero: string }>,
  dataInicio?: string,
  dataFim?: string,
  supabase?: any,
): Promise<{
  totalNovas: number;
  totalDuplicadas: number;
  processosComNovas: number;
  processosComResultados: number;
}> {
  let totalNovas = 0;
  let totalDuplicadas = 0;
  let processosComNovas = 0;
  let processosComResultados = 0;

  // Process in chunks of CONCURRENT_REQUESTS
  for (let i = 0; i < processos.length; i += CONCURRENT_REQUESTS) {
    const chunk = processos.slice(i, i + CONCURRENT_REQUESTS);
    
    // Parallel fetch for this chunk
    const results = await Promise.all(
      chunk.map(async (processo) => {
        const publicacoes = await searchDJENByProcesso(processo.numero, dataInicio, dataFim);
        return { processo, publicacoes };
      })
    );

    // Process results
    for (const { processo, publicacoes } of results) {
      if (publicacoes.length > 0) {
        processosComResultados++;
      }

      let novasDoProcesso = 0;
      const seenHashes = new Set<string>();

      for (const pub of publicacoes) {
        const conteudo = pub.texto ?? pub.teor ?? pub.conteudo ?? pub.conteudoPublicacao ?? pub.resumo ?? '';
        if (!conteudo || typeof conteudo !== 'string') continue;

        const dataPublicacao = pub.dataPublicacao || pub.dataDisponibilizacao || pub.data || null;
        const hashConteudo = generateHash(`${processo.numero}-${dataPublicacao}-${conteudo.slice(0, 500)}`);

        if (seenHashes.has(hashConteudo)) {
          totalDuplicadas++;
          continue;
        }
        seenHashes.add(hashConteudo);

        // Upsert to avoid race conditions - onConflict ignores if already exists
        const { data: inserted, error: insertError } = await supabase
          .from('publicacoes_djen_processos')
          .upsert({
            processo_id: processo.id,
            processo_numero: processo.numero,
            hash_conteudo: hashConteudo,
            data_publicacao: dataPublicacao,
            conteudo: conteudo,
            fonte: 'pje_comunica',
          }, { onConflict: 'hash_conteudo', ignoreDuplicates: true })
          .select('id')
          .single();

        // If no data returned, it's a duplicate
        if (insertError || !inserted) {
          totalDuplicadas++;
          continue;
        }

        totalNovas++;
        novasDoProcesso++;

        // Detect audiencias and intimacoes asynchronously
        const audienciaInfo = detectAudiencia(conteudo);
        if (audienciaInfo) {
          supabase.from('audiencias_detectadas').insert({
            processo_id: processo.id,
            processo_numero: processo.numero,
            publicacao_id: inserted.id,
            data_audiencia: audienciaInfo.dataAudiencia,
            hora: audienciaInfo.hora,
            tipo_audiencia: audienciaInfo.tipoAudiencia,
            local_audiencia: audienciaInfo.localAudiencia,
            contexto: audienciaInfo.contexto,
            conteudo_publicacao: conteudo,
            origem: 'monitoramento_djen_processos',
            status: 'pendente',
          }).then(() => {});
        }

        const intimacaoInfo = detectIntimacao(conteudo, processo.numero);
        if (intimacaoInfo) {
          // Calcular datas corretamente
          // data_disponibilizacao = data da API (quando foi publicado no DJEN)
          // data_intimacao = primeiro dia útil seguinte (considerando recesso)
          const dataDisponibilizacao = dataPublicacao ? new Date(dataPublicacao) : new Date();
          const dataIntimacao = calcularPrimeiroDiaUtil(new Date(dataDisponibilizacao.getTime() + 86400000)); // +1 dia
          
          let dataLimite: string | null = null;
          if (intimacaoInfo.prazoDias) {
            const limite = calcularPrimeiroDiaUtil(dataIntimacao, intimacaoInfo.prazoDias);
            dataLimite = limite.toISOString().split('T')[0];
          }
          
          // Usar upsert com hash_dedup para evitar duplicatas
          supabase.from('intimacoes_detectadas')
            .upsert({
              processo_id: processo.id,
              processo_numero: processo.numero,
              tipo_intimacao: intimacaoInfo.tipoIntimacao,
              prazo_dias: intimacaoInfo.prazoDias,
              data_disponibilizacao: dataDisponibilizacao.toISOString(),
              data_intimacao: dataIntimacao.toISOString(),
              data_limite: dataLimite,
              contexto: intimacaoInfo.contexto,
              conteudo_publicacao: conteudo,
              origem: 'monitoramento_djen_processos',
              status: 'pendente',
              hash_dedup: intimacaoInfo.hashDedup,
            }, { onConflict: 'hash_dedup', ignoreDuplicates: true })
            .then(() => {});
        }
      }

      if (novasDoProcesso > 0) {
        processosComNovas++;
      }
    }

    // Small delay between chunks to avoid rate limiting
    if (i + CONCURRENT_REQUESTS < processos.length) {
      await delay(100);
    }
  }

  return { totalNovas, totalDuplicadas, processosComNovas, processosComResultados };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let dataInicio: string | undefined;
    let dataFim: string | undefined;
    let continuarDe: number | undefined;
    let completeRun = false;

    try {
      const body = await req.json();
      dataInicio = body.dataInicio;
      dataFim = body.dataFim;
      continuarDe = body.continuarDe;
      completeRun = body.completeRun === true;
    } catch {
      // No body
    }

    // Default to today
    if (!dataInicio && !dataFim) {
      const hoje = new Date().toISOString().split('T')[0];
      dataInicio = hoje;
      dataFim = hoje;
    }

    console.log(`[DJEN Processos] Início: ${dataInicio} a ${dataFim} | completeRun=${completeRun}`);

    // Get config
    const { data: config } = await supabase
      .from('configuracoes_monitoramento')
      .select('*')
      .eq('tipo', 'djen_processos')
      .single();

    // Count total (using monitorar_djen column)
    const { count: totalProcessos } = await supabase
      .from('processos')
      .select('*', { count: 'exact', head: true })
      .in('status', ['ativo', 'pendente', 'urgente'])
      .eq('monitorar_djen', true);

    const meta: any = config?.metadata || {};
    const metaOffset = typeof meta?.next_offset === 'number' ? meta.next_offset : 0;

    // Se for execução completa (cron), continuar do offset salvo no metadata
    const offset = (typeof continuarDe === 'number' ? continuarDe : (completeRun ? metaOffset : 0));

    // Get batch (using monitorar_djen column)
    const { data: processos, error: processosError } = await supabase
      .from('processos')
      .select('id, numero')
      .in('status', ['ativo', 'pendente', 'urgente'])
      .eq('monitorar_djen', true)
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (processosError) {
      throw new Error(`Erro ao buscar processos: ${processosError.message}`);
    }

    if (!processos || processos.length === 0) {
      // Complete cycle
      if (config) {
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            ultima_execucao: new Date().toISOString(),
            metadata: { 
              ...(config.metadata || {}), 
              last_complete_run: new Date().toISOString(),
              next_offset: 0 
            }
          })
          .eq('tipo', 'djen_processos');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Ciclo completo', 
          processados: 0,
          totalProcessos: totalProcessos || 0,
          concluido: true,
          tempoMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[DJEN Processos] Processando ${processos.length} processos (offset: ${offset})`);

    // Process in parallel
    const { totalNovas, totalDuplicadas, processosComNovas, processosComResultados } = 
      await processProcessosBatch(processos, dataInicio, dataFim, supabase);

    // Update next offset
    const nextOffset = offset + processos.length;
    const hasMore = nextOffset < (totalProcessos || 0);

    if (config) {
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          ultima_execucao: new Date().toISOString(),
          metadata: { 
            ...(config.metadata || {}), 
            next_offset: hasMore ? nextOffset : 0,
            last_batch_processos: processos.length,
            last_batch_novas: totalNovas,
          }
        })
        .eq('tipo', 'djen_processos');
    }

    // Log history
    await supabase.from('historico_monitoramento').insert({
      tipo: 'djen_processos',
      processos_verificados: processos.length,
      processos_com_novos: processosComNovas,
      novos_andamentos: totalNovas,
      erros: 0,
      detalhes: {
        offset,
        duplicadas: totalDuplicadas,
        comResultados: processosComResultados,
        dataInicio,
        dataFim,
        tempoMs: Date.now() - startTime,
      }
    });

    const tempoMs = Date.now() - startTime;
    console.log(`[DJEN Processos] Lote: ${totalNovas} novas, ${totalDuplicadas} dup, ${tempoMs}ms, hasMore: ${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: processos.length,
        novasPublicacoes: totalNovas,
        duplicadas: totalDuplicadas,
        processosComNovas,
        processosComResultados,
        totalProcessos: totalProcessos || 0,
        hasMore,
        nextOffset: hasMore ? nextOffset : 0,
        tempoMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DJEN Processos] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, tempoMs: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
