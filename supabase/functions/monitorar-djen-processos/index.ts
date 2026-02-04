import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getBrazilISODate(date: Date = new Date()): string {
  // en-CA => YYYY-MM-DD
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
  // 00:00 BRT == 03:00 UTC
  const start = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 3, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

// Single optimized endpoint
const PJE_COMUNICA_ENDPOINT = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

// ============================================================================
// PARÂMETROS CONSERVADORES - API PJE COMUNICA IMPÕE RATE LIMIT (429)
// ============================================================================
// A API bloqueia requisições em excesso. Precisamos ser conservadores.
let CONFIG = {
  max_paralelo: 2,               // 2 requisições simultâneas - conservador
  batch_size: 50,                // 50 processos por lote
  group_search_size: 50,         // Agrupamento inicial (auto-desliga se não ajudar)
  delay_entre_lotes: 3000,       // 3s entre lotes - respeitar rate limit
  delay_entre_paginas: 500,      // 500ms entre páginas
  soft_timeout_ms: 55000,        // 55s soft timeout
  finalization_buffer_ms: 5000,  // 5s buffer
  max_retries: 5,                // 5 tentativas com backoff exponencial
  retry_base_delay_ms: 5000,     // Backoff: 5s, 10s, 20s, 40s, 80s
};

// Constantes derivadas - CONSERVADORAS (atualizadas em applyConfigToDerived)
let BATCH_SIZE = CONFIG.batch_size;           // 50
let CONCURRENT_REQUESTS = CONFIG.max_paralelo; // 2
let GROUP_SEARCH_SIZE = CONFIG.group_search_size; // 50
const MIN_GROUP_HIT_RATE = 0.3; // 30% de processos com resultado para manter agrupamento
const PAGE_SIZE = 100; // Max page size from API
const MAX_PAGES = 1;   // 1 página só
let BASE_DELAY = CONFIG.delay_entre_lotes;    // 3000
const STAGGER_DELAY = 1000; // 1s entre requisições paralelas

function applyConfigToDerived() {
  BATCH_SIZE = CONFIG.batch_size;
  CONCURRENT_REQUESTS = CONFIG.max_paralelo;
  GROUP_SEARCH_SIZE = CONFIG.group_search_size;
  BASE_DELAY = CONFIG.delay_entre_lotes;
}

applyConfigToDerived();


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

// NOTA: Parâmetros de DJEN Processos agora podem ser carregados da tabela
// parametros_monitoramento_djen (tipo djen_processos).

async function loadConfigFromDatabase(supabase: any): Promise<void> {
  try {
    const { data: tipoRow } = await supabase
      .from('tipo_monitoramento')
      .select('id')
      .eq('slug', 'djen_processos')
      .maybeSingle();

    if (!tipoRow?.id) return;

    const { data, error } = await supabase
      .from('parametros_monitoramento_djen')
      .select('*')
      .eq('tipo_monitoramento_id', tipoRow.id)
      .eq('ativo', true)
      .limit(1)
      .single();

    if (error || !data) {
      console.log('[DJEN Processos] Erro ao carregar parâmetros da tabela, usando valores padrão');
      return;
    }

    CONFIG = {
      max_paralelo: data.max_paralelo ?? CONFIG.max_paralelo,
      batch_size: data.batch_size ?? CONFIG.batch_size,
      group_search_size: data.group_search_size ?? CONFIG.group_search_size,
      delay_entre_lotes: data.delay_entre_lotes ?? CONFIG.delay_entre_lotes,
      delay_entre_paginas: data.delay_entre_paginas ?? CONFIG.delay_entre_paginas,
      soft_timeout_ms: data.soft_timeout_ms ?? CONFIG.soft_timeout_ms,
      finalization_buffer_ms: data.finalization_buffer_ms ?? CONFIG.finalization_buffer_ms,
      max_retries: data.max_retries ?? CONFIG.max_retries,
      retry_base_delay_ms: data.retry_base_delay_ms ?? CONFIG.retry_base_delay_ms,
    };

    applyConfigToDerived();

    console.log(`[DJEN Processos] Parâmetros carregados: paralelo=${CONFIG.max_paralelo}, batch=${CONFIG.batch_size}`);
  } catch (e) {
    console.log('[DJEN Processos] Erro ao carregar config:', e);
  }
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

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 4, baseDelay = 3000): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      
      // Rate limited - wait longer and retry
      if (response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, attempt); // 3s, 6s, 12s, 24s
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

function normalizeProcessoNumero(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
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

// Fast single-request search per texto with retry
async function searchDJENByTexto(
  texto: string,
  dataInicio?: string,
  dataFim?: string,
): Promise<any[]> {
  const params = new URLSearchParams();
  params.append('texto', texto);
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
    }, CONFIG.max_retries, CONFIG.retry_base_delay_ms);

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
        await delay(CONFIG.delay_entre_paginas);
        
        const response2 = await fetchWithRetry(url2, { method: 'GET', headers: browserHeaders }, CONFIG.max_retries, CONFIG.retry_base_delay_ms);
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
    console.log(`[DJEN Processos] Failed to fetch for ${texto}:`, error);
    return [];
  }
}

