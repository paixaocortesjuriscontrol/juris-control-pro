import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SituacaoEnvioCarga {
  id: string;
  codigo: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export function useSituacoesEnvioCarga() {
  return useQuery({
    queryKey: ["situacoes-envio-carga"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("situacoes_envio_carga" as any)
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data as any[] as SituacaoEnvioCarga[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}