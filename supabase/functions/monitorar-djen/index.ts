import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getBrazilISODate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getBrazilDayUtcRange(iso: string): { startUtc: string; endUtc: string } {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const start = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { startUtc: start.toISOString(), endUtc: end.toISOString() };
  }
  const [, y, mo, d] = m;
  const start = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 3, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

// ============================================================================
// PARÂMETROS DE THROTTLING - valores padrão (serão sobrescritos pela tabela)
// ============================================================================
// Estes valores serão carregados dinamicamente da tabela parametros_monitoramento_djen
let CONFIG = {
  modo_processamento: 'semi_paralelo' as 'sequencial' | 'semi_paralelo' | 'paralelo_total',
  max_paralelo: 5,
  max_por_invocacao: 10,
  delay_entre_monitoramentos: 500,
  delay_entre_paginas: 300,
  delay_entre_tribunais: 200,
  delay_jina_api: 2000,
  soft_timeout_ms: 50000,
  finalization_buffer_ms: 10000,
  max_retries: 3,
  retry_base_delay_ms: 2000,
};

// Legacy constants - will be replaced by CONFIG values
let MAX_PER_INVOCATION = 10;
let SOFT_TIMEOUT_MS = 50_000;
let FINALIZATION_BUFFER_MS = 10_000;
let INTER_MONITORAMENTO_DELAY_MS = 500;
let INTER_TRIBUNAL_DELAY_MS = 200;
let INTER_PAGE_DELAY_MS = 300;
let JINA_MIN_INTERVAL_MS = 2000;

// Retry config: if first batch at 09:00 is empty, retry after this delay
const RETRY_DELAY_MINUTES = 15;
const MAX_RETRIES = 4;

// Outros delays
const BASE_DELAY_MS = 1500;
const STAGGER_DELAY_MS = 500;
const INTER_CANDIDATE_DELAY_MS = 1000;

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

// Jina Reader proxy (fast and cheap fallback)
const JINA_READER_URL = "https://r.jina.ai";
const JINA_API_KEY = Deno.env.get('JINA_API_KEY') || '';

// Rate limiting para Jina - MUITO conservador para evitar 429 e bloqueios
let lastJinaRequestTime = 0;

// Função para carregar parâmetros da tabela
async function loadConfigFromDatabase(supabase: any): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('parametros_monitoramento_djen')
      .select('*')
      .eq('ativo', true)
      .limit(1)
      .single();

    if (error) {
      console.log('[DJEN] Erro ao carregar parâmetros da tabela, usando valores padrão:', error.message);
      return;
    }

    if (data) {
      CONFIG = {
        modo_processamento: data.modo_processamento || 'semi_paralelo',
        max_paralelo: data.max_paralelo || 5,
        max_por_invocacao: data.max_por_invocacao || 10,
        delay_entre_monitoramentos: data.delay_entre_monitoramentos || 500,
        delay_entre_paginas: data.delay_entre_paginas || 300,
        delay_entre_tribunais: data.delay_entre_tribunais || 200,
        delay_jina_api: data.delay_jina_api || 2000,
        soft_timeout_ms: data.soft_timeout_ms || 50000,
        finalization_buffer_ms: data.finalization_buffer_ms || 10000,
        max_retries: data.max_retries || 3,
        retry_base_delay_ms: data.retry_base_delay_ms || 2000,
      };

      // Atualizar variáveis legacy
      MAX_PER_INVOCATION = CONFIG.max_por_invocacao;
      SOFT_TIMEOUT_MS = CONFIG.soft_timeout_ms;
      FINALIZATION_BUFFER_MS = CONFIG.finalization_buffer_ms;
      INTER_MONITORAMENTO_DELAY_MS = CONFIG.delay_entre_monitoramentos;
      INTER_TRIBUNAL_DELAY_MS = CONFIG.delay_entre_tribunais;
      INTER_PAGE_DELAY_MS = CONFIG.delay_entre_paginas;
      JINA_MIN_INTERVAL_MS = CONFIG.delay_jina_api;

      console.log(`[DJEN] Parâmetros carregados: modo=${CONFIG.modo_processamento}, paralelo=${CONFIG.max_paralelo}, por_invocacao=${CONFIG.max_por_invocacao}`);
    }
  } catch (e) {
    console.log('[DJEN] Erro ao carregar config:', e);
  }
}

function tryParseDjenJson(text: string): any | null {
  // 1) Direct JSON
  try {
    const data = JSON.parse(text);

    // Bright Data may wrap the response in { body: "..." }
    if (data?.body) {
      try {
        const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
        if (bodyData && (bodyData.comunicacoes || bodyData.items || Array.isArray(bodyData))) {
          return bodyData;
        }
      } catch {
        // ignore
      }
    }

    if (data && (data.comunicacoes || data.items || Array.isArray(data))) {
      return data;
    }
  } catch {
    // ignore
  }

  // 2) Sometimes Jina returns a text wrapper; try to extract the JSON object containing "comunicacoes"
  const jsonMatch = text.match(/\{[\s\S]*"comunicacoes"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // ignore
    }
  }

  return null;
}

// Bright Data removed - too expensive. Using only Jina as fallback.

