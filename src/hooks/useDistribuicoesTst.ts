import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DistribuicaoTst {
  id: string;
  processo_id: string;
  processo_numero: string;
  aba_origem: string | null;
  data_distribuicao: string | null;
  dossie: string | null;
  equipe: string | null;
  reclamante: string | null;
  reclamada: string | null;
  relator: string | null;
  relator_favorabilidade: string | null;
  turma: string | null;
  turma_favorabilidade: string | null;
  parte_recorrente: string | null;
  tipo_recurso_reclamante: string | null;
  materias_recurso_reclamante: string | null;
  aparelhamento_reclamante: string | null;
  chance_exito_reclamante: string | null;
  tipo_recurso_banco: string | null;
  materias_recurso_banco: string | null;
  aparelhamento_banco: string | null;
  chance_exito_banco: string | null;
  honra: string | null;
  tema: string | null;
  execucao: string | null;
  midia_negativa: string | null;
  decisao_quarteirizado: string | null;
  recurso_terceiros: string | null;
  transito_julgado: boolean | null;
  benner_atualizado: boolean | null;
  created_at: string;
  updated_at: string;
}

export type DistribuicaoTstInsert = Omit<DistribuicaoTst, "id" | "created_at" | "updated_at">;

export function useDistribuicoesTst() {
  const [dados, setDados] = useState<DistribuicaoTst[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("distribuicoes_tst" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Erro ao carregar distribuições: " + error.message);
    } else {
      setDados((data as any[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const saveDado = async (dado: DistribuicaoTstInsert, id?: string) => {
    if (id) {
      const { error } = await supabase.from("distribuicoes_tst" as any).update(dado as any).eq("id", id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
    } else {
      const { error } = await supabase.from("distribuicoes_tst" as any).insert(dado as any);
      if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
    }
    toast.success(id ? "Registro atualizado!" : "Registro salvo!");
    fetchDados();
    return true;
  };

  const deleteDado = async (id: string) => {
    const { error } = await supabase.from("distribuicoes_tst" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return false; }
    toast.success("Registro excluído!");
    fetchDados();
    return true;
  };

  return { dados, loading, fetchDados, saveDado, deleteDado };
}
