/**
 * Hook para monitorar processos DJEN diretamente no navegador.
 * 
 * SOLUÇÃO DEFINITIVA para WORKER_LIMIT (546):
 * A Edge Function excede o limite de 150MB de memória ao processar 13k+ processos.
 * Este hook executa as buscas localmente no navegador do usuário, aproveitando
 * sua conexão de rede e memória ilimitada.
 * 
 * OTIMIZAÇÃO v2: Busca agrupada com OR
 * - Agrupa 10 processos por requisição usando sintaxe "OR"
 * - 3 requisições paralelas = 30 processos simultâneos
 * - Reduz tempo de ~2h para ~10-15 minutos (ganho 8-12x)
 * 
 * Arquitetura:
 * 1. Busca processos do banco em super-lotes de 200
 * 2. Separa CNJ (busca OR) vs legado (busca individual)
 * 3. Para CNJ: agrupa em chunks de 10 e executa 3 em paralelo
 * 4. Salva novas publicações no banco via Supabase client
 * 5. Mantém checkpoint para retomada em caso de erro/cancelamento
 */

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  buscarPjeComunicaNoBrowser,
  buscarPjeComunicaMultiplosProcessos,
  isCnjFormat,
  BUSCA_AGRUPADA_CONFIG
} from "@/utils/pjeComunicaClient";
import { toast } from "sonner";

// Configuração otimizada para busca agrupada
const CONFIG = {
  superBatchSize: BUSCA_AGRUPADA_CONFIG.superBatchSize,
  processosPerRequest: BUSCA_AGRUPADA_CONFIG.processosPerRequest,
  parallelRequests: BUSCA_AGRUPADA_CONFIG.parallelRequests,
  delayBetweenGroups: BUSCA_AGRUPADA_CONFIG.delayBetweenGroups,
  delayBetweenSuperBatches: BUSCA_AGRUPADA_CONFIG.delayBetweenSuperBatches,
  legacyDelayBetweenProcesses: 500,
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
  startedAt: string | null;
}

interface MonitorarDjenProcessosBrowserReturn {
  progresso: DjenProcessosProgress;
  isExecutando: boolean;
  executar: (dataInicio?: string, dataFim?: string, retomar?: boolean) => Promise<void>;
  cancelar: () => void;
}

// === Funções auxiliares fora do componente para evitar re-criação ===

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

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function processarPublicacoes(
  processo: { id: string; numero: string },
  items: any[],
  seenHashes: Set<string>,
  hoje: string
): Promise<{ novas: number; duplicadas: number }> {
  let novas = 0;
  let duplicadas = 0;

  for (const pub of items) {
    const conteudo = pub.texto || pub.teor || '';
    if (!conteudo) continue;

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
        fonte: 'pje_comunica_browser',
      });

    if (!insertError) {
      seenHashes.add(hashConteudo);
      novas++;
    }
  }

  return { novas, duplicadas };
}

