// supabase/functions/monitorar-djen/index.ts - VERSÃO COMPLETA CONSOLIDADA

import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================================
// CORS HEADERS
// ============================================================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================================
// CONFIG
// ============================================================================
const INTER_PAGE_DELAY_MS = 800;
const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

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

const browserHeaders = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://comunica.pje.jus.br",
  "Referer": "https://comunica.pje.jus.br/",
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBrazilISODate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
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

function generateGlobalHash(conteudo: string, dataDisponibilizacao: string): string {
  const normalized = (conteudo + dataDisponibilizacao).toLowerCase().replace(/\s+/g, ' ').trim();
  return generateHash(normalized);
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
    if (match) return match[1];
  }
  return null;
}

function calcularPrimeiroDiaUtil(dataBase: Date, diasUteisAdicionar: number = 0): Date {
  const resultado = new Date(dataBase);
  const estaNoRecesso = (d: Date): boolean => {
    const mes = d.getMonth();
    const dia = d.getDate();
    return (mes === 11 && dia >= 20) || (mes === 0 && dia <= 6);
  };
  const proximoDiaUtil = (d: Date): Date => {
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    if (estaNoRecesso(d)) {
      d.setMonth(0);
      d.setDate(7);
      if (d.getMonth() === 11) d.setFullYear(d.getFullYear() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
    }
    return d;
  };
  proximoDiaUtil(resultado);
  let contador = 0;
  while (contador < diasUteisAdicionar) {
    resultado.setDate(resultado.getDate() + 1);
    proximoDiaUtil(resultado);
    contador++;
  }
  return resultado;
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}


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
  if (expandidos.size > 15) {
    console.log(`[DJEN] Expandiu para ${expandidos.size} tribunais. Buscando sem filtro.`);
    return null;
  }
  return Array.from(expandidos);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================
interface Monitoramento {
  id: string;
  tipo: string;
  termo_busca: string;
  termos_or?: string[] | null;
  oab?: string | null;
  uf?: string | null;
  tribunais?: string[] | null;
  exclusoes?: string[] | null;
  condicao_concomitante?: string | null;
  coordenacao_id?: string | null;
  responsaveis_ids?: string[] | null;
  criar_tarefa_auto?: boolean;
}

function normalizarParaBusca(termo: string): string {
  return termo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairPalavraChavePura(termo: string): string {
  return termo.replace(/^["']|["']$/g, '').trim();
}

function buildAdvogadoTargets(
  termoPrincipal: string,
  termosOr?: string[],
  oab?: string | null,
  uf?: string | null
): Array<{ nome?: string; oabDigits?: string }> {
  const targets: Array<{ nome?: string; oabDigits?: string }> = [];
  if (oab) {
    const digits = oab.replace(/\D/g, '');
    if (digits) targets.push({ oabDigits: digits });
  }
  if (termoPrincipal) targets.push({ nome: termoPrincipal });
  if (termosOr) {
    for (const t of termosOr) {
      if (t.trim()) targets.push({ nome: t.trim() });
    }
  }
  return targets.length > 0 ? targets : [{ nome: termoPrincipal || undefined }];
}

function conteudoContemTermoOuOr(conteudo: string, mon: Monitoramento): boolean {
  const conteudoNorm = normalizarParaBusca(conteudo);
  
  if (mon.tipo === 'advogado' && mon.oab) {
    const oabDigits = mon.oab.replace(/\D/g, '');
    if (oabDigits && conteudoNorm.includes(oabDigits)) return true;
  }
  
  const termoPuro = extrairPalavraChavePura(mon.termo_busca || '');
  const termoNorm = normalizarParaBusca(termoPuro);
  if (termoNorm && conteudoNorm.includes(termoNorm)) return true;
  
  if (mon.termos_or && mon.termos_or.length > 0) {
    for (const t of mon.termos_or) {
      const tNorm = normalizarParaBusca(extrairPalavraChavePura(t));
      if (tNorm && conteudoNorm.includes(tNorm)) return true;
    }
  }
  
  return false;
}

function condicaoConcomitanteAtendida(conteudo: string, condicao?: string | null): boolean {
  if (!condicao) return true;
  const conteudoNorm = normalizarParaBusca(conteudo);
  const condicaoNorm = normalizarParaBusca(condicao);
  return conteudoNorm.includes(condicaoNorm);
}

function shouldExclude(conteudo: string, exclusoes: string[]): string | null {
  if (!exclusoes || exclusoes.length === 0) return null;
  const conteudoNorm = normalizarParaBusca(conteudo);
  for (const exc of exclusoes) {
    const excNorm = normalizarParaBusca(exc);
    if (excNorm && conteudoNorm.includes(excNorm)) return exc;
  }
  return null;
}

// ============================================================================
// FETCH WITH RETRY
// ============================================================================
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 4,
  baseDelay = 3000,
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

// ============================================================================
// INDEX SEARCH FUNCTIONS
// ============================================================================
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
      .select('id, conteudo, data_disponibilizacao, data_publicacao, processo_numero, tribunal, raw_json')
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
      .select('id, conteudo, data_disponibilizacao, data_publicacao, processo_numero, tribunal, raw_json')
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

// ============================================================================
// PUBLICATION PROCESSING
// ============================================================================
async function processPublicationFromIndex(
  supabase: any,
  pub: any,
  monitoramento: Monitoramento,
  stats: { novas: number; descartadas: number; duplicatas: number },
  tribunal: string | null,
  dataAtual: string
) {
  const conteudo = String(pub?.conteudo || pub?.texto || pub?.teor || pub?.descricao || "");
  const hashConteudo = generateHash(conteudo + (pub.data_disponibilizacao || pub.data_publicacao || pub.data || ''));

  let dataDisponibilizacao = pub.data_disponibilizacao || pub.dataDisponibilizacao || null;
  let dataPublicacao = pub.data_publicacao || pub.dataPublicacao || null;

  if (dataDisponibilizacao && !dataPublicacao) {
    try {
      const dispDate = new Date(dataDisponibilizacao);
      if (!isNaN(dispDate.getTime())) {
        dispDate.setDate(dispDate.getDate() + 1);
        const proximoDiaUtil = calcularPrimeiroDiaUtil(dispDate);
        dataPublicacao = formatLocalDate(proximoDiaUtil);
      }
    } catch { /* ignore */ }
  }

  if (!dataDisponibilizacao && !dataPublicacao) {
    dataDisponibilizacao = dataAtual;
    const hoje = new Date(dataAtual);
    hoje.setDate(hoje.getDate() + 1);
    const proximoDiaUtil = calcularPrimeiroDiaUtil(hoje);
    dataPublicacao = formatLocalDate(proximoDiaUtil);
  } else if (!dataDisponibilizacao && dataPublicacao) {
    dataDisponibilizacao = dataPublicacao;
  }

  if (!conteudoContemTermoOuOr(conteudo, monitoramento)) {
    stats.descartadas++;
    return;
  }

  const globalHash = generateGlobalHash(conteudo, dataDisponibilizacao);

  const { data: existingGlobal } = await supabase
    .from('publicacoes_djen_global_hash')
    .select('id')
    .eq('hash_global', globalHash)
    .maybeSingle();

  if (existingGlobal) {
    stats.duplicatas++;
    return;
  }

  const processoNumero = extractProcessoNumero(conteudo, pub.processo_numero || pub.numeroProcesso || pub.processo);

  // Extrair metadados estruturados ANTES dos checks de descarte
  const { extrairDadosLadoEsquerdo, conteudoAteLadoEsquerdo, extrairLadoEsquerdoDeRawJson } = await import("./utils.ts");
  const ladoRawD = pub.raw_json ? extrairLadoEsquerdoDeRawJson(pub.raw_json) : null;
  const conteudoLeftOnlyD = conteudoAteLadoEsquerdo(conteudo);
  const ladoConteudoD = extrairDadosLadoEsquerdo(conteudoLeftOnlyD);
  const metadataDescartada = {
    orgao: (ladoRawD?.orgao) ?? ladoConteudoD.orgao ?? null,
    tipo_comunicacao: (ladoRawD?.tipo_comunicacao) ?? ladoConteudoD.tipo_comunicacao ?? null,
    meio: (ladoRawD?.meio) ?? ladoConteudoD.meio ?? null,
    partes_json: (ladoRawD?.partes?.length ? ladoRawD.partes : null) ?? (ladoConteudoD.partes.length > 0 ? ladoConteudoD.partes : null),
    advogados_json: (ladoRawD?.advogados?.length ? ladoRawD.advogados : null) ?? (ladoConteudoD.advogados.length > 0 ? ladoConteudoD.advogados : null),
  };

  if (!condicaoConcomitanteAtendida(conteudo, monitoramento.condicao_concomitante)) {
    await supabase.from('publicacoes_djen_descartadas').insert({
      monitoramento_id: monitoramento.id,
      hash_conteudo: hashConteudo,
      conteudo,
      data_publicacao: dataPublicacao,
      data_disponibilizacao: dataDisponibilizacao,
      processo_numero: processoNumero,
      tribunal: tribunal || null,
      motivo_descarte: 'condicao_concomitante',
      ...metadataDescartada,
    });

    await supabase.from('publicacoes_djen_global_hash').insert({
      hash_global: globalHash,
      primeiro_monitoramento_id: monitoramento.id,
    });

    stats.descartadas++;
    return;
  }

  const motivoExclusao = shouldExclude(conteudo, monitoramento.exclusoes || []);

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
      ...metadataDescartada,
    });

    await supabase.from('publicacoes_djen_global_hash').insert({
      hash_global: globalHash,
      primeiro_monitoramento_id: monitoramento.id,
    });

    stats.descartadas++;
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
    ...metadataDescartada,
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
}

// ============================================================================
// PROCESS MONITORAMENTO
// ============================================================================
async function processMonitoramentoIndexed(
  supabase: any,
  monitoramento: Monitoramento,
  diarioYmd: string
): Promise<{ novas: number; descartadas: number; duplicatas: number }> {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  const dataAtual = formatLocalDate(new Date());

  const tribunaisExpandidos = expandirTribunais(monitoramento.tribunais);
  const tribunais = tribunaisExpandidos && tribunaisExpandidos.length > 0
    ? tribunaisExpandidos
    : [null];

  for (const tribunal of tribunais) {
    const candidatos = new Map<string, any>();
    const termosBase = [
      monitoramento.termo_busca,
      ...(monitoramento.termos_or || []),
    ].filter(Boolean) as string[];

    if (monitoramento.tipo === 'advogado' || monitoramento.tipo === 'nome') {
      const termoPuro = extrairPalavraChavePura(monitoramento.termo_busca);
      const termosOrPuros = (monitoramento.termos_or || []).map((t) => extrairPalavraChavePura(t.trim())).filter(Boolean);
      const targets = monitoramento.tipo === 'advogado'
        ? buildAdvogadoTargets(termoPuro, termosOrPuros.length > 0 ? termosOrPuros : undefined, monitoramento.oab, monitoramento.uf)
        : [{ nome: termoPuro || undefined }];
      
      for (const target of targets) {
        if (target.oabDigits) {
          const items = await buscarNoIndiceOab(supabase, diarioYmd, tribunal, target.oabDigits);
          for (const item of items) candidatos.set(item.id, item);
        }
        if (target.nome) {
          const items = await buscarNoIndiceDiario(supabase, diarioYmd, tribunal, target.nome);
          for (const item of items) candidatos.set(item.id, item);
        }
      }
    } else if (monitoramento.tipo === 'processo') {
      const numero = String(monitoramento.termo_busca || '').replace(/\D/g, '');
      const items = await buscarNoIndiceOab(supabase, diarioYmd, tribunal, numero);
      for (const item of items) candidatos.set(item.id, item);
    } else {
      for (const termo of termosBase) {
        const items = await buscarNoIndiceDiario(supabase, diarioYmd, tribunal, termo);
        for (const item of items) candidatos.set(item.id, item);
      }
    }

    for (const pub of candidatos.values()) {
      await processPublicationFromIndex(supabase, pub, monitoramento, stats, tribunal || pub.tribunal, dataAtual);
    }
  }

  console.log(`Mon ${monitoramento.id}: novas=${stats.novas}, desc=${stats.descartadas}, dup=${stats.duplicatas}`);
  return stats;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const execucaoId = body?.execucaoId;
    const diarioYmd = body?.diarioYmd || getBrazilISODate();
    
    console.log(`[DJEN] Started for ${diarioYmd}`);

    // Load active monitoramentos
    const { data: monitoramentos, error: monError } = await supabase
      .from('monitoramentos_djen')
      .select('id, tipo, termo_busca, termos_or, oab, uf, tribunais, exclusoes, condicao_concomitante, coordenacao_id, responsaveis_ids, criar_tarefa_auto')
      .eq('ativo', true);

    if (monError) {
      throw new Error(`Failed to load monitoramentos: ${monError.message}`);
    }

    console.log(`[DJEN] Processing ${monitoramentos?.length || 0} monitoramentos`);

    let totalNovas = 0;
    let totalDescartadas = 0;
    let totalDuplicatas = 0;

    for (const mon of (monitoramentos || [])) {
      try {
        const result = await processMonitoramentoIndexed(supabase, mon, diarioYmd);
        totalNovas += result.novas;
        totalDescartadas += result.descartadas;
        totalDuplicatas += result.duplicatas;
      } catch (err) {
        console.error(`Error processing mon ${mon.id}:`, err);
      }
    }

    // Update execution if provided
    if (execucaoId) {
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          ultima_execucao: new Date().toISOString(),
          metadata: {
            novas: totalNovas,
            descartadas: totalDescartadas,
            duplicatas: totalDuplicatas,
            diario: diarioYmd,
          }
        })
        .eq('tipo', 'DJEN');
    }

    console.log(`[DJEN] Done: novas=${totalNovas}, desc=${totalDescartadas}, dup=${totalDuplicatas}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        novas: totalNovas,
        descartadas: totalDescartadas,
        duplicatas: totalDuplicatas,
        monitoramentos: monitoramentos?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DJEN] Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
