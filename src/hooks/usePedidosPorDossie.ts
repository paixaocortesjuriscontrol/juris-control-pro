import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeMateriaNome } from "@/utils/outraMateria";

export interface PedidoPorDossie {
  id: string;
  dossie: string;
  pedido: string;
  pedido_normalizado: string;
}

/**
 * Pedidos (matérias) cadastrados para um dossiê específico, importados da
 * planilha "Pedidos por dossiê". Devolve também um Set normalizado para
 * comparação direta com os nomes das matérias selecionadas.
 */
export function usePedidosPorDossie(dossie: string | null | undefined) {
  const key = (dossie || "").trim();
  const query = useQuery({
    queryKey: ["pedidos-por-dossie", key],
    enabled: key.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PedidoPorDossie[]> => {
      const { data, error } = await supabase
        .from("pedidos_por_dossie" as any)
        .select("id, dossie, pedido, pedido_normalizado")
        .eq("dossie", key)
        .order("pedido")
        .limit(2000);
      if (error) throw error;
      return (data || []) as unknown as PedidoPorDossie[];
    },
  });

  const pedidos = query.data || [];
  const set = new Set<string>(
    pedidos.map((p) => p.pedido_normalizado || normalizeMateriaNome(p.pedido)),
  );

  return { pedidos, pedidosSet: set, loading: query.isLoading };
}
