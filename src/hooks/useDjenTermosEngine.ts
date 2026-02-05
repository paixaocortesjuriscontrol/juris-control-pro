/**
 * DJEN Termos Engine v2.0
 * 
 * Arquitetura singleton com execução em background:
 * - Continua rodando mesmo ao sair da tela
 * - 1 dia completo antes de avançar para o próximo
 * - Progresso global + indicador do dia atual
 * - Retomada somente manual (sem auto-restart)
 * 
 * REGRAS:
 * 1. Apenas uma execução ativa por vez (singleton)
 * 2. Cada dia é processado completamente antes do próximo
 * 3. Checkpoints salvos após cada termo para retomada exata
 * 4. Totalizadores são globais (soma de todos os dias)
 */

import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaPaginado } from "@/utils/pjeComunicaClient";

// ============================================================================
// TIPOS
// ============================================================================

export interface DjenTermosProgress {
  status: 'idle' | 'executando' | 'concluido' | 'cancelado' | 'erro';
  
  // Progresso global
  globalCurrent: number;     // termos processados no total (todos os dias)
  globalTotal: number;       // total de termos × dias
  percentage: number;        // % global
  
  // Indicador do dia atual
  diaAtualYmd: string | null;
  diaAtualIndice: number;    // 1-based
  totalDias: number;
  termoAtualNoDia: number;   // índice do termo no dia (1-based)
  totalTermos: number;       // total de termos (por dia)
  
  // Estatísticas acumuladas
  novas: number;
  duplicadas: number;
  descartadas: number;
  descartadasTribunal: number;
  
  // UI
  mensagem: string;
  termoAtual: string | null;
  tempoDecorrido: number;
  
  // Intervalo de busca
  dataInicioYmd: string | null;
  dataFimYmd: string | null;
}

interface Checkpoint {
  /**
   * Identificador único da execução.
   * v2+: "{dataInicioYmd}..{dataFimYmd}" (evita conflito quando apenas dataFim coincide)
   * legado: apenas dataFimYmd
   */
  runKey: string;
  diaIndice: number;         // índice do dia (0-based)
  termoIndice: number;       // índice do termo (0-based)
  novas: number;
  duplicadas: number;
  descartadas: number;
  tempoInicio: number;
  dataInicioYmd: string;
  dataFimYmd: string;

  // Para mostrar % exata e consistente na UI (sem aproximações)
  globalCurrent?: number;
  globalTotal?: number;
  percentage?: number;
  totalDias?: number;
  totalTermos?: number;
}

interface Monitoramento {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte';
  termo_busca: string;
  oab?: string;
  uf?: string;
  ativo: boolean;
  exclusoes?: string[];
  tribunais?: string[];
  descricao?: string | null;
  condicao_concomitante?: string | null;
}

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

// Parâmetros ajustados para acelerar execução sem perder estabilidade
const CONFIG = {
  delay_between_terms: 1500,     // 1.5s entre termos (mais conservador)
  delay_between_tribunals: 1200, // 1.2s entre tribunais
  delay_between_variants: 600,   // 0.6s entre variantes
  delay_on_rate_limit: 15000,    // 15s no rate limit
  concurrent_variants: 1,        // paralelismo conservador
  page_delay_ms: 1500,           // delay entre páginas
  max_retries: 4,                // mais tentativas antes de desistir
  retry_base_delay: 10000,       // base maior para 429
};
const METADATA_PERSIST_MIN_INTERVAL_MS = 3000;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ============================================================================
// SINGLETON STATE (persiste mesmo saindo da tela)
// ============================================================================

let singletonState: {
  isRunning: boolean;
  progress: DjenTermosProgress;
  checkpoint: Checkpoint | null;
  abortController: AbortController | null;
  executionId: string | null;
  listeners: Set<(p: DjenTermosProgress) => void>;
  timerInterval: ReturnType<typeof setInterval> | null;
  lastMetadataPersistAt: number;
  metadataPersistInFlight: Promise<void> | null;
  lastDetalhesPersistAt: number;
  turboDisabled: boolean;
  sharedAdvogadoCache: Map<string, any[]>;
} = {
  isRunning: false,
  progress: createDefaultProgress(),
  checkpoint: null,
  abortController: null,
  executionId: null,
  listeners: new Set(),
  timerInterval: null,
  lastMetadataPersistAt: 0,
  metadataPersistInFlight: null,
  lastDetalhesPersistAt: 0,
  turboDisabled: false,
  sharedAdvogadoCache: new Map(),
};

const STORAGE_KEY = 'djen-termos-checkpoint-v2';
const TERM_STATS_KEY = 'djen-termos-stats-v1';
const BR_TZ = 'America/Sao_Paulo';

// ============================================================================
// HELPERS
// ============================================================================

function createDefaultProgress(): DjenTermosProgress {
  return {
    status: 'idle',
    globalCurrent: 0,
    globalTotal: 0,
    percentage: 0,
    diaAtualYmd: null,
    diaAtualIndice: 0,
    totalDias: 0,
    termoAtualNoDia: 0,
    totalTermos: 0,
    novas: 0,
    duplicadas: 0,
    descartadas: 0,
    descartadasTribunal: 0,
    mensagem: '',
    termoAtual: null,
    tempoDecorrido: 0,
    dataInicioYmd: null,
    dataFimYmd: null,
  };
}

function ymdInTimeZone(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}

function getHojeBrasilia(): string {
  return ymdInTimeZone(new Date());
}

function gerarListaDatas(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  const d = new Date(`${inicio}T12:00:00`);
  const end = new Date(`${fim}T12:00:00`);
  
  while (d <= end) {
    datas.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  
  return datas;
}

function saveCheckpoint(cp: Checkpoint | null) {
  if (cp) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cp, savedAt: Date.now() }));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  singletonState.checkpoint = cp;
}

function loadCheckpoint(): Checkpoint | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expirar após 24h
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

type TermStats = Record<string, { foundTotal: number; lastFoundAt: number }>;

