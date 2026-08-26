import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MateriaPedidoOficial {
  id: string;
  nome: string;
  ativo: boolean;
}

/**
 * Lista oficial de pedidos/matérias (tabela materias_pedidos_oficiais),
 * espelho da coluna "Pedido" da planilha de dicionário do Santander.
 */
export function useMateriasPedidosOficiais() {
  return useQuery({
    queryKey: ["materias-pedidos-oficiais"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MateriaPedidoOficial[]> => {
      const { data, error } = await supabase
        .from("materias_pedidos_oficiais" as any)
        .select("id, nome, ativo")
        .eq("ativo", true)
        .order("nome")
        .limit(2000);
      if (error) throw error;
      return (data || []) as unknown as MateriaPedidoOficial[];
    },
  });
}
