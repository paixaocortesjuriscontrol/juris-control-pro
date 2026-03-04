import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook to manage the "incluir_nao_cadastrados" toggle in configuracoes_monitoramento (tipo='termos').
 * This controls whether the monitorar-termos edge function also scans DJEN publications
 * for processes NOT registered in the system.
 */
export function useNaoCadastradosConfig() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["config-termos-nao-cadastrados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_monitoramento")
        .select("id, metadata")
        .eq("tipo", "termos")
        .is("coordenacao_id", null)
        .maybeSingle();

      if (error) throw error;
      return {
        id: data?.id || null,
        incluir_nao_cadastrados: !!(data?.metadata as any)?.incluir_nao_cadastrados,
      };
    },
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (novoValor: boolean) => {
      // First get current metadata
      const { data: current, error: fetchError } = await supabase
        .from("configuracoes_monitoramento")
        .select("id, metadata")
        .eq("tipo", "termos")
        .is("coordenacao_id", null)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (current?.id) {
        const { error } = await supabase
          .from("configuracoes_monitoramento")
          .update({
            metadata: {
              ...(current.metadata as any),
              incluir_nao_cadastrados: novoValor,
            },
          })
          .eq("id", current.id);
        if (error) throw error;
      } else {
        // Create config if doesn't exist
        const { error } = await supabase
          .from("configuracoes_monitoramento")
          .insert({
            tipo: "termos",
            frequencia: "manual",
            ativo: true,
            metadata: { incluir_nao_cadastrados: novoValor },
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, novoValor) => {
      queryClient.invalidateQueries({ queryKey: ["config-termos-nao-cadastrados"] });
      toast.success(
        novoValor
          ? "Busca em processos não cadastrados ativada"
          : "Busca em processos não cadastrados desativada"
      );
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar configuração: ${error.message}`);
    },
  });

  return {
    ativo: data?.incluir_nao_cadastrados ?? false,
    loading: isLoading || toggleMutation.isPending,
    toggle: (valor: boolean) => toggleMutation.mutate(valor),
  };
}
