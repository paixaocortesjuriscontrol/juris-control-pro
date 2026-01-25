import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Main type - using Tarefa as main name, Prazo as alias
export type Tarefa = {
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
  criado_por: string | null;
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

// Alias for backwards compatibility
export type Prazo = Tarefa;

export type TarefasFilters = {
  status?: string;
  prioridade?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  coordenacaoId?: string;
};

// Alias for backwards compatibility
export type PrazosFilters = TarefasFilters;

export type TarefasResult = {
  data: Tarefa[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// Alias for backwards compatibility
export type PrazosResult = TarefasResult;

export function useTarefasPaginated(filters?: TarefasFilters) {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  return useQuery({
    queryKey: ["tarefas-paginated", filters],
    queryFn: async (): Promise<TarefasResult> => {
      // Build select with or without inner join on processos
      const selectFields = filters?.coordenacaoId
        ? `
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
          criado_por,
          processo:processos!inner(id, numero, assunto, coordenacao_id),
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
        `
        : `
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
          criado_por,
          processo:processos!tarefas_processo_id_fkey(id, numero, assunto),
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
        `;

      const today = new Date().toISOString().split("T")[0];
      
      let query = supabase
        .from("tarefas")
        .select(selectFields, { count: "exact" })
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .range(from, to);

      // Apply coordination filter
      if (filters?.coordenacaoId) {
        query = query.eq("processo.coordenacao_id", filters.coordenacaoId);
      }

      // Apply server-side filters
      if (filters?.status && filters.status !== "all") {
        if (filters.status === "atrasado") {
          // Atrasado = not cumprido AND data_vencimento < today
          query = query.neq("status", "cumprido").lt("data_vencimento", today);
        } else {
          query = query.eq("status", filters.status as "pendente" | "cumprido" | "atrasado");
        }
      }
      if (filters?.prioridade && filters.prioridade !== "all") {
        query = query.eq("prioridade", filters.prioridade as "baixa" | "media" | "alta" | "urgente");
        // For urgente, also filter out cumprido
        if (filters.prioridade === "urgente") {
          query = query.neq("status", "cumprido");
        }
      }
      if (filters?.search) {
        query = query.ilike("titulo", `%${filters.search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      const totalCount = count || 0;
      
      return {
        data: (data || []) as unknown as Tarefa[],
        count: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    },
  });
}

// Alias for backwards compatibility
export const usePrazosPaginated = useTarefasPaginated;

// Keep the old hook for calendar view and backwards compatibility
export function useTarefas(filters?: TarefasFilters) {
  const limit = 500;
  
  return useQuery({
    queryKey: ["tarefas", filters],
    queryFn: async () => {
      let query = supabase
        .from("tarefas")
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
          criado_por,
          processo:processos!tarefas_processo_id_fkey(id, numero, assunto),
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
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
      return (data || []) as unknown as Tarefa[];
    },
  });
}

// Alias for backwards compatibility
export const usePrazos = useTarefas;

export function useTarefasStats(coordenacaoId?: string) {
  return useQuery({
    queryKey: ["tarefas-stats", coordenacaoId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      
      if (coordenacaoId) {
        // With coordination filter - need to join with processos
        const [pendentesRes, cumpridosRes, atrasadosRes, urgentesRes] = await Promise.all([
          supabase
            .from("tarefas")
            .select("id, processos!inner(coordenacao_id)", { count: "exact", head: true })
            .eq("processos.coordenacao_id", coordenacaoId)
            .eq("status", "pendente")
            .gte("data_vencimento", today),
          supabase
            .from("tarefas")
            .select("id, processos!inner(coordenacao_id)", { count: "exact", head: true })
            .eq("processos.coordenacao_id", coordenacaoId)
            .eq("status", "cumprido"),
          supabase
            .from("tarefas")
            .select("id, processos!inner(coordenacao_id)", { count: "exact", head: true })
            .eq("processos.coordenacao_id", coordenacaoId)
            .neq("status", "cumprido")
            .lt("data_vencimento", today),
          supabase
            .from("tarefas")
            .select("id, processos!inner(coordenacao_id)", { count: "exact", head: true })
            .eq("processos.coordenacao_id", coordenacaoId)
            .eq("prioridade", "urgente")
            .neq("status", "cumprido"),
        ]);

        return {
          pendentes: pendentesRes.count || 0,
          cumpridos: cumpridosRes.count || 0,
          atrasados: atrasadosRes.count || 0,
          urgentes: urgentesRes.count || 0,
        };
      }
      
      // Without coordination filter
      const [pendentesRes, cumpridosRes, atrasadosRes, urgentesRes] = await Promise.all([
        supabase
          .from("tarefas")
          .select("*", { count: "exact", head: true })
          .eq("status", "pendente")
          .gte("data_vencimento", today),
        supabase
          .from("tarefas")
          .select("*", { count: "exact", head: true })
          .eq("status", "cumprido"),
        supabase
          .from("tarefas")
          .select("*", { count: "exact", head: true })
          .neq("status", "cumprido")
          .lt("data_vencimento", today),
        supabase
          .from("tarefas")
          .select("*", { count: "exact", head: true })
          .eq("prioridade", "urgente")
          .neq("status", "cumprido"),
      ]);

      return {
        pendentes: pendentesRes.count || 0,
        cumpridos: cumpridosRes.count || 0,
        atrasados: atrasadosRes.count || 0,
        urgentes: urgentesRes.count || 0,
      };
    },
    staleTime: 30000, // 30 seconds cache
  });
}

// Alias for backwards compatibility
export const usePrazosStats = useTarefasStats;

export function useCreateTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tarefa: {
      titulo: string;
      descricao?: string;
      data_vencimento?: string;
      prioridade: "baixa" | "media" | "alta" | "urgente";
      processo_id?: string | null;
      responsavel_id?: string;
      observacoes?: string;
      criado_por?: string;
    }) => {
      const { data, error } = await supabase
        .from("tarefas")
        .insert({
          ...tarefa,
          status: "pendente",
        })
        .select()
        .single();

      if (error) throw error;

      // Disparar notificação para o responsável via edge function (fire and forget)
      if (data && tarefa.responsavel_id) {
        try {
          supabase.functions.invoke("notificar-tarefa-criada", {
            body: {
              tarefa_id: data.id,
              titulo: tarefa.titulo,
              descricao: tarefa.descricao,
              data_vencimento: tarefa.data_vencimento,
              prioridade: tarefa.prioridade,
              processo_id: tarefa.processo_id,
              responsavel_id: tarefa.responsavel_id,
            },
          }).catch((err) => console.log("Erro ao notificar tarefa (ignorado):", err));
        } catch {
          // Ignora erro de notificação, não impede a criação
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-stats"] });
      toast.success("Tarefa criada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao criar tarefa: " + error.message);
    },
  });
}

// Alias for backwards compatibility
export const useCreatePrazo = useCreateTarefa;

export function useUpdateTarefa() {
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
        .from("tarefas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-stats"] });
      toast.success("Tarefa atualizada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar tarefa: " + error.message);
    },
  });
}

// Alias for backwards compatibility
export const useUpdatePrazo = useUpdateTarefa;

export function useDeleteTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-stats"] });
      toast.success("Tarefa excluída com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir tarefa: " + error.message);
    },
  });
}

// Alias for backwards compatibility
export const useDeletePrazo = useDeleteTarefa;