async function processarChunkOR(
  processos: { id: string; numero: string }[],
  params: { dataInicio: string; dataFim: string },
  seenHashes: Set<string>,
  hoje: string,
  signal?: AbortSignal
): Promise<{ novas: number; duplicadas: number; processosComNovas: number }> {
  let novasTotal = 0;
  let duplicadasTotal = 0;
  let processosComNovas = 0;

  const numerosProcesso = processos.map(p => p.numero);
  const processosPorNumero = new Map(processos.map(p => [p.numero, p]));
  const processosPorDigitos = new Map(processos.map(p => [p.numero.replace(/\D/g, ''), p]));

  try {
    const resultado = await buscarPjeComunicaMultiplosProcessos(
      numerosProcesso,
      { dataInicio: params.dataInicio, dataFim: params.dataFim },
      { signal }
    );

    for (const [numProc, items] of resultado.porProcesso) {
      if (items.length === 0) continue;

      const processo = processosPorNumero.get(numProc) || 
                      processosPorDigitos.get(numProc.replace(/\D/g, ''));
      if (!processo) continue;

      const { novas, duplicadas } = await processarPublicacoes(processo, items, seenHashes, hoje);
      novasTotal += novas;
      duplicadasTotal += duplicadas;
      if (novas > 0) processosComNovas++;
    }

  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    
    if (processos.length > 1) {
      console.warn(`[DJEN OR] Falha com ${processos.length} processos, tentando metade...`);
      const metade = Math.ceil(processos.length / 2);
      const primeira = processos.slice(0, metade);
      const segunda = processos.slice(metade);

      const r1 = await processarChunkOR(primeira, params, seenHashes, hoje, signal);
      const r2 = await processarChunkOR(segunda, params, seenHashes, hoje, signal);

      return {
        novas: r1.novas + r2.novas,
        duplicadas: r1.duplicadas + r2.duplicadas,
        processosComNovas: r1.processosComNovas + r2.processosComNovas,
      };
    } else {
      console.warn(`[DJEN OR] Fallback individual para ${processos[0]?.numero}`);
      try {
        const resp = await buscarPjeComunicaNoBrowser({
          tipo: 'processo',
          numeroProcesso: processos[0].numero,
          dataInicio: params.dataInicio,
          dataFim: params.dataFim,
        }, { signal });

        const { novas, duplicadas } = await processarPublicacoes(processos[0], resp.items, seenHashes, hoje);
        return { novas, duplicadas, processosComNovas: novas > 0 ? 1 : 0 };
      } catch {
        return { novas: 0, duplicadas: 0, processosComNovas: 0 };
      }
    }
  }

  return { novas: novasTotal, duplicadas: duplicadasTotal, processosComNovas };
}

async function processarLegadosIndividual(
  processos: { id: string; numero: string }[],
  params: { dataInicio: string; dataFim: string },
  seenHashes: Set<string>,
  hoje: string,
  signal?: AbortSignal,
  onProgress?: (processed: number) => void
): Promise<{ novas: number; duplicadas: number; processosComNovas: number }> {
  let novasTotal = 0;
  let duplicadasTotal = 0;
  let processosComNovas = 0;

  for (let i = 0; i < processos.length; i++) {
    if (signal?.aborted) break;

    const processo = processos[i];
    try {
      const resp = await buscarPjeComunicaNoBrowser({
        tipo: 'processo',
        numeroProcesso: processo.numero,
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
      }, { signal });

      const { novas, duplicadas } = await processarPublicacoes(processo, resp.items, seenHashes, hoje);
      novasTotal += novas;
      duplicadasTotal += duplicadas;
      if (novas > 0) processosComNovas++;

      onProgress?.(i + 1);

      await new Promise(r => setTimeout(r, CONFIG.legacyDelayBetweenProcesses));
    } catch (e: any) {
      if (e?.name === 'AbortError') break;
      console.warn(`[DJEN Legado] Erro ${processo.numero}:`, e?.message);
    }
  }

  return { novas: novasTotal, duplicadas: duplicadasTotal, processosComNovas };
}

