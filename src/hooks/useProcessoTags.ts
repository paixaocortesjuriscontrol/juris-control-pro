import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

export interface ProcessoTag {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  /** Quando false, apenas administradores enxergam a TAG. */
  publica?: boolean;
}

export function useProcessoTagsCatalogo() {
  const { isAdmin } = useUserRole();
  return useQuery({
    queryKey: ["processo-tags-catalogo", isAdmin ? "admin" : "user"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processo_tags_catalogo" as any)
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      const rows = (data as any[] as ProcessoTag[]) || [];
      // Defesa em profundidade: além do RLS, esconde TAGs restritas de não-admin.
      return isAdmin ? rows : rows.filter((t) => t.publica !== false);
    },
    staleTime: 10_000,
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
    mutationFn: async (input: string | { nome: string; cor?: string }) => {
      const nome = typeof input === "string" ? input : input.nome;
      const cor = typeof input === "string" ? undefined : input.cor;
      const clean = nome.trim();
      if (!clean) throw new Error("Nome obrigatório");
      const { data: userData } = await supabase.auth.getUser();
      const payload: any = { nome: clean, created_by: userData.user?.id };
      if (cor) payload.cor = cor;
      const { data, error } = await supabase
        .from("processo_tags_catalogo" as any)
        .insert(payload)
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

export function useAtualizarCorTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cor }: { id: string; cor: string }) => {
      const { data, error } = await supabase.rpc(
        "atualizar_cor_processo_tag" as any,
        { _tag_id: id, _cor: cor } as any,
      );
      if (error) throw error;
      const rows = (data as any[]) || [];
      if (rows.length === 0) {
        throw new Error("TAG não encontrada ou sem permissão");
      }
      return rows[0] as { id: string; cor: string };
    },
    onSuccess: async (row: any) => {
      // Atualiza o cache imediatamente para refletir a nova cor antes do refetch.
      qc.setQueryData<ProcessoTag[]>(["processo-tags-catalogo"], (old) =>
        (old || []).map((t) => (t.id === row.id ? { ...t, cor: row.cor } : t))
      );
      await qc.invalidateQueries({ queryKey: ["processo-tags-catalogo"] });
      toast.success("Cor atualizada");
    },
    onError: (err: any) => toast.error("Erro ao atualizar cor: " + (err?.message || "")),
  });
}

export function useRenomearTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const clean = nome.trim();
      if (!clean) throw new Error("Nome obrigatório");
      const { data, error } = await supabase
        .from("processo_tags_catalogo" as any)
        .update({ nome: clean } as any)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as any as ProcessoTag;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["processo-tags-catalogo"] });
      toast.success("Tag renomeada");
    },
    onError: (err: any) => toast.error("Erro ao renomear tag: " + (err?.message || "")),
  });
}

/** Marca/desmarca a TAG como pública (visível a todos). Somente admin. */
export function useAtualizarVisibilidadeTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, publica }: { id: string; publica: boolean }) => {
      const { data, error } = await supabase.rpc(
        "atualizar_visibilidade_processo_tag" as any,
        { _tag_id: id, _publica: publica } as any,
      );
      if (error) throw error;
      const rows = (data as any[]) || [];
      if (rows.length === 0) throw new Error("TAG não encontrada ou sem permissão");
      return rows[0] as { id: string; publica: boolean };
    },
    onSuccess: async (row: any) => {
      qc.setQueryData<ProcessoTag[]>(["processo-tags-catalogo"], (old) =>
        (old || []).map((t) => (t.id === row.id ? { ...t, publica: row.publica } : t)),
      );
      await qc.invalidateQueries({ queryKey: ["processo-tags-catalogo"] });
      toast.success(row.publica ? "TAG pública (todos podem ver)" : "TAG restrita ao administrador");
    },
    onError: (err: any) => toast.error("Erro ao alterar visibilidade: " + (err?.message || "")),
  });
}

export function useRemoverTodasTagsDoDado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dadoId: string) => {
      const { error } = await supabase
        .from("dados_benner_processo_tags" as any)
        .delete()
        .eq("dado_benner_id", dadoId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dados-benner-tags"] });
      toast.success("Todas as TAGs removidas");
    },
    onError: (err: any) => toast.error("Erro ao remover TAGs: " + (err?.message || "")),
  });
}

export const TAG_COLOR_PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#ec4899", // pink
  "#f43f5e", // rose
  "#6b7280", // gray
];

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
      .select("dado_benner_id, dados_benner!inner(aba_origem)")
      .eq("tag_id", tagId)
      .not("dados_benner.aba_origem", "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as any[]) || [];
    for (const r of rows) all.push(r.dado_benner_id);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return Array.from(new Set(all));
}