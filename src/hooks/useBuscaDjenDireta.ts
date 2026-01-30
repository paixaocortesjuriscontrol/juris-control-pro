import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { buscarPjeComunicaPaginado } from "@/utils/pjeComunicaClient";

interface MonitoramentoDjen {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte';
  termo_busca: string;
  oab?: string;
  uf?: string;
  coordenacao_id?: string;
  ativo: boolean;
  exclusoes?: string[];
  condicao_concomitante?: string;
  tribunais?: string[];
}

interface PublicacaoResultado {
  id: string;
  processo_numero: string | null;
  conteudo: string | null;
  data_disponibilizacao: string | null;
  data_publicacao: string | null;
  fonte: string | null;
  hash_conteudo: string;
}

// Checkpoint para retomada de execução
export interface CheckpointDjen {
  data: string; // YYYY-MM-DD
  monitoramentosProcessados: string[]; // IDs já processados
  totalNovas: number;
  totalDuplicadas: number;
  tempoAcumulado: number; // segundos
  faseAtual: 1 | 2 | 3;
  executionId?: string; // ID na tabela execucoes_agendadas
}

// Fases de execução
export type FaseStatus = 'pendente' | 'executando' | 'concluido' | 'erro';

export interface FaseConfig {
  total: number;
  processados: number;
  status: FaseStatus;
}

export interface ProgressoExecucao {
  monitoramentoAtual: number;
  totalMonitoramentos: number;
  publicacoesNovas: number;
  publicacoesDuplicadas: number;
  status: 'idle' | 'executando' | 'concluido' | 'erro' | 'cancelado';
  mensagem: string;
  tempoInicio?: number;
  tempoDecorrido: number;
  // Fases
  faseAtual: 1 | 2 | 3;
  fases: {
    fase1: FaseConfig; // Busca Publicações
    fase2: FaseConfig; // Identificar Eventos
    fase3: FaseConfig; // Notificações
  };
  // Checkpoint info
  hasCheckpoint?: boolean;
  checkpointPercent?: number;
  executionId?: string;
}

function calcularProximoDiaUtil(dataBase: Date): Date {
  const resultado = new Date(dataBase);
  
  const estaNoRecesso = (d: Date): boolean => {
    const mes = d.getMonth();
    const dia = d.getDate();
    return (mes === 11 && dia >= 20) || (mes === 0 && dia <= 6);
  };
  
  const proximoDiaUtil = (d: Date): void => {
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    if (estaNoRecesso(d)) {
      if (d.getMonth() === 11) {
        d.setFullYear(d.getFullYear() + 1);
      }
      d.setMonth(0);
      d.setDate(7);
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
    }
  };
  
  proximoDiaUtil(resultado);
  return resultado;
}

function extrairDataYMD(dataStr: string | null | undefined): string | null {
  if (!dataStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return dataStr;
  const match = dataStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  const d = new Date(dataStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

// Configuração de paralelismo
const CONCURRENT_LIMIT = 2;
const DELAY_BETWEEN_BATCHES = 1500;

// Retry config para WORKER_LIMIT (erro 546)
const MAX_RETRIES = 6;
const INITIAL_BACKOFF_MS = 2000;

// Helper para delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Invocar Edge Function com retry e exponential backoff para WORKER_LIMIT
const invokeWithRetry = async <T>(
  fnName: string,
  body: Record<string, any>,
  maxRetries = MAX_RETRIES
): Promise<{ data: T | null; error: Error | null }> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      
      if (error) {
        const errMsg = error.message || String(error);
        const is546 = errMsg.includes('546') || errMsg.includes('WORKER_LIMIT');
        
        if (is546 && attempt < maxRetries) {
          const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(`[DJEN] WORKER_LIMIT (tentativa ${attempt + 1}/${maxRetries + 1}), aguardando ${backoff}ms...`);
          await delay(backoff);
          lastError = error;
          continue;
        }
        
        return { data: null, error };
      }
      
      return { data: data as T, error: null };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const is546 = errMsg.includes('546') || errMsg.includes('WORKER_LIMIT');
      
      if (is546 && attempt < maxRetries) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`[DJEN] WORKER_LIMIT catch (tentativa ${attempt + 1}/${maxRetries + 1}), aguardando ${backoff}ms...`);
        await delay(backoff);
        lastError = err;
        continue;
      }
      
      return { data: null, error: err };
    }
  }
  
  return { data: null, error: lastError || new Error('Max retries exceeded') };
};

// Chaves para localStorage
const STORAGE_KEY = 'djen-direta-progresso';
const CHECKPOINT_KEY = 'djen-direta-checkpoint';

// Salvar estado no localStorage
const salvarEstado = (progresso: ProgressoExecucao) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...progresso,
      savedAt: Date.now(),
    }));
  } catch (e) {
    console.warn('Erro ao salvar estado DJEN:', e);
  }
};

// Carregar estado do localStorage
const carregarEstado = (): ProgressoExecucao | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const parsed = JSON.parse(saved);
    if (Date.now() - parsed.savedAt > 12 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    if (parsed.status === 'executando' && parsed.tempoInicio) {
      parsed.tempoDecorrido = Math.floor((Date.now() - parsed.tempoInicio) / 1000);
    }
    
    return parsed;
  } catch (e) {
    return null;
  }
};

// Salvar checkpoint para retomada
const salvarCheckpoint = (checkpoint: CheckpointDjen) => {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
  } catch (e) {
    console.warn('Erro ao salvar checkpoint:', e);
  }
};

// Carregar checkpoint (só válido no mesmo dia)
const carregarCheckpoint = (): CheckpointDjen | null => {
  try {
    const saved = localStorage.getItem(CHECKPOINT_KEY);
    if (!saved) return null;
    
    const parsed: CheckpointDjen = JSON.parse(saved);
    const hoje = new Date().toISOString().split('T')[0];
    
    // Checkpoint só válido no mesmo dia
    if (parsed.data !== hoje) {
      localStorage.removeItem(CHECKPOINT_KEY);
      return null;
    }
    
    return parsed;
  } catch (e) {
    return null;
  }
};

