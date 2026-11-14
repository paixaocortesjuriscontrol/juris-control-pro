import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import {
  montarOpcoesSituacoes,
  type RegraSituacaoPainel,
  type SituacaoFiltroOption,
} from "@/lib/situacoesPainel";

export { statusCasaSituacao } from "@/lib/situacoesPainel";
export type { SituacaoFiltroOption } from "@/lib/situacoesPainel";

/**
 * Situações disponíveis para os filtros e totalizadores do Painel de Controle.
 * Obedece à coluna Ativa de "Quem pode mudar cada situação" nas coordenações
 * do usuário. Quando uma coordenação é informada, considera somente ela.
 */
export function useSituacoesPainel(coordenacaoId?: string) {
  const { role } = useUserRole();
  const { isAdmin, coordenacoes, isLoading: coordLoading } = useCoordenacoesDoUsuario();
  const coordIds = coordenacaoId ? [coordenacaoId] : coordenacoes.map((c) => c.id);
  const coordKey = coordIds.slice().sort().join(",");

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ["situacoes-painel-config", coordKey],
    enabled: coordIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .select("coordenacao_id, situacao, tipo_tarefa, ativa")
        .in("coordenacao_id", coordIds);
      if (error) throw error;
      return (data || []) as RegraSituacaoPainel[];
    },
  });

  const options = useMemo<SituacaoFiltroOption[]>(
    () => montarOpcoesSituacoes(regras, coordIds),
    [regras, coordKey],
  );

  return {
    options,
    isAdmin,
    role,
    loading: coordLoading || (coordIds.length > 0 && isLoading),
  };
}
