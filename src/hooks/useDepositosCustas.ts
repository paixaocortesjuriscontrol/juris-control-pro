import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DepositoRecursal {
  id: string;
  processo_id: string;
  data_pagamento: string;
  titulo: string;
  valor: number;
  observacoes?: string | null;
  created_at: string;
}

export interface CustaProcessual {
  id: string;
  processo_id: string;
  data_pagamento: string;
  descricao: string;
  valor: number;
  observacoes?: string | null;
  created_at: string;
}

export function useDepositosRecursais(processoId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: depositos = [], isLoading } = useQuery({
    queryKey: ["depositos-recursais", processoId],
    queryFn: async () => {
      if (!processoId) return [];
      const { data, error } = await supabase
        .from("depositos_recursais")
        .select("*")
        .eq("processo_id", processoId)
        .order("data_pagamento", { ascending: false });

      if (error) throw error;
      return data as DepositoRecursal[];
    },
    enabled: !!processoId,
  });

  const total = depositos.reduce((sum, d) => sum + Number(d.valor || 0), 0);

  const addDeposito = useMutation({
    mutationFn: async (deposito: Omit<DepositoRecursal, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("depositos_recursais")
        .insert(deposito)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depositos-recursais", processoId] });
      toast.success("Depósito recursal adicionado");
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar depósito: ${error.message}`);
    },
  });

  const updateDeposito = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DepositoRecursal> & { id: string }) => {
      const { error } = await supabase
        .from("depositos_recursais")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depositos-recursais", processoId] });
      toast.success("Depósito atualizado");
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar depósito: ${error.message}`);
    },
  });

  const deleteDeposito = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("depositos_recursais")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depositos-recursais", processoId] });
      toast.success("Depósito removido");
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover depósito: ${error.message}`);
    },
  });

  return {
    depositos,
    isLoading,
    total,
    addDeposito,
    updateDeposito,
    deleteDeposito,
  };
}

export function useCustasProcessuais(processoId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: custas = [], isLoading } = useQuery({
    queryKey: ["custas-processuais", processoId],
    queryFn: async () => {
      if (!processoId) return [];
      const { data, error } = await supabase
        .from("custas_processuais")
        .select("*")
        .eq("processo_id", processoId)
        .order("data_pagamento", { ascending: false });

      if (error) throw error;
      return data as CustaProcessual[];
    },
    enabled: !!processoId,
  });

  const total = custas.reduce((sum, c) => sum + Number(c.valor || 0), 0);

  const addCusta = useMutation({
    mutationFn: async (custa: Omit<CustaProcessual, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("custas_processuais")
        .insert(custa)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custas-processuais", processoId] });
      toast.success("Custa adicionada");
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar custa: ${error.message}`);
    },
  });

  const updateCusta = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustaProcessual> & { id: string }) => {
      const { error } = await supabase
        .from("custas_processuais")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custas-processuais", processoId] });
      toast.success("Custa atualizada");
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar custa: ${error.message}`);
    },
  });

  const deleteCusta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("custas_processuais")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custas-processuais", processoId] });
      toast.success("Custa removida");
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover custa: ${error.message}`);
    },
  });

  return {
    custas,
    isLoading,
    total,
    addCusta,
    updateCusta,
    deleteCusta,
  };
}
