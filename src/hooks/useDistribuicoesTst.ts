import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * NOTA DE ARQUITETURA: A tela "Distribuição TST" lê e grava em `dados_benner`
 * (tabela única / fonte de verdade). A interface `DistribuicaoTst` abaixo é
 * apenas um mapeamento dos campos de `dados_benner` para manter compatibilidade
 * com os componentes existentes (DistribuicaoTstForm, ProcessoDistribuicoesTab,
 * DadosBennerDistribuicaoTab, CargaBennerFromDb, DistribuicaoTst.tsx).
 *
 * Filtro de escopo: registros onde `aba_origem IS NOT NULL` (vieram de
 * importação Dr. Renata / formulário de distribuição).
 */

export interface DistribuicaoTst {
  id: string;
  processo_id: string; // mapeado de processos.id via lookup quando necessário (não persistido em dados_benner)
  processo_numero: string; // dados_benner.processo
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
  parte_recorrente: string | null; // dados_benner.recorrente
  tipo_recurso_reclamante: string | null;
  materias_recurso_reclamante: string | null;
  aparelhamento_reclamante: string | null;
  chance_exito_reclamante: string | null;
  tipo_recurso_banco: string | null;
  materias_recurso_banco: string | null;
  aparelhamento_banco: string | null;
  chance_exito_banco: string | null;
  tipo_recurso?: string | null;
  honra: string | null;
  tema: string | null;
  execucao: string | null;
  midia_negativa: string | null;
  decisao_quarteirizado: string | null;
  recurso_terceiros: string | null;
  transito_julgado: boolean | null;
  benner_atualizado: boolean | null;
  judit_preenchido: boolean;
  judit_preenchido_em: string | null;
  judit_preenchido_por: string | null;
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
  judit?: "todos" | "sim" | "nao";
  mesAno?: string;
  dataInicio?: string;
  dataFim?: string;
}

// Converte um registro de dados_benner para a interface DistribuicaoTst
function bennerToDistribuicao(b: any): DistribuicaoTst {
  // Deriva favorabilidade textual dos booleanos posicao_*
  const relatorFav = b.posicao_relator_favoravel
    ? "POSITIVO"
    : b.posicao_relator_desfavoravel
      ? "NEGATIVO"
      : null;
  const turmaFav = b.posicao_turma_favoravel
    ? "POSITIVA"
    : b.posicao_turma_desfavoravel
      ? "NEGATIVA"
      : null;

  return {
    id: b.id,
    processo_id: "", // não usado a partir de dados_benner; resolved sob demanda
    processo_numero: b.processo || "",
    aba_origem: b.aba_origem ?? null,
    data_distribuicao: b.data_distribuicao ?? null,
    dossie: b.dossie ?? null,
    equipe: b.equipe ?? null,
    reclamante: b.reclamante ?? null,
    reclamada: b.reclamada ?? null,
    relator: b.relator ?? null,
    relator_favorabilidade: relatorFav,
    turma: b.turma ?? null,
    turma_favorabilidade: turmaFav,
    parte_recorrente: b.recorrente ?? null,
    tipo_recurso_reclamante: b.tipo_recurso_reclamante ?? null,
    materias_recurso_reclamante: b.materias_recurso_reclamante ?? null,
    aparelhamento_reclamante: b.aparelhamento_reclamante ?? null,
    chance_exito_reclamante: b.chance_exito_reclamante ?? null,
    tipo_recurso_banco: b.tipo_recurso_banco ?? null,
    materias_recurso_banco: b.materias_recurso_banco ?? null,
    aparelhamento_banco: b.aparelhamento_banco ?? null,
    chance_exito_banco: b.chance_exito_banco ?? null,
    tipo_recurso: b.tipo_recurso ?? null,
    honra: b.honra ?? null,
    tema: b.tema ?? null,
    execucao: b.execucao ?? null,
    midia_negativa: b.midia_negativa ?? null,
    decisao_quarteirizado: b.decisao_quarteirizado ?? null,
    recurso_terceiros: b.recurso_terceiros ?? null,
    transito_julgado: b.transito_julgado ?? null,
    benner_atualizado: b.benner_atualizado ?? null,
    judit_preenchido: !!b.judit_preenchido,
    judit_preenchido_em: b.judit_preenchido_em ?? null,
    judit_preenchido_por: b.judit_preenchido_por ?? null,
    created_at: b.created_at,
    updated_at: b.updated_at,
  };
}

