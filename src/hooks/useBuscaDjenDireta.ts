import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface MonitoramentoDjen {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte'; // 'parte' é mapeado para 'palavra-chave'
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

/**
 * Calcula o próximo dia útil considerando fins de semana e recesso forense (20/dez a 6/jan)
 */
function calcularProximoDiaUtil(dataBase: Date): Date {
  const resultado = new Date(dataBase);
  
  // Função para verificar se está no recesso forense
  const estaNoRecesso = (d: Date): boolean => {
    const mes = d.getMonth(); // 0-11
    const dia = d.getDate();
    return (mes === 11 && dia >= 20) || (mes === 0 && dia <= 6);
  };
  
  // Função para avançar para próximo dia útil
  const proximoDiaUtil = (d: Date): void => {
    // Primeiro, sair de fim de semana
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    // Se estiver no recesso, pular para 7 de janeiro
    if (estaNoRecesso(d)) {
      // Se estamos em dezembro, vai para janeiro do próximo ano
      if (d.getMonth() === 11) {
        d.setFullYear(d.getFullYear() + 1);
      }
      d.setMonth(0); // Janeiro
      d.setDate(7);
      // Se 7 de janeiro cair em fim de semana, avança
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
    }
  };
  
  proximoDiaUtil(resultado);
  return resultado;
}

/**
 * Extrai data no formato YYYY-MM-DD de strings de data ISO ou outros formatos
 */
function extrairDataYMD(dataStr: string | null | undefined): string | null {
  if (!dataStr) return null;
  // Se já está em formato YYYY-MM-DD, retorna
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return dataStr;
  // Tentar extrair de ISO ou outros formatos
  const match = dataStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  // Tentar parse como Date
  const d = new Date(dataStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

interface ProgressoExecucao {
  monitoramentoAtual: number;
  totalMonitoramentos: number;
  publicacoesNovas: number;
  publicacoesDuplicadas: number;
  status: 'idle' | 'executando' | 'concluido' | 'erro';
  mensagem: string;
  tempoInicio?: number; // timestamp de início
  tempoDecorrido: number; // segundos
}

// Configuração de paralelismo - CONSERVADOR para evitar WORKER_LIMIT (546)
// Reduzido de 5 para 2 para evitar exaustão de workers do Edge Function
const CONCURRENT_LIMIT = 2; // 2 simultâneos para evitar 546 WORKER_LIMIT
const DELAY_BETWEEN_BATCHES = 1500; // 1.5s entre lotes para permitir liberação de workers
const DELAY_BETWEEN_REQUESTS = 0; // Sem delay intra-lote

// Chave para persistir estado no localStorage
const STORAGE_KEY = 'djen-direta-progresso';

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
    // Limpar estados muito antigos (mais de 12 horas)
    // (A busca direta pode demorar em bases grandes; não podemos perder o estado ao atualizar a página.)
    if (Date.now() - parsed.savedAt > 12 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    // Se estava executando quando salvou, atualizar tempo decorrido
    if (parsed.status === 'executando' && parsed.tempoInicio) {
      parsed.tempoDecorrido = Math.floor((Date.now() - parsed.tempoInicio) / 1000);
    }
    
    return parsed;
  } catch (e) {
    return null;
  }
};

/**
 * Hook com busca DJEN paralela para máxima performance
 * - Processa múltiplos monitoramentos em paralelo
 * - Usa a Edge Function `buscar-djen` apenas como proxy leve
 * - Grava resultados diretamente via Supabase Client
 * - PERSISTE estado no localStorage para não perder ao navegar
 */
export function useBuscaDjenDireta() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Carregar estado inicial do localStorage
  // CORREÇÃO: Se já estava concluído, não restaurar como executando
  const [progresso, setProgresso] = useState<ProgressoExecucao>(() => {
    const saved = carregarEstado();
    if (saved) {
      // Se estava em 100% ou concluído, forçar status concluído e parar timer
      const isComplete = saved.status === 'concluido' || 
        (saved.totalMonitoramentos > 0 && saved.monitoramentoAtual >= saved.totalMonitoramentos);
      if (isComplete) {
        return {
          ...saved,
          status: 'concluido',
          tempoInicio: undefined, // Remove tempoInicio para parar timer
        };
      }
      return saved;
    }
    return {
      monitoramentoAtual: 0,
      totalMonitoramentos: 0,
      publicacoesNovas: 0,
      publicacoesDuplicadas: 0,
      status: 'idle',
      mensagem: '',
      tempoDecorrido: 0,
    };
  });
  
  const [executando, setExecutando] = useState(() => {
    const saved = carregarEstado();
    // CORREÇÃO: Não marcar como executando se já está em 100% ou concluído
    if (!saved) return false;
    const isComplete = saved.status === 'concluido' || 
      (saved.totalMonitoramentos > 0 && saved.monitoramentoAtual >= saved.totalMonitoramentos);
    return saved.status === 'executando' && !isComplete;
  });
  
  const cancelarRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer para atualizar tempo decorrido
  useEffect(() => {
    // Sempre limpar o timer anterior ao reavaliar
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Só conta tempo enquanto a execução está efetivamente em andamento
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

  // Gera hash simples para deduplicação
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

  // Verifica se a publicação já existe (batch)
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

  // Verifica se deve excluir com base nas exclusões configuradas
  const deveExcluir = (conteudo: string, exclusoes?: string[]): boolean => {
    if (!exclusoes || exclusoes.length === 0) return false;
    const conteudoUpper = conteudo.toUpperCase();
    return exclusoes.some(termo => conteudoUpper.includes(termo.toUpperCase()));
  };

  // Buscar um monitoramento via Edge Function leve
  const buscarMonitoramento = async (monitoramento: MonitoramentoDjen): Promise<PublicacaoResultado[]> => {
    // Checar cancelamento antes de iniciar
    if (cancelarRef.current) return [];

    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(dataInicio.getDate() - 1);

    // Mapear tipos do banco para tipos aceitos pela API
    const tipoMapeado = monitoramento.tipo === 'parte' ? 'palavra-chave' : monitoramento.tipo;

    const params: Record<string, any> = {
      tipo: tipoMapeado,
      dataInicio: dataInicio.toISOString().split('T')[0],
      dataFim: hoje.toISOString().split('T')[0],
      pageSize: 50,
      fetchAll: false,
    };

    if (tipoMapeado === 'advogado' && monitoramento.oab && monitoramento.uf) {
      params.oab = monitoramento.oab;
      // Tratar UF 'TODAS' ou múltiplas UFs: usar apenas a primeira UF válida (2 letras)
      // A API DJEN exige UF com exatamente 2 letras
      const ufValue = monitoramento.uf;
      if (ufValue === 'TODAS' || !ufValue) {
        // Se 'TODAS', buscar por palavra-chave usando o nome do advogado
        params.palavraChave = monitoramento.termo_busca;
        delete params.oab;
      } else if (ufValue.includes(',')) {
        // Múltiplas UFs: usar a primeira
        const primeiraUf = ufValue.split(',')[0].trim();
        if (primeiraUf.length === 2) {
          params.uf = primeiraUf;
        } else {
          // Fallback para palavra-chave
          params.palavraChave = monitoramento.termo_busca;
          delete params.oab;
        }
      } else if (ufValue.length === 2) {
        params.uf = ufValue;
      } else {
        // UF inválida, usar palavra-chave
        params.palavraChave = monitoramento.termo_busca;
        delete params.oab;
      }
    } else if (tipoMapeado === 'palavra-chave' || monitoramento.tipo === 'parte') {
      params.palavraChave = monitoramento.termo_busca;
    } else if (tipoMapeado === 'processo') {
      params.numeroProcesso = monitoramento.termo_busca.replace(/\D/g, '');
    }

    try {
      // Checar cancelamento novamente antes da requisição
      if (cancelarRef.current) return [];

      // Timeout individual de 30 segundos por monitoramento para evitar travamento
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 30000);

      const invokePromise = supabase.functions.invoke('buscar-djen', {
        body: params,
      });

      // Wrapper para aplicar timeout
      const { data, error } = await Promise.race([
        invokePromise,
        new Promise<{ data: null; error: Error }>((_, reject) => {
          timeoutController.signal.addEventListener('abort', () => {
            reject({ data: null, error: new Error('Timeout ao buscar DJEN (30s)') });
          });
        }),
      ]).finally(() => clearTimeout(timeoutId));

      // Checar cancelamento após a requisição
      if (cancelarRef.current) return [];

      if (error) {
        console.warn(`[DJEN Direta] Erro ao buscar ${monitoramento.termo_busca}:`, error?.message || error);
        return [];
      }

      const comunicacoes = data?.comunicacoes || data?.items || [];
      
      return comunicacoes.map((pub: any) => {
        // Extrair data de disponibilização (a data que vem do DJEN)
        const rawDataDisp = pub.dataDisponibilizacao || pub.dataDJe || pub.dtDisponibilizacao || null;
        const rawDataPub = pub.dataPublicacao || pub.dataJornal || pub.dtPublicacao || null;
        
        let dataDisponibilizacao = extrairDataYMD(rawDataDisp);
        let dataPublicacao: string | null = null;
        
        // Se temos data de disponibilização, calcular publicação como próximo dia útil
        if (dataDisponibilizacao) {
          const dispDate = new Date(dataDisponibilizacao + 'T12:00:00'); // Meio-dia para evitar timezone issues
          dispDate.setDate(dispDate.getDate() + 1); // Avança 1 dia
          const proximoDiaUtil = calcularProximoDiaUtil(dispDate);
          dataPublicacao = proximoDiaUtil.toISOString().split('T')[0];
        } else if (rawDataPub) {
          // Se só temos dataPublicacao da API, usar ela e inferir disponibilização
          dataPublicacao = extrairDataYMD(rawDataPub);
          if (dataPublicacao) {
            // Disponibilização é tipicamente 1 dia antes da publicação
            const pubDate = new Date(dataPublicacao + 'T12:00:00');
            pubDate.setDate(pubDate.getDate() - 1);
            dataDisponibilizacao = pubDate.toISOString().split('T')[0];
          }
        }
        
        // Fallback: usar data atual se nenhuma data disponível
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
      // Ignorar erros de abort ou timeout
      if (err?.name === 'AbortError' || cancelarRef.current) return [];
      console.warn(`[DJEN Direta] Erro na busca (${monitoramento.termo_busca}):`, err?.message || err);
      return [];
    }
  };

  // Processar um único monitoramento e retornar estatísticas
  const processarMonitoramento = async (
    mon: MonitoramentoDjen
  ): Promise<{ novas: number; duplicadas: number; coordenacaoStats?: any }> => {
    const publicacoes = await buscarMonitoramento(mon);
    
    if (publicacoes.length === 0) {
      return { novas: 0, duplicadas: 0 };
    }

    // Filtrar exclusões primeiro
    const pubsFiltradas = publicacoes.filter(pub => 
      !pub.conteudo || !deveExcluir(pub.conteudo, mon.exclusoes)
    );

    // Gerar hashes para todas as publicações
    const pubsComHash = pubsFiltradas.map(pub => ({
      ...pub,
      hash_conteudo: gerarHash(
        pub.conteudo || '',
        pub.data_publicacao || new Date().toISOString()
      ),
    }));

    // Deduplicar dentro do próprio lote (evita violar UNIQUE (monitoramento_id, hash_conteudo))
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

    // Verificar duplicatas já existentes no banco (mais eficiente)
    const hashes = pubsUnicas.map(p => p.hash_conteudo);
    const existentes = await verificarDuplicatasBatch(hashes, mon.id);

    const novas = pubsUnicas.filter(p => !existentes.has(p.hash_conteudo));
    const duplicadasBanco = pubsUnicas.length - novas.length;
    const duplicadas = duplicadasInternas + duplicadasBanco;

    // Inserir novas em batch (ignorar duplicatas em caso de corrida)
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
        // Não derrubar a execução inteira por duplicata/concorrência
        return { novas: 0, duplicadas };
      }
    }

    // Estatísticas para resumo por coordenação
    let coordenacaoStats;
    if (mon.coordenacao_id && novas.length > 0) {
      coordenacaoStats = {
        coordenacao_id: mon.coordenacao_id,
        total_verificados: publicacoes.length,
        total_encontrados: novas.length,
        exemplos: novas.slice(0, 3).map(p => {
          // Tentar extrair número do processo do conteúdo se não existir no campo
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

  // Executar monitoramento com paralelismo
  const executarMonitoramento = useCallback(async (monitoramentosIds?: string[]) => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    const tempoInicio = Date.now();
    setExecutando(true);
    cancelarRef.current = false;
    abortControllerRef.current = new AbortController();
    setProgresso({
      monitoramentoAtual: 0,
      totalMonitoramentos: 0,
      publicacoesNovas: 0,
      publicacoesDuplicadas: 0,
      status: 'executando',
      mensagem: 'Carregando monitoramentos...',
      tempoInicio,
      tempoDecorrido: 0,
    });

    try {
      // Buscar monitoramentos ativos
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
        }));
        setExecutando(false);
        return;
      }

      const total = monitoramentos.length;
      setProgresso(prev => ({
        ...prev,
        totalMonitoramentos: total,
        mensagem: `Processando ${total} monitoramentos em paralelo (${CONCURRENT_LIMIT} simultâneos)...`,
      }));

      let totalNovas = 0;
      let totalDuplicadas = 0;
      let processados = 0;
      const resumosPorCoordenacao: Record<string, {
        total_verificados: number;
        total_encontrados: number;
        exemplos: Array<{ processo_numero: string; descricao: string }>;
      }> = {};

      // Processar em lotes paralelos
      for (let i = 0; i < monitoramentos.length; i += CONCURRENT_LIMIT) {
        if (cancelarRef.current) {
          setProgresso(prev => ({
            ...prev,
            status: 'concluido',
            mensagem: `Cancelado. ${totalNovas} novas, ${totalDuplicadas} duplicadas.`,
          }));
          break;
        }

        const lote = monitoramentos.slice(i, i + CONCURRENT_LIMIT) as MonitoramentoDjen[];
        
        // Mostrar quais termos estão sendo buscados
        const termos = lote.map(m => m.termo_busca).join(', ');
        setProgresso(prev => ({
          ...prev,
          mensagem: `Buscando: ${termos.slice(0, 50)}${termos.length > 50 ? '...' : ''}`,
        }));

        // Processar lote em PARALELO com timeout de lote de 60s (segurança)
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

        // Contabilizar resultados
        for (const resultado of resultados) {
          if (resultado.status === 'fulfilled') {
            totalNovas += resultado.value.novas;
            totalDuplicadas += resultado.value.duplicadas;
            
            // Acumular stats de coordenação
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
        }

        processados += lote.length;
        setProgresso(prev => ({
          ...prev,
          monitoramentoAtual: processados,
          publicacoesNovas: totalNovas,
          publicacoesDuplicadas: totalDuplicadas,
        }));

        // Pequeno delay entre lotes para não sobrecarregar
        if (i + CONCURRENT_LIMIT < monitoramentos.length) {
          await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
        }
      }

      // Enviar resumos por coordenação ao finalizar (só se encontrou publicações)
      if (totalNovas > 0 && Object.keys(resumosPorCoordenacao).length > 0) {
        try {
          const coordIds = Object.keys(resumosPorCoordenacao);
          const { data: coordenacoes } = await supabase
            .from('coordenacoes')
            .select('id, nome')
            .in('id', coordIds);

          // Filtrar apenas coordenações que tiveram achados
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
      });

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-djen'] });

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
      }));
      toast.error(`Erro: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setExecutando(false);
    }
  }, [user?.id, queryClient]);

  const cancelarExecucao = useCallback(() => {
    cancelarRef.current = true;
    // Abortar requisições em andamento
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Limpar localStorage para não restaurar estado cancelado
    localStorage.removeItem(STORAGE_KEY);
    // Agendar atualizações de estado para o próximo tick para evitar conflitos com React
    queueMicrotask(() => {
      setExecutando(false);
      setProgresso(prev => ({
        ...prev,
        status: 'concluido',
        mensagem: 'Cancelado pelo usuário.',
      }));
    });
  }, []);

  return {
    progresso,
    executando,
    executarMonitoramento,
    cancelarExecucao,
  };
}