function loadTermStats(): TermStats {
  try {
    const raw = localStorage.getItem(TERM_STATS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TermStats;
  } catch {
    return {};
  }
}

function saveTermStats(stats: TermStats) {
  try {
    localStorage.setItem(TERM_STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

function ordenarTermosPorRelevancia(
  termos: Monitoramento[],
  contagensMap?: Map<string, number>
): Monitoramento[] {
  const stats = loadTermStats();
  return termos
    .map((t, idx) => ({
      t,
      idx,
      s: stats[t.id],
      total: contagensMap?.get(t.id) ?? null,
    }))
    .sort((a, b) => {
      if (a.t.tipo === 'advogado' && b.t.tipo !== 'advogado') return -1;
      if (a.t.tipo !== 'advogado' && b.t.tipo === 'advogado') return 1;
      if (typeof a.total === 'number' && typeof b.total === 'number' && a.total !== b.total) {
        return b.total - a.total;
      } else if (typeof a.total === 'number' && typeof b.total !== 'number') {
        return -1;
      } else if (typeof a.total !== 'number' && typeof b.total === 'number') {
        return 1;
      }
      if (a.s && b.s) {
        if (a.s.lastFoundAt !== b.s.lastFoundAt) {
          return b.s.lastFoundAt - a.s.lastFoundAt;
        }
        if (a.s.foundTotal !== b.s.foundTotal) {
          return b.s.foundTotal - a.s.foundTotal;
        }
      } else if (a.s && !b.s) {
        return -1;
      } else if (!a.s && b.s) {
        return 1;
      }
      return a.idx - b.idx;
    })
    .map((x) => x.t);
}

function notifyListeners() {
  for (const listener of singletonState.listeners) {
    listener(singletonState.progress);
  }
}

function updateProgress(partial: Partial<DjenTermosProgress>) {
  singletonState.progress = { ...singletonState.progress, ...partial };
  notifyListeners();
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  if (items.length === 0) return;
  const poolSize = Math.max(1, Math.min(limit, items.length));
  let index = 0;

  const workers = Array.from({ length: poolSize }, async () => {
    while (true) {
      const current = index++;
      if (current >= items.length) break;
      await worker(items[current]);
    }
  });

  await Promise.all(workers);
}

type RuntimeConfig = {
  delay_between_terms: number;
  delay_between_tribunals: number;
  delay_between_variants: number;
  delay_on_rate_limit: number;
  concurrent_variants: number;
  page_delay_ms: number;
  max_retries: number;
  retry_base_delay: number;
};

function getRuntimeConfig(turbo: boolean): RuntimeConfig {
  if (!turbo) return { ...CONFIG };
  return {
    delay_between_terms: 500,
    delay_between_tribunals: 400,
    delay_between_variants: 150,
    delay_on_rate_limit: CONFIG.delay_on_rate_limit,
    concurrent_variants: 3,
    page_delay_ms: 700,
    max_retries: 3,
    retry_base_delay: 8000,
  };
}

async function persistMetadata(
  metadata: Record<string, any>,
  opts: { force?: boolean } = {}
) {
  const now = Date.now();
  if (!opts.force && now - singletonState.lastMetadataPersistAt < METADATA_PERSIST_MIN_INTERVAL_MS) {
    return;
  }

  if (singletonState.metadataPersistInFlight) {
    if (!opts.force) return;
    await singletonState.metadataPersistInFlight;
  }

  singletonState.lastMetadataPersistAt = now;
  const promise = (async () => {
    try {
      await supabase
        .from('configuracoes_monitoramento')
        .update({ metadata })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
    } catch (err: any) {
      console.warn('[DJEN] Falha ao atualizar metadata:', err?.message || err);
    } finally {
      if (singletonState.metadataPersistInFlight === promise) {
        singletonState.metadataPersistInFlight = null;
      }
    }
  })();

  singletonState.metadataPersistInFlight = promise;
  if (opts.force) {
    await promise;
  }
}

// ============================================================================
// LÓGICA DE BUSCA (com validação completa)
// ============================================================================

const TODOS_CIVEIS = ['TJAC','TJAL','TJAM','TJAP','TJBA','TJCE','TJDFT','TJES','TJGO','TJMA','TJMG','TJMS','TJMT','TJPA','TJPB','TJPE','TJPI','TJPR','TJRJ','TJRN','TJRO','TJRR','TJRS','TJSC','TJSE','TJSP','TJTO'];
const TODOS_TRT = ['TST','TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9','TRT10','TRT11','TRT12','TRT13','TRT14','TRT15','TRT16','TRT17','TRT18','TRT19','TRT20','TRT21','TRT22','TRT23','TRT24'];

function expandirTribunais(tribunais?: string[]): string[] {
  if (!tribunais?.length) return [];
  const set = new Set<string>();
  for (const t of tribunais) {
    if (t === 'TODOS_CIVEIS') TODOS_CIVEIS.forEach(x => set.add(x));
    else if (t === 'TODOS_TRT') TODOS_TRT.forEach(x => set.add(x));
    else set.add(t.toUpperCase());
  }
  return Array.from(set);
}

function getSiglaTribunal(item: any): string | null {
  const raw =
    item?.siglaTribunal ||
    item?.tribunal ||
    item?.orgao ||
    item?.nomeOrgao ||
    item?.nome_orgao ||
    null;
  if (!raw || typeof raw !== 'string') return null;
  const up = raw.toUpperCase();
  // Tenta extrair siglas comuns do início
  const m = up.match(/\b(TJ\w+|TRT\d+|TRF\d+|TST|STJ|STF)\b/);
  return m?.[1] ?? up.trim();
}

function gerarHash(conteudo: string, data: string): string {
  const key = `${data}|${conteudo}`.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 500);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ============================================================================
// VALIDAÇÃO DE CONTEÚDO (crítico para qualidade)
// ============================================================================

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[&\/\\]/g, ' ')
    // Remove pontuação geral para permitir match por palavra (ex: "LTDA." -> "LTDA")
    .replace(/[^0-9A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contemTokenInteiro(conteudoNorm: string, token: string): boolean {
  if (!token) return true;
  // conteudoNorm já está normalizado e com espaços colapsados
  const re = new RegExp(`(?:^|\\s)${escapeRegex(token)}(?:\\s|$)`);
  return re.test(conteudoNorm);
}

/** Frase exata na ordem - "Super Quadra" só casa com "Super Quadra", não com "enquadramento". */
function contemFraseExata(conteudoNorm: string, termoNorm: string): boolean {
  if (!termoNorm) return true;
  const re = new RegExp(`(?:^|\\s)${escapeRegex(termoNorm)}(?:\\s|$)`);
  return re.test(conteudoNorm);
}

function termoAtendidoPorPalavras(conteudoNorm: string, termo: string): boolean {
  const termoNorm = normalizar(termo);
  if (!termoNorm) return true;
  return contemFraseExata(conteudoNorm, termoNorm);
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

/**
 * Valida se o conteúdo realmente contém o termo buscado.
 * 
 * Para ADVOGADO:
 *  - OAB deve estar presente (regex flexível)
 *  - Nome deve ter 80% das palavras encontradas
 * 
 * Para PALAVRA-CHAVE/PARTE:
 *  - 100% das palavras do termo devem estar no conteúdo (validação estrita)
 *  - Isso evita capturas parciais como "Distribuidora" quando o termo é 
 *    "F & F Distribuidora de Produtos Farmacêuticos LTDA"
 */
function conteudoContemTermo(
  conteudo: string,
  termo: string,
  tipo: string,
  oab?: string
): boolean {
  if (!conteudo) return false;

  const conteudoNorm = normalizar(conteudo);

  // Para nome: validar frase exata do nome (como advogado sem OAB)
  if (tipo === 'nome') {
    if (!termo) return true;
    const termoNorm = normalizar(termo);
    return contemFraseExata(conteudoNorm, termoNorm);
  }

  // Para advogado: validar OAB + Nome
  if (tipo === 'advogado') {
    // Para advogado, o conteúdo nem sempre contém a OAB (apesar de a consulta retornar pelo filtro).
    // Regra: se houver NOME, o nome é a validação principal; OAB vira “melhoria” (não bloqueante).
    // Se NÃO houver nome, aí sim exigimos OAB no conteúdo (para evitar falso positivo).

    // 1) Validar nome do advogado (se informado) - 80% das palavras
    if (termo) {
      const termoNorm = normalizar(termo);
      const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length >= 2);

      if (palavrasTermo.length > 0) {
        const minPalavras = Math.ceil(palavrasTermo.length * 0.8);
        const palavrasEncontradas = palavrasTermo.filter(p => contemTokenInteiro(conteudoNorm, p));

        if (palavrasEncontradas.length < minPalavras) {
          return false;
        }
      }
      // Nome ok → aceitar mesmo que OAB não apareça no texto.
      return true;
    }

    // 2) Sem nome: exigir OAB no conteúdo
    if (oab) {
      const oabDigits = String(oab).replace(/\D/g, '');
      if (oabDigits.length < 3) return false;

      // Regex flexível: aceita pontos/espaços entre dígitos (ex: 15.553 ou 15 553)
      const oabPattern = new RegExp(oabDigits.split('').join('[.\\s-]?'), 'i');
      return oabPattern.test(conteudo);
    }

    // Sem nome e sem OAB: não validar (evita aceitar tudo)
    return false;
  }

  // Para palavra-chave/parte: FRASE EXATA na ordem - "Super Quadra" só casa com "Super Quadra"
  if (!termo) return true;
  const termoNorm = normalizar(termo);
  return contemFraseExata(conteudoNorm, termoNorm);
}

// ============================================================================
// HELPERS PARA BUSCA
// ============================================================================

/**
 * Para PALAVRA-CHAVE: usa SOMENTE a palavra-chave pura.
 * Remove prefixos de tribunal/tipo (filtros separados - mon.tribunais).
 * Ex: "TJDFT - Adv. Osmar Mendes" → "Osmar Mendes"
 * Regra: palavra-chave = só o termo; tribunais/filtros = quando selecionados.
 */
function extrairPalavraChavePura(termo: string): string {
  if (!termo?.trim()) return termo;
  let s = termo.trim();
  // Tribunais (TJxx, TRTxx, TRFxx, STJ, STF, TST) + " - Adv." ou " - "
  s = s.replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*Adv\.?\s*/i, '');
  s = s.replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*/i, '');
  s = s.replace(/^Adv\.?\s*/i, '');
  return s.trim() || termo;
}

/**
 * Gera variantes de busca para melhor cobertura.
 * 
 * IMPORTANTE: Para termos com caracteres especiais como "&",
 * gera variantes sem e com espaços para capturar diferentes indexações.
 * Ex: "F & F Distribuidora" → ["F & F Distribuidora", "F F Distribuidora"]
 */
function gerarVariantes(termo: string): string[] {
  const variantes = new Set<string>();
  variantes.add(termo);
  
  // Variante sem acentos
  const semAcento = termo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (semAcento !== termo) {
    variantes.add(semAcento);
  }
  
  // Variante com & substituído por espaço (tribunais podem indexar diferente)
  if (termo.includes('&')) {
    const semAmpersand = termo.replace(/\s*&\s*/g, ' ').replace(/\s+/g, ' ').trim();
    variantes.add(semAmpersand);
    
    // Também sem acentos
    const semAmpersandSemAcento = semAmpersand.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (semAmpersandSemAcento !== semAmpersand) {
      variantes.add(semAmpersandSemAcento);
    }
  }
  
  // Gerar variante curta (2 primeiras palavras significativas >= 2 caracteres)
  // Filtrar &, /, etc. para encontrar palavras reais
  const palavrasSignificativas = termo.split(/\s+/).filter(p => p.length >= 2 && !/^[&\/\\]+$/.test(p));
  if (palavrasSignificativas.length >= 3) {
    const curta = palavrasSignificativas.slice(0, 2).join(' ');
    variantes.add(curta);
    
    // Curta sem acentos também
    const curtaSemAcento = curta.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (curtaSemAcento !== curta) {
      variantes.add(curtaSemAcento);
    }
  }
  
  return Array.from(variantes);
}

function parseUfs(ufValue: string): string[] {
  if (!ufValue || ufValue === 'TODAS') return [];
  if (ufValue.includes(',')) {
    return ufValue.split(',')
      .map(u => u.trim().toUpperCase())
      .filter(u => u.length === 2);
  }
  if (ufValue.length === 2) {
    return [ufValue];
  }
  return [];
}

function calcularProximoDiaUtil(dataBase: Date): Date {
  const resultado = new Date(dataBase);
  const estaNoRecesso = (d: Date): boolean => {
    const mes = d.getMonth();
    const dia = d.getDate();
    return (mes === 11 && dia >= 20) || (mes === 0 && dia <= 6);
  };
  const proximoDiaUtil = (d: Date): void => {
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    if (estaNoRecesso(d)) {
      if (d.getMonth() === 11) {
        d.setFullYear(d.getFullYear() + 1);
      }
      d.setMonth(0);
      d.setDate(7);
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
    }
  };
  proximoDiaUtil(resultado);
  return resultado;
}

function calcularDataPublicacaoYmd(dataDispYmd: string): string {
  const base = new Date(`${dataDispYmd}T12:00:00`);
  base.setDate(base.getDate() + 1);
  const proximo = calcularProximoDiaUtil(base);
  return proximo.toISOString().slice(0, 10);
}

// ============================================================================
// PROCESSAMENTO DE TERMO (com filtros completos)
// ============================================================================

async function processarTermo(
  mon: Monitoramento,
  diaYmd: string,
  signal: AbortSignal,
  runtimeConfig: RuntimeConfig,
  onRateLimit?: (waitMs: number) => void,
  onTribunalProgress?: (tribunalIdx: number, totalTribunais: number) => void
): Promise<{ novas: number; duplicadas: number; descartadas: number; descartadasTribunal: number }> {
  if (signal.aborted) return { novas: 0, duplicadas: 0, descartadas: 0, descartadasTribunal: 0 };

  const tipo = mon.tipo === 'parte' ? 'parte' : ((mon.tipo as string) === 'nome' ? 'palavra-chave' : mon.tipo);
  const isRateLimitError = (msg?: string) =>
    !!msg && (msg.includes('429') || msg.includes('Too Many'));
  const isAdvogadoComOab = tipo === 'advogado' && !!mon.oab;

  // Ajustes dinâmicos (reduzem agressividade quando ocorre 429)
  let dynamicVariantConcurrency = runtimeConfig.concurrent_variants;
  let dynamicVariantDelay = runtimeConfig.delay_between_variants;
  let dynamicPageDelay = runtimeConfig.page_delay_ms;
  let dynamicTribunalDelay = runtimeConfig.delay_between_tribunals;

  // Configurar parâmetros base (data de disponibilização)
  const baseParams: any = {
    tipo: tipo === 'parte' ? 'parte' : tipo,
    dataInicio: diaYmd,
    dataFim: diaYmd,
    pageSize: 50,
  };

  // Configurar busca por tipo
  let ufsParaBuscar: string[] = [];
  let variantesParaBuscar: string[] = [];

  if (tipo === 'parte') {
    // Tipo PARTE: usa nomeParte diretamente, sem variantes
    baseParams.nomeParte = extrairPalavraChavePura(mon.termo_busca);
    variantesParaBuscar = [];
  } else if (tipo === 'advogado' && mon.oab) {
    baseParams.oab = String(mon.oab).replace(/\D/g, '');
    // Nome é útil para fallback via `nomeAdvogado` (portal oficial) quando a busca por OAB retorna 0.
    baseParams.nomeAdvogado = extrairPalavraChavePura(mon.termo_busca);
    const ufValue = String(mon.uf || '').trim().toUpperCase();
    ufsParaBuscar = parseUfs(ufValue);
    // Para advogado com OAB: buscar por OAB (sem palavra-chave) e filtrar por nome depois
    variantesParaBuscar = [];
  } else if (tipo === 'processo') {
    baseParams.numeroProcesso = mon.termo_busca.replace(/\D/g, '');
  } else {
    // palavra-chave: usar SOMENTE a palavra-chave + tribunal (mon.tribunais)
    const termoPuro = extrairPalavraChavePura(mon.termo_busca);
    variantesParaBuscar = gerarVariantes(termoPuro);
  }

  // Expandir tribunais configurados
  const tribunais = expandirTribunais(mon.tribunais);

  // ADVOGADO + OAB:
  // - Para respeitar filtros como "TJDFT" e evitar falso descarte por sigla ausente,
  //   quando o usuário seleciona poucos tribunais específicos, buscamos já com siglaTribunal.
  // - Mantemos o modo antigo (coleta ampla e filtro pós-busca) quando não há tribunal
  //   ou quando há muitos tribunais (para não explodir o número de requisições).
  const advogadoForcarTribunalNaBusca =
    isAdvogadoComOab && tribunais.length > 0 && tribunais.length <= 3;

  const tribunaisLoop = isAdvogadoComOab
    ? (advogadoForcarTribunalNaBusca ? tribunais : [])
    : tribunais;
  const tribLoop = tribunaisLoop.length > 0 ? tribunaisLoop : [undefined];
  const totalTribunaisParaReportar = tribLoop.length;
  let tribunalIdxAtual = 0;

  // UFs: se configurado múltiplas, iterar; senão usar primeira ou undefined
  const ufsLoop = ufsParaBuscar.length > 0 ? ufsParaBuscar : [undefined];

  // Variantes: se tem, iterar; senão usar null
  const variantesLoop = variantesParaBuscar.length > 0 
    ? variantesParaBuscar 
    : [null as unknown as string];

  const seen = new Set<string>();
  const resultados: any[] = [];

  // ==================================================================
  // LOOP TRIPLO: tribunal → UF → variante (igual à versão anterior)
  // ==================================================================
   for (const trib of tribLoop) {
    if (signal.aborted) break;

    for (const uf of ufsLoop) {
      if (signal.aborted) break;

      const currentConcurrency = dynamicVariantConcurrency;
      await runWithConcurrency(variantesLoop, currentConcurrency, async (variante) => {
        if (signal.aborted) return;

        try {
          const cacheKey = isAdvogadoComOab
            ? `${baseParams.dataInicio}|${baseParams.oab}|${uf ?? 'ALL'}`
            : null;

          let respItems: any[] | null = null;
          if (cacheKey && singletonState.sharedAdvogadoCache.has(cacheKey)) {
            respItems = singletonState.sharedAdvogadoCache.get(cacheKey) || [];
          } else {
            if (isAdvogadoComOab) {
              updateProgress({
                mensagem: `🧩 Fase 1/2: coleta OAB ${baseParams.oab}${uf ? `/${uf}` : ''}...`,
              });
            }
            const resp = await buscarPjeComunicaPaginado(
              {
                tipo: baseParams.tipo,
                oab: baseParams.oab,
                uf: uf,
                nomeAdvogado: baseParams.nomeAdvogado,
               nomeParte: baseParams.nomeParte,
                palavraChave: variante || undefined,
                numeroProcesso: baseParams.numeroProcesso,
                siglaTribunal: isAdvogadoComOab
                  ? (advogadoForcarTribunalNaBusca ? trib : undefined)
                  : trib,
                dataInicio: baseParams.dataInicio,
                dataFim: baseParams.dataFim,
                page: 0,
                pageSize: baseParams.pageSize,
              },
              {
                signal,
                maxPages: 10,
                delayMs: dynamicPageDelay,
                maxRetries: runtimeConfig.max_retries,
                retryBaseDelay: runtimeConfig.retry_base_delay,
                onRateLimit: (waitMs) => {
                  onRateLimit?.(waitMs);
                },
              }
            );
            respItems = resp.items;
            if (cacheKey) {
              singletonState.sharedAdvogadoCache.set(cacheKey, respItems);
            }
          }

          for (const item of respItems || []) {
            const id = String(item?.id ?? '');
            const key = id || JSON.stringify(item).slice(0, 400);
            if (!seen.has(key)) {
              seen.add(key);
              // Se buscamos com siglaTribunal, alguns tribunais não retornam a sigla no payload.
              // Enriquecemos para garantir persistência + filtros consistentes.
              const enriched = trib
                ? { ...item, siglaTribunal: item?.siglaTribunal ?? trib }
                : item;
              resultados.push(enriched);
            }
          }
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
          console.warn(`[DJEN] Erro ${trib ?? 'TODOS'} ${uf ?? ''}:`, e?.message);

          const msg = String(e?.message ?? '');
          if (isRateLimitError(msg)) {
            // Reduz agressividade para próximas iterações
            dynamicVariantConcurrency = 1;
            dynamicVariantDelay = Math.max(dynamicVariantDelay, 800);
            dynamicPageDelay = Math.max(dynamicPageDelay, 1200);
            dynamicTribunalDelay = Math.max(dynamicTribunalDelay, 1200);
            await delay(runtimeConfig.delay_on_rate_limit);
          }
        }

        if (dynamicVariantDelay > 0) {
          await delay(dynamicVariantDelay);
        }
      });
    }

    await delay(dynamicTribunalDelay);
    // Reportar progresso após processar cada tribunal
    tribunalIdxAtual++;
    onTribunalProgress?.(tribunalIdxAtual, totalTribunaisParaReportar);
  }

  // Bloco buscar_parte REMOVIDO - substituído pelo tipo 'parte' dedicado

  if (signal.aborted || resultados.length === 0) {
    return { novas: 0, duplicadas: 0, descartadas: 0, descartadasTribunal: 0 };
  }

  if (isAdvogadoComOab) {
    updateProgress({
      mensagem: `🧩 Fase 2/2: distribuindo ${mon.termo_busca || mon.oab}...`,
    });
  }

  // ================================================================
  // VALIDAÇÃO CRÍTICA: Filtrar publicações que NÃO contêm o termo
  // ================================================================
  const pubsDescartadas: any[] = [];
  let descartadasTribunal = 0;
  const pubsValidas = resultados.filter(pub => {
    // Se não forçamos tribunal na busca (coleta ampla), precisamos descartar os fora da lista.
    if (isAdvogadoComOab && tribunais.length > 0 && !advogadoForcarTribunalNaBusca) {
      const sigla = getSiglaTribunal(pub);
      if (sigla && !tribunais.includes(sigla)) {
        descartadasTribunal += 1;
        pubsDescartadas.push({ ...pub, motivo_descarte: 'tribunal_nao_permitido' });
        return false;
      }
    }
    // Para advogado, parte do “match” pode estar no metadado do destinatário.
    // Compor conteúdo enriquecido evita descarte falso quando o texto não repete o nome.
    const conteudo = [
      pub.destinatarioNome,
      pub.conteudo,
      pub.teor,
      pub.texto,
    ].filter(Boolean).join('\n');
    if (!conteudo) {
      pubsDescartadas.push({ ...pub, motivo_descarte: 'conteudo_vazio' });
      return false;
    }

    // 1. Verificar exclusões (termos bloqueados)
    if (mon.exclusoes?.some(exc => 
      conteudo.toUpperCase().includes(String(exc).toUpperCase())
    )) {
      pubsDescartadas.push({ ...pub, motivo_descarte: 'termo_excluido' });
      return false;
    }

    // 2. Condição concomitante (AND)
    if (!condicaoConcomitanteAtendida(conteudo, mon.condicao_concomitante)) {
      pubsDescartadas.push({ ...pub, motivo_descarte: 'condicao_concomitante' });
      return false;
    }

    // 3. Verificar termo/OAB
    // Para ADVOGADO: a API pode retornar itens pelo filtro (OAB/nomeAdvogado) mesmo quando o nome/OAB
    // não aparece dentro do texto da publicação. Nesses casos, validar estritamente pelo conteúdo gera
    // falso descarte — então não aplicamos essa validação para advogado.
    if (mon.tipo !== 'advogado') {
      const termoParaValidar = (mon.tipo === 'palavra-chave' || mon.tipo === 'parte' || (mon.tipo as string) === 'nome')
        ? extrairPalavraChavePura(mon.termo_busca)
        : mon.termo_busca;
      if (!conteudoContemTermo(conteudo, termoParaValidar, mon.tipo, mon.oab)) {
        pubsDescartadas.push({ ...pub, motivo_descarte: 'termo_nao_encontrado' });
        return false;
      }
    }

    return true;
  });

  // Gerar hashes e deduplicar internamente
  const hashMap = new Map<string, typeof pubsValidas[0]>();
  for (const pub of pubsValidas) {
    const conteudo = pub.conteudo || pub.teor || pub.texto || '';
    const dataDisp = (pub.dataDisponibilizacao || pub.dataDJe || diaYmd).slice(0, 10);
    const hash = gerarHash(conteudo, dataDisp);
    if (!hashMap.has(hash)) {
      hashMap.set(hash, { ...pub, hash_conteudo: hash, data_disponibilizacao: dataDisp });
    }
  }
  const pubsUnicas = Array.from(hashMap.values()).map((pub) => {
    const dataDisp = pub.data_disponibilizacao;
    const dataPub = dataDisp ? calcularDataPublicacaoYmd(dataDisp) : dataDisp;
    return {
      ...pub,
      data_publicacao: dataPub,
    };
  });
  const duplicadasInternas = pubsValidas.length - pubsUnicas.length;

  // Verificar duplicatas no banco
  const hashes = pubsUnicas.map(p => p.hash_conteudo);
  let existentes = new Set<string>();
  if (hashes.length > 0) {
    const { data } = await supabase
      .from('publicacoes_djen')
      .select('hash_conteudo')
      .eq('monitoramento_id', mon.id)
      .in('hash_conteudo', hashes);
    existentes = new Set((data || []).map(d => d.hash_conteudo));
  }

  const novas = pubsUnicas.filter(p => !existentes.has(p.hash_conteudo));
  const duplicadasBanco = pubsUnicas.length - novas.length;

  if (isAdvogadoComOab) {
    updateProgress({
      mensagem: `🧩 Fase 2/2: distribuindo ${mon.termo_busca || mon.oab} • ${novas.length} novas • ${descartadasTribunal} fora do tribunal`,
    });
  }

  // Inserir novas
  if (novas.length > 0) {
    const payload = novas.map(pub => ({
      monitoramento_id: mon.id,
      hash_conteudo: pub.hash_conteudo,
      processo_numero: pub.numeroProcesso || pub.processo || null,
      conteudo: pub.conteudo || pub.teor || pub.texto || null,
      data_disponibilizacao: `${pub.data_disponibilizacao}T12:00:00.000Z`,
      data_publicacao: pub.data_publicacao ? `${pub.data_publicacao}T12:00:00.000Z` : null,
      tribunal: getSiglaTribunal(pub),
      fonte: pub.tribunal || pub.orgao || pub.siglaTribunal || 'DJEN',
      lida: false,
    }));

    await supabase
      .from('publicacoes_djen')
      .upsert(payload, { onConflict: 'monitoramento_id,hash_conteudo', ignoreDuplicates: true });
  }

  // Persistir descartadas no banco (para auditoria e métricas)
  if (pubsDescartadas.length > 0) {
    const payloadDescartadas = pubsDescartadas.slice(0, 200).map(pub => {
      const conteudo = pub.conteudo || pub.teor || pub.texto || '';
      const dataDisp = (pub.dataDisponibilizacao || pub.dataDJe || diaYmd).slice(0, 10);
      const dataPub = calcularDataPublicacaoYmd(dataDisp);
      const hash = gerarHash(conteudo + (pub.motivo_descarte || ''), dataDisp);
      return {
        monitoramento_id: mon.id,
        hash_conteudo: hash,
        processo_numero: pub.numeroProcesso || pub.processo || null,
        conteudo: conteudo.slice(0, 10000), // Limitar tamanho
        data_publicacao: `${dataPub}T12:00:00.000Z`,
        data_disponibilizacao: `${dataDisp}T12:00:00.000Z`,
        tribunal: getSiglaTribunal(pub),
        fonte: pub.tribunal || pub.orgao || pub.siglaTribunal || 'DJEN',
        motivo_descarte: pub.motivo_descarte || 'validacao_falhou',
        lida: false,
      };
    });

    await supabase
      .from('publicacoes_djen_descartadas')
      .upsert(payloadDescartadas, { onConflict: 'monitoramento_id,hash_conteudo', ignoreDuplicates: true })
      .then(() => {}); // Não bloquear se falhar
  }

  return {
    novas: novas.length,
    duplicadas: duplicadasInternas + duplicadasBanco,
    descartadas: pubsDescartadas.length,
    descartadasTribunal,
  };
}

// ============================================================================
// ENGINE PRINCIPAL
// ============================================================================

async function runEngine(
  dataInicioYmd: string,
  dataFimYmd: string,
  retomar: boolean,
  turbo: boolean,
  coordenacaoId?: string,
  monitoramentoIds?: string[]
) {
  if (singletonState.isRunning) {
    console.warn('[DJEN] Já existe uma execução em andamento');
    return;
  }

  singletonState.isRunning = true;
  singletonState.abortController = new AbortController();
  const signal = singletonState.abortController.signal;
  
  const tempoInicio = Date.now();
  const runKey = `${dataInicioYmd}..${dataFimYmd}`;

  const checkpointMatchesRun = (cp: Checkpoint, key: string) => {
    if (!cp) return false;
    if (cp.runKey === key) return true;
    // compatibilidade legado: runKey era apenas dataFim
    return cp.runKey === dataFimYmd && cp.dataInicioYmd === dataInicioYmd && cp.dataFimYmd === dataFimYmd;
  };

  // Carregar checkpoint se retomando
  let checkpoint = retomar ? loadCheckpoint() : null;
  if (checkpoint && !checkpointMatchesRun(checkpoint, runKey)) checkpoint = null;

  // Buscar monitoramentos ativos (com filtros opcionais)
  console.log("[DJEN Engine] Filtros aplicados:", {
    coordenacaoId: coordenacaoId ?? "(nenhum)",
    monitoramentoIds: monitoramentoIds ?? [],
  });
  let query = supabase
    .from('monitoramentos_djen')
    .select('*')
    .eq('ativo', true);
  if (coordenacaoId) query = query.eq('coordenacao_id', coordenacaoId);
  if (monitoramentoIds?.length) query = query.in('id', monitoramentoIds);
  const { data: monitoramentos, error } = await query;

  console.log("[DJEN Engine] Monitoramentos obtidos:", monitoramentos?.length ?? 0, "IDs:", (monitoramentos || []).map((m: any) => m.id).join(", ") || "(nenhum)");

  if (error || !monitoramentos?.length) {
    updateProgress({
      status: 'erro',
      mensagem: 'Nenhum monitoramento ativo encontrado',
    });
    singletonState.isRunning = false;
    return;
  }

  let contagensMap: Map<string, number> | undefined = undefined;
  try {
    const { data: contagens } = await supabase.rpc('get_publicacoes_contagens_por_monitoramento');
    if (Array.isArray(contagens)) {
      contagensMap = new Map(
        contagens.map((c: any) => [String(c.monitoramento_id), Number(c.total ?? 0)])
      );
    }
  } catch (e) {
    console.warn('[DJEN] Falha ao carregar contagens por monitoramento:', (e as any)?.message || e);
  }

  const termos = ordenarTermosPorRelevancia(
    monitoramentos as unknown as Monitoramento[],
    contagensMap
  );
  const totalTermos = termos.length;
  const listaDatas = gerarListaDatas(dataInicioYmd, dataFimYmd);
  const totalDias = listaDatas.length;
  
  // ================================================================
  // CÁLCULO DE PROGRESSO PONDERADO POR TRIBUNAIS
  // Cada termo contribui com o número de tribunais que precisa processar.
  // Se não há tribunais configurados, contribui com 1.
  // Isso garante que 1 termo com 27 tribunais progrida de 0→100% gradualmente.
  // ================================================================
  const termoPesos = termos.map((t) => {
    const tribs = expandirTribunais(t.tribunais);
    // Mínimo 1 (mesmo sem tribunal), máximo útil para progresso fluido
    return Math.max(1, tribs.length);
  });
  const totalPesoTermos = termoPesos.reduce((a, b) => a + b, 0);
  const globalTotal = totalDias * totalPesoTermos;

  // Inicializar do checkpoint ou do zero
  let diaIdx = checkpoint?.diaIndice ?? 0;
  let termoIdx = checkpoint?.termoIndice ?? 0;
  let novas = checkpoint?.novas ?? 0;
  let duplicadas = checkpoint?.duplicadas ?? 0;
  let descartadas = checkpoint?.descartadas ?? 0;
  let descartadasTribunal = 0;
  const startTime = checkpoint?.tempoInicio ?? tempoInicio;

  const runtimeConfig = getRuntimeConfig(turbo);
  singletonState.turboDisabled = false;
  singletonState.sharedAdvogadoCache = new Map();
  singletonState.progress.mensagem = '🔎 Prioridade: Advogado/OAB';

  // Registrar execução no banco
  let execData: { id: string } | null = null;
  try {
    const result = await supabase
      .from('execucoes_agendadas')
      .insert({
        tipo: 'djen',
        status: 'executando',
        iniciado_em: new Date(startTime).toISOString(),
        detalhes: { runKey, dataInicioYmd, dataFimYmd, totalDias, totalTermos },
      })
      .select('id')
      .single();
    execData = result.data;
    if (!execData?.id) {
      console.warn('[DJEN] Insert execução retornou sem ID:', result);
    }
  } catch (err: any) {
    console.error('[DJEN] Erro ao inserir execução:', err?.message || err);
    // Fallback: tentar encontrar uma execução recente em estado "executando"
    try {
      const { data: existingExec } = await supabase
        .from('execucoes_agendadas')
        .select('id')
        .eq('tipo', 'djen')
        .eq('status', 'executando')
        .is('finalizado_em', null)
        .order('iniciado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingExec?.id) {
        execData = existingExec;
        console.log('[DJEN] Usando execução existente:', execData.id);
      }
    } catch (fallbackErr: any) {
      console.error('[DJEN] Fallback também falhou:', fallbackErr?.message || fallbackErr);
    }
  }
  singletonState.executionId = execData?.id ?? null;
  if (!singletonState.executionId) {
    console.warn('[DJEN] CRÍTICO: Não foi possível obter execution ID. Progresso não será sincronizado!');
  }

  // Iniciar timer
  singletonState.timerInterval = setInterval(() => {
    if (singletonState.progress.status === 'executando') {
      updateProgress({
        tempoDecorrido: Math.floor((Date.now() - startTime) / 1000),
      });
    }
  }, 1000);

  // Progresso inicial
  // Usar peso acumulado para calcular progresso inicial
  const pesoAcumuladoInicial = termoPesos.slice(0, termoIdx).reduce((a, b) => a + b, 0);
  const globalCurrentInicial = (diaIdx * totalPesoTermos) + pesoAcumuladoInicial;
  updateProgress({
    status: 'executando',
    globalCurrent: globalCurrentInicial,
    globalTotal,
    percentage: globalTotal > 0 ? Math.min(99, Math.round((globalCurrentInicial / globalTotal) * 100)) : 0,
    diaAtualYmd: listaDatas[diaIdx] ?? null,
    diaAtualIndice: diaIdx + 1,
    totalDias,
    termoAtualNoDia: termoIdx,
    totalTermos,
    novas,
    duplicadas,
    descartadas,
    mensagem: retomar ? `Retomando dia ${diaIdx + 1}/${totalDias}...` : `Iniciando ${totalDias} dia(s)...`,
    termoAtual: null,
    tempoDecorrido: Math.floor((Date.now() - startTime) / 1000),
    dataInicioYmd,
    dataFimYmd,
  });
  
  // Variáveis para rastrear progresso granular por tribunal
  let globalCurrentAtual = globalCurrentInicial;

  try {
    // ================================================================
    // LOOP PRINCIPAL: DIA por DIA
    // ================================================================
    for (; diaIdx < totalDias; diaIdx++) {
      if (signal.aborted) break;

      const diaYmd = listaDatas[diaIdx];
      const diaFmt = `${diaYmd.slice(8, 10)}/${diaYmd.slice(5, 7)}`;

      updateProgress({
        diaAtualYmd: diaYmd,
        diaAtualIndice: diaIdx + 1,
        mensagem: `📅 ${diaFmt} • Iniciando...`,
      });

      // ================================================================
      // LOOP INTERNO: TERMOS do dia
      // ================================================================
      for (; termoIdx < totalTermos; termoIdx++) {
        if (signal.aborted) break;

        const mon = termos[termoIdx];
        
        // Peso acumulado dos termos anteriores no dia atual
        const pesoAnterior = termoPesos.slice(0, termoIdx).reduce((a, b) => a + b, 0);
        // Peso do dia completo (soma de todos termos)
        const pesoDiaCompleto = diaIdx * totalPesoTermos;
        // Peso do termo atual (quantos tribunais)
        const pesoTermoAtual = termoPesos[termoIdx];
        
        // Progresso base: dias anteriores + termos anteriores do dia atual
        const progressoBase = pesoDiaCompleto + pesoAnterior;

        const termoLabel = (mon.descricao || '').trim() || mon.termo_busca;
        const tribunaisDoTermo = expandirTribunais(mon.tribunais);
        const totalTribunaisDoTermo = Math.max(1, tribunaisDoTermo.length);
        
        // Atualizar com progresso inicial do termo (antes de processar tribunais)
        globalCurrentAtual = progressoBase;
        const percentageInicial = globalTotal > 0 ? Math.min(99, Math.round((globalCurrentAtual / globalTotal) * 100)) : 0;
        updateProgress({
          globalCurrent: globalCurrentAtual,
          percentage: percentageInicial,
          termoAtualNoDia: termoIdx + 1,
          termoAtual: termoLabel,
          mensagem: `📅 ${diaFmt} • (${termoIdx + 1}/${totalTermos}) ${termoLabel} • 0/${totalTribunaisDoTermo} tribunais`,
        });

        // Processar termo
        const currentRuntime = singletonState.turboDisabled ? getRuntimeConfig(false) : runtimeConfig;
        const result = await processarTermo(
          mon,
          diaYmd,
          signal,
          currentRuntime,
          (waitMs) => {
            if (turbo && !singletonState.turboDisabled) {
              singletonState.turboDisabled = true;
              updateProgress({
                mensagem: `⚠️ Rate limit detectado. Modo turbo desativado. Aguardando ${Math.round(waitMs / 1000)}s...`,
              });
            } else {
              updateProgress({
                mensagem: `⚠️ Rate limit detectado. Aguardando ${Math.round(waitMs / 1000)}s...`,
              });
            }
          },
          // Callback para atualizar progresso a cada tribunal processado
          (tribunalIdx, totalTribunais) => {
            // Calcular progresso parcial dentro do termo
            const progressoTribunal = Math.round((tribunalIdx / totalTribunais) * pesoTermoAtual);
            globalCurrentAtual = progressoBase + progressoTribunal;
            
            // Limitar a 99% enquanto não concluiu totalmente (evita flash de 100%)
            const percentage = globalTotal > 0 ? Math.min(99, Math.round((globalCurrentAtual / globalTotal) * 100)) : 0;
            
            updateProgress({
              globalCurrent: globalCurrentAtual,
              percentage,
              mensagem: `📅 ${diaFmt} • (${termoIdx + 1}/${totalTermos}) ${termoLabel} • ${tribunalIdx}/${totalTribunais} tribunais`,
            });
            
            // Persistir progresso no banco para sincronizar com banner/cards
            const nowMs = Date.now();
            if (singletonState.executionId && nowMs - singletonState.lastDetalhesPersistAt >= METADATA_PERSIST_MIN_INTERVAL_MS) {
              singletonState.lastDetalhesPersistAt = nowMs;
              supabase
                .from('execucoes_agendadas')
                .update({
                  detalhes: {
                    runKey,
                    dataInicioYmd,
                    dataFimYmd,
                    totalDias,
                    totalTermos,
                    progress: {
                      current: globalCurrentAtual,
                      total: globalTotal,
                      percentage,
                    },
                    novas,
                    duplicadas,
                    descartadas,
                  },
                })
                .eq('id', singletonState.executionId)
                .then(() => {}, () => {});
            }
          }
        );
        
        novas += result.novas;
        duplicadas += result.duplicadas;
        descartadas += result.descartadas;
        descartadasTribunal += result.descartadasTribunal;
        
        // Após processar o termo, atualizar para o peso completo
        globalCurrentAtual = progressoBase + pesoTermoAtual;
        const percentageFinal = globalTotal > 0 ? Math.min(99, Math.round((globalCurrentAtual / globalTotal) * 100)) : 0;

        // Atualizar relevância do termo (prioriza termos que costumam achar resultados)
        const foundNow = result.novas + result.duplicadas;
        if (foundNow > 0) {
          const stats = loadTermStats();
          const prev = stats[mon.id] || { foundTotal: 0, lastFoundAt: 0 };
          stats[mon.id] = {
            foundTotal: prev.foundTotal + foundNow,
            lastFoundAt: Date.now(),
          };
          saveTermStats(stats);
        }

        // Atualizar e salvar checkpoint
        const cp: Checkpoint = {
          runKey,
          diaIndice: diaIdx,
          termoIndice: termoIdx + 1, // próximo termo
          novas,
          duplicadas,
          descartadas,
          tempoInicio: startTime,
          dataInicioYmd,
          dataFimYmd,
          globalCurrent: globalCurrentAtual,
          globalTotal,
          percentage: percentageFinal,
          totalDias,
          totalTermos,
        };
        saveCheckpoint(cp);

        updateProgress({
          globalCurrent: globalCurrentAtual,
          percentage: percentageFinal,
          novas,
          duplicadas,
          descartadas,
          descartadasTribunal,
        });

        // Atualizar metadata no Supabase (throttle para reduzir escritas)
        void persistMetadata({
          status: 'executando',
          current: globalCurrentAtual,
          total: globalTotal,
          percentage: percentageFinal,
          novas,
          duplicadas,
          descartadas,
          diaAtual: diaYmd,
          diaAtualYmd: diaYmd,
          diaIndice: diaIdx + 1,
          totalDias,
          termoAtual: mon.termo_busca,
          run_key: runKey,
          data_inicio: dataInicioYmd,
          data_fim: dataFimYmd,
        });

        // Atualizar detalhes.progress na execução (para Banner e Card lerem % correto)
        // Throttle: no mínimo 3s entre atualizações
        const nowMs = Date.now();
        if (singletonState.executionId && nowMs - singletonState.lastDetalhesPersistAt >= METADATA_PERSIST_MIN_INTERVAL_MS) {
          singletonState.lastDetalhesPersistAt = nowMs;
          supabase
            .from('execucoes_agendadas')
            .update({
              detalhes: {
                runKey,
                dataInicioYmd,
                dataFimYmd,
                totalDias,
                totalTermos,
                progress: {
                  current: globalCurrentAtual,
                  total: globalTotal,
                  percentage: percentageFinal,
                },
                novas,
                duplicadas,
                descartadas,
              },
            })
            .eq('id', singletonState.executionId)
            .then((result) => {
              if (result.error) {
                console.warn('[DJEN] Erro ao sincronizar detalhes.progress:', result.error.message);
              }
            }, (err) => {
              console.error('[DJEN] Erro ao sincronizar detalhes.progress:', err?.message || err);
            });
        } else if (!singletonState.executionId && termoIdx === 0) {
          // Avisar uma vez por dia que executionId está nulo
          console.warn('[DJEN] Executar CRÍTICO durante loop: executionId é null. Card não será atualizado!');
        }

        // Delay entre termos
        await delay(runtimeConfig.delay_between_terms);
      }

      // Dia concluído! Resetar índice de termo para próximo dia
      termoIdx = 0;

      if (!signal.aborted && diaIdx < totalDias - 1) {
        const proximoDia = listaDatas[diaIdx + 1];
        const proximoFmt = `${proximoDia.slice(8, 10)}/${proximoDia.slice(5, 7)}`;
        updateProgress({
          mensagem: `✅ ${diaFmt} concluído! Avançando para ${proximoFmt}...`,
        });
      }
    }

    // ================================================================
    // FINALIZAÇÃO
    // ================================================================
    const duracao = Math.floor((Date.now() - startTime) / 1000);

    if (signal.aborted) {
      updateProgress({
        status: 'cancelado',
        mensagem: `Cancelado. ${novas} novas encontradas.`,
        tempoDecorrido: duracao,
        termoAtual: null,
      });

      await persistMetadata({
        status: 'cancelado',
        current: singletonState.progress.globalCurrent,
        total: globalTotal,
        percentage: singletonState.progress.percentage,
        novas,
        duplicadas,
        descartadas,
        descartadas_tribunal: descartadasTribunal,
        run_key: runKey,
      }, { force: true });
    } else {
      // Limpar checkpoint ao concluir
      saveCheckpoint(null);

      updateProgress({
        status: 'concluido',
        globalCurrent: globalTotal,
        percentage: 100,
        mensagem: `✅ Concluído! ${novas} novas, ${duplicadas} duplicadas`,
        tempoDecorrido: duracao,
        termoAtual: null,
      });

      await persistMetadata({
        status: 'concluido',
        current: globalTotal,
        total: globalTotal,
        percentage: 100,
        novas,
        duplicadas,
        descartadas,
        descartadas_tribunal: descartadasTribunal,
        run_key: runKey,
        last_run: new Date().toISOString(),
      }, { force: true });
    }

    // Finalizar execução
    if (singletonState.executionId) {
      await supabase
        .from('execucoes_agendadas')
        .update({
          status: signal.aborted ? 'cancelado' : 'concluido',
          finalizado_em: new Date().toISOString(),
          detalhes: { novas, duplicadas, descartadas, duracao },
        })
        .eq('id', singletonState.executionId);
    }
  } catch (error: any) {
    console.error('[DJEN] Erro:', error);
    updateProgress({
      status: 'erro',
      mensagem: `Erro: ${error?.message || 'Falha'}`,
    });
  } finally {
    if (!signal.aborted) {
      try {
        await supabase.from('historico_monitoramento').insert({
          tipo: 'djen',
          executado_em: new Date().toISOString(),
          processos_verificados: singletonState.progress.globalCurrent || 0,
          novos_andamentos: novas,
          processos_com_novos: novas,
          erros: 0,
          detalhes: {
            data_inicio: dataInicioYmd,
            data_fim: dataFimYmd,
            total_termos: totalTermos,
            total_dias: totalDias,
            duplicadas,
            descartadas,
            descartadas_tribunal: descartadasTribunal,
            turbo: turbo,
            agrupamento_oab: true,
          },
        });
      } catch (e) {
        console.warn('[DJEN] Falha ao registrar auditoria:', (e as any)?.message || e);
      }
    }
    if (singletonState.timerInterval) {
      clearInterval(singletonState.timerInterval);
      singletonState.timerInterval = null;
    }
    singletonState.isRunning = false;
    singletonState.abortController = null;
    singletonState.executionId = null;
  }
}

// ============================================================================
// API PÚBLICA
// ============================================================================

export function executarDjenTermos(
  dataInicioYmd?: string,
  dataFimYmd?: string,
  retomar = false,
  turbo = false,
  coordenacaoId?: string,
  monitoramentoIds?: string[]
) {
  const hoje = getHojeBrasilia();
  
  // Default: últimos 3 dias
  let inicio = dataInicioYmd;
  let fim = dataFimYmd;
  
  if (!inicio && !fim) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - 2);
    inicio = ymdInTimeZone(d);
    fim = hoje;
  } else if (inicio && !fim) {
    fim = inicio;
  } else if (!inicio && fim) {
    inicio = fim;
  }

  // Se retomando, carregar datas do checkpoint
  if (retomar) {
    const cp = loadCheckpoint();
    if (cp) {
      inicio = cp.dataInicioYmd;
      fim = cp.dataFimYmd;
    }
  }

  runEngine(inicio!, fim!, retomar, turbo, coordenacaoId, monitoramentoIds);
}

export function cancelarDjenTermos() {
  singletonState.abortController?.abort();
  updateProgress({
    mensagem: 'Cancelando...',
  });
}

export function limparEstadoDjenTermos() {
  saveCheckpoint(null);
  singletonState.progress = createDefaultProgress();
  notifyListeners();
}

/**
 * Force kill mantém o checkpoint para permitir retomada posterior.
 * Para limpar completamente, use limparEstadoDjenTermos() após forceKill.
 */
export function forceKillDjenTermos(clearCheckpoint = false) {
  // Kill switch total
  singletonState.abortController?.abort();
  if (singletonState.timerInterval) {
    clearInterval(singletonState.timerInterval);
    singletonState.timerInterval = null;
  }
  singletonState.isRunning = false;
  singletonState.abortController = null;
  singletonState.executionId = null;
  singletonState.turboDisabled = false;
  
  // IMPORTANTE: NÃO limpar checkpoint por padrão para permitir retomada
  if (clearCheckpoint) {
    saveCheckpoint(null);
  }
  
  singletonState.progress = createDefaultProgress();
  notifyListeners();

  // Limpar banco
  supabase
    .from('execucoes_agendadas')
    .update({ status: 'cancelado', finalizado_em: new Date().toISOString() })
    .eq('tipo', 'djen')
    .eq('status', 'executando')
    .then(() => {});

  supabase
    .from('configuracoes_monitoramento')
    .update({ metadata: { status: 'idle' } })
    .eq('tipo', 'djen')
    .is('coordenacao_id', null)
    .then(() => {});
}

export function getDjenTermosProgress(): DjenTermosProgress {
  return singletonState.progress;
}

export function isDjenTermosRunning(): boolean {
  return singletonState.isRunning;
}

export function getCheckpoint(): Checkpoint | null {
  return loadCheckpoint();
}

export function subscribeDjenTermos(listener: (p: DjenTermosProgress) => void): () => void {
  singletonState.listeners.add(listener);
  // Enviar estado atual imediatamente
  listener(singletonState.progress);
  return () => {
    singletonState.listeners.delete(listener);
  };
}
