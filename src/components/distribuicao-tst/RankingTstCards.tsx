import { useMemo } from "react";
import { DistribuicaoTstStatsCards } from "@/components/distribuicao-tst/DistribuicaoTstStatsCards";
import { useDistribuicaoTstStats } from "@/hooks/useDistribuicaoTstStats";
import { useProntoSemPendenciaCount } from "@/hooks/useProntoSemPendenciaCount";
import type { DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";

interface Props {
  /** Quando informado, os cards mostram apenas os processos desse responsável. */
  responsavelId?: string | null;
}

/**
 * Cards totalizadores da tela Distribuição TST reaproveitados no Ranking de
 * Atendimento (aba TST). Sem filtro de período: refletem toda a base, igual à
 * tela de Distribuição TST. Ao selecionar um profissional no ranking, os cards
 * passam a considerar somente os processos daquele responsável.
 */
export function RankingTstCards({ responsavelId }: Props) {
  const filters: DistribuicaoTstFilters = useMemo(
    () => (responsavelId ? { responsavelIds: [responsavelId] } : {}),
    [responsavelId]
  );

  const { stats, loading } = useDistribuicaoTstStats(filters);
  const { count: prontoSemPendenciaCount, loading: prontoSemPendenciaLoading } =
    useProntoSemPendenciaCount(filters);

  return (
    <DistribuicaoTstStatsCards
      stats={stats}
      loading={loading}
      prontoSemPendencia={{ count: prontoSemPendenciaCount, loading: prontoSemPendenciaLoading }}
      prontoComPendencia={{
        count: Math.max(0, (stats.prontoEnvio ?? 0) - prontoSemPendenciaCount),
        loading: prontoSemPendenciaLoading || loading,
      }}
      multiRespCard={null}
    />
  );
}
