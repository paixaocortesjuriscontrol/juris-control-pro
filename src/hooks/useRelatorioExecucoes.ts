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

export interface DjenLote {
  id: string;
  run_id: string;
  lote_numero: number;
  offset_inicial: number;
  offset_final: number;
  status: string;
  processados: number | null;
  novas: number | null;
  descartadas: number | null;
  duplicatas: number | null;
  erros: number | null;
  total_paginas: number | null;
  total_resultados: number | null;
  duracao_segundos: number | null;
  iniciado_em: string;
  finalizado_em: string | null;
  erro_mensagem: string | null;
  created_at: string;
}

export interface DjenTribunalLote {
  id: string;
  lote_id: string;
  run_id: string;
  tribunal: string;
  termos_buscados: number | null;
  paginas: number | null;
  resultados: number | null;
  novas: number | null;
  descartadas: number | null;
  duplicatas: number | null;
  created_at: string;
}

export interface EstatisticasTermo {
  termo_busca: string;
  tipo: string;
  tribunais: string[];
  total_publicacoes: number;
  coordenacao_id: string | null;
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
      return data as DjenLote[];
    },
    enabled: !!runId,
  });
}

// Hook para buscar detalhes por tribunal de um lote
export function useDjenTribunaisLote(loteId: string | null) {
  return useQuery({
    queryKey: ['djen-tribunais-lote', loteId],
    queryFn: async () => {
      if (!loteId) return [];
      
      const { data, error } = await supabase
        .from('djen_tribunais_lote')
        .select('*')
        .eq('lote_id', loteId)
        .order('novas', { ascending: false });

      if (error) throw error;
      return data as DjenTribunalLote[];
    },
    enabled: !!loteId,
  });
}

// Hook para estatísticas de publicações por termo e tribunal no período
export function useEstatisticasDjenPeriodo(dataInicio: string | null, dataFim: string | null) {
  // Estatísticas por termo
  const estatisticasTermosQuery = useQuery({
    queryKey: ['estatisticas-djen-termos', dataInicio, dataFim],
    queryFn: async () => {
      let query = supabase
        .from('publicacoes_djen')
        .select(`
          id,
          data_publicacao,
          monitoramento_id,
          monitoramentos_djen!inner(termo_busca, tipo, tribunais, coordenacao_id)
        `);

      if (dataInicio) {
        query = query.gte('created_at', dataInicio);
      }
      if (dataFim) {
        query = query.lte('created_at', dataFim + 'T23:59:59');
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupa por termo
      const porTermo: Record<string, EstatisticasTermo> = {};
      data?.forEach((p: any) => {
        const termo = p.monitoramentos_djen?.termo_busca || 'Desconhecido';
        if (!porTermo[termo]) {
          porTermo[termo] = {
            termo_busca: termo,
            tipo: p.monitoramentos_djen?.tipo || '',
            tribunais: p.monitoramentos_djen?.tribunais || [],
            total_publicacoes: 0,
            coordenacao_id: p.monitoramentos_djen?.coordenacao_id,
          };
        }
        porTermo[termo].total_publicacoes++;
      });

      return Object.values(porTermo).sort((a, b) => b.total_publicacoes - a.total_publicacoes);
    },
    enabled: true,
  });

  // Estatísticas por tribunal (extraído do fonte das publicações)
  const estatisticasTribunaisQuery = useQuery({
    queryKey: ['estatisticas-djen-tribunais', dataInicio, dataFim],
    queryFn: async () => {
      let query = supabase
        .from('publicacoes_djen')
        .select('id, fonte, processo_numero');

      if (dataInicio) {
        query = query.gte('created_at', dataInicio);
      }
      if (dataFim) {
        query = query.lte('created_at', dataFim + 'T23:59:59');
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupa por tribunal extraído do número do processo
      const porTribunal: Record<string, number> = {};
      data?.forEach((p: any) => {
        // Tenta extrair tribunal do número do processo
        let tribunal = 'Desconhecido';
        if (p.processo_numero) {
          const match = p.processo_numero.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\./);
          if (match) {
            const justica = match[1];
            const tribunalNum = match[2];
            if (justica === '5') tribunal = `TRT${tribunalNum}`;
            else if (justica === '4') tribunal = `TRF${tribunalNum}`;
            else if (justica === '8') tribunal = `TJ${tribunalNum}`;
            else tribunal = `J${justica}-${tribunalNum}`;
          }
        }
        porTribunal[tribunal] = (porTribunal[tribunal] || 0) + 1;
      });

      return Object.entries(porTribunal)
        .map(([tribunal, total]) => ({ tribunal, total }))
        .sort((a, b) => b.total - a.total);
    },
    enabled: true,
  });

  return {
    porTermo: estatisticasTermosQuery.data || [],
    porTribunal: estatisticasTribunaisQuery.data || [],
    isLoading: estatisticasTermosQuery.isLoading || estatisticasTribunaisQuery.isLoading,
  };
}

// Hook para buscar coordenações
export function useCoordenacoes() {
  return useQuery({
    queryKey: ['coordenacoes-lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coordenacoes')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data;
    },
  });
}
