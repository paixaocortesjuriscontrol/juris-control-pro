/**
 * DJEN Processos Engine v2.0
 * 
 * Arquitetura singleton com execução em background:
 * - Continua rodando mesmo ao sair da tela
 * - Busca 1 processo por vez com número inteiro (tipo 'processo')
 * - A API PJE Comunica NÃO suporta OR em palavra-chave - usa busca por processo
 * - Usa processos com monitorar_djen=true (exclusões via banco)
 * - Checkpoints salvos a cada 5 processos
 * - Retomada somente manual
 */

import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaNoBrowser } from "@/utils/pjeComunicaClient";
import { toast } from "sonner";

// ============================================================================
// TIPOS
// ============================================================================

export interface DjenProcessosProgress {
  status: 'idle' | 'executando' | 'concluido' | 'cancelado' | 'erro';
  
  // Progresso por processo
  currentGroup: number;
  totalGroups: number;
  currentPage: number;
  percentage: number;
  
  // Estatísticas acumuladas
  novas: number;
  duplicadas: number;
  totalPublicacoesAnalisadas: number;
  
  // UI
  mensagem: string;
  tempoDecorrido: number;
  
  // Intervalo de busca
  dataInicioYmd: string | null;
  dataFimYmd: string | null;
}

interface Checkpoint {
  runKey: string;
  processoIdx: number;
  novas: number;
  duplicadas: number;
  totalAnalisadas: number;
  tempoInicio: number;
  dataInicioYmd: string;
  dataFimYmd: string;
  percentage?: number;
  totalGroups?: number;
}

interface ParametrosDjen {
  group_search_size: number;
  delay_entre_lotes: number;
  delay_entre_paginas: number;
  max_retries: number;
  retry_base_delay_ms: number;
}

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

// NOTA: Coordenações Santander foram desabilitadas diretamente no banco
// (processos.monitorar_djen = false), portanto não há mais filtro hardcoded aqui.

const MAX_PAGES_PER_PROCESS = 10;
const PARALLEL_WORKERS = 8;
const DELAY_BETWEEN_BATCHES_MS = 1500;

const DEFAULT_PARAMS: ParametrosDjen = {
  group_search_size: 1,
  delay_entre_lotes: 1500,
  delay_entre_paginas: 800,
  max_retries: 4,
  retry_base_delay_ms: 8000,
};

const METADATA_PERSIST_MIN_INTERVAL_MS = 3000;
const MAX_CONSECUTIVE_BLOCKS = 3;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ============================================================================
// SINGLETON STATE
// ============================================================================

let singletonState: {
  isRunning: boolean;
  progress: DjenProcessosProgress;
  checkpoint: Checkpoint | null;
  abortController: AbortController | null;
  listeners: Set<(p: DjenProcessosProgress) => void>;
  timerInterval: ReturnType<typeof setInterval> | null;
  lastMetadataPersistAt: number;
  metadataPersistInFlight: Promise<void> | null;
} = {
  isRunning: false,
  progress: createDefaultProgress(),
  checkpoint: null,
  abortController: null,
  listeners: new Set(),
  timerInterval: null,
  lastMetadataPersistAt: 0,
  metadataPersistInFlight: null,
};

const STORAGE_KEY = 'djen-processos-checkpoint-v1';
const BR_TZ = 'America/Sao_Paulo';

// ============================================================================
// HELPERS
// ============================================================================

function createDefaultProgress(): DjenProcessosProgress {
  return {
    status: 'idle',
    currentGroup: 0,
    totalGroups: 0,
    currentPage: 0,
    percentage: 0,
    novas: 0,
    duplicadas: 0,
    totalPublicacoesAnalisadas: 0,
    mensagem: '',
    tempoDecorrido: 0,
    dataInicioYmd: null,
    dataFimYmd: null,
  };
}

function getBrazilISODate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizeNumeroProcesso(numero: string): string {
  return numero.replace(/\D/g, '');
}