async function searchDJENByProcesso(
  numeroProcesso: string,
  dataInicio?: string,
  dataFim?: string,
): Promise<any[]> {
  return await searchDJENByTexto(numeroProcesso, dataInicio, dataFim);
}

async function searchDJENByProcessosBatch(
  processos: Array<{ id: string; numero: string }>,
  dataInicio?: string,
  dataFim?: string,
): Promise<Map<string, any[]>> {
  const map = new Map<string, any[]>();
  if (!processos.length) return map;

  const query = processos.map(p => p.numero).join(' OR ');
  const results = await searchDJENByTexto(query, dataInicio, dataFim);

  for (const pub of results) {
    const conteudo = pub.texto ?? pub.teor ?? pub.conteudo ?? pub.conteudoPublicacao ?? pub.resumo ?? '';
    const explicitNumero =
      pub.processo_numero || pub.numeroProcesso || pub.processo || pub.numero_processo || null;
    const numeroExtraido = extractProcessoNumero(String(conteudo || ''), explicitNumero);
    const key = normalizeProcessoNumero(numeroExtraido || explicitNumero || '');
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(pub);
  }

  return map;
}

// Process a batch of processes in parallel - OTIMIZADO PARA VELOCIDADE
// Coleta todas as publicações primeiro, depois faz batch inserts
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
  
  // Acumuladores para batch insert
  const publicacoesToInsert: any[] = [];
  const seenHashes = new Set<string>();

  const processPublicacoes = (
    processo: { id: string; numero: string; status?: string; coordenacao_id?: string },
    publicacoes: any[],
  ) => {
    if (publicacoes.length > 0) {
      processosComResultados++;
    }

    let novasDoProcesso = 0;

    for (const pub of publicacoes) {
      const conteudo = pub.texto ?? pub.teor ?? pub.conteudo ?? pub.conteudoPublicacao ?? pub.resumo ?? '';
      if (!conteudo || typeof conteudo !== 'string') continue;

      const pubObj = pub.comunicacao || pub;
      
      const rawDataDisponibilizacao = 
        pub.dataDisponibilizacao || pubObj.dataDisponibilizacao ||
        pub.dataDJe || pubObj.dataDJe || 
        pub.dtDisponibilizacao || pubObj.dtDisponibilizacao || 
        pub.dataDisp || pubObj.dataDisp ||
        pub.data_disponibilizacao || pubObj.data_disponibilizacao ||
        null;
        
      const rawDataPublicacao = 
        pub.dataPublicacao || pubObj.dataPublicacao ||
        pub.dataJornal || pubObj.dataJornal || 
        pub.dtPublicacao || pubObj.dtPublicacao || 
        pub.data || pubObj.data || 
        pub.data_publicacao || pubObj.data_publicacao ||
        null;
      
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
        } catch { /* ignore */ }
      }
      
      if (!dataDisponibilizacao && !dataPublicacao) {
        const hoje = getBrazilISODate();
        dataDisponibilizacao = hoje;
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const proximoDiaUtil = calcularPrimeiroDiaUtil(amanha);
        dataPublicacao = proximoDiaUtil.toISOString().split('T')[0];
      } else if (!dataDisponibilizacao && dataPublicacao) {
        dataDisponibilizacao = dataPublicacao;
      }
      
      const conteudoNorm = normalizeConteudo(conteudo);
      const dataKey = (dataPublicacao || dataDisponibilizacao || '').toString();
      const hashConteudo = generateHash(`${processo.numero}|${dataKey}|${conteudoNorm.slice(0, 2000)}`);

      if (seenHashes.has(hashConteudo)) {
        totalDuplicadas++;
        continue;
      }
      seenHashes.add(hashConteudo);
      novasDoProcesso++;

      publicacoesToInsert.push({
        processo_id: processo.id,
        processo_numero: processo.numero,
        hash_conteudo: hashConteudo,
        data_publicacao: dataPublicacao,
        data_disponibilizacao: dataDisponibilizacao,
        conteudo: conteudo,
        fonte: 'pje_comunica',
      });
    }

    if (novasDoProcesso > 0) {
      processosComNovas++;
    }
  };

  // FASE 1: Buscar publicações (modo agrupado ou individual)
  let groupingEnabled = GROUP_SEARCH_SIZE > 1;
  if (!groupingEnabled) {
    // Modo individual em paralelo (conservador)
    for (let i = 0; i < processos.length; i += CONCURRENT_REQUESTS) {
      const chunk = processos.slice(i, i + CONCURRENT_REQUESTS);
      const results = await Promise.all(
        chunk.map(async (processo) => {
          const publicacoes = await searchDJENByProcesso(processo.numero, dataInicio, dataFim);
          return { processo, publicacoes };
        })
      );

      for (const { processo, publicacoes } of results) {
        processPublicacoes(processo, publicacoes);
      }

      if (i + CONCURRENT_REQUESTS < processos.length) {
        await delay(50);
      }
    }
  } else {
    // Modo agrupado: reduz chamadas quando a API aceita OR (auto-desliga se não ajudar)
    for (let i = 0; i < processos.length; i += GROUP_SEARCH_SIZE) {
      const group = processos.slice(i, i + GROUP_SEARCH_SIZE);
      const groupStart = Date.now();
      const groupedMap = await searchDJENByProcessosBatch(group, dataInicio, dataFim);
      const groupDurationMs = Date.now() - groupStart;
      const matchedProcessCount = group.filter((p) => groupedMap.has(normalizeProcessoNumero(p.numero))).length;
      const hitRate = group.length > 0 ? matchedProcessCount / group.length : 0;

      if (groupedMap.size === 0 || (group.length >= 5 && hitRate < MIN_GROUP_HIT_RATE)) {
        console.log(
          `[DJEN Processos] Desligando agrupamento: hitRate=${(hitRate * 100).toFixed(1)}% ` +
          `(${matchedProcessCount}/${group.length}), tempo=${groupDurationMs}ms`
        );
        groupingEnabled = false;
      }

      for (const processo of group) {
        const key = normalizeProcessoNumero(processo.numero);
        let publicacoes = groupedMap.get(key) || [];

        // Fallback para busca individual quando o grupo não retornou nada
        if (publicacoes.length === 0) {
          publicacoes = await searchDJENByProcesso(processo.numero, dataInicio, dataFim);
        }

        processPublicacoes(processo, publicacoes);
      }

      if (i + GROUP_SEARCH_SIZE < processos.length) {
        await delay(100);
      }

      if (!groupingEnabled) {
        // Completar o restante em modo individual
        const remaining = processos.slice(i + GROUP_SEARCH_SIZE);
        for (let j = 0; j < remaining.length; j += CONCURRENT_REQUESTS) {
          const chunk = remaining.slice(j, j + CONCURRENT_REQUESTS);
          const results = await Promise.all(
            chunk.map(async (processo) => {
              const publicacoes = await searchDJENByProcesso(processo.numero, dataInicio, dataFim);
              return { processo, publicacoes };
            })
          );

          for (const { processo, publicacoes } of results) {
            processPublicacoes(processo, publicacoes);
          }

          if (j + CONCURRENT_REQUESTS < remaining.length) {
            await delay(50);
          }
        }
        break;
      }
    }
  }

  // FASE 2: Batch insert de todas as publicações (RÁPIDO)
  if (publicacoesToInsert.length > 0) {
    // Inserir em batches de 100 para evitar payload muito grande
    const BATCH_INSERT_SIZE = 100;
    for (let i = 0; i < publicacoesToInsert.length; i += BATCH_INSERT_SIZE) {
      const batch = publicacoesToInsert.slice(i, i + BATCH_INSERT_SIZE);
      
      const { data: inserted, error } = await supabase
        .from('publicacoes_djen_processos')
        .upsert(batch, { onConflict: 'hash_conteudo', ignoreDuplicates: true })
        .select('id, processo_id, processo_numero, conteudo');
      
      if (error) {
        console.error(`[DJEN Processos] Batch insert error:`, error.message);
        totalDuplicadas += batch.length;
      } else if (inserted) {
        totalNovas += inserted.length;
        totalDuplicadas += batch.length - inserted.length;
        
        // FASE 3: Detectar audiências/intimações para publicações NOVAS (background)
        // Fazer em paralelo para não bloquear
        const detectPromises = inserted.map(async (pub: any) => {
          const conteudo = pub.conteudo || '';
          
          // Detectar audiência
          const audienciaInfo = detectAudiencia(conteudo);
          if (audienciaInfo) {
            await supabase.from('audiencias_detectadas').upsert({
              processo_id: pub.processo_id,
              processo_numero: pub.processo_numero,
              publicacao_id: pub.id,
              data_audiencia: audienciaInfo.dataAudiencia,
              hora: audienciaInfo.hora,
              tipo_audiencia: audienciaInfo.tipoAudiencia,
              local_audiencia: audienciaInfo.localAudiencia,
              contexto: audienciaInfo.contexto,
              conteudo_publicacao: conteudo.slice(0, 5000),
              origem: 'monitoramento_djen_processos',
              status: 'pendente',
            }, { onConflict: 'publicacao_id', ignoreDuplicates: true });
          }
          
          // Detectar intimação
          const intimacaoInfo = detectIntimacao(conteudo, pub.processo_numero);
          if (intimacaoInfo) {
            await supabase.from('intimacoes_detectadas').upsert({
              processo_id: pub.processo_id,
              processo_numero: pub.processo_numero,
              tipo_intimacao: intimacaoInfo.tipoIntimacao,
              prazo_dias: intimacaoInfo.prazoDias,
              contexto: intimacaoInfo.contexto,
              conteudo_publicacao: conteudo.slice(0, 5000),
              origem: 'monitoramento_djen_processos',
              status: 'pendente',
              hash_dedup: intimacaoInfo.hashDedup,
            }, { onConflict: 'hash_dedup', ignoreDuplicates: true });
          }
        });
        
        // Executar detecções em paralelo (não bloqueia o fluxo principal)
        await Promise.all(detectPromises).catch(e => 
          console.log(`[DJEN Processos] Detection errors (non-fatal):`, e.message)
        );
      }
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

  // GUARD: evitar corrida onde um lote atrasado sobrescreve uma execução já finalizada
  // (ex.: marcar de volta como 'executando' após finalizado_em).
  const { data: currentRow, error: readErr } = await supabase
    .from('execucoes_agendadas')
    .select('status, finalizado_em')
    .eq('id', execucaoId)
    .maybeSingle();

  if (readErr) {
    console.error('Error reading execucoes_agendadas before update:', readErr);
  }

  const alreadyFinalized = !!currentRow?.finalizado_em || ['concluido', 'falhou', 'cancelado', 'timeout'].includes(String(currentRow?.status));
  const wantsToReopen = data.status === 'executando' && alreadyFinalized;
  if (wantsToReopen) {
    // Mantém integridade do registro; apenas ignora update tardio.
    return;
  }

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

    await loadConfigFromDatabase(supabase);
    console.log(`[DJEN Processos] Config: paralelo=${CONCURRENT_REQUESTS}, batch=${BATCH_SIZE}, delay=${BASE_DELAY}ms, stagger=${STAGGER_DELAY}ms`);

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
      const hoje = getBrazilISODate();
      dataInicio = hoje;
      dataFim = hoje;
    }

    console.log(`[DJEN Processos] Início: ${dataInicio} a ${dataFim} | completeRun=${completeRun} | continued=${continued} | scheduled=${scheduled} | execucaoId=${execucaoId}`);

    // Get config (sempre global: coordenacao_id IS NULL)
    const { data: config } = await supabase
      .from('configuracoes_monitoramento')
      .select('*')
      .eq('tipo', 'djen_processos')
      .is('coordenacao_id', null)
      .single();

    const meta: any = config?.metadata || {};
    const lastCompleteRun = meta?.last_complete_run ? new Date(meta.last_complete_run) : null;
    const todayYmd = getBrazilISODate();
    const lastCompleteYmd = lastCompleteRun ? getBrazilISODate(lastCompleteRun) : null;

    // Evitar nova execução no mesmo dia após conclusão
    if (completeRun && scheduled && !continued && meta?.status === 'concluido' && lastCompleteYmd === todayYmd) {
      console.log(`[DJEN Processos] Execução já concluída hoje (${todayYmd}); ignorando nova execução.`);
      const doneAt = new Date().toISOString();
      await updateExecucaoProgress(supabase, execucaoId, {
        status: 'concluido',
        registros_processados: Number(meta?.current || 0),
        total_lotes: Number(meta?.total || 0),
        detalhes: { skipped: true, reason: 'already_completed_today' },
        finalizado_em: doneAt,
      });
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: 'Execução já concluída hoje. Ignorando nova execução.',
          dataYmd: todayYmd,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count total - SOMENTE monitorar_djen = true
    const { count: totalProcessos } = await supabase
      .from('processos')
      .select('*', { count: 'exact', head: true })
      .eq('monitorar_djen', true);

    // Regra para execução completa:
    // - primeira chamada (cron/manual completeRun) começa do 0
    // - continuações sempre passam continuarDe
    const checkpointAtual = Math.max(Number(meta?.next_offset || 0), Number(meta?.current || 0));

    // Lógica de offset:
    // 1. Se continuarDe foi passado explicitamente, usa ele
    // 2. Se há next_offset salvo (pode_retomar=true ou status=erro), continua de onde parou
    // 3. Se completeRun=true E não há checkpoint, começa do 0
    // 4. Caso contrário, começa do 0
    let offset: number;
    if (typeof continuarDe === 'number') {
      offset = continuarDe;
      console.log(`[DJEN Processos] Usando offset explícito: ${offset}`);
    } else if (meta.next_offset > 0 && (meta.pode_retomar || meta.status === 'erro' || meta.status === 'em_andamento')) {
      offset = meta.next_offset;
      console.log(`[DJEN Processos] Retomando de checkpoint salvo: ${offset} (status: ${meta.status})`);
    } else {
      offset = 0;
      console.log(`[DJEN Processos] Iniciando novo ciclo do offset 0`);
    }

    // Se for execução manual completa (sem continuação explícita) e o metadata já indica
    // ciclo concluído, reiniciar do zero para permitir reprocessamento no mesmo dia.
    if (
      completeRun &&
      !continued &&
      typeof continuarDe !== 'number' &&
      (meta?.status === 'concluido' ||
        (Number(meta?.total || 0) > 0 && Number(meta?.current || 0) >= Number(meta?.total || 0)))
    ) {
      offset = 0;
      console.log('[DJEN Processos] Reiniciando ciclo manual do offset 0 (metadata concluído)');
      if (config) {
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            ultima_execucao: new Date().toISOString(),
            metadata: {
              ...(config.metadata || {}),
              current: 0,
              total: Number(totalProcessos || 0),
              status: 'em_andamento',
              next_offset: 0,
              has_more: true,
              last_stop_reason: null,
              last_stop_at: null,
              last_error: null,
              cancelado: false,
              pode_retomar: false,
            },
          })
          .eq('tipo', 'djen_processos')
          .is('coordenacao_id', null);
      }
    }

    // ============================================================
    // GUARDA CRÍTICA: ignora invocações atrasadas (offset antigo)
    // ============================================================
    // Quando há rate limit/timeouts, invocações mais antigas podem chegar depois
    // e sobrescrever o progresso (efeito: 100% -> volta para 93%).
    // Se a chamada veio com continuarDe explícito e ela está atrás do checkpoint atual,
    // consideramos esta invocação "stale" e NÃO processamos / NÃO atualizamos / NÃO encadeamos.
    if (typeof continuarDe === 'number' && checkpointAtual > 0 && continuarDe < checkpointAtual) {
      console.log(
        `[DJEN Processos] Ignorando invocação atrasada: continuarDe=${continuarDe} < checkpointAtual=${checkpointAtual}`
      );
      return new Response(
        JSON.stringify({
          success: true,
          stale: true,
          message: 'Invocação atrasada ignorada',
          checkpointAtual,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const total = Number(totalProcessos || 0);
    if (total === 0 || offset >= total) {
      // Complete cycle sem precisar buscar lote (evita timeout quando offset == total)
      const doneAt = new Date().toISOString();
      const finalCurrent = total > 0 ? total : Math.max(checkpointAtual, offset);

      if (config) {
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            ultima_execucao: doneAt,
            metadata: {
              ...(config.metadata || {}),
              current: finalCurrent,
              total,
              percentage: total > 0 ? 100 : 0,
              status: 'concluido',
              last_complete_run: doneAt,
              next_offset: 0,
              has_more: false,
              last_stop_reason: 'completed',
              last_stop_at: doneAt,
              last_error: null,
            },
          })
          .eq('tipo', 'djen_processos')
          .is('coordenacao_id', null);
      }

      const pct = total > 0 ? 100 : 0;
      await updateExecucaoProgress(supabase, execucaoId, {
        status: 'concluido',
        registros_processados: finalCurrent,
        total_lotes: total,
        detalhes: {
          progress: {
            current: finalCurrent,
            total,
            percentage: pct,
          },
        },
        finalizado_em: doneAt,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Ciclo completo',
          processados: 0,
          totalProcessos: total,
          concluido: true,
          tempoMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get batch - SOMENTE monitorar_djen = true
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
      // Complete cycle (ou offset já além do fim)
      const doneAt = new Date().toISOString();
      const total = Number(totalProcessos || 0);
      const finalCurrent = total > 0 ? total : Math.max(checkpointAtual, offset);

      if (config) {
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            ultima_execucao: doneAt,
            metadata: {
              ...(config.metadata || {}),
              current: finalCurrent,
              total,
              percentage: total > 0 ? 100 : 0,
              status: 'concluido',
              last_complete_run: doneAt,
              next_offset: 0,
              has_more: false,
              last_stop_reason: 'completed',
              last_stop_at: doneAt,
              last_error: null,
            },
          })
          .eq('tipo', 'djen_processos')
          .is('coordenacao_id', null);
      }

      // Garante finalização da execução para o frontend (evita ficar "executando" pra sempre)
      const pct = total > 0 ? 100 : 0;
      await updateExecucaoProgress(supabase, execucaoId, {
        status: 'concluido',
        registros_processados: finalCurrent,
        total_lotes: total,
        detalhes: {
          progress: {
            current: finalCurrent,
            total,
            percentage: pct,
          },
        },
        finalizado_em: doneAt,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Ciclo completo',
          processados: 0,
          totalProcessos: total,
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

    // Monotonicidade no backend: nunca permitir que current/next_offset diminua.
    const checkpointBase = Math.max(
      checkpointAtual,
      Number((config?.metadata as any)?.next_offset || 0),
      Number((config?.metadata as any)?.current || 0),
      offset
    );
    const checkpointNow = Math.max(checkpointBase, nextOffset);

    if (config) {
      const progressPercentage = (totalProcessos || 0) > 0 ? Math.min(100, Math.round((checkpointNow / (totalProcessos || 1)) * 100)) : 0;
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          // Heartbeat: deve ser atualizado durante toda a execução.
          // Caso contrário, o orquestrador (executar-monitoramento) marca como "stale" após alguns minutos
          // mesmo com progresso real, causando o efeito "vai e volta / nunca acaba".
          ultima_execucao: new Date().toISOString(),
          metadata: {
            ...(config.metadata || {}),
            // Campos para sincronização realtime via useRealtimeProgress
            current: checkpointNow,
            total: totalProcessos || 0,
            novas: totalNovas,
            status: hasMore ? 'em_andamento' : 'concluido',
            has_more: hasMore,
            percentage: hasMore ? progressPercentage : 100,

            // Limpar marcações de erro/stale quando há progresso real
            last_stop_reason: hasMore ? null : 'completed',
            last_stop_at: hasMore ? null : new Date().toISOString(),
            last_error: null,
            // Campos legados de paginação
            next_offset: hasMore ? checkpointNow : 0,
            last_batch_processos: processos.length,
            last_batch_novas: totalNovas,
            last_batch_offset: offset,
            last_batch_tempo_ms: Date.now() - startTime,
          },
        })
        .eq('tipo', 'djen_processos')
        .is('coordenacao_id', null);
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
    const progressPercentage = (totalProcessos || 0) > 0 ? Math.min(100, Math.round((checkpointNow / (totalProcessos || 1)) * 100)) : 0;
    await updateExecucaoProgress(supabase, execucaoId, {
      status: hasMore ? 'executando' : 'concluido',
      registros_processados: checkpointNow,
      registros_encontrados: totalNovas,
      total_lotes: totalProcessos || 0,
      detalhes: {
        progress: {
          current: checkpointNow,
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
        .is('coordenacao_id', null)
        .maybeSingle();

      const wasCancelled = (freshConfig?.metadata as any)?.cancelado === true;
      const freshMeta = (freshConfig?.metadata as any) || {};
      const freshCheckpoint = Math.max(Number(freshMeta?.next_offset || 0), Number(freshMeta?.current || 0));

      if (wasCancelled) {
        console.log('[DJEN Processos] Cancelamento detectado, parando auto-continuação');
        const currentMeta = (freshConfig?.metadata as Record<string, any>) || {};
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            // Mantém next_offset para poder retomar de onde parou
            metadata: { ...currentMeta, cancelado: false, status: 'cancelado', pode_retomar: true },
          })
          .eq('tipo', 'djen_processos')
          .is('coordenacao_id', null);
      } else if (freshCheckpoint > nextOffset) {
        // Outro lote já avançou o checkpoint (ou esta invocação ficou lenta / rate-limited).
        // Evita disparar uma cadeia paralela que vai sobrescrever progresso com offset antigo.
        console.log(
          `[DJEN Processos] Pulando encadeamento: freshCheckpoint=${freshCheckpoint} > nextOffset=${nextOffset} (invocação atrasada)`
        );
      } else {
        const nextUrl = `${supabaseUrl}/functions/v1/monitorar-djen-processos`;
        const nextBody = {
          dataInicio,
          dataFim,
          continuarDe: checkpointNow,
          completeRun: true,
          scheduled: true,
          continued: true,
          execucaoId, // Propagar execucaoId para atualizar progresso
        };

        // Use anon key for internal calls (verify_jwt = false, so we just need a valid key)
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        const p = (async () => {
          // Throttle ENTRE LOTES (não entre chunks) conforme CONFIG.delay_entre_lotes
          await delay(BASE_DELAY);
          
          // Retry logic para encadeamento - evita travamento em 99%
          const maxChainRetries = 3;
          let chainSuccess = false;
          
          for (let attempt = 0; attempt < maxChainRetries; attempt++) {
            try {
              const r = await fetch(nextUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                },
                body: JSON.stringify(nextBody),
              });
              const t = await r.text().catch(() => '');
              console.log(`[DJEN Processos] Queued next batch offset=${checkpointNow} status=${r.status} body=${t.slice(0, 200)}`);
              
              // Considerar sucesso se status é 2xx ou a função foi invocada (mesmo que tenha erro interno)
              if (r.status >= 200 && r.status < 500) {
                chainSuccess = true;
                break;
              }
              
              // Para 5xx (502, 504, etc) tentar novamente com backoff
              if (r.status >= 500) {
                const waitTime = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s
                console.log(`[DJEN Processos] Chain call failed (${r.status}), retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxChainRetries})`);
                await delay(waitTime);
                continue;
              }
            } catch (fetchErr) {
              const waitTime = 5000 * Math.pow(2, attempt);
              console.log(`[DJEN Processos] Chain fetch error, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxChainRetries}):`, fetchErr);
              await delay(waitTime);
            }
          }
          
          // Se todas as tentativas falharam, marcar como erro para permitir retomada
          if (!chainSuccess) {
            console.error('[DJEN Processos] All chain retries failed - marking as failed for manual resume');
            await supabase
              .from('configuracoes_monitoramento')
              .update({
                metadata: {
                  ...((await supabase.from('configuracoes_monitoramento').select('metadata').eq('tipo', 'djen_processos').is('coordenacao_id', null).maybeSingle()).data?.metadata as Record<string, any> || {}),
                  status: 'falhou',
                  last_error: 'Encadeamento falhou após 3 tentativas (502/504). Use Retomar.',
                  erro_em: new Date().toISOString(),
                  pode_retomar: true,
                },
              })
              .eq('tipo', 'djen_processos')
              .is('coordenacao_id', null);
              
            // Também atualizar execucao_agendada
            if (execucaoId) {
              await updateExecucaoProgress(supabase, execucaoId, {
                status: 'falhou',
                finalizado_em: new Date().toISOString(),
                detalhes: {
                  erro: 'Encadeamento falhou após 3 tentativas',
                },
              });
            }
          }
        })().catch((e) => console.error('[DJEN Processos] Failed to queue next batch', e));

        const er = (globalThis as any).EdgeRuntime;
        if (er?.waitUntil) er.waitUntil(p);
      }
    }

    // ========== ENVIO DE RESUMO CONSOLIDADO AO FINAL ==========
    if (completeRun && !hasMore) {
      console.log('[DJEN Processos] Execução completa! Enviando resumo consolidado...');
      
      try {
        // Buscar publicações DJEN criadas hoje agrupadas por coordenação
        const hojeISO = getBrazilISODate();
        const { startUtc, endUtc } = getBrazilDayUtcRange(hojeISO);
        
        const { data: publicacoesHoje } = await supabase
          .from('publicacoes_djen_processos')
          .select(`
            id,
            processo_numero,
            data_disponibilizacao,
            conteudo,
            processo_id,
            processos!inner(
              id,
              numero,
              coordenacao_id,
              coordenacoes(id, nome)
            )
          `)
          .gte('created_at', startUtc)
          .lt('created_at', endUtc)
          .order('created_at', { ascending: false });

        if (publicacoesHoje && publicacoesHoje.length > 0) {
          console.log(`[DJEN Processos] ${publicacoesHoje.length} publicações encontradas hoje para resumo`);
          
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
            const processo = pub.processos as any;
            const coordId = processo?.coordenacao_id;
            const coordNome = processo?.coordenacoes?.nome || 'Sem Coordenação';
            
            if (!coordId) continue;
            
            if (!porCoordenacao.has(coordId)) {
              porCoordenacao.set(coordId, {
                coordenacao_nome: coordNome,
                publicacoes: []
              });
            }
            
            porCoordenacao.get(coordId)!.publicacoes.push({
              processo_numero: processo?.numero || pub.processo_numero || 'N/A',
              conteudo: (pub.conteudo || '').substring(0, 200) + ((pub.conteudo || '').length > 200 ? '...' : ''),
              data: pub.data_disponibilizacao || hojeISO
            });
          }

          // Enviar resumo para cada coordenação (formato array conforme interface ResumoPayload)
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

            console.log(`[DJEN Processos] Enviando resumo para ${resumosPorCoordenacao.length} coordenações`);
            
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
            
            const resumoPromise = fetch(`${supabaseUrl}/functions/v1/enviar-resumo-monitoramento`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                tipo_monitoramento: 'djen_processos',
                resumos_por_coordenacao: resumosPorCoordenacao
              })
            })
              .then(r => r.json())
              .then(data => console.log('[DJEN Processos] Resumo enviado:', JSON.stringify(data).slice(0, 300)))
              .catch(err => console.error('[DJEN Processos] Erro ao enviar resumo:', err));

            const er = (globalThis as any).EdgeRuntime;
            if (er?.waitUntil) er.waitUntil(resumoPromise);
          }
        } else {
          console.log('[DJEN Processos] Nenhuma publicação encontrada hoje para resumo');
        }
      } catch (resumoError) {
        console.error('[DJEN Processos] Erro ao preparar resumo:', resumoError);
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
    
    // IMPORTANTE: Salvar offset atual para permitir retomada de onde parou
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: config } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen_processos')
        .maybeSingle();
      
      const currentMeta = (config?.metadata as Record<string, any>) || {};
      const currentOffset = currentMeta.next_offset || 0;
      
      // Marcar como erro mas preservar next_offset para retomada
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...currentMeta,
            status: 'erro',
            ultimo_erro: errorMessage,
            erro_em: new Date().toISOString(),
            // Preservar next_offset para retomada automática
            pode_retomar: true,
            last_stop_reason: 'error',
            last_stop_at: new Date().toISOString(),
          },
        })
        .eq('tipo', 'djen_processos');

      // Nota: execucaoId não está disponível neste catch externo (escopo diferente)
      // A atualização do status será feita apenas via configuracoes_monitoramento
      
      console.log(`[DJEN Processos] Offset ${currentOffset} salvo para retomada`);
    } catch (saveError) {
      console.error('[DJEN Processos] Falha ao salvar offset para retomada:', saveError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage, 
        tempoMs: Date.now() - startTime,
        podeRetomar: true,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
