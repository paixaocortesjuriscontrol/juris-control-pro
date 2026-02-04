/**
 * DJEN Processos Engine v1.0
 * 
 * Arquitetura singleton com execução em background:
 * - Continua rodando mesmo ao sair da tela
 * - Processa grupos de processos com OR query
 * - Exclui coordenações Santander (volume alto)
 * - Checkpoints salvos a cada 5 grupos
 * - Retomada somente manual
 * 
 * Baseado no padrão useDjenTermosEngine.ts
 */

import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaNoBrowser, isCnjFormat } from "@/utils/pjeComunicaClient";

// ============================================================================
// TIPOS
// ============================================================================

export interface DjenProcessosProgress {
  status: 'idle' | 'executando' | 'concluido' | 'cancelado' | 'erro';
  
  // Progresso de grupos
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
  grupoIdx: number;
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

// Coordenações excluídas do DJEN Processos (volume muito alto)
export const COORDENACOES_EXCLUIDAS = [
  '968631d0-6659-46f1-b45d-899892cb0121', // Santander Cível
  '70d3e1ba-70ff-46d0-a6cf-4d4b553d324a', // Santander Trabalhista
];

// Tamanho do grupo de processos para busca OR
const GROUP_SIZE = 10;
const MAX_PAGES_PER_GROUP = 5;

const DEFAULT_PARAMS: ParametrosDjen = {
  group_search_size: GROUP_SIZE,
  delay_entre_lotes: 3000,
  delay_entre_paginas: 1500,
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

function buildOrQuery(numeros: string[]): string {
  const digits = numeros.map(n => normalizeNumeroProcesso(n));
  return digits.join(' OR ');
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
      group_search_size: Math.min(params.group_search_size || GROUP_SIZE, 10),
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
  retomar: boolean
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

  const startGroupIdx = checkpoint?.grupoIdx ?? 0;
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
    const params = await fetchParametrosDjen();
    console.log('[DJEN Processos] Parâmetros:', params);

    // Buscar processos monitorados EXCLUINDO Santander
    updateProgress({ mensagem: 'Carregando processos (excl. Santander)...' });

    const { data: processosMonitorados, error: procError } = await supabase
      .from('processos')
      .select('id, numero, coordenacao_id')
      .eq('monitorar_djen', true)
      .not('coordenacao_id', 'in', `(${COORDENACOES_EXCLUIDAS.join(',')})`);

    if (procError) throw new Error(`Erro ao buscar processos: ${procError.message}`);

    if (!processosMonitorados?.length) {
      updateProgress({ 
        status: 'concluido', 
        mensagem: 'Nenhum processo para monitorar (excl. Santander)' 
      });
      singletonState.isRunning = false;
      if (singletonState.timerInterval) clearInterval(singletonState.timerInterval);
      return;
    }

    console.log(`[DJEN Processos] ${processosMonitorados.length} processos (excl. Santander)`);

    // Separar processos CNJ de legados
    const processosCnj = processosMonitorados.filter(p => isCnjFormat(p.numero));
    const processosLegados = processosMonitorados.filter(p => !isCnjFormat(p.numero));

    // Criar índice para lookup O(1)
    const processosMap = new Map<string, { id: string; numero: string }>();
    for (const p of processosMonitorados) {
      const numeroNorm = normalizeNumeroProcesso(p.numero);
      processosMap.set(numeroNorm, p);
    }

    // Dividir em grupos
    const grupos: { id: string; numero: string }[][] = [];
    for (let i = 0; i < processosCnj.length; i += params.group_search_size) {
      grupos.push(processosCnj.slice(i, i + params.group_search_size));
    }
    for (const p of processosLegados) {
      grupos.push([p]);
    }

    const totalGrupos = grupos.length;
    console.log(`[DJEN Processos] ${totalGrupos} grupos (iniciando de ${startGroupIdx})`);

    updateProgress({
      totalGroups: totalGrupos,
      currentGroup: startGroupIdx,
      mensagem: `${processosMonitorados.length} processos em ${totalGrupos} grupos`,
    });

    // Persistir metadata inicial
    await persistMetadata({
      status: 'executando',
      total_grupos: totalGrupos,
      grupo_atual: startGroupIdx,
      novas: novasTotal,
      duplicadas: duplicadasTotal,
      run_key: runKey,
      browser_execution: true,
      estrategia: 'singleton_engine_v1',
    }, { force: true });

    // Loop de grupos
    for (let g = startGroupIdx; g < grupos.length; g++) {
      if (signal.aborted) break;

      const grupo = grupos[g];
      const query = buildOrQuery(grupo.map(p => p.numero));
      let page = 0;
      let hasMore = true;
      let grupoAnalisadas = 0;

      updateProgress({
        currentGroup: g + 1,
        currentPage: page,
        percentage: Math.round(((g + 1) / totalGrupos) * 100),
        mensagem: `Grupo ${g + 1}/${totalGrupos} (${grupo.length} processos)`,
      });

      // Paginar dentro do grupo
      while (hasMore && page < MAX_PAGES_PER_GROUP) {
        if (signal.aborted) break;

        let retryCount = 0;
        let success = false;
        let resp: any = null;
        let isBlockedError = false;

        while (!success && retryCount < params.max_retries) {
          try {
            resp = await buscarPjeComunicaNoBrowser({
              tipo: 'palavra-chave',
              palavraChave: query,
              dataInicio: dataInicioYmd,
              dataFim: dataFimYmd,
              page,
              pageSize: 50,
            }, { signal });

            success = true;
            consecutiveBlocks = 0;
          } catch (e: any) {
            if (e?.name === 'AbortError') break;
            
            const errMsg = String(e?.message ?? '').toLowerCase();
            isBlockedError = errMsg.includes('blocked') || errMsg.includes('bloqueada') || errMsg.includes('429');
            
            retryCount++;
            console.warn(`[DJEN Processos] Erro grupo ${g + 1} página ${page}, tentativa ${retryCount}:`, e?.message?.slice(0, 100));
            
            if (retryCount < params.max_retries) {
              const backoffMs = params.retry_base_delay_ms * Math.pow(2, retryCount - 1);
              await delay(Math.min(backoffMs, 30000));
            }
          }
        }

        if (!success || !resp) {
          if (isBlockedError) {
            consecutiveBlocks++;
            console.warn(`[DJEN Processos] Bloqueio consecutivo ${consecutiveBlocks}/${MAX_CONSECUTIVE_BLOCKS}`);
            
            if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) {
              console.error('[DJEN Processos] Circuit breaker ativado');
              
              // Salvar checkpoint para retomada
              saveCheckpoint({
                runKey,
                grupoIdx: g,
                novas: novasTotal,
                duplicadas: duplicadasTotal,
                totalAnalisadas: publicacoesAnalisadas,
                tempoInicio,
                dataInicioYmd,
                dataFimYmd,
                percentage: Math.round((g / totalGrupos) * 100),
                totalGroups: totalGrupos,
              });

              await persistMetadata({
                status: 'erro',
                erro: 'API bloqueada - circuit breaker',
                grupo_atual: g,
                total_grupos: totalGrupos,
                novas: novasTotal,
                duplicadas: duplicadasTotal,
              }, { force: true });

              updateProgress({
                status: 'erro',
                mensagem: `API bloqueada após ${consecutiveBlocks} tentativas. Use "Continuar" para retomar.`,
              });

              singletonState.isRunning = false;
              if (singletonState.timerInterval) clearInterval(singletonState.timerInterval);
              return;
            }
          }
          break;
        }

        // Processar publicações
        for (const pub of resp.items) {
          publicacoesAnalisadas++;
          grupoAnalisadas++;

          const numeroProcessoPub = pub.numeroProcesso || '';
          const numeroNorm = normalizeNumeroProcesso(numeroProcessoPub);

          const processoMonitorado = processosMap.get(numeroNorm);
          if (!processoMonitorado) continue;

          const conteudo = pub.texto || pub.teor || '';
          if (!conteudo) continue;

          const hoje = getBrazilISODate();
          const dataDisponibilizacao = pub.dataDisponibilizacao || hoje;
          const dataPublicacao = pub.dataPublicacao || dataDisponibilizacao;
          
          const conteudoNorm = normalizeConteudo(conteudo);
          const hashConteudo = generateHash(`${processoMonitorado.numero}|${dataPublicacao}|${conteudoNorm.slice(0, 2000)}`);

          if (seenHashes.has(hashConteudo)) {
            duplicadasTotal++;
            continue;
          }

          // Verificar no banco
          const { data: existente } = await supabase
            .from('publicacoes_djen_processos')
            .select('id')
            .eq('hash_conteudo', hashConteudo)
            .maybeSingle();

          if (existente) {
            seenHashes.add(hashConteudo);
            duplicadasTotal++;
            continue;
          }

          // Inserir nova
          const { error: insertError } = await supabase
            .from('publicacoes_djen_processos')
            .insert({
              processo_id: processoMonitorado.id,
              processo_numero: processoMonitorado.numero,
              hash_conteudo: hashConteudo,
              data_publicacao: dataPublicacao,
              data_disponibilizacao: dataDisponibilizacao,
              conteudo: conteudo.slice(0, 50000),
              fonte: 'singleton_engine_v1',
            });

          if (!insertError) {
            seenHashes.add(hashConteudo);
            novasTotal++;
          }
        }

        hasMore = resp.hasMore && resp.items.length > 0;
        page++;

        updateProgress({
          currentPage: page,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          mensagem: `Grupo ${g + 1}/${totalGrupos} | Pág ${page} | +${novasTotal} novas`,
        });

        if (hasMore && !signal.aborted) {
          await delay(params.delay_entre_paginas);
        }
      }

      // Salvar checkpoint a cada 5 grupos
      if ((g + 1) % 5 === 0 || g === grupos.length - 1) {
        saveCheckpoint({
          runKey,
          grupoIdx: g + 1,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalAnalisadas: publicacoesAnalisadas,
          tempoInicio,
          dataInicioYmd,
          dataFimYmd,
          percentage: Math.round(((g + 1) / totalGrupos) * 100),
          totalGroups: totalGrupos,
        });

        await persistMetadata({
          status: 'executando',
          grupo_atual: g + 1,
          total_grupos: totalGrupos,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          percentage: Math.round(((g + 1) / totalGrupos) * 100),
          run_key: runKey,
        });
      }

      // Delay entre grupos
      if (!signal.aborted && g < grupos.length - 1) {
        await delay(params.delay_entre_lotes);
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
        grupoIdx: singletonState.progress.currentGroup,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        totalAnalisadas: publicacoesAnalisadas,
        tempoInicio,
        dataInicioYmd,
        dataFimYmd,
        percentage: singletonState.progress.percentage,
        totalGroups: totalGrupos,
      });

      await persistMetadata({
        status: 'cancelado',
        grupo_atual: singletonState.progress.currentGroup,
        total_grupos: totalGrupos,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
      }, { force: true });

      updateProgress({
        status: 'cancelado',
        mensagem: `Cancelado. ${novasTotal} novas encontradas.`,
      });
    } else {
      // Limpar checkpoint ao concluir
      saveCheckpoint(null);

      await persistMetadata({
        status: 'concluido',
        grupo_atual: totalGrupos,
        total_grupos: totalGrupos,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        percentage: 100,
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
        currentGroup: totalGrupos,
        percentage: 100,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        totalPublicacoesAnalisadas: publicacoesAnalisadas,
        mensagem: `Concluído! ${novasTotal} novas em ${totalGrupos} grupos.`,
      });
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
    if (singletonState.timerInterval) {
      clearInterval(singletonState.timerInterval);
      singletonState.timerInterval = null;
    }
  }
}

// ============================================================================
// API PÚBLICA
// ============================================================================

export function executarDjenProcessos(
  dataInicio?: string,
  dataFim?: string,
  retomar = false
): void {
  const hoje = getBrazilISODate();
  const dataInicioYmd = dataInicio || hoje;
  const dataFimYmd = dataFim || hoje;
  
  runEngine(dataInicioYmd, dataFimYmd, retomar);
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