function normalizeConteudo(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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

function notifyListeners() {
  for (const listener of singletonState.listeners) {
    listener(singletonState.progress);
  }
}

function updateProgress(partial: Partial<DjenProcessosProgress>) {
  singletonState.progress = { ...singletonState.progress, ...partial };
  notifyListeners();
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
        .update({ metadata, ultima_execucao: new Date().toISOString() })
        .eq('tipo', 'djen_processos')
        .is('coordenacao_id', null);
    } catch (err: any) {
      console.warn('[DJEN Processos] Falha ao atualizar metadata:', err?.message || err);
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

function getRuntimeParams(base: ParametrosDjen, turbo: boolean): ParametrosDjen {
  if (!turbo) return base;
  return {
    ...base,
    delay_entre_lotes: Math.max(800, Math.round(base.delay_entre_lotes * 0.5)),
    delay_entre_paginas: Math.max(500, Math.round(base.delay_entre_paginas * 0.5)),
  };
}

async function fetchParametrosDjen(): Promise<ParametrosDjen> {
  try {
    const { data: tipoData } = await (supabase as any)
      .from('tipo_monitoramento')
      .select('id')
      .eq('slug', 'djen_processos')
      .single();

    if (!tipoData?.id) {
      return DEFAULT_PARAMS;
    }

    const { data: params } = await (supabase as any)
      .from('parametros_monitoramento_djen')
      .select('*')
      .eq('tipo_monitoramento_id', tipoData.id)
      .single();

    if (!params) {
      return DEFAULT_PARAMS;
    }

    return {
      group_search_size: 1,
      delay_entre_lotes: params.delay_entre_lotes || DEFAULT_PARAMS.delay_entre_lotes,
      delay_entre_paginas: params.delay_entre_paginas || DEFAULT_PARAMS.delay_entre_paginas,
      max_retries: params.max_retries || DEFAULT_PARAMS.max_retries,
      retry_base_delay_ms: params.retry_base_delay_ms || DEFAULT_PARAMS.retry_base_delay_ms,
    };
  } catch {
    return DEFAULT_PARAMS;
  }
}

// ============================================================================
// ENGINE PRINCIPAL
// ============================================================================

async function runEngine(
  dataInicioYmd: string,
  dataFimYmd: string,
  retomar: boolean,
  turbo: boolean
) {
  if (singletonState.isRunning) {
    console.warn('[DJEN Processos] Já existe uma execução em andamento');
    return;
  }

  singletonState.isRunning = true;
  singletonState.abortController = new AbortController();
  const signal = singletonState.abortController.signal;
  
  const tempoInicio = Date.now();
  const runKey = `${dataInicioYmd}..${dataFimYmd}`;

  // Carregar checkpoint se retomando
  let checkpoint = retomar ? loadCheckpoint() : null;
  if (checkpoint && checkpoint.runKey !== runKey) {
    checkpoint = null;
  }

  const startProcessoIdx = checkpoint?.processoIdx ?? (checkpoint as any)?.grupoIdx ?? 0;
  let novasTotal = checkpoint?.novas ?? 0;
  let duplicadasTotal = checkpoint?.duplicadas ?? 0;
  let publicacoesAnalisadas = checkpoint?.totalAnalisadas ?? 0;
  const seenHashes = new Set<string>();
  
  // Circuit breaker
  let consecutiveBlocks = 0;

  try {
    // Iniciar timer de tempo decorrido
    singletonState.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - tempoInicio) / 1000);
      updateProgress({ tempoDecorrido: elapsed });
    }, 1000);

    updateProgress({
      status: 'executando',
      mensagem: 'Carregando parâmetros...',
      dataInicioYmd,
      dataFimYmd,
      novas: novasTotal,
      duplicadas: duplicadasTotal,
      tempoDecorrido: 0,
    });

    // Carregar parâmetros
    const baseParams = await fetchParametrosDjen();
    const params = getRuntimeParams(baseParams, turbo);
    console.log('[DJEN Processos] Parâmetros:', params, turbo ? '(turbo)' : '');

    // Buscar SOMENTE processos com busca DJEN ativada (monitorar_djen = true)
    updateProgress({ mensagem: 'Carregando processos monitorados...' });

    const { data: rawProcessos, error: procError } = await supabase
      .from('processos')
      .select('id, numero, coordenacao_id, monitorar_djen')
      .eq('monitorar_djen', true);

    if (procError) throw new Error(`Erro ao buscar processos: ${procError.message}`);

    // Garantir: somente processos com monitorar_djen = true
    const processosMonitorados = (rawProcessos || [])
      .filter((p) => p.monitorar_djen === true)
      .map(({ id, numero, coordenacao_id }) => ({ id, numero, coordenacao_id }));

    if (!processosMonitorados?.length) {
      toast.warning('Nenhum processo com monitoramento DJEN ativo. Cadastre processos e marque monitorar_djen.');
      updateProgress({ 
        status: 'concluido', 
        mensagem: 'Nenhum processo para monitorar' 
      });
      singletonState.isRunning = false;
      if (singletonState.timerInterval) clearInterval(singletonState.timerInterval);
      return;
    }

    console.log(`[DJEN Processos] ${processosMonitorados.length} processos (${PARALLEL_WORKERS} paralelos)`);

    const totalProcessos = processosMonitorados.length;
    const processosLista = processosMonitorados;

    updateProgress({
      totalGroups: totalProcessos,
      currentGroup: startProcessoIdx,
      mensagem: `${totalProcessos} processos (${PARALLEL_WORKERS} paralelos)`,
    });

    await persistMetadata({
      status: 'executando',
      total_grupos: totalProcessos,
      grupo_atual: startProcessoIdx,
      novas: novasTotal,
      duplicadas: duplicadasTotal,
      run_key: runKey,
      browser_execution: true,
      estrategia: 'singleton_engine_v3_parallel',
      turbo: turbo,
      parallel_workers: PARALLEL_WORKERS,
    }, { force: true });

    // === Função para processar 1 processo (usada em paralelo) ===
    async function processOneProcess(
      processo: { id: string; numero: string; coordenacao_id: string | null },
      idx: number
    ): Promise<{ novas: number; duplicadas: number; analisadas: number; blocked: boolean }> {
      const numeroCompleto = processo.numero.trim();
      let page = 0;
      let hasMore = true;
      let novas = 0;
      let duplicadas = 0;
      let analisadas = 0;
      let blocked = false;

      while (hasMore && page < MAX_PAGES_PER_PROCESS) {
        if (signal.aborted) break;

        let retryCount = 0;
        let success = false;
        let resp: any = null;
        let isBlockedError = false;

        while (!success && retryCount < params.max_retries) {
          try {
            resp = await buscarPjeComunicaNoBrowser({
              tipo: 'processo',
              numeroProcesso: numeroCompleto,
              dataInicio: dataInicioYmd,
              dataFim: dataFimYmd,
              page,
              pageSize: 50,
            }, { signal });

            success = true;
          } catch (e: any) {
            if (e?.name === 'AbortError') break;
            
            const errMsg = String(e?.message ?? '').toLowerCase();
            isBlockedError = errMsg.includes('blocked') || errMsg.includes('bloqueada') || errMsg.includes('429');
            
            retryCount++;
            if (retryCount < params.max_retries) {
              const backoffMs = params.retry_base_delay_ms * Math.pow(2, retryCount - 1);
              await delay(Math.min(backoffMs, 30000));
            }
          }
        }

        if (!success || !resp) {
          if (isBlockedError) blocked = true;
          break;
        }

        for (const pub of resp.items) {
          analisadas++;

          const conteudo = pub.texto || pub.teor || '';
          if (!conteudo) continue;

          const hoje = getBrazilISODate();
          const dataDisponibilizacao = pub.dataDisponibilizacao || hoje;
          const dataPublicacao = pub.dataPublicacao || dataDisponibilizacao;
          
          const conteudoNorm = normalizeConteudo(conteudo);
          const hashConteudo = generateHash(`${processo.numero}|${dataPublicacao}|${conteudoNorm.slice(0, 2000)}`);

          if (seenHashes.has(hashConteudo)) {
            duplicadas++;
            continue;
          }

          const { data: existente } = await supabase
            .from('publicacoes_djen_processos')
            .select('id')
            .eq('hash_conteudo', hashConteudo)
            .maybeSingle();

          if (existente) {
            seenHashes.add(hashConteudo);
            duplicadas++;
            continue;
          }

          const { error: insertError } = await supabase
            .from('publicacoes_djen_processos')
            .insert({
              processo_id: processo.id,
              processo_numero: processo.numero,
              hash_conteudo: hashConteudo,
              data_publicacao: dataPublicacao,
              data_disponibilizacao: dataDisponibilizacao,
              conteudo: conteudo.slice(0, 50000),
              fonte: 'singleton_engine_v2_parallel',
            });

          if (!insertError) {
            seenHashes.add(hashConteudo);
            novas++;
          }
        }

        hasMore = resp.hasMore && resp.items.length > 0;
        page++;

        if (hasMore && !signal.aborted) {
          await delay(params.delay_entre_paginas);
        }
      }

      return { novas, duplicadas, analisadas, blocked };
    }

    // === Loop principal: processar em lotes paralelos de PARALLEL_WORKERS ===
    for (let batchStart = startProcessoIdx; batchStart < processosLista.length; batchStart += PARALLEL_WORKERS) {
      if (signal.aborted) break;

      const batchEnd = Math.min(batchStart + PARALLEL_WORKERS, processosLista.length);
      const batch = processosLista.slice(batchStart, batchEnd);

      updateProgress({
        currentGroup: batchStart + 1,
        percentage: Math.round(((batchStart + 1) / totalProcessos) * 100),
        mensagem: `Lote ${Math.floor(batchStart / PARALLEL_WORKERS) + 1} (processos ${batchStart + 1}-${batchEnd}/${totalProcessos}) | ${PARALLEL_WORKERS} paralelos`,
      });

      // Executar batch em paralelo com stagger de 200ms entre cada
      const promises = batch.map((processo, i) =>
        delay(i * 200).then(() => processOneProcess(processo, batchStart + i))
      );

      const results = await Promise.all(promises);

      let batchBlocked = 0;
      for (const result of results) {
        novasTotal += result.novas;
        duplicadasTotal += result.duplicadas;
        publicacoesAnalisadas += result.analisadas;
        if (result.blocked) batchBlocked++;
      }

      // Circuit breaker: se todos no lote foram bloqueados
      if (batchBlocked >= batch.length && batch.length > 1) {
        consecutiveBlocks++;
        console.warn(`[DJEN Processos] Lote inteiro bloqueado ${consecutiveBlocks}/${MAX_CONSECUTIVE_BLOCKS}`);
        
        if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) {
          console.error('[DJEN Processos] Circuit breaker ativado');
          
          saveCheckpoint({
            runKey,
            processoIdx: batchStart,
            novas: novasTotal,
            duplicadas: duplicadasTotal,
            totalAnalisadas: publicacoesAnalisadas,
            tempoInicio,
            dataInicioYmd,
            dataFimYmd,
            percentage: Math.round((batchStart / totalProcessos) * 100),
            totalGroups: totalProcessos,
          });

          await persistMetadata({
            status: 'erro',
            erro: 'API bloqueada - circuit breaker',
            grupo_atual: batchStart,
            total_grupos: totalProcessos,
            novas: novasTotal,
            duplicadas: duplicadasTotal,
          }, { force: true });

          updateProgress({
            status: 'erro',
            mensagem: `API bloqueada após ${consecutiveBlocks} lotes. Use "Continuar" para retomar.`,
          });

          singletonState.isRunning = false;
          if (singletonState.timerInterval) clearInterval(singletonState.timerInterval);
          return;
        }
      } else {
        consecutiveBlocks = 0;
      }

      updateProgress({
        currentGroup: batchEnd,
        percentage: Math.round((batchEnd / totalProcessos) * 100),
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        totalPublicacoesAnalisadas: publicacoesAnalisadas,
        mensagem: `Lote concluído (${batchEnd}/${totalProcessos}) | +${novasTotal} novas | ${PARALLEL_WORKERS} paralelos`,
      });

      // Checkpoint a cada lote
      saveCheckpoint({
        runKey,
        processoIdx: batchEnd,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        totalAnalisadas: publicacoesAnalisadas,
        tempoInicio,
        dataInicioYmd,
        dataFimYmd,
        percentage: Math.round((batchEnd / totalProcessos) * 100),
        totalGroups: totalProcessos,
      });

      await persistMetadata({
        status: 'executando',
        grupo_atual: batchEnd,
        total_grupos: totalProcessos,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        percentage: Math.round((batchEnd / totalProcessos) * 100),
        run_key: runKey,
        parallel_workers: PARALLEL_WORKERS,
      });

      if (!signal.aborted && batchEnd < processosLista.length) {
        await delay(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    // Finalização
    if (singletonState.timerInterval) {
      clearInterval(singletonState.timerInterval);
      singletonState.timerInterval = null;
    }

    if (signal.aborted) {
      saveCheckpoint({
        runKey,
        processoIdx: singletonState.progress.currentGroup,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        totalAnalisadas: publicacoesAnalisadas,
        tempoInicio,
        dataInicioYmd,
        dataFimYmd,
        percentage: singletonState.progress.percentage,
        totalGroups: totalProcessos,
      });

      await persistMetadata({
        status: 'cancelado',
        grupo_atual: singletonState.progress.currentGroup,
        total_grupos: totalProcessos,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
      }, { force: true });

      updateProgress({
        status: 'cancelado',
        mensagem: `Cancelado. ${novasTotal} novas encontradas.`,
      });
    } else {
      saveCheckpoint(null);

      await persistMetadata({
        status: 'concluido',
        grupo_atual: totalProcessos,
        total_grupos: totalProcessos,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        percentage: 100,
        run_key: runKey,
        last_run: new Date().toISOString(),
      }, { force: true });

      // Salvar histórico
      await supabase.from('historico_monitoramento').insert({
        tipo: 'djen_processos',
        processos_verificados: processosMonitorados.length,
        novos_andamentos: novasTotal,
        erros: 0,
      });

      updateProgress({
        status: 'concluido',
        currentGroup: totalProcessos,
        totalGroups: totalProcessos,
        percentage: 100,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        totalPublicacoesAnalisadas: publicacoesAnalisadas,
        mensagem: `Concluído! ${novasTotal} novas em ${totalProcessos} processos.`,
      });
      
      // Notificar conclusão com toast
      toast.success(`DJEN Processos: ${novasTotal} novas publicações encontradas!`);
    }

  } catch (error: any) {
    console.error('[DJEN Processos] Erro:', error);

    if (singletonState.timerInterval) {
      clearInterval(singletonState.timerInterval);
      singletonState.timerInterval = null;
    }

    await persistMetadata({
      status: 'erro',
      erro: error.message,
      novas: novasTotal,
      duplicadas: duplicadasTotal,
    }, { force: true });

    updateProgress({
      status: 'erro',
      mensagem: `Erro: ${error.message}`,
    });
  } finally {
    singletonState.isRunning = false;
    singletonState.abortController = null;
    if (singletonState.timerInterval) {
      clearInterval(singletonState.timerInterval);
      singletonState.timerInterval = null;
    }
    // Sempre notificar listeners para garantir que a UI seja atualizada
    notifyListeners();
  }
}

