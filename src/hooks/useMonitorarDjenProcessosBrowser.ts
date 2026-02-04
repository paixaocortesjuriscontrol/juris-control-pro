/**
 * Hook para monitorar processos DJEN diretamente no navegador.
 * 
 * ESTRATÉGIA v7: Busca 1 processo por vez com número inteiro (tipo 'processo')
 * 
 * A API PJE Comunica NÃO suporta OR em palavra-chave. Usa tipo 'processo'
 * com numeroProcesso completo para cada processo.
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaNoBrowser } from "@/utils/pjeComunicaClient";
import { toast } from "sonner";

const MAX_PAGES_PER_PROCESS = 10;

export interface DjenProcessosProgress {
  status: 'idle' | 'executando' | 'pausado' | 'concluido' | 'erro' | 'cancelado';
  currentGroup: number;
  totalGroups: number;
  currentPage: number;
  percentage: number;
  novas: number;
  duplicadas: number;
  totalPublicacoesAnalisadas: number;
  mensagem: string;
  startedAt: string | null;
  elapsedSeconds: number;
}

interface ParametrosDjen {
  modo_processamento: 'sequencial' | 'semi_paralelo' | 'paralelo_total';
  max_paralelo: number;
  max_por_invocacao: number;
  batch_size: number;
  group_search_size: number;
  delay_entre_lotes: number;
  delay_entre_monitoramentos: number;
  delay_entre_paginas: number;
  delay_entre_tribunais: number;
  delay_jina_api: number;
  soft_timeout_ms: number;
  finalization_buffer_ms: number;
  max_retries: number;
  retry_base_delay_ms: number;
}

const DEFAULT_PARAMS: ParametrosDjen = {
  modo_processamento: 'sequencial',
  max_paralelo: 1,
  max_por_invocacao: 3,
  batch_size: 50,
  group_search_size: 10,
  delay_entre_lotes: 3000,
  delay_entre_monitoramentos: 2000,
  delay_entre_paginas: 1500,
  delay_entre_tribunais: 2000,
  delay_jina_api: 2000,
  soft_timeout_ms: 50000,
  finalization_buffer_ms: 10000,
  max_retries: 4,
  retry_base_delay_ms: 8000,
};

interface MonitorarDjenProcessosBrowserReturn {
  progresso: DjenProcessosProgress;
  isExecutando: boolean;
  executar: (dataInicio?: string, dataFim?: string, retomar?: boolean) => Promise<void>;
  cancelar: () => void;
}

// === Funções auxiliares fora do componente ===

function getBrazilISODate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
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

async function fetchParametrosDjen(): Promise<ParametrosDjen> {
  try {
    const { data: tipoData } = await (supabase as any)
      .from('tipo_monitoramento')
      .select('id')
      .eq('slug', 'djen_processos')
      .single();

    if (!tipoData?.id) {
      console.warn('[DJEN] Tipo djen_processos não encontrado, usando defaults');
      return DEFAULT_PARAMS;
    }

    const { data: params } = await (supabase as any)
      .from('parametros_monitoramento_djen')
      .select('*')
      .eq('tipo_monitoramento_id', tipoData.id)
      .single();

    if (!params) {
      console.warn('[DJEN] Parâmetros não encontrados, usando defaults');
      return DEFAULT_PARAMS;
    }

    return {
      modo_processamento: params.modo_processamento || DEFAULT_PARAMS.modo_processamento,
      max_paralelo: params.max_paralelo || DEFAULT_PARAMS.max_paralelo,
      max_por_invocacao: params.max_por_invocacao || DEFAULT_PARAMS.max_por_invocacao,
      batch_size: params.batch_size || DEFAULT_PARAMS.batch_size,
      group_search_size: params.group_search_size || DEFAULT_PARAMS.group_search_size,
      delay_entre_lotes: params.delay_entre_lotes || DEFAULT_PARAMS.delay_entre_lotes,
      delay_entre_monitoramentos: params.delay_entre_monitoramentos || DEFAULT_PARAMS.delay_entre_monitoramentos,
      delay_entre_paginas: params.delay_entre_paginas || DEFAULT_PARAMS.delay_entre_paginas,
      delay_entre_tribunais: params.delay_entre_tribunais || DEFAULT_PARAMS.delay_entre_tribunais,
      delay_jina_api: params.delay_jina_api || DEFAULT_PARAMS.delay_jina_api,
      soft_timeout_ms: params.soft_timeout_ms || DEFAULT_PARAMS.soft_timeout_ms,
      finalization_buffer_ms: params.finalization_buffer_ms || DEFAULT_PARAMS.finalization_buffer_ms,
      max_retries: params.max_retries || DEFAULT_PARAMS.max_retries,
      retry_base_delay_ms: params.retry_base_delay_ms || DEFAULT_PARAMS.retry_base_delay_ms,
    };
  } catch (error) {
    console.error('[DJEN] Erro ao buscar parâmetros:', error);
    return DEFAULT_PARAMS;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === Hook principal ===

export function useMonitorarDjenProcessosBrowser(): MonitorarDjenProcessosBrowserReturn {
  const queryClient = useQueryClient();
  const canceladoRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [progresso, setProgresso] = useState<DjenProcessosProgress>({
    status: 'idle',
    currentGroup: 0,
    totalGroups: 0,
    currentPage: 0,
    percentage: 0,
    novas: 0,
    duplicadas: 0,
    totalPublicacoesAnalisadas: 0,
    mensagem: '',
    startedAt: null,
    elapsedSeconds: 0,
  });

  const isExecutando = progresso.status === 'executando';

  // Timer de tempo decorrido
  const startTimeRef = useRef<number | null>(null);
  const lastElapsedRef = useRef<number>(0);
  
  useEffect(() => {
    if (isExecutando) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
        lastElapsedRef.current = 0;
      }
      
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          if (elapsed !== lastElapsedRef.current) {
            lastElapsedRef.current = elapsed;
            setProgresso(prev => {
              if (prev.elapsedSeconds === elapsed) return prev;
              return { ...prev, elapsedSeconds: elapsed };
            });
          }
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      startTimeRef.current = null;
      lastElapsedRef.current = 0;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isExecutando]);

  const updateProgress = useCallback((updates: Partial<DjenProcessosProgress>) => {
    setProgresso(prev => {
      const next = { ...prev, ...updates };
      // Calcular porcentagem baseado no progresso de grupos
      if (next.totalGroups > 0) {
        next.percentage = Math.min(100, Math.round((next.currentGroup / next.totalGroups) * 100));
      }
      return next;
    });
  }, []);

  const saveCheckpoint = useCallback(async (stats: Partial<DjenProcessosProgress>) => {
    try {
      const { data: config } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen_processos')
        .maybeSingle();
      
      const currentMeta = (config?.metadata as Record<string, any>) || {};
      
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          ultima_execucao: new Date().toISOString(),
          metadata: {
            ...currentMeta,
            grupo_atual: stats.currentGroup ?? currentMeta.grupo_atual ?? 0,
            total_grupos: stats.totalGroups ?? currentMeta.total_grupos ?? 0,
            novas: Math.max(stats.novas || 0, currentMeta.novas || 0),
            duplicadas: Math.max(stats.duplicadas || 0, currentMeta.duplicadas || 0),
            total_analisadas: Math.max(stats.totalPublicacoesAnalisadas || 0, currentMeta.total_analisadas || 0),
            percentage: Math.max(stats.percentage || 0, currentMeta.percentage || 0),
            status: stats.status || 'em_andamento',
            browser_execution: true,
            estrategia: 'processo_inteiro_v7',
            run_started_at: stats.startedAt || currentMeta.run_started_at,
            updated_at: new Date().toISOString(),
          },
        })
        .eq('tipo', 'djen_processos');
    } catch (e) {
      console.warn('[DJEN Processos] Erro ao salvar checkpoint:', e);
    }
  }, []);

  const executar = useCallback(async (
    dataInicio?: string,
    dataFim?: string,
    _retomar = false
  ) => {
    if (isExecutando) return;
    
    canceladoRef.current = false;
    abortControllerRef.current = new AbortController();
    
    // Resetar timer explicitamente ao iniciar nova execução
    startTimeRef.current = Date.now();
    lastElapsedRef.current = 0;
    
    const hoje = getBrazilISODate();
    const dataInicioEfetiva = dataInicio || hoje;
    const dataFimEfetiva = dataFim || hoje;

    try {
      const startedAt = new Date().toISOString();
      let novasTotal = 0;
      let duplicadasTotal = 0;
      let publicacoesAnalisadas = 0;
      const seenHashes = new Set<string>();
      
      // Circuit breaker: abortar após N falhas consecutivas por bloqueio
      const MAX_CONSECUTIVE_BLOCKS = 3;
      let consecutiveBlocks = 0;

      // 1. Carregar parâmetros
      console.log('[DJEN v7] Carregando parâmetros...');
      updateProgress({
        status: 'executando',
        mensagem: 'Carregando parâmetros...',
        startedAt,
        elapsedSeconds: 0,
      });

      const params = await fetchParametrosDjen();
      console.log('[DJEN v7] Parâmetros carregados (busca 1 processo por vez, número inteiro)');

      // 2. Buscar todos os processos monitorados
      console.log('[DJEN v7] Carregando processos monitorados...');
      updateProgress({ mensagem: 'Carregando processos monitorados...' });

      const { data: rawProcessos, error: procError } = await supabase
        .from('processos')
        .select('id, numero, monitorar_djen')
        .eq('monitorar_djen', true);

      if (procError) throw new Error(`Erro ao buscar processos: ${procError.message}`);

      const processosMonitorados = (rawProcessos || [])
        .filter((p) => p.monitorar_djen === true)
        .map(({ id, numero }) => ({ id, numero }));

      if (!processosMonitorados?.length) {
        toast.info('Nenhum processo com monitoramento DJEN ativo.');
        updateProgress({ status: 'concluido', mensagem: 'Nenhum processo para monitorar' });
        return;
      }

      const totalProcessos = processosMonitorados.length;
      updateProgress({
        totalGroups: totalProcessos,
        mensagem: `${totalProcessos} processos (1 por vez, número inteiro). Iniciando...`,
      });

      // 3. Iterar 1 processo por vez com tipo 'processo' e número completo
      for (let idx = 0; idx < processosMonitorados.length; idx++) {
        if (canceladoRef.current) break;

        const processo = processosMonitorados[idx];
        const numeroCompleto = processo.numero.trim();
        let page = 0;
        let hasMore = true;

        updateProgress({
          currentGroup: idx + 1,
          currentPage: page,
          mensagem: `Processo ${idx + 1}/${totalProcessos}: ${numeroCompleto.slice(0, 25)}...`,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
        });

        while (hasMore && page < MAX_PAGES_PER_PROCESS) {
          if (canceladoRef.current) break;

          let retryCount = 0;
          let success = false;
          let resp: any = null;
          let isBlockedError = false;

          while (!success && retryCount < params.max_retries) {
            try {
              resp = await buscarPjeComunicaNoBrowser({
                tipo: 'processo',
                numeroProcesso: numeroCompleto,
                dataInicio: dataInicioEfetiva,
                dataFim: dataFimEfetiva,
                page,
                pageSize: 50,
              }, { signal: abortControllerRef.current?.signal });

              success = true;
              consecutiveBlocks = 0;
            } catch (e: any) {
              if (e?.name === 'AbortError') break;
              
              const errMsg = String(e?.message ?? '').toLowerCase();
              isBlockedError = errMsg.includes('blocked') || errMsg.includes('bloqueada');
              
              retryCount++;
              console.warn(`[DJEN v7] Erro processo ${idx + 1} pág ${page}, tentativa ${retryCount}:`, e?.message?.slice(0, 100));
              
              if (retryCount < params.max_retries) {
                const backoffMs = params.retry_base_delay_ms * Math.pow(2, retryCount - 1);
                await sleep(Math.min(backoffMs, 30000));
              }
            }
          }

          if (!success || !resp) {
            if (isBlockedError) {
              consecutiveBlocks++;
              console.warn(`[DJEN v7] Bloqueio consecutivo ${consecutiveBlocks}/${MAX_CONSECUTIVE_BLOCKS}`);
              
              if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) {
                console.error('[DJEN v7] Circuit breaker ativado: API bloqueada');
                updateProgress({
                  status: 'erro',
                  mensagem: `API bloqueada após ${consecutiveBlocks} tentativas. Aguarde e tente novamente.`,
                });
                toast.error('API PJE Comunica bloqueada. Tente novamente em alguns minutos.');
                return;
              }
            }
            
            console.warn(`[DJEN v7] Falha permanente processo ${idx + 1} página ${page}, pulando...`);
            break;
          }

          for (const pub of resp.items) {
            publicacoesAnalisadas++;

            const conteudo = pub.texto || pub.teor || '';
            if (!conteudo) continue;

            const dataDisponibilizacao = pub.dataDisponibilizacao || hoje;
            const dataPublicacao = pub.dataPublicacao || dataDisponibilizacao;
            
            const conteudoNorm = normalizeConteudo(conteudo);
            const hashConteudo = generateHash(`${processo.numero}|${dataPublicacao}|${conteudoNorm.slice(0, 2000)}`);

            if (seenHashes.has(hashConteudo)) {
              duplicadasTotal++;
              continue;
            }

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

            const { error: insertError } = await supabase
              .from('publicacoes_djen_processos')
              .insert({
                processo_id: processo.id,
                processo_numero: processo.numero,
                hash_conteudo: hashConteudo,
                data_publicacao: dataPublicacao,
                data_disponibilizacao: dataDisponibilizacao,
                conteudo: conteudo.slice(0, 50000),
                fonte: 'pje_comunica_browser_v7_processo_inteiro',
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
            mensagem: `Processo ${idx + 1}/${totalProcessos} | Pág ${page} | +${novasTotal} novas`,
          });

          if (hasMore && !canceladoRef.current) {
            await sleep(params.delay_entre_paginas);
          }
        }

        if ((idx + 1) % 5 === 0 || idx === processosMonitorados.length - 1) {
          await saveCheckpoint({
            currentGroup: idx + 1,
            totalGroups: totalProcessos,
            novas: novasTotal,
            duplicadas: duplicadasTotal,
            totalPublicacoesAnalisadas: publicacoesAnalisadas,
            percentage: Math.round(((idx + 1) / totalProcessos) * 100),
            startedAt,
          });
        }

        if (!canceladoRef.current && idx < processosMonitorados.length - 1) {
          await sleep(params.delay_entre_lotes);
        }
      }

      // Finalização
      if (canceladoRef.current) {
        updateProgress({
          status: 'cancelado',
          mensagem: `Cancelado. ${novasTotal} novas encontradas.`,
        });
        toast.warning('Monitoramento cancelado.');
      } else {
        updateProgress({
          status: 'concluido',
          currentGroup: totalProcessos,
          percentage: 100,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          mensagem: `Concluído! ${novasTotal} novas em ${totalProcessos} processos.`,
        });
        
        await saveCheckpoint({
          status: 'concluido' as any,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          currentGroup: totalProcessos,
          totalGroups: totalProcessos,
          startedAt,
        });
        
        toast.success(`Monitoramento concluído: ${novasTotal} novas publicações`);
      }

      // Salvar histórico
      await supabase.from('historico_monitoramento').insert({
        tipo: 'djen_processos',
        processos_verificados: processosMonitorados.length,
        novos_andamentos: novasTotal,
        erros: 0,
      });

      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen-processos'] });
      queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
      queryClient.invalidateQueries({ queryKey: ['djen-processos-historico'] });

    } catch (error: any) {
      console.error('[DJEN v7] Erro:', error);
      updateProgress({
        status: 'erro',
        mensagem: `Erro: ${error.message}`,
      });
      toast.error(`Erro no monitoramento: ${error.message}`);
    }
  }, [isExecutando, updateProgress, saveCheckpoint, queryClient]);

  const cancelar = useCallback(() => {
    canceladoRef.current = true;
    abortControllerRef.current?.abort();
    updateProgress({ status: 'cancelado', mensagem: 'Cancelando...' });
    toast.info('Cancelamento solicitado...');
  }, [updateProgress]);

  return {
    progresso,
    isExecutando,
    executar,
    cancelar,
  };
}
