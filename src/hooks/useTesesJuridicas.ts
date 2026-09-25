import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type TipoPeca = "contestacao" | "recurso_ordinario" | "contrarrazoes" | "peticao_inicial" | "memoriais" | "outros";
export type AreaTese = "trabalhista" | "civil" | "empresarial" | "direito_privado";

export interface TeseJuridica {
  id: string;
  coordenacao_id: string | null;
  titulo: string;
  tipo_peca: TipoPeca;
  area: AreaTese;
  materia: string | null;
  assunto_cnj: string | null;
  fundamentos: string;
  tipo_recurso: string | null;
  tags: string[] | null;
  ativo: boolean;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeseInsert {
  coordenacao_id?: string | null;
  titulo: string;
  tipo_peca: TipoPeca;
  area: AreaTese;
  materia?: string | null;
  assunto_cnj?: string | null;
  fundamentos?: string;
  tipo_recurso?: string | null;
  tags?: string[] | null;
  ativo?: boolean;
}

const KEY = "teses-juridicas";

export function useTesesJuridicas(filtros?: { coordenacao_id?: string; tipo_peca?: TipoPeca; area?: AreaTese }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, user?.id, filtros],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("teses_juridicas" as any).select("*").order("titulo", { ascending: true });
      if (filtros?.coordenacao_id) q = q.eq("coordenacao_id", filtros.coordenacao_id);
      if (filtros?.tipo_peca) q = q.eq("tipo_peca", filtros.tipo_peca);
      if (filtros?.area) q = q.eq("area", filtros.area);
      const { data, error } = await q;
      if (error) throw error;
      return ((data as unknown) as TeseJuridica[]) ?? [];
    },
  });
}

export function useSaveTeseJuridica() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (tese: TeseInsert & { id?: string }) => {
      const payload = { ...tese, criado_por: user?.id ?? null };
      if (tese.id) {
        const { data, error } = await supabase
          .from("teses_juridicas" as any)
          .update(payload)
          .eq("id", tese.id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("teses_juridicas" as any)
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      toast.success("Tese salva");
    },
    onError: (e: any) => toast.error("Erro ao salvar tese: " + e.message),
  });
}

export function useDeleteTeseJuridica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teses_juridicas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      toast.success("Tese excluída");
    },
    onError: (e: any) => toast.error("Erro ao excluir: " + e.message),
  });
}

export function usePecasGeradas(processoId?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pecas-geradas", processoId],
    enabled: !!user && !!processoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pecas_geradas" as any)
        .select("*")
        .eq("processo_id", processoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMarcarPecaRevisada() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, revisado }: { id: string; revisado: boolean }) => {
      const { error } = await supabase
        .from("pecas_geradas" as any)
        .update({
          revisado,
          revisado_por: revisado ? user?.id ?? null : null,
          revisado_em: revisado ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["pecas-geradas"] });
      toast.success(vars.revisado ? "Peça marcada como revisada" : "Revisão desfeita");
    },
    onError: (e: any) => toast.error("Erro ao atualizar: " + e.message),
  });
}

export function useSalvarConteudoPeca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, conteudo }: { id: string; conteudo: string }) => {
      const { error } = await supabase
        .from("pecas_geradas" as any)
        .update({ conteudo, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pecas-geradas"] });
      toast.success("Peça salva");
    },
    onError: (e: any) => toast.error("Erro ao salvar peça: " + e.message),
  });
}

export function useExcluirPeca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pecas_geradas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pecas-geradas"] });
      toast.success("Peça excluída");
    },
    onError: (e: any) => toast.error("Erro ao excluir: " + e.message),
  });
}

export function useGerarPecaJuridica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      processoId: string;
      tipoPeca: TipoPeca;
      teseId?: string | null;
      observacoes?: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("gerar-peca-juridica", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pecas-geradas"] });
      toast.success("Peça gerada");
    },
    onError: (e: any) => toast.error("Erro ao gerar peça: " + e.message),
  });
}

export function useBuscarTesesAplicaveis(processoId?: string | null, tipoPeca?: TipoPeca) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["teses-aplicaveis", processoId, tipoPeca],
    enabled: !!user && !!processoId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("buscar_teses_aplicaveis", {
        p_processo_id: processoId,
        p_tipo_peca: tipoPeca ?? null,
        p_limite: 5,
      });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
}
