import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RepositorioDocumento = {
  id: string;
  nome: string;
  nome_original: string;
  categoria: string;
  descricao: string | null;
  tipo_documento: string | null;
  tags: string[] | null;
  tamanho_bytes: number | null;
  mime_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  processado: boolean;
  erro_processamento: string | null;
  created_at: string;
  updated_at: string;
};

export function useRepositorioDocumentos() {
  return useQuery({
    queryKey: ["repositorio-documentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repositorio_documentos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as RepositorioDocumento[];
    },
  });
}

export function useUploadRepositorioDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      nome,
      categoria,
      descricao,
      tipo_documento,
      tags,
      userId,
    }: {
      file: File;
      nome: string;
      categoria: string;
      descricao?: string;
      tipo_documento?: string;
      tags?: string[];
      userId: string;
    }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${userId}/${fileName}`;

      // Upload para storage
      const { error: uploadError } = await supabase.storage
        .from("repositorio_documentos")
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Inserir metadados
      const { data, error } = await supabase
        .from("repositorio_documentos")
        .insert({
          nome,
          nome_original: file.name,
          categoria,
          descricao,
          tipo_documento,
          tags,
          tamanho_bytes: file.size,
          mime_type: file.type,
          storage_path: storagePath,
          uploaded_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositorio-documentos"] });
      toast.success("Documento enviado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao enviar documento: " + error.message);
    },
  });
}

export function useUpdateRepositorioDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      nome?: string;
      categoria?: string;
      descricao?: string;
      tipo_documento?: string;
      tags?: string[];
    }) => {
      const { data, error } = await supabase
        .from("repositorio_documentos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositorio-documentos"] });
      toast.success("Documento atualizado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar documento: " + error.message);
    },
  });
}

export function useDeleteRepositorioDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      // Deletar do storage
      const { error: storageError } = await supabase.storage
        .from("repositorio_documentos")
        .remove([storagePath]);

      if (storageError) {
        console.error("Erro ao deletar arquivo do storage:", storageError);
      }

      // Deletar metadados
      const { error } = await supabase
        .from("repositorio_documentos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositorio-documentos"] });
      toast.success("Documento excluído com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir documento: " + error.message);
    },
  });
}

// Categorias disponíveis
export const CATEGORIAS_DOCUMENTO = [
  { value: "modelo", label: "Modelo de Documento" },
  { value: "peca_processual", label: "Peça Processual" },
  { value: "jurisprudencia", label: "Jurisprudência" },
  { value: "legislacao", label: "Legislação" },
  { value: "parecer", label: "Parecer" },
  { value: "contrato", label: "Contrato" },
  { value: "procuracao", label: "Procuração" },
  { value: "outros", label: "Outros" },
];

export const TIPOS_DOCUMENTO = [
  { value: "peticao_inicial", label: "Petição Inicial" },
  { value: "contestacao", label: "Contestação" },
  { value: "recurso", label: "Recurso" },
  { value: "agravo", label: "Agravo" },
  { value: "embargos", label: "Embargos" },
  { value: "manifestacao", label: "Manifestação" },
  { value: "acordo", label: "Acordo" },
  { value: "contrato_prestacao", label: "Contrato de Prestação de Serviços" },
  { value: "contrato_trabalho", label: "Contrato de Trabalho" },
  { value: "contrato_locacao", label: "Contrato de Locação" },
  { value: "contrato_compra_venda", label: "Contrato de Compra e Venda" },
  { value: "contrato_honorarios", label: "Contrato de Honorários" },
  { value: "procuracao_ad_judicia", label: "Procuração Ad Judicia" },
  { value: "substabelecimento", label: "Substabelecimento" },
  { value: "notificacao_extrajudicial", label: "Notificação Extrajudicial" },
  { value: "declaracao", label: "Declaração" },
  { value: "requerimento", label: "Requerimento" },
  { value: "certidao", label: "Certidão" },
  { value: "formulario", label: "Formulário" },
  { value: "relatorio", label: "Relatório" },
  { value: "outro", label: "Outro" },
];
