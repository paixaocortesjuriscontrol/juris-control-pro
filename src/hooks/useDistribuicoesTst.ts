import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * NOTA DE ARQUITETURA: A tela "Distribuição TST" lê e grava em `dados_benner`
 * (tabela única / fonte de verdade). Responsáveis múltiplos vivem em
 * `dados_benner_responsaveis` (link N:N para profiles).
 *
 * Campos de data:
 *  - data_distribuicao_planilha: vem da planilha importada / digitação manual
 *  - data_distribuicao_real: preenchida exclusivamente via Judit / manualmente
 */

export interface DistribuicaoTst {
  id: string;
  processo_id: string;
  processo_numero: string;
  situacao_processo?: string | null;
  aba_origem: string | null;
  data_distribuicao_planilha: string | null;
  data_distribuicao_real: string | null;
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
  coordenacao_id: string | null;
  responsaveis_ids?: string[];
  observacao_advogado?: string | null;
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
  nomeParte?: string;
  aba_origem?: string;
  benner?: "todos" | "sim" | "nao";
  dossieStatus?: "todos" | "preenchido" | "nao_preenchido" | "valido" | "invalido" | "invalido_ou_nao_preenchido";
  processoStatus?: "todos" | "valido" | "invalido";
  judit?: "todos" | "sim" | "nao";
  situacaoProcesso?: "todos" | "ativo" | "transito" | "outros";
  mesAno?: string;
  dataInicio?: string;
  dataFim?: string;
  responsavelIds?: string[];
}

function bennerToDistribuicao(b: any): DistribuicaoTst {
  const relatorFav = b.posicao_relator_favoravel ? "POSITIVO" : b.posicao_relator_desfavoravel ? "NEGATIVO" : null;
  const turmaFav = b.posicao_turma_favoravel ? "POSITIVA" : b.posicao_turma_desfavoravel ? "NEGATIVA" : null;
  return {
    id: b.id,
    processo_id: "",
    processo_numero: b.processo || "",
    situacao_processo: b.situacao_processo ?? null,
    aba_origem: b.aba_origem ?? null,
    data_distribuicao_planilha: b.data_distribuicao_planilha ?? null,
    data_distribuicao_real: b.data_distribuicao_real ?? null,
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
    coordenacao_id: b.coordenacao_id ?? null,
    observacao_advogado: b.observacao_advogado ?? null,
    created_at: b.created_at,
    updated_at: b.updated_at,
  };
}

export function distribuicaoToBenner(d: Partial<DistribuicaoTstInsert>): Record<string, any> {
  const payload: Record<string, any> = {
    processo: d.processo_numero,
    dossie: d.dossie,
    aba_origem: d.aba_origem,
    data_distribuicao_planilha: d.data_distribuicao_planilha,
    data_distribuicao_real: d.data_distribuicao_real,
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
    coordenacao_id: d.coordenacao_id,
    tribunal: "TST",
  };
  if (d.observacao_advogado !== undefined) payload.observacao_advogado = d.observacao_advogado;

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

  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  return payload;
}

