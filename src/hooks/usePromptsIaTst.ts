import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PromptIaTst = {
  id: string;
  coordenacao_id: string;
  titulo: string;
  prompt: string;
  descricao: string | null;
  modelo: string;
  ativo: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type PromptIaTstInsert = {
  coordenacao_id: string;
  titulo: string;
  prompt: string;
  descricao?: string | null;
  modelo?: string;
  ativo?: boolean;
};

const KEY = "prompts-ia-tst";

/** Lista prompts visíveis pelo usuário (RLS filtra por coordenação). */
export function usePromptsIaTst(opts?: { somenteAtivos?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.id, opts?.somenteAtivos ?? false],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("prompts_ia_tst" as any)
        .select("*")
        .order("titulo", { ascending: true });
      if (opts?.somenteAtivos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return ((data as unknown) as PromptIaTst[]) || [];
    },
  });
}

export function useCreatePromptIaTst() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: PromptIaTstInsert) => {
      const insert = { ...payload, created_by: user?.id ?? null, updated_by: user?.id ?? null };
      const { data, error } = await supabase
        .from("prompts_ia_tst" as any)
        .insert(insert as any)
        .select("*")
        .single();
      if (error) throw error;
      return (data as unknown) as PromptIaTst;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useUpdatePromptIaTst() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PromptIaTstInsert> }) => {
      const { data, error } = await supabase
        .from("prompts_ia_tst" as any)
        .update(patch as any)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return (data as unknown) as PromptIaTst;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useDeletePromptIaTst() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prompts_ia_tst" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export const MODELOS_GEMINI = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro — Análise Jurídica (recomendado)" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview, raciocínio avançado)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (rápido, padrão)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (mais barato)" },
];