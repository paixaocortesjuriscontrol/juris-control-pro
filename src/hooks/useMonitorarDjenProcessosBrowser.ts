/**
 * Hook para monitorar processos DJEN diretamente no navegador.
 * 
 * ESTRATÉGIA v6: Busca por GRUPOS de processos com OR do Elasticsearch
 * 
 * Em vez de buscar 13k+ processos individualmente ou por tribunal sem filtro,
 * agrupa ~10 processos por requisição usando "OR" syntax do Elasticsearch.
 * 
 * ~1300 requisições vs ~13.000 = ~20-30 minutos vs 7+ horas
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaNoBrowser, isCnjFormat } from "@/utils/pjeComunicaClient";
import { toast } from "sonner";

// Quantos processos agrupar por requisição (Elasticsearch OR syntax)
const GROUP_SIZE = 10;
// Máximo de páginas por grupo
const MAX_PAGES_PER_GROUP = 5;

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
      group_search_size: params.group_search_size || GROUP_SIZE,
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

/**
 * Cria uma query OR para Elasticsearch com múltiplos números de processo.
 * Ex: "1234567890 OR 0987654321 OR 1111222233"
 */
function buildOrQuery(numeros: string[]): string {
  // Usar apenas os dígitos do processo
  const digits = numeros.map(n => normalizeNumeroProcesso(n));
  return digits.join(' OR ');
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
            estrategia: 'grupos_or_v6',
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
      console.log('[DJEN v6] Carregando parâmetros...');
      updateProgress({
        status: 'executando',
        mensagem: 'Carregando parâmetros...',
        startedAt,
        elapsedSeconds: 0,
      });

      const params = await fetchParametrosDjen();
      const groupSize = params.group_search_size || GROUP_SIZE;
      console.log('[DJEN v6] Parâmetros carregados, group_size:', groupSize);

      // 2. Buscar todos os processos monitorados
      console.log('[DJEN v6] Carregando processos monitorados...');
      updateProgress({ mensagem: 'Carregando processos monitorados...' });

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

      // Separar processos CNJ (podem ser agrupados) de legados (individuais)
      const processosCnj = processosMonitorados.filter(p => isCnjFormat(p.numero));
      const processosLegados = processosMonitorados.filter(p => !isCnjFormat(p.numero));

      // Criar índice Map<numero_normalizado, processo> para lookup O(1)
      const processosMap = new Map<string, { id: string; numero: string }>();
      for (const p of processosMonitorados) {
        const numeroNorm = normalizeNumeroProcesso(p.numero);
        processosMap.set(numeroNorm, p);
      }

      // Dividir processos CNJ em grupos
      const grupos: { id: string; numero: string }[][] = [];
      for (let i = 0; i < processosCnj.length; i += groupSize) {
        grupos.push(processosCnj.slice(i, i + groupSize));
      }
      // Processos legados são buscados individualmente
      for (const p of processosLegados) {
        grupos.push([p]);
      }

      const totalGrupos = grupos.length;
      console.log(`[DJEN v6] ${processosCnj.length} CNJ em ${Math.ceil(processosCnj.length / groupSize)} grupos + ${processosLegados.length} legados = ${totalGrupos} grupos total`);
      
      updateProgress({
        totalGroups: totalGrupos,
        mensagem: `${processosMonitorados.length} processos em ${totalGrupos} grupos. Iniciando busca...`,
      });

      // 3. Iterar por GRUPOS de processos
      for (let g = 0; g < grupos.length; g++) {
        if (canceladoRef.current) break;

        const grupo = grupos[g];
        const query = buildOrQuery(grupo.map(p => p.numero));
        let page = 0;
        let hasMore = true;
        let grupoPublicacoesAnalisadas = 0;

        updateProgress({
          currentGroup: g + 1,
          currentPage: page,
          mensagem: `Grupo ${g + 1}/${totalGrupos} (${grupo.length} processos)`,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
        });

        // Paginar dentro do grupo
        while (hasMore && page < MAX_PAGES_PER_GROUP) {
          if (canceladoRef.current) break;

          let retryCount = 0;
          let success = false;
          let resp: any = null;

          while (!success && retryCount < params.max_retries) {
            try {
              // Buscar usando OR query com os números do grupo
              resp = await buscarPjeComunicaNoBrowser({
                tipo: 'palavra-chave',
                palavraChave: query,
                dataInicio: dataInicioEfetiva,
                dataFim: dataFimEfetiva,
                page,
                pageSize: 50,
              }, { signal: abortControllerRef.current?.signal });

              success = true;
            } catch (e: any) {
              if (e?.name === 'AbortError') break;
              
              retryCount++;
              console.warn(`[DJEN v6] Erro grupo ${g + 1} página ${page}, tentativa ${retryCount}:`, e?.message?.slice(0, 100));
              
              if (retryCount < params.max_retries) {
                const backoffMs = params.retry_base_delay_ms * Math.pow(2, retryCount - 1);
                await sleep(Math.min(backoffMs, 30000));
              }
            }
          }

          if (!success || !resp) {
            console.warn(`[DJEN v6] Falha permanente grupo ${g + 1} página ${page}, pulando...`);
            break;
          }

          // Processar publicações
          for (const pub of resp.items) {
            publicacoesAnalisadas++;
            grupoPublicacoesAnalisadas++;

            const numeroProcessoPub = pub.numeroProcesso || '';
            const numeroNorm = normalizeNumeroProcesso(numeroProcessoPub);

            // Verificar se este processo está no nosso grupo
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
                fonte: 'pje_comunica_browser_or_v6',
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
            mensagem: `Grupo ${g + 1}/${totalGrupos} | Página ${page} | +${novasTotal} novas`,
          });

          // Delay entre páginas
          if (hasMore && !canceladoRef.current) {
            await sleep(params.delay_entre_paginas);
          }
        }

        console.log(`[DJEN v6] Grupo ${g + 1}: ${grupoPublicacoesAnalisadas} analisadas, ${novasTotal} novas total`);

        // Salvar checkpoint a cada 10 grupos
        if ((g + 1) % 10 === 0 || g === grupos.length - 1) {
          await saveCheckpoint({
            currentGroup: g + 1,
            totalGroups: totalGrupos,
            novas: novasTotal,
            duplicadas: duplicadasTotal,
            totalPublicacoesAnalisadas: publicacoesAnalisadas,
            percentage: Math.round(((g + 1) / totalGrupos) * 100),
            startedAt,
          });
        }

        // Delay entre grupos
        if (!canceladoRef.current && g < grupos.length - 1) {
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
          currentGroup: totalGrupos,
          percentage: 100,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          mensagem: `Concluído! ${novasTotal} novas em ${totalGrupos} grupos.`,
        });
        
        await saveCheckpoint({
          status: 'concluido' as any,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          currentGroup: totalGrupos,
          totalGroups: totalGrupos,
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
      console.error('[DJEN v6] Erro:', error);
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
