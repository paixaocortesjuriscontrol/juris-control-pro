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

function applyConfigToLegacy() {
  MAX_PER_INVOCATION = CONFIG.max_por_invocacao;
  SOFT_TIMEOUT_MS = CONFIG.soft_timeout_ms;
  FINALIZATION_BUFFER_MS = CONFIG.finalization_buffer_ms;
  INTER_MONITORAMENTO_DELAY_MS = CONFIG.delay_entre_monitoramentos;
  INTER_TRIBUNAL_DELAY_MS = CONFIG.delay_entre_tribunais;
  INTER_PAGE_DELAY_MS = CONFIG.delay_entre_paginas;
  JINA_MIN_INTERVAL_MS = CONFIG.delay_jina_api;
}

function applyConservativeProfile(reason: string) {
  CONFIG = {
    ...CONFIG,
    modo_processamento: 'sequencial',
    max_paralelo: 1,
    max_por_invocacao: 2,
    delay_entre_monitoramentos: 1500,
    delay_entre_paginas: 800,
    delay_entre_tribunais: 800,
    delay_jina_api: 3000,
    soft_timeout_ms: 60000,
    finalization_buffer_ms: 15000,
    max_retries: 1,
    retry_base_delay_ms: 2000,
  };
  applyConfigToLegacy();
  console.log(`[DJEN] Modo conservador aplicado (${reason}).`);
}

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
  termos_or?: string[];
  tribunais?: string[];
  descricao?: string;
}

// IDs sintéticos de tribunais que precisam ser expandidos
const TODOS_IDS_CIVEIS = [
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMG', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR',
  'TJRJ', 'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
];

const TODOS_IDS_TRABALHISTAS = [
  'TST', 'TRT1', 'TRT2', 'TRT3', 'TRT4', 'TRT5', 'TRT6', 'TRT7', 'TRT8',
  'TRT9', 'TRT10', 'TRT11', 'TRT12', 'TRT13', 'TRT14', 'TRT15', 'TRT16',
  'TRT17', 'TRT18', 'TRT19', 'TRT20', 'TRT21', 'TRT22', 'TRT23', 'TRT24',
];

