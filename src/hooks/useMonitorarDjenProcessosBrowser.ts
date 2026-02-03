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
      
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...currentMeta,
            next_offset: offset,
            current: stats.current || 0,
            total: stats.total || 0,
            novas: stats.novas || 0,
            duplicadas: stats.duplicadas || 0,
            percentage: stats.percentage || 0,
            status: stats.status || 'em_andamento',
            browser_execution: true,
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
    retomar = false
  ) => {
    if (isExecutando) return;
    
    canceladoRef.current = false;
    abortControllerRef.current = new AbortController();
    
    const hoje = getBrazilISODate();
    const dataInicioEfetiva = dataInicio || hoje;
    const dataFimEfetiva = dataFim || hoje;

    try {
      // Buscar offset salvo se for retomada
      let startOffset = 0;
      if (retomar) {
        const { data: config } = await supabase
          .from('configuracoes_monitoramento')
          .select('metadata')
          .eq('tipo', 'djen_processos')
          .maybeSingle();
        
        const meta = config?.metadata as Record<string, any> | null;
        startOffset = meta?.next_offset || 0;
        
        if (startOffset === 0) {
          toast.info('Nenhum checkpoint encontrado. Iniciando do zero.');
        } else {
          toast.info(`Retomando do offset ${startOffset}`);
        }
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
        current: startOffset,
        total,
        novas: 0,
        duplicadas: 0,
        processosComNovas: 0,
        mensagem: 'Iniciando monitoramento...',
        offset: startOffset,
      });

      let offset = startOffset;
      let novasTotal = 0;
      let duplicadasTotal = 0;
      let processosComNovas = 0;
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

        if (procError || !processos?.length) {
          if (procError) console.error('[DJEN Processos Browser] Erro ao buscar processos:', procError);
          break;
        }

        updateProgress({
          mensagem: `Processando lote ${Math.floor(offset / CONFIG.batchSize) + 1}...`,
          current: offset,
        });

        // Processar cada processo do lote
        for (const processo of processos) {
          if (canceladoRef.current) break;

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

          } catch (e: any) {
            if (e.name === 'AbortError') break;
            console.warn(`[DJEN Processos Browser] Erro no processo ${processo.numero}:`, e.message);
          }
        }

        offset += processos.length;

        // Atualizar progresso e salvar checkpoint
        const currentStats = {
          current: offset,
          total,
          novas: novasTotal,
          duplicadas: duplicadasTotal,
          percentage: Math.round((offset / total) * 100),
        };
        
        updateProgress({
          ...currentStats,
          processosComNovas,
          mensagem: `${offset}/${total} processos (${novasTotal} novas)`,
          offset,
        });

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
