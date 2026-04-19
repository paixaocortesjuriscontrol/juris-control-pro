import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DistribuicaoTstFilters } from "./useDistribuicoesTst";

export interface DistribuicaoTstStats {
  total: number;
  processosValidos: number;
  processosInvalidos: number;
  dossiesValidos: number;
  dossiesInvalidos: number;
  dossiesNaoPreenchidos: number;
  juditPreenchido: number;
  juditNaoPreenchido: number;
  bennerSim: number;
  bennerNao: number;
}

const ZERO: DistribuicaoTstStats = {
  total: 0,
  processosValidos: 0,
  processosInvalidos: 0,
  dossiesValidos: 0,
  dossiesInvalidos: 0,
  dossiesNaoPreenchidos: 0,
  juditPreenchido: 0,
  juditNaoPreenchido: 0,
  bennerSim: 0,
  bennerNao: 0,
};

// Mesma regra usada na coluna "Dossiê" (filtro válido/inválido)
const DOSSIE_VALID_LIKE = "__.__.___.______%/__";

// Regex do padrão CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)
const CNJ_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

function applyCommonFilters(query: any, filters: DistribuicaoTstFilters, hasResponsavelFilter: boolean) {
  if (hasResponsavelFilter) {
    query = query.in("dados_benner_responsaveis.usuario_id", filters.responsavelIds!);
  }
  if (filters.aba_origem && filters.aba_origem !== "todas") query = query.eq("aba_origem", filters.aba_origem);
  if (filters.benner === "sim") query = query.eq("benner_atualizado", true);
  else if (filters.benner === "nao") query = query.or("benner_atualizado.is.null,benner_atualizado.eq.false");
  if (filters.dossieStatus === "preenchido") query = query.not("dossie", "is", null).neq("dossie", "");
  else if (filters.dossieStatus === "nao_preenchido") query = query.or("dossie.is.null,dossie.eq.");
  else if (filters.dossieStatus === "valido") query = query.like("dossie", DOSSIE_VALID_LIKE);
  else if (filters.dossieStatus === "invalido") query = query.not("dossie", "is", null).neq("dossie", "").not("dossie", "like", DOSSIE_VALID_LIKE);
  if (filters.judit === "sim") query = query.eq("judit_preenchido", true);
  else if (filters.judit === "nao") query = query.or("judit_preenchido.is.null,judit_preenchido.eq.false");
  if (filters.processo) query = query.ilike("processo", `%${filters.processo}%`);
  if (filters.dossie) query = query.ilike("dossie", `%${filters.dossie}%`);
  if (filters.turma) query = query.ilike("turma", `%${filters.turma}%`);
  if (filters.relator) query = query.ilike("relator", `%${filters.relator}%`);
  if (filters.parte) query = query.ilike("recorrente", `%${filters.parte}%`);
  if (filters.nomeParte) {
    const escaped = filters.nomeParte.replace(/[,()]/g, " ").trim();
    query = query.or(`reclamante.ilike.%${escaped}%,reclamada.ilike.%${escaped}%`);
  }
  if (filters.mesAno && filters.mesAno !== "todos") {
    const start = `${filters.mesAno}-01`;
    const [y, m] = filters.mesAno.split("-").map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    query = query.gte("data_distribuicao_planilha", start).lt("data_distribuicao_planilha", nextMonth);
  }
  if (filters.dataInicio) query = query.gte("data_distribuicao_planilha", filters.dataInicio);
  if (filters.dataFim) query = query.lte("data_distribuicao_planilha", filters.dataFim);
  return query;
}

function baseQuery(filters: DistribuicaoTstFilters) {
  const hasResponsavelFilter = !!(filters.responsavelIds && filters.responsavelIds.length > 0);
  const selectClause = hasResponsavelFilter
    ? "processo, dossie, judit_preenchido, benner_atualizado, dados_benner_responsaveis!inner(usuario_id)"
    : "processo, dossie, judit_preenchido, benner_atualizado";
  let q = supabase
    .from("dados_benner" as any)
    .select(selectClause)
    .not("aba_origem", "is", null);
  q = applyCommonFilters(q, filters, hasResponsavelFilter);
  return q;
}

export function useDistribuicaoTstStats(filters: DistribuicaoTstFilters) {
  const [stats, setStats] = useState<DistribuicaoTstStats>(ZERO);
  const [loading, setLoading] = useState(false);

  const filtersKey = JSON.stringify(filters);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Pagina todos os registros do escopo filtrado para calcular cada métrica.
      const FETCH_SIZE = 1000;
      let offset = 0;
      const acc: DistribuicaoTstStats = { ...ZERO };
      while (true) {
        const { data, error } = await baseQuery(filters).range(offset, offset + FETCH_SIZE - 1);
        if (error) {
          // Em caso de erro, mantém o que foi acumulado
          break;
        }
        const rows = (data as any[]) || [];
        for (const r of rows) {
          acc.total++;
          // Processo válido / inválido (CNJ)
          const proc = String(r.processo || "").trim();
          if (proc && CNJ_REGEX.test(proc)) acc.processosValidos++;
          else acc.processosInvalidos++;
          // Dossiê
          const dos = String(r.dossie || "").trim();
          if (!dos) acc.dossiesNaoPreenchidos++;
          else if (/^\d{2}\.\d{2}\.\d{3}\.\d{7,}\/\d{2}$/.test(dos)) acc.dossiesValidos++;
          else acc.dossiesInvalidos++;
          // Judit
          if (r.judit_preenchido) acc.juditPreenchido++;
          else acc.juditNaoPreenchido++;
          // Benner
          if (r.benner_atualizado) acc.bennerSim++;
          else acc.bennerNao++;
        }
        if (rows.length < FETCH_SIZE) break;
        offset += FETCH_SIZE;
      }
      setStats(acc);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
