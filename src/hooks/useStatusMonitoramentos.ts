import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";

export interface ExecucaoAgendada {
  id: string;
  tipo: string;
  job_name: string | null;
  status: 'iniciado' | 'executando' | 'concluido' | 'falhou' | 'timeout' | 'cancelado';
  agendado_para: string | null;
  iniciado_em: string;
  finalizado_em: string | null;
  lotes_processados: number;
  total_lotes: number | null;
  registros_processados: number;
  registros_encontrados: number;
  erros: number;
  ultimo_erro: string | null;
  detalhes: Record<string, any>;
  retry_count: number;
  created_at: string;
}

export interface StatusMonitoramento {
  tipo: string;
  ativo: boolean;
  frequencia: string;
  ultima_execucao_config: string | null;
  ultima_execucao: ExecucaoAgendada | null;
  execucoes_hoje: number;
  sucesso_hoje: number;
  falhas_hoje: number;
  encontrados_hoje: number;
  health_status: 'ok' | 'executando' | 'erro' | 'timeout_provavel' | 'atrasado' | 'nunca_executou';
}

const TIPOS_MONITORAMENTO = [
  { tipo: 'redistribuicoes', nome: 'Redistribuições', icon: 'RefreshCw' },
  { tipo: 'andamentos', nome: 'Andamentos', icon: 'Activity' },
  { tipo: 'distribuicoes', nome: 'Distribuições', icon: 'Globe' },
  { tipo: 'djen', nome: 'DJEN (Termos)', icon: 'Newspaper' },
  { tipo: 'djen_processos', nome: 'DJEN Processos', icon: 'FileSearch' },
  { tipo: 'termos', nome: 'Monitoração 360', icon: 'Radar' },
];

export function useStatusMonitoramentos() {
  // Busca configurações
  const { data: configuracoes = [], isLoading: loadingConfig } = useQuery({
    queryKey: ['configuracoes-monitoramento-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes_monitoramento')
        .select('*')
        .is('coordenacao_id', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });

  // Busca última execução de cada tipo
  const { data: ultimasExecucoes = [], isLoading: loadingExecucoes, refetch } = useQuery({
    queryKey: ['execucoes-agendadas-ultimas'],
    queryFn: async () => {
      // Buscar as últimas 2 execuções de cada tipo (para ter fallback)
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.warn('Erro ao buscar execuções:', error);
        return [];
      }
      return (data || []) as ExecucaoAgendada[];
    },
    staleTime: 10000,
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  // Busca execuções de hoje para estatísticas
  const { data: execucoesHoje = [] } = useQuery({
    queryKey: ['execucoes-agendadas-hoje'],
    queryFn: async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('tipo, status, registros_encontrados')
        .gte('created_at', hoje.toISOString());
      if (error) {
        console.warn('Erro ao buscar execuções de hoje:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 30000,
  });

  // Monta status consolidado
  const statusMonitoramentos: StatusMonitoramento[] = TIPOS_MONITORAMENTO.map(({ tipo, nome }) => {
    const config = configuracoes.find((c: any) => c.tipo === tipo);
    const execucoesDoTipo = ultimasExecucoes.filter((e) => e.tipo === tipo);
    const ultimaExecucao = execucoesDoTipo[0] || null;
    
    const execucoesHojeTipo = execucoesHoje.filter((e: any) => e.tipo === tipo);
    const sucesso_hoje = execucoesHojeTipo.filter((e: any) => e.status === 'concluido').length;
    const falhas_hoje = execucoesHojeTipo.filter((e: any) => e.status === 'falhou').length;
    const encontrados_hoje = execucoesHojeTipo.reduce((acc: number, e: any) => acc + (e.registros_encontrados || 0), 0);
    
    // Determinar health status
    let health_status: StatusMonitoramento['health_status'] = 'nunca_executou';
    
    if (ultimaExecucao) {
      const iniciado = new Date(ultimaExecucao.iniciado_em);
      const agora = new Date();
      const minutosDecorridos = (agora.getTime() - iniciado.getTime()) / 60000;
      
      if (ultimaExecucao.status === 'executando' && minutosDecorridos > 60) {
        health_status = 'timeout_provavel';
      } else if (ultimaExecucao.status === 'executando') {
        health_status = 'executando';
      } else if (ultimaExecucao.status === 'falhou' || ultimaExecucao.status === 'timeout') {
        health_status = 'erro';
      } else if (ultimaExecucao.status === 'concluido') {
        const horasDecorridas = minutosDecorridos / 60;
        health_status = horasDecorridas < 12 ? 'ok' : 'atrasado';
      }
    }
    
    return {
      tipo,
      ativo: config?.ativo ?? true,
      frequencia: config?.frequencia ?? 'diario',
      ultima_execucao_config: config?.ultima_execucao || null,
      ultima_execucao: ultimaExecucao,
      execucoes_hoje: execucoesHojeTipo.length,
      sucesso_hoje,
      falhas_hoje,
      encontrados_hoje,
      health_status,
    };
  });

  return {
    statusMonitoramentos,
    tiposMonitoramento: TIPOS_MONITORAMENTO,
    isLoading: loadingConfig || loadingExecucoes,
    refetch,
  };
}

export function useExecucoesRecentes(tipo?: string, limit = 20) {
  return useQuery({
    queryKey: ['execucoes-recentes', tipo, limit],
    queryFn: async () => {
      let query = supabase
        .from('execucoes_agendadas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (tipo) {
        query = query.eq('tipo', tipo);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ExecucaoAgendada[];
    },
    staleTime: 15000,
  });
}

export function formatarDataExecucao(data: string | null): string {
  if (!data) return 'Nunca';
  try {
    const zonedDate = toZonedTime(new Date(data), 'America/Sao_Paulo');
    return format(zonedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
}

export function formatarDuracao(segundos: number | null): string {
  if (!segundos) return '-';
  if (segundos < 60) return `${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  const segs = segundos % 60;
  return segs > 0 ? `${minutos}m ${segs}s` : `${minutos}m`;
}
