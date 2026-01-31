import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { buscarPjeComunicaPaginado } from "@/utils/pjeComunicaClient";
import { fetchDjenBackendResumeSnapshot } from "@/hooks/djen/djenBackendResume";

// ============================================================================
// VERSÃO SIMPLIFICADA - Loop sequencial por monitoramento
// Restaurado do modelo original para resolver problemas de progresso
// ============================================================================

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

export interface ProgressoExecucao {
  monitoramentoAtual: number;
  totalMonitoramentos: number;
  publicacoesNovas: number;
  publicacoesDuplicadas: number;
  publicacoesDescartadas: number;
  status: 'idle' | 'executando' | 'concluido' | 'erro' | 'cancelado';
  mensagem: string;
  tempoInicio?: number;
  tempoDecorrido: number;
  termoAtual?: string;
  executionId?: string;
  /** Se definido, a execução fica restrita a esta data fim (YYYY-MM-DD) */
  dataOverrideYmd?: string | null;
  /** Data início do intervalo de busca */
  dataInicioYmd?: string | null;
  /** Data fim do intervalo de busca */
  dataFimYmd?: string | null;
  /** DIA sendo processado atualmente (YYYY-MM-DD) - para exibição no card */
  diaAtualYmd?: string | null;
  /** Índice do dia atual no intervalo (1-based) */
  diaAtualIndice?: number;
  /** Total de dias no intervalo */
  totalDias?: number;
  // Checkpoint para retomada
  checkpoint?: {
    indice: number;
    data: string;
    diaYmd: string; // dia sendo processado
    diaIndice: number; // índice do dia (1-based)
    novasAcumuladas: number;
    duplicadasAcumuladas: number;
    descartadasAcumuladas: number;
  };
}

// ============================================================================
// CONFIGURAÇÃO OTIMIZADA v1.0.5 - Performance restaurada
// ============================================================================
const CONFIG = {
  concurrent_limit: 2,
  delay_between_batches: 0,        // ELIMINADO - sem delay entre monitoramentos
  delay_between_tribunals: 100,    // Reduzido de 250ms para 100ms
  delay_between_variants: 50,      // Reduzido de 150ms para 50ms
  delay_on_rate_limit: 5000,       // Reduzido de 10s para 5s (já tem retry interno)
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// IDs sintéticos de tribunais
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

function expandirTribunais(tribunais: string[] | undefined): string[] | undefined {
  if (!tribunais || tribunais.length === 0) return undefined;
  
  const expandidos = new Set<string>();
  
  for (const t of tribunais) {
    if (t === 'TODOS_CIVEIS') {
      TODOS_IDS_CIVEIS.forEach(id => expandidos.add(id));
    } else if (t === 'TODOS_TRT') {
      TODOS_IDS_TRABALHISTAS.forEach(id => expandidos.add(id));
    } else {
      expandidos.add(t.toUpperCase());
    }
  }
  
  if (expandidos.size > 0) {
    return Array.from(expandidos);
  }
  
  return undefined;
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

const BR_TZ = 'America/Sao_Paulo';
function ymdInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}
function getHojeBrasiliaYmd(): string {
  return ymdInTimeZone(new Date(), BR_TZ);
}

// Chaves para localStorage
const STORAGE_KEY = 'djen-direta-progresso';

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

const carregarEstado = (): ProgressoExecucao | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const parsed = JSON.parse(saved);
    // Expirar após 12 horas
    if (Date.now() - parsed.savedAt > 12 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return parsed;
  } catch (e) {
    return null;
  }
};

const defaultProgresso = (): ProgressoExecucao => ({
  monitoramentoAtual: 0,
  totalMonitoramentos: 0,
  publicacoesNovas: 0,
  publicacoesDuplicadas: 0,
  publicacoesDescartadas: 0,
  status: 'idle',
  mensagem: '',
  tempoDecorrido: 0,
  termoAtual: undefined,
  dataOverrideYmd: null,
  dataInicioYmd: null,
  dataFimYmd: null,
  diaAtualYmd: null,
  diaAtualIndice: undefined,
  totalDias: undefined,
  checkpoint: undefined,
});

/**
 * Gera lista de datas YYYY-MM-DD do intervalo (início → fim), ordem cronológica.
 */
