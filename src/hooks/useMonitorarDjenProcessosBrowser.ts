/**
 * Hook para monitorar processos DJEN diretamente no navegador.
 * 
 * SOLUÇÃO DEFINITIVA para WORKER_LIMIT (546):
 * A Edge Function excede o limite de 150MB de memória ao processar 13k+ processos.
 * Este hook executa as buscas localmente no navegador do usuário, aproveitando
 * sua conexão de rede e memória ilimitada.
 * 
 * Arquitetura:
 * 1. Busca processos do banco em lotes pequenos
 * 2. Para cada processo, busca publicações via API PJE Comunica (browser-direct)
 * 3. Salva novas publicações no banco via Supabase client
 * 4. Mantém checkpoint para retomada em caso de erro/cancelamento
 */

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaNoBrowser } from "@/utils/pjeComunicaClient";
import { toast } from "sonner";

// Configuração conservadora para evitar rate limit (429)
const CONFIG = {
  batchSize: 20,              // Processos por lote
  delayBetweenProcesses: 500, // 500ms entre processos
  delayBetweenBatches: 2000,  // 2s entre lotes
  maxRetries: 3,
  retryDelay: 5000,
};

export interface DjenProcessosProgress {
  status: 'idle' | 'executando' | 'pausado' | 'concluido' | 'erro' | 'cancelado';
  current: number;
  total: number;
  percentage: number;
  novas: number;
  duplicadas: number;
  processosComNovas: number;
  mensagem: string;
  offset: number;
  startedAt: string | null; // ISO timestamp para calcular tempo decorrido
}

interface MonitorarDjenProcessosBrowserReturn {
  progresso: DjenProcessosProgress;
  isExecutando: boolean;
  executar: (dataInicio?: string, dataFim?: string, retomar?: boolean) => Promise<void>;
  cancelar: () => void;
}

function getBrazilISODate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
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

