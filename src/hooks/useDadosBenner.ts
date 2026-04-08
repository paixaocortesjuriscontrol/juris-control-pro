import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DadoBenner {
  id: string;
  user_id: string | null;
  coordenacao_id: string | null;
  status: string;
  dossie: string | null;
  contrato: string | null;
  tribunal: string | null;
  tipo_recurso: string | null;
  data_distribuicao: string | null;
  turma: string | null;
  relator: string | null;
  analise_quarteirizado: string | null;
  risco_midia: string | null;
  risco_descricao: string | null;
  provas_digitais: string | null;
  tem_data_julgamento: string | null;
  data_julgamento: string | null;
  horario_julgamento: string | null;
  tipo_julgamento: string | null;
  materia_honra: string | null;
  entrega_memoriais: string | null;
  sustentacao_oral: string | null;
  resultado_sem_transcendencia: boolean;
  resultado_nao_conhecido: boolean;
  resultado_conhecido_provido: boolean;
  resultado_conhecido_nao_provido: boolean;
  resultado_outra: string | null;
  observacoes: string | null;
  ganhamos: boolean;
  perdemos: boolean;
  processo_baixado: string | null;
  recorrente: string | null;
  posicao_turma_favoravel: boolean;
  posicao_turma_desfavoravel: boolean;
  posicao_relator_favoravel: boolean;
  posicao_relator_desfavoravel: boolean;
  recurso_bem_aparelhado: boolean;
  recurso_mal_aparelhado: boolean;
  chance_exito: string | null;
  created_at: string;
  updated_at: string;
}

export type DadoBennerInsert = Omit<DadoBenner, "id" | "created_at" | "updated_at">;

export interface DadosBennerFilters {
  status?: string;
  relator?: string;
  dossie?: string;
  contrato?: string;
  turma?: string;
  tipo_recurso?: string;
}

export function useDadosBenner(filters?: DadosBennerFilters) {
  const [dados, setDados] = useState<DadoBenner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("dados_benner" as any).select("*").order("created_at", { ascending: false });
    if (filters?.status && filters.status !== "todos") {
      query = query.eq("status", filters.status);
    }
    if (filters?.relator) {
      query = query.ilike("relator", `%${filters.relator}%`);
    }
    if (filters?.dossie) {
      query = query.ilike("dossie", `%${filters.dossie}%`);
    }
    if (filters?.contrato) {
      query = query.ilike("contrato", `%${filters.contrato}%`);
    }
    if (filters?.turma) {
      query = query.ilike("turma", `%${filters.turma}%`);
    }
    if (filters?.tipo_recurso) {
      query = query.ilike("tipo_recurso", `%${filters.tipo_recurso}%`);
    }
    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar dados: " + error.message);
    } else {
      setDados((data as any[]) || []);
    }
    setLoading(false);
  }, [filters?.status, filters?.relator, filters?.dossie, filters?.contrato, filters?.turma, filters?.tipo_recurso]);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const saveDado = async (dado: DadoBennerInsert, id?: string) => {
    if (id) {
      const { error } = await supabase.from("dados_benner" as any).update(dado as any).eq("id", id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
    } else {
      const { error } = await supabase.from("dados_benner" as any).insert(dado as any);
      if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
    }
    toast.success(id ? "Registro atualizado!" : "Registro salvo!");
    fetchDados();
    return true;
  };

  const deleteDado = async (id: string) => {
    const { error } = await supabase.from("dados_benner" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return false; }
    toast.success("Registro excluído!");
    fetchDados();
    return true;
  };

  const updateStatus = async (ids: string[], newStatus: string) => {
    const { error } = await supabase.from("dados_benner" as any).update({ status: newStatus } as any).in("id", ids);
    if (error) { toast.error("Erro ao atualizar status: " + error.message); return false; }
    toast.success(`${ids.length} registro(s) atualizado(s) para "${newStatus}"!`);
    fetchDados();
    return true;
  };

  const buscarDossie = async (termo: string) => {
    const { data, error } = await supabase
      .from("processos")
      .select("id, numero, dossie_tst, turma_tst, relator_tst, coordenacao_id")
      .or(`dossie_tst.ilike.%${termo}%,numero.ilike.%${termo}%`)
      .limit(5);
    if (error) { toast.error("Erro na busca: " + error.message); return []; }
    return data || [];
  };

  return { dados, loading, fetchDados, saveDado, deleteDado, updateStatus, buscarDossie };
}
