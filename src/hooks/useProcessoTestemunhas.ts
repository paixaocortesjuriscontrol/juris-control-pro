import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Testemunha {
  id: string;
  processo_id: string;
  nome: string;
  cpf_rg: string | null;
  telefone: string | null;
  email: string | null;
  arrolada_por: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export function useProcessoTestemunhas(processoId?: string) {
  const qc = useQueryClient();
  const queryKey = ["processos_testemunhas", processoId];

  const query = useQuery({
    queryKey,
    enabled: !!processoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_testemunhas" as any)
        .select("*")
        .eq("processo_id", processoId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Testemunha[];
    },
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey });
  };

  const create = useMutation({
    mutationFn: async (payload: Partial<Testemunha>) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("processos_testemunhas" as any)
        .insert({
          processo_id: processoId,
          nome: (payload.nome || "").trim(),
          cpf_rg: payload.cpf_rg?.trim() || null,
          telefone: payload.telefone?.trim() || null,
          email: payload.email?.trim() || null,
          arrolada_por: payload.arrolada_por?.trim() || null,
          observacoes: payload.observacoes?.trim() || null,
          created_by: userRes.user?.id ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e: any) => toast.error("Erro ao adicionar testemunha: " + (e?.message || "")),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Testemunha> }) => {
      const clean: any = {};
      (["nome", "cpf_rg", "telefone", "email", "arrolada_por", "observacoes"] as const).forEach((k) => {
        if (k in patch) {
          const v = (patch as any)[k];
          clean[k] = typeof v === "string" ? (v.trim() || null) : v;
        }
      });
      const { error } = await supabase
        .from("processos_testemunhas" as any)
        .update(clean)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e: any) => toast.error("Erro ao atualizar testemunha: " + (e?.message || "")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("processos_testemunhas" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Testemunha removida");
    },
    onError: (e: any) => toast.error("Erro ao remover testemunha: " + (e?.message || "")),
  });

  return {
    testemunhas: query.data || [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
  };
}
