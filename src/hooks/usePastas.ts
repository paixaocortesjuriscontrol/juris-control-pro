import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Pasta = {
  id: string;
  nome: string;
  descricao: string | null;
  cliente_id: string | null;
  coordenacao_id: string | null;
  criado_por: string;
  status: string;
  created_at: string;
  updated_at: string;
  cliente?: {
    id: string;
    nome: string;
  } | null;
  coordenacao?: {
    id: string;
    nome: string;
  } | null;
  _count?: {
    processos: number;
    documentos: number;
  };
};

export function usePastas() {
  return useQuery({
    queryKey: ["pastas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pastas")
        .select(`
          *,
          cliente:clientes(id, nome),
          coordenacao:coordenacoes(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get counts for each pasta
      const pastasWithCounts = await Promise.all(
        (data || []).map(async (pasta) => {
          const [processosResult, documentosResult] = await Promise.all([
            supabase.from("processos").select("id", { count: "exact" }).eq("pasta_id", pasta.id),
            supabase.from("documentos").select("id", { count: "exact" }).eq("pasta_id", pasta.id),
          ]);

          return {
            ...pasta,
            _count: {
              processos: processosResult.count || 0,
              documentos: documentosResult.count || 0,
            },
          };
        })
      );

      return pastasWithCounts as Pasta[];
    },
  });
}

export function usePasta(id: string | undefined) {
  return useQuery({
    queryKey: ["pasta", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("pastas")
        .select(`
          *,
          cliente:clientes(id, nome),
          coordenacao:coordenacoes(id, nome)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Pasta;
    },
    enabled: !!id,
  });
}

export function useCreatePasta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pasta: {
      nome: string;
      descricao?: string;
      cliente_id?: string;
      coordenacao_id?: string;
      criado_por: string;
    }) => {
      const { data, error } = await supabase
        .from("pastas")
        .insert(pasta)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastas"] });
      toast.success("Pasta criada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao criar pasta: " + error.message);
    },
  });
}

export function useUpdatePasta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      nome?: string;
      descricao?: string;
      cliente_id?: string | null;
      coordenacao_id?: string | null;
      status?: string;
    }) => {
      const { data, error } = await supabase
        .from("pastas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastas"] });
      toast.success("Pasta atualizada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar pasta: " + error.message);
    },
  });
}

export function useDeletePasta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pastas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastas"] });
      toast.success("Pasta excluída com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir pasta: " + error.message);
    },
  });
}

export function useVincularProcessoPasta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ processoId, pastaId }: { processoId: string; pastaId: string | null }) => {
      const { error } = await supabase
        .from("processos")
        .update({ pasta_id: pastaId })
        .eq("id", processoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastas"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      toast.success("Processo vinculado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao vincular processo: " + error.message);
    },
  });
}