export function useDistribuicoesTst(filters: DistribuicaoTstFilters = {}) {
  const [dados, setDados] = useState<DistribuicaoTst[]>([]);
  const [responsaveisMap, setResponsaveisMap] = useState<Map<string, { id: string; nome: string }[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const fetchDados = useCallback(async () => {
    setLoading(true);

    const UNASSIGNED = "__sem_responsavel__";
    const respIds = filters.responsavelIds || [];
    const wantsUnassigned = respIds.includes(UNASSIGNED);
    const realRespIds = respIds.filter(id => id !== UNASSIGNED);
    const hasResponsavelFilter = realRespIds.length > 0;

    // Pré-busca dos IDs SEM responsável (lista pequena: ~256), via RPC.
    // Antes usávamos a lista de COM responsável (~2500+) com .not.in.(...)
    // o que gerava URL gigantesca e erro "Failed to fetch".
    let idsWithoutResponsavel: string[] | null = null;
    if (wantsUnassigned) {
      const { data, error } = await supabase.rpc("get_dados_benner_sem_responsavel" as any);
      if (error) {
        toast.error("Erro ao filtrar 'Não distribuído': " + error.message);
        setLoading(false);
        return;
      }
      idsWithoutResponsavel = ((data as any[]) || []).map((r: any) => r.id);
    }

    // Quando há filtro de responsáveis, usamos join inner com a tabela N:N
    // para evitar URLs gigantes (centenas de IDs em .in()).
    const selectClause = hasResponsavelFilter
      ? "*, dados_benner_responsaveis!inner(usuario_id)"
      : "*";

    let query = supabase
      .from("dados_benner" as any)
      .select(selectClause, { count: "exact" })
      .not("aba_origem", "is", null)
      .order("created_at", { ascending: false });

    if (hasResponsavelFilter) {
      query = query.in("dados_benner_responsaveis.usuario_id", realRespIds);
    }
    if (wantsUnassigned && idsWithoutResponsavel) {
      if (idsWithoutResponsavel.length === 0) {
        // Nenhum sem responsável → resultado vazio
        setDados([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
      // Lista é pequena (~256 itens), URL viável
      query = query.in("id", idsWithoutResponsavel);
    }

    if (filters.aba_origem && filters.aba_origem !== "todas") query = query.eq("aba_origem", filters.aba_origem);
    if (filters.benner === "sim") query = query.eq("benner_atualizado", true);
    else if (filters.benner === "nao") query = query.or("benner_atualizado.is.null,benner_atualizado.eq.false");
    if (filters.dossieStatus === "preenchido") query = query.not("dossie", "is", null).neq("dossie", "");
    else if (filters.dossieStatus === "nao_preenchido") query = query.or("dossie.is.null,dossie.eq.");
    else if (filters.dossieStatus === "valido") query = query.like("dossie", "__.__.___.______%/__");
    else if (filters.dossieStatus === "invalido") query = query.not("dossie", "is", null).neq("dossie", "").not("dossie", "like", "__.__.___.______%/__");
    else if (filters.dossieStatus === "invalido_ou_nao_preenchido") query = query.or("dossie.is.null,dossie.eq.,dossie.not.like.__.__.___.______%/__");
    // Processo CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (somente dígitos)
    const CNJ_REGEX = "^[0-9]{7}-[0-9]{2}\\.[0-9]{4}\\.[0-9]\\.[0-9]{2}\\.[0-9]{4}$";
    if (filters.processoStatus === "valido") query = query.filter("processo", "~", CNJ_REGEX);
    else if (filters.processoStatus === "invalido") query = query.or(`processo.is.null,processo.eq.,processo.not.match."${CNJ_REGEX}"`);
    if (filters.judit === "sim") query = query.eq("judit_preenchido", true);
    else if (filters.judit === "nao") query = query.or("judit_preenchido.is.null,judit_preenchido.eq.false");
    if (filters.situacaoProcesso === "ativo") query = query.ilike("situacao_processo", "ativo");
    else if (filters.situacaoProcesso === "transito") query = query.ilike("situacao_processo", "%trânsito em julgado%");
    else if (filters.situacaoProcesso === "outros") {
      // "Outros" = qualquer valor que não seja Ativo nem Trânsito em Julgado (inclui NULL)
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

    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) {
      toast.error("Erro ao carregar distribuições: " + error.message);
      setLoading(false);
      return;
    }
    const rows = ((data as any[]) || []).map(bennerToDistribuicao);
    setDados(rows);
    setTotalCount(count || 0);

    // Carrega responsáveis para os ids visíveis
    const visibleIds = rows.map(r => r.id);
    if (visibleIds.length > 0) {
      const { data: respData } = await supabase
        .from("dados_benner_responsaveis" as any)
        .select("dados_benner_id, usuario_id")
        .in("dados_benner_id", visibleIds);
      const respRows = (respData as any[]) || [];
      const userIds = [...new Set(respRows.map(r => r.usuario_id).filter(Boolean))];
      const profileMap = new Map<string, { id: string; nome: string }>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles_basic" as any)
          .select("id, nome")
          .in("id", userIds);
        ((profs as any[]) || []).forEach((p: any) => profileMap.set(p.id, { id: p.id, nome: p.nome }));
      }
      const map = new Map<string, { id: string; nome: string }[]>();
      respRows.forEach((row: any) => {
        const arr = map.get(row.dados_benner_id) || [];
        const prof = profileMap.get(row.usuario_id);
        if (prof) arr.push(prof);
        map.set(row.dados_benner_id, arr);
      });
      setResponsaveisMap(map);
    } else {
      setResponsaveisMap(new Map());
    }

    setLoading(false);
  }, [page, JSON.stringify(filters)]);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const filtersKey = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [filtersKey]);

  const saveDado = async (dado: DistribuicaoTstInsert, id?: string) => {
    const payload = distribuicaoToBenner(dado);
    const responsaveisIds = dado.responsaveis_ids || [];
    let rowId = id;
    if (id) {
      const { error } = await supabase.from("dados_benner" as any).update(payload as any).eq("id", id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
    } else {
      payload.status = "rascunho";
      const { data: ins, error } = await supabase.from("dados_benner" as any).insert(payload as any).select("id").single();
      if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
      rowId = (ins as any)?.id;
    }
    // Persist responsáveis
    if (rowId) {
      await supabase.from("dados_benner_responsaveis" as any).delete().eq("dados_benner_id", rowId);
      if (responsaveisIds.length > 0) {
        await supabase.from("dados_benner_responsaveis" as any).insert(
          responsaveisIds.map(uid => ({ dados_benner_id: rowId, usuario_id: uid })) as any
        );
      }
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

  return { dados, responsaveisMap, loading, fetchDados, saveDado, deleteDado, page, setPage, totalCount, totalPages };
}
