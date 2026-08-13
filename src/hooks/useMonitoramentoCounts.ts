import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEscopoAcompanhamentoEspecial } from "@/hooks/useEscopoAcompanhamentoEspecial";

/**
 * Contadores do menu Monitoramento:
 * - movimentacoes: eventos (movimentações) ainda não lidos no escopo do usuário
 * - divergencias: divergências Judit pendentes no escopo do usuário
 */
export function useMonitoramentoCounts() {
  const { processoIds, semRestricao, isLoading: escopoLoading } = useEscopoAcompanhamentoEspecial();

  const { data } = useQuery({
    queryKey: ["monitoramento-counts", semRestricao ? "all" : processoIds.join(",")],
    enabled: !escopoLoading,
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      if (!semRestricao && processoIds.length === 0) return { movimentacoes: 0, divergencias: 0 };

      let qEv = supabase
        .from("acompanhamento_especial_eventos")
        .select("id", { count: "exact", head: true })
        .is("lido_em", null);
      let qDiv = supabase
        .from("acompanhamento_especial_divergencias")
        .select("id", { count: "exact", head: true })
        .is("resolvido_em", null);

      if (!semRestricao) {
        qEv = qEv.in("processo_id", processoIds);
        qDiv = qDiv.in("processo_id", processoIds);
      }

      const [ev, div] = await Promise.all([qEv, qDiv]);
      return { movimentacoes: ev.count ?? 0, divergencias: div.count ?? 0 };
    },
  });

  const movimentacoes = data?.movimentacoes ?? 0;
  const divergencias = data?.divergencias ?? 0;

  return { movimentacoes, divergencias, total: movimentacoes + divergencias };
}
