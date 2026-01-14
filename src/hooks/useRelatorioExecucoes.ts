import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExecucaoMonitoramento {
  id: string;
  tipo: string;
  executado_em: string;
  processos_verificados: number;
  novos_andamentos: number;
  processos_com_novos: number;
  erros: number;
  detalhes: any;
  created_at: string;
}

export interface DjenRun {
  id: string;
  run_id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  status: string;
  total_monitoramentos: number | null;
  processados: number | null;
  novas: number | null;
  descartadas: number | null;
  duplicatas: number | null;
  erros: number | null;
  total_paginas: number | null;
  total_resultados: number | null;
  duracao_segundos: number | null;
  retry_count: number | null;
  motivo_erro: string | null;
  created_at: string;
}

export function useRelatorioExecucoes(
  dataInicio: string | null,
  dataFim: string | null,
  tiposFiltro: string[]
) {
  // Busca histórico unificado de monitoramento
  const historicoQuery = useQuery({
    queryKey: ['relatorio-execucoes-historico', dataInicio, dataFim, tiposFiltro],
    queryFn: async () => {
      let query = supabase
        .from('historico_monitoramento')
        .select('*')
        .order('executado_em', { ascending: false });

      if (dataInicio) {
        query = query.gte('executado_em', dataInicio);
      }
      if (dataFim) {
        query = query.lte('executado_em', dataFim + 'T23:59:59');
      }
      if (tiposFiltro.length > 0) {
        query = query.in('tipo', tiposFiltro);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data as ExecucaoMonitoramento[];
    },
    enabled: true,
  });

  // Busca runs do DJEN (tabela separada com mais detalhes)
  const djenRunsQuery = useQuery({
    queryKey: ['relatorio-execucoes-djen-runs', dataInicio, dataFim],
    queryFn: async () => {
      let query = supabase
        .from('djen_runs')
        .select('*')
        .order('iniciado_em', { ascending: false });

      if (dataInicio) {
        query = query.gte('iniciado_em', dataInicio);
      }
      if (dataFim) {
        query = query.lte('iniciado_em', dataFim + 'T23:59:59');
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as DjenRun[];
    },
    enabled: tiposFiltro.length === 0 || tiposFiltro.includes('djen'),
  });

  // Estatísticas agregadas
  const estatisticas = {
    totalExecucoes: (historicoQuery.data?.length || 0) + (djenRunsQuery.data?.length || 0),
    execucoesSucesso: (historicoQuery.data?.filter(h => h.erros === 0).length || 0) +
      (djenRunsQuery.data?.filter(r => r.status === 'completed').length || 0),
    execucoesErro: (historicoQuery.data?.filter(h => h.erros > 0).length || 0) +
      (djenRunsQuery.data?.filter(r => r.status === 'error').length || 0),
    totalItensProcessados: (historicoQuery.data?.reduce((acc, h) => acc + h.processos_verificados, 0) || 0) +
      (djenRunsQuery.data?.reduce((acc, r) => acc + (r.processados || 0), 0) || 0),
    totalNovosEncontrados: (historicoQuery.data?.reduce((acc, h) => acc + h.novos_andamentos, 0) || 0) +
      (djenRunsQuery.data?.reduce((acc, r) => acc + (r.novas || 0), 0) || 0),
  };

  // Agrupa por tipo para exibição
  const porTipo = {
    andamentos: historicoQuery.data?.filter(h => h.tipo === 'andamentos') || [],
    redistribuicoes: historicoQuery.data?.filter(h => h.tipo === 'redistribuicoes') || [],
    djen_processos: historicoQuery.data?.filter(h => h.tipo === 'djen_processos') || [],
    djen: djenRunsQuery.data || [],
    termos: historicoQuery.data?.filter(h => h.tipo === 'termos') || [],
    distribuicoes: historicoQuery.data?.filter(h => h.tipo === 'distribuicoes') || [],
  };

  return {
    historico: historicoQuery.data,
    djenRuns: djenRunsQuery.data,
    isLoading: historicoQuery.isLoading || djenRunsQuery.isLoading,
    estatisticas,
    porTipo,
  };
}

// Hook para buscar detalhes de um DJEN run específico
export function useDjenRunLotes(runId: string | null) {
  return useQuery({
    queryKey: ['djen-run-lotes', runId],
    queryFn: async () => {
      if (!runId) return [];
      
      const { data, error } = await supabase
        .from('djen_lotes')
        .select('*')
        .eq('run_id', runId)
        .order('lote_numero', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!runId,
  });
}
