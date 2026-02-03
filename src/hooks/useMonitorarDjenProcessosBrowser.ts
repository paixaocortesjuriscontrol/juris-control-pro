/**
 * Hook para monitorar processos DJEN diretamente no navegador.
 * 
 * ESTRATÉGIA v4: Busca por Página + Filtro Local (OR do lado da aplicação)
 * 
 * Em vez de fazer 13.000 requisições individuais (uma por processo),
 * buscamos TODAS as publicações do DJEN do dia em páginas e comparamos
 * localmente com um Set de processos monitorados.
 * 
 * Vantagens:
 * - ~50-100 requisições vs 13.000
 * - 5-10 minutos vs 3.5 horas
 * - Menor risco de 429 (rate limit)
 * 
 * Arquitetura:
 * 1. Carrega todos os números de processo monitorados (1 query)
 * 2. Cria Set para lookup O(1)
 * 3. Busca páginas do DJEN até acabar
 * 4. Filtra localmente: se numeroProcesso está no Set → salvar
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaNoBrowser } from "@/utils/pjeComunicaClient";
import { toast } from "sonner";

// Configuração para busca por página
const CONFIG = {
  pageSize: 50,           // Itens por página da API
  maxPages: 500,          // Limite de segurança
  delayBetweenPages: 800, // Delay entre páginas (ms)
  checkpointInterval: 10, // Salvar checkpoint a cada N páginas
  tribunais: [            // Tribunais a buscar (principais trabalhistas + federais)
    'TRT1', 'TRT2', 'TRT3', 'TRT4', 'TRT5', 'TRT6', 'TRT7', 'TRT8', 
    'TRT9', 'TRT10', 'TRT11', 'TRT12', 'TRT13', 'TRT14', 'TRT15', 
    'TRT16', 'TRT17', 'TRT18', 'TRT19', 'TRT20', 'TRT21', 'TRT22', 
    'TRT23', 'TRT24', 'TST',
    'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6',
    'TJSP', 'TJRJ', 'TJMG', 'TJRS', 'TJPR', 'TJSC', 'TJBA', 'TJPE',
    'TJCE', 'TJGO', 'TJDF', 'TJPB', 'TJRN', 'TJES', 'TJMA', 'TJMT',
    'TJMS', 'TJAL', 'TJSE', 'TJPI', 'TJTO', 'TJAM', 'TJPA', 'TJRO',
    'TJAC', 'TJAP', 'TJRR',
  ],
};

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
  // Remove tudo exceto dígitos
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
    totalTribunais: CONFIG.tribunais.length,
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
  useEffect(() => {
    if (isExecutando && progresso.startedAt) {
      timerRef.current = setInterval(() => {
        setProgresso(prev => {
          if (!prev.startedAt) return prev;
          const elapsed = Math.floor((Date.now() - new Date(prev.startedAt).getTime()) / 1000);
          return { ...prev, elapsedSeconds: elapsed };
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isExecutando, progresso.startedAt]);

  const updateProgress = useCallback((updates: Partial<DjenProcessosProgress>) => {
    setProgresso(prev => {
      const next = { ...prev, ...updates };
      // Calcular porcentagem baseado em tribunais + páginas
      if (next.totalTribunais > 0) {
        const tribunalProgress = (next.currentTribunal / next.totalTribunais);
        // Assumir média de 5 páginas por tribunal para estimativa
        const pageWeight = next.totalPages > 0 ? (next.currentPage / Math.max(next.totalPages, 5)) : 0;
        const combinedProgress = (tribunalProgress * 0.9) + (pageWeight * 0.1 / next.totalTribunais);
        next.percentage = Math.min(100, Math.round(combinedProgress * 100));
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
            current_tribunal: stats.currentTribunal ?? currentMeta.current_tribunal ?? 0,
            tribunal_atual: stats.tribunalAtual ?? currentMeta.tribunal_atual ?? '',
            novas: Math.max(stats.novas || 0, currentMeta.novas || 0),
            duplicadas: Math.max(stats.duplicadas || 0, currentMeta.duplicadas || 0),
            total_analisadas: Math.max(stats.totalPublicacoesAnalisadas || 0, currentMeta.total_analisadas || 0),
            percentage: Math.max(stats.percentage || 0, currentMeta.percentage || 0),
            status: stats.status || 'em_andamento',
            browser_execution: true,
            run_started_at: stats.startedAt || currentMeta.run_started_at,
            updated_at: new Date().toISOString(),
          },
        })
        .eq('tipo', 'djen_processos');
    } catch (e) {
      console.warn('[DJEN Processos Browser] Erro ao salvar checkpoint:', e);
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

      // 1. Buscar TODOS os números de processos monitorados (uma única query)
      console.log('[DJEN v4] Carregando processos monitorados...');
      updateProgress({
        status: 'executando',
        mensagem: 'Carregando processos monitorados...',
        startedAt,
        elapsedSeconds: 0,
      });

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

      // 2. Criar índice de lookup rápido O(1)
      const processosMap = new Map<string, { id: string; numero: string }>();
      for (const proc of processosMonitorados) {
        const normalized = normalizeNumeroProcesso(proc.numero);
        processosMap.set(normalized, proc);
      }

      console.log(`[DJEN v4] ${processosMap.size} processos indexados para comparação local`);
      updateProgress({
        mensagem: `${processosMap.size} processos indexados. Iniciando busca por tribunal...`,
      });

      // 3. Iterar por tribunais e buscar páginas
      const tribunais = CONFIG.tribunais;
      
      for (let tribIdx = 0; tribIdx < tribunais.length; tribIdx++) {
        if (canceladoRef.current) break;
        
        const tribunal = tribunais[tribIdx];
        let page = 0;
        let hasMore = true;
        let pagesThisTribunal = 0;

        updateProgress({
          currentTribunal: tribIdx,
          totalTribunais: tribunais.length,
          tribunalAtual: tribunal,
          currentPage: 0,
          totalPages: 0,
          mensagem: `Buscando ${tribunal} (${tribIdx + 1}/${tribunais.length})...`,
        });

        while (hasMore && !canceladoRef.current && page < CONFIG.maxPages) {
          try {
            // Buscar página do DJEN para este tribunal
            const resp = await buscarPjeComunicaNoBrowser({
              tipo: 'palavra-chave',
              palavraChave: '*', // Busca geral
              siglaTribunal: tribunal,
              dataInicio: dataInicioEfetiva,
              dataFim: dataFimEfetiva,
              page,
              pageSize: CONFIG.pageSize,
            }, { signal: abortControllerRef.current?.signal });

            pagesThisTribunal++;
            const estimatedTotal = resp.totalElements > 0 
              ? Math.ceil(resp.totalElements / CONFIG.pageSize) 
              : pagesThisTribunal;

            updateProgress({
              currentPage: page + 1,
              totalPages: estimatedTotal,
              mensagem: `${tribunal}: página ${page + 1}/${estimatedTotal} (${novasTotal} novas)`,
            });

            // 4. Filtrar localmente: verificar se cada publicação é de um processo nosso
            for (const pub of resp.items) {
              publicacoesAnalisadas++;
              
              const numPub = pub.numeroProcesso ? normalizeNumeroProcesso(pub.numeroProcesso) : '';
              if (!numPub) continue;

              // LOOKUP O(1): está em algum dos nossos processos?
              const processo = processosMap.get(numPub);
              if (!processo) continue;

              // É nosso! Verificar duplicata e salvar
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
                  processo_id: processo.id,
                  processo_numero: processo.numero,
                  hash_conteudo: hashConteudo,
                  data_publicacao: dataPublicacao,
                  data_disponibilizacao: dataDisponibilizacao,
                  conteudo: conteudo.slice(0, 50000),
                  fonte: `pje_comunica_browser_${tribunal}`,
                });

              if (!insertError) {
                seenHashes.add(hashConteudo);
                novasTotal++;
              }
            }

            // Verificar se há mais páginas
            hasMore = resp.hasMore && resp.items.length > 0;
            page++;

            // Delay entre páginas
            if (hasMore && !canceladoRef.current) {
              await new Promise(r => setTimeout(r, CONFIG.delayBetweenPages));
            }

            // Checkpoint a cada N páginas
            if (page % CONFIG.checkpointInterval === 0) {
              await saveCheckpoint({
                currentTribunal: tribIdx,
                tribunalAtual: tribunal,
                novas: novasTotal,
                duplicadas: duplicadasTotal,
                totalPublicacoesAnalisadas: publicacoesAnalisadas,
                startedAt,
              });
            }

          } catch (e: any) {
            if (e?.name === 'AbortError') break;
            console.warn(`[DJEN v4] Erro ${tribunal} página ${page}:`, e?.message);
            // Continuar para próximo tribunal em caso de erro
            break;
          }
        }

        // Checkpoint após cada tribunal
        await saveCheckpoint({
          currentTribunal: tribIdx + 1,
          tribunalAtual: tribunal,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          startedAt,
        });

        // Delay entre tribunais
        if (!canceladoRef.current && tribIdx < tribunais.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Finalização
      if (canceladoRef.current) {
        updateProgress({
          status: 'cancelado',
          mensagem: `Cancelado. ${novasTotal} novas encontradas até agora.`,
        });
        toast.warning('Monitoramento cancelado.');
      } else {
        updateProgress({
          status: 'concluido',
          currentTribunal: tribunais.length,
          percentage: 100,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          mensagem: `Concluído! ${novasTotal} novas em ${publicacoesAnalisadas.toLocaleString()} analisadas.`,
        });
        
        await saveCheckpoint({
          status: 'concluido' as any,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          totalPublicacoesAnalisadas: publicacoesAnalisadas,
          currentTribunal: tribunais.length,
          startedAt,
        });
        
        toast.success(`Monitoramento concluído: ${novasTotal} novas publicações`);
      }

      // Salvar histórico
      await supabase.from('historico_monitoramento').insert({
        tipo: 'djen_processos',
        processos_verificados: publicacoesAnalisadas,
        novos_andamentos: novasTotal,
        erros: 0,
      });

      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen-processos'] });
      queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
      queryClient.invalidateQueries({ queryKey: ['djen-processos-historico'] });

    } catch (error: any) {
      console.error('[DJEN v4] Erro:', error);
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