const limparCheckpoint = () => {
  localStorage.removeItem(CHECKPOINT_KEY);
};

const defaultFases = (): ProgressoExecucao['fases'] => ({
  fase1: { total: 0, processados: 0, status: 'pendente' },
  fase2: { total: 0, processados: 0, status: 'pendente' },
  fase3: { total: 0, processados: 0, status: 'pendente' },
});

const defaultProgresso = (): ProgressoExecucao => ({
  monitoramentoAtual: 0,
  totalMonitoramentos: 0,
  publicacoesNovas: 0,
  publicacoesDuplicadas: 0,
  status: 'idle',
  mensagem: '',
  tempoDecorrido: 0,
  faseAtual: 1,
  fases: defaultFases(),
});

/**
 * Hook com busca DJEN paralela com suporte a fases e retomada
 */
export function useBuscaDjenDireta() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Verificar checkpoint disponível
  const checkpointDisponivel = carregarCheckpoint();
  
  const [progresso, setProgresso] = useState<ProgressoExecucao>(() => {
    const saved = carregarEstado();
    if (saved) {
      const isComplete = saved.status === 'concluido' || 
        (saved.totalMonitoramentos > 0 && saved.monitoramentoAtual >= saved.totalMonitoramentos);
      if (isComplete) {
        return {
          ...saved,
          status: 'concluido',
          tempoInicio: undefined,
          hasCheckpoint: !!checkpointDisponivel,
          checkpointPercent: checkpointDisponivel 
            ? Math.round((checkpointDisponivel.monitoramentosProcessados.length / saved.totalMonitoramentos) * 100)
            : 0,
        };
      }
      return {
        ...saved,
        hasCheckpoint: !!checkpointDisponivel,
        checkpointPercent: checkpointDisponivel
          ? Math.round((checkpointDisponivel.monitoramentosProcessados.length / saved.totalMonitoramentos) * 100)
          : 0,
      };
    }
    return {
      ...defaultProgresso(),
      hasCheckpoint: !!checkpointDisponivel,
      checkpointPercent: checkpointDisponivel 
        ? Math.round(checkpointDisponivel.monitoramentosProcessados.length / 114 * 100) // Estimate
        : 0,
    };
  });
  
  const [executando, setExecutando] = useState(() => {
    const saved = carregarEstado();
    if (!saved) return false;
    const isComplete = saved.status === 'concluido' || 
      (saved.totalMonitoramentos > 0 && saved.monitoramentoAtual >= saved.totalMonitoramentos);
    return saved.status === 'executando' && !isComplete;
  });
  
  const cancelarRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const executionIdRef = useRef<string | null>(null);

  // Se o domínio (ex: publicado) ficou com um estado local antigo marcado como "executando",
  // o card pode ficar preso em % (ex: 73%) mesmo sem execução ativa no banco.
  // Aqui validamos no mount: se não existir execução ativa, limpamos o estado local.
  useEffect(() => {
    let isMounted = true;

    const validarEstadoLocalExecutando = async () => {
      const saved = carregarEstado();
      if (!saved || saved.status !== 'executando') return;

      try {
        let existeExecucaoAtiva = false;

        // 1) Preferir validar pelo executionId salvo (quando existir)
        if (saved.executionId) {
          const { data } = await supabase
            .from('execucoes_agendadas')
            .select('id, status, finalizado_em')
            .eq('id', saved.executionId)
            .maybeSingle();

          existeExecucaoAtiva = !!data && data.status === 'executando' && !data.finalizado_em;
        }

        // 2) Fallback: verificar se existe qualquer execução DJEN ativa no banco
        if (!existeExecucaoAtiva) {
          const { data } = await supabase
            .from('execucoes_agendadas')
            .select('id')
            .eq('tipo', 'djen')
            .eq('status', 'executando')
            .is('finalizado_em', null)
            .order('iniciado_em', { ascending: false })
            .limit(1)
            .maybeSingle();

          existeExecucaoAtiva = !!data;
        }

        if (!isMounted) return;

        if (!existeExecucaoAtiva) {
          console.warn('[DJEN] Estado local "executando" sem execução ativa no banco. Limpando localStorage.');
          localStorage.removeItem(STORAGE_KEY);
          executionIdRef.current = null;
          setExecutando(false);

          const hasCp = !!checkpointDisponivel;
          const cpPct = hasCp
            ? Math.round((checkpointDisponivel!.monitoramentosProcessados.length / (saved.totalMonitoramentos || 114)) * 100)
            : 0;

          setProgresso({
            ...defaultProgresso(),
            status: hasCp ? 'cancelado' : 'idle',
            mensagem: hasCp
              ? 'Execução anterior interrompida. Você pode retomar a partir do checkpoint.'
              : '',
            hasCheckpoint: hasCp,
            checkpointPercent: cpPct,
          });
        }
      } catch (e) {
        // Se não conseguir validar, não derrubar UI.
        // (Preferimos manter o estado e deixar a detecção de órfã/ghost atuar no card.)
        console.warn('[DJEN] Falha ao validar estado local executando:', e);
      }
    };

    validarEstadoLocalExecutando();

    return () => {
      isMounted = false;
    };
  }, [checkpointDisponivel]);

  // Helpers para checkpoint/controle no banco (configuracoes_monitoramento)
  const loadConfigMetadata = useCallback(async (): Promise<Record<string, any>> => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .is('coordenacao_id', null)
        .maybeSingle();
      if (error) throw error;
      return (data?.metadata as Record<string, any>) || {};
    } catch {
      return {};
    }
  }, []);

  const saveConfigMetadata = useCallback(async (next: Record<string, any>) => {
    try {
      await supabase
        .from('configuracoes_monitoramento')
        .update({ metadata: next })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
    } catch {
      // silencioso: não quebrar o loop por falha de atualização de UI
    }
  }, []);

  // Timer para atualizar tempo decorrido
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!executando || !progresso.tempoInicio || progresso.status !== 'executando') {
      return;
    }

    timerRef.current = setInterval(() => {
      setProgresso((prev) => {
        if (!prev.tempoInicio || prev.status !== 'executando') return prev;
        const tempo = Math.floor((Date.now() - prev.tempoInicio) / 1000);
        const updated = { ...prev, tempoDecorrido: tempo };
        salvarEstado(updated);
        return updated;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [executando, progresso.tempoInicio, progresso.status]);

  // Persistir mudanças de progresso
  useEffect(() => {
    salvarEstado(progresso);
  }, [progresso]);

  // Gera hash para deduplicação
  const gerarHash = (conteudo: string, data: string): string => {
    const normalized = (conteudo + data).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 300);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  // Verificar duplicatas em batch
  const verificarDuplicatasBatch = async (
    hashes: string[], 
    monitoramentoId: string
  ): Promise<Set<string>> => {
    if (hashes.length === 0) return new Set();
    
    const { data } = await supabase
      .from('publicacoes_djen')
      .select('hash_conteudo')
      .eq('monitoramento_id', monitoramentoId)
      .in('hash_conteudo', hashes);
    
    return new Set((data || []).map(d => d.hash_conteudo));
  };

  // Verificar exclusões
  const deveExcluir = (conteudo: string, exclusoes?: string[]): boolean => {
    if (!exclusoes || exclusoes.length === 0) return false;
    const conteudoUpper = conteudo.toUpperCase();
    return exclusoes.some(termo => conteudoUpper.includes(termo.toUpperCase()));
  };

  // Registrar execução no banco
  const registrarExecucao = async (status: 'executando' | 'concluido' | 'cancelado' | 'erro', detalhes?: Record<string, any>): Promise<string | null> => {
    try {
      const executionId = executionIdRef.current;
      
      if (status === 'executando' && !executionId) {
        // Criar novo registro
        const { data, error } = await supabase
          .from('execucoes_agendadas')
          .insert({
            tipo: 'djen',
            status: 'executando',
            iniciado_em: new Date().toISOString(),
            detalhes: detalhes || {},
          })
          .select('id')
          .single();
        
        if (error) {
          console.error('Erro ao registrar execução:', error);
          return null;
        }
        
        executionIdRef.current = data.id;
        return data.id;
      } else if (executionId) {
        // Atualizar registro existente
        const updateData: Record<string, any> = {
          status,
          detalhes: detalhes || {},
        };
        
        if (status !== 'executando') {
          updateData.finalizado_em = new Date().toISOString();
        }
        
        await supabase
          .from('execucoes_agendadas')
          .update(updateData)
          .eq('id', executionId);
        
        return executionId;
      }
      
      return null;
    } catch (e) {
      console.error('Erro ao registrar execução:', e);
      return null;
    }
  };

  // Buscar um monitoramento via Edge Function
  const buscarMonitoramento = async (monitoramento: MonitoramentoDjen): Promise<PublicacaoResultado[]> => {
    if (cancelarRef.current) return [];

    // Usar data em Brasília para alinhar com a API e evitar “virada do dia” em UTC
    const now = new Date();
    const todayBrasilia = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const yesterdayBrasilia = new Date(todayBrasilia);
    yesterdayBrasilia.setDate(yesterdayBrasilia.getDate() - 1);

    const dataFimYmd = todayBrasilia.toISOString().split('T')[0];
    const dataInicioYmd = yesterdayBrasilia.toISOString().split('T')[0];

    const tipoMapeado = monitoramento.tipo === 'parte' ? 'palavra-chave' : monitoramento.tipo;

    // Normaliza termo (remove acentos) para variante adicional de busca
    const normalizeAccents = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Gerar variantes de busca (termo original + sem acentos se diferir)
    const gerarVariantes = (termo: string): string[] => {
      const original = termo.trim();
      const semAcento = normalizeAccents(original);
      if (semAcento.toLowerCase() !== original.toLowerCase()) {
        return [original, semAcento];
      }
      return [original];
    };

    const params: Record<string, any> = {
      tipo: tipoMapeado,
      dataInicio: dataInicioYmd,
      dataFim: dataFimYmd,
      pageSize: 100,
      fetchAll: false,
    };

    // Lista de variantes para busca (importante para termos com acentos)
    let palavrasChaveVariantes: string[] = [];

    if (tipoMapeado === 'advogado' && monitoramento.oab && monitoramento.uf) {
      params.oab = monitoramento.oab;
      const ufValue = monitoramento.uf;
      if (ufValue === 'TODAS' || !ufValue) {
        palavrasChaveVariantes = gerarVariantes(monitoramento.termo_busca);
        delete params.oab;
      } else if (ufValue.includes(',')) {
        const primeiraUf = ufValue.split(',')[0].trim();
        if (primeiraUf.length === 2) {
          params.uf = primeiraUf;
        } else {
          palavrasChaveVariantes = gerarVariantes(monitoramento.termo_busca);
          delete params.oab;
        }
      } else if (ufValue.length === 2) {
        params.uf = ufValue;
      } else {
        palavrasChaveVariantes = gerarVariantes(monitoramento.termo_busca);
        delete params.oab;
      }
    } else if (tipoMapeado === 'palavra-chave' || monitoramento.tipo === 'parte') {
      palavrasChaveVariantes = gerarVariantes(monitoramento.termo_busca);
    } else if (tipoMapeado === 'processo') {
      params.numeroProcesso = monitoramento.termo_busca.replace(/\D/g, '');
    }

    // Se não temos variantes, usar termo original diretamente
    if (palavrasChaveVariantes.length === 0 && !params.oab && !params.numeroProcesso) {
      palavrasChaveVariantes = [monitoramento.termo_busca];
    }

    try {
      if (cancelarRef.current) return [];

      // 1) Preferir browser (IP do usuário) para evitar 546 WORKER_LIMIT e bloqueios no IP do Supabase
      const browserController = new AbortController();
      const browserTimeoutId = setTimeout(() => browserController.abort(), 25000);

      let data: any | null = null;
      let error: Error | null = null;

      try {
        // Monitoramento pode ter filtro de tribunais: buscar por tribunal reduz volume e evita
        // “perder” resultados por paginação (ex: item fica depois do 50º/100º resultado).
        const tribunais = Array.isArray(monitoramento.tribunais) && monitoramento.tribunais.length > 0
          ? monitoramento.tribunais
          : [undefined];

        // Lista de variantes de palavras-chave (com e sem acentos)
        // IMPORTANTE: evitar chamadas com termo vazio/curto, pois a Edge Function valida min 3 chars
        // e, no browser-first, termos muito curtos podem gerar consultas amplas demais.
        const variantesParaBuscarRaw = palavrasChaveVariantes.length > 0
          ? palavrasChaveVariantes
          : (params.palavraChave ? [params.palavraChave] : [undefined]);

        const variantesParaBuscar = variantesParaBuscarRaw
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
          .filter((v) => normalizeAccents(v).length >= 3);

        if (tipoMapeado === 'palavra-chave' && !params.oab && variantesParaBuscar.length === 0) {
          console.warn(
            `[DJEN Direta] Monitoramento com termo muito curto para palavra-chave (min 3): "${monitoramento.termo_busca}"`
          );
          return [];
        }

        const seen = new Set<string>();
        const acumulado: any[] = [];

        // Buscar todas as combinações: variantes x tribunais
        for (const variante of variantesParaBuscar) {
          if (cancelarRef.current) break;

          for (const trib of tribunais) {
            if (cancelarRef.current) break;

            const resp = await buscarPjeComunicaPaginado(
              {
                tipo: params.tipo,
                oab: params.oab,
                uf: params.uf,
                palavraChave: variante,
                numeroProcesso: params.numeroProcesso,
                siglaTribunal: trib,
                dataInicio: params.dataInicio,
                dataFim: params.dataFim,
                page: 0,
                pageSize: params.pageSize ?? 100,
              },
              {
                signal: browserController.signal,
                maxPages: 10,
                delayMs: 150,
              }
            );

            for (const item of resp.items) {
              const id = String(item?.id ?? "");
              const key = id || JSON.stringify(item).slice(0, 400);
              if (!seen.has(key)) {
                seen.add(key);
                acumulado.push(item);
              }
            }

            // Pequeno delay entre tribunais para reduzir 429
            await delay(120);
          }
        }

        data = { comunicacoes: acumulado, items: acumulado };
      } catch (browserErr: any) {
        // 2) Fallback para Edge Function apenas quando o browser falhar (ex: CORS/rede)
        //    Importante: paginar também no fallback, senão perdemos publicações fora da 1ª página.
        const MAX_PAGES_FALLBACK = 10;
        const TIMEOUT_PER_PAGE_MS = 30_000;

        // Usar palavra-chave do monitoramento (termo_busca) para fallback.
        // Atenção: a Edge Function valida comprimento mínimo de 3 caracteres.
        const palavraChaveFallback = !params.oab
          ? [...(palavrasChaveVariantes || []), monitoramento.termo_busca]
              .filter((v): v is string => typeof v === 'string')
              .map((v) => v.trim())
              .filter((v) => v.length > 0)
              .find((v) => normalizeAccents(v).length >= 3) ?? null
          : null;

        if (tipoMapeado === 'palavra-chave' && !params.oab && !palavraChaveFallback) {
          // Se o browser falhou e o termo é inválido para a Edge Function,
          // não faz sentido invocar e causar erro 400.
          error = new Error(
            `Termo do monitoramento inválido para busca por palavra-chave (mínimo 3 caracteres): "${monitoramento.termo_busca}"`
          );
        }

        const fetchPage = async (page: number) => {
          const timeoutController = new AbortController();
          const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_PER_PAGE_MS);

          try {
            if (error) {
              // Já detectamos erro de validação (ex: termo curto); não invocar a função.
              return { data: null, error };
            }

            const invokePromise = invokeWithRetry<any>("buscar-djen", {
              ...params,
              palavraChave: params.oab ? undefined : palavraChaveFallback, // Só envia palavraChave se não for advogado
              page,
              pageSize: params.pageSize ?? 100,
              fetchAll: false,
            });

            const raced = await Promise.race([
              invokePromise,
              new Promise<{ data: null; error: Error }>((_, reject) => {
                timeoutController.signal.addEventListener("abort", () => {
                  reject({ data: null, error: new Error(`Timeout ao buscar DJEN (${TIMEOUT_PER_PAGE_MS / 1000}s)`) });
                });
              }),
            ]);

            return raced;
          } catch (e: any) {
            // Garantir que qualquer exceção (incluindo 400) seja convertida em retorno padrão
            // para evitar crash/tela em branco.
            return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
          } finally {
            clearTimeout(timeoutId);
          }
        };

        const seen = new Set<string>();
        const acumulado: any[] = [];

        for (let p = 0; p < MAX_PAGES_FALLBACK; p++) {
          if (cancelarRef.current) break;
          const raced = await fetchPage(p);
          if (raced.error) {
            error = raced.error;
            break;
          }

          const comunicacoes = raced.data?.comunicacoes || raced.data?.items || [];
          if (!Array.isArray(comunicacoes) || comunicacoes.length === 0) break;

          for (const item of comunicacoes) {
            const id = String(item?.id ?? "");
            const key = id || JSON.stringify(item).slice(0, 400);
            if (!seen.has(key)) {
              seen.add(key);
              acumulado.push(item);
            }
          }

          const hasMore = Boolean(raced.data?.hasMore);
          if (!hasMore) break;

          await delay(150);
        }

        data = { comunicacoes: acumulado, items: acumulado };

        console.warn(
          `[DJEN Direta] Browser falhou, usando Edge Function (${monitoramento.termo_busca}):`,
          browserErr?.message || browserErr
        );
      } finally {
        clearTimeout(browserTimeoutId);
      }

      if (cancelarRef.current) return [];

      if (error) {
        console.warn(`[DJEN Direta] Erro ao buscar ${monitoramento.termo_busca}:`, error?.message || error);
        return [];
      }

      const comunicacoes = data?.comunicacoes || data?.items || [];
      
      return comunicacoes.map((pub: any) => {
        const rawDataDisp = pub.dataDisponibilizacao || pub.dataDJe || pub.dtDisponibilizacao || null;
        const rawDataPub = pub.dataPublicacao || pub.dataJornal || pub.dtPublicacao || null;
        
        let dataDisponibilizacao = extrairDataYMD(rawDataDisp);
        let dataPublicacao: string | null = null;
        
        if (dataDisponibilizacao) {
          const dispDate = new Date(dataDisponibilizacao + 'T12:00:00');
          dispDate.setDate(dispDate.getDate() + 1);
          const proximoDiaUtil = calcularProximoDiaUtil(dispDate);
          dataPublicacao = proximoDiaUtil.toISOString().split('T')[0];
        } else if (rawDataPub) {
          dataPublicacao = extrairDataYMD(rawDataPub);
          if (dataPublicacao) {
            const pubDate = new Date(dataPublicacao + 'T12:00:00');
            pubDate.setDate(pubDate.getDate() - 1);
            dataDisponibilizacao = pubDate.toISOString().split('T')[0];
          }
        }
        
        if (!dataDisponibilizacao && !dataPublicacao) {
          const hoje = new Date();
          dataDisponibilizacao = hoje.toISOString().split('T')[0];
          hoje.setDate(hoje.getDate() + 1);
          const proximoDiaUtil = calcularProximoDiaUtil(hoje);
          dataPublicacao = proximoDiaUtil.toISOString().split('T')[0];
        }
        
        return {
          id: pub.id || crypto.randomUUID(),
          processo_numero: pub.numeroProcesso || pub.processo || null,
          conteudo: pub.conteudo || pub.teor || pub.texto || null,
          data_disponibilizacao: dataDisponibilizacao,
          data_publicacao: dataPublicacao,
          fonte: pub.tribunal || pub.orgao || pub.siglaTribunal || 'DJEN',
          hash_conteudo: '',
        };
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || cancelarRef.current) return [];
      console.warn(`[DJEN Direta] Erro na busca (${monitoramento.termo_busca}):`, err?.message || err);
      return [];
    }
  };

  // Processar um monitoramento
  const processarMonitoramento = async (
    mon: MonitoramentoDjen
  ): Promise<{ novas: number; duplicadas: number; coordenacaoStats?: any }> => {
    const publicacoes = await buscarMonitoramento(mon);
    
    if (publicacoes.length === 0) {
      return { novas: 0, duplicadas: 0 };
    }

    const pubsFiltradas = publicacoes.filter(pub => 
      !pub.conteudo || !deveExcluir(pub.conteudo, mon.exclusoes)
    );

    const pubsComHash = pubsFiltradas.map(pub => ({
      ...pub,
      hash_conteudo: gerarHash(
        pub.conteudo || '',
        pub.data_publicacao || new Date().toISOString()
      ),
    }));

    const uniqueMap = new Map<string, typeof pubsComHash[number]>();
    let duplicadasInternas = 0;
    for (const p of pubsComHash) {
      if (uniqueMap.has(p.hash_conteudo)) {
        duplicadasInternas += 1;
        continue;
      }
      uniqueMap.set(p.hash_conteudo, p);
    }
    const pubsUnicas = Array.from(uniqueMap.values());

    const hashes = pubsUnicas.map(p => p.hash_conteudo);
    const existentes = await verificarDuplicatasBatch(hashes, mon.id);

    const novas = pubsUnicas.filter(p => !existentes.has(p.hash_conteudo));
    const duplicadasBanco = pubsUnicas.length - novas.length;
    const duplicadas = duplicadasInternas + duplicadasBanco;

    if (novas.length > 0) {
      const payload = novas.map(pub => ({
        monitoramento_id: mon.id,
        hash_conteudo: pub.hash_conteudo,
        processo_numero: pub.processo_numero,
        conteudo: pub.conteudo,
        data_disponibilizacao: pub.data_disponibilizacao,
        data_publicacao: pub.data_publicacao,
        fonte: pub.fonte,
        lida: false,
      }));

      const { error: upsertError } = await supabase
        .from('publicacoes_djen')
        .upsert(payload, {
          onConflict: 'monitoramento_id,hash_conteudo',
          ignoreDuplicates: true,
        });

      if (upsertError) {
        console.error('Erro ao inserir publicações:', upsertError);
        return { novas: 0, duplicadas };
      }
    }

    let coordenacaoStats;
    if (mon.coordenacao_id && novas.length > 0) {
      coordenacaoStats = {
        coordenacao_id: mon.coordenacao_id,
        total_verificados: publicacoes.length,
        total_encontrados: novas.length,
        exemplos: novas.slice(0, 3).map(p => {
          let numeroProcesso = p.processo_numero;
          if (!numeroProcesso && p.conteudo) {
            const match = p.conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
            if (match) numeroProcesso = match[1];
          }
          return {
            processo_numero: numeroProcesso || 'Processo não identificado',
            descricao: (p.conteudo || '').slice(0, 100) + '...',
          };
        }),
      };
    }

    return { novas: novas.length, duplicadas, coordenacaoStats };
  };

  // Executar monitoramento com suporte a retomada
  const executarMonitoramento = useCallback(async (monitoramentosIds?: string[], retomar: boolean = false) => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    const hoje = new Date().toISOString().split('T')[0];
    const checkpoint = carregarCheckpoint();

    // Fonte de checkpoint no banco (server-side) - igual padrão do DJEN Processos
    let configMd = await loadConfigMetadata();
    const serverProcessedIds: string[] = Array.isArray(configMd.processed_ids) ? configMd.processed_ids : [];
    const serverNextOffset: number | null = typeof configMd.next_offset === 'number' ? configMd.next_offset : null;
    const usarCheckpointServidor = !!retomar && serverProcessedIds.length > 0 && (serverNextOffset ?? serverProcessedIds.length) > 0;
    
    // Se retomar=false mas existe checkpoint do mesmo dia, limpar
    if (!retomar && checkpoint) {
      limparCheckpoint();
    }
    
    // Checkpoint local (mesmo dia)
    const usarCheckpointLocal = !!retomar && !!checkpoint && checkpoint.data === hoje;

    // Preferir checkpoint do banco (server-side). Se não houver, usar local.
    const usarCheckpoint = usarCheckpointServidor || usarCheckpointLocal;

    const idsProcessadosInicial = new Set<string>(
      usarCheckpointServidor
        ? serverProcessedIds
        : (usarCheckpointLocal ? checkpoint!.monitoramentosProcessados : [])
    );
    
    const tempoInicio = usarCheckpointLocal
      ? Date.now() - (checkpoint!.tempoAcumulado * 1000)
      : Date.now();
    setExecutando(true);
    cancelarRef.current = false;
    abortControllerRef.current = new AbortController();
    executionIdRef.current = null;

    // Resetar sinalizações de cancelamento no banco ao iniciar
    if (!retomar) {
      configMd = {
        ...configMd,
        cancel_requested: false,
        cancelado: false,
        processed_ids: [],
        next_offset: null,
      };
    } else {
      configMd = {
        ...configMd,
        cancel_requested: false,
      };
    }
    await saveConfigMetadata(configMd);
    
    const progressoInicial: ProgressoExecucao = {
      monitoramentoAtual: usarCheckpoint ? idsProcessadosInicial.size : 0,
      totalMonitoramentos: 0,
      publicacoesNovas: usarCheckpointLocal ? checkpoint!.totalNovas : 0,
      publicacoesDuplicadas: usarCheckpointLocal ? checkpoint!.totalDuplicadas : 0,
      status: 'executando',
      mensagem: usarCheckpoint ? 'Retomando execução...' : 'Carregando monitoramentos...',
      tempoInicio,
      tempoDecorrido: usarCheckpointLocal ? checkpoint!.tempoAcumulado : 0,
      faseAtual: usarCheckpointLocal ? checkpoint!.faseAtual : 1,
      fases: {
        fase1: { total: 0, processados: usarCheckpoint ? idsProcessadosInicial.size : 0, status: 'executando' },
        fase2: { total: 0, processados: 0, status: 'pendente' },
        fase3: { total: 0, processados: 0, status: 'pendente' },
      },
      hasCheckpoint: false,
    };
    
    setProgresso(progressoInicial);

    // Registrar execução no banco
    const executionId = await registrarExecucao('executando', {
      retomada: usarCheckpoint,
      checkpoint: usarCheckpointLocal ? checkpoint : null,
    });

    try {
      let query = supabase
        .from('monitoramentos_djen')
        .select('*')
        .eq('ativo', true);

      if (monitoramentosIds?.length) {
        query = query.in('id', monitoramentosIds);
      }

      const { data: monitoramentos, error: monError } = await query;

      if (monError || !monitoramentos?.length) {
        setProgresso(prev => ({
          ...prev,
          status: 'erro',
          mensagem: 'Nenhum monitoramento ativo encontrado',
          fases: { ...prev.fases, fase1: { ...prev.fases.fase1, status: 'erro' } },
        }));
        await registrarExecucao('erro', { mensagem: 'Nenhum monitoramento ativo' });
        setExecutando(false);
        return;
      }

      const total = monitoramentos.length;
      
      // Filtrar monitoramentos já processados se retomando
      const idsProcessados = new Set(idsProcessadosInicial);
      const monitoramentosRestantes = monitoramentos.filter(m => !idsProcessados.has(m.id));

      // Atualizar metadata inicial (total/current) para refletir no dashboard
      configMd = {
        ...configMd,
        status: 'executando',
        total,
        current: idsProcessados.size,
        percentage: total > 0 ? Math.round((idsProcessados.size / total) * 100) : 0,
        next_offset: idsProcessados.size,
        processed_ids: Array.from(idsProcessados),
        last_run: new Date().toISOString(),
        continuingRun: usarCheckpoint,
        cancelado: false,
        last_error: null,
      };
      await saveConfigMetadata(configMd);
      
      setProgresso(prev => ({
        ...prev,
        totalMonitoramentos: total,
        mensagem: usarCheckpoint 
          ? `Retomando de ${idsProcessados.size}/${total}... (${monitoramentosRestantes.length} restantes)`
          : `Fase 1: Buscando publicações (${total} monitoramentos)...`,
        fases: {
          ...prev.fases,
          fase1: { total, processados: idsProcessados.size, status: 'executando' },
        },
      }));

      let totalNovas = usarCheckpointLocal ? checkpoint!.totalNovas : 0;
      let totalDuplicadas = usarCheckpointLocal ? checkpoint!.totalDuplicadas : 0;
      let processados = idsProcessados.size;
      const monitoramentosProcessadosIds = new Set(idsProcessados);
      
      const resumosPorCoordenacao: Record<string, {
        total_verificados: number;
        total_encontrados: number;
        exemplos: Array<{ processo_numero: string; descricao: string }>;
      }> = {};

      // FASE 1: Buscar Publicações
      for (let i = 0; i < monitoramentosRestantes.length; i += CONCURRENT_LIMIT) {
        // Cancelamento remoto: se alguém clicar em “Cancelar” em outra aba/dispositivo
        // o loop para de forma cooperativa.
        const cfg = await loadConfigMetadata();
        if (cfg?.cancel_requested === true) {
          cancelarRef.current = true;
        }

        if (cancelarRef.current) {
          // Salvar checkpoint antes de encerrar
          const checkpointData: CheckpointDjen = {
            data: hoje,
            monitoramentosProcessados: Array.from(monitoramentosProcessadosIds),
            totalNovas,
            totalDuplicadas,
            tempoAcumulado: Math.floor((Date.now() - tempoInicio) / 1000),
            faseAtual: 1,
            executionId: executionId || undefined,
          };
          salvarCheckpoint(checkpointData);
          
          const percentual = Math.round((processados / total) * 100);
          setProgresso(prev => ({
            ...prev,
            status: 'cancelado',
            mensagem: `Cancelado em ${percentual}%. ${totalNovas} novas encontradas.`,
            hasCheckpoint: true,
            checkpointPercent: percentual,
            fases: {
              ...prev.fases,
              fase1: { ...prev.fases.fase1, status: 'concluido', processados },
            },
          }));
          
          await registrarExecucao('cancelado', {
            checkpoint: checkpointData,
            processados,
            total,
            novas: totalNovas,
          });

          // Checkpoint no banco (server-side)
          const duracao_s = Math.floor((Date.now() - tempoInicio) / 1000);
          configMd = {
            ...configMd,
            status: 'cancelado',
            cancelado: true,
            cancel_requested: false,
            total,
            current: processados,
            percentage: total > 0 ? Math.round((processados / total) * 100) : 0,
            next_offset: processados,
            processed_ids: Array.from(monitoramentosProcessadosIds),
            duracao_s,
            last_stop_at: new Date().toISOString(),
            last_stop_reason: cfg?.cancel_requested ? 'remote_cancel' : 'local_cancel',
            last_error: null,
            continuingRun: true,
          };
          await saveConfigMetadata(configMd);
          
          break;
        }

        const lote = monitoramentosRestantes.slice(i, i + CONCURRENT_LIMIT) as MonitoramentoDjen[];
        
        const termos = lote.map(m => m.termo_busca).join(', ');
        setProgresso(prev => ({
          ...prev,
          mensagem: `Fase 1: ${termos.slice(0, 40)}${termos.length > 40 ? '...' : ''}`,
        }));

        const loteTimeoutPromise = new Promise<PromiseSettledResult<{ novas: number; duplicadas: number; coordenacaoStats?: any }>[]>((resolve) => {
          setTimeout(() => {
            console.warn('[DJEN Direta] Timeout de lote (60s), continuando...');
            resolve(lote.map(() => ({ status: 'rejected' as const, reason: 'Lote timeout' })));
          }, 60000);
        });

        const resultados = await Promise.race([
          Promise.allSettled(lote.map(mon => processarMonitoramento(mon))),
          loteTimeoutPromise,
        ]);

        for (let j = 0; j < resultados.length; j++) {
          const resultado = resultados[j];
          if (resultado.status === 'fulfilled') {
            totalNovas += resultado.value.novas;
            totalDuplicadas += resultado.value.duplicadas;
            
            if (resultado.value.coordenacaoStats) {
              const stats = resultado.value.coordenacaoStats;
              if (!resumosPorCoordenacao[stats.coordenacao_id]) {
                resumosPorCoordenacao[stats.coordenacao_id] = {
                  total_verificados: 0,
                  total_encontrados: 0,
                  exemplos: [],
                };
              }
              resumosPorCoordenacao[stats.coordenacao_id].total_verificados += stats.total_verificados;
              resumosPorCoordenacao[stats.coordenacao_id].total_encontrados += stats.total_encontrados;
              if (resumosPorCoordenacao[stats.coordenacao_id].exemplos.length < 5) {
                resumosPorCoordenacao[stats.coordenacao_id].exemplos.push(...stats.exemplos);
              }
            }
          }
          
          // Marcar como processado
          if (j < lote.length) {
            monitoramentosProcessadosIds.add(lote[j].id);
          }
        }

        processados += lote.length;
        setProgresso(prev => ({
          ...prev,
          monitoramentoAtual: processados,
          publicacoesNovas: totalNovas,
          publicacoesDuplicadas: totalDuplicadas,
          fases: {
            ...prev.fases,
            fase1: { ...prev.fases.fase1, processados },
          },
        }));

        // Atualizar execução no banco periodicamente
        if (processados % 10 === 0) {
          await registrarExecucao('executando', {
            processados,
            total,
            novas: totalNovas,
            duplicadas: totalDuplicadas,
          });
        }

        // Atualizar metadata (dashboard) a cada lote
        const duracao_s = Math.floor((Date.now() - tempoInicio) / 1000);
        configMd = {
          ...configMd,
          status: 'executando',
          total,
          current: processados,
          percentage: total > 0 ? Math.round((processados / total) * 100) : 0,
          next_offset: processados,
          processed_ids: Array.from(monitoramentosProcessadosIds),
          duracao_s,
          last_run: new Date().toISOString(),
          continuingRun: true,
          cancelado: false,
        };
        await saveConfigMetadata(configMd);

        if (i + CONCURRENT_LIMIT < monitoramentosRestantes.length) {
          await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
        }
      }

      // Se foi cancelado, encerrar aqui
      if (cancelarRef.current) {
        setExecutando(false);
        return;
      }

      // Fase 1 concluída
      setProgresso(prev => ({
        ...prev,
        faseAtual: 2,
        fases: {
          ...prev.fases,
          fase1: { ...prev.fases.fase1, status: 'concluido', processados: total },
          fase2: { total: totalNovas, processados: 0, status: 'executando' },
        },
        mensagem: 'Fase 2: Identificando eventos...',
      }));

      // FASE 2: Identificar Eventos (placeholder - será expandido)
      // Por enquanto, apenas marca como concluído
      setProgresso(prev => ({
        ...prev,
        fases: {
          ...prev.fases,
          fase2: { ...prev.fases.fase2, status: 'concluido', processados: totalNovas },
          fase3: { total: Object.keys(resumosPorCoordenacao).length, processados: 0, status: 'executando' },
        },
        faseAtual: 3,
        mensagem: 'Fase 3: Enviando notificações...',
      }));

      // FASE 3: Enviar resumos por coordenação
      if (totalNovas > 0 && Object.keys(resumosPorCoordenacao).length > 0) {
        try {
          const coordIds = Object.keys(resumosPorCoordenacao);
          const { data: coordenacoes } = await supabase
            .from('coordenacoes')
            .select('id, nome')
            .in('id', coordIds);

          const resumosFormatados = coordIds
            .filter(id => resumosPorCoordenacao[id].total_encontrados > 0)
            .map(id => ({
              coordenacao_id: id,
              coordenacao_nome: coordenacoes?.find(c => c.id === id)?.nome || 'Coordenação',
              ...resumosPorCoordenacao[id],
            }));

          if (resumosFormatados.length > 0) {
            console.log('[DJEN Direta] Enviando resumos para', resumosFormatados.length, 'coordenações');
            await supabase.functions.invoke('enviar-resumo-monitoramento', {
              body: {
                tipo_monitoramento: 'djen',
                resumos_por_coordenacao: resumosFormatados,
              },
            });
          }
        } catch (resumoError) {
          console.error('Erro ao enviar resumos:', resumoError);
        }
      }

      // Limpar checkpoint ao concluir com sucesso
      limparCheckpoint();

      const tempoFinal = Math.floor((Date.now() - tempoInicio) / 1000);
      setProgresso({
        monitoramentoAtual: total,
        totalMonitoramentos: total,
        publicacoesNovas: totalNovas,
        publicacoesDuplicadas: totalDuplicadas,
        status: 'concluido',
        mensagem: `Concluído! ${totalNovas} novas, ${totalDuplicadas} duplicadas.`,
        tempoInicio: undefined,
        tempoDecorrido: tempoFinal,
        faseAtual: 3,
        fases: {
          fase1: { total, processados: total, status: 'concluido' },
          fase2: { total: totalNovas, processados: totalNovas, status: 'concluido' },
          fase3: { total: Object.keys(resumosPorCoordenacao).length, processados: Object.keys(resumosPorCoordenacao).length, status: 'concluido' },
        },
        hasCheckpoint: false,
      });

      await registrarExecucao('concluido', {
        total,
        novas: totalNovas,
        duplicadas: totalDuplicadas,
        duracao_s: tempoFinal,
      });

      // Finalizar metadata (dashboard)
      configMd = {
        ...configMd,
        status: 'concluido',
        cancelado: false,
        cancel_requested: false,
        total,
        current: total,
        percentage: 100,
        next_offset: null,
        processed_ids: [],
        duracao_s: tempoFinal,
        last_complete_run: new Date().toISOString(),
        continuingRun: false,
        last_error: null,
        last_stop_at: new Date().toISOString(),
        last_stop_reason: 'completed',
      };
      await saveConfigMetadata(configMd);

      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-djen'] });
      queryClient.invalidateQueries({ queryKey: ['execucoes-monitoramento'] });

      if (totalNovas > 0) {
        toast.success(`${totalNovas} novas publicações encontradas!`);
      } else {
        toast.info('Nenhuma nova publicação encontrada');
      }

    } catch (error: any) {
      console.error('Erro no monitoramento DJEN:', error);
      setProgresso(prev => ({
        ...prev,
        status: 'erro',
        mensagem: `Erro: ${error?.message || 'Erro desconhecido'}`,
        fases: {
          ...prev.fases,
          fase1: { ...prev.fases.fase1, status: 'erro' },
        },
      }));
      
      // GARANTIR que sempre finalize no banco, mesmo em caso de erro
      if (executionIdRef.current) {
        try {
          await supabase
            .from('execucoes_agendadas')
            .update({
              status: 'erro',
              finalizado_em: new Date().toISOString(),
              ultimo_erro: error?.message || 'Erro desconhecido',
            })
            .eq('id', executionIdRef.current);
        } catch (dbError) {
          console.error('Erro ao atualizar execução no banco:', dbError);
        }
      }
      
      toast.error(`Erro: ${error?.message || 'Erro desconhecido'}`);

      // Persistir estado de erro no metadata (dashboard)
      try {
        const duracao_s = Math.floor((Date.now() - tempoInicio) / 1000);
        configMd = {
          ...configMd,
          status: 'erro',
          cancelado: false,
          cancel_requested: false,
          next_offset: progresso.monitoramentoAtual,
          processed_ids: Array.isArray(configMd.processed_ids) ? configMd.processed_ids : [],
          duracao_s,
          last_error: error?.message || 'Erro desconhecido',
          last_stop_at: new Date().toISOString(),
          last_stop_reason: 'error',
          continuingRun: true,
        };
        await saveConfigMetadata(configMd);
      } catch {
        // noop
      }
    } finally {
      setExecutando(false);
      executionIdRef.current = null; // Limpar ref ao finalizar
    }
  }, [user?.id, queryClient, loadConfigMetadata, saveConfigMetadata]);

  const cancelarExecucao = useCallback(() => {
    cancelarRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // NÃO limpar localStorage - o checkpoint será salvo pelo loop principal
    // quando detectar o cancelamento
    queueMicrotask(() => {
      setExecutando(false);
    });
  }, []);

  // Verificar se há checkpoint disponível
  const verificarCheckpoint = useCallback((): CheckpointDjen | null => {
    return carregarCheckpoint();
  }, []);

  // Limpar checkpoint manualmente
  const limparCheckpointManual = useCallback(() => {
    limparCheckpoint();
    setProgresso(prev => ({
      ...prev,
      hasCheckpoint: false,
      checkpointPercent: 0,
    }));
  }, []);

  return {
    progresso,
    executando,
    executarMonitoramento,
    cancelarExecucao,
    verificarCheckpoint,
    limparCheckpoint: limparCheckpointManual,
  };
}
