import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { consultarIndicadoresEmLotes } from "@/lib/consultaIndicadores";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { idsProcessosDosItens } from "@/lib/acompanhamentoEspecialItem";

/**
 * Conjunto de IDs de processo que estão em Acompanhamento Especial, entre os
 * processos dos itens informados. Usado para exibir a bolinha vermelha "A" nas
 * atividades sem depender de as telas carregarem o flag do processo.
 *
 * A consulta é feita em lotes cacheados (mesmo esquema das outras marcas),
 * então carregar mais páginas da agenda reaproveita os lotes já feitos.
 */
export function useProcessosAcompanhamento(itens: readonly any[] | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const ids = useMemo(() => idsProcessosDosItens(itens ?? []), [itens]);

  return useQuery({
    queryKey: ["processos-acompanhamento", ids, userId],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const resultado = new Set<string>();
      const linhas = await consultarIndicadoresEmLotes<{ id: string }>(
        queryClient,
        "processos-acompanhamento",
        [userId],
        ids,
        200,
        60_000,
        async (lote) => {
          const { data, error } = await (supabase as any)
            .from("processos")
            .select("id")
            .eq("acompanhamento_especial", true)
            .in("id", lote);
          if (error) throw error;
          return data ?? [];
        },
      );
      linhas.forEach((linha) => linha?.id && resultado.add(String(linha.id)));
      return resultado;
    },
  });
}
