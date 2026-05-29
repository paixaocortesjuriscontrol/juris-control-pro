import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProcessoTag {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
}

export function useProcessoTagsCatalogo() {
  return useQuery({
    queryKey: ["processo-tags-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processo_tags_catalogo" as any)
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data as any[] as ProcessoTag[]) || [];
    },
    staleTime: 60_000,
  });
}

/** Carrega o mapa { dado_benner_id => tagIds[] } para uma lista de ids. */
export function useTagsForDados(dadoIds: string[]) {
  const key = JSON.stringify([...dadoIds].sort());
  return useQuery({
    queryKey: ["dados-benner-tags", key],
    enabled: dadoIds.length > 0,
    queryFn: async () => {
      const map = new Map<string, string[]>();
      if (dadoIds.length === 0) return map;
      // chunk em 500 para evitar URL gigante
      const CHUNK = 500;
      for (let i = 0; i < dadoIds.length; i += CHUNK) {
        const slice = dadoIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("dados_benner_processo_tags" as any)
          .select("dado_benner_id, tag_id")
          .in("dado_benner_id", slice);
        if (error) throw error;
        for (const r of (data as any[]) || []) {
          const arr = map.get(r.dado_benner_id) || [];
          arr.push(r.tag_id);
          map.set(r.dado_benner_id, arr);
        }
      }
      return map;
    },
  });
}

export function useCriarTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const clean = nome.trim();
      if (!clean) throw new Error("Nome obrigatório");
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("processo_tags_catalogo" as any)
        .insert({ nome: clean, created_by: userData.user?.id } as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as any as ProcessoTag;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processo-tags-catalogo"] });
      toast.success("Tag criada");
    },
    onError: (err: any) => toast.error("Erro ao criar tag: " + (err?.message || "")),
  });
}

export function useToggleTagInDado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dadoId,
      tagId,
      checked,
    }: { dadoId: string; tagId: string; checked: boolean }) => {
      if (checked) {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("dados_benner_processo_tags" as any)
          .insert({ dado_benner_id: dadoId, tag_id: tagId, created_by: userData.user?.id } as any);
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("dados_benner_processo_tags" as any)
          .delete()
          .eq("dado_benner_id", dadoId)
          .eq("tag_id", tagId);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dados-benner-tags"] });
    },
    onError: (err: any) => toast.error("Erro ao atualizar tag: " + (err?.message || "")),
  });
}

/** Retorna os ids de dados_benner que possuem a tag indicada. */
export async function fetchDadoIdsByTag(tagId: string): Promise<string[]> {
  const all: string[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("dados_benner_processo_tags" as any)
      .select("dado_benner_id")
      .eq("tag_id", tagId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as any[]) || [];
    for (const r of rows) all.push(r.dado_benner_id);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return Array.from(new Set(all));
}