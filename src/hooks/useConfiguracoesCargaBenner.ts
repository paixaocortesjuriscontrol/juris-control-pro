import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConfiguracaoCargaBenner {
  id?: string;
  coordenacao_id: string | null;
  email_padrao_para: string[];
  email_padrao_cc: string[];
  email_assunto_padrao: string;
  email_corpo_padrao: string;
  updated_at?: string;
}

const DEFAULT: ConfiguracaoCargaBenner = {
  coordenacao_id: null,
  email_padrao_para: [],
  email_padrao_cc: [],
  email_assunto_padrao: "Carga Benner - Remessa {numero}",
  email_corpo_padrao:
    "Prezados,\n\nSegue em anexo a remessa {numero} com {quantidade} dossiê(s).\n\nAtenciosamente.",
};

export function useConfiguracaoCargaBenner() {
  return useQuery({
    queryKey: ["configuracoes_carga_benner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_carga_benner" as any)
        .select("*")
        .is("coordenacao_id", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT;
      const r = data as any;
      return {
        id: r.id,
        coordenacao_id: r.coordenacao_id,
        email_padrao_para: r.email_padrao_para || [],
        email_padrao_cc: r.email_padrao_cc || [],
        email_assunto_padrao: r.email_assunto_padrao || DEFAULT.email_assunto_padrao,
        email_corpo_padrao: r.email_corpo_padrao || DEFAULT.email_corpo_padrao,
        updated_at: r.updated_at,
      } as ConfiguracaoCargaBenner;
    },
    staleTime: 60_000,
  });
}

export function useSalvarConfiguracaoCargaBenner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConfiguracaoCargaBenner) => {
      const payload = {
        coordenacao_id: null,
        email_padrao_para: input.email_padrao_para,
        email_padrao_cc: input.email_padrao_cc,
        email_assunto_padrao: input.email_assunto_padrao,
        email_corpo_padrao: input.email_corpo_padrao,
        updated_at: new Date().toISOString(),
      };
      if (input.id) {
        const { error } = await supabase
          .from("configuracoes_carga_benner" as any)
          .update(payload as any)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracoes_carga_benner" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["configuracoes_carga_benner"] });
      toast.success("Configurações salvas");
    },
    onError: (err: any) =>
      toast.error("Erro ao salvar: " + (err?.message || String(err))),
  });
}

export function aplicarPlaceholders(
  texto: string,
  vars: { numero?: string; quantidade?: number }
) {
  return (texto || "")
    .replace(/\{numero\}/g, vars.numero ?? "")
    .replace(/\{quantidade\}/g, String(vars.quantidade ?? ""));
}