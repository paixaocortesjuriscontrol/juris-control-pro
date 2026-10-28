import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PainelTotais = {
  tarefa: number; ata: number; evento: number; prazo: number; audiencia: number; parcelamento: number;
};

const dia = (d?: Date) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;

/** Monta os parâmetros da contagem no banco a partir dos filtros da agenda do Painel. */
export function parametrosPainelTotais(filters: any) {
  const coords: string[] = filters.coordenacaoIds?.length
    ? filters.coordenacaoIds
    : filters.coordenacaoId ? [filters.coordenacaoId] : [];
  return {
    dataInicio: dia(filters.dataInicio),
    dataFim: dia(filters.dataFim),
    fetchAll: !!filters.fetchAll,
    coordenacaoIds: coords,
    responsavelIds: filters.responsavelIds ?? [],
  };
}

/**
 * Totais em aberto dos cartões, calculados no banco (como na Distribuição TST).
 * Aparecem logo; a contagem exata da agenda substitui quando ela termina de carregar.
 */
export function usePainelTotais(filters: any, enabled: boolean, userId?: string) {
  const params = parametrosPainelTotais(filters);
  return useQuery({
    queryKey: ["agenda-unificada", "painel-totais", userId, JSON.stringify(params)],
    enabled: enabled && !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<PainelTotais> => {
      const { data, error } = await (supabase as any).rpc("get_painel_totais", { filters: params });
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) ?? {};
      return {
        tarefa: Number(r.tarefa ?? 0), ata: Number(r.ata ?? 0), evento: Number(r.evento ?? 0),
        prazo: Number(r.prazo ?? 0), audiencia: Number(r.audiencia ?? 0), parcelamento: Number(r.parcelamento ?? 0),
      };
    },
  });
}
