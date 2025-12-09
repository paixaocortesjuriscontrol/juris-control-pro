import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Documento = {
  id: string;
  nome: string;
  tipo: string | null;
  url: string | null;
  tamanho_bytes: number | null;
  processo_id: string | null;
  uploaded_by: string | null;
  created_at: string;
  processo: {
    id: string;
    numero: string;
    assunto: string | null;
  } | null;
  uploader: {
    id: string;
    nome: string;
  } | null;
};

export function useDocumentos() {
  return useQuery({
    queryKey: ["documentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select(`
          id,
          nome,
          tipo,
          url,
          tamanho_bytes,
          processo_id,
          uploaded_by,
          created_at,
          processo:processos!documentos_processo_id_fkey(id, numero, assunto),
          uploader:profiles!documentos_uploaded_by_fkey(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Documento[];
    },
  });
}

export function useCreateDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documento: {
      nome: string;
      tipo?: string;
      url?: string;
      tamanho_bytes?: number;
      processo_id?: string;
      uploaded_by: string;
    }) => {
      const { data, error } = await supabase
        .from("documentos")
        .insert(documento)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      toast.success("Documento cadastrado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar documento: " + error.message);
    },
  });
}

export function useUpdateDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      nome?: string;
      tipo?: string;
      processo_id?: string;
    }) => {
      const { data, error } = await supabase
        .from("documentos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      toast.success("Documento atualizado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar documento: " + error.message);
    },
  });
}

export function useDeleteDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      toast.success("Documento excluído com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir documento: " + error.message);
    },
  });
}