// Fast Jina proxy fallback (cheap and fast - ~$0.001/request)
// Com rate limiting para evitar 429
async function fetchJsonViaJina(url: string): Promise<any | null> {
  if (!JINA_API_KEY) {
    console.log('[DJEN] JINA_API_KEY not configured');
    return null;
  }

  // Rate limiting: esperar intervalo mínimo desde última requisição
  const now = Date.now();
  const timeSinceLastRequest = now - lastJinaRequestTime;
  if (timeSinceLastRequest < JINA_MIN_INTERVAL_MS) {
    const waitTime = JINA_MIN_INTERVAL_MS - timeSinceLastRequest;
    console.log(`[DJEN] Rate limiting Jina: waiting ${waitTime}ms`);
    await delay(waitTime);
  }
  lastJinaRequestTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    console.log('[DJEN] Trying Jina proxy fallback...');
    const jinaUrl = `${JINA_READER_URL}/${url}`;

    const resp = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JINA_API_KEY}`,
        'Accept': 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    });

    if (resp.status === 429) {
      // Rate limit hit - esperar mais tempo
      const retryAfter = parseInt(resp.headers.get('retry-after') || '5', 10);
      const waitTime = Math.max(retryAfter * 1000, 5000);
      console.log(`[DJEN] Jina rate limited (429). Waiting ${waitTime}ms before retry...`);
      await delay(waitTime);
      // Tentar uma vez mais após esperar
      const retryResp = await fetch(jinaUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${JINA_API_KEY}`,
          'Accept': 'application/json, text/plain, */*',
        },
      });
      if (!retryResp.ok) {
        const t = await retryResp.text().catch(() => '');
        console.log(`[DJEN] Jina retry failed ${retryResp.status}: ${t.slice(0, 200)}`);
        return null;
      }
      const text = await retryResp.text();
      return tryParseDjenJson(text);
    }

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      console.log(`[DJEN] Jina proxy error ${resp.status}: ${t.slice(0, 200)}`);
      return null;
    }

    const text = await resp.text();
    const parsed = tryParseDjenJson(text);

    if (parsed) {
      console.log('[DJEN] ✓ Jina proxy success!');
      return parsed;
    }

    console.log('[DJEN] Jina proxy returned non-JSON:', text.slice(0, 300));
    return null;
  } catch (e) {
    console.log('[DJEN] Jina proxy fetch failed:', e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Unified proxy fetch: uses Jina as only fallback (Bright Data removed - too expensive)
async function fetchViaProxy(url: string): Promise<any | null> {
  if (JINA_API_KEY) {
    return await fetchJsonViaJina(url);
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const providedSignal = options.signal;
  let abortListener: (() => void) | null = null;

  if (providedSignal) {
    if (providedSignal.aborted) controller.abort();
    abortListener = () => controller.abort();
    try {
      providedSignal.addEventListener('abort', abortListener, { once: true });
    } catch {
      // ignore
    }
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    if (providedSignal && abortListener) {
      try {
        providedSignal.removeEventListener('abort', abortListener);
      } catch {
        // ignore
      }
    }
  }
}

async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 4, // Aumentado de 2 para 4 (igual processos)
  baseDelay = 3000, // Aumentado de 4s para 3s com exponential backoff
  timeoutMs = 15_000 
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      
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

function extractProcessoNumero(conteudo: string, explicitNumero?: string | null): string | null {
  if (explicitNumero) return explicitNumero;
  
  const patterns = [
    /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/,
    /Processo\s*(?:n[º°]?\.?\s*)?(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i,
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

// Calcular próximo dia útil considerando recesso forense (20/dez a 6/jan)
function calcularPrimeiroDiaUtil(dataBase: Date, diasUteisAdicionar: number = 0): Date {
  const resultado = new Date(dataBase);
  
  // Função para verificar se está no recesso forense
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

// Gera hash para deduplicação de tarefas
function generateTaskDedupKey(processoId: string, titulo: string, dataVencimento: string): string {
  // Normaliza título removendo variações de espaço e case
  const tituloNorm = titulo.toLowerCase().replace(/\s+/g, ' ').trim();
  // Extrai apenas a data (YYYY-MM-DD)
  const dataNorm = dataVencimento?.split('T')[0] || '';
  return `${processoId}|${tituloNorm}|${dataNorm}`;
}

// Verifica se já existe tarefa similar para evitar duplicatas
async function verificarTarefaExistente(
  supabase: any,
  processoId: string,
  responsavelId: string,
  titulo: string,
  dataVencimento: string
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
    // Comparação exata ou contém o mesmo prefixo significativo
    if (tituloExistente === tituloBase) {
      console.log(`[DEDUP] Tarefa duplicada detectada: "${titulo}" já existe para processo ${processoId}`);
      return true;
    }
    // Se ambos começam com [DJEN] e têm mesmo número de processo
    if (tituloBase.startsWith('[djen]') && tituloExistente.startsWith('[djen]')) {
      // Extrai número do processo do título
      const numMatch = tituloBase.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
      const numExistenteMatch = tituloExistente.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
      if (numMatch && numExistenteMatch && numMatch[0] === numExistenteMatch[0]) {
        // Mesmo processo, verifica se tipo é similar
        const tipoMatch = tituloBase.match(/\[(djen|andamento)\]\s*(\w+)/i);
        const tipoExistenteMatch = tituloExistente.match(/\[(djen|andamento)\]\s*(\w+)/i);
        if (tipoMatch && tipoExistenteMatch && tipoMatch[2] === tipoExistenteMatch[2]) {
          console.log(`[DEDUP] Tarefa DJEN duplicada: tipo "${tipoMatch[2]}" já existe para processo`);
          return true;
        }
      }
    }
  }
  
  return false;
}

async function criarTarefasParaResponsaveis(
  supabase: any,
  processoNumero: string,
  titulo: string,
  descricao: string,
  dataVencimento: string,
  prioridade: string,
  origem: string,
  tipoTarefa: string,
  publicacaoId?: string
): Promise<string[]> {
  const { data: processo } = await supabase
    .from('processos')
    .select('id, advogado_responsavel_id')
    .eq('numero', processoNumero)
    .single();

  if (!processo) {
    console.log(`Process not found for number ${processoNumero}, cannot create task`);
    return [];
  }

  const { data: responsaveis } = await supabase
    .from('processos_responsaveis')
    .select('responsavel_id')
    .eq('processo_id', processo.id);

  if (!responsaveis || responsaveis.length === 0) {
    if (processo.advogado_responsavel_id) {
      // Verificar duplicata antes de criar
      const jáExiste = await verificarTarefaExistente(
        supabase, processo.id, processo.advogado_responsavel_id, titulo, dataVencimento
      );
      if (jáExiste) {
        console.log(`[DEDUP] Pulando criação de tarefa duplicada para ${processoNumero}`);
        return [];
      }
      
      const { data: tarefa, error } = await supabase
        .from('tarefas')
        .insert({
          processo_id: processo.id,
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
        
        if (publicacaoId) {
          await supabase
            .from('tarefas_publicacoes')
            .insert({
              tarefa_id: tarefa.id,
              publicacao_id: publicacaoId,
            });
        }
        
        return [tarefa.id];
      }
    }
    return [];
  }

  const tarefaIds: string[] = [];
  for (const resp of responsaveis) {
    // Verificar duplicata antes de criar
    const jáExiste = await verificarTarefaExistente(
      supabase, processo.id, resp.responsavel_id, titulo, dataVencimento
    );
    if (jáExiste) {
      console.log(`[DEDUP] Pulando tarefa duplicada para responsável ${resp.responsavel_id}`);
      continue;
    }
    
    const { data: tarefa, error } = await supabase
      .from('tarefas')
      .insert({
        processo_id: processo.id,
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
      
      if (publicacaoId) {
        await supabase
          .from('tarefas_publicacoes')
          .insert({
            tarefa_id: tarefa.id,
            publicacao_id: publicacaoId,
          });
      }
    }
  }

  if (tarefaIds.length > 0) {
    console.log(`Created ${tarefaIds.length} tasks for process ${processoNumero}`);
  }
  return tarefaIds;
}

function generateGlobalHash(conteudo: string, dataDisponibilizacao: string): string {
  // Usar data de disponibilização para que republicações do mesmo conteúdo
  // em datas diferentes sejam tratadas como registros distintos
  const normalized = (conteudo + dataDisponibilizacao).toLowerCase().replace(/\s+/g, ' ').trim();
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

interface AudienciaInfo {
  dataAudiencia: string | null;
  tipoAudiencia: string | null;
  localAudiencia: string | null;
  contexto: string;
}

function detectAudiencia(conteudo: string): AudienciaInfo | null {
  const conteudoLower = conteudo.toLowerCase();
  
  const audienciaTerms = [
    'audiência',
    'audiencia',
    'sessão de julgamento',
    'sessao de julgamento',
    'pauta de julgamento',
  ];
  
  const hasAudiencia = audienciaTerms.some(term => conteudoLower.includes(term));
  if (!hasAudiencia) return null;
  
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

interface TribunalStats {
  tribunal: string | null;
  paginas: number;
  resultados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
}

interface SearchParams {
  texto?: string;
  numeroOab?: string;
  ufOab?: string;
  nomeAdvogado?: string;
  siglaTribunal?: string | null;

  // Opcional: permitir controlar o intervalo de datas (yyyy-MM-dd) quando necessário.
  // Se não for informado, a função usa o "hoje" de Brasília e faz fallback para ontem
  // quando a API retornar vazio.
  dataInicio?: string;
  dataFim?: string;
}

async function processMonitoramento(
  supabase: any,
  monitoramento: Monitoramento,
  options: { scheduled?: boolean; dataInicio?: string; dataFim?: string } = {}
): Promise<{ novas: number; descartadas: number; duplicatas: number; tribunaisStats: TribunalStats[] }> {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  const tribunaisStats: TribunalStats[] = [];
  const dataAtual = new Date().toISOString().split('T')[0];
  
  const searchCandidates: Array<Omit<SearchParams, 'siglaTribunal'>> = [];

  if (monitoramento.tipo === "advogado") {
    const termo = (monitoramento.termo_busca || "").trim();
    const hasNome = termo.length >= 3 && /[A-Za-zÀ-ÿ]/.test(termo);

    if (monitoramento.oab) {
      const uf = (monitoramento.uf || "DF").toUpperCase();
      const numeroOab = monitoramento.oab.replace(/\D/g, "");

      searchCandidates.push({ numeroOab, ufOab: uf });
      searchCandidates.push({ texto: `OAB ${uf}-${numeroOab}` });
      searchCandidates.push({ texto: `OAB ${numeroOab} ${uf}` });
      searchCandidates.push({ texto: numeroOab });
    }

    if (hasNome) {
      searchCandidates.push({ nomeAdvogado: termo });
      searchCandidates.push({ texto: termo });
    }

    console.log(
      `Advogado search candidates: oab=${monitoramento.oab || "(none)"}, uf=${(monitoramento.uf || "DF").toUpperCase()}, nome=${hasNome ? termo : "(none)"}`
    );
  } else if (monitoramento.tipo === "palavra-chave") {
    const termo = monitoramento.termo_busca;
    searchCandidates.push({ texto: termo });
    
    // Adicionar variante sem acentos para melhor cobertura
    const termoSemAcento = termo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
      .replace(/[\/]/g, ' ')             // S/A -> S A
      .replace(/\s+/g, ' ')              // Normaliza espaços
      .trim();
    
    // Se a variante for diferente, adicionar como candidato adicional
    if (termoSemAcento.toLowerCase() !== termo.toLowerCase()) {
      searchCandidates.push({ texto: termoSemAcento });
      console.log(`[DJEN] Variante sem acento adicionada: "${termoSemAcento}"`);
    }
  } else if (monitoramento.tipo === "processo") {
    searchCandidates.push({ texto: monitoramento.termo_busca.replace(/\D/g, "") });
  } else if (monitoramento.tipo === "parte") {
    const termo = (monitoramento.termo_busca || "").trim();
    if (termo.length >= 3) {
      searchCandidates.push({ texto: termo });
      
      // Variante sem acentos
      const termoSemAcento = termo
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (termoSemAcento.toLowerCase() !== termo.toLowerCase()) {
        searchCandidates.push({ texto: termoSemAcento });
        console.log(`[DJEN] Parte variante sem acento: "${termoSemAcento}"`);
      }
      
      console.log(`Parte search: "${termo}"`);
    }
  }

  if (searchCandidates.length === 0) {
    console.log(`No search params for monitoramento ${monitoramento.id}`);
    return { ...stats, tribunaisStats };
  }

  const tribunais = monitoramento.tribunais && monitoramento.tribunais.length > 0
    ? monitoramento.tribunais
    : [null];

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

    let publications: any[] = [];
    let pages = 0;

    for (const candidate of searchCandidates) {
      const candidateLabel = candidate.numeroOab
        ? `numeroOab=${candidate.numeroOab}/${candidate.ufOab || ''}`
        : candidate.nomeAdvogado
          ? `nomeAdvogado="${candidate.nomeAdvogado}"`
          : candidate.texto
            ? `texto="${candidate.texto}"`
            : 'unknown';

      console.log(`[DJEN] Trying candidate ${candidateLabel} | tribunal=${tribunal || 'TODOS'} | período=${options.dataInicio || '-'}→${options.dataFim || '-'}`);

      const searchParams: SearchParams = { 
        ...candidate, 
        siglaTribunal: tribunal,
        dataInicio: options.dataInicio,
        dataFim: options.dataFim,
      };
      const result = await fetchDJENResultsWithStats(searchParams, { scheduled: options.scheduled === true });
      publications = result.items;
      pages = result.pages;
      if (publications.length > 0) break;
      
      // Delay entre candidatos de busca para evitar rate limit
      await delay(INTER_CANDIDATE_DELAY_MS);
    }
    tribunalStat.paginas = pages;
    tribunalStat.resultados = publications.length;

    console.log(`Found ${publications.length} publications for tribunal ${tribunal} (${pages} pages)`);

    for (const pub of publications) {
      const conteudo = pub.conteudo || pub.texto || pub.teor || pub.descricao || JSON.stringify(pub);
      // Priorizar data_disponibilizacao para consistência com globalHash
      const hashConteudo = generateHash(conteudo + (pub.dataDisponibilizacao || pub.dataPublicacao || pub.data || ''));
      
      // A API pode retornar datas em diferentes campos dependendo do tribunal
      // Buscar em níveis raiz e aninhado (pub.comunicacao)
      const pubObj = pub.comunicacao || pub;
      
      // Log detalhado para debug do primeiro item de cada tribunal
      if (tribunalStat.novas === 0 && tribunalStat.descartadas === 0 && tribunalStat.duplicatas === 0) {
        console.log(`[DJEN Termos] Pub structure for ${tribunal}:`, JSON.stringify({
          keys_pub: Object.keys(pub),
          keys_pubObj: Object.keys(pubObj),
          dataDisponibilizacao: pub.dataDisponibilizacao || pubObj.dataDisponibilizacao,
          dataPublicacao: pub.dataPublicacao || pubObj.dataPublicacao,
        }));
      }
      
      // dataDisponibilizacao = data em que foi disponibilizado no DJe (exatamente como vem da API)
      // dataPublicacao = próximo dia útil após a disponibilização (contagem de prazo começa aqui)
      const rawDataDisponibilizacao = 
        pub.dataDisponibilizacao || pubObj.dataDisponibilizacao ||
        pub.dataDJe || pubObj.dataDJe || 
        pub.dtDisponibilizacao || pubObj.dtDisponibilizacao || 
        pub.dataDisp || pubObj.dataDisp || 
        null;
      const rawDataPublicacao = 
        pub.dataPublicacao || pubObj.dataPublicacao ||
        pub.dataJornal || pubObj.dataJornal || 
        pub.dtPublicacao || pubObj.dtPublicacao || 
        pub.data || pubObj.data || 
        null;
      
      // Prioridade: usar data_disponibilizacao exatamente como vem da API
      // Se não tiver, usar data_publicacao da API diretamente
      let dataDisponibilizacao = rawDataDisponibilizacao;
      let dataPublicacao = rawDataPublicacao;
      
      // Se temos data_disponibilizacao, calcular data_publicacao como próximo dia útil
      if (dataDisponibilizacao && !rawDataPublicacao) {
        try {
          const dispDate = new Date(dataDisponibilizacao);
          if (!isNaN(dispDate.getTime())) {
            // Data de publicação = próximo dia útil após disponibilização
            dispDate.setDate(dispDate.getDate() + 1); // Avança 1 dia
            const proximoDiaUtil = calcularPrimeiroDiaUtil(dispDate);
            dataPublicacao = proximoDiaUtil.toISOString().split('T')[0];
          }
        } catch { /* ignore */ }
      }
      
      // Se só temos data_publicacao da API, manter como está (caso raro)
      // Fallback: usar data atual se nenhuma data disponível (último recurso)
      if (!dataDisponibilizacao && !dataPublicacao) {
        console.log(`[DJEN Termos] WARNING: No dates found for pub in ${tribunal}. Using today as fallback.`);
        dataDisponibilizacao = dataAtual;
        const hoje = new Date(dataAtual);
        hoje.setDate(hoje.getDate() + 1);
        const proximoDiaUtil = calcularPrimeiroDiaUtil(hoje);
        dataPublicacao = proximoDiaUtil.toISOString().split('T')[0];
      } else if (!dataDisponibilizacao && dataPublicacao) {
        // Mantém data_publicacao da API, não inferir disponibilização
        dataDisponibilizacao = dataPublicacao; // Fallback seguro
      }
      
      const globalHash = generateGlobalHash(conteudo, dataDisponibilizacao);

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

      if (!matchesCondicaoConcomitante(conteudo, monitoramento.condicao_concomitante)) {
        continue;
      }

      const motivoExclusao = shouldExclude(conteudo, monitoramento.exclusoes || []);
      
      const processoNumero = extractProcessoNumero(conteudo, pub.numeroProcesso || pub.processo);
      
      if (motivoExclusao) {
        await supabase.from('publicacoes_djen_descartadas').insert({
          monitoramento_id: monitoramento.id,
          hash_conteudo: hashConteudo,
          conteudo,
          data_publicacao: dataPublicacao,
          data_disponibilizacao: dataDisponibilizacao,
          processo_numero: processoNumero,
          tribunal: tribunal || pub.siglaTribunal || null,
          motivo_descarte: `Termo de exclusão: ${motivoExclusao}`,
        });
        
        await supabase.from('publicacoes_djen_global_hash').insert({
          hash_global: globalHash,
          primeiro_monitoramento_id: monitoramento.id,
        });
        
        stats.descartadas++;
        tribunalStat.descartadas++;
        continue;
      }

      const { data: existing } = await supabase
        .from('publicacoes_djen')
        .select('id')
        .eq('hash_conteudo', hashConteudo)
        .eq('monitoramento_id', monitoramento.id)
        .maybeSingle();

      if (existing) {
        stats.duplicatas++;
        tribunalStat.duplicatas++;
        continue;
      }

      const { data: publicacao, error: insertError } = await supabase.from('publicacoes_djen').insert({
        monitoramento_id: monitoramento.id,
        hash_conteudo: hashConteudo,
        conteudo,
        data_publicacao: dataPublicacao,
        data_disponibilizacao: dataDisponibilizacao,
        processo_numero: processoNumero,
        tribunal: tribunal || pub.siglaTribunal || null,
        polo_ativo: pub.nomeAdvogado || null,
        polo_passivo: pub.nomeParte || null,
      }).select('id').single();

      if (insertError) {
        console.error(`Insert error:`, insertError);
        continue;
      }

      await supabase.from('publicacoes_djen_global_hash').insert({
        hash_global: globalHash,
        primeiro_monitoramento_id: monitoramento.id,
        publicacao_id: publicacao.id,
      });

      stats.novas++;
      tribunalStat.novas++;

      const audienciaInfo = detectAudiencia(conteudo);
      if (audienciaInfo && processoNumero) {
        const { data: existingAudiencia } = await supabase
          .from('audiencias_detectadas')
          .select('id')
          .eq('publicacao_id', publicacao.id)
          .maybeSingle();

        if (!existingAudiencia) {
          await supabase.from('audiencias_detectadas').insert({
            processo_numero: processoNumero,
            monitoramento_id: monitoramento.id,
            publicacao_id: publicacao.id,
            tipo_audiencia: audienciaInfo.tipoAudiencia,
            data_audiencia: audienciaInfo.dataAudiencia,
            local_audiencia: audienciaInfo.localAudiencia,
            contexto: audienciaInfo.contexto,
            conteudo_publicacao: conteudo,
            origem: 'djen_monitoramento',
            status: 'pendente',
          });

          if (processoNumero) {
            const dataVencimento = audienciaInfo.dataAudiencia 
              ? new Date(new Date(audienciaInfo.dataAudiencia).getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            await criarTarefasParaResponsaveis(
              supabase,
              processoNumero,
              `AUDIÊNCIA ${audienciaInfo.tipoAudiencia || ''} - ${processoNumero}`,
              `Audiência detectada automaticamente.\n\nData: ${audienciaInfo.dataAudiencia || 'A definir'}\nLocal: ${audienciaInfo.localAudiencia || 'Não especificado'}\n\nContexto:\n${audienciaInfo.contexto}`,
              dataVencimento,
              'alta',
              'djen_monitoramento',
              'audiencia',
              publicacao.id
            );
          }
        }
      }
    }

    tribunaisStats.push(tribunalStat);
    
    // Delay entre tribunais para evitar rate limit (alinhado com processos)
    if (tribunais.length > 1) {
      await delay(INTER_TRIBUNAL_DELAY_MS);
    }
  }

  console.log(`Monitoramento ${monitoramento.id}: novas=${stats.novas}, descartadas=${stats.descartadas}, duplicatas=${stats.duplicatas}`);
  return { ...stats, tribunaisStats };
}

async function fetchDJENResultsWithStats(
  params: SearchParams,
  options: { scheduled?: boolean } = {}
): Promise<{ items: any[]; pages: number }> {
  const allResults: any[] = [];
  let page = 0;
  const maxPages = 10;

  const now = new Date();
  const todayBrasilia = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dataHoje = todayBrasilia.toISOString().split('T')[0];

  // Importante: o parâmetro da API é dataDisponibilizacao (muitas vezes 1 dia antes da data_publicacao).
  // Para não perder publicações “virando o dia”, em execuções agendadas buscamos ontem->hoje por padrão.
  const yesterdayBrasilia = new Date(todayBrasilia);
  yesterdayBrasilia.setDate(yesterdayBrasilia.getDate() - 1);
  const dataOntem = yesterdayBrasilia.toISOString().split('T')[0];

  const defaultInicio = options.scheduled ? dataOntem : dataHoje;
  const defaultFim = dataHoje;

  while (page < maxPages) {
    const queryParams = new URLSearchParams();

    // A API PJE Comunica suporta parâmetros nativos para busca por OAB
    // ufOab e numeroOab são parâmetros válidos da API
    if (params.texto) {
      queryParams.set('texto', params.texto);
    }

    // Usar parâmetros nativos da API para OAB (não converter para texto)
    if (params.numeroOab) {
      queryParams.set('numeroOab', params.numeroOab);
      console.log(`[OAB Search] Using native numeroOab=${params.numeroOab}`);
    }
    if (params.ufOab) {
      queryParams.set('ufOab', params.ufOab);
      console.log(`[OAB Search] Using native ufOab=${params.ufOab}`);
    }
    if (params.nomeAdvogado) {
      queryParams.set('nomeAdvogado', params.nomeAdvogado);
      console.log(`[Advogado Search] Using native nomeAdvogado="${params.nomeAdvogado}"`);
    }

    if (params.siglaTribunal) queryParams.set('siglaTribunal', params.siglaTribunal);

    const dataInicio = params.dataInicio || defaultInicio;
    const dataFim = params.dataFim || defaultFim;

    queryParams.set('dataDisponibilizacaoInicio', dataInicio);
    queryParams.set('dataDisponibilizacaoFim', dataFim);
    queryParams.set('pagina', page.toString());
    queryParams.set('itensPorPagina', '100');

    const url = `${PJE_COMUNICA_API}/comunicacao?${queryParams.toString()}`;
    console.log(`Fetching: ${url}`);

    try {
      const response = await fetchWithRetry(url, { headers: browserHeaders }, 3, 2000);
      const contentType = response.headers.get('content-type') || '';

      let data: any | null = null;

      // Se a API bloquear (403 ou HTML), tenta via proxy (Bright Data -> Jina)
      if (!response.ok || contentType.includes('text/html')) {
        const bodyPreview = await response.text().catch(() => '');
        console.error(`API blocked/error: status=${response.status} content-type=${contentType} preview=${bodyPreview.slice(0, 200)}`);

        data = await fetchViaProxy(url);
        if (!data) break;
      } else {
        data = await response.json();
      }

      const items = data?.comunicacoes || data?.items || data || [];

      if (Array.isArray(items) && items.length > 0) {
        allResults.push(...items);
        page++;
        // Delay entre páginas para evitar rate limit (alinhado com processos)
        await delay(INTER_PAGE_DELAY_MS);
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


// Helper to ensure djen_runs record exists before saving lotes
async function ensureRunExists(
  supabase: any,
  runId: string,
  total: number,
  retryCount: number
): Promise<boolean> {
  try {
    // IMPORTANT: this function can be called by multiple invocations concurrently.
    // Use an idempotent write (upsert w/ ignoreDuplicates) to avoid race conditions.

    const payload = {
      run_id: runId,
      status: 'em_andamento',
      total_monitoramentos: total,
      retry_count: retryCount,
    };

    const { error } = await supabase
      .from('djen_runs')
      // ignoreDuplicates prevents overwriting an existing run and avoids 23505
      .upsert(payload, { onConflict: 'run_id', ignoreDuplicates: true });

    if (error) {
      // Defensive: if the client still surfaces a duplicate key error, treat as success.
      if ((error as any)?.code === '23505') {
        console.log(`[DJEN] djen_runs already exists for run_id=${runId} (23505), continuing.`);
        return true;
      }

      console.error('Error creating djen_runs:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Error in ensureRunExists:', e);
    return false;
  }
}

// Helper to save batch record to djen_lotes
async function saveLoteRecord(
  supabase: any,
  runId: string,
  loteNumero: number,
  offset: number,
  processedCount: number,
  stats: {
    novas: number;
    descartadas: number;
    duplicatas: number;
    erros: number;
    paginas: number;
    resultados: number;
  },
  duration: number,
  tribunaisStats: TribunalStats[],
  total: number,
  retryCount: number,
  status: 'concluido' | 'erro' = 'concluido',
  erroMensagem?: string
): Promise<string | null> {
  try {
    // Ensure run exists before saving lote (fixes FK constraint error)
    const runExists = await ensureRunExists(supabase, runId, total, retryCount);
    if (!runExists) {
      console.error(`Cannot save lote: run ${runId} does not exist and could not be created`);
      return null;
    }

    const { data: lote, error } = await supabase
      .from('djen_lotes')
      .insert({
        run_id: runId,
        lote_numero: loteNumero,
        offset_inicial: offset,
        offset_final: offset + processedCount - 1,
        finalizado_em: new Date().toISOString(),
        status,
        processados: processedCount,
        novas: stats.novas,
        descartadas: stats.descartadas,
        duplicatas: stats.duplicatas,
        erros: stats.erros,
        total_paginas: stats.paginas,
        total_resultados: stats.resultados,
        duracao_segundos: duration,
        erro_mensagem: erroMensagem,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving lote:', error);
      return null;
    }

    // Save tribunal stats for this lote
    for (const ts of tribunaisStats) {
      await supabase.from('djen_tribunais_lote').insert({
        lote_id: lote.id,
        run_id: runId,
        tribunal: ts.tribunal || 'TODOS',
        termos_buscados: 0,
        paginas: ts.paginas,
        resultados: ts.resultados,
        novas: ts.novas,
        descartadas: ts.descartadas,
        duplicatas: ts.duplicatas,
      });
    }

    return lote.id;
  } catch (e) {
    console.error('Error in saveLoteRecord:', e);
    return null;
  }
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    // Validar que as variáveis de ambiente essenciais estão definidas
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[DJEN] Missing environment variables:', { 
        hasUrl: !!supabaseUrl, 
        hasServiceKey: !!supabaseServiceKey 
      });
      return new Response(
        JSON.stringify({ 
          error: 'Configuração de ambiente incompleta. Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Carregar parâmetros da tabela de configuração
    await loadConfigFromDatabase(supabase);

    const url = new URL(req.url);
    
    // IMPORTANTE: Para auto-continuação, usar service_role_key diretamente
    // já que é chamada interna servidor-para-servidor e não depende do auth header do request original
    const authHeaderForContinuation = `Bearer ${supabaseServiceKey}`;

    const body = await req.json().catch(() => ({} as any));
    const scheduled = body?.scheduled === true;
    const continued = body?.continued === true;
    const completeRun = body?.completeRun === true || scheduled;
    const parentRunId = body?.parentRunId as string | undefined;
    const retryCount = (body?.retryCount as number) || 0;
    const execucaoId = body?.execucaoId as string | undefined;

    const urlOffsetRaw = url.searchParams.get('offset');
    const urlOffset = urlOffsetRaw !== null ? Number.parseInt(urlOffsetRaw, 10) : NaN;

    // Ler datas do período de consulta (passadas via query params do frontend)
    const dataInicioParam = url.searchParams.get('dataInicio');
    const dataFimParam = url.searchParams.get('dataFim');
    
    console.log(`[DJEN] Date params from URL: dataInicio=${dataInicioParam}, dataFim=${dataFimParam}`);

    let offset = Number.isFinite(urlOffset) ? urlOffset : 0;

    if (completeRun && !Number.isFinite(urlOffset) && !continued) {
      offset = 0;
    }

    console.log(`=== DJEN Monitor START ===`);
    console.log(`  Params: offset=${offset} | scheduled=${scheduled} | completeRun=${completeRun} | continued=${continued} | retryCount=${retryCount} | execucaoId=${execucaoId}`);
    console.log(`  URL offset param: ${urlOffsetRaw}`);
    console.log(`  Date range: ${dataInicioParam || 'hoje'} to ${dataFimParam || 'hoje'}`);
    console.log(`  Body: ${JSON.stringify(body).slice(0, 200)}`);
    const startTime = Date.now();

    console.log(`Counting active monitoramentos...`);
    const { count: totalActive, error: countError } = await supabase
      .from('monitoramentos_djen')
      .select('id', { count: 'exact', head: true })
      .eq('ativo', true);

    if (countError) {
      console.error(`Error counting monitoramentos:`, countError);
      throw countError;
    }
    console.log(`Total active monitoramentos: ${totalActive}`);

    console.log(`Fetching monitoramentos: range ${offset} to ${offset + MAX_PER_INVOCATION - 1}`);
    const { data: monitoramentos, error: fetchError } = await supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: true })
      .range(offset, offset + MAX_PER_INVOCATION - 1);

    if (fetchError) {
      console.error(`Error fetching monitoramentos:`, fetchError);
      throw fetchError;
    }

    const count = monitoramentos?.length || 0;
    const total = totalActive || 0;
    console.log(`Fetched ${count} monitoramentos (total active: ${total})`);

    // Determine or create run_id
    // Se parentRunId foi passado, SEMPRE usa ele (mesmo sem flag continued)
    const hasParentRun = !!parentRunId;
    let runId = parentRunId || crypto.randomUUID();
    const isNewRun = offset === 0 && !continued && !hasParentRun;
    const loteNumero = Math.floor(offset / MAX_PER_INVOCATION) + 1;

    console.log(`[DJEN] Run decision: parentRunId=${parentRunId} | hasParentRun=${hasParentRun} | isNewRun=${isNewRun} | runId=${runId}`);

    // Create run record for new runs (ensureRunExists will handle idempotently)
    if (isNewRun) {
      // Cancel any stale in-progress runs before starting a fresh one
      const { data: staleRuns } = await supabase.from('djen_runs')
        .select('run_id')
        .eq('status', 'em_andamento')
        .lt('iniciado_em', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // older than 30 min
      
      if (staleRuns && staleRuns.length > 0) {
        console.log(`[DJEN] Cancelling ${staleRuns.length} stale run(s): ${staleRuns.map(r => r.run_id).join(', ')}`);
        await supabase.from('djen_runs')
          .update({ status: 'cancelado', motivo_erro: 'Cancelado por nova execução agendada', finalizado_em: new Date().toISOString() })
          .eq('status', 'em_andamento')
          .lt('iniciado_em', new Date(Date.now() - 30 * 60 * 1000).toISOString());
      }
      
      await ensureRunExists(supabase, runId, total, retryCount);
      console.log(`Initialized new run: ${runId}`);
    } else if (hasParentRun) {
      // Garante que o run existe (caso de continuação manual)
      await ensureRunExists(supabase, runId, total, retryCount);
      console.log(`Continuing existing run: ${runId}`);
    }

    // Handle empty batch at offset 0
    if (count === 0) {
      const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      console.log(`No monitoramentos to process at offset ${offset}. Total active: ${total}`);
      
      // If first batch is empty and we have active monitoramentos, schedule retry
      if (completeRun && offset === 0 && total > 0 && retryCount < MAX_RETRIES) {
        console.log(`[DJEN] Empty results at offset 0, scheduling retry #${retryCount + 1} in ${RETRY_DELAY_MINUTES} minutes`);
        
        // Update run status
        await supabase.from('djen_runs')
          .update({ 
            status: 'vazio_reexecutando',
            retry_count: retryCount + 1,
          })
          .eq('run_id', runId);
        
        // Save empty lote record
        await saveLoteRecord(supabase, runId, loteNumero, offset, 0, {
          novas: 0, descartadas: 0, duplicatas: 0, erros: 0, paginas: 0, resultados: 0,
        }, duration, [], total, retryCount, 'concluido');

        // Retry with delay - await delay then immediate fetch (setTimeout doesn't work in Edge Functions)
        const retryUrl = `${supabaseUrl}/functions/v1/monitorar-djen`;
        const retryBody = {
          completeRun: true,
          scheduled: true,
          continued: false,
          parentRunId: runId,
          retryCount: retryCount + 1,
        };

        // Usar authHeaderForContinuation já capturado no início (evita "Cannot read headers: request closed")

        // Wait for the delay period (max 50 seconds to stay under Edge Function limits)
        const actualDelayMs = Math.min(RETRY_DELAY_MINUTES * 60 * 1000, 50_000);
        console.log(`[DJEN] Waiting ${actualDelayMs / 1000}s before retry...`);
        await delay(actualDelayMs);

        // Now execute the retry
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15_000);

          const r = await fetch(retryUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeaderForContinuation,
            },
            body: JSON.stringify(retryBody),
            signal: controller.signal,
          });

          clearTimeout(timeout);
          const t = await r.text();
          console.log(`[DJEN] Retry request sent, status=${r.status}, body=${t.slice(0, 200)}`);
        } catch (e) {
          console.error(`[DJEN] Failed to send retry request:`, e);
        }

        return new Response(
          JSON.stringify({
            success: true,
            processados: 0,
            novasPublicacoes: 0,
            hasMore: false,
            scheduledRetry: true,
            retryDelaySeconds: actualDelayMs / 1000,
            retryCount: retryCount + 1,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Normal empty case (no active monitoramentos or max retries reached)
      const nowIso = new Date().toISOString();
      const finalStatus = retryCount >= MAX_RETRIES ? 'erro' : 'concluido';
      const errorMsg = retryCount >= MAX_RETRIES 
        ? `Máximo de ${MAX_RETRIES} tentativas atingido sem resultados` 
        : (total === 0 ? 'Nenhum monitoramento ativo encontrado' : undefined);

      if (isNewRun || parentRunId) {
        await supabase.from('djen_runs')
          .update({ 
            status: finalStatus,
            finalizado_em: nowIso,
            motivo_erro: errorMsg,
          })
          .eq('run_id', runId);
      }

      await supabase
        .from('configuracoes_monitoramento')
        .update({
          ultima_execucao: nowIso,
          metadata: {
            last_run: nowIso,
            last_complete_run: nowIso,
            offset_processado: 0,
            processados: 0,
            novas: 0,
            has_more: false,
            warning: errorMsg,
          },
        })
        .eq('tipo', 'djen');
      
      await supabase.from('historico_monitoramento').insert({
        tipo: 'djen',
        executado_em: nowIso,
        processos_verificados: 0,
        novos_andamentos: 0,
        processos_com_novos: 0,
        erros: 0,
        detalhes: {
          run_id: runId,
          started_at: nowIso,
          warning: errorMsg,
          retry_count: retryCount,
        },
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          processados: 0,
          novasPublicacoes: 0,
          hasMore: false,
          warning: errorMsg,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${count} monitoramentos (offset ${offset}) with mode: ${CONFIG.modo_processamento}`);

    let totalNovas = 0;
    let totalDescartadas = 0;
    let totalDuplicatas = 0;
    let processedCount = 0;
    let errorCount = 0;
    let totalPaginas = 0;
    let totalResultados = 0;
    const allTribunaisStats: TribunalStats[] = [];

    // Função auxiliar para processar um monitoramento e agregar resultados
    const processAndAggregate = async (mon: Monitoramento, index: number): Promise<void> => {
      try {
        console.log(`[${index + 1}/${count}] ${mon.descricao || mon.termo_busca}`);

        const stats = await processMonitoramento(supabase, mon, { 
          scheduled,
          dataInicio: dataInicioParam || undefined,
          dataFim: dataFimParam || undefined,
        });
        
        // Agregar resultados (thread-safe para leituras/escritas simples em JS)
        totalNovas += stats.novas;
        totalDescartadas += stats.descartadas;
        totalDuplicatas += stats.duplicatas;

        for (const ts of stats.tribunaisStats) {
          totalPaginas += ts.paginas;
          totalResultados += ts.resultados;

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
        
        processedCount++;
      } catch (error) {
        errorCount++;
        processedCount++;
        console.error(`Error on ${mon.id}:`, error);
      }
    };

    // Processamento baseado no modo configurado
    const monsToProcess = monitoramentos || [];
    
    if (CONFIG.modo_processamento === 'paralelo_total') {
      // Paralelo total: processar todos de uma vez
      console.log(`[DJEN] Modo PARALELO TOTAL: processando ${monsToProcess.length} simultaneamente`);
      await Promise.all(monsToProcess.map((mon, i) => processAndAggregate(mon, i)));
      
    } else if (CONFIG.modo_processamento === 'semi_paralelo') {
      // Semi-paralelo: processar em chunks de N
      const chunkSize = CONFIG.max_paralelo;
      console.log(`[DJEN] Modo SEMI-PARALELO: chunks de ${chunkSize}`);
      
      for (let i = 0; i < monsToProcess.length; i += chunkSize) {
        // Verificar timeout antes de cada chunk
        if (Date.now() - startTime > (SOFT_TIMEOUT_MS - FINALIZATION_BUFFER_MS)) {
          console.log(`Soft timeout reached at ${Math.round((Date.now() - startTime) / 1000)}s. Stopping batch early.`);
          break;
        }
        
        const chunk = monsToProcess.slice(i, i + chunkSize);
        console.log(`[DJEN] Processando chunk ${Math.floor(i/chunkSize) + 1}: ${chunk.length} monitoramentos`);
        
        // Processar chunk em paralelo
        await Promise.all(chunk.map((mon, j) => processAndAggregate(mon, i + j)));
        
        // Delay entre chunks
        if (i + chunkSize < monsToProcess.length) {
          await delay(INTER_MONITORAMENTO_DELAY_MS);
        }
      }
      
    } else {
      // Sequencial: processar um por vez (modo original)
      console.log(`[DJEN] Modo SEQUENCIAL: processando 1 por vez`);
      
      for (let i = 0; i < monsToProcess.length; i++) {
        const mon = monsToProcess[i];
        
        // Verificar timeout
        if (Date.now() - startTime > (SOFT_TIMEOUT_MS - FINALIZATION_BUFFER_MS)) {
          console.log(`Soft timeout reached at ${Math.round((Date.now() - startTime) / 1000)}s. Stopping batch early.`);
          break;
        }
        
        await processAndAggregate(mon, i);
        
        // Delay entre monitoramentos
        if (i < monsToProcess.length - 1) {
          await delay(INTER_MONITORAMENTO_DELAY_MS);
        }
      }
    }

    const nowIso = new Date().toISOString();
    const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    const hasMore = (offset + processedCount) < total;
    const nextOffset = hasMore ? offset + processedCount : null;

    allTribunaisStats.sort((a, b) => b.resultados - a.resultados);

    // Save lote record
    await saveLoteRecord(
      supabase,
      runId,
      loteNumero,
      offset,
      processedCount,
      {
        novas: totalNovas,
        descartadas: totalDescartadas,
        duplicatas: totalDuplicatas,
        erros: errorCount,
        paginas: totalPaginas,
        resultados: totalResultados,
      },
      duration,
      allTribunaisStats,
      total,
      retryCount
    );

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

    const shouldResetRun = offset === 0 && completeRun && !continued;

    if (shouldResetRun || !run || typeof run !== 'object' || !run.run_id || !run.totals || !run.tribunais) {
      run = {
        run_id: runId,
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

    run.totals.processados += processedCount;
    run.totals.novas += totalNovas;
    run.totals.descartadas += totalDescartadas;
    run.totals.duplicatas += totalDuplicatas;
    run.totals.erros += errorCount;
    run.totals.duracao_s += duration;
    run.totals.total_paginas += totalPaginas;
    run.totals.total_resultados += totalResultados;

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

    const tribunaisFinal = !hasMore && run
      ? Object.values(run.tribunais).sort((a, b) => b.resultados - a.resultados)
      : null;

    const metaTotals = !hasMore && run
      ? {
          processados: run.totals.processados,
          novas: run.totals.novas,
          descartadas: run.totals.descartadas,
          duplicatas: run.totals.duplicatas,
          erros: run.totals.erros,
          duracao_s: run.totals.duracao_s,
          total_paginas: run.totals.total_paginas,
          total_resultados: run.totals.total_resultados,
          tribunais_stats: (tribunaisFinal ?? []).slice(0, 30),
        }
      : {
          processados: processedCount,
          novas: totalNovas,
          descartadas: totalDescartadas,
          duplicatas: totalDuplicatas,
          erros: errorCount,
          duracao_s: duration,
          total_paginas: totalPaginas,
          total_resultados: totalResultados,
          tribunais_stats: allTribunaisStats.slice(0, 20),
        };

    const updatedMeta: Record<string, any> = {
      ...currentMeta,
      last_run: nowIso,
      offset_processado: offset,
      processados: metaTotals.processados,
      novas: metaTotals.novas,
      descartadas: metaTotals.descartadas,
      duplicatas: metaTotals.duplicatas,
      erros: metaTotals.erros,
      duracao_s: metaTotals.duracao_s,
      has_more: hasMore,
      next_offset: nextOffset,
      total_paginas: metaTotals.total_paginas,
      total_resultados: metaTotals.total_resultados,
      tribunais_stats: metaTotals.tribunais_stats,
      djen_run: hasMore ? run : null,
      last_complete_run: hasMore ? (currentMeta?.last_complete_run ?? null) : nowIso,
      // CRÍTICO: Definir status explicitamente para evitar processos fantasma
      status: hasMore ? 'em_andamento' : 'concluido',
      continuingRun: hasMore,
      // Campos para sincronização realtime (como monitorar-djen-processos)
      current: offset + processedCount,
      total: total,
    };

    const updatePayload: Record<string, any> = {
      metadata: updatedMeta,
    };
    if (offset === 0 && !continued) {
      updatePayload.ultima_execucao = nowIso;
    }

    await supabase
      .from('configuracoes_monitoramento')
      .update(updatePayload)
      .eq('tipo', 'djen');

    // Atualizar progresso em tempo real na tabela execucoes_agendadas
    const progressPercentage = total > 0 ? Math.min(100, Math.round(((offset + processedCount) / total) * 100)) : 0;
    await updateExecucaoProgress(supabase, execucaoId, {
      status: hasMore ? 'executando' : 'concluido',
      registros_processados: run?.totals?.processados || processedCount,
      registros_encontrados: run?.totals?.novas || totalNovas,
      total_lotes: total,
      detalhes: {
        progress: {
          current: offset + processedCount,
          total: total,
          percentage: progressPercentage,
        },
        descartadas: run?.totals?.descartadas || totalDescartadas,
        duplicatas: run?.totals?.duplicatas || totalDuplicatas,
        erros: run?.totals?.erros || errorCount,
        runId,
      },
      ...(hasMore ? {} : { finalizado_em: nowIso }),
    });

    // Atualiza o progresso do run a cada lote (evita ficar "preso" sem números quando a continuação falha)
    if (hasMore && run) {
      await supabase.from('djen_runs')
        .update({
          status: 'em_andamento',
          processados: run.totals.processados,
          novas: run.totals.novas,
          descartadas: run.totals.descartadas,
          duplicatas: run.totals.duplicatas,
          erros: run.totals.erros,
          total_paginas: run.totals.total_paginas,
          total_resultados: run.totals.total_resultados,
          duracao_segundos: run.totals.duracao_s,
        })
        .eq('run_id', runId);
    }

    // Update run record and create history when complete
    if (!hasMore && run) {
      await supabase.from('djen_runs')
        .update({
          status: 'concluido',
          finalizado_em: nowIso,
          processados: run.totals.processados,
          novas: run.totals.novas,
          descartadas: run.totals.descartadas,
          duplicatas: run.totals.duplicatas,
          erros: run.totals.erros,
          total_paginas: run.totals.total_paginas,
          total_resultados: run.totals.total_resultados,
          duracao_segundos: run.totals.duracao_s,
        })
        .eq('run_id', runId);

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
          tribunais_stats: (tribunaisFinal ?? []).slice(0, 30),
        },
      });

      // ========== ENVIO DE RESUMO CONSOLIDADO AO FINAL ==========
      if (run.totals.novas > 0) {
        console.log('[DJEN Termos] Execução completa! Enviando resumo consolidado...');
        
        try {
          // Buscar publicações DJEN criadas hoje agrupadas por coordenação
          const hojeISO = getBrazilISODate();
          const { startUtc, endUtc } = getBrazilDayUtcRange(hojeISO);
          
          const { data: publicacoesHoje } = await supabase
            .from('publicacoes_djen')
            .select(`
              id,
              processo_numero,
              conteudo,
              data_publicacao,
              monitoramento:monitoramentos_djen!inner(
                id,
                coordenacao_id,
                coordenacao:coordenacoes(id, nome)
              )
            `)
            .gte('created_at', startUtc)
            .lt('created_at', endUtc)
            .eq('descartada', false)
            .order('created_at', { ascending: false });

          if (publicacoesHoje && publicacoesHoje.length > 0) {
            console.log(`[DJEN Termos] ${publicacoesHoje.length} publicações encontradas hoje para resumo`);
            
            // Agrupar por coordenação
            const porCoordenacao = new Map<string, {
              coordenacao_nome: string;
              publicacoes: Array<{
                processo_numero: string;
                conteudo: string;
                data: string;
              }>;
            }>();

            for (const pub of publicacoesHoje) {
              const mon = pub.monitoramento as any;
              const coordId = mon?.coordenacao_id;
              const coordNome = mon?.coordenacao?.nome || 'Sem Coordenação';
              
              if (!coordId) continue;
              
              if (!porCoordenacao.has(coordId)) {
                porCoordenacao.set(coordId, {
                  coordenacao_nome: coordNome,
                  publicacoes: []
                });
              }
              
              porCoordenacao.get(coordId)!.publicacoes.push({
                processo_numero: pub.processo_numero || 'N/A',
                conteudo: (pub.conteudo || '').substring(0, 200) + ((pub.conteudo || '').length > 200 ? '...' : ''),
                data: pub.data_publicacao || hojeISO
              });
            }

            // Enviar resumo para cada coordenação
            if (porCoordenacao.size > 0) {
              const resumosPorCoordenacao = Array.from(porCoordenacao.entries()).map(([coordId, dados]) => ({
                coordenacao_id: coordId,
                coordenacao_nome: dados.coordenacao_nome,
                total_verificados: dados.publicacoes.length,
                total_encontrados: dados.publicacoes.length,
                exemplos: dados.publicacoes.map(p => ({
                  processo_numero: p.processo_numero || 'Processo não identificado',
                  descricao: p.conteudo
                }))
              }));

              console.log(`[DJEN Termos] Enviando resumo para ${resumosPorCoordenacao.length} coordenações`);
              
              const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
              
              const resumoPromise = fetch(`${supabaseUrl}/functions/v1/enviar-resumo-monitoramento`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  tipo_monitoramento: 'djen',
                  resumos_por_coordenacao: resumosPorCoordenacao
                })
              })
                .then(r => r.json())
                .then(data => console.log('[DJEN Termos] Resumo enviado:', JSON.stringify(data).slice(0, 300)))
                .catch(err => console.error('[DJEN Termos] Erro ao enviar resumo:', err));

              const er = (globalThis as any).EdgeRuntime;
              if (er?.waitUntil) er.waitUntil(resumoPromise);
            }
          } else {
            console.log('[DJEN Termos] Nenhuma publicação encontrada hoje para resumo');
          }
        } catch (resumoError) {
          console.error('[DJEN Termos] Erro ao preparar resumo:', resumoError);
        }
      } else {
        console.log('[DJEN Termos] Nenhuma publicação nova, resumo não será enviado');
      }
    }

    // Auto-continuation
    if (completeRun && hasMore && typeof nextOffset === 'number') {
      // CANCELAMENTO PERSISTENTE: verificar flag antes de disparar próximo lote
      const { data: freshConfig } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .maybeSingle();

      const wasCancelled = (freshConfig?.metadata as any)?.cancelado === true;

      if (wasCancelled) {
        console.log('[DJEN] Cancelamento detectado, parando auto-continuação');
        const currentFreshMeta = (freshConfig?.metadata as Record<string, any>) || {};
        
        // Limpa flag e atualiza status
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: { ...currentFreshMeta, cancelado: false, status: 'cancelado', next_offset: null, has_more: false, djen_run: null },
          })
          .eq('tipo', 'djen');

        // Atualiza o run para cancelado
        await supabase.from('djen_runs')
          .update({
            status: 'cancelado',
            finalizado_em: nowIso,
            motivo_erro: 'Cancelado manualmente pelo usuário',
          })
          .eq('run_id', runId);
      } else {
        const nextUrl = `${supabaseUrl}/functions/v1/monitorar-djen?offset=${nextOffset}`;
        const nextBody = {
          completeRun: true,
          scheduled: true,
          continued: true,
          parentRunId: runId,
          execucaoId, // Propagar execucaoId para atualizar progresso
        };

        // Usar authHeaderForContinuation capturado no início (evita "Cannot read headers: request closed")
        if (!authHeaderForContinuation) {
          console.error('[DJEN] No Authorization header available for auto-continuation');
        } else {
          const maxAttempts = 3;
          let queued = false;
          let lastErr: unknown = null;

          for (let attempt = 1; attempt <= maxAttempts && !queued; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 55_000);

            try {
              const r = await fetch(nextUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': authHeaderForContinuation,
                },
                body: JSON.stringify(nextBody),
                signal: controller.signal,
              });

              clearTimeout(timeout);

              if (r.ok) {
                console.log(`[DJEN] Queued next batch offset=${nextOffset} (attempt ${attempt}/${maxAttempts})`);
                queued = true;
                break;
              }

              const t = await r.text().catch(() => '');
              lastErr = new Error(`HTTP ${r.status}`);
              console.error(`[DJEN] Failed to queue next batch offset=${nextOffset} status=${r.status} body=${t.slice(0, 200)}`);
            } catch (e) {
              clearTimeout(timeout);
              lastErr = e;
              console.error(`[DJEN] Failed to queue next batch offset=${nextOffset} (attempt ${attempt}/${maxAttempts})`, e);
              if (attempt < maxAttempts) {
                await new Promise((res) => setTimeout(res, 800 * attempt));
              }
            }
          }

          // Se não conseguiu enfileirar, encerra o run para não ficar preso em "em_andamento"
          if (!queued) {
            console.error('[DJEN] Giving up queuing next batch', lastErr);

            try {
              await supabase
                .from('djen_runs')
                .update({
                  status: 'erro',
                  finalizado_em: nowIso,
                  motivo_erro: 'failed_to_queue_next_batch',
                })
                .eq('run_id', runId);
            } catch (e) {
              console.error('[DJEN] Failed to mark run as erro after queue failure', e);
            }

            // Limpa a continuação para a próxima execução não somar em cima de um run quebrado
            try {
              await supabase
                .from('configuracoes_monitoramento')
                .update({
                  metadata: {
                    ...updatedMeta,
                    has_more: false,
                    next_offset: null,
                    djen_run: null,
                  },
                })
                .eq('tipo', 'djen');
            } catch (e) {
              console.error('[DJEN] Failed to clear metadata after queue failure', e);
            }
          }
        }
      }
    }

    console.log(`Done: ${processedCount} processed, ${totalNovas} new, ${totalPaginas} pages, ${duration}s | hasMore=${hasMore}`);

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
        queuedNext: completeRun && hasMore,
        runId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
