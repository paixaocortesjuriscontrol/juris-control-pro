import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DjenRun {
  id: string;
  run_id: string;
  iniciado_em: string;
  finalizado_em?: string;
  status: 'em_andamento' | 'concluido' | 'erro' | 'vazio_reexecutando';
  total_monitoramentos: number;
  processados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
  erros: number;
  total_paginas: number;
  total_resultados: number;
  duracao_segundos: number;
  retry_count: number;
  motivo_erro?: string;
  created_at: string;
}

interface DjenLote {
  id: string;
  run_id: string;
  lote_numero: number;
  offset_inicial: number;
  offset_final: number;
  iniciado_em: string;
  finalizado_em?: string;
  status: 'em_andamento' | 'concluido' | 'erro';
  processados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
  erros: number;
  total_paginas: number;
  total_resultados: number;
  duracao_segundos: number;
  erro_mensagem?: string;
  created_at: string;
}

interface DjenTribunalLote {
  id: string;
  lote_id: string;
  run_id: string;
  tribunal: string;
  termos_buscados: number;
  paginas: number;
  resultados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
  created_at: string;
}

export interface DjenRunDetails {
  run: DjenRun;
  lotes: DjenLote[];
  tribunais: DjenTribunalLote[];
}

export function useDjenRunsHistory() {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['djen-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('djen_runs')
        .select('*')
        .order('iniciado_em', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as DjenRun[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  return {
    runs,
    isLoading,
  };
}

export function useDjenRunDetails(runId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['djen-run-details', runId],
    queryFn: async (): Promise<DjenRunDetails | null> => {
      if (!runId) return null;

      // Fetch run details
      const { data: run, error: runError } = await supabase
        .from('djen_runs')
        .select('*')
        .eq('run_id', runId)
        .single();

      if (runError) throw runError;
      if (!run) return null;

      // Fetch lotes for this run
      const { data: lotes, error: lotesError } = await supabase
        .from('djen_lotes')
        .select('*')
        .eq('run_id', runId)
        .order('lote_numero');

      if (lotesError) throw lotesError;

      // Fetch tribunal stats for this run
      const { data: tribunais, error: tribunaisError } = await supabase
        .from('djen_tribunais_lote')
        .select('*')
        .eq('run_id', runId)
        .order('resultados', { ascending: false });

      if (tribunaisError) throw tribunaisError;

      return {
        run: run as DjenRun,
        lotes: (lotes || []) as DjenLote[],
        tribunais: (tribunais || []) as DjenTribunalLote[],
      };
    },
    enabled: !!runId,
  });

  return {
    runDetails: data,
    isLoading,
  };
}