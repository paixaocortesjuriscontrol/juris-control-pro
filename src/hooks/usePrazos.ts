import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Prazo = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_vencimento: string;
  status: "pendente" | "cumprido" | "atrasado";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  processo_id: string;
  responsavel_id: string | null;
  observacoes: string | null;
  data_cumprimento: string | null;
  created_at: string;
  processo: {
    id: string;
    numero: string;
    assunto: string | null;
  } | null;
  responsavel: {
    id: string;
    nome: string;
  } | null;
};

export function usePrazos() {
  return useQuery({
    queryKey: ["prazos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prazos")
        .select(`
          id,
          titulo,
          descricao,
          data_vencimento,
          status,
          prioridade,
          processo_id,
          responsavel_id,
          observacoes,
          data_cumprimento,
          created_at,
          processo:processos!prazos_processo_id_fkey(id, numero, assunto),
          responsavel:profiles!prazos_responsavel_id_fkey(id, nome)
        `)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return (data || []) as Prazo[];
    },
  });
}

export function useCreatePrazo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prazo: {
      titulo: string;
      descricao?: string;
      data_vencimento: string;
      prioridade: "baixa" | "media" | "alta" | "urgente";
      processo_id: string;
      responsavel_id?: string;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase
        .from("prazos")
        .insert({
          ...prazo,
          status: "pendente",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prazos"] });
      toast.success("Prazo criado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao criar prazo: " + error.message);
    },
  });
}

export function useUpdatePrazo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      titulo?: string;
      descricao?: string;
      data_vencimento?: string;
      status?: "pendente" | "cumprido" | "atrasado";
      prioridade?: "baixa" | "media" | "alta" | "urgente";
      responsavel_id?: string;
      observacoes?: string;
      data_cumprimento?: string;
    }) => {
      const { data, error } = await supabase
        .from("prazos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prazos"] });
      toast.success("Prazo atualizado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar prazo: " + error.message);
    },
  });
}

export function useDeletePrazo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prazos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prazos"] });
      toast.success("Prazo excluído com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir prazo: " + error.message);
    },
  });
}