// Expande IDs sintéticos (TODOS_CIVEIS, TODOS_TRT) para a lista real de tribunais
function expandirTribunais(tribunais: string[] | undefined | null): string[] | null {
  if (!tribunais || tribunais.length === 0) return null;
  
  const expandidos = new Set<string>();
  
  for (const t of tribunais) {
    if (t === 'TODOS_CIVEIS') {
      TODOS_IDS_CIVEIS.forEach(id => expandidos.add(id));
    } else if (t === 'TODOS_TRT') {
      TODOS_IDS_TRABALHISTAS.forEach(id => expandidos.add(id));
    } else {
      expandidos.add(t);
    }
  }
  
  // Se após expansão temos muitos tribunais (>15), buscar sem filtro é mais eficiente
  if (expandidos.size > 15) {
    console.log(`[DJEN] Expandiu para ${expandidos.size} tribunais. Buscando sem filtro para melhor performance.`);
    return null;
  }
  
  return Array.from(expandidos);
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
      applyConfigToLegacy();

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

function createStopChecker(supabase: any, execucaoId?: string, throttleMs = 2000) {
  let lastCheck = 0;
  let cached: { stop: boolean; reason?: string } = { stop: false };

  return async () => {
    if (cached.stop) return cached;
    const now = Date.now();
    if (now - lastCheck < throttleMs) return cached;
    lastCheck = now;

    try {
      if (execucaoId) {
        const { data: exec } = await supabase
          .from('execucoes_agendadas')
          .select('status')
          .eq('id', execucaoId)
          .maybeSingle();
        if (exec?.status === 'cancelado') {
          cached = { stop: true, reason: 'cancelado_execucao' };
          return cached;
        }
      }

      const { data } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .is('coordenacao_id', null)
        .maybeSingle();
      const meta = (data?.metadata as any) || {};
      if (meta?.cancelado === true) {
        cached = { stop: true, reason: 'cancelado' };
        return cached;
      }
      if (meta?.paused_globally === true) {
        cached = { stop: true, reason: 'paused_globally' };
        return cached;
      }
    } catch (e) {
      console.warn('[DJEN] stop checker error:', e);
    }

    return cached;
  };
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

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[&\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizarParaBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[&\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function termoAtendidoPorPalavras(conteudoNorm: string, termo: string): boolean {
  const termoNorm = normalizar(termo);
  if (!termoNorm) return true;
  if (conteudoNorm.includes(termoNorm)) return true;

  const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length >= 2);
  if (palavrasTermo.length === 0) return true;

  const palavrasEncontradas = palavrasTermo.filter(p => conteudoNorm.includes(p));
  return palavrasEncontradas.length === palavrasTermo.length;
}

function condicaoConcomitanteAtendida(conteudo: string, condicao?: string): boolean {
  if (!condicao) return true;
  const gruposOr = String(condicao)
    .split('|')
    .map(g => g.trim())
    .filter(Boolean);
  if (gruposOr.length === 0) return true;

  const conteudoNorm = normalizar(conteudo);
  return gruposOr.some(grupo => {
    const termosAnd = grupo
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    if (termosAnd.length === 0) return true;
    return termosAnd.every(t => termoAtendidoPorPalavras(conteudoNorm, t));
  });
}

function conteudoContemTermo(
  conteudo: string,
  termo: string,
  tipo: string,
  oab?: string
): boolean {
  if (!conteudo) return false;

  const conteudoNorm = normalizar(conteudo);

  if (tipo === 'advogado') {
    if (oab) {
      const oabDigits = String(oab).replace(/\D/g, '');
      if (oabDigits.length >= 3) {
        const oabPattern = new RegExp(oabDigits.split('').join('[.\\s-]?'), 'i');
        if (!oabPattern.test(conteudo)) return false;
      }
    }

    if (termo) {
      const termoNorm = normalizar(termo);
      if (termoNorm && !conteudoNorm.includes(termoNorm)) {
        return false;
      }
    }

    return true;
  }

  if (tipo === 'processo') {
    const numero = String(termo || '').replace(/\D/g, '');
    if (!numero) return true;
    return conteudoNorm.includes(numero);
  }

  // Para palavra-chave/parte: exigir frase completa (ordem e sequência)
  const termoNorm = normalizar(termo);
  if (!termoNorm) return true;
  return conteudoNorm.includes(termoNorm);
}

function parseAdvogadoTermo(raw: string): { nome?: string; oabDigits?: string; uf?: string } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return {};
  const digits = trimmed.replace(/\D/g, '');
  const prefixUf = trimmed.match(/([A-Za-z]{2})\s*\d/);
  const suffixUf = trimmed.match(/\d\s*\/\s*([A-Za-z]{2})/);
  const uf = (prefixUf?.[1] || suffixUf?.[1])?.toUpperCase();
  const hasLetters = /[A-Za-zÀ-ÿ]/.test(trimmed);

  if (digits.length >= 3 && (uf || !hasLetters)) {
    return { oabDigits: digits, uf };
  }

  return { nome: trimmed };
}

function buildAdvogadoTargets(
  termo: string,
  termosOr: string[] | undefined,
  oab?: string,
  uf?: string
): Array<{ nome?: string; oabDigits?: string; uf?: string }> {
  const targets: Array<{ nome?: string; oabDigits?: string; uf?: string }> = [];
  const baseNome = String(termo || '').trim();
  const baseOab = String(oab || '').replace(/\D/g, '');
  const baseUf = String(uf || '').trim().toUpperCase();

  if (baseNome || baseOab) {
    targets.push({
      nome: baseNome || undefined,
      oabDigits: baseOab || undefined,
      uf: baseUf || undefined,
    });
  }

  for (const t of termosOr || []) {
    const parsed = parseAdvogadoTermo(t);
    if (parsed.nome || parsed.oabDigits) {
      targets.push(parsed);
    }
  }

  return targets;
}

function conteudoContemTermoOuOr(
  conteudo: string,
  monitoramento: Monitoramento
): boolean {
  if (monitoramento.tipo !== 'advogado') {
    return conteudoContemTermo(conteudo, monitoramento.termo_busca, monitoramento.tipo, monitoramento.oab);
  }

  const targets = buildAdvogadoTargets(
    monitoramento.termo_busca,
    monitoramento.termos_or,
    monitoramento.oab,
    monitoramento.uf
  );
  if (targets.length === 0) {
    return conteudoContemTermo(conteudo, monitoramento.termo_busca, monitoramento.tipo, monitoramento.oab);
  }
  return targets.some((t) =>
    conteudoContemTermo(conteudo, t.nome || '', 'advogado', t.oabDigits)
  );
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

async function processPublicationFromIndex(
  supabase: any,
  pub: any,
  monitoramento: Monitoramento,
  tribunalStat: TribunalStats,
  stats: { novas: number; descartadas: number; duplicatas: number },
  tribunal: string | null,
  dataAtual: string
) {
  const conteudo = pub.conteudo || JSON.stringify(pub);
  const hashConteudo = generateHash(conteudo + (pub.data_disponibilizacao || pub.data_publicacao || pub.data || ''));

  const rawDataDisponibilizacao = pub.data_disponibilizacao || pub.dataDisponibilizacao || null;
  const rawDataPublicacao = pub.data_publicacao || pub.dataPublicacao || null;

  let dataDisponibilizacao = rawDataDisponibilizacao;
  let dataPublicacao = rawDataPublicacao;

  if (dataDisponibilizacao && !rawDataPublicacao) {
    try {
      const dispDate = new Date(dataDisponibilizacao);
      if (!isNaN(dispDate.getTime())) {
        dispDate.setDate(dispDate.getDate() + 1);
        const proximoDiaUtil = calcularPrimeiroDiaUtil(dispDate);
        dataPublicacao = proximoDiaUtil.toISOString().split('T')[0];
      }
    } catch {
      // ignore
    }
  }

  if (!dataDisponibilizacao && !dataPublicacao) {
    dataDisponibilizacao = dataAtual;
    const hoje = new Date(dataAtual);
    hoje.setDate(hoje.getDate() + 1);
    const proximoDiaUtil = calcularPrimeiroDiaUtil(hoje);
    dataPublicacao = proximoDiaUtil.toISOString().split('T')[0];
  } else if (!dataDisponibilizacao && dataPublicacao) {
    dataDisponibilizacao = dataPublicacao;
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
    return;
  }

  if (!conteudoContemTermoOuOr(conteudo, monitoramento)) {
    stats.descartadas++;
    tribunalStat.descartadas++;
    return;
  }

  if (!condicaoConcomitanteAtendida(conteudo, monitoramento.condicao_concomitante)) {
    return;
  }

  const motivoExclusao = shouldExclude(conteudo, monitoramento.exclusoes || []);
  const processoNumero = extractProcessoNumero(conteudo, pub.processo_numero || pub.numeroProcesso || pub.processo);

  if (motivoExclusao) {
    await supabase.from('publicacoes_djen_descartadas').insert({
      monitoramento_id: monitoramento.id,
      hash_conteudo: hashConteudo,
      conteudo,
      data_publicacao: dataPublicacao,
      data_disponibilizacao: dataDisponibilizacao,
      processo_numero: processoNumero,
      tribunal: tribunal || null,
      motivo_descarte: `Termo de exclusão: ${motivoExclusao}`,
    });

    await supabase.from('publicacoes_djen_global_hash').insert({
      hash_global: globalHash,
      primeiro_monitoramento_id: monitoramento.id,
    });

    stats.descartadas++;
    tribunalStat.descartadas++;
    return;
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
    return;
  }

  const { data: publicacao, error: insertError } = await supabase.from('publicacoes_djen').insert({
    monitoramento_id: monitoramento.id,
    hash_conteudo: hashConteudo,
    conteudo,
    data_publicacao: dataPublicacao,
    data_disponibilizacao: dataDisponibilizacao,
    processo_numero: processoNumero,
    tribunal: tribunal || null,
    polo_ativo: null,
    polo_passivo: null,
  }).select('id').single();

  if (insertError) {
    console.error(`Insert error:`, insertError);
    return;
  }

  await supabase.from('publicacoes_djen_global_hash').insert({
    hash_global: globalHash,
    primeiro_monitoramento_id: monitoramento.id,
    publicacao_id: publicacao.id,
  });

  stats.novas++;
  tribunalStat.novas++;
}

async function buscarNoIndiceDiario(
  supabase: any,
  diarioYmd: string,
  tribunal: string | null,
  termo: string
): Promise<any[]> {
  const termoBusca = normalizarParaBusca(termo);
  if (!termoBusca) return [];

  const pageSize = 500;
  let from = 0;
  let results: any[] = [];
  let done = false;

  while (!done) {
    let query = supabase
      .from('djen_diario_publicacoes')
      .select('id, conteudo, data_disponibilizacao, data_publicacao, processo_numero, tribunal')
      .eq('diario_ymd', diarioYmd)
      .textSearch('conteudo_tsv', termoBusca, { type: 'phrase', config: 'portuguese' })
      .range(from, from + pageSize - 1);

    if (tribunal) {
      query = query.eq('tribunal', tribunal);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      done = true;
      break;
    }
    results.push(...data);
    if (data.length < pageSize) done = true;
    from += pageSize;
  }

  return results;
}

async function buscarNoIndiceOab(
  supabase: any,
  diarioYmd: string,
  tribunal: string | null,
  oabDigits: string
): Promise<any[]> {
  if (!oabDigits) return [];
  const pageSize = 500;
  let from = 0;
  let results: any[] = [];
  let done = false;

  while (!done) {
    let query = supabase
      .from('djen_diario_publicacoes')
      .select('id, conteudo, data_disponibilizacao, data_publicacao, processo_numero, tribunal')
      .eq('diario_ymd', diarioYmd)
      .ilike('conteudo', `%${oabDigits}%`)
      .range(from, from + pageSize - 1);

    if (tribunal) {
      query = query.eq('tribunal', tribunal);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      done = true;
      break;
    }
    results.push(...data);
    if (data.length < pageSize) done = true;
    from += pageSize;
  }

  return results;
}

async function processMonitoramento(
  supabase: any,
  monitoramento: Monitoramento,
  options: { scheduled?: boolean; dataInicio?: string; dataFim?: string; indexed?: boolean; diarioYmd?: string } = {}
): Promise<{ novas: number; descartadas: number; duplicatas: number; tribunaisStats: TribunalStats[] }> {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  const tribunaisStats: TribunalStats[] = [];
  const dataAtual = new Date().toISOString().split('T')[0];

  if (options.indexed && options.diarioYmd) {
    const tribunaisExpandidos = expandirTribunais(monitoramento.tribunais);
    const tribunais = tribunaisExpandidos && tribunaisExpandidos.length > 0
      ? tribunaisExpandidos
      : [null];

    for (const tribunal of tribunais) {
      const tribunalStat: TribunalStats = {
        tribunal,
        paginas: 0,
        resultados: 0,
        novas: 0,
        descartadas: 0,
        duplicatas: 0,
      };

      const candidatos = new Map<string, any>();
      const termosBase = [
        monitoramento.termo_busca,
        ...(monitoramento.termos_or || []),
      ].filter(Boolean) as string[];

      if (monitoramento.tipo === 'advogado') {
        const targets = buildAdvogadoTargets(
          monitoramento.termo_busca,
          monitoramento.termos_or,
          monitoramento.oab,
          monitoramento.uf
        );
        for (const target of targets) {
          if (target.oabDigits) {
            const items = await buscarNoIndiceOab(supabase, options.diarioYmd, tribunal, target.oabDigits);
            for (const item of items) candidatos.set(item.id, item);
          }
          if (target.nome) {
            const items = await buscarNoIndiceDiario(supabase, options.diarioYmd, tribunal, target.nome);
            for (const item of items) candidatos.set(item.id, item);
          }
        }
      } else if (monitoramento.tipo === 'processo') {
        const numero = String(monitoramento.termo_busca || '').replace(/\D/g, '');
        const items = await buscarNoIndiceOab(supabase, options.diarioYmd, tribunal, numero);
        for (const item of items) candidatos.set(item.id, item);
      } else {
        for (const termo of termosBase) {
          const items = await buscarNoIndiceDiario(supabase, options.diarioYmd, tribunal, termo);
          for (const item of items) candidatos.set(item.id, item);
        }
      }

      tribunalStat.resultados = candidatos.size;

      for (const pub of candidatos.values()) {
        await processPublicationFromIndex(supabase, pub, monitoramento, tribunalStat, stats, tribunal || pub.tribunal, dataAtual);
      }

      tribunaisStats.push(tribunalStat);
    }

    console.log(`Monitoramento ${monitoramento.id} (indexado): novas=${stats.novas}, descartadas=${stats.descartadas}, duplicatas=${stats.duplicatas}`);
    return { ...stats, tribunaisStats };
  }
  
  const searchCandidates: Array<Omit<SearchParams, 'siglaTribunal'>> = [];

  if (monitoramento.tipo === "advogado") {
    const targets = buildAdvogadoTargets(
      monitoramento.termo_busca,
      monitoramento.termos_or,
      monitoramento.oab,
      monitoramento.uf
    );
    const defaultUf = (monitoramento.uf || "DF").toUpperCase();

    for (const target of targets) {
      if (target.oabDigits) {
        searchCandidates.push({ numeroOab: target.oabDigits, ufOab: target.uf || defaultUf });
      }
      if (target.nome) {
        const nomeTrim = target.nome.trim();
        const hasNome = nomeTrim.length >= 3 && /[A-Za-zÀ-ÿ]/.test(nomeTrim);
        if (hasNome) {
          searchCandidates.push({ nomeAdvogado: nomeTrim });
        }
      }
    }

    console.log(
      `[DJEN] Advogado search candidates: total=${searchCandidates.length}`
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
    
    // Sem prefixo curto: evitar falsos positivos (filtro 100% por palavras)
    
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
      
      // Sem prefixo curto: evitar falsos positivos (filtro 100% por palavras)
      
      console.log(`Parte search: "${termo}"`);
    }
  }

  if (searchCandidates.length === 0) {
    console.log(`No search params for monitoramento ${monitoramento.id}`);
    return { ...stats, tribunaisStats };
  }

  // IMPORTANTE: Expandir IDs sintéticos (TODOS_CIVEIS, TODOS_TRT) para tribunais reais
  const tribunaisExpandidos = expandirTribunais(monitoramento.tribunais);
  const tribunais = tribunaisExpandidos && tribunaisExpandidos.length > 0
    ? tribunaisExpandidos
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

    let totalPages = 0;
    let totalResultados = 0;

    const processPublication = async (pub: any) => {
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
        return;
      }

      if (!conteudoContemTermoOuOr(conteudo, monitoramento)) {
        stats.descartadas++;
        tribunalStat.descartadas++;
        return;
      }

      if (!condicaoConcomitanteAtendida(conteudo, monitoramento.condicao_concomitante)) {
        return;
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
        return;
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
        return;
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
        return;
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
    };

    // IMPORTANTE: Buscar TODAS as variantes (com e sem acento) e acumular resultados
    // Não fazer break no primeiro resultado - algumas publicações só aparecem
    // na variante sem acento (ex: TJRJ usa "UNIAO QUIMICA" sem acentos)
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
      const result = await fetchDJENResultsWithStats(
        searchParams,
        { scheduled: options.scheduled === true },
        async (items) => {
          for (const item of items) {
            await processPublication(item);
          }
        }
      );

      totalPages += result.pages;
      totalResultados += result.itemsCount;

      console.log(`[DJEN] Candidate ${candidateLabel}: ${result.itemsCount} resultados (acumulado: ${totalResultados})`);

      // Delay entre candidatos de busca para evitar rate limit
      await delay(INTER_CANDIDATE_DELAY_MS);
    }
    const pages = totalPages;
    tribunalStat.paginas = pages;
    tribunalStat.resultados = totalResultados;

    console.log(`Found ${totalResultados} publications for tribunal ${tribunal} (${pages} pages)`);

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
  options: { scheduled?: boolean } = {},
  onItems?: (items: any[]) => Promise<void> | void
): Promise<{ itemsCount: number; pages: number }> {
  let page = 0;
  let itemsCount = 0;
  const maxPages = 10;

  const now = new Date();
  const todayBrasilia = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dataHoje = todayBrasilia.toISOString().split('T')[0];

  // Importante: o parâmetro da API é dataDisponibilizacao (muitas vezes 1 dia antes da data_publicacao).
  // Para não perder publicações “virando o dia” (ex: publicação 30/01 com disponibilização 29/01),
  // o monitoramento deve buscar ontem->hoje por padrão, mesmo em execução manual.
  const yesterdayBrasilia = new Date(todayBrasilia);
  yesterdayBrasilia.setDate(yesterdayBrasilia.getDate() - 1);
  const dataOntem = yesterdayBrasilia.toISOString().split('T')[0];

  const defaultInicio = dataOntem;
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
    queryParams.set('itensPorPagina', '50');

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
        itemsCount += items.length;
        if (onItems) {
          await onItems(items);
        }
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

  return { itemsCount, pages: page };
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
    // Permite limpar o campo quando um snapshot antigo marcou como finalizado,
    // mas a execução continuou (evita status executando + finalizado_em preenchido).
    finalizado_em?: string | null;
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
    const conservative = body?.conservative === true;
    const indexMode = body?.indexMode as string | undefined;

    if (scheduled || conservative) {
      applyConservativeProfile(scheduled ? 'scheduled' : 'manual_conservative');
    }

    const urlOffsetRaw = url.searchParams.get('offset');
    const urlOffset = urlOffsetRaw !== null ? Number.parseInt(urlOffsetRaw, 10) : NaN;

    // Ler datas do período de consulta (query params ou body)
    const dataInicioParam = url.searchParams.get('dataInicio') ?? body?.dataInicio ?? null;
    const dataFimParam = url.searchParams.get('dataFim') ?? body?.dataFim ?? null;
    const runKey = `${dataInicioParam ?? 'auto'}..${dataFimParam ?? 'auto'}|${indexMode ?? 'normal'}`;
    
    console.log(`[DJEN] Date params from URL: dataInicio=${dataInicioParam}, dataFim=${dataFimParam}`);

    let offset = Number.isFinite(urlOffset) ? urlOffset : 0;

    if (completeRun && !Number.isFinite(urlOffset) && !continued) {
      offset = 0;
    }

    console.log(`=== DJEN Monitor START ===`);
    // Se o usuário pediu cancelamento, não iniciar nem continuar
    const { data: cancelConfig } = await supabase
      .from('configuracoes_monitoramento')
      .select('metadata')
      .eq('tipo', 'djen')
      .is('coordenacao_id', null)
      .maybeSingle();

    const wasCancelled = (cancelConfig?.metadata as any)?.cancelado === true;
    if (wasCancelled) {
      const nowIso = new Date().toISOString();
      const currentMeta = (cancelConfig?.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...currentMeta,
            cancelado: false,
            status: 'cancelado',
            has_more: false,
            next_offset: null,
            djen_run: null,
            last_stop_reason: 'user_cancel',
          },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);

      if (execucaoId) {
        await updateExecucaoProgress(supabase, execucaoId, {
          status: 'cancelado',
          finalizado_em: nowIso,
        });
      }

      return new Response(
        JSON.stringify({ success: true, cancelled: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const isPausedGlobally = (cancelConfig?.metadata as any)?.paused_globally === true;
    const isManual = body?.manual === true;
    if (isPausedGlobally && !isManual) {
      const nowIso = new Date().toISOString();
      const currentMeta = (cancelConfig?.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...currentMeta,
            cancelado: false,
            status: 'cancelado',
            has_more: false,
            next_offset: null,
            djen_run: null,
            last_stop_reason: 'paused_globally',
          },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);

      if (execucaoId) {
        await updateExecucaoProgress(supabase, execucaoId, {
          status: 'cancelado',
          finalizado_em: nowIso,
          detalhes: { paused_globally: true },
        });
      }

      return new Response(
        JSON.stringify({ success: true, paused: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // STALE INVOCATION GUARD (anti-reexecução)
    // ========================================================================
    // Problema: em modo 100% background, um novo disparo (manual/cron) pode iniciar
    // em offset=0 enquanto já existe uma execução em andamento com next_offset>0.
    // Isso reprocessa monitoramentos já concluídos na MESMA execução e pode causar
    // regressão aparente de percentual.
    // Solução: se o banco indica uma continuação em andamento (has_more + next_offset),
    // ignorar invocações com offset menor que o checkpoint do banco.
    try {
      const metaCfg = (cancelConfig?.metadata as Record<string, any>) || {};
      const statusCfg = typeof metaCfg.status === 'string' ? metaCfg.status : null;
      const runningCfg = statusCfg === 'em_andamento' || statusCfg === 'executando';
      const hasMoreCfg = metaCfg.has_more === true;
      const nextOffsetCfgRaw = Number(metaCfg.next_offset);
      const expectedOffset = Number.isFinite(nextOffsetCfgRaw)
        ? Math.max(0, nextOffsetCfgRaw)
        : Math.max(0, Number(metaCfg.current ?? 0) || 0);

      // Não depender de has_more (pode ficar inconsistente em alguns snapshots).
      // Se já existe uma execução em andamento com checkpoint > 0, não permitir
      // invocações com offset menor (evita reprocesso e regressão de %).
      if (runningCfg && expectedOffset > 0 && offset < expectedOffset) {
        console.warn(
          `[DJEN] Stale invocation guard: offset=${offset} < expectedOffset=${expectedOffset}. Skipping to prevent reprocessing.`,
        );
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'stale_invocation', expectedOffset }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } catch (e) {
      console.warn('[DJEN] Falha no stale invocation guard (seguindo execução):', e);
    }

    if (conservative) {
      CONFIG = {
        ...CONFIG,
        modo_processamento: 'sequencial',
        max_paralelo: 1,
        max_por_invocacao: Math.min(CONFIG.max_por_invocacao, 5),
        delay_entre_monitoramentos: Math.max(CONFIG.delay_entre_monitoramentos, 1500),
        delay_entre_paginas: Math.max(CONFIG.delay_entre_paginas, 1200),
        delay_entre_tribunais: Math.max(CONFIG.delay_entre_tribunais, 1000),
        max_retries: Math.max(CONFIG.max_retries, 4),
        retry_base_delay_ms: Math.max(CONFIG.retry_base_delay_ms, 8000),
      };
      applyConfigToLegacy();
      console.log('[DJEN] Modo conservador ativo (reduz 429)');
    }
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

    // Atualizar metadata logo no início para o card refletir progresso
    try {
      const { data: cfgInit } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .is('coordenacao_id', null)
        .maybeSingle();
      const metaInit = (cfgInit?.metadata as Record<string, any>) || {};

      // Se é um run NOVO (offset=0 sem continued/parentRunId), não pode herdar
      // current/total antigos (isso faz parecer que “concluiu 100%” e depois regrediu).
      const hasParentRunForReset = !!parentRunId;
      const isNewRunForReset = offset === 0 && !continued && !hasParentRunForReset;
      const prevRunKey = (metaInit as any)?.run_key ?? (metaInit as any)?.runKey;
      const isDifferentRunKey = typeof prevRunKey === 'string' && prevRunKey.length > 0 && prevRunKey !== runKey;
      const shouldResetProgress = isNewRunForReset || isDifferentRunKey;

      // Anti-regressão: garantir que current/percentage não voltem em snapshots concorrentes
      const prevCur = shouldResetProgress ? 0 : Number(metaInit.current ?? 0);
      const prevTot = shouldResetProgress ? 0 : Number(metaInit.total ?? 0);
      const safeTotal = Math.max(total, Number.isFinite(prevTot) ? prevTot : 0);
      const safeCurrent = shouldResetProgress ? 0 : Math.max(offset, Number.isFinite(prevCur) ? prevCur : 0);
      const safePercentage = safeTotal > 0 ? Math.min(100, Math.round((safeCurrent / safeTotal) * 100)) : 0;

      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...metaInit,
            run_key: runKey,
            status: 'em_andamento',
            current: safeCurrent,
            total: safeTotal,
            percentage: safePercentage,
            mensagem: 'Processando monitoramentos...',
            termoAtual: metaInit.termoAtual ?? null,

            ...(shouldResetProgress
              ? {
                  // limpar restos de execução anterior
                  last_stop_reason: null,
                  warning: null,
                  has_more: true,
                  next_offset: 0,
                  djen_run: null,
                }
              : {}),
          },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);

      if (execucaoId) {
        await updateExecucaoProgress(supabase, execucaoId, {
          status: 'executando',
          // Limpar finalizado_em se algum snapshot antigo marcou como finalizado
          finalizado_em: null,
          registros_processados: safeCurrent,
          total_lotes: safeTotal,
          detalhes: {
            progress: {
              current: safeCurrent,
              total: safeTotal,
              percentage: safePercentage,
            },
            runKey,
          },
        });
      }
    } catch (e) {
      console.warn('[DJEN] Falha ao publicar progresso inicial:', e);
    }

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
    let lastTermoLabel: string | null = null;
    let stopReason: string | null = null;
    const shouldStop = createStopChecker(supabase, execucaoId);
    let lastHeartbeatAt = 0;

    const heartbeat = async () => {
      const now = Date.now();
      if (now - lastHeartbeatAt < 5000) return;
      lastHeartbeatAt = now;
      const current = offset + processedCount;
      const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
      try {
        const { data: cfg } = await supabase
          .from('configuracoes_monitoramento')
          .select('metadata')
          .eq('tipo', 'djen')
          .is('coordenacao_id', null)
          .maybeSingle();
        const meta = (cfg?.metadata as Record<string, any>) || {};

        // PROTEÇÃO ANTI-REGRESSÃO:
        // Em execuções 100% background pode haver concorrência/retentativas.
        // Se um snapshot atrasado sobrescrever o metadata, o % "volta".
        // Aqui garantimos que current/percentage no metadata e na execução só aumentam.
        const prevCur = Number(meta.current ?? 0);
        const prevTot = Number(meta.total ?? 0);
        const safeTotal = Math.max(total, Number.isFinite(prevTot) ? prevTot : 0);
        const safeCurrent = Math.max(current, Number.isFinite(prevCur) ? prevCur : 0);
        const safePercentage = safeTotal > 0
          ? Math.min(100, Math.round((safeCurrent / safeTotal) * 100))
          : (Number.isFinite(Number(meta.percentage)) ? Number(meta.percentage) : percentage);

        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...meta,
              status: 'em_andamento',
              current: safeCurrent,
              total: safeTotal,
              percentage: safePercentage,
              termoAtual: lastTermoLabel ?? meta.termoAtual ?? null,
              mensagem: lastTermoLabel ? `Processando: ${lastTermoLabel}` : 'Processando monitoramentos...',
            },
          })
          .eq('tipo', 'djen')
          .is('coordenacao_id', null);

        if (execucaoId) {
          await updateExecucaoProgress(supabase, execucaoId, {
            status: 'executando',
            // "finalizado_em" pode ter sido preenchido por um snapshot antigo; limpamos ao continuar.
            finalizado_em: null,
            registros_processados: safeCurrent,
            total_lotes: safeTotal,
            detalhes: {
              progress: { current: safeCurrent, total: safeTotal, percentage: safePercentage },
              runId,
            },
          });
        }
      } catch (e) {
        console.warn('[DJEN] Falha ao publicar heartbeat:', e);
      }
    };

    const diarioYmd =
      dataInicioParam && dataFimParam && dataInicioParam === dataFimParam
        ? dataInicioParam
        : null;
    let usarIndice = false;
    if (indexMode === 'normal') {
      usarIndice = false;
    } else if (indexMode === 'indexado' && !diarioYmd) {
      const msg = '[DJEN] Consulta indexada exige seleção de apenas um dia.';
      console.warn(msg);
      const { data: cfg } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .is('coordenacao_id', null)
        .maybeSingle();
      const meta = (cfg?.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...meta,
            status: 'erro',
            mensagem: 'Consulta indexada exige seleção de apenas um dia.',
            last_stop_reason: 'index_requires_single_day',
          },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
      return new Response(
        JSON.stringify({ success: false, error: 'Consulta indexada exige um único dia.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (diarioYmd) {
      const { data: idx } = await supabase
        .from('djen_diario_index')
        .select('status')
        .eq('diario_ymd', diarioYmd)
        .maybeSingle();
      const indexOk = idx?.status === 'concluido';

      if (indexMode === 'indexado' && !indexOk) {
        const msg = `[DJEN] Índice diário indisponível para ${diarioYmd}`;
        console.warn(msg);
        const { data: cfg } = await supabase
          .from('configuracoes_monitoramento')
          .select('metadata')
          .eq('tipo', 'djen')
          .is('coordenacao_id', null)
          .maybeSingle();
        const meta = (cfg?.metadata as Record<string, any>) || {};
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...meta,
              status: 'erro',
              mensagem: 'Índice diário não disponível para a data selecionada.',
              last_stop_reason: 'index_unavailable',
            },
          })
          .eq('tipo', 'djen')
          .is('coordenacao_id', null);
        return new Response(
          JSON.stringify({ success: false, error: 'Índice diário não disponível.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      usarIndice = indexOk;
      if (usarIndice) {
        console.log(`[DJEN] Usando índice diário para ${diarioYmd}`);
      }
    }

    // Função auxiliar para processar um monitoramento e agregar resultados
    const processAndAggregate = async (mon: Monitoramento, index: number): Promise<void> => {
      try {
        const stop = await shouldStop();
        if (stop.stop) {
          stopReason = stop.reason || 'cancelado';
          return;
        }
        lastTermoLabel = (mon.descricao || mon.termo_busca || '').trim() || null;
        console.log(`[${index + 1}/${count}] ${lastTermoLabel || mon.termo_busca}`);

        const stats = await processMonitoramento(supabase, mon, {
          scheduled,
          dataInicio: dataInicioParam || undefined,
          dataFim: dataFimParam || undefined,
          indexed: usarIndice,
          diarioYmd: diarioYmd || undefined,
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
        await heartbeat();
      } catch (error) {
        errorCount++;
        processedCount++;
        console.error(`Error on ${mon.id}:`, error);
        await heartbeat();
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
        if (stopReason) break;
        
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
        if (stopReason) break;
        
        await processAndAggregate(mon, i);
        
        // Delay entre monitoramentos
        if (i < monsToProcess.length - 1) {
          await delay(INTER_MONITORAMENTO_DELAY_MS);
        }
      }
    }

    const nowIso = new Date().toISOString();
    const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    if (stopReason) {
      const nowIso = new Date().toISOString();
      const { data: cfg } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .is('coordenacao_id', null)
        .maybeSingle();
      const currentMeta = (cfg?.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...currentMeta,
            cancelado: false,
            paused_globally: stopReason === 'paused_globally' ? true : currentMeta.paused_globally,
            status: 'cancelado',
            has_more: false,
            next_offset: null,
            djen_run: null,
            last_stop_reason: stopReason,
          },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);

      if (execucaoId) {
        await updateExecucaoProgress(supabase, execucaoId, {
          status: 'cancelado',
          finalizado_em: nowIso,
          detalhes: { stopped_reason: stopReason },
        });
      }

      return new Response(
        JSON.stringify({ success: true, cancelled: true, reason: stopReason }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Se foi cancelado durante a execução, parar imediatamente
    if (currentMeta?.cancelado === true) {
      const nowIso = new Date().toISOString();
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...currentMeta,
            cancelado: false,
            status: 'cancelado',
            has_more: false,
            next_offset: null,
            djen_run: null,
            last_stop_reason: 'user_cancel',
          },
        })
        .eq('tipo', 'djen');

      if (execucaoId) {
        await updateExecucaoProgress(supabase, execucaoId, {
          status: 'cancelado',
          finalizado_em: nowIso,
        });
      }

      return new Response(
        JSON.stringify({ success: true, cancelled: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Anti-regressão: em concorrência, evitar que current/percentage do metadata retrocedam
    const prevMetaCur = Number((currentMeta as any)?.current ?? 0);
    const prevMetaTot = Number((currentMeta as any)?.total ?? 0);
    const safeTotalFinal = Math.max(total, Number.isFinite(prevMetaTot) ? prevMetaTot : 0);
    const safeCurrentFinal = Math.max(offset + processedCount, Number.isFinite(prevMetaCur) ? prevMetaCur : 0);
    const safePercentageFinal = safeTotalFinal > 0
      ? Math.min(100, Math.round((safeCurrentFinal / safeTotalFinal) * 100))
      : 0;

    const updatedMeta: Record<string, any> = {
      ...currentMeta,
      cancelado: false,
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
      current: safeCurrentFinal,
      total: safeTotalFinal,
      percentage: safePercentageFinal,
      termoAtual: lastTermoLabel ?? null,
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
    const progressPercentage = safeTotalFinal > 0
      ? Math.min(100, Math.round((safeCurrentFinal / safeTotalFinal) * 100))
      : 0;
    await updateExecucaoProgress(supabase, execucaoId, {
      status: hasMore ? 'executando' : 'concluido',
      registros_processados: run?.totals?.processados || processedCount,
      registros_encontrados: run?.totals?.novas || totalNovas,
      total_lotes: total,
      detalhes: {
        progress: {
          current: safeCurrentFinal,
          total: safeTotalFinal,
          percentage: progressPercentage,
        },
        descartadas: run?.totals?.descartadas || totalDescartadas,
        duplicatas: run?.totals?.duplicatas || totalDuplicatas,
        erros: run?.totals?.erros || errorCount,
        runId,
      },
      // Se houver continuação, garantir que finalizado_em não fique "preso".
      finalizado_em: hasMore ? null : nowIso,
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
      const pausedGlobally = (freshConfig?.metadata as any)?.paused_globally === true;

      if (wasCancelled || pausedGlobally) {
        console.log('[DJEN] Cancelamento/pausa global detectado, parando auto-continuação');
        const currentFreshMeta = (freshConfig?.metadata as Record<string, any>) || {};
        
        // Limpa flag e atualiza status
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...currentFreshMeta,
              cancelado: false,
              status: 'cancelado',
              next_offset: null,
              has_more: false,
              djen_run: null,
              last_stop_reason: pausedGlobally ? 'paused_globally' : 'cancelado',
            },
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
               // IMPORTANTE: também encerrar a execução do dashboard.
               // Caso contrário, a UI fica presa em 96-99% para sempre.
               const progressPercentage = total > 0
                 ? Math.min(100, Math.round(((offset + processedCount) / total) * 100))
                 : 0;
               await updateExecucaoProgress(supabase, execucaoId, {
                 status: 'timeout',
                 finalizado_em: nowIso,
                 registros_processados: run?.totals?.processados || (offset + processedCount),
                 registros_encontrados: run?.totals?.novas || totalNovas,
                 total_lotes: total,
                 detalhes: {
                   progress: {
                     current: offset + processedCount,
                     total,
                     percentage: progressPercentage,
                   },
                   descartadas: run?.totals?.descartadas || totalDescartadas,
                   duplicatas: run?.totals?.duplicatas || totalDuplicatas,
                   erros: run?.totals?.erros || errorCount,
                   runId,
                   stop_reason: 'failed_to_queue_next_batch',
                 },
               });

              await supabase
                .from('configuracoes_monitoramento')
                .update({
                  metadata: {
                     ...updatedMeta,
                     // marcar explicitamente como timeout para destravar UI e permitir retomar/reiniciar
                     status: 'timeout',
                     last_stop_reason: 'failed_to_queue_next_batch',
                     warning: 'Execução interrompida: falha ao enfileirar o próximo lote. Use Retomar ou Reiniciar.',
                     has_more: false,
                     next_offset: null,
                     djen_run: null,
                     continuingRun: false,
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
