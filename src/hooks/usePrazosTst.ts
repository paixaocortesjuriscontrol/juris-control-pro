import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PrazoTst {
  id: string;
  coordenacao_id: string | null;
  processo_id: string | null;
  numero_processo: string | null;
  dossie: string | null;
  reu: string | null;
  autor: string | null;
  equipe: string | null;
  decisao: string | null;
  formulario: string | null;
  providencias: string | null;
  deposito_judicial: string | null;
  preparo: string | null;
  multa_custas: string | null;
  responsavel: string | null;
  data_fatal: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type PrazoTstInsert = Omit<PrazoTst, "id" | "created_at" | "updated_at" | "status">;

export function usePrazosTst(coordenacaoId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["prazos-tst", coordenacaoId],
    queryFn: async () => {
      let q = supabase.from("prazos_tst").select("*").order("data_fatal", { ascending: true });
      if (coordenacaoId) {
        q = q.eq("coordenacao_id", coordenacaoId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as PrazoTst[];
    },
    enabled: !!coordenacaoId,
  });

  const createMutation = useMutation({
    mutationFn: async (prazo: PrazoTstInsert) => {
      const { data, error } = await supabase.from("prazos_tst").insert(prazo as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prazos-tst"] });
      toast.success("Prazo cadastrado com sucesso");
    },
    onError: (e: any) => toast.error("Erro ao cadastrar prazo: " + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PrazoTst> & { id: string }) => {
      const { error } = await supabase.from("prazos_tst").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prazos-tst"] });
      toast.success("Prazo atualizado");
    },
    onError: (e: any) => toast.error("Erro ao atualizar: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prazos_tst").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prazos-tst"] });
      toast.success("Prazo removido");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (prazos: PrazoTstInsert[]) => {
      const { error } = await supabase.from("prazos_tst").insert(prazos as any[]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prazos-tst"] });
      toast.success("Importação concluída com sucesso");
    },
    onError: (e: any) => toast.error("Erro na importação: " + e.message),
  });

  const clearAndInsertMutation = useMutation({
    mutationFn: async ({ coordenacaoId: cid, prazos }: { coordenacaoId: string; prazos: PrazoTstInsert[] }) => {
      const { error: delErr } = await supabase.from("prazos_tst").delete().eq("coordenacao_id", cid);
      if (delErr) throw delErr;
      if (prazos.length > 0) {
        const { error: insErr } = await supabase.from("prazos_tst").insert(prazos as any[]);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prazos-tst"] });
      toast.success("Dados substituídos com sucesso");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return {
    prazos: query.data ?? [],
    isLoading: query.isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    bulkInsert: bulkInsertMutation.mutateAsync,
    clearAndInsert: clearAndInsertMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isImporting: bulkInsertMutation.isPending || clearAndInsertMutation.isPending,
  };
}
