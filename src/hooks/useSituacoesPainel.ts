import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { situacoesBase, TipoSituacaoItem } from "@/constants/situacoesItem";

const TIPOS: TipoSituacaoItem[] = ["prazo", "tarefa", "audiencia", "parcelamento", "evento"];

/** Mapa tipo do formulário -> chave gravada em permissoes_situacao_tipo_tarefa */
const TIPO_KEY: Record<TipoSituacaoItem, string> = {
  prazo: "PRAZO",
  tarefa: "TAREFA",
  audiencia: "AUDIENCIA",
  parcelamento: "PARCELAMENTO RECORRENTE",
  evento: "EVENTO",
};

export interface SituacaoFiltroOption {
  /** Valores possíveis gravados no status do item (pipe-joined) */
  value: string;
  label: string;
  valores: string[];
}

/** Confere se o status do item bate com a opção selecionada no filtro */
export function statusCasaSituacao(status: string | null | undefined, value: string): boolean {
  const s = (status ?? "").toLowerCase();
  return value.split("|").some((v) => v === s);
}

/**
 * Situações disponíveis para os filtros do Painel de Controle.
 * Obedece a configuração "Quem pode mudar cada situação" (coluna Ativa) das
 * coordenações do usuário logado, sem duplicar rótulos.
 */
export function useSituacoesPainel() {
  const { role } = useUserRole();
  const { isAdmin, coordenacoes, isLoading: coordLoading } = useCoordenacoesDoUsuario();
  const coordIds = coordenacoes.map((c) => c.id);

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ["situacoes-painel-config", coordIds.slice().sort().join(",")],
    enabled: coordIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .select("situacao, tipo_tarefa, ativa")
        .in("coordenacao_id", coordIds);
      if (error) throw error;
      return (data || []) as { situacao: string; tipo_tarefa: string; ativa: boolean | null }[];
    },
  });

  const options = useMemo<SituacaoFiltroOption[]>(() => {
    const tiposConfigurados = new Set(regras.map((r) => (r.tipo_tarefa || "").trim().toUpperCase()));

    // Situação ativa: se existe configuração para o tipo e a situação está
    // marcada como inativa, ela não entra. Sem configuração => liberada.
    const ativa = (tipo: TipoSituacaoItem, valor: string) => {
      const key = TIPO_KEY[tipo];
      if (!tiposConfigurados.has(key)) return true;
      const linhas = regras.filter(
        (r) => (r.tipo_tarefa || "").trim().toUpperCase() === key && r.situacao === valor,
      );
      if (linhas.length === 0) return true;
      return linhas.some((r) => r.ativa !== false);
    };

    const porLabel = new Map<string, SituacaoFiltroOption>();
    for (const tipo of TIPOS) {
      for (const s of situacoesBase(tipo)) {
        if (!ativa(tipo, s.value)) continue;
        const existente = porLabel.get(s.label);
        if (existente) {
          if (!existente.valores.includes(s.value)) existente.valores.push(s.value);
        } else {
          porLabel.set(s.label, { label: s.label, value: s.value, valores: [s.value] });
        }
      }
    }

    return Array.from(porLabel.values()).map((o) => ({ ...o, value: o.valores.join("|") }));
  }, [regras]);

  return {
    options,
    isAdmin,
    role,
    loading: coordLoading || isLoading,
  };
}