// ============================================================================
// API PÚBLICA
// ============================================================================

export function executarDjenProcessos(
  dataInicio?: string,
  dataFim?: string,
  retomar = false,
  turbo = false
): boolean {
  if (singletonState.isRunning) {
    console.warn('[DJEN Processos] Já existe uma execução em andamento');
    return false;
  }
  const hoje = getBrazilISODate();
  const dataInicioYmd = dataInicio || hoje;
  const dataFimYmd = dataFim || hoje;
  runEngine(dataInicioYmd, dataFimYmd, retomar, turbo);
  return true;
}

export function cancelarDjenProcessos(): void {
  if (singletonState.abortController) {
    singletonState.abortController.abort();
  }
  updateProgress({ status: 'cancelado', mensagem: 'Cancelando...' });
}

export function limparEstadoDjenProcessos(): void {
  saveCheckpoint(null);
  singletonState.progress = createDefaultProgress();
  notifyListeners();
}

export async function forceKillDjenProcessos(): Promise<void> {
  // Abortar requisições
  if (singletonState.abortController) {
    singletonState.abortController.abort();
  }

  // Parar timer
  if (singletonState.timerInterval) {
    clearInterval(singletonState.timerInterval);
    singletonState.timerInterval = null;
  }

  // Limpar estado
  singletonState.isRunning = false;
  singletonState.checkpoint = null;
  localStorage.removeItem(STORAGE_KEY);

  // Limpar metadata no banco
  await supabase
    .from('configuracoes_monitoramento')
    .update({
      metadata: {
        status: 'idle',
        cancelado: true,
        force_killed: true,
        killed_at: new Date().toISOString(),
      },
    })
    .eq('tipo', 'djen_processos')
    .is('coordenacao_id', null);

  singletonState.progress = createDefaultProgress();
  notifyListeners();
}

export function subscribeDjenProcessos(
  listener: (p: DjenProcessosProgress) => void
): () => void {
  singletonState.listeners.add(listener);
  // Notificar estado atual imediatamente
  listener(singletonState.progress);
  return () => {
    singletonState.listeners.delete(listener);
  };
}

export function getDjenProcessosProgress(): DjenProcessosProgress {
  return singletonState.progress;
}

export function isDjenProcessosRunning(): boolean {
  return singletonState.isRunning;
}

export function getCheckpointProcessos(): Checkpoint | null {
  return loadCheckpoint();
}
