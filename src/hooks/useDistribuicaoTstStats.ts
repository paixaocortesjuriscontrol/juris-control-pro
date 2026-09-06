import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "./useDistribuicoesTst";

export interface DistribuicaoTstStats {
  total: number;
  processosUnicos: number;
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
  comMateriaDossie: number;
  semMateriaDossie: number;
  problemaJudit: number;
  ate2025: number;
  de2026: number;
  prontoEnvio: number;
  prontoEnvioPuro: number;
  planilhado: number;
  enviado: number;
  semResponsavel: number;
  comEquipe: number;
  semEquipe: number;
  aFazer: number;
  naoPrecisaFazer: number;
}

const ZERO: DistribuicaoTstStats = {
  total: 0,
  processosUnicos: 0,
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
  comMateriaDossie: 0,
  semMateriaDossie: 0,
  problemaJudit: 0,
  ate2025: 0,
  de2026: 0,
  prontoEnvio: 0,
  prontoEnvioPuro: 0,
  planilhado: 0,
  enviado: 0,
  semResponsavel: 0,
  comEquipe: 0,
  semEquipe: 0,
  aFazer: 0,
  naoPrecisaFazer: 0,
};

const CNJ_RE = /^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$/;
const DOSSIE_RE = /^[0-9]{2}\.[0-9]{2}\.[0-9]{3}\.[0-9]{7,}\/[0-9]{2}$/;
const LARGE_IDS_THRESHOLD = 1000;

async function computeStatsForLargeIdFilter(filters: DistribuicaoTstFilters): Promise<DistribuicaoTstStats> {
  const ids = await fetchAllDistribuicaoTstIds(filters);
  if (ids.length === 0) return ZERO;

  const cols = [
    "id",
    "processo",
    "dossie",
    "judit_preenchido",
    "benner_atualizado",
    "situacao_processo",
    "transito_julgado",
    "processo_outro_escritorio",
    "segredo_justica",
    "cejusc",

    "turma",
    "problema_judit",
    "data_distribuicao_real",
    "data_distribuicao_planilha",
    "status",
    "equipe",
    "tem_responsavel",
  ].join(", ");

  const rows: any[] = [];
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("dados_benner" as any)
      .select(cols)
      .in("id", slice);
    if (error) throw error;
    rows.push(...((data as any[]) || []));
  }

  const processosUnicos = new Set<string>();
  const stats: DistribuicaoTstStats = { ...ZERO, total: rows.length };

  for (const row of rows) {
    const processo = String(row.processo || "").trim();
    const dossie = String(row.dossie || "").trim();
    const situacao = String(row.situacao_processo || "").trim().toLowerCase();
    // Data efetiva: real quando preenchida, senão a da planilha
    const dataEfetiva = String(row.data_distribuicao_real || row.data_distribuicao_planilha || "");
    const equipe = String(row.equipe || "").trim();

    if (processo) processosUnicos.add(processo.toLowerCase());
    if (CNJ_RE.test(processo)) stats.processosValidos += 1;
    else stats.processosInvalidos += 1;
    if (DOSSIE_RE.test(dossie)) stats.dossiesValidos += 1;
    else if (dossie) stats.dossiesInvalidos += 1;
    else stats.dossiesNaoPreenchidos += 1;
    if (row.judit_preenchido === true) stats.juditPreenchido += 1;
    else stats.juditNaoPreenchido += 1;
    if (row.benner_atualizado === true) stats.bennerSim += 1;
    else stats.bennerNao += 1;
    if (row.transito_julgado !== true && situacao === "ativo") stats.processosAtivos += 1;
    if (row.transito_julgado === true) stats.transitoJulgado += 1;
    if (row.transito_julgado !== true && situacao !== "ativo") stats.outrosSituacao += 1;
    if (!String(row.turma || "").trim()) stats.semTurma += 1;
    if (row.problema_judit === true) stats.problemaJudit += 1;
    if (dataEfetiva && dataEfetiva <= "2025-12-31") stats.ate2025 += 1;
    if (dataEfetiva && dataEfetiva >= "2026-01-01") stats.de2026 += 1;
    const st = String(row.status || "");
    const concluido = st === "pronto_envio" || st === "planilhado" || st === "enviado";
    if (concluido) stats.prontoEnvio += 1;
    if (st === "pronto_envio") stats.prontoEnvioPuro += 1;
    if (st === "planilhado") stats.planilhado += 1;
    if (st === "enviado") stats.enviado += 1;
    if (row.tem_responsavel !== true) stats.semResponsavel += 1;
    if (equipe) stats.comEquipe += 1;
    else stats.semEquipe += 1;
    if (
      row.transito_julgado !== true &&
      row.processo_outro_escritorio !== true &&
      row.segredo_justica !== true &&
      row.cejusc !== true &&
      !concluido
    ) {
      stats.aFazer += 1;
    }
    if (
      row.transito_julgado === true ||
      row.processo_outro_escritorio === true ||
      row.segredo_justica === true ||
      row.cejusc === true
    ) {
      stats.naoPrecisaFazer += 1;
    }
  }


  stats.processosUnicos = processosUnicos.size;
  return stats;
}

