import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DistribuicaoTstFilters } from "./useDistribuicoesTst";

export interface DistribuicaoTstStats {
  total: number;
  processosUnicos: number;
  processosValidos: number;
  processosInvalidos: number;
  dossiesValidos: number;
  dossiesInvalidos: number;
  dossiesNaoPreenchidos: number;
  juditPreenchido: number;
  juditNaoPreenchido: number;
  bennerSim: number;
  bennerNao: number;
  processosAtivos: number;
  transitoJulgado: number;
  outrosSituacao: number;
  semTurma: number;
  problemaJudit: number;
  ate2025: number;
  de2026: number;
  prontoEnvio: number;
  semResponsavel: number;
  comEquipe: number;
  semEquipe: number;
  aFazer: number;
  naoPrecisaFazer: number;
}

const ZERO: DistribuicaoTstStats = {
  total: 0,
  processosUnicos: 0,
  processosValidos: 0,
  processosInvalidos: 0,
  dossiesValidos: 0,
  dossiesInvalidos: 0,
  dossiesNaoPreenchidos: 0,
  juditPreenchido: 0,
  juditNaoPreenchido: 0,
  bennerSim: 0,
  bennerNao: 0,
  processosAtivos: 0,
  transitoJulgado: 0,
  outrosSituacao: 0,
  semTurma: 0,
  problemaJudit: 0,
  ate2025: 0,
  de2026: 0,
  prontoEnvio: 0,
  semResponsavel: 0,
  comEquipe: 0,
  semEquipe: 0,
  aFazer: 0,
  naoPrecisaFazer: 0,
};

export function useDistribuicaoTstStats(filters: DistribuicaoTstFilters) {
  const [stats, setStats] = useState<DistribuicaoTstStats>(ZERO);
  const [loading, setLoading] = useState(false);
  // Flag para diferenciar "ainda não carregou" de "carregou e veio vazio".
  // Em caso de erro transitório (auth refresh, timeout de rede, etc.) NÃO
  // zeramos os cards — mantemos o último valor válido para evitar o flash
  // de "0" reportado pela Kellen.
  const [loadedOnce, setLoadedOnce] = useState(false);

  const filtersKey = JSON.stringify(filters);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "get_distribuicao_tst_stats" as any,
        { filters: filters as any }
      );
      if (error) {
        // Erro de RPC: não sobrescreve com zeros. Mantém último valor válido.
        console.warn("[useDistribuicaoTstStats] RPC falhou, mantendo valores anteriores:", error);
        return;
      }
      const row: any = Array.isArray(data) ? data[0] : data;
      if (!row) {
        // Resposta sem linhas: só zera na primeira carga; depois mantém.
        if (!loadedOnce) setStats(ZERO);
        return;
      }
      setStats({
        total: Number(row.total) || 0,
        processosUnicos: Number(row.processos_unicos) || 0,
        processosValidos: Number(row.processos_validos) || 0,
        processosInvalidos: Number(row.processos_invalidos) || 0,
        dossiesValidos: Number(row.dossies_validos) || 0,
        dossiesInvalidos: Number(row.dossies_invalidos) || 0,
        dossiesNaoPreenchidos: Number(row.dossies_nao_preenchidos) || 0,
        juditPreenchido: Number(row.judit_preenchido) || 0,
        juditNaoPreenchido: Number(row.judit_nao_preenchido) || 0,
        bennerSim: Number(row.benner_sim) || 0,
        bennerNao: Number(row.benner_nao) || 0,
        processosAtivos: Number(row.processos_ativos) || 0,
        transitoJulgado: Number(row.transito_julgado) || 0,
        outrosSituacao: Number(row.outros_situacao) || 0,
        semTurma: Number(row.sem_turma) || 0,
        problemaJudit: Number(row.problema_judit) || 0,
        ate2025: Number(row.ate_2025) || 0,
        de2026: Number(row.de_2026) || 0,
        prontoEnvio: Number(row.pronto_envio) || 0,
        semResponsavel: Number(row.sem_responsavel) || 0,
        comEquipe: Number(row.com_equipe) || 0,
        semEquipe: Number(row.sem_equipe) || 0,
        aFazer: Number(row.a_fazer) || 0,
        naoPrecisaFazer: Number(row.nao_precisa_fazer) || 0,
      });
      setLoadedOnce(true);
    } catch (err) {
      console.warn("[useDistribuicaoTstStats] exceção, mantendo valores anteriores:", err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, loadedOnce]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
