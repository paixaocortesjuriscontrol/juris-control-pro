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

const PAGE_SIZE = 100;

export interface DistribuicaoTstFilters {
  processo?: string;
  dossie?: string;
  turma?: string;
  relator?: string;
  parte?: string;
  aba_origem?: string;
  benner?: "todos" | "sim" | "nao";
  dossieStatus?: "todos" | "preenchido" | "nao_preenchido" | "valido" | "invalido";
  mesAno?: string;
  dataInicio?: string;
  dataFim?: string;
}

export function useDistribuicoesTst(filters: DistribuicaoTstFilters = {}) {
  const [dados, setDados] = useState<DistribuicaoTst[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const fetchDados = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("distribuicoes_tst" as any)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply server-side filters
    if (filters.aba_origem && filters.aba_origem !== "todas") {
      query = query.eq("aba_origem", filters.aba_origem);
    }
    if (filters.benner === "sim") {
      query = query.eq("benner_atualizado", true);
    } else if (filters.benner === "nao") {
      query = query.or("benner_atualizado.is.null,benner_atualizado.eq.false");
    }
    // Dossiê status filter
    if (filters.dossieStatus === "preenchido") {
      query = query.not("dossie", "is", null).neq("dossie", "");
    } else if (filters.dossieStatus === "nao_preenchido") {
      query = query.or("dossie.is.null,dossie.eq.");
    } else if (filters.dossieStatus === "valido") {
      query = query.like("dossie", "__.__.___.______%/__");
    } else if (filters.dossieStatus === "invalido") {
      query = query.not("dossie", "is", null).neq("dossie", "").not("dossie", "like", "__.__.___.______%/__");
    }
    if (filters.processo) {
      query = query.ilike("processo_numero", `%${filters.processo}%`);
    }
    if (filters.dossie) {
      query = query.ilike("dossie", `%${filters.dossie}%`);
    }
    if (filters.turma) {
      query = query.ilike("turma", `%${filters.turma}%`);
    }
    if (filters.relator) {
      query = query.ilike("relator", `%${filters.relator}%`);
    }
    if (filters.parte) {
      query = query.ilike("parte_recorrente", `%${filters.parte}%`);
    }
    if (filters.mesAno && filters.mesAno !== "todos") {
      const start = `${filters.mesAno}-01`;
      const [y, m] = filters.mesAno.split("-").map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      query = query.gte("data_distribuicao", start).lt("data_distribuicao", nextMonth);
    }
    if (filters.dataInicio) {
      query = query.gte("data_distribuicao", filters.dataInicio);
    }
    if (filters.dataFim) {
      query = query.lte("data_distribuicao", filters.dataFim);
    }

    // Pagination
    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) {
      toast.error("Erro ao carregar distribuições: " + error.message);
    } else {
      setDados((data as any[]) || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [page, JSON.stringify(filters)]);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  // Reset page when filters change
  const filtersKey = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [filtersKey]);

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

  return { dados, loading, fetchDados, saveDado, deleteDado, page, setPage, totalCount, totalPages };
}