function gerarListaDatas(dataInicioYmd: string, dataFimYmd: string): string[] {
  const datas: string[] = [];
  const inicio = new Date(`${dataInicioYmd}T12:00:00`);
  const fim = new Date(`${dataFimYmd}T12:00:00`);
  
  // Garantir que início <= fim
  if (inicio > fim) {
    return [dataInicioYmd];
  }
  
  const current = new Date(inicio);
  while (current <= fim) {
    datas.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  
  return datas;
}

/**
 * Hook simplificado para busca DJEN - Loop sequencial por monitoramento
 */
export function useBuscaDjenDireta() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [progresso, setProgresso] = useState<ProgressoExecucao>(() => {
    const saved = carregarEstado();
    if (saved && (saved.status === 'concluido' || saved.status === 'cancelado')) {
      return saved;
    }
    return defaultProgresso();
  });
  
  const [executando, setExecutando] = useState(false);
  
  const cancelarRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const executionIdRef = useRef<string | null>(null);
  const dataOverrideRef = useRef<string | null>(null);

  // ============================================================================
  // AUTO-RECONEXÃO E AUTO-RESTART
  // Ao voltar à página:
  // 1) Se há execução "executando" no banco → reconectar (retomar loop local)
  // 2) Se há execução "timeout" recente (< 15 min) → reiniciar automaticamente
  // ============================================================================
  const autoResumeTriedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const validarEstadoLocal = async () => {
      // Evitar múltiplas tentativas de auto-resume na mesma sessão
      if (autoResumeTriedRef.current) return;

      const saved = carregarEstado();

      try {
        // Buscar execução ativa + metadata da configuração em paralelo.
        const [{ data: execData }, { data: configData }] = await Promise.all([
          supabase
            .from('execucoes_agendadas')
            .select('id, status, finalizado_em, iniciado_em, detalhes')
            .eq('tipo', 'djen')
            .in('status', ['executando', 'timeout'])
            .order('iniciado_em', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('configuracoes_monitoramento')
            .select('metadata')
            .eq('tipo', 'djen')
            .is('coordenacao_id', null)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        const md = (configData?.metadata as Record<string, any> | null) || {};

        // CASO 1: Execução "executando" no banco → reconectar e retomar loop local
        if (execData?.status === 'executando' && !execData.finalizado_em) {
          const detalhes = execData.detalhes as Record<string, any> | null;
          const iniciado = new Date(execData.iniciado_em).getTime();
          const agora = Date.now();
          const minutosDecorridos = (agora - iniciado) / 60000;

          // Se execução tem mais de 2 minutos sem loop local, é órfã
          // Vamos tentar retomar automaticamente em vez de só exibir "órfã"
          if (minutosDecorridos >= 2) {
            console.log(`[DJEN] Execução ativa detectada (${Math.round(minutosDecorridos)}min). Tentando reconectar...`);
            autoResumeTriedRef.current = true;

            // Sincronizar estado local antes de retomar
            const termoAtual = md.termoAtual ?? detalhes?.termoAtual ?? saved?.termoAtual;
            const total = md.total ?? detalhes?.total ?? saved?.totalMonitoramentos ?? 0;
            const current = md.current ?? detalhes?.processados ?? saved?.monitoramentoAtual ?? 0;

            if (total > 0 && current < total) {
              // Atualizar estado visual antes de iniciar
              setProgresso(prev => ({
                ...prev,
                status: 'executando',
                tempoInicio: iniciado,
                tempoDecorrido: Math.floor((agora - iniciado) / 1000),
                termoAtual: termoAtual ?? prev.termoAtual,
                totalMonitoramentos: total,
                monitoramentoAtual: current,
                executionId: execData.id,
                mensagem: `Reconectando do monitoramento ${current + 1}/${total}...`,
              }));

              // Disparar retomada após breve delay para permitir renderização
              setTimeout(() => {
                if (isMounted && !executando) {
                  console.log('[DJEN] Auto-retomando execução órfã...');
                  // Chamar executarMonitoramento com retomar=true será feito via exposição
                  // Por enquanto, apenas sincronizar estado e deixar usuário clicar
                  // Melhor: chamar diretamente
                }
              }, 500);
            }
          } else {
            // Execução recente, apenas sincronizar estado visual
            const termoAtual = md.termoAtual ?? detalhes?.termoAtual ?? saved?.termoAtual;
            const total = md.total ?? detalhes?.total ?? saved?.totalMonitoramentos ?? 0;
            const current = md.current ?? detalhes?.processados ?? saved?.monitoramentoAtual ?? 0;

            executionIdRef.current = execData.id;
            if (typeof md.data_override === 'string') {
              dataOverrideRef.current = md.data_override;
            }

            setProgresso(prev => ({
              ...prev,
              status: 'executando',
              tempoInicio: iniciado,
              tempoDecorrido: Math.floor((agora - iniciado) / 1000),
              termoAtual: termoAtual ?? prev.termoAtual,
              totalMonitoramentos: total > 0 ? total : prev.totalMonitoramentos,
              monitoramentoAtual: current > 0 ? current : prev.monitoramentoAtual,
              executionId: execData.id,
              dataOverrideYmd: md.data_override ?? prev.dataOverrideYmd,
              dataInicioYmd: md.data_inicio ?? prev.dataInicioYmd,
              dataFimYmd: md.data_fim ?? prev.dataFimYmd,
            }));
          }
          return;
        }

        // CASO 2: Execução "timeout" recente → auto-restart
        if (execData?.status === 'timeout' && execData.finalizado_em) {
          const finalizadoEm = new Date(execData.finalizado_em).getTime();
          const agora = Date.now();
          const minutosDesdeTimeout = (agora - finalizadoEm) / 60000;

          // Auto-restart se timeout foi há menos de 15 minutos
          if (minutosDesdeTimeout < 15) {
            console.log(`[DJEN] Timeout recente detectado (${Math.round(minutosDesdeTimeout)}min atrás). Auto-reiniciando...`);
            autoResumeTriedRef.current = true;

            const total = md.total ?? 0;
            const current = md.current ?? 0;
            const hasProgress = total > 0 && current > 0 && current < total;

            // Sincronizar estado visual
            setProgresso(prev => ({
              ...prev,
              status: 'idle',
              mensagem: hasProgress 
                ? `Timeout detectado. Retomando automaticamente (${current}/${total})...`
                : 'Timeout detectado. Reiniciando automaticamente...',
            }));

            // Não chamar diretamente aqui para evitar loops - deixar o Card disparar
            // Sinalizar que deve auto-retomar
            return;
          }
        }

        // CASO 3: Sem execução ativa, validar estado local
        if (!execData || execData.status !== 'executando') {
          if (saved?.status === 'executando') {
            console.warn('[DJEN] Estado local "executando" sem execução ativa no banco - resetando para idle.');
            setProgresso(prev => ({
              ...prev,
              status: 'idle',
              tempoInicio: undefined,
            }));
          }
        }
      } catch (e) {
        console.warn('[DJEN] Falha ao validar estado:', e);
      }
    };

    validarEstadoLocal();

    return () => {
      isMounted = false;
    };
  }, [executando]);

  // Timer para tempo decorrido
  // O timer deve rodar enquanto:
  // 1) O loop local estiver ativo (executando = true), OU
  // 2) O estado local indicar que devemos continuar mostrando o tempo (ex: reconexão após página voltar)
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Condição relaxada: rodar timer se status é 'executando' E temos tempoInicio
    // (mesmo que executando=false, pois ao voltar à página o estado salvo pode ter status 'executando')
    const deveRodarTimer = progresso.status === 'executando' && !!progresso.tempoInicio;
    if (!deveRodarTimer) {
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
  }, [progresso.tempoInicio, progresso.status]);

  // Persistir progresso
  useEffect(() => {
    salvarEstado(progresso);
  }, [progresso]);

  // Gerar hash para deduplicação
  const gerarHash = (conteudo: string, dataDisponibilizacao: string): string => {
    const dataKey = (dataDisponibilizacao || '').slice(0, 10);
    const normalized = (dataKey + '|' + conteudo).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 500);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  // Verificar duplicatas
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

  // Validar conteúdo contém termo
  const conteudoContemTermo = (conteudo: string, termo: string, tipo: string, oab?: string): boolean => {
    if (!conteudo) return false;
    
    const normalizar = (t: string) => t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[&\/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    
    const conteudoNorm = normalizar(conteudo);
    
    // Para advogado: validar OAB + Nome
    if (tipo === 'advogado') {
      if (oab) {
        const oabDigits = String(oab).replace(/\D/g, '');
        const oabPattern = new RegExp(oabDigits.split('').join('[.\\s]?'), 'i');
        if (!oabPattern.test(conteudo)) {
          return false;
        }
      }
      
      if (termo) {
        const termoNorm = normalizar(termo);
        const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length >= 2);
        
        if (palavrasTermo.length > 0) {
          const minPalavras = Math.ceil(palavrasTermo.length * 0.8);
          const palavrasEncontradas = palavrasTermo.filter(p => conteudoNorm.includes(p));
          
          if (palavrasEncontradas.length < minPalavras) {
            return false;
          }
        }
      }
      
      return true;
    }

    // Para outros tipos
    if (!termo) return false;
    
    const termoNorm = normalizar(termo);
    
    if (conteudoNorm.includes(termoNorm)) return true;
    
    const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length >= 2);
    if (palavrasTermo.length === 0) return true;
    
    const minPalavras = Math.ceil(palavrasTermo.length * 0.8);
    const palavrasEncontradas = palavrasTermo.filter(p => conteudoNorm.includes(p));
    
    return palavrasEncontradas.length >= minPalavras;
  };

  // Registrar execução no banco
  const registrarExecucao = async (status: 'executando' | 'concluido' | 'cancelado' | 'erro', detalhes?: Record<string, any>): Promise<string | null> => {
    try {
      const executionId = executionIdRef.current;
      
      if (status === 'executando' && !executionId) {
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

  // Gerar variantes de termo (com e sem acento)
  const gerarVariantes = (termo: string): string[] => {
    const semAcento = termo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const variantes = [termo];
    if (semAcento !== termo) {
      variantes.push(semAcento);
    }
    return variantes;
  };

  // Buscar publicações para um monitoramento
  const buscarMonitoramento = async (
    monitoramento: MonitoramentoDjen,
    forceDataInicioYmd?: string,
    forceDataFimYmd?: string
  ): Promise<PublicacaoResultado[]> => {
    if (cancelarRef.current) return [];

    let dataFimYmd: string;
    let dataInicioYmd: string;
    
    // PRIORIDADE: datas explícitas > dataOverrideRef (legado) > últimos 3 dias
    if (forceDataInicioYmd && forceDataFimYmd) {
      dataInicioYmd = forceDataInicioYmd;
      dataFimYmd = forceDataFimYmd;
    } else if (forceDataFimYmd) {
      dataInicioYmd = forceDataFimYmd;
      dataFimYmd = forceDataFimYmd;
    } else if (forceDataInicioYmd) {
      dataInicioYmd = forceDataInicioYmd;
      dataFimYmd = getHojeBrasiliaYmd();
    } else if (dataOverrideRef.current) {
      dataFimYmd = dataOverrideRef.current;
      dataInicioYmd = dataOverrideRef.current;
    } else {
      const hojeYmd = getHojeBrasiliaYmd();
      const start = new Date(`${hojeYmd}T12:00:00`);
      start.setDate(start.getDate() - 2);
      dataFimYmd = hojeYmd;
      dataInicioYmd = start.toISOString().slice(0, 10);
    }

    const tipoMapeado = monitoramento.tipo === 'parte' ? 'palavra-chave' : monitoramento.tipo;

    const params: any = {
      tipo: tipoMapeado,
      dataInicio: dataInicioYmd,
      dataFim: dataFimYmd,
      pageSize: 50,
    };

    let palavrasChaveVariantes: string[] = [];
    let ufsParaBuscar: string[] = [];

    if (tipoMapeado === 'advogado' && monitoramento.oab) {
      const oabDigits = String(monitoramento.oab).replace(/\D/g, '');
      const ufValue = String(monitoramento.uf || '').trim().toUpperCase();

      params.oab = oabDigits;

      if (!ufValue || ufValue === 'TODAS') {
        params.uf = undefined;
        ufsParaBuscar = [];
      } else if (ufValue.includes(',')) {
        ufsParaBuscar = ufValue.split(',')
          .map(u => u.trim().toUpperCase())
          .filter(u => u.length === 2);
        
        if (ufsParaBuscar.length > 0) {
          params.uf = ufsParaBuscar[0];
        }
      } else if (ufValue.length === 2) {
        params.uf = ufValue;
        ufsParaBuscar = [ufValue];
      } else {
        params.uf = undefined;
        ufsParaBuscar = [];
      }
    } else if (tipoMapeado === 'palavra-chave' || monitoramento.tipo === 'parte') {
      palavrasChaveVariantes = gerarVariantes(monitoramento.termo_busca);
    } else if (tipoMapeado === 'processo') {
      params.numeroProcesso = monitoramento.termo_busca.replace(/\D/g, '');
    }

    if (palavrasChaveVariantes.length === 0 && !params.oab && !params.numeroProcesso) {
      palavrasChaveVariantes = [monitoramento.termo_busca];
    }

    try {
      if (cancelarRef.current) return [];

      const tribunaisRaw = Array.isArray(monitoramento.tribunais) && monitoramento.tribunais.length > 0
        ? monitoramento.tribunais
        : undefined;
      const tribunaisExpandidos = expandirTribunais(tribunaisRaw);
      const tribunais = tribunaisExpandidos && tribunaisExpandidos.length > 0
        ? tribunaisExpandidos
        : [undefined];

      const variantesParaBuscarRaw = palavrasChaveVariantes.length > 0
        ? palavrasChaveVariantes
        : (params.palavraChave ? [params.palavraChave] : [null as unknown as string]);

      const variantesParaBuscar = params.oab
        ? (variantesParaBuscarRaw.length > 0 ? variantesParaBuscarRaw : [null as unknown as string])
        : variantesParaBuscarRaw
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.trim())
            .filter((v) => v.length > 0);

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

      // ==================================================================
      // LOOP OTIMIZADO v1.0.5 - 2 níveis apenas (tribunal → variante)
      // Sem timeout artificial, sem loop extra de UF
      // ==================================================================
      const ufParaBusca = ufsParaBuscar.length > 0 ? ufsParaBuscar[0] : params.uf;
      
      for (const trib of tribunais) {
        if (cancelarRef.current) break;

        for (const variante of variantesLoop) {
          if (cancelarRef.current) break;

          const reqController = createLinkedController();

          try {
            const resp = await buscarPjeComunicaPaginado(
              {
                tipo: params.tipo,
                oab: params.oab,
                uf: ufParaBusca,
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
                delayMs: 150,  // Otimizado para 150ms
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
            }
            // Logar erro mas continuar para próximo tribunal
            console.warn(`[DJEN] Erro ${trib ?? 'TODOS'}: ${browserErr?.message}`);

            // Rate limit (429) costuma “travar” a impressão de progresso. Respeitar um backoff adicional.
            const msg = String(browserErr?.message ?? '');
            if (msg.includes('HTTP 429') || msg.includes('Too Many')) {
              await delay(CONFIG.delay_on_rate_limit);
            }
          }

          await delay(CONFIG.delay_between_variants);
        }
        await delay(CONFIG.delay_between_tribunals);
      }

      if (cancelarRef.current) return [];

      return acumulado.map((pub: any) => {
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
      console.warn(`[DJEN] Erro na busca (${monitoramento.termo_busca}):`, err?.message || err);
      return [];
    }
  };

  // Processar um monitoramento individual
  const processarMonitoramento = async (
    mon: MonitoramentoDjen,
    forceDataInicioYmd?: string,
    forceDataFimYmd?: string
  ): Promise<{ novas: number; duplicadas: number; descartadas: number }> => {
    const publicacoes = await buscarMonitoramento(mon, forceDataInicioYmd, forceDataFimYmd);
    
    if (publicacoes.length === 0) {
      return { novas: 0, duplicadas: 0, descartadas: 0 };
    }

    const ymdToIso = (ymd?: string | null) => (ymd ? `${ymd}T12:00:00.000Z` : null);

    let publicacoesIgnoradas = 0;
    const descartadasParaPersistir: Array<{ pub: PublicacaoResultado; motivo: string }> = [];

    const pubsFiltradas = publicacoes.filter(pub => {
      if (!pub.conteudo) return true;
      
      // Verificar exclusões
      const conteudoUpper = pub.conteudo.toUpperCase();
      const termoExclusao = mon.exclusoes?.find((t) => conteudoUpper.includes(String(t).toUpperCase()));
      if (termoExclusao) {
        descartadasParaPersistir.push({ pub, motivo: `Termo de exclusão: ${termoExclusao}` });
        return false;
      }
      
      // Validar termo completo presente
      if (!conteudoContemTermo(pub.conteudo, mon.termo_busca, mon.tipo, mon.oab)) {
        publicacoesIgnoradas++;
        descartadasParaPersistir.push({ pub, motivo: 'Termo não encontrado integralmente' });
        return false;
      }
      
      return true;
    });
    
    if (publicacoesIgnoradas > 0) {
      console.log(`[DJEN] "${mon.termo_busca}": ${publicacoesIgnoradas} publicações ignoradas`);
    }

    // Persistir descartadas
    if (descartadasParaPersistir.length > 0) {
      const payloadDescartadas = descartadasParaPersistir
        .filter((d) => !!d.pub.conteudo)
        .map((d) => {
          const dataRef = d.pub.data_disponibilizacao || d.pub.data_publicacao || new Date().toISOString().slice(0, 10);
          const hash = gerarHash(d.pub.conteudo || '', dataRef);
          return {
            monitoramento_id: mon.id,
            hash_conteudo: hash,
            processo_numero: d.pub.processo_numero,
            conteudo: d.pub.conteudo,
            fonte: d.pub.fonte,
            tribunal: d.pub.fonte,
            data_disponibilizacao: ymdToIso(d.pub.data_disponibilizacao),
            data_publicacao: ymdToIso(d.pub.data_publicacao),
            motivo_descarte: d.motivo,
            lida: false,
          };
        });

      if (payloadDescartadas.length > 0) {
        await supabase
          .from('publicacoes_djen_descartadas')
          .upsert(payloadDescartadas, {
            onConflict: 'monitoramento_id,hash_conteudo',
            ignoreDuplicates: true,
          });
      }
    }

    // Calcular hashes
    const pubsComHash = pubsFiltradas.map(pub => ({
      ...pub,
      hash_conteudo: gerarHash(
        pub.conteudo || '',
        pub.data_disponibilizacao || pub.data_publicacao || new Date().toISOString().split('T')[0]
      ),
    }));

    // Deduplicar dentro do lote
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

    // Verificar duplicatas no banco
    const hashes = pubsUnicas.map(p => p.hash_conteudo);
    const existentes = await verificarDuplicatasBatch(hashes, mon.id);

    const novas = pubsUnicas.filter(p => !existentes.has(p.hash_conteudo));
    const duplicadasBanco = pubsUnicas.length - novas.length;
    const duplicadas = duplicadasInternas + duplicadasBanco;

    // Inserir novas publicações
    if (novas.length > 0) {
      const payload = novas.map(pub => ({
        monitoramento_id: mon.id,
        hash_conteudo: pub.hash_conteudo,
        processo_numero: pub.processo_numero,
        conteudo: pub.conteudo,
        // IMPORTANTE: persistir em formato ISO ancorado ao meio-dia (UTC)
        // para evitar "cair" no dia anterior quando visualizado em BRT.
        data_disponibilizacao: ymdToIso(pub.data_disponibilizacao),
        data_publicacao: ymdToIso(pub.data_publicacao),
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
        return { novas: 0, duplicadas, descartadas: descartadasParaPersistir.length };
      }
    }

    return { novas: novas.length, duplicadas, descartadas: descartadasParaPersistir.length };
  };

  // ============================================================================
  // EXECUÇÃO PRINCIPAL - Loop sequencial simples
  // ============================================================================
  const executarMonitoramento = useCallback(async (
    monitoramentosIds?: string[], 
    retomar: boolean = false,
    dataInicioYmd?: string,
    dataFimYmd?: string
  ) => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    // Carregar checkpoint se retomar = true
    const savedState = retomar ? carregarEstado() : null;
    const checkpoint = savedState?.checkpoint;
    const backendResume = retomar ? await fetchDjenBackendResumeSnapshot() : null;
    const hoje = getHojeBrasiliaYmd();

    const tempoInicio = Date.now();
    setExecutando(true);
    cancelarRef.current = false;
    abortControllerRef.current = new AbortController();
    executionIdRef.current = null;
    // Se estiver retomando e não vieram datas explícitas, reutilizar os overrides salvos.
    // Fallback: metadata do backend (permite retomar mesmo com localStorage perdido).
    let resolvedDataInicio = dataInicioYmd ?? savedState?.dataInicioYmd ?? backendResume?.dataInicioYmd ?? null;
    let resolvedDataFim = dataFimYmd ?? savedState?.dataFimYmd ?? savedState?.dataOverrideYmd ?? backendResume?.dataFimYmd ?? null;

    // DEFAULT SIMPLES: se não houver intervalo explícito, buscar os últimos 3 dias (inclui ontem).
    // Isso evita "pular" o dia 30 quando o usuário clica em Executar sem selecionar datas.
    if (!resolvedDataInicio && !resolvedDataFim) {
      // âncora em 12:00 local para evitar saltos por timezone/UTC
      const base = new Date();
      base.setHours(12, 0, 0, 0);
      const inicio = new Date(base);
      inicio.setDate(inicio.getDate() - 2);
      resolvedDataFim = hoje;
      resolvedDataInicio = ymdInTimeZone(inicio, BR_TZ);
    }

    // Se veio apenas uma das datas, tratar como busca de 1 dia.
    if (resolvedDataInicio && !resolvedDataFim) resolvedDataFim = resolvedDataInicio;
    if (!resolvedDataInicio && resolvedDataFim) resolvedDataInicio = resolvedDataFim;

    dataOverrideRef.current = resolvedDataFim; // manter compatibilidade com código legado

    // Chave estável da execução para validação do checkpoint:
    // 1) Se há datas explícitas, usa dataFim (ou combinação)
    // 2) Senão, manter o valor já salvo no checkpoint (permite retomar mesmo no dia seguinte)
    // 3) Fallback: hoje (Brasília)
    const runKey = resolvedDataFim ?? resolvedDataInicio ?? checkpoint?.data ?? backendResume?.runKey ?? hoje;

    // Verificar se checkpoint é válido para ESTE runKey
    const checkpointValido = !!(checkpoint && checkpoint.indice > 0 && checkpoint.data === runKey);
    const backendCheckpointValido = !checkpointValido && !!(backendResume && backendResume.runKey === runKey && backendResume.current > 0);

    // Limpar metadata de execução anterior (ou iniciar retomada)
    try {
      const initialTotal = savedState?.totalMonitoramentos ?? (backendCheckpointValido ? backendResume!.total : 0);
      const initialCurrent = checkpointValido ? checkpoint!.indice : (backendCheckpointValido ? backendResume!.current : 0);
      await supabase
        .from('configuracoes_monitoramento')
        .update({ 
          metadata: {
            status: 'executando',
            cancel_requested: false,
            cancelado: false,
            current: initialCurrent,
            total: initialTotal,
            percentage: initialTotal > 0 ? Math.round((initialCurrent / initialTotal) * 100) : 0,
            retomando: checkpointValido || backendCheckpointValido,
            data_inicio: resolvedDataInicio,
            data_fim: resolvedDataFim,
            data_override: resolvedDataFim, // compatibilidade
            run_key: runKey,
          } 
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
    } catch (e) {
      console.warn('[DJEN] Erro ao limpar metadata:', e);
    }
    
    // Buscar monitoramentos ativos ANTES de inicializar progresso para ter o total
    let query = supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true);

    if (monitoramentosIds?.length) {
      query = query.in('id', monitoramentosIds);
    }

    const { data: monitoramentosRaw, error: monError } = await query;

    if (monError || !monitoramentosRaw?.length) {
      setProgresso(prev => ({
        ...prev,
        status: 'erro',
        mensagem: 'Nenhum monitoramento ativo encontrado',
      }));
      await registrarExecucao('erro', { mensagem: 'Nenhum monitoramento ativo' });
      setExecutando(false);
      return;
    }

    const monitoramentos = monitoramentosRaw as unknown as MonitoramentoDjen[];
    const total = monitoramentos.length;
    
    // ================================================================
    // NOVO: LOOP DIA A DIA
    // Gerar lista de datas do intervalo e processar todos os termos em cada dia
    // ================================================================
    const listaDatas = gerarListaDatas(
      resolvedDataInicio ?? hoje,
      resolvedDataFim ?? hoje
    );
    const totalDias = listaDatas.length;

    // Checkpoint: verificar se estávamos em um dia específico
    const checkpointDiaIndice = checkpointValido && checkpoint!.diaIndice
      ? Math.min(checkpoint!.diaIndice - 1, totalDias - 1) // Converter 1-based para 0-based
      : 0;
    const checkpointTermoIndice = checkpointValido ? checkpoint!.indice : 0;

    // Track local do progresso efetivo para evitar "stale closure".
    let lastProcessed = checkpointValido ? checkpoint!.indice : (backendCheckpointValido ? backendResume!.current : 0);

    // Inicializar progresso COM o total já conhecido
    setProgresso({
      monitoramentoAtual: checkpointValido
        ? checkpoint!.indice
        : (backendCheckpointValido ? backendResume!.current : 0),
      totalMonitoramentos: total,
      publicacoesNovas: checkpointValido
        ? checkpoint!.novasAcumuladas
        : (backendCheckpointValido ? backendResume!.novas : 0),
      publicacoesDuplicadas: checkpointValido
        ? checkpoint!.duplicadasAcumuladas
        : (backendCheckpointValido ? backendResume!.duplicadas : 0),
      publicacoesDescartadas: checkpointValido
        ? checkpoint!.descartadasAcumuladas
        : (backendCheckpointValido ? backendResume!.descartadas : 0),
      status: 'executando',
      mensagem: checkpointValido 
        ? `Retomando dia ${checkpointDiaIndice + 1}/${totalDias}...`
        : `Processando ${totalDias} dia(s)...`,
      tempoInicio,
      tempoDecorrido: 0,
      termoAtual: backendCheckpointValido ? (backendResume!.termoAtual ?? undefined) : undefined,
      dataOverrideYmd: resolvedDataFim,
      dataInicioYmd: resolvedDataInicio,
      dataFimYmd: resolvedDataFim,
      diaAtualYmd: listaDatas[checkpointDiaIndice] ?? null,
      diaAtualIndice: checkpointDiaIndice + 1,
      totalDias,
      checkpoint: checkpointValido
        ? checkpoint!
        : (backendCheckpointValido
          ? {
              indice: backendResume!.current,
              data: runKey,
              diaYmd: listaDatas[0] ?? hoje,
              diaIndice: 1,
              novasAcumuladas: backendResume!.novas,
              duplicadasAcumuladas: backendResume!.duplicadas,
              descartadasAcumuladas: backendResume!.descartadas,
            }
          : undefined),
    });

    // Registrar execução
    const executionId = await registrarExecucao('executando', {
      retomada: retomar,
      run_key: runKey,
      data_inicio: resolvedDataInicio,
      data_fim: resolvedDataFim,
      total_dias: totalDias,
      processados: checkpointValido ? checkpoint!.indice : (backendCheckpointValido ? backendResume!.current : 0),
      total: checkpointValido
        ? (savedState?.totalMonitoramentos ?? 0)
        : (backendCheckpointValido ? backendResume!.total : 0),
    });

    try {
      // Acumuladores globais (do checkpoint ou 0)
      let totalNovas = checkpointValido ? checkpoint!.novasAcumuladas : (backendCheckpointValido ? backendResume!.novas : 0);
      let totalDuplicadas = checkpointValido ? checkpoint!.duplicadasAcumuladas : (backendCheckpointValido ? backendResume!.duplicadas : 0);
      let totalDescartadas = checkpointValido ? checkpoint!.descartadasAcumuladas : (backendCheckpointValido ? backendResume!.descartadas : 0);

      const checkRemoteCancelRequested = async (): Promise<boolean> => {
        try {
          const { data } = await supabase
            .from('configuracoes_monitoramento')
            .select('metadata')
            .eq('tipo', 'djen')
            .is('coordenacao_id', null)
            .maybeSingle();

          const md = (data?.metadata as any) || {};
          return md.cancel_requested === true;
        } catch {
          return false;
        }
      };

      // ================================================================
      // LOOP EXTERNO: Dias (ordem cronológica)
      // ================================================================
      for (let diaIdx = checkpointDiaIndice; diaIdx < totalDias; diaIdx++) {
        if (cancelarRef.current) break;

        const diaYmd = listaDatas[diaIdx];
        const diaFormatado = `${diaYmd.slice(8, 10)}/${diaYmd.slice(5, 7)}`;

        // Determinar índice inicial de termos para este dia
        // Se estamos retomando no mesmo dia, usar checkpoint; senão, começar do 0
        const termoIndiceInicial = (diaIdx === checkpointDiaIndice && checkpointValido)
          ? checkpointTermoIndice
          : 0;

        // Atualizar UI com o dia atual
        setProgresso(prev => ({
          ...prev,
          diaAtualYmd: diaYmd,
          diaAtualIndice: diaIdx + 1,
          totalDias,
          monitoramentoAtual: termoIndiceInicial,
          mensagem: `📅 ${diaFormatado} • Buscando termos...`,
        }));

        // ================================================================
        // LOOP INTERNO: Termos/Monitoramentos (para este dia específico)
        // ================================================================
        for (let i = termoIndiceInicial; i < total; i++) {
          if (cancelarRef.current) break;

          const mon = monitoramentos[i];

          // Atualizar progresso ANTES de processar
          const percentDia = Math.round(((i + 1) / total) * 100);
          setProgresso(prev => ({
            ...prev,
            monitoramentoAtual: i + 1,
            termoAtual: mon.termo_busca,
            mensagem: `📅 ${diaFormatado} • (${i + 1}/${total}) ${mon.termo_busca}`,
          }));

          // Processar monitoramento APENAS para este dia específico
          const result = await processarMonitoramento(mon, diaYmd, diaYmd);
          
          // Acumular estatísticas
          totalNovas += result.novas;
          totalDuplicadas += result.duplicadas;
          totalDescartadas += result.descartadas;

          // Atualizar progresso DEPOIS de processar (com checkpoint para retomada)
          const checkpointAtual = {
            indice: i + 1,
            data: runKey,
            diaYmd,
            diaIndice: diaIdx + 1,
            novasAcumuladas: totalNovas,
            duplicadasAcumuladas: totalDuplicadas,
            descartadasAcumuladas: totalDescartadas,
          };

          lastProcessed = i + 1;
          
          setProgresso(prev => ({
            ...prev,
            publicacoesNovas: totalNovas,
            publicacoesDuplicadas: totalDuplicadas,
            publicacoesDescartadas: totalDescartadas,
            dataOverrideYmd: dataOverrideRef.current,
            checkpoint: checkpointAtual,
          }));

          // Persistir progresso a cada monitoramento
          const duracao_s = Math.floor((Date.now() - tempoInicio) / 1000);
          try {
            await supabase
              .from('configuracoes_monitoramento')
              .update({
                metadata: {
                  status: 'executando',
                  total,
                  current: i + 1,
                  percentage: percentDia,
                  duracao_s,
                  novas: totalNovas,
                  duplicadas: totalDuplicadas,
                  descartadas: totalDescartadas,
                  // manter o intervalo para que a retomada não perca o contexto
                  data_inicio: resolvedDataInicio,
                  data_fim: resolvedDataFim,
                  data_override: dataOverrideRef.current,
                  run_key: runKey,
                  termoAtual: mon.termo_busca,
                  diaAtual: diaYmd,
                  diaIndice: diaIdx + 1,
                  totalDias,
                },
              })
              .eq('tipo', 'djen')
              .is('coordenacao_id', null);
          } catch {
            // Ignorar erro de atualização
          }

          // Checar cancelamento remoto a cada 10 itens
          if ((i + 1) % 10 === 0 || i === total - 1) {
            if (await checkRemoteCancelRequested()) {
              cancelarRef.current = true;
              setProgresso(prev => ({
                ...prev,
                mensagem: 'Cancelamento solicitado (remoto). Finalizando...'
              }));
              break;
            }

            await registrarExecucao('executando', {
              // manter campos-base em TODAS as atualizações para não “sumirem” do JSON
              retomada: retomar,
              run_key: runKey,
              data_inicio: resolvedDataInicio,
              data_fim: resolvedDataFim,
              total_dias: totalDias,
              processados: i + 1,
              total,
              novas: totalNovas,
              duplicadas: totalDuplicadas,
              descartadas: totalDescartadas,
              diaAtual: diaYmd,
              diaIndice: diaIdx + 1,
              totalDias,
              termoAtual: mon.termo_busca,
            });
          }

          // SEM delay entre monitoramentos - velocidade máxima!
        }

        // Dia concluído! Mostrar mensagem de transição antes de ir para o próximo
        if (!cancelarRef.current && diaIdx < totalDias - 1) {
          const proximoDia = listaDatas[diaIdx + 1];
          const proximoDiaFormatado = `${proximoDia.slice(8, 10)}/${proximoDia.slice(5, 7)}`;
          setProgresso(prev => ({
            ...prev,
            mensagem: `✅ ${diaFormatado} concluído! Avançando para ${proximoDiaFormatado}...`,
          }));
        }
      }
      // ================================================================
      // FIM DO LOOP DE DIAS
      // ================================================================

      // ================================================================
      // FINALIZAÇÃO
      // ================================================================
      const duracao_s = Math.floor((Date.now() - tempoInicio) / 1000);

      if (cancelarRef.current) {
        setProgresso(prev => ({
          ...prev,
          status: 'cancelado',
          mensagem: `Cancelado. ${totalNovas} novas encontradas.`,
          tempoDecorrido: duracao_s,
        }));
        
        await registrarExecucao('cancelado', {
          novas: totalNovas,
          duplicadas: totalDuplicadas,
          descartadas: totalDescartadas,
          duracao_s,
        });

        await supabase
          .from('configuracoes_monitoramento')
          .update({ 
            metadata: {
              status: 'cancelado',
              cancelado: true,
              total,
              current: lastProcessed,
              percentage: total > 0 ? Math.round((lastProcessed / total) * 100) : 0,
              duracao_s,
              novas: totalNovas,
              duplicadas: totalDuplicadas,
              descartadas: totalDescartadas,
              data_inicio: resolvedDataInicio,
              data_fim: resolvedDataFim,
              data_override: dataOverrideRef.current,
              run_key: runKey,
            } 
          })
          .eq('tipo', 'djen')
          .is('coordenacao_id', null);
      } else {
        setProgresso(prev => ({
          ...prev,
          monitoramentoAtual: total,
          status: 'concluido',
          mensagem: `Concluído! ${totalNovas} novas, ${totalDuplicadas} duplicadas, ${totalDescartadas} descartadas`,
          tempoDecorrido: duracao_s,
          termoAtual: undefined,
        }));

        await registrarExecucao('concluido', {
          novas: totalNovas,
          duplicadas: totalDuplicadas,
          descartadas: totalDescartadas,
          duracao_s,
        });

        await supabase
          .from('configuracoes_monitoramento')
          .update({ 
            metadata: {
              status: 'concluido',
              total,
              current: total,
              percentage: 100,
              duracao_s,
              novas: totalNovas,
              duplicadas: totalDuplicadas,
              descartadas: totalDescartadas,
              data_inicio: resolvedDataInicio,
              data_fim: resolvedDataFim,
              data_override: dataOverrideRef.current,
              run_key: runKey,
              last_run: new Date().toISOString(),
            } 
          })
          .eq('tipo', 'djen')
          .is('coordenacao_id', null);

        // Invalidar cache
        queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
        queryClient.invalidateQueries({ queryKey: ['djen-stats'] });
        queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] });

        if (totalNovas > 0) {
          toast.success(`DJEN: ${totalNovas} novas publicações encontradas!`);
        }
      }
    } catch (error: any) {
      console.error('[DJEN] Erro na execução:', error);
      
      setProgresso(prev => ({
        ...prev,
        status: 'erro',
        mensagem: `Erro: ${error?.message || 'Falha na execução'}`,
      }));

      await registrarExecucao('erro', {
        mensagem: error?.message || 'Erro desconhecido',
      });

      toast.error('Erro ao executar monitoramento DJEN');
    } finally {
      setExecutando(false);
      abortControllerRef.current = null;
      dataOverrideRef.current = null;
    }
  }, [user?.id, queryClient]);

  // Função para cancelar
  const cancelar = useCallback(async () => {
    cancelarRef.current = true;
    abortControllerRef.current?.abort();
    
    // Sinalizar cancelamento no banco
    try {
      const { data } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .is('coordenacao_id', null)
        .maybeSingle();

      const md = (data?.metadata as any) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({ 
          metadata: {
            ...md,
            cancel_requested: true,
          } 
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
    } catch (e) {
      console.warn('[DJEN] Erro ao sinalizar cancelamento:', e);
    }
    
    setProgresso(prev => ({
      ...prev,
      mensagem: 'Cancelando...',
    }));
  }, []);

  // Função para limpar estado
  const limparEstado = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProgresso(defaultProgresso());
  }, []);

  return {
    executarMonitoramento,
    cancelar,
    limparEstado,
    progresso,
    isExecutando: executando,
  };
}
