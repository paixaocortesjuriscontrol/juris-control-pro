import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Single optimized endpoint
const PJE_COMUNICA_ENDPOINT = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const BATCH_SIZE = 50; // Increased batch for parallel processing
const CONCURRENT_REQUESTS = 5; // Reduced to avoid rate limiting
const PAGE_SIZE = 100; // Max page size
const MAX_PAGES = 2; // Limit pages per process
const BASE_DELAY = 500; // Base delay between batches

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

// Jina Reader proxy (only fallback - Bright Data removed as too expensive)
const JINA_READER_URL = 'https://r.jina.ai';
const JINA_API_KEY = Deno.env.get('JINA_API_KEY') || '';

// Bright Data removed - too expensive. Using only Jina as fallback.

async function fetchJsonViaJina(url: string): Promise<any | null> {
  if (!JINA_API_KEY) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);

  try {
    const jinaUrl = `${JINA_READER_URL}/${url}`;

    const resp = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JINA_API_KEY}`,
        'Accept': 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      console.log(`[DJEN Processos] Jina proxy error ${resp.status}: ${t.slice(0, 200)}`);
      return null;
    }

    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch {
      console.log('[DJEN Processos] Jina proxy returned non-JSON');
      return null;
    }
  } catch (e) {
    console.log('[DJEN Processos] Jina proxy fetch failed:', e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Unified proxy fetch: uses Jina as only fallback (Bright Data removed - too expensive)
async function fetchViaProxy(url: string): Promise<any | null> {
  if (JINA_API_KEY) {
    console.log('[DJEN Processos] Trying Jina proxy fallback...');
    return await fetchJsonViaJina(url);
  }
  return null;
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, baseDelay = 1500): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      
      // Rate limited - wait and retry
      if (response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`[DJEN Processos] Rate limited (429). Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await delay(waitTime);
        continue;
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`[DJEN Processos] Fetch error. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await delay(waitTime);
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
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

function normalizeConteudo(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Verifica se já existe tarefa similar para evitar duplicatas
async function verificarTarefaExistente(
  supabase: any,
  processoId: string,
  responsavelId: string,
  titulo: string
): Promise<boolean> {
  // Busca tarefas com mesmo processo, responsável e título similar nos últimos 30 dias
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);
  
  const tituloBase = titulo.toLowerCase().replace(/\s+/g, ' ').trim();
  
  const { data: existentes } = await supabase
    .from('tarefas')
    .select('id, titulo')
    .eq('processo_id', processoId)
    .eq('responsavel_id', responsavelId)
    .gte('created_at', dataLimite.toISOString())
    .limit(50);
  
  if (!existentes || existentes.length === 0) return false;
  
  // Verifica se alguma tarefa existente tem título muito similar
  for (const t of existentes) {
    const tituloExistente = (t.titulo || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (tituloExistente === tituloBase) {
      console.log(`[DEDUP] Tarefa duplicada detectada: "${titulo}"`);
      return true;
    }
    // Se ambos começam com [DJEN] e têm mesmo tipo
    if (tituloBase.startsWith('[djen]') && tituloExistente.startsWith('[djen]')) {
      const numMatch = tituloBase.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
      const numExistenteMatch = tituloExistente.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
      if (numMatch && numExistenteMatch && numMatch[0] === numExistenteMatch[0]) {
        const tipoMatch = tituloBase.match(/\[(djen|andamento)\]\s*(\w+)/i);
        const tipoExistenteMatch = tituloExistente.match(/\[(djen|andamento)\]\s*(\w+)/i);
        if (tipoMatch && tipoExistenteMatch && tipoMatch[2] === tipoExistenteMatch[2]) {
          console.log(`[DEDUP] Tarefa DJEN duplicada: tipo "${tipoMatch[2]}" já existe`);
          return true;
        }
      }
    }
  }
  
  return false;
}

// Função auxiliar para criar tarefas para responsáveis do processo
// Agora segue o mesmo padrão do CriarTarefaPublicacaoDialog
async function criarTarefasParaResponsaveis(
  supabase: any,
  processoId: string,
  titulo: string,
  descricao: string,
  dataVencimento: string,
  prioridade: string,
  origem: string,
  tipoTarefa: string,
  publicacaoProcessoId?: string // ID da publicação para vincular na tabela N:N
): Promise<string[]> {
  // Buscar responsáveis do processo
  const { data: responsaveis } = await supabase
    .from('processos_responsaveis')
    .select('responsavel_id')
    .eq('processo_id', processoId);

  // Se não tem responsáveis na tabela, tenta o advogado_responsavel_id legado
  if (!responsaveis || responsaveis.length === 0) {
    const { data: processo } = await supabase
      .from('processos')
      .select('advogado_responsavel_id')
      .eq('id', processoId)
      .single();

    if (processo?.advogado_responsavel_id) {
      // Verificar duplicata antes de criar
      const jáExiste = await verificarTarefaExistente(
        supabase, processoId, processo.advogado_responsavel_id, titulo
      );
      if (jáExiste) {
        console.log(`[DEDUP] Pulando criação de tarefa duplicada para processo ${processoId}`);
        return [];
      }
      
      const { data: tarefa, error } = await supabase
        .from('tarefas')
        .insert({
          processo_id: processoId,
          responsavel_id: processo.advogado_responsavel_id,
          criado_por: processo.advogado_responsavel_id,
          titulo,
          descricao,
          data_vencimento: dataVencimento,
          prioridade,
          status: 'pendente',
          origem,
          tipo_tarefa: tipoTarefa,
        })
        .select('id')
        .single();

      if (!error && tarefa) {
        console.log(`Created task ${tarefa.id} for legacy responsible`);
        
        // Vincular tarefa à publicação na tabela N:N (igual ao CriarTarefaPublicacaoDialog)
        if (publicacaoProcessoId) {
          await supabase
            .from('tarefas_publicacoes_processos')
            .insert({
              tarefa_id: tarefa.id,
              publicacao_processo_id: publicacaoProcessoId,
            });
        }
        
        return [tarefa.id];
      }
    }
    return [];
  }

  // Criar tarefa para cada responsável
  const tarefaIds: string[] = [];
  for (const resp of responsaveis) {
    // Verificar duplicata antes de criar
    const jáExiste = await verificarTarefaExistente(
      supabase, processoId, resp.responsavel_id, titulo
    );
    if (jáExiste) {
      console.log(`[DEDUP] Pulando tarefa duplicada para responsável ${resp.responsavel_id}`);
      continue;
    }
    
    const { data: tarefa, error } = await supabase
      .from('tarefas')
      .insert({
        processo_id: processoId,
        responsavel_id: resp.responsavel_id,
        criado_por: resp.responsavel_id,
        titulo,
        descricao,
        data_vencimento: dataVencimento,
        prioridade,
        status: 'pendente',
        origem,
        tipo_tarefa: tipoTarefa,
      })
      .select('id')
      .single();

    if (!error && tarefa) {
      tarefaIds.push(tarefa.id);
      
      // Vincular tarefa à publicação na tabela N:N (igual ao CriarTarefaPublicacaoDialog)
      if (publicacaoProcessoId) {
        await supabase
          .from('tarefas_publicacoes_processos')
          .insert({
            tarefa_id: tarefa.id,
            publicacao_processo_id: publicacaoProcessoId,
          });
      }
    }
  }

  if (tarefaIds.length > 0) {
    console.log(`Created ${tarefaIds.length} tasks for process ${processoId}`);
  }
  return tarefaIds;
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

// Fast single-request search per process with retry
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
    // Use fetchWithRetry for better resilience
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: browserHeaders,
    }, 2, 1000); // 2 retries, 1s base delay

    const contentType = response.headers.get('content-type') || '';

    let data: any | null = null;

    if (!response.ok || contentType.includes('text/html')) {
      // Fallback via proxy when API blocks
      console.log('[DJEN Processos] Blocked by API, trying proxy fallback...');
      data = await fetchViaProxy(url);

      if (!data) return [];
    } else {
      data = await response.json();
    }

    const items = data.items || data.content || data.comunicacoes || [];

    // If there's more pages and we got a full page, fetch one more
    if (Array.isArray(items) && items.length === PAGE_SIZE && MAX_PAGES > 1) {
      const params2 = new URLSearchParams(params);
      params2.set('pagina', '1');
      const url2 = `${PJE_COMUNICA_ENDPOINT}?${params2.toString()}`;

      try {
        // Small delay before second page to avoid rate limit
        await delay(300);
        
        const response2 = await fetchWithRetry(url2, { method: 'GET', headers: browserHeaders }, 2, 1000);
        const contentType2 = response2.headers.get('content-type') || '';

        let data2: any | null = null;

        if (!response2.ok || contentType2.includes('text/html')) {
          data2 = await fetchViaProxy(url2);
        } else {
          data2 = await response2.json();
        }

        if (data2) {
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
    // Timeout or network error - skip silently after retries exhausted
    console.log(`[DJEN Processos] Failed to fetch for ${numeroProcesso}:`, error);
    return [];
  }
}

// Process a batch of processes in parallel
async function processProcessosBatch(
  processos: Array<{ id: string; numero: string; status?: string; coordenacao_id?: string }>,
  dataInicio?: string,
  dataFim?: string,
  supabase?: any,
): Promise<{
  totalNovas: number;
  totalDuplicadas: number;
  processosComNovas: number;
  processosComResultados: number;
  alertasProcessosNaoAtivos: number;
}> {
  let totalNovas = 0;
  let totalDuplicadas = 0;
  let processosComNovas = 0;
  let processosComResultados = 0;
  let alertasProcessosNaoAtivos = 0;
  
  // Status considerados "não-ativos" para gerar alerta especial
  const statusNaoAtivos = ['arquivado', 'arquivado_definitivamente', 'arquivado_provisoriamente', 'suspenso', 'encerrado'];

  // Process in chunks of CONCURRENT_REQUESTS with delays between chunks
  for (let i = 0; i < processos.length; i += CONCURRENT_REQUESTS) {
    const chunk = processos.slice(i, i + CONCURRENT_REQUESTS);
    
    // Add delay between chunks to avoid rate limiting (except first chunk)
    if (i > 0) {
      await delay(BASE_DELAY);
    }
    
    // Parallel fetch for this chunk
    const results = await Promise.all(
      chunk.map(async (processo, idx) => {
        // Stagger requests within chunk to avoid burst
        if (idx > 0) {
          await delay(idx * 100);
        }
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

        // Data de disponibilização (dia que saiu no sistema) vs publicação (dia oficial do diário)
        // A API PJE Comunica retorna os campos padrão: dataDisponibilizacao e dataPublicacao
        // Mas também pode vir dentro de 'comunicacao' ou com variações de nome
        const pubObj = pub.comunicacao || pub;
        let dataDisponibilizacao = 
          pubObj.dataDisponibilizacao || 
          pubObj.dataDJe || 
          pubObj.dtDisponibilizacao || 
          pubObj.dataDisp ||
          pubObj.data_disponibilizacao ||
          null;
        let dataPublicacao = 
          pubObj.dataPublicacao || 
          pubObj.dataJornal || 
          pubObj.dtPublicacao || 
          pubObj.data || 
          pubObj.data_publicacao ||
          null;
        
        // Log para debug quando datas não são encontradas
        if (!dataDisponibilizacao && !dataPublicacao) {
          console.log(`[DJEN Processos] No dates found for pub. Keys: ${Object.keys(pubObj).join(', ')}`);
        }
        
        // Inferir datas faltantes (típico: disponibilização = publicação - 1 dia)
        if (!dataDisponibilizacao && dataPublicacao) {
          try {
            const pubDate = new Date(dataPublicacao);
            if (!isNaN(pubDate.getTime())) {
              pubDate.setDate(pubDate.getDate() - 1);
              dataDisponibilizacao = pubDate.toISOString().split('T')[0];
            }
          } catch {
            // Ignore date parsing errors
          }
        } else if (dataDisponibilizacao && !dataPublicacao) {
          try {
            const dispDate = new Date(dataDisponibilizacao);
            if (!isNaN(dispDate.getTime())) {
              dispDate.setDate(dispDate.getDate() + 1);
              dataPublicacao = dispDate.toISOString().split('T')[0];
            }
          } catch {
            // Ignore date parsing errors
          }
        }
        
        // Fallback: usar created_at do registro como última opção
        if (!dataDisponibilizacao && !dataPublicacao) {
          const hoje = new Date().toISOString().split('T')[0];
          dataDisponibilizacao = hoje;
          dataPublicacao = hoje;
          console.log(`[DJEN Processos] Using today as fallback date for processo ${processo.numero}`);
        }
        
        // Deduplicação robusta: normaliza HTML/whitespace para evitar duplicatas com pequenas variações.
        // Importante: muitos registros chegam sem data_publicacao/data_disponibilizacao; nesse caso,
        // não usamos o intervalo (dataInicio/dataFim) como chave, para não re-gerar duplicatas a cada execução.
        const conteudoNorm = normalizeConteudo(conteudo);
        const dataKey = (dataPublicacao || dataDisponibilizacao || '').toString();
        const hashConteudo = generateHash(`${processo.numero}|${dataKey}|${conteudoNorm.slice(0, 2000)}`);

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
            data_disponibilizacao: dataDisponibilizacao,
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

        // Detect audiencias and intimacoes - criar tarefas para responsáveis
        const audienciaInfo = detectAudiencia(conteudo);
        if (audienciaInfo) {
          const { data: insertedAudiencia } = await supabase.from('audiencias_detectadas').insert({
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
          }).select('id').single();

          // Criar tarefas para responsáveis do processo
          if (insertedAudiencia) {
            // Calcular data de vencimento (2 dias antes da audiência)
            let dataVencimentoTarefa: string;
            if (audienciaInfo.dataAudiencia) {
              const dataAud = new Date(audienciaInfo.dataAudiencia);
              dataAud.setDate(dataAud.getDate() - 2);
              dataVencimentoTarefa = dataAud.toISOString().split('T')[0];
            } else {
              const hoje = new Date();
              hoje.setDate(hoje.getDate() + 5);
              dataVencimentoTarefa = hoje.toISOString().split('T')[0];
            }

            const tarefaIds = await criarTarefasParaResponsaveis(
              supabase,
              processo.id,
              `[DJEN] Audiência ${audienciaInfo.tipoAudiencia || ''} - ${processo.numero}`,
              `Audiência detectada no DJEN.\n\nData: ${audienciaInfo.dataAudiencia || 'A definir'}\nHora: ${audienciaInfo.hora || 'A definir'}\n\nContexto:\n${audienciaInfo.contexto || ''}`,
              dataVencimentoTarefa,
              'alta',
              'monitoramento_djen_processos',
              'Audiência', // tipo_tarefa
              inserted.id // publicacao_processo_id para vincular na tabela N:N
            );

            // Vincular tarefa à audiência
            if (tarefaIds.length > 0) {
              await supabase
                .from('audiencias_detectadas')
                .update({ tarefa_id: tarefaIds[0] })
                .eq('id', insertedAudiencia.id);
            }
          }
        }

        const intimacaoInfo = detectIntimacao(conteudo, processo.numero);
        if (intimacaoInfo) {
          // Calcular datas corretamente
          const dataDisponibilizacao = dataPublicacao ? new Date(dataPublicacao) : new Date();
          const dataIntimacao = calcularPrimeiroDiaUtil(new Date(dataDisponibilizacao.getTime() + 86400000));
          
          let dataLimite: string | null = null;
          if (intimacaoInfo.prazoDias) {
            const limite = calcularPrimeiroDiaUtil(dataIntimacao, intimacaoInfo.prazoDias);
            dataLimite = limite.toISOString().split('T')[0];
          }
          
          // Usar upsert com hash_dedup para evitar duplicatas
          const { data: insertedIntimacao } = await supabase.from('intimacoes_detectadas')
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
            .select('id')
            .single();

          // Criar tarefas para responsáveis do processo (se não é duplicata)
          if (insertedIntimacao) {
            const dataVencimentoTarefa = dataLimite || 
              new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const tarefaIds = await criarTarefasParaResponsaveis(
              supabase,
              processo.id,
              `[DJEN] ${intimacaoInfo.tipoIntimacao || 'Intimação'} - ${processo.numero}`,
              `Intimação detectada no DJEN.\n\nPrazo: ${intimacaoInfo.prazoDias ? intimacaoInfo.prazoDias + ' dias' : 'Verificar'}\nData Limite: ${dataLimite || 'A calcular'}\n\nContexto:\n${intimacaoInfo.contexto || ''}`,
              dataVencimentoTarefa,
              intimacaoInfo.prazoDias && intimacaoInfo.prazoDias <= 5 ? 'urgente' : 'alta',
              'monitoramento_djen_processos',
              'Intimação', // tipo_tarefa
              inserted.id // publicacao_processo_id para vincular na tabela N:N
            );

            // Vincular tarefa à intimação
            if (tarefaIds.length > 0) {
              await supabase
                .from('intimacoes_detectadas')
                .update({ tarefa_id: tarefaIds[0] })
                .eq('id', insertedIntimacao.id);
            }
          }
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

  return { totalNovas, totalDuplicadas, processosComNovas, processosComResultados, alertasProcessosNaoAtivos };
}

// Helper para atualizar execucoes_agendadas com progresso
async function updateExecucaoProgress(
  supabase: any,
  execucaoId: string | undefined,
  data: {
    status?: string;
    registros_processados?: number;
    registros_encontrados?: number;
    total_lotes?: number;
    detalhes?: Record<string, any>;
    finalizado_em?: string;
  }
) {
  if (!execucaoId) return;
  // NOTE: execucoes_agendadas não possui coluna updated_at.
  // Se enviarmos updated_at aqui, o update falha silenciosamente e o progresso nunca aparece no frontend.
  const { error } = await supabase
    .from('execucoes_agendadas')
    .update({
      ...data,
    })
    .eq('id', execucaoId);

  if (error) {
    console.error('Error updating execucoes_agendadas progress:', error);
  }
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
    let scheduled = false;
    let continued = false;
    let execucaoId: string | undefined;

    try {
      const body = await req.json();
      dataInicio = body.dataInicio;
      dataFim = body.dataFim;
      continuarDe = body.continuarDe;
      completeRun = body.completeRun === true;
      scheduled = body.scheduled === true;
      continued = body.continued === true;
      execucaoId = body.execucaoId;
    } catch {
      // No body
    }

    // Default to today
    if (!dataInicio && !dataFim) {
      const hoje = new Date().toISOString().split('T')[0];
      dataInicio = hoje;
      dataFim = hoje;
    }

    console.log(`[DJEN Processos] Início: ${dataInicio} a ${dataFim} | completeRun=${completeRun} | continued=${continued} | scheduled=${scheduled} | execucaoId=${execucaoId}`);

    // Get config
    const { data: config } = await supabase
      .from('configuracoes_monitoramento')
      .select('*')
      .eq('tipo', 'djen_processos')
      .single();

    // Count total - agora inclui todos os processos com monitorar_djen=true (mesmo não-ativos)
    const { count: totalProcessos } = await supabase
      .from('processos')
      .select('*', { count: 'exact', head: true })
      .eq('monitorar_djen', true);

    // Regra para execução completa:
    // - primeira chamada (cron/manual completeRun) começa do 0
    // - continuações sempre passam continuarDe
    const meta: any = config?.metadata || {};

    const offset = (typeof continuarDe === 'number')
      ? continuarDe
      : (completeRun ? 0 : 0);

    // Get batch - agora inclui todos os processos com monitorar_djen=true
    // Processos não-ativos com monitoramento ativo terão alerta especial
    const { data: processos, error: processosError } = await supabase
      .from('processos')
      .select('id, numero, status, coordenacao_id')
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
              next_offset: 0,
            },
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
          // Só marca "ultima_execucao" quando começa um ciclo completo (offset 0)
          ultima_execucao: offset === 0 ? new Date().toISOString() : config.ultima_execucao,
          metadata: {
            ...(config.metadata || {}),
            next_offset: hasMore ? nextOffset : 0,
            last_batch_processos: processos.length,
            last_batch_novas: totalNovas,
            last_batch_offset: offset,
            last_batch_tempo_ms: Date.now() - startTime,
          },
        })
        .eq('tipo', 'djen_processos');
    }

    // Log history (lote)
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
      },
    });

    const tempoMs = Date.now() - startTime;
    console.log(`[DJEN Processos] Lote: ${totalNovas} novas, ${totalDuplicadas} dup, ${tempoMs}ms, hasMore: ${hasMore}`);

    // Atualizar progresso em tempo real na tabela execucoes_agendadas
    const progressPercentage = (totalProcessos || 0) > 0 ? Math.min(100, Math.round((nextOffset / (totalProcessos || 1)) * 100)) : 0;
    await updateExecucaoProgress(supabase, execucaoId, {
      status: hasMore ? 'executando' : 'concluido',
      registros_processados: nextOffset,
      registros_encontrados: totalNovas,
      total_lotes: totalProcessos || 0,
      detalhes: {
        progress: {
          current: nextOffset,
          total: totalProcessos || 0,
          percentage: progressPercentage,
        },
        duplicadas: totalDuplicadas,
        processosComNovas,
        processosComResultados,
      },
      ...(hasMore ? {} : { finalizado_em: new Date().toISOString() }),
    });

    // Auto-continuation: garante completar todos os processos sem depender de múltiplos cron jobs.
    if (completeRun && hasMore) {
      // CANCELAMENTO PERSISTENTE: verificar flag antes de disparar próximo lote
      const { data: freshConfig } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen_processos')
        .maybeSingle();

      const wasCancelled = (freshConfig?.metadata as any)?.cancelado === true;

      if (wasCancelled) {
        console.log('[DJEN Processos] Cancelamento detectado, parando auto-continuação');
        const currentMeta = (freshConfig?.metadata as Record<string, any>) || {};
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: { ...currentMeta, cancelado: false, status: 'cancelado', next_offset: 0 },
          })
          .eq('tipo', 'djen_processos');
      } else {
        const nextUrl = `${supabaseUrl}/functions/v1/monitorar-djen-processos`;
        const nextBody = {
          dataInicio,
          dataFim,
          continuarDe: nextOffset,
          completeRun: true,
          scheduled: true,
          continued: true,
          execucaoId, // Propagar execucaoId para atualizar progresso
        };

        // Use anon key for internal calls (verify_jwt = false, so we just need a valid key)
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        const p = fetch(nextUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify(nextBody),
        })
          .then((r) => r.text().then((t) => console.log(`[DJEN Processos] Queued next batch offset=${nextOffset} status=${r.status} body=${t.slice(0, 200)}`)))
          .catch((e) => console.error('[DJEN Processos] Failed to queue next batch', e));

        const er = (globalThis as any).EdgeRuntime;
        if (er?.waitUntil) er.waitUntil(p);
      }
    }

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
        queuedNext: completeRun && hasMore,
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
