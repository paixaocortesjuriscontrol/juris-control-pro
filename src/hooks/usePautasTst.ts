import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PautaTst {
  id: string;
  processo_id: string | null;
  processo_numero: string | null;
  aba_origem: string | null;
  equipe: string | null;
  advogado_interno: string | null;
  dossie: string | null;
  reclamante: string | null;
  reclamada: string | null;
  parte_recorrente: string | null;
  tipo_recurso: string | null;
  data_julgamento: string | null;
  horario: string | null;
  modalidade: string | null;
  link_acesso: string | null;
  orgao: string | null;
  relator: string | null;
  materia_recurso_reclamante: string | null;
  aparelhamento_reclamante: string | null;
  chance_exito_reclamante: string | null;
  materia_recurso_banco: string | null;
  aparelhamento_banco: string | null;
  chance_exito_banco: string | null;
  honra: string | null;
  decisao: string | null;
  sustentacao_oral: string | null;
  desistencia_recurso: string | null;
  midia_negativa: string | null;
  entrega_memoriais: string | null;
  solicitacao_providencias_banco: string | null;
  solicitacao_rosa_oliveira: string | null;
  comentarios_advogado: string | null;
  retorno_esclarecimentos: string | null;
  resultado_proxima_sessao: string | null;
  created_at: string;
  updated_at: string;
}

export type PautaTstInsert = Omit<PautaTst, "id" | "created_at" | "updated_at">;

export function usePautasTst() {
  const [dados, setDados] = useState<PautaTst[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pautas_tst" as any)
      .select("*")
      .order("data_julgamento", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Erro ao carregar pautas: " + error.message);
    } else {
      setDados((data as any[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const saveDado = async (dado: PautaTstInsert, id?: string) => {
    if (id) {
      const { error } = await supabase.from("pautas_tst" as any).update(dado as any).eq("id", id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
    } else {
      const { error } = await supabase.from("pautas_tst" as any).insert(dado as any);
      if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
    }
    toast.success(id ? "Registro atualizado!" : "Registro salvo!");
    fetchDados();
    return true;
  };

  const deleteDado = async (id: string) => {
    const { error } = await supabase.from("pautas_tst" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return false; }
    toast.success("Registro excluído!");
    fetchDados();
    return true;
  };

  return { dados, loading, fetchDados, saveDado, deleteDado };
}
