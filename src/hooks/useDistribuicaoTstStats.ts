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
  processosAtivos: number;
  transitoJulgado: number;
  outrosSituacao: number;
  semTurma: number;
  problemaJudit: number;
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
  processosAtivos: 0,
  transitoJulgado: 0,
  outrosSituacao: 0,
  semTurma: 0,
  problemaJudit: 0,
};

// Mesma regra usada na coluna "Dossiê" (filtro válido/inválido)
const DOSSIE_VALID_LIKE = "__.__.___.______%/__";

// Regex do padrão CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)
const CNJ_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

function applyCommonFilters(query: any, filters: DistribuicaoTstFilters, hasResponsavelFilter: boolean, realRespIds: string[]) {
  if (hasResponsavelFilter) {
    query = query.in("dados_benner_responsaveis.usuario_id", realRespIds);
  }
  if (filters.aba_origem && filters.aba_origem !== "todas") query = query.eq("aba_origem", filters.aba_origem);
  if (filters.benner === "sim") query = query.eq("benner_atualizado", true);
  else if (filters.benner === "nao") query = query.or("benner_atualizado.is.null,benner_atualizado.eq.false");
  if (filters.dossieStatus === "preenchido") query = query.not("dossie", "is", null).neq("dossie", "");
  else if (filters.dossieStatus === "nao_preenchido") query = query.or("dossie.is.null,dossie.eq.");
  else if (filters.dossieStatus === "valido") query = query.like("dossie", DOSSIE_VALID_LIKE);
  else if (filters.dossieStatus === "invalido") query = query.not("dossie", "is", null).neq("dossie", "").not("dossie", "like", DOSSIE_VALID_LIKE);
  else if (filters.dossieStatus === "invalido_ou_nao_preenchido") query = query.or(`dossie.is.null,dossie.eq.,dossie.not.like.${DOSSIE_VALID_LIKE}`);
  const CNJ_PG_REGEX = "^[0-9]{7}-[0-9]{2}\\.[0-9]{4}\\.[0-9]\\.[0-9]{2}\\.[0-9]{4}$";
  if (filters.processoStatus === "valido") query = query.filter("processo", "match", CNJ_PG_REGEX);
  else if (filters.processoStatus === "invalido") query = query.or(`processo.is.null,processo.eq.,processo.not.match."${CNJ_PG_REGEX}"`);
  if (filters.judit === "sim") query = query.eq("judit_preenchido", true);
  else if (filters.judit === "nao") query = query.or("judit_preenchido.is.null,judit_preenchido.eq.false");
  if (filters.situacaoProcesso === "ativo") query = query.ilike("situacao_processo", "ativo");
  else if (filters.situacaoProcesso === "transito") query = query.ilike("situacao_processo", "%trânsito em julgado%");
  else if (filters.situacaoProcesso === "outros") {
    query = query.or(
      'situacao_processo.is.null,and(situacao_processo.not.ilike.ativo,situacao_processo.not.ilike.*trânsito em julgado*)'
    );
  }
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
  if (filters.semTurma) query = query.or("turma.is.null,turma.eq.");
  if (filters.status && filters.status !== "todos") query = query.eq("status", filters.status);
  if ((filters as any).problemaJudit === "sim") query = query.eq("problema_judit", true);
  else if ((filters as any).problemaJudit === "nao") query = query.or("problema_judit.is.null,problema_judit.eq.false");
  if ((filters as any).duplicado === "sim") query = query.eq("ic_duplicado", true);
  else if ((filters as any).duplicado === "nao") query = query.or("ic_duplicado.is.null,ic_duplicado.eq.false");
  return query;
}

function baseQuery(filters: DistribuicaoTstFilters, realRespIds: string[], idsWithoutResponsavel: string[] | null) {
  const hasResponsavelFilter = realRespIds.length > 0;
  const selectClause = hasResponsavelFilter
    ? "id, processo, dossie, judit_preenchido, benner_atualizado, situacao_processo, turma, problema_judit, dados_benner_responsaveis!inner(usuario_id)"
    : "id, processo, dossie, judit_preenchido, benner_atualizado, situacao_processo, turma, problema_judit";
  let q = supabase
    .from("dados_benner" as any)
    .select(selectClause)
    .not("aba_origem", "is", null);
  q = applyCommonFilters(q, filters, hasResponsavelFilter, realRespIds);
  if (idsWithoutResponsavel) {
    if (idsWithoutResponsavel.length === 0) {
      // Forçar resultado vazio sem URL gigante
      q = q.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      q = q.in("id", idsWithoutResponsavel);
    }
  }
  return q;
}

export function useDistribuicaoTstStats(filters: DistribuicaoTstFilters) {
  const [stats, setStats] = useState<DistribuicaoTstStats>(ZERO);
  const [loading, setLoading] = useState(false);

  const filtersKey = JSON.stringify(filters);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const UNASSIGNED = "__sem_responsavel__";
      const respIds = filters.responsavelIds || [];
      const wantsUnassigned = respIds.includes(UNASSIGNED);
      const realRespIds = respIds.filter(id => id !== UNASSIGNED);

      let idsWithoutResponsavel: string[] | null = null;
      if (wantsUnassigned) {
        const { data, error } = await supabase.rpc("get_dados_benner_sem_responsavel" as any);
        if (!error) {
          idsWithoutResponsavel = ((data as any[]) || []).map((r: any) => r.id);
        } else {
          idsWithoutResponsavel = [];
        }
      }

      // Pagina todos os registros do escopo filtrado para calcular cada métrica.
      const FETCH_SIZE = 1000;
      let offset = 0;
      const acc: DistribuicaoTstStats = { ...ZERO };
      while (true) {
        const { data, error } = await baseQuery(filters, realRespIds, idsWithoutResponsavel).range(offset, offset + FETCH_SIZE - 1);
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
          // Processos Ativos
          const situacao = String(r.situacao_processo || "").trim().toLowerCase();
          if (situacao === "ativo") acc.processosAtivos++;
          if (situacao.includes("trânsito em julgado") || situacao.includes("transito em julgado")) acc.transitoJulgado++;
          if (!situacao || (situacao !== "ativo" && !situacao.includes("trânsito em julgado") && !situacao.includes("transito em julgado"))) acc.outrosSituacao++;
          // Sem Turma
          const turma = String(r.turma || "").trim();
          if (!turma) acc.semTurma++;
          if (r.problema_judit) acc.problemaJudit++;
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