export function useDistribuicaoTstStats(filters: DistribuicaoTstFilters) {
  const [stats, setStats] = useState<DistribuicaoTstStats>(ZERO);
  const [loading, setLoading] = useState(false);
  // Flag para diferenciar "ainda não carregou" de "carregou e veio vazio".
  // Em caso de erro transitório (auth refresh, timeout de rede, etc.) NÃO
  // zeramos os cards — mantemos o último valor válido para evitar o flash
  // de "0" reportado pela Kellen.
  const [loadedOnce, setLoadedOnce] = useState(false);

  const filtersKey = JSON.stringify(filters);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      if ((filters.idsAllowed?.length || 0) > LARGE_IDS_THRESHOLD) {
        setStats(await computeStatsForLargeIdFilter(filters));
        setLoadedOnce(true);
        return;
      }

      const { data, error } = await supabase.rpc(
        "get_distribuicao_tst_stats" as any,
        { filters: filters as any }
      );
      if (error) {
        // Erro de RPC: não sobrescreve com zeros. Mantém último valor válido.
        console.warn("[useDistribuicaoTstStats] RPC falhou, mantendo valores anteriores:", error);
        return;
      }
      const row: any = Array.isArray(data) ? data[0] : data;
      if (!row) {
        // Resposta sem linhas: só zera na primeira carga; depois mantém.
        if (!loadedOnce) setStats(ZERO);
        return;
      }
      setStats({
        total: Number(row.total) || 0,
        processosUnicos: Number(row.processos_unicos) || 0,
        processosValidos: Number(row.processos_validos) || 0,
        processosInvalidos: Number(row.processos_invalidos) || 0,
        dossiesValidos: Number(row.dossies_validos) || 0,
        dossiesInvalidos: Number(row.dossies_invalidos) || 0,
        dossiesNaoPreenchidos: Number(row.dossies_nao_preenchidos) || 0,
        juditPreenchido: Number(row.judit_preenchido) || 0,
        juditNaoPreenchido: Number(row.judit_nao_preenchido) || 0,
        bennerSim: Number(row.benner_sim) || 0,
        bennerNao: Number(row.benner_nao) || 0,
        processosAtivos: Number(row.processos_ativos) || 0,
        transitoJulgado: Number(row.transito_julgado) || 0,
        outrosSituacao: Number(row.outros_situacao) || 0,
        semTurma: Number(row.sem_turma) || 0,
        problemaJudit: Number(row.problema_judit) || 0,
        ate2025: Number(row.ate_2025) || 0,
        de2026: Number(row.de_2026) || 0,
        prontoEnvio: Number(row.pronto_envio) || 0,
        prontoEnvioPuro: Number(row.pronto_envio_puro) || 0,
        planilhado: Number(row.planilhado) || 0,
        enviado: Number(row.enviado) || 0,
        semResponsavel: Number(row.sem_responsavel) || 0,
        comEquipe: Number(row.com_equipe) || 0,
        semEquipe: Number(row.sem_equipe) || 0,
        aFazer: Number(row.a_fazer) || 0,
        naoPrecisaFazer: Number(row.nao_precisa_fazer) || 0,
      });
      setLoadedOnce(true);
    } catch (err) {
      console.warn("[useDistribuicaoTstStats] exceção, mantendo valores anteriores:", err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, loadedOnce]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
