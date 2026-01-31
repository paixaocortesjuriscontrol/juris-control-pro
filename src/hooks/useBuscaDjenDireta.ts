import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { buscarPjeComunicaPaginado } from "@/utils/pjeComunicaClient";
import type { 
  ProgressoCoordenacao, 
  TipoTermo, 
  StatusFase,
} from "@/types/djenProgress";

// Re-exportar tipos para consumidores do hook
export type { ProgressoCoordenacao, TipoTermo, StatusFase } from "@/types/djenProgress";

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
  // V2: Checkpoint por coordenação
  coordenacoesProcessadas?: string[];
  coordenacaoAtualId?: string;
  tipoAtual?: TipoTermo;
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
  
  // V2: Progresso detalhado por coordenação
  coordenacoes: ProgressoCoordenacao[];
  coordenacaoAtualId?: string;
  tipoAtual?: TipoTermo;
  termoAtual?: string;
  
  // V3: Totais por tipo de monitoramento
  novasPorTipo: {
    advogado: number;
    'palavra-chave': number;
    processo: number;
  };
  duplicadasPorTipo: {
    advogado: number;
    'palavra-chave': number;
    processo: number;
  };
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

// Helper para delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// IDs sintéticos de tribunais que precisam ser expandidos
const TODOS_IDS_CIVEIS = [
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMG', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR',
  'TJRJ', 'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
];

const TODOS_IDS_TRABALHISTAS = [
  'TST', 'TRT1', 'TRT2', 'TRT3', 'TRT4', 'TRT5', 'TRT6', 'TRT7', 'TRT8',
  'TRT9', 'TRT10', 'TRT11', 'TRT12', 'TRT13', 'TRT14', 'TRT15', 'TRT16',
  'TRT17', 'TRT18', 'TRT19', 'TRT20', 'TRT21', 'TRT22', 'TRT23', 'TRT24',
];

// Expande IDs sintéticos (TODOS_CIVEIS, TODOS_TRT) para a lista real de tribunais
// IMPORTANTE: Sempre retorna tribunais individuais para buscar em cada um.
// Busca sem filtro não funciona bem para termos específicos/advogados.
function expandirTribunais(tribunais: string[] | undefined): string[] | undefined {
  if (!tribunais || tribunais.length === 0) return undefined;
  
  const expandidos = new Set<string>();
  
  for (const t of tribunais) {
    if (t === 'TODOS_CIVEIS') {
      TODOS_IDS_CIVEIS.forEach(id => expandidos.add(id));
    } else if (t === 'TODOS_TRT') {
      TODOS_IDS_TRABALHISTAS.forEach(id => expandidos.add(id));
    } else {
      // Tribunal normal, adiciona diretamente (normalizar para maiúsculas)
      expandidos.add(t.toUpperCase());
    }
  }
  
  // Retorna sempre os tribunais expandidos - NÃO mais cair para undefined
  // A busca sem filtro de tribunal é muito genérica e não encontra resultados
  // para termos específicos ou advogados
  if (expandidos.size > 0) {
    console.log(`[DJEN] Processando ${expandidos.size} tribunais configurados`);
    return Array.from(expandidos);
  }
  
  return undefined;
}

// ============ BROWSER-ONLY STRATEGY ============
// Edge Function buscar-djen foi REMOVIDA para evitar erros 546 (WORKER_LIMIT).
// Todas as buscas DJEN são feitas via navegador (IP do usuário) usando buscarPjeComunicaPaginado.

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
    
    // Garantir que coordenacoes sempre é um array (para compatibilidade)
    if (!Array.isArray(parsed.coordenacoes)) {
      parsed.coordenacoes = [];
    }
    
    // Garantir que novasPorTipo e duplicadasPorTipo existem
    if (!parsed.novasPorTipo) {
      parsed.novasPorTipo = defaultNovasPorTipo();
    }
    if (!parsed.duplicadasPorTipo) {
      parsed.duplicadasPorTipo = defaultNovasPorTipo();
    }
    
    return parsed;
  } catch (e) {
    return null;
  }
};

// Chave para salvar coordenações separadamente (maior volume de dados)
const COORDENACOES_KEY = 'djen-direta-coordenacoes';

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

const defaultNovasPorTipo = () => ({
  advogado: 0,
  'palavra-chave': 0,
  processo: 0,
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
  coordenacoes: [],
  coordenacaoAtualId: undefined,
  tipoAtual: undefined,
  termoAtual: undefined,
  novasPorTipo: defaultNovasPorTipo(),
  duplicadasPorTipo: defaultNovasPorTipo(),
});