export function useMonitorarDjenProcessosBrowser(): MonitorarDjenProcessosBrowserReturn {
  const queryClient = useQueryClient();
  const canceladoRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [progresso, setProgresso] = useState<DjenProcessosProgress>({
    status: 'idle',
    current: 0,
    total: 0,
    percentage: 0,
    novas: 0,
    duplicadas: 0,
    processosComNovas: 0,
    mensagem: '',
    offset: 0,
    startedAt: null,
  });

  const isExecutando = progresso.status === 'executando';

  const updateProgress = useCallback((updates: Partial<DjenProcessosProgress>) => {
    setProgresso(prev => {
      const next = { ...prev, ...updates };
      if (next.total > 0) {
        next.percentage = Math.min(100, Math.round((next.current / next.total) * 100));
      }
      return next;
    });
  }, []);

  // Salvar checkpoint com mais frequência para evitar perda de progresso em timeout
  const saveCheckpoint = useCallback(async (offset: number, stats: Partial<DjenProcessosProgress>) => {
    try {
      const { data: config } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen_processos')
        .maybeSingle();
      
      const currentMeta = (config?.metadata as Record<string, any>) || {};
      
      // Manter valores máximos para evitar regressão
      const novas = Math.max(stats.novas || 0, currentMeta.novas || 0);
      const duplicadas = Math.max(stats.duplicadas || 0, currentMeta.duplicadas || 0);
      const processosComNovas = Math.max(stats.processosComNovas || 0, currentMeta.processosComNovas || 0);
      
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          ultima_execucao: new Date().toISOString(),
          metadata: {
            ...currentMeta,
            next_offset: Math.max(offset, currentMeta.next_offset || 0),
            current: Math.max(stats.current || 0, currentMeta.current || 0),
            total: stats.total || currentMeta.total || 0,
            novas,
            duplicadas,
            processosComNovas,
            percentage: Math.max(stats.percentage || 0, currentMeta.percentage || 0),
            status: stats.status || 'em_andamento',
            browser_execution: true,
            updated_at: new Date().toISOString(),
            // Limpar flags de erro ao salvar progresso ativo
            last_error: null,
            last_stop_reason: null,
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
    retomar = false
  ) => {
    if (isExecutando) return;
    
    canceladoRef.current = false;
    abortControllerRef.current = new AbortController();
    
    const hoje = getBrazilISODate();
    const dataInicioEfetiva = dataInicio || hoje;
    const dataFimEfetiva = dataFim || hoje;

    try {
      // Buscar offset e contadores salvos
      let startOffset = 0;
      let novasTotal = 0;
      let duplicadasTotal = 0;
      let processosComNovas = 0;
      
      const { data: config } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen_processos')
        .maybeSingle();
      
      const meta = config?.metadata as Record<string, any> | null;
      
      if (retomar && meta?.next_offset) {
        startOffset = meta.next_offset || 0;
        // IMPORTANTE: Restaurar contadores do checkpoint para não perder progresso
        novasTotal = meta.novas || 0;
        duplicadasTotal = meta.duplicadas || 0;
        processosComNovas = meta.processosComNovas || 0;
        
        toast.info(`Retomando do offset ${startOffset} (${novasTotal} novas já encontradas)`);
      } else if (retomar) {
        toast.info('Nenhum checkpoint encontrado. Iniciando do zero.');
      }

      // Contar total de processos
      const { count: totalProcessos } = await supabase
        .from('processos')
        .select('id', { count: 'exact', head: true })
        .eq('monitorar_djen', true);

      const total = totalProcessos || 0;
      
      if (total === 0) {
        toast.info('Nenhum processo com monitoramento DJEN ativo.');
        updateProgress({ status: 'concluido', mensagem: 'Nenhum processo para monitorar' });
        return;
      }

      const startedAt = new Date().toISOString();
      updateProgress({
        status: 'executando',
        current: startOffset,
        total,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        processosComNovas,
        mensagem: retomar ? `Retomando de ${startOffset}/${total}...` : 'Iniciando monitoramento...',
        offset: startOffset,
        startedAt,
      });

      let offset = startOffset;
      const seenHashes = new Set<string>();

      // Processar em lotes
      while (offset < total && !canceladoRef.current) {
        // Buscar lote de processos
        const { data: processos, error: procError } = await supabase
          .from('processos')
          .select('id, numero, status, coordenacao_id')
          .eq('monitorar_djen', true)
          .order('numero', { ascending: true })
          .range(offset, offset + CONFIG.batchSize - 1);

        if (procError) {
          console.error('[DJEN Processos Browser] Erro ao buscar processos:', procError);
          throw new Error(`Erro ao buscar processos: ${procError.message || 'erro desconhecido'}`);
        }

        if (!processos?.length) {
          // Não deveria acontecer se total > 0; tratar como falha para evitar "Executando" eterno.
          throw new Error('Nenhum processo retornado no lote. Tente Retomar ou Reiniciar.');
        }

        updateProgress({
          mensagem: `Processando lote ${Math.floor(offset / CONFIG.batchSize) + 1}...`,
          current: offset,
        });

        // Processar cada processo do lote
        for (let i = 0; i < processos.length; i++) {
          const processo = processos[i];
          if (canceladoRef.current) break;

          // Atualização contínua: evita o card ficar "parado" até terminar todo o lote.
          // (Uma atualização por processo é aceitável pois já há delay de 500ms entre processos.)
          const currentGlobal = Math.min(total, offset + i + 1);
          updateProgress({
            current: currentGlobal,
            mensagem: `Processando ${currentGlobal}/${total} processos...`,
          });

          try {
            // Buscar publicações via browser
            const resp = await buscarPjeComunicaNoBrowser({
              tipo: 'processo',
              numeroProcesso: processo.numero,
              dataInicio: dataInicioEfetiva,
              dataFim: dataFimEfetiva,
            }, { signal: abortControllerRef.current?.signal });

            let novasDoProcesso = 0;

            for (const pub of resp.items) {
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

              // Verificar se já existe no banco
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
                  fonte: 'pje_comunica_browser',
                });

              if (!insertError) {
                seenHashes.add(hashConteudo);
                novasTotal++;
                novasDoProcesso++;
              }
            }

            if (novasDoProcesso > 0) {
              processosComNovas++;
            }

            // Pequeno delay entre processos para evitar rate limit
            await new Promise(r => setTimeout(r, CONFIG.delayBetweenProcesses));

            // Salvar checkpoint a cada 5 processos para minimizar perda em timeout
            if ((i + 1) % 5 === 0) {
              const microCheckpoint = {
                current: currentGlobal,
                total,
                novas: novasTotal,
                duplicadas: duplicadasTotal,
                processosComNovas,
                percentage: Math.round((currentGlobal / total) * 100),
              };
              saveCheckpoint(currentGlobal, microCheckpoint); // fire-and-forget (sem await para não atrasar)
            }

          } catch (e: any) {
            if (e.name === 'AbortError') break;
            console.warn(`[DJEN Processos Browser] Erro no processo ${processo.numero}:`, e.message);
          }
        }

        offset += processos.length;

        // Atualizar progresso e salvar checkpoint após cada lote
        const currentStats = {
          current: offset,
          total,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          processosComNovas,
          percentage: Math.round((offset / total) * 100),
        };
        
        updateProgress({
          ...currentStats,
          mensagem: `${offset}/${total} processos (${novasTotal} novas)`,
          offset,
        });

        // Checkpoint garantido ao final de cada lote
        await saveCheckpoint(offset, currentStats);

        // Delay entre lotes
        if (offset < total && !canceladoRef.current) {
          await new Promise(r => setTimeout(r, CONFIG.delayBetweenBatches));
        }
      }

      // Finalização
      if (canceladoRef.current) {
        updateProgress({
          status: 'cancelado',
          mensagem: `Cancelado em ${offset}/${total}. Use "Retomar" para continuar.`,
        });
        toast.warning('Monitoramento cancelado. Progresso salvo para retomada.');
      } else {
        updateProgress({
          status: 'concluido',
          current: total,
          percentage: 100,
          mensagem: `Concluído! ${novasTotal} novas publicações encontradas.`,
        });
        
        // Limpar checkpoint
        await saveCheckpoint(0, { status: 'concluido' as any, current: total, total, novas: novasTotal });
        
        toast.success(`Monitoramento concluído: ${novasTotal} novas publicações`);
      }

      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen-processos'] });

    } catch (error: any) {
      console.error('[DJEN Processos Browser] Erro:', error);
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
