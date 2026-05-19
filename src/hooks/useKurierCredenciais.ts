import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface KurierCredencial {
  id: string;
  login: string;
  senha_encrypted: string | null;
  ativo: boolean;
  prioridade: number;
  ultimo_uso: string | null;
  ultimo_status: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

const QK = ["kurier-credenciais"] as const;

export function useKurierCredenciais() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kurier_credenciais")
        .select("*")
        .order("prioridade", { ascending: false })
        .order("login");
      if (error) throw error;
      return (data ?? []) as KurierCredencial[];
    },
    staleTime: 30_000,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<KurierCredencial> }) => {
      const { error } = await (supabase as any).from("kurier_credenciais").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: any) => toast.error(`Falha ao atualizar: ${e.message ?? e}`),
  });

  const create = useMutation({
    mutationFn: async (login: string) => {
      const { error } = await (supabase as any).from("kurier_credenciais").insert({ login, ativo: false });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QK });
      toast.success("Login adicionado");
    },
    onError: (e: any) => toast.error(`Falha ao adicionar: ${e.message ?? e}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("kurier_credenciais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QK });
      toast.success("Login removido");
    },
    onError: (e: any) => toast.error(`Falha ao remover: ${e.message ?? e}`),
  });

  const salvarSenha = useMutation({
    mutationFn: async ({ id, senha }: { id: string; senha: string }) => {
      const { data, error } = await supabase.functions.invoke("kurier-salvar-senha", {
        body: { credencial_id: id, senha },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QK });
      toast.success("Senha salva");
    },
    onError: (e: any) => toast.error(`Falha ao salvar senha: ${e.message ?? e}`),
  });

  const testar = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("kurier-testar-credencial", {
        body: { credencial_id: id },
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: QK });
      if (data?.ok) toast.success(`Kurier OK — ${data.total ?? "?"} publicações pendentes`);
      else toast.error(`Kurier falhou: ${data?.erro ?? "ver detalhes"}`);
    },
    onError: (e: any) => toast.error(`Erro: ${e.message ?? e}`),
  });

  return { ...query, update, create, remove, salvarSenha, testar };
}