// === Hook principal ===

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

  const saveCheckpoint = useCallback(async (offset: number, stats: Partial<DjenProcessosProgress>) => {
    try {
      const { data: config } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen_processos')
        .maybeSingle();
      
      const currentMeta = (config?.metadata as Record<string, any>) || {};

      const runStartedAt =
        currentMeta.run_started_at ||
        (stats.startedAt as string | undefined) ||
        currentMeta.startedAt ||
        null;
      
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
            run_started_at: runStartedAt,
            updated_at: new Date().toISOString(),
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
    const params = { dataInicio: dataInicioEfetiva, dataFim: dataFimEfetiva };

    try {
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

      let startedAt = new Date().toISOString();
      if (retomar && meta?.run_started_at) {
        startedAt = meta.run_started_at;
      }
      
      if (retomar && meta?.next_offset) {
        startOffset = meta.next_offset || 0;
        novasTotal = meta.novas || 0;
        duplicadasTotal = meta.duplicadas || 0;
        processosComNovas = meta.processosComNovas || 0;
        
        toast.info(`Retomando do offset ${startOffset} (${novasTotal} novas já encontradas)`);
      } else if (retomar) {
        toast.info('Nenhum checkpoint encontrado. Iniciando do zero.');
      }

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

      updateProgress({
        status: 'executando',
        current: startOffset,
        total,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        processosComNovas,
        mensagem: retomar ? `Retomando de ${startOffset}/${total}...` : 'Iniciando monitoramento otimizado...',
        offset: startOffset,
        startedAt,
      });

      let offset = startOffset;
      const seenHashes = new Set<string>();
      const superBatchNum = Math.ceil(total / CONFIG.superBatchSize);

      while (offset < total && !canceladoRef.current) {
        const currentSuperBatch = Math.floor(offset / CONFIG.superBatchSize) + 1;
        
        updateProgress({
          mensagem: `Super-lote ${currentSuperBatch}/${superBatchNum} (${offset}/${total})...`,
          current: offset,
        });

        const { data: processos, error: procError } = await supabase
          .from('processos')
          .select('id, numero, status, coordenacao_id')
          .eq('monitorar_djen', true)
          .order('numero', { ascending: true })
          .range(offset, offset + CONFIG.superBatchSize - 1);

        if (procError) {
          throw new Error(`Erro ao buscar processos: ${procError.message}`);
        }

        if (!processos?.length) {
          throw new Error('Nenhum processo retornado no super-lote.');
        }

        const processosCNJ = processos.filter(p => isCnjFormat(p.numero));
        const processosLegados = processos.filter(p => !isCnjFormat(p.numero));

        console.log(`[DJEN Browser] Super-lote ${currentSuperBatch}: ${processosCNJ.length} CNJ, ${processosLegados.length} legados`);

        // Processar CNJ com busca OR agrupada
        if (processosCNJ.length > 0 && !canceladoRef.current) {
          updateProgress({ mensagem: `Processando ${processosCNJ.length} processos CNJ (busca otimizada)...` });

          const chunks = chunkArray(processosCNJ, CONFIG.processosPerRequest);
          const parallelGroups = chunkArray(chunks, CONFIG.parallelRequests);
          
          for (const group of parallelGroups) {
            if (canceladoRef.current) break;

            const results = await Promise.allSettled(
              group.map(chunk => 
                processarChunkOR(
                  chunk,
                  params,
                  seenHashes,
                  hoje,
                  abortControllerRef.current?.signal
                )
              )
            );

            for (const result of results) {
              if (result.status === 'fulfilled') {
                novasTotal += result.value.novas;
                duplicadasTotal += result.value.duplicadas;
                processosComNovas += result.value.processosComNovas;
              }
            }

            const processedInGroup = group.reduce((acc, chunk) => acc + chunk.length, 0);
            const newCurrent = Math.min(total, offset + processedInGroup);
            updateProgress({
              current: newCurrent,
              novas: novasTotal,
              duplicadas: duplicadasTotal,
              processosComNovas,
              mensagem: `${newCurrent}/${total} processos (${novasTotal} novas)`,
            });

            if (!canceladoRef.current) {
              await new Promise(r => setTimeout(r, CONFIG.delayBetweenGroups));
            }
          }
        }

        // Processar legados individualmente
        if (processosLegados.length > 0 && !canceladoRef.current) {
          updateProgress({ mensagem: `Processando ${processosLegados.length} processos legados...` });

          const legadoResult = await processarLegadosIndividual(
            processosLegados,
            params,
            seenHashes,
            hoje,
            abortControllerRef.current?.signal,
            (processed) => {
              updateProgress({
                current: offset + processosCNJ.length + processed,
                mensagem: `Legados: ${processed}/${processosLegados.length}`,
              });
            }
          );

          novasTotal += legadoResult.novas;
          duplicadasTotal += legadoResult.duplicadas;
          processosComNovas += legadoResult.processosComNovas;
        }

        offset += processos.length;

        const currentStats = {
          current: offset,
          total,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          processosComNovas,
          percentage: Math.round((offset / total) * 100),
          startedAt,
        };
        
        updateProgress({
          ...currentStats,
          mensagem: `${offset}/${total} processos (${novasTotal} novas)`,
          offset,
        });

        await saveCheckpoint(offset, currentStats);

        if (offset < total && !canceladoRef.current) {
          await new Promise(r => setTimeout(r, CONFIG.delayBetweenSuperBatches));
        }
      }

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
        
        await saveCheckpoint(0, { status: 'concluido' as any, current: total, total, novas: novasTotal, startedAt });
        
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
