import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProcessoCoordenacaoResponsavel {
  id: string;
  coordenacao_id: string;
  principal: boolean;
  coordenacao?: { id: string; nome: string } | null;
}

/**
 * Coordenações responsáveis por um processo.
 * O processo é visível para todas as coordenações; esta lista define apenas
 * quem responde por ele (uma ou mais coordenações).
 */
export function useProcessoCoordenacoes(processoId?: string | null) {
  return useQuery({
    queryKey: ["processo-coordenacoes", processoId],
    enabled: !!processoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_coordenacoes_responsaveis")
        .select("id, coordenacao_id, principal, coordenacao:coordenacoes(id, nome)")
        .eq("processo_id", processoId!);
      if (error) throw error;
      return (data || []) as unknown as ProcessoCoordenacaoResponsavel[];
    },
  });
}

export function useSetProcessoCoordenacoes(processoId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (coordenacaoIds: string[]) => {
      if (!processoId) return;

      const { data: atuais, error: errAtuais } = await supabase
        .from("processos_coordenacoes_responsaveis")
        .select("id, coordenacao_id")
        .eq("processo_id", processoId);
      if (errAtuais) throw errAtuais;

      const atuaisIds = (atuais || []).map((a: any) => a.coordenacao_id as string);
      const paraAdicionar = coordenacaoIds.filter((c) => !atuaisIds.includes(c));
      const paraRemover = (atuais || []).filter(
        (a: any) => !coordenacaoIds.includes(a.coordenacao_id)
      );

      if (paraAdicionar.length > 0) {
        const { error } = await supabase
          .from("processos_coordenacoes_responsaveis")
          .insert(
            paraAdicionar.map((coordenacao_id) => ({
              processo_id: processoId,
              coordenacao_id,
              principal: false,
            })) as any
          );
        if (error) throw error;
      }

      if (paraRemover.length > 0) {
        const { error } = await supabase
          .from("processos_coordenacoes_responsaveis")
          .delete()
          .in(
            "id",
            paraRemover.map((r: any) => r.id)
          );
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["processo-coordenacoes", processoId] });
      await queryClient.invalidateQueries({ queryKey: ["processos-paginados"] });
    },
  });
}
