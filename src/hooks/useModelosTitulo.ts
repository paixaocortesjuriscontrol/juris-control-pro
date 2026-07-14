import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TipoModelo = "tarefa" | "prazo" | "audiencia" | "evento" | "parcela";

export interface ModeloTitulo {
  id: string;
  coordenacao_id: string;
  nome: string;
  tipo: TipoModelo;
  titulo: string;
  descricao: string | null;
  prioridade: string | null;
  ativo: boolean;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = ["modelos-titulo"];

export function useModelosTitulo(filtros?: { coordenacao_id?: string; tipo?: TipoModelo }) {
  return useQuery({
    queryKey: [...KEY, filtros],
    queryFn: async () => {
      let q = supabase.from("modelos_titulo_coordenacao").select("*").eq("ativo", true).order("nome");
      if (filtros?.coordenacao_id) q = q.eq("coordenacao_id", filtros.coordenacao_id);
      if (filtros?.tipo) q = q.eq("tipo", filtros.tipo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ModeloTitulo[];
    },
  });
}

export function useSaveModeloTitulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<ModeloTitulo> & { coordenacao_id: string; nome: string; tipo: TipoModelo; titulo: string }) => {
      if (m.id) {
        const { error } = await supabase.from("modelos_titulo_coordenacao").update(m).eq("id", m.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("modelos_titulo_coordenacao").insert({ ...m, criado_por: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: KEY }); toast.success("Modelo salvo"); },
    onError: (e: any) => toast.error("Erro: " + (e?.message ?? e)),
  });
}

export function useDeleteModeloTitulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modelos_titulo_coordenacao").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: KEY }); toast.success("Modelo removido"); },
    onError: (e: any) => toast.error("Erro: " + (e?.message ?? e)),
  });
}