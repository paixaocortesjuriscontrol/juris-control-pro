/**
 * Hook para monitorar processos DJEN diretamente no navegador.
 * 
 * ESTRATÉGIA v5: Busca por TRIBUNAL + Filtro Local
 * 
 * Em vez de buscar 13k+ processos individualmente, itera pelos ~54 tribunais
 * e filtra localmente quais publicações são de processos monitorados.
 * 
 * ~500-800 requisições vs ~13.000 = 10-20 minutos vs 7+ horas
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaNoBrowser } from "@/utils/pjeComunicaClient";
import { toast } from "sonner";

// Lista completa de tribunais para busca
const TRIBUNAIS_DJEN = [
  // Trabalhistas (maioria dos processos monitorados)
  'TST','TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9',
  'TRT10','TRT11','TRT12','TRT13','TRT14','TRT15','TRT16','TRT17','TRT18',
  'TRT19','TRT20','TRT21','TRT22','TRT23','TRT24',
  // Federais
  'TRF1','TRF2','TRF3','TRF4','TRF5','TRF6',
  // Estaduais (principais)
  'TJSP','TJRJ','TJMG','TJRS','TJPR','TJSC','TJBA','TJPE','TJCE',
  'TJGO','TJDF','TJMT','TJMS','TJPA','TJAM','TJES','TJMA','TJPB',
  'TJRN','TJAL','TJSE','TJPI','TJTO','TJRO','TJAC','TJAP','TJRR',
  // Superiores
  'STJ','STF'
];

export interface DjenProcessosProgress {
  status: 'idle' | 'executando' | 'pausado' | 'concluido' | 'erro' | 'cancelado';
  currentPage: number;
  totalPages: number;
  currentTribunal: number;
  totalTribunais: number;
  tribunalAtual: string;
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
  group_search_size: 50,
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

// Limite de páginas por tribunal (evita loops infinitos)
const MAX_PAGES_PER_TRIBUNAL = 20;

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
    currentPage: 0,
    totalPages: 0,
    currentTribunal: 0,
    totalTribunais: TRIBUNAIS_DJEN.length,
    tribunalAtual: '',
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
      // Calcular porcentagem baseado no progresso de tribunais
      if (next.totalTribunais > 0) {
        next.percentage = Math.min(100, Math.round((next.currentTribunal / next.totalTribunais) * 100));
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
            tribunal_atual: stats.currentTribunal ?? currentMeta.tribunal_atual ?? 0,
            total_tribunais: stats.totalTribunais ?? TRIBUNAIS_DJEN.length,
            novas: Math.max(stats.novas || 0, currentMeta.novas || 0),
            duplicadas: Math.max(stats.duplicadas || 0, currentMeta.duplicadas || 0),
            total_analisadas: Math.max(stats.totalPublicacoesAnalisadas || 0, currentMeta.total_analisadas || 0),
            percentage: Math.max(stats.percentage || 0, currentMeta.percentage || 0),
            status: stats.status || 'em_andamento',
            browser_execution: true,
            estrategia: 'por_tribunal_v5',
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
    
    const hoje = getBrazilISODate();
    const dataInicioEfetiva = dataInicio || hoje;
    const dataFimEfetiva = dataFim || hoje;

    try {
      const startedAt = new Date().toISOString();
      let novasTotal = 0;
      let duplicadasTotal = 0;
      let publicacoesAnalisadas = 0;
      const seenHashes = new Set<string>();

      // 1. Carregar parâmetros
      console.log('[DJEN v5] Carregando parâmetros...');
      updateProgress({
        status: 'executando',
        mensagem: 'Carregando parâmetros...',
        startedAt,
        elapsedSeconds: 0,
        totalTribunais: TRIBUNAIS_DJEN.length,
      });

      const params = await fetchParametrosDjen();
      console.log('[DJEN v5] Parâmetros carregados:', params);

      // 2. Buscar todos os processos monitorados e criar índice
      console.log('[DJEN v5] Carregando processos monitorados...');
      updateProgress({ mensagem: 'Indexando processos monitorados...' });

      const { data: processosMonitorados, error: procError } = await supabase
        .from('processos')
        .select('id, numero')
        .eq('monitorar_djen', true);

      if (procError) throw new Error(`Erro ao buscar processos: ${procError.message}`);

      if (!processosMonitorados?.length) {
        toast.info('Nenhum processo com monitoramento DJEN ativo.');
        updateProgress({ status: 'concluido', mensagem: 'Nenhum processo para monitorar' });
        return;
      }

      // Criar índice Map<numero_normalizado, processo> para lookup O(1)
      const processosMap = new Map<string, { id: string; numero: string }>();
      for (const p of processosMonitorados) {
        const numeroNorm = normalizeNumeroProcesso(p.numero);
        processosMap.set(numeroNorm, p);
      }

      console.log(`[DJEN v5] ${processosMap.size} processos indexados`);
      updateProgress({
        mensagem: `${processosMap.size} processos indexados. Iniciando busca por tribunal...`,
      });

      // 3. Iterar por TRIBUNAIS em vez de processos
      for (let t = 0; t < TRIBUNAIS_DJEN.length; t++) {
        if (canceladoRef.current) break;

        const tribunal = TRIBUNAIS_DJEN[t];
        let page = 0;
        let hasMore = true;
        let tribunalPublicacoesAnalisadas = 0;

        updateProgress({
          currentTribunal: t + 1,
          tribunalAtual: tribunal,
          currentPage: page,
          mensagem: `Tribunal ${t + 1}/${TRIBUNAIS_DJEN.length}: ${tribunal}`,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
        });

        // Paginar dentro do tribunal
        while (hasMore && page < MAX_PAGES_PER_TRIBUNAL) {
          if (canceladoRef.current) break;

          let retryCount = 0;
          let success = false;
          let resp: any = null;

          while (!success && retryCount < params.max_retries) {
            try {
              // Buscar publicações do tribunal no período
              resp = await buscarPjeComunicaNoBrowser({
                tipo: 'palavra-chave',
                siglaTribunal: tribunal,
                dataInicio: dataInicioEfetiva,
                dataFim: dataFimEfetiva,
                page,
                pageSize: 50,
              }, { signal: abortControllerRef.current?.signal });

              success = true;
            } catch (e: any) {
              if (e?.name === 'AbortError') break;
              
              retryCount++;
              console.warn(`[DJEN v5] Erro ${tribunal} página ${page}, tentativa ${retryCount}:`, e?.message?.slice(0, 100));
              
              if (retryCount < params.max_retries) {
                const backoffMs = params.retry_base_delay_ms * Math.pow(2, retryCount - 1);
                await sleep(Math.min(backoffMs, 30000));
              }
            }
          }

          if (!success || !resp) {
            console.warn(`[DJEN v5] Falha permanente ${tribunal} página ${page}, pulando...`);
            break;
          }

          // Processar publicações e filtrar localmente
          for (const pub of resp.items) {
            publicacoesAnalisadas++;
            tribunalPublicacoesAnalisadas++;

            const numeroProcessoPub = pub.numeroProcesso || '';
            const numeroNorm = normalizeNumeroProcesso(numeroProcessoPub);

            // FILTRO LOCAL: verificar se este processo está no nosso índice
            const processoMonitorado = processosMap.get(numeroNorm);
            if (!processoMonitorado) {
              continue; // Não é um dos nossos processos
            }

            const conteudo = pub.texto || pub.teor || '';
            if (!conteudo) continue;

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

            // Inserir nova publicação
            const { error: insertError } = await supabase
              .from('publicacoes_djen_processos')
              .insert({
                processo_id: processoMonitorado.id,
                processo_numero: processoMonitorado.numero,
                hash_conteudo: hashConteudo,
                data_publicacao: dataPublicacao,
                data_disponibilizacao: dataDisponibilizacao,
                conteudo: conteudo.slice(0, 50000),
                fonte: 'pje_comunica_browser_tribunal_v5',
              });

            if (!insertError) {
              seenHashes.add(hashConteudo);
              novasTotal++;
            }
          }

          hasMore = resp.hasMore && resp.items.length > 0;
          page++;

          // Atualizar UI a cada página
          updateProgress({
            currentPage: page,
            novas: novasTotal,
            duplicadas: duplicadasTotal,
            totalPublicacoesAnalisadas: publicacoesAnalisadas,
            mensagem: `${tribunal} | Página ${page} | +${novasTotal} novas`,
          });

          // Delay entre páginas
          if (hasMore && !canceladoRef.current) {
            await sleep(params.delay_entre_paginas);
          }
        }

        console.log(`[DJEN v5] ${tribunal}: ${tribunalPublicacoesAnalisadas} analisadas, ${novasTotal} novas total`);

        // Salvar checkpoint após cada tribunal
        await saveCheckpoint({
          currentTribunal: t + 1,
          totalTribunais: TRIBUNAIS_DJEN.length,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          percentage: Math.round(((t + 1) / TRIBUNAIS_DJEN.length) * 100),
          startedAt,
        });

        // Delay entre tribunais
        if (!canceladoRef.current && t < TRIBUNAIS_DJEN.length - 1) {
          await sleep(params.delay_entre_tribunais);
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
          currentTribunal: TRIBUNAIS_DJEN.length,
          percentage: 100,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          mensagem: `Concluído! ${novasTotal} novas em ${TRIBUNAIS_DJEN.length} tribunais.`,
        });
        
        await saveCheckpoint({
          status: 'concluido' as any,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          currentTribunal: TRIBUNAIS_DJEN.length,
          totalTribunais: TRIBUNAIS_DJEN.length,
          startedAt,
        });
        
        toast.success(`Monitoramento concluído: ${novasTotal} novas publicações`);
      }

      // Salvar histórico
      await supabase.from('historico_monitoramento').insert({
        tipo: 'djen_processos',
        processos_verificados: processosMap.size,
        novos_andamentos: novasTotal,
        erros: 0,
      });

      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen-processos'] });
      queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
      queryClient.invalidateQueries({ queryKey: ['djen-processos-historico'] });

    } catch (error: any) {
      console.error('[DJEN v5] Erro:', error);
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
