import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TipoItemPromptIa } from "@/constants/promptsIaPublicacoes";

export type PromptIaPublicacao = {
  id: string;
  coordenacao_id: string;
  tipo_item: TipoItemPromptIa;
  prompt: string;
  ativo: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type PromptIaPublicacaoUpsert = {
  coordenacao_id: string;
  tipo_item: TipoItemPromptIa;
  prompt: string;
  ativo?: boolean;
};

const KEY = "prompts-ia-publicacoes";

export function usePromptsIaPublicacoes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompts_ia_publicacoes" as any)
        .select("*");
      if (error) throw error;
      return ((data as unknown) as PromptIaPublicacao[]) || [];
    },
  });
}

export function useUpsertPromptIaPublicacao() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: PromptIaPublicacaoUpsert) => {
      const insert = {
        ...payload,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      };
      const { data, error } = await supabase
        .from("prompts_ia_publicacoes" as any)
        .upsert(insert as any, { onConflict: "coordenacao_id,tipo_item" })
        .select("*")
        .single();
      if (error) throw error;
      return (data as unknown) as PromptIaPublicacao;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useDeletePromptIaPublicacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("prompts_ia_publicacoes" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}