// Converte payload do form (DistribuicaoTstInsert) em payload de dados_benner
export function distribuicaoToBenner(d: Partial<DistribuicaoTstInsert>): Record<string, any> {
  const payload: Record<string, any> = {
    processo: d.processo_numero,
    dossie: d.dossie,
    aba_origem: d.aba_origem,
    data_distribuicao: d.data_distribuicao,
    equipe: d.equipe,
    reclamante: d.reclamante,
    reclamada: d.reclamada,
    relator: d.relator,
    turma: d.turma,
    recorrente: d.parte_recorrente,
    tipo_recurso_reclamante: d.tipo_recurso_reclamante,
    materias_recurso_reclamante: d.materias_recurso_reclamante,
    aparelhamento_reclamante: d.aparelhamento_reclamante,
    chance_exito_reclamante: d.chance_exito_reclamante,
    tipo_recurso_banco: d.tipo_recurso_banco,
    materias_recurso_banco: d.materias_recurso_banco,
    aparelhamento_banco: d.aparelhamento_banco,
    chance_exito_banco: d.chance_exito_banco,
    honra: d.honra,
    tema: d.tema,
    execucao: d.execucao,
    midia_negativa: d.midia_negativa,
    decisao_quarteirizado: d.decisao_quarteirizado,
    recurso_terceiros: d.recurso_terceiros,
    transito_julgado: d.transito_julgado,
    benner_atualizado: d.benner_atualizado,
    judit_preenchido: d.judit_preenchido,
    judit_preenchido_em: d.judit_preenchido_em,
    judit_preenchido_por: d.judit_preenchido_por,
    tribunal: "TST",
  };

  // Mapeia favorabilidade textual em booleanos posicao_*
  if (d.relator_favorabilidade !== undefined) {
    const v = (d.relator_favorabilidade || "").toLowerCase();
    payload.posicao_relator_favoravel = v.includes("positiv") || v.includes("favor") ? true : null;
    payload.posicao_relator_desfavoravel = v.includes("negativ") || v.includes("desfav") ? true : null;
  }
  if (d.turma_favorabilidade !== undefined) {
    const v = (d.turma_favorabilidade || "").toLowerCase();
    payload.posicao_turma_favoravel = v.includes("positiv") || v.includes("favor") ? true : null;
    payload.posicao_turma_desfavoravel = v.includes("negativ") || v.includes("desfav") ? true : null;
  }

  // Remove undefined (mantém null para limpar campos)
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  return payload;
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
      .from("dados_benner" as any)
      .select("*", { count: "exact" })
      .not("aba_origem", "is", null)
      .order("created_at", { ascending: false });

    if (filters.aba_origem && filters.aba_origem !== "todas") {
      query = query.eq("aba_origem", filters.aba_origem);
    }
    if (filters.benner === "sim") {
      query = query.eq("benner_atualizado", true);
    } else if (filters.benner === "nao") {
      query = query.or("benner_atualizado.is.null,benner_atualizado.eq.false");
    }
    if (filters.dossieStatus === "preenchido") {
      query = query.not("dossie", "is", null).neq("dossie", "");
    } else if (filters.dossieStatus === "nao_preenchido") {
      query = query.or("dossie.is.null,dossie.eq.");
    } else if (filters.dossieStatus === "valido") {
      query = query.like("dossie", "__.__.___.______%/__");
    } else if (filters.dossieStatus === "invalido") {
      query = query.not("dossie", "is", null).neq("dossie", "").not("dossie", "like", "__.__.___.______%/__");
    }
    if (filters.judit === "sim") {
      query = query.eq("judit_preenchido", true);
    } else if (filters.judit === "nao") {
      query = query.or("judit_preenchido.is.null,judit_preenchido.eq.false");
    }
    if (filters.processo) {
      query = query.ilike("processo", `%${filters.processo}%`);
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
      query = query.ilike("recorrente", `%${filters.parte}%`);
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

    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) {
      toast.error("Erro ao carregar distribuições: " + error.message);
    } else {
      const rows = ((data as any[]) || []).map(bennerToDistribuicao);
      setDados(rows);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [page, JSON.stringify(filters)]);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const filtersKey = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [filtersKey]);

  const saveDado = async (dado: DistribuicaoTstInsert, id?: string) => {
    const payload = distribuicaoToBenner(dado);
    if (id) {
      const { error } = await supabase.from("dados_benner" as any).update(payload as any).eq("id", id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
    } else {
      payload.status = "rascunho";
      const { error } = await supabase.from("dados_benner" as any).insert(payload as any);
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

  return { dados, loading, fetchDados, saveDado, deleteDado, page, setPage, totalCount, totalPages };
}
