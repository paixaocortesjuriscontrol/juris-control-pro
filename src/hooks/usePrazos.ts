import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Prazo = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_vencimento: string | null;
  status: "pendente" | "cumprido" | "atrasado";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  processo_id: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
  data_cumprimento: string | null;
  created_at: string;
  // Projuris fields
  identificador_projuris?: string | null;
  tipo_tarefa?: string | null;
  data_base?: string | null;
  data_fatal?: string | null;
  criado_por_nome?: string | null;
  concluido_por_nome?: string | null;
  grupos_trabalho?: string | null;
  marcadores?: string | null;
  quadro_kanban?: string | null;
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

export type PrazosFilters = {
  status?: string;
  prioridade?: string;
  search?: string;
  limit?: number;
};

export function usePrazos(filters?: PrazosFilters) {
  const limit = filters?.limit ?? 500; // Default limit for performance
  
  return useQuery({
    queryKey: ["prazos", filters],
    queryFn: async () => {
      let query = supabase
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
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .limit(limit);

      // Apply server-side filters
      if (filters?.status && filters.status !== "all" && filters.status !== "atrasado") {
        query = query.eq("status", filters.status as "pendente" | "cumprido" | "atrasado");
      }
      if (filters?.prioridade && filters.prioridade !== "all") {
        query = query.eq("prioridade", filters.prioridade as "baixa" | "media" | "alta" | "urgente");
      }
      if (filters?.search) {
        query = query.ilike("titulo", `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Prazo[];
    },
  });
}

export function usePrazosCount() {
  return useQuery({
    queryKey: ["prazos-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("prazos")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return count || 0;
    },
  });
}

export function useCreatePrazo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prazo: {
      titulo: string;
      descricao?: string;
      data_vencimento?: string;
      prioridade: "baixa" | "media" | "alta" | "urgente";
      processo_id?: string;
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
      queryClient.invalidateQueries({ queryKey: ["prazos-count"] });
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
      queryClient.invalidateQueries({ queryKey: ["prazos-count"] });
      toast.success("Prazo excluído com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir prazo: " + error.message);
    },
  });
}
