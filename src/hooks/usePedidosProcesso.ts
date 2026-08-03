import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PedidoProcesso {
  id: string;
  processo_id: string;
  pedido: string;
  valor_pedido: number | null;
  lei: string | null;
  data: string | null;
  sentenca: boolean;
  juiz_sentenca: string | null;
  acordao: boolean;
  desembargador_turma: string | null;
  tst: boolean;
  ministro_turma_sessao: string | null;
  resultado_sentenca: string | null;
  resultado_recurso: string | null;
  turma: string | null;
  relator: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export function usePedidosProcesso(processoId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-processo", processoId],
    queryFn: async () => {
      if (!processoId) return [];
      const { data, error } = await supabase
        .from("pedidos_processo")
        .select("*")
        .eq("processo_id", processoId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as PedidoProcesso[];
    },
    enabled: !!processoId,
  });

  const totalValor = pedidos.reduce((sum, p) => sum + Number(p.valor_pedido || 0), 0);

  const addPedido = useMutation({
    mutationFn: async (pedido: Omit<PedidoProcesso, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("pedidos_processo")
        .insert(pedido)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-processo", processoId] });
      toast.success("Pedido adicionado");
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar pedido: ${error.message}`);
    },
  });

  const updatePedido = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PedidoProcesso> & { id: string }) => {
      const { error } = await supabase
        .from("pedidos_processo")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-processo", processoId] });
      toast.success("Pedido atualizado");
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar pedido: ${error.message}`);
    },
  });

  const addPedidosEmLote = useMutation({
    mutationFn: async (nomes: string[]) => {
      if (!processoId || nomes.length === 0) return;
      const rows = nomes.map((nome) => ({
        processo_id: processoId,
        pedido: nome,
        sentenca: false,
        acordao: false,
        tst: false,
      }));
      const { error } = await supabase.from("pedidos_processo").insert(rows);
      if (error) throw error;
      return nomes.length;
    },
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey: ["pedidos-processo", processoId] });
      toast.success(`${count ?? 0} pedido(s) adicionado(s)`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar pedidos: ${error.message}`);
    },
  });

  const _updatePedidoLegacy = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PedidoProcesso> & { id: string }) => {
      const { error } = await supabase
        .from("pedidos_processo")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-processo", processoId] });
    },
    onError: (error: any) => {
      console.error(error);
    },
  });

  const deletePedido = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pedidos_processo")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-processo", processoId] });
      toast.success("Pedido removido");
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover pedido: ${error.message}`);
    },
  });

  return {
    pedidos,
    isLoading,
    totalValor,
    addPedido,
    addPedidosEmLote,
    updatePedido,
    deletePedido,
  };
}
