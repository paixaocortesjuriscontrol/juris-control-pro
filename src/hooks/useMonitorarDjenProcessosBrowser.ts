/**
 * Hook para monitorar processos DJEN diretamente no navegador.
 * 
 * SOLUÇÃO DEFINITIVA para WORKER_LIMIT (546):
 * A Edge Function excede o limite de 150MB de memória ao processar 13k+ processos.
 * Este hook executa as buscas localmente no navegador do usuário, aproveitando
 * sua conexão de rede e memória ilimitada.
 * 
 * ESTRATÉGIA v3: Busca Paralela Individual (OR do lado da aplicação)
 * - A API PJE Comunica NÃO suporta sintaxe OR no parâmetro texto/palavraChave
 * - Executamos 5 buscas individuais em paralelo via Promise.allSettled
 * - Throughput: ~60 processos/minuto
 * - Tempo estimado para 13k processos: ~3.5 horas
 * 
 * Arquitetura:
 * 1. Busca processos do banco usando keyset pagination (evita timeout)
 * 2. Executa 5 buscas paralelas por ciclo
 * 3. Salva novas publicações no banco via Supabase client
 * 4. Mantém checkpoint a cada 50 processos para retomada
 */

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  buscarProcessosEmParalelo,
  BUSCA_PARALELA_CONFIG
} from "@/utils/pjeComunicaClient";
import { toast } from "sonner";

// Configuração otimizada para busca paralela
const CONFIG = {
  superBatchSize: BUSCA_PARALELA_CONFIG.superBatchSize,
  parallelism: BUSCA_PARALELA_CONFIG.parallelism,
  delayBetweenCycles: BUSCA_PARALELA_CONFIG.delayBetweenCycles,
  delayBetweenSuperBatches: BUSCA_PARALELA_CONFIG.delayBetweenSuperBatches,
  checkpointInterval: 50, // Salvar checkpoint a cada 50 processos
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
  lastNumero: string | null;
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
    lastNumero: null,
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

  const saveCheckpoint = useCallback(async (
    current: number, 
    lastNumero: string | null,
    stats: Partial<DjenProcessosProgress>
  ) => {
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
            // Keyset pagination: salvar último número processado
            last_numero: lastNumero,
            next_offset: current, // Manter para compatibilidade
            current: Math.max(current, currentMeta.current || 0),
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
      let processedCount = 0;
      let novasTotal = 0;
      let duplicadasTotal = 0;
      let processosComNovas = 0;
      let lastNumero: string | null = null;
      
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
      
      // Usar keyset pagination: retomar do último número processado
      if (retomar && (meta?.last_numero || meta?.next_offset)) {
        lastNumero = meta.last_numero || null;
        processedCount = meta.current || meta.next_offset || 0;
        novasTotal = meta.novas || 0;
        duplicadasTotal = meta.duplicadas || 0;
        processosComNovas = meta.processosComNovas || 0;
        
        toast.info(`Retomando de ${processedCount} processos (${novasTotal} novas já encontradas)`);
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

      updateProgress({
        status: 'executando',
        current: processedCount,
        total,
        novas: novasTotal,
        duplicadas: duplicadasTotal,
        processosComNovas,
        mensagem: retomar ? `Retomando de ${processedCount}/${total}...` : 'Iniciando monitoramento...',
        offset: processedCount,
        startedAt,
        lastNumero,
      });

      const seenHashes = new Set<string>();
      let hasMore = true;

      while (hasMore && !canceladoRef.current) {
        // KEYSET PAGINATION: buscar processos após o último número processado
        let query = supabase
          .from('processos')
          .select('id, numero')
          .eq('monitorar_djen', true)
          .order('numero', { ascending: true })
          .limit(CONFIG.superBatchSize);
        
        if (lastNumero) {
          query = query.gt('numero', lastNumero);
        }

        const { data: processos, error: procError } = await query;

        if (procError) {
          throw new Error(`Erro ao buscar processos: ${procError.message}`);
        }

        if (!processos?.length) {
          hasMore = false;
          break;
        }

        updateProgress({
          mensagem: `Processando ${processedCount + 1}-${processedCount + processos.length}/${total}...`,
        });

        console.log(`[DJEN Browser] Lote: ${processos.length} processos a partir de "${lastNumero || 'início'}"`);

        // Buscar publicações em paralelo
        const resultado = await buscarProcessosEmParalelo(
          processos,
          params,
          {
            signal: abortControllerRef.current?.signal,
            parallelism: CONFIG.parallelism,
            delayBetweenCycles: CONFIG.delayBetweenCycles,
            onProgress: (processed, loteTotal) => {
              updateProgress({
                current: processedCount + processed,
                mensagem: `${processedCount + processed}/${total} processos...`,
              });
            },
          }
        );

        // Processar e salvar publicações encontradas
        for (const [numProc, items] of resultado.porProcesso) {
          if (items.length === 0) continue;
          
          const processo = processos.find(p => p.numero === numProc);
          if (!processo) continue;

          const { novas, duplicadas } = await processarPublicacoes(
            processo, 
            items, 
            seenHashes, 
            hoje
          );
          
          novasTotal += novas;
          duplicadasTotal += duplicadas;
          if (novas > 0) processosComNovas++;
        }

        processedCount += processos.length;
        lastNumero = processos[processos.length - 1].numero;

        const currentStats = {
          current: processedCount,
          total,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          processosComNovas,
          percentage: Math.round((processedCount / total) * 100),
          startedAt,
          lastNumero,
        };
        
        updateProgress({
          ...currentStats,
          mensagem: `${processedCount}/${total} processos (${novasTotal} novas)`,
          offset: processedCount,
        });

        // Salvar checkpoint
        await saveCheckpoint(processedCount, lastNumero, currentStats);

        // Se processou menos que o limite, não há mais dados
        if (processos.length < CONFIG.superBatchSize) {
          hasMore = false;
        }

        // Delay entre super-lotes
        if (hasMore && !canceladoRef.current) {
          await new Promise(r => setTimeout(r, CONFIG.delayBetweenSuperBatches));
        }
      }

      if (canceladoRef.current) {
        updateProgress({
          status: 'cancelado',
          mensagem: `Cancelado em ${processedCount}/${total}. Use "Retomar" para continuar.`,
        });
        toast.warning('Monitoramento cancelado. Progresso salvo para retomada.');
      } else {
        updateProgress({
          status: 'concluido',
          current: total,
          percentage: 100,
          mensagem: `Concluído! ${novasTotal} novas publicações encontradas.`,
        });
        
        // Limpar checkpoint ao concluir
        await saveCheckpoint(total, null, { status: 'concluido' as any, current: total, total, novas: novasTotal, startedAt });
        
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
