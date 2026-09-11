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
    queryKey: [
      "monitoramento-counts",
      semRestricao ? "all" : `${processoIds.length}:${processoIds.slice(0, 5).join(",")}`,
    ],
    enabled: !escopoLoading,
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      if (!semRestricao && processoIds.length === 0) return { movimentacoes: 0, divergencias: 0 };

      if (semRestricao) {
        const [ev, div] = await Promise.all([
          supabase
            .from("acompanhamento_especial_eventos")
            .select("id", { count: "exact", head: true })
            .is("lido_em", null),
          supabase
            .from("acompanhamento_especial_divergencias")
            .select("id", { count: "exact", head: true })
            .is("resolvido_em", null),
        ]);
        return { movimentacoes: ev.count ?? 0, divergencias: div.count ?? 0 };
      }

      // Escopo restrito: quebrar em lotes para não estourar o tamanho da URL
      const CHUNK = 150;
      let movimentacoes = 0;
      let divergencias = 0;

      for (let i = 0; i < processoIds.length; i += CHUNK) {
        const lote = processoIds.slice(i, i + CHUNK);
        const [ev, div] = await Promise.all([
          supabase
            .from("acompanhamento_especial_eventos")
            .select("id", { count: "exact", head: true })
            .is("lido_em", null)
            .in("processo_id", lote),
          supabase
            .from("acompanhamento_especial_divergencias")
            .select("id", { count: "exact", head: true })
            .is("resolvido_em", null)
            .in("processo_id", lote),
        ]);
        movimentacoes += ev.count ?? 0;
        divergencias += div.count ?? 0;
      }

      return { movimentacoes, divergencias };
    },
  });


  const movimentacoes = data?.movimentacoes ?? 0;
  const divergencias = data?.divergencias ?? 0;

  return { movimentacoes, divergencias, total: movimentacoes + divergencias };
}