/**
 * Hook com busca DJEN paralela com suporte a fases e retomada
 */
export function useBuscaDjenDireta() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [progresso, setProgresso] = useState<ProgressoExecucao>(() => {
    // Verificar checkpoint disponível dentro do initializer
    const checkpointDisponivel = carregarCheckpoint();
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
  // Ref para evitar múltiplas reconstruções de coordenações
  const coordenacoesReconstruidasRef = useRef(false);

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
          console.warn('[DJEN] Estado local "executando" sem execução ativa no banco. Ajustando status.');
          // NÃO limpar localStorage - apenas ajustar o status
          // Isso preserva as coordenações e métricas para visualização
          executionIdRef.current = null;
          setExecutando(false);

          const checkpointDisponivel = carregarCheckpoint();
          const hasCp = !!checkpointDisponivel;
          const cpPct = hasCp
            ? Math.round((checkpointDisponivel!.monitoramentosProcessados.length / (saved.totalMonitoramentos || 114)) * 100)
            : 0;

          // Preservar coordenações e métricas do estado salvo, apenas mudar o status
          setProgresso(prev => ({
            ...prev,
            // Manter coordenações do estado salvo se existirem
            coordenacoes: saved.coordenacoes?.length > 0 ? saved.coordenacoes : prev.coordenacoes,
            novasPorTipo: saved.novasPorTipo || prev.novasPorTipo,
            duplicadasPorTipo: saved.duplicadasPorTipo || prev.duplicadasPorTipo,
            publicacoesNovas: saved.publicacoesNovas || prev.publicacoesNovas,
            publicacoesDuplicadas: saved.publicacoesDuplicadas || prev.publicacoesDuplicadas,
            totalMonitoramentos: saved.totalMonitoramentos || prev.totalMonitoramentos,
            monitoramentoAtual: saved.monitoramentoAtual || prev.monitoramentoAtual,
            tempoDecorrido: saved.tempoDecorrido || prev.tempoDecorrido,
            status: hasCp ? 'cancelado' : (saved.status === 'executando' ? 'idle' : saved.status),
            tempoInicio: undefined,
            mensagem: hasCp
              ? 'Execução anterior interrompida. Você pode retomar a partir do checkpoint.'
              : '',
            hasCheckpoint: hasCp,
            checkpointPercent: cpPct,
          }));
          
          // Atualizar localStorage com estado corrigido (sem status executando)
          const correctedState = {
            ...saved,
            status: hasCp ? 'cancelado' : 'idle',
            tempoInicio: undefined,
            savedAt: Date.now(),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(correctedState));
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
  }, []); // Empty dependency array - run once on mount

  // Reconstruir coordenações UMA VEZ no mount se o estado salvo tem dados mas falta a estrutura
  // NÃO usar dependências dinâmicas para evitar loops de reconstrução
  // (coordenacoesReconstruidasRef já declarada no topo do hook)
  
  useEffect(() => {
    if (coordenacoesReconstruidasRef.current) return; // Já reconstruiu
    
    let isMounted = true;

    const reconstruirCoordenacoes = async () => {
      // Carregar estado salvo para verificar se precisa reconstruir
      const saved = carregarEstado();
      if (!saved) return;
      
      const temDados = (saved.totalMonitoramentos || 0) > 0 || (saved.publicacoesNovas || 0) > 0;
      const temCoordenacoes = saved.coordenacoes && saved.coordenacoes.length > 0;
      
      // Não reconstruir se já tem coordenações ou não tem dados
      if (temCoordenacoes || !temDados) return;
      
      console.log('[DJEN] Reconstruindo coordenações a partir do banco (mount)...');
      coordenacoesReconstruidasRef.current = true;
      
      try {
        // Buscar monitoramentos ativos
        const { data: monitoramentos } = await supabase
          .from('monitoramentos_djen')
          .select('id, tipo, termo_busca, coordenacao_id, ativo')
          .eq('ativo', true);
        
        if (!monitoramentos || monitoramentos.length === 0 || !isMounted) return;
        
        // Buscar nomes das coordenações
        const coordenacoesIds = [...new Set(monitoramentos
          .map(m => m.coordenacao_id)
          .filter((id): id is string => !!id)
        )];
        
        const { data: coordenacoesData } = coordenacoesIds.length > 0
          ? await supabase
              .from('coordenacoes')
              .select('id, nome')
              .in('id', coordenacoesIds)
          : { data: [] };
        
        const nomesCoordenacoes = new Map(
          (coordenacoesData || []).map(c => [c.id, c.nome])
        );
        
        // Agrupar por coordenação
        const grupos = new Map<string, {
          coordenacao: { id: string; nome: string };
          advogados: number;
          palavrasChave: number;
          processos: number;
        }>();
        
        for (const mon of monitoramentos) {
          const coordId = mon.coordenacao_id || '__sem_coordenacao__';
          
          if (!grupos.has(coordId)) {
            grupos.set(coordId, {
              coordenacao: { 
                id: coordId, 
                nome: nomesCoordenacoes.get(coordId) || 'Sem Coordenação' 
              },
              advogados: 0,
              palavrasChave: 0,
              processos: 0,
            });
          }
          
          const grupo = grupos.get(coordId)!;
          const tipoMon = mon.tipo as string;
          
          if (tipoMon === 'advogado') {
            grupo.advogados++;
          } else if (tipoMon === 'palavra-chave' || tipoMon === 'parte') {
            grupo.palavrasChave++;
          } else if (tipoMon === 'processo') {
            grupo.processos++;
          }
        }
        
        if (!isMounted) return;
        
        // Determinar status baseado no estado salvo
        const statusParaCoordenacoes: StatusFase = 
          saved.status === 'concluido' ? 'concluido' : 'pendente';
        
        // Criar estrutura de coordenações
        const coordenacoesReconstruidas: ProgressoCoordenacao[] = Array.from(grupos.values())
          .sort((a, b) => a.coordenacao.nome.localeCompare(b.coordenacao.nome))
          .map(grupo => ({
            coordenacaoId: grupo.coordenacao.id,
            coordenacaoNome: grupo.coordenacao.nome,
            status: statusParaCoordenacoes,
            advogados: {
              total: grupo.advogados,
              processados: saved.status === 'concluido' ? grupo.advogados : 0,
              status: statusParaCoordenacoes,
            },
            palavrasChave: {
              total: grupo.palavrasChave,
              processados: saved.status === 'concluido' ? grupo.palavrasChave : 0,
              status: statusParaCoordenacoes,
            },
            processos: {
              total: grupo.processos,
              processados: saved.status === 'concluido' ? grupo.processos : 0,
              status: statusParaCoordenacoes,
            },
            novas: 0,
            duplicadas: 0,
          }));
        
        if (coordenacoesReconstruidas.length > 0) {
          console.log(`[DJEN] Reconstruídas ${coordenacoesReconstruidas.length} coordenações`);
          setProgresso(prev => ({
            ...prev,
            coordenacoes: coordenacoesReconstruidas,
            totalMonitoramentos: prev.totalMonitoramentos || monitoramentos.length,
          }));
        }
      } catch (e) {
        console.warn('[DJEN] Erro ao reconstruir coordenações:', e);
      }
    };
    
    reconstruirCoordenacoes();
    
    return () => {
      isMounted = false;
    };
  }, []); // SEM DEPENDÊNCIAS - rodar apenas uma vez no mount

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

  // Gera hash para deduplicação - usa apenas data + início do conteúdo
  // A deduplicação é feita POR MONITORAMENTO (cada coordenação é isolada)
  // Não comparamos entre coordenações diferentes - mesma publicação pode aparecer em várias
  const gerarHash = (conteudo: string, dataDisponibilizacao: string): string => {
    // Usar data de disponibilização (não publicação) para alinhar com a API
    const dataKey = (dataDisponibilizacao || '').slice(0, 10); // YYYY-MM-DD
    // Usar mais caracteres do conteúdo para maior precisão (500 chars)
    const normalized = (dataKey + '|' + conteudo).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 500);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  // Verificar duplicatas em batch - APENAS no mesmo monitoramento
  // Cada monitoramento/coordenação é isolado - publicações podem aparecer em múltiplas coordenações
  const verificarDuplicatasBatch = async (
    hashes: string[], 
    monitoramentoId: string
  ): Promise<Set<string>> => {
    if (hashes.length === 0) return new Set();
    
    // Buscar apenas publicações do MESMO monitoramento (isolamento por coordenação)
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

  // IMPORTANTE: Validar que o TERMO COMPLETO está presente na publicação
  // A API do PJE Comunica faz busca por substring, então pode retornar resultados parciais
  // Ex: Buscar "F & F DISTRIBUIDORA" pode retornar publicação que só tem "DISTRIBUIDORA"
  const conteudoContemTermo = (conteudo: string, termo: string, tipo: string): boolean => {
    if (!conteudo || !termo) return false;
    
    // Para advogado, a validação é diferente (OAB)
    if (tipo === 'advogado') return true; // Validação já feita pela API por OAB
    
    // Normalizar ambos para comparação
    const normalizar = (t: string) => t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[&\/\\]/g, ' ')         // & -> espaço, / -> espaço
      .replace(/\s+/g, ' ')             // Normaliza espaços
      .trim()
      .toUpperCase();
    
    const conteudoNorm = normalizar(conteudo);
    const termoNorm = normalizar(termo);
    
    // Verificar se o termo completo está presente
    if (conteudoNorm.includes(termoNorm)) return true;
    
    // Fallback: verificar se todas as palavras significativas do termo estão presentes
    // Isso ajuda com variações como "F. & F." vs "F & F"
    const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length >= 2);
    if (palavrasTermo.length === 0) return true; // Termo muito curto, aceitar
    
    // Pelo menos 80% das palavras devem estar presentes (tolerância para variações)
    const minPalavras = Math.ceil(palavrasTermo.length * 0.8);
    const palavrasEncontradas = palavrasTermo.filter(p => conteudoNorm.includes(p));
    
    return palavrasEncontradas.length >= minPalavras;
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
    // Cobertura padrão: últimos 3 dias (hoje + 2 dias anteriores)
    const startBrasilia = new Date(todayBrasilia);
    startBrasilia.setDate(startBrasilia.getDate() - 2);

    const dataFimYmd = todayBrasilia.toISOString().split('T')[0];
    const dataInicioYmd = startBrasilia.toISOString().split('T')[0];

    const tipoMapeado = monitoramento.tipo === 'parte' ? 'palavra-chave' : monitoramento.tipo;

    // Normaliza termo (remove acentos) para variante adicional de busca
    const normalizeAccents = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Gerar variantes de busca (original + sem acentos + prefixo curto)
    // Objetivo: capturar variações como "... S/A", "... S A", etc.
    const gerarVariantes = (termo: string): string[] => {
      const original = (termo || '').trim();
      const semAcento = normalizeAccents(original);
      const variantes = new Set<string>();

      if (original) variantes.add(original);
      if (semAcento && semAcento.toLowerCase() !== original.toLowerCase()) {
        variantes.add(semAcento);
      }

      const palavras = semAcento.split(/\s+/).filter((p) => p.length >= 2);
      if (palavras.length >= 3) {
        const prefixo = palavras.slice(0, 2).join(' ').toUpperCase();
        if (prefixo.length >= 6) variantes.add(prefixo);
      }

      return Array.from(variantes);
    };

    const params: Record<string, any> = {
      tipo: tipoMapeado,
      dataInicio: dataInicioYmd,
      dataFim: dataFimYmd,
      // Hard cap to keep payload small and avoid Edge Function 546 (WORKER_LIMIT)
      pageSize: 10,
      fetchAll: false,
    };

    // Lista de variantes para busca (importante para termos com acentos)
    let palavrasChaveVariantes: string[] = [];
    
    // Para advogados com múltiplas UFs, precisamos iterar por cada UF
    let ufsParaBuscar: string[] = [];

    if (tipoMapeado === 'advogado' && monitoramento.oab && monitoramento.uf) {
      // Normalização CRÍTICA:
      // - OAB: apenas dígitos (evita '123.456'/'12345-6' quebrando filtros da API)
      // - UF: trim + UPPERCASE (evita 'sp', 'SP ', etc.)
      const oabDigits = String(monitoramento.oab).replace(/\D/g, '');
      const ufValue = String(monitoramento.uf).trim().toUpperCase();

      params.oab = oabDigits;
      
      if (ufValue === 'TODAS' || !ufValue) {
        // Sem UF específica: buscar por palavra-chave (nome do advogado)
        palavrasChaveVariantes = gerarVariantes(monitoramento.termo_busca);
        delete params.oab;
      } else if (ufValue.includes(',')) {
        // CORREÇÃO: Múltiplas UFs - iterar por CADA uma, não só a primeira
        ufsParaBuscar = ufValue.split(',')
          .map(u => u.trim().toUpperCase())
          .filter(u => u.length === 2);
        
        if (ufsParaBuscar.length > 0) {
          // Definir primeira UF como default (será sobrescrito no loop)
          params.uf = ufsParaBuscar[0];
        } else {
          // Nenhuma UF válida - buscar por nome
          palavrasChaveVariantes = gerarVariantes(monitoramento.termo_busca);
          delete params.oab;
        }
      } else if (ufValue.length === 2) {
        params.uf = ufValue;
        ufsParaBuscar = [ufValue];
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

      // 1) Preferir browser (IP do usuário) para evitar 546/memória no Supabase.
      // Importante: NÃO cair em fallback para Edge Function aqui — isso estava gerando 546/Memory limit.
      let data: any | null = null;
      let error: Error | null = null;

      // Monitoramento pode ter filtro de tribunais: buscar por tribunal reduz volume e evita
      // "perder" resultados por paginação (ex: item fica depois do 50º/100º resultado).
      // IMPORTANTE: Expandir IDs sintéticos (TODOS_CIVEIS, TODOS_TRT) para tribunais reais
      const tribunaisRaw = Array.isArray(monitoramento.tribunais) && monitoramento.tribunais.length > 0
        ? monitoramento.tribunais
        : undefined;
      const tribunaisExpandidos = expandirTribunais(tribunaisRaw);
      const tribunais = tribunaisExpandidos && tribunaisExpandidos.length > 0
        ? tribunaisExpandidos
        : [undefined];

      // Lista de variantes de palavras-chave (com e sem acentos + prefixo)
      // IMPORTANTE: Para advogados com OAB, não precisamos de variantes de texto,
      // mas o loop precisa executar pelo menos uma vez - usamos [null] como placeholder
      const variantesParaBuscarRaw = palavrasChaveVariantes.length > 0
        ? palavrasChaveVariantes
        : (params.palavraChave ? [params.palavraChave] : [null as unknown as string]);

      // Para advogados, permitir busca sem variante de texto (apenas OAB)
      const variantesParaBuscar = params.oab
        ? (variantesParaBuscarRaw.length > 0 ? variantesParaBuscarRaw : [null as unknown as string])
        : variantesParaBuscarRaw
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
      
      // Se é advogado e ainda assim variantesParaBuscar está vazio, usar placeholder
      const variantesLoop = variantesParaBuscar.length > 0 ? variantesParaBuscar : [null as unknown as string];

      const seen = new Set<string>();
      const acumulado: any[] = [];

      const createLinkedController = () => {
        const controller = new AbortController();
        const globalSignal = abortControllerRef.current?.signal;
        if (globalSignal) {
          if (globalSignal.aborted) controller.abort();
          else globalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
        return controller;
      };

      // Para advogados com múltiplas UFs, iterar por cada UF
      const ufsLoop = ufsParaBuscar.length > 0 ? ufsParaBuscar : [params.uf];
      
      for (const ufAtual of ufsLoop) {
        if (cancelarRef.current) break;
        
        for (const variante of variantesLoop) {
          if (cancelarRef.current) break;

          for (const trib of tribunais) {
            if (cancelarRef.current) break;

            const reqController = createLinkedController();
            const timeoutId = setTimeout(() => reqController.abort(), 60_000);

            try {
              const resp = await buscarPjeComunicaPaginado(
                {
                  tipo: params.tipo,
                  oab: params.oab,
                  uf: ufAtual, // Usar UF atual do loop
                  // Não passar palavraChave se for null (busca por OAB apenas)
                  palavraChave: variante || undefined,
                  numeroProcesso: params.numeroProcesso,
                  siglaTribunal: trib,
                  dataInicio: params.dataInicio,
                  dataFim: params.dataFim,
                  page: 0,
                  pageSize: params.pageSize ?? 10,
                },
                {
                  signal: reqController.signal,
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
          } catch (browserErr: any) {
            if (browserErr?.name === 'AbortError') {
              if (cancelarRef.current) break;
              console.warn(
                `[DJEN Direta] Timeout no browser (60s) para variante "${variante}" tribunal ${trib ?? 'TODOS'}. Continuando...`
              );
            } else {
              console.warn(
                `[DJEN Direta] Erro no browser para "${variante}" tribunal ${trib ?? 'TODOS'}:`,
                browserErr?.message || browserErr
              );
            }
          } finally {
            clearTimeout(timeoutId);
          }

          // Pequeno delay entre tribunais para reduzir 429
          await delay(120);
        }
        }
      }

      data = { comunicacoes: acumulado, items: acumulado };
      error = null;

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

    // Filtrar publicações:
    // 1. Verificar exclusões configuradas
    // 2. IMPORTANTE: Validar que o TERMO COMPLETO está presente (evita resultados parciais da API)
    let publicacoesIgnoradas = 0;
    const pubsFiltradas = publicacoes.filter(pub => {
      // Se não tem conteúdo, aceita (será processado de outra forma)
      if (!pub.conteudo) return true;
      
      // Verificar exclusões
      if (deveExcluir(pub.conteudo, mon.exclusoes)) return false;
      
      // Validar que o termo completo está presente
      if (!conteudoContemTermo(pub.conteudo, mon.termo_busca, mon.tipo)) {
        publicacoesIgnoradas++;
        return false;
      }
      
      return true;
    });
    
    // Log resumido para diagnóstico (apenas se houver publicações ignoradas)
    if (publicacoesIgnoradas > 0) {
      console.log(`[DJEN] "${mon.termo_busca}": ${publicacoesIgnoradas} publicações ignoradas (termo não encontrado integralmente)`);
    }

    // Usar data_disponibilizacao para hash (alinhado com API e backend)
    const pubsComHash = pubsFiltradas.map(pub => ({
      ...pub,
      hash_conteudo: gerarHash(
        pub.conteudo || '',
        pub.data_disponibilizacao || pub.data_publicacao || new Date().toISOString().split('T')[0]
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
      coordenacoes: [],
      coordenacaoAtualId: undefined,
      tipoAtual: undefined,
      termoAtual: undefined,
      novasPorTipo: defaultNovasPorTipo(),
      duplicadasPorTipo: defaultNovasPorTipo(),
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

      // Buscar nomes das coordenações
      const coordenacoesIds = [...new Set(monitoramentos
        .map(m => m.coordenacao_id)
        .filter((id): id is string => !!id)
      )];
      
      const { data: coordenacoesData } = coordenacoesIds.length > 0
        ? await supabase
            .from('coordenacoes')
            .select('id, nome')
            .in('id', coordenacoesIds)
        : { data: [] };
      
      const nomesCoordenacoes = new Map(
        (coordenacoesData || []).map(c => [c.id, c.nome])
      );

      // Agrupar monitoramentos por coordenação e tipo
      const agruparPorCoordenacaoETipo = () => {
        const grupos = new Map<string, {
          coordenacao: { id: string; nome: string };
          advogados: MonitoramentoDjen[];
          palavrasChave: MonitoramentoDjen[];
          processos: MonitoramentoDjen[];
        }>();
        
        for (const monRaw of monitoramentos) {
          // Cast para o tipo correto (Supabase retorna string genérico)
          const mon = monRaw as unknown as MonitoramentoDjen;
          const coordId = mon.coordenacao_id || '__sem_coordenacao__';
          
          if (!grupos.has(coordId)) {
            grupos.set(coordId, {
              coordenacao: { 
                id: coordId, 
                nome: nomesCoordenacoes.get(coordId) || 'Sem Coordenação' 
              },
              advogados: [],
              palavrasChave: [],
              processos: [],
            });
          }
          
          const grupo = grupos.get(coordId)!;
          const tipoMon = mon.tipo as string;
          
          if (tipoMon === 'advogado') {
            grupo.advogados.push(mon);
          } else if (tipoMon === 'palavra-chave' || tipoMon === 'parte') {
            grupo.palavrasChave.push(mon);
          } else if (tipoMon === 'processo') {
            grupo.processos.push(mon);
          }
        }
        
        return grupos;
      };

      const gruposPorCoordenacao = agruparPorCoordenacaoETipo();
      const coordenacoesOrdenadas = Array.from(gruposPorCoordenacao.values())
        .sort((a, b) => a.coordenacao.nome.localeCompare(b.coordenacao.nome));

      const total = monitoramentos.length;
      
      // Filtrar monitoramentos já processados se retomando
      const idsProcessados = new Set(idsProcessadosInicial);
      const monitoramentosRestantes = monitoramentos.filter(m => !idsProcessados.has(m.id));

      // Criar estrutura de progresso por coordenação
      const progressoCoordenacoes: ProgressoCoordenacao[] = coordenacoesOrdenadas.map(grupo => ({
        coordenacaoId: grupo.coordenacao.id,
        coordenacaoNome: grupo.coordenacao.nome,
        status: 'pendente' as StatusFase,
        advogados: {
          total: grupo.advogados.length,
          processados: 0,
          status: 'pendente' as StatusFase,
        },
        palavrasChave: {
          total: grupo.palavrasChave.length,
          processados: 0,
          status: 'pendente' as StatusFase,
        },
        processos: {
          total: grupo.processos.length,
          processados: 0,
          status: 'pendente' as StatusFase,
        },
        novas: 0,
        duplicadas: 0,
      }));

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
          : `Fase 1: Buscando publicações (${coordenacoesOrdenadas.length} coordenações)...`,
        fases: {
          ...prev.fases,
          fase1: { total, processados: idsProcessados.size, status: 'executando' },
        },
        coordenacoes: progressoCoordenacoes,
      }));

      let totalNovas = usarCheckpointLocal ? checkpoint!.totalNovas : 0;
      let totalDuplicadas = usarCheckpointLocal ? checkpoint!.totalDuplicadas : 0;
      let processados = idsProcessados.size;
      const monitoramentosProcessadosIds = new Set(idsProcessados);
      
      // Totais por tipo de monitoramento
      const novasPorTipo = { advogado: 0, 'palavra-chave': 0, processo: 0 };
      const duplicadasPorTipo = { advogado: 0, 'palavra-chave': 0, processo: 0 };
      
      const resumosPorCoordenacao: Record<string, {
        total_verificados: number;
        total_encontrados: number;
        exemplos: Array<{ processo_numero: string; descricao: string }>;
      }> = {};

      // Helper para processar um tipo de termo em uma coordenação
      const processarTipo = async (
        coordIdx: number,
        tipoKey: 'advogados' | 'palavrasChave' | 'processos',
        tipoLabel: TipoTermo,
        monitoramentosTipo: MonitoramentoDjen[]
      ) => {
        if (monitoramentosTipo.length === 0) return;

        // Atualizar estado: tipo atual executando
        setProgresso(prev => ({
          ...prev,
          tipoAtual: tipoLabel,
          coordenacoes: prev.coordenacoes.map((c, i) => 
            i === coordIdx
              ? { ...c, [tipoKey]: { ...c[tipoKey], status: 'executando' as StatusFase } }
              : c
          ),
        }));

        for (let i = 0; i < monitoramentosTipo.length; i += CONCURRENT_LIMIT) {
          // Check cancelamento
          const cfg = await loadConfigMetadata();
          if (cfg?.cancel_requested === true) {
            cancelarRef.current = true;
          }
          if (cancelarRef.current) break;

          const lote = monitoramentosTipo.slice(i, i + CONCURRENT_LIMIT);
          const termosLote = lote.map(m => m.termo_busca).join(', ');
          
          // Atualizar termo atual
          setProgresso(prev => ({
            ...prev,
            termoAtual: termosLote.slice(0, 60) + (termosLote.length > 60 ? '...' : ''),
            mensagem: `${prev.coordenacoes[coordIdx]?.coordenacaoNome || 'Coordenação'} → ${tipoLabel}: ${lote[0]?.termo_busca || ''}`,
            coordenacoes: prev.coordenacoes.map((c, idx) => 
              idx === coordIdx
                ? { ...c, [tipoKey]: { ...c[tipoKey], processados: i, termoAtual: lote[0]?.termo_busca } }
                : c
            ),
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

          let novasLote = 0;
          let duplicadasLote = 0;

          for (let j = 0; j < resultados.length; j++) {
            const resultado = resultados[j];
            if (resultado.status === 'fulfilled') {
              novasLote += resultado.value.novas;
              duplicadasLote += resultado.value.duplicadas;
              totalNovas += resultado.value.novas;
              totalDuplicadas += resultado.value.duplicadas;
              
              // Acumular totais por tipo
              novasPorTipo[tipoLabel] += resultado.value.novas;
              duplicadasPorTipo[tipoLabel] += resultado.value.duplicadas;
              
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
            
            if (j < lote.length) {
              monitoramentosProcessadosIds.add(lote[j].id);
            }
          }

          processados += lote.length;

          // Atualizar progresso da coordenação
          setProgresso(prev => ({
            ...prev,
            monitoramentoAtual: processados,
            publicacoesNovas: totalNovas,
            publicacoesDuplicadas: totalDuplicadas,
            novasPorTipo: { ...novasPorTipo },
            duplicadasPorTipo: { ...duplicadasPorTipo },
            fases: {
              ...prev.fases,
              fase1: { ...prev.fases.fase1, processados },
            },
            coordenacoes: prev.coordenacoes.map((c, idx) => 
              idx === coordIdx
                ? { 
                    ...c, 
                    novas: c.novas + novasLote,
                    duplicadas: c.duplicadas + duplicadasLote,
                    [tipoKey]: { ...c[tipoKey], processados: Math.min(i + lote.length, monitoramentosTipo.length) },
                  }
                : c
            ),
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

          if (i + CONCURRENT_LIMIT < monitoramentosTipo.length) {
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
          }
        }

        // Marcar tipo como concluído
        if (!cancelarRef.current) {
          setProgresso(prev => ({
            ...prev,
            coordenacoes: prev.coordenacoes.map((c, idx) => 
              idx === coordIdx
                ? { 
                    ...c, 
                    [tipoKey]: { 
                      ...c[tipoKey], 
                      status: 'concluido' as StatusFase,
                      processados: monitoramentosTipo.length,
                      termoAtual: undefined,
                    } 
                  }
                : c
            ),
          }));
        }
      };

      // FASE 1: Buscar Publicações por Coordenação e Tipo
      for (let coordIdx = 0; coordIdx < coordenacoesOrdenadas.length; coordIdx++) {
        if (cancelarRef.current) break;

        const grupo = coordenacoesOrdenadas[coordIdx];
        const coordId = grupo.coordenacao.id;
        const coordNome = grupo.coordenacao.nome;

        // Atualizar estado: coordenação atual executando
        setProgresso(prev => ({
          ...prev,
          coordenacaoAtualId: coordId,
          mensagem: `Processando: ${coordNome}`,
          coordenacoes: prev.coordenacoes.map((c, i) => 
            i === coordIdx
              ? { ...c, status: 'executando' as StatusFase }
              : c
          ),
        }));

        // 1. Processar Advogados
        await processarTipo(coordIdx, 'advogados', 'advogado', grupo.advogados);
        if (cancelarRef.current) break;

        // 2. Processar Palavras-chave
        await processarTipo(coordIdx, 'palavrasChave', 'palavra-chave', grupo.palavrasChave);
        if (cancelarRef.current) break;

        // 3. Processar Processos
        await processarTipo(coordIdx, 'processos', 'processo', grupo.processos);
        if (cancelarRef.current) break;

        // Marcar coordenação como concluída
        setProgresso(prev => ({
          ...prev,
          coordenacoes: prev.coordenacoes.map((c, i) => 
            i === coordIdx
              ? { ...c, status: 'concluido' as StatusFase }
              : c
          ),
        }));
      }

      // Verificar cancelamento
      if (cancelarRef.current) {
        const cfg = await loadConfigMetadata();
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
      setProgresso(prev => ({
        ...prev,
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
        coordenacoes: prev.coordenacoes.map(c => ({
          ...c,
          status: 'concluido' as const,
          advogados: { ...c.advogados, status: 'concluido' as const },
          palavrasChave: { ...c.palavrasChave, status: 'concluido' as const },
          processos: { ...c.processos, status: 'concluido' as const },
        })),
      }));

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
    
    // Atualizar o estado local IMEDIATAMENTE para refletir na UI
    // O loop principal vai salvar o checkpoint quando detectar o cancelamento
    setProgresso(prev => ({
      ...prev,
      status: 'cancelado',
      mensagem: 'Cancelamento solicitado...',
    }));
    
    queueMicrotask(() => {
      setExecutando(false);
    });
  }, []);
  
  // Forçar reset do estado local (para uso após kill switch)
  const forceResetState = useCallback(() => {
    cancelarRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    executionIdRef.current = null;
    setExecutando(false);
    
    // Limpar localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CHECKPOINT_KEY);
    } catch { /* silencioso */ }
    
    // Resetar progresso para estado inicial
    setProgresso({
      ...defaultProgresso(),
      status: 'idle',
      mensagem: 'Estado resetado. Pronto para nova execução.',
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
    forceResetState,
    verificarCheckpoint,
    limparCheckpoint: limparCheckpointManual,
  };
}
