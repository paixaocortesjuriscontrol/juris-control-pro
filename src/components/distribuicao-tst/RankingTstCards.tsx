import { useMemo } from "react";
import { DistribuicaoTstStatsCards, type StatsCardKey } from "@/components/distribuicao-tst/DistribuicaoTstStatsCards";
import { useDistribuicaoTstStats } from "@/hooks/useDistribuicaoTstStats";
import { useProntoSemPendenciaCount } from "@/hooks/useProntoSemPendenciaCount";
import type { DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";

interface Props {
  /** Quando informado, os cards mostram apenas os processos desse responsável. */
  responsavelId?: string | null;
  /** Cards atualmente ativos (podem ser vários, combinados em AND). */
  cardKeys?: StatsCardKey[];
  /** Clique em um card/número. */
  onCardClick?: (key: StatsCardKey) => void;
}

/**
 * Converte os cards clicados nos MESMOS filtros aplicados pela tela
 * Distribuição TST (`handleCardClick`), para que os números respondam ao
 * clique exatamente como lá: filtros combináveis e clique novamente desliga.
 */
function filtersFromCards(keys: StatsCardKey[]): DistribuicaoTstFilters {
  const f: DistribuicaoTstFilters = {};
  for (const key of keys) {
    switch (key) {
      case "processosValidos": f.processoStatus = "valido"; break;
      case "processosInvalidos": f.processoStatus = "invalido"; break;
      case "dossiesValidos": f.dossieStatus = "valido"; break;
      case "dossiesInvalidos": f.dossieStatus = "invalido_ou_nao_preenchido"; break;
      case "juditPreenchido": f.judit = "sim"; break;
      case "juditNaoPreenchido": f.judit = "nao"; break;
      case "bennerSim": f.benner = "sim"; break;
      case "bennerNao": f.benner = "nao"; break;
      case "processosAtivos": f.situacaoProcesso = "ativo"; break;
      case "transitoJulgado": f.situacaoProcesso = "transito"; break;
      case "aFazer": f.situacaoProcesso = "a_fazer"; break;
      case "naoPrecisaFazer": f.situacaoProcesso = "nao_precisa_fazer"; break;
      case "comMateria": f.pedidosDossie = "com"; break;
      case "semMateria": f.pedidosDossie = "sem"; break;
      case "problemaJudit": f.problemaJudit = "sim"; break;
      case "semTurma": f.semTurma = true; break;
      case "ate2025": f.dataFim = "2025-12-31"; break;
      case "de2026": f.dataInicio = "2026-01-01"; break;
      case "prontoEnvio": f.status = "concluidos"; break;
      case "prontoSemPendencia":
        f.status = "concluidos";
        f.semPendencia = "sem";
        break;
      case "prontoComPendencia":
        f.status = "concluidos";
        f.semPendencia = "com";
        break;
      case "revisarListaMaterias":
        f.status = "concluidos";
        f.revisarListaMaterias = "sim";
        break;
      case "comEquipe": f.equipe = "sim"; break;
      case "semEquipe": f.equipe = "nao"; break;
      default: break;
    }
  }
  return f;
}

/**
 * Cards totalizadores da tela Distribuição TST reaproveitados no Ranking de
 * Atendimento (aba TST). Sem filtro de período: refletem toda a base, igual à
 * tela de Distribuição TST. Ao selecionar um profissional no ranking, os cards
 * passam a considerar somente os processos daquele responsável. O clique nos
 * números funciona igual à tela Distribuição TST: aplica/remove o filtro do
 * card e os demais totais passam a refletir esse recorte.
 */
export function RankingTstCards({ responsavelId, cardKeys, onCardClick }: Props) {
  const keys = cardKeys ?? [];
  const keysKey = keys.join(",");

  const filters: DistribuicaoTstFilters = useMemo(
    () => ({
      ...filtersFromCards(keys),
      ...(responsavelId ? { responsavelIds: [responsavelId] } : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keysKey, responsavelId]
  );

  const { stats, loading } = useDistribuicaoTstStats(filters);
  const { count: prontoSemPendenciaCount, loading: prontoSemPendenciaLoading } =
    useProntoSemPendenciaCount(filters);

  const comPendencia = keys.includes("prontoComPendencia")
    ? (stats.prontoEnvio ?? 0)
    : Math.max(0, (stats.prontoEnvio ?? 0) - prontoSemPendenciaCount);

  return (
    <DistribuicaoTstStatsCards
      stats={stats}
      loading={loading}
      activeKeys={keys.length > 0 ? keys : ["total"]}
      onCardClick={onCardClick}
      prontoSemPendencia={{ count: prontoSemPendenciaCount, loading: prontoSemPendenciaLoading }}
      prontoComPendencia={{ count: comPendencia, loading: prontoSemPendenciaLoading || loading }}
      multiRespCard={null}
    />
  );
}
