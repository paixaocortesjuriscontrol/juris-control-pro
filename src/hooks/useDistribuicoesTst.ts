import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Retorna os IDs de TODAS as linhas cujo processo aparece mais de uma vez.
 * Não depende de `ic_duplicado`, porque esse marcador pode estar errado ou
 * incompleto; o filtro da tela precisa mostrar o duplicado real e seus pares.
 *
 * Considera SOMENTE registros ativos (não arquivados). Um processo só é
 * considerado duplicado se houver 2 ou mais linhas ativas com o mesmo número.
 */
async function fetchDuplicateGroups(): Promise<{
  activeIds: string[];
  archivedRows: any[];
}> {
  const PAGE = 1000;
  const byProcesso = new Map<string, { activeIds: string[]; archivedRows: any[] }>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("dados_benner" as any)
      .select("id, processo")
      .not("aba_origem", "is", null)
      .not("processo", "is", null)
      .order("processo", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as any[]) || [];
    for (const r of rows) {
      const raw = String(r.processo || "").trim();
      if (!raw) continue;
      const digits = raw.replace(/\D/g, "");
      const key = digits.length >= 20 ? digits : raw.toLowerCase();
      const grp = byProcesso.get(key) || { activeIds: [], archivedRows: [] };
      grp.activeIds.push(r.id);
      byProcesso.set(key, grp);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  const activeIds: string[] = [];
  const archivedRows: any[] = [];
  byProcesso.forEach((grp) => {
    // Só conta como duplicado quando há 2+ registros ATIVOS com o mesmo processo.
    if (grp.activeIds.length > 1) {
      activeIds.push(...grp.activeIds);
    }
  });
  return { activeIds, archivedRows };
}

async function fetchDuplicateDistribuicaoTstIds(): Promise<string[]> {
  const { activeIds } = await fetchDuplicateGroups();
  return activeIds;
}

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
  tipo_recurso_terceiro: string | null;
  materias_recurso_terceiro: string | null;
  aparelhamento_terceiro: string | null;
  chance_exito_terceiro: string | null;
  tipo_recurso?: string | null;
  honra: string | null;
  tema: string | null;
  execucao: string | null;
  midia_negativa: string | null;
  decisao_quarteirizado: string | null;
  recurso_terceiros: string | null;
  transito_julgado: boolean | null;
  benner_atualizado: boolean | null;
  status?: string | null;
  provas_digitais?: string | null;
  judit_preenchido: boolean;
  judit_preenchido_em: string | null;
  judit_preenchido_por: string | null;
  erro_judit?: boolean;
  ic_duplicado?: boolean;
  coordenacao_id: string | null;
  responsaveis_ids?: string[];
  observacao_advogado?: string | null;
  em_analise?: boolean;
  em_analise_por?: string | null;
  em_analise_em?: string | null;
  subida_em_massa?: boolean;
  situacao_envio_carga_id?: string | null;
  processo_outro_escritorio?: boolean | null;
  tribunal?: string | null;
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
  erroJudit?: "todos" | "sim" | "nao";
  situacaoProcesso?: "todos" | "ativo" | "transito" | "outros" | "outro_escritorio" | "segredo_justica" | "a_fazer" | "nao_precisa_fazer";
  subidaMassa?: "todos" | "sim" | "nao";
  mesAno?: string;
  dataInicio?: string;
  dataFim?: string;
  responsavelIds?: string[];
  semTurma?: boolean;
  status?: "todos" | "rascunho" | "pronto_envio" | "enviado" | "planilhado";
  emAnalise?: "todos" | "sim" | "nao" | "analisado";
  problemaJudit?: "todos" | "sim" | "nao";
  duplicado?: "todos" | "sim" | "nao";
  centralizador?: string;
  fonteImportacao?: string;
  provasDigitais?: "todos" | "sim" | "nao" | "nao_selecionado";
  situacaoEnvioCargaId?: string;
  equipe?: "todos" | "sim" | "nao";
  /** Lista de ids permitidos (intersecção). Quando vazia, retorna 0 linhas. */
  idsAllowed?: string[] | null;
}

export function bennerToDistribuicao(b: any): DistribuicaoTst {
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
    tipo_recurso_terceiro: b.tipo_recurso_terceiro ?? null,
    materias_recurso_terceiro: b.materias_recurso_terceiro ?? null,
    aparelhamento_terceiro: b.aparelhamento_terceiro ?? null,
    chance_exito_terceiro: b.chance_exito_terceiro ?? null,
    tipo_recurso: b.tipo_recurso ?? null,
    honra: b.honra ?? null,
    tema: b.tema ?? null,
    execucao: b.execucao ?? null,
    midia_negativa: b.midia_negativa ?? null,
    decisao_quarteirizado: b.decisao_quarteirizado ?? null,
    recurso_terceiros: b.recurso_terceiros ?? null,
    transito_julgado: b.transito_julgado ?? null,
    benner_atualizado: b.benner_atualizado ?? null,
    status: b.status ?? null,
    provas_digitais: b.provas_digitais ?? null,
    judit_preenchido: !!b.judit_preenchido,
    judit_preenchido_em: b.judit_preenchido_em ?? null,
    judit_preenchido_por: b.judit_preenchido_por ?? null,
    erro_judit: !!b.erro_judit,
    ic_duplicado: !!b.ic_duplicado,
    coordenacao_id: b.coordenacao_id ?? null,
    observacao_advogado: b.observacao_advogado ?? null,
    em_analise: !!b.em_analise,
    em_analise_por: b.em_analise_por ?? null,
    em_analise_em: b.em_analise_em ?? null,
    created_at: b.created_at,
    updated_at: b.updated_at,
    subida_em_massa: !!b.subida_em_massa,
    situacao_envio_carga_id: b.situacao_envio_carga_id ?? null,
    processo_outro_escritorio: !!b.processo_outro_escritorio,
    tribunal: b.tribunal ?? null,
    problema_judit: !!b.problema_judit,
    segredo_justica: !!b.segredo_justica,
    recurso_terceiro: !!b.recurso_terceiro,
    cejusc: !!b.cejusc,
    ic_arquivado: !!b.ic_arquivado,
    // Campos extras de dados_benner expostos para checagem de pendências
    // (não fazem parte do "form" da Distribuição mas são lidos em UI/relatórios).
    risco_descricao: b.risco_descricao ?? null,
    tem_data_julgamento: b.tem_data_julgamento ?? null,
    data_julgamento: b.data_julgamento ?? null,
    horario_julgamento: b.horario_julgamento ?? null,
    tipo_julgamento: b.tipo_julgamento ?? null,
    processo_baixado: b.processo_baixado ?? null,
    chance_exito: b.chance_exito ?? null,
  } as any;
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
    tipo_recurso_terceiro: d.tipo_recurso_terceiro,
    materias_recurso_terceiro: d.materias_recurso_terceiro,
    aparelhamento_terceiro: d.aparelhamento_terceiro,
    chance_exito_terceiro: d.chance_exito_terceiro,
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
  };
  if (d.observacao_advogado !== undefined) payload.observacao_advogado = d.observacao_advogado;
  // Regra simples: a aba Distribuição só salva os campos que ela mostra.
  // Campos do Dados Benner (tribunal, situação, processo_baixado, pauta etc.)
  // não entram aqui, para uma aba oculta/antiga nunca sobrescrever o formulário ativo.

  // Agora a aba "Confere Benner" será oculta (somente admin) e a Distribuição
  // TST passa a ser a fonte canônica do Tribunal. Persistimos quando o form
  // envia explicitamente o campo (default "TST" na UI).
  if ((d as any).tribunal !== undefined) {
    payload.tribunal = (d as any).tribunal;
  }

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

/**
 * Aplica os mesmos filtros usados em useDistribuicoesTst em uma query supabase
 * que selecciona apenas `id`. Reutilizado pela distribuição automática para
 * carregar TODOS os ids que batem com os filtros (sem paginação).
 */
export async function fetchAllDistribuicaoTstIds(
  filters: DistribuicaoTstFilters
): Promise<string[]> {
  const UNASSIGNED = "__sem_responsavel__";
  const respIds = filters.responsavelIds || [];
  const wantsUnassigned = respIds.includes(UNASSIGNED);
  const realRespIds = respIds.filter((id) => id !== UNASSIGNED);
  const hasResponsavelFilter = realRespIds.length > 0;

  // wantsUnassigned é aplicado diretamente via .eq("tem_responsavel", false)
  // (coluna denormalizada com trigger) — sem chamada extra.

  const selectClause = hasResponsavelFilter
    ? "id, dados_benner_responsaveis!inner(usuario_id)"
    : "id";

  // Para "Apenas duplicados", filtramos por IDs reais dos grupos cujo processo
  // aparece mais de uma vez, não pelo marcador `ic_duplicado`.
  let duplicateIds: string[] | null = null;
  if (filters.duplicado === "sim") {
    duplicateIds = await fetchDuplicateDistribuicaoTstIds();
    if (duplicateIds.length === 0) return [];
  }

  const PAGE = 1000;
  const all: string[] = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("dados_benner" as any)
      .select(selectClause)
      .not("aba_origem", "is", null)
      .order("created_at", { ascending: false });

    if (hasResponsavelFilter) query = query.in("dados_benner_responsaveis.usuario_id", realRespIds);
    if (wantsUnassigned) query = query.eq("tem_responsavel", false);

    if (filters.aba_origem && filters.aba_origem !== "todas") query = query.eq("aba_origem", filters.aba_origem);
    if (filters.centralizador && filters.centralizador !== "todos") {
      if (filters.centralizador === "__sem__") query = query.or("centralizador.is.null,centralizador.eq.");
      else query = query.eq("centralizador", filters.centralizador);
    }
    if (filters.benner === "sim") query = query.eq("benner_atualizado", true);
    else if (filters.benner === "nao") query = query.or("benner_atualizado.is.null,benner_atualizado.eq.false");
    if (filters.dossieStatus === "preenchido") query = query.not("dossie", "is", null).neq("dossie", "");
    else if (filters.dossieStatus === "nao_preenchido") query = query.or("dossie.is.null,dossie.eq.");
    else if (filters.dossieStatus === "valido") query = query.like("dossie", "__.__.___.______%/__");
    else if (filters.dossieStatus === "invalido") query = query.not("dossie", "is", null).neq("dossie", "").not("dossie", "like", "__.__.___.______%/__");
    else if (filters.dossieStatus === "invalido_ou_nao_preenchido") query = query.or("dossie.is.null,dossie.eq.,dossie.not.like.__.__.___.______%/__");
    const CNJ_REGEX = "^[0-9]{7}-[0-9]{2}\\.[0-9]{4}\\.[0-9]\\.[0-9]{2}\\.[0-9]{4}$";
    if (filters.processoStatus === "valido") query = query.filter("processo", "match", CNJ_REGEX);
    else if (filters.processoStatus === "invalido") query = query.or(`processo.is.null,processo.eq.,processo.not.match."${CNJ_REGEX}"`);
    if (filters.judit === "sim") query = query.eq("judit_preenchido", true);
    else if (filters.judit === "nao") query = query.or("judit_preenchido.is.null,judit_preenchido.eq.false");
    if (filters.erroJudit === "sim") query = query.eq("erro_judit", true);
    else if (filters.erroJudit === "nao") query = query.or("erro_judit.is.null,erro_judit.eq.false");
    if (filters.situacaoProcesso === "ativo") {
      query = query.ilike("situacao_processo", "ativo").or("transito_julgado.is.null,transito_julgado.eq.false");
    } else if (filters.situacaoProcesso === "transito") {
      query = query.eq("transito_julgado", true);
    } else if (filters.situacaoProcesso === "outros") {
      query = query.or("situacao_processo.is.null,situacao_processo.not.ilike.ativo").or("transito_julgado.is.null,transito_julgado.eq.false");
    } else if (filters.situacaoProcesso === "outro_escritorio") {
      query = query.eq("processo_outro_escritorio", true);
    } else if (filters.situacaoProcesso === "segredo_justica") {
      query = query.eq("segredo_justica", true);
    } else if (filters.situacaoProcesso === "a_fazer") {
      query = query
        .or("transito_julgado.is.null,transito_julgado.eq.false")
        .or("processo_outro_escritorio.is.null,processo_outro_escritorio.eq.false")
        .or("segredo_justica.is.null,segredo_justica.eq.false")
        .or("status.is.null,status.neq.pronto_envio");
    }
    if (filters.subidaMassa === "sim") query = query.eq("subida_em_massa", true);
    else if (filters.subidaMassa === "nao") query = query.or("subida_em_massa.is.null,subida_em_massa.eq.false");
    if (filters.processo) query = query.ilike("processo", `%${filters.processo}%`);
    if (filters.dossie) query = query.ilike("dossie", `%${filters.dossie}%`);
    if (filters.turma) query = query.ilike("turma", `%${filters.turma}%`);
    if (filters.relator) query = query.ilike("relator", `%${filters.relator}%`);
    if (filters.parte) query = query.ilike("recorrente", `%${filters.parte}%`);
    if (filters.nomeParte) {
      const escaped = filters.nomeParte.replace(/[,()]/g, " ").trim();
      query = query.or(`reclamante.ilike.%${escaped}%,reclamada.ilike.%${escaped}%`);
    }
    if (filters.mesAno === "sem-data") {
      query = query.is("data_distribuicao_real", null);
    } else if (filters.mesAno && filters.mesAno !== "todos") {
      const start = `${filters.mesAno}-01`;
      const [y, m] = filters.mesAno.split("-").map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      query = query.gte("data_distribuicao_real", start).lt("data_distribuicao_real", nextMonth);
    }
    if (filters.dataInicio) query = query.gte("data_distribuicao_real", filters.dataInicio);
    if (filters.dataFim) query = query.lte("data_distribuicao_real", filters.dataFim);
    if (filters.semTurma) query = query.or("turma.is.null,turma.eq.");
    if (filters.status && filters.status !== "todos") query = query.eq("status", filters.status);
    if (filters.emAnalise === "sim") query = query.eq("em_analise", true);
    else if (filters.emAnalise === "nao") {
      query = query.or("em_analise.is.null,em_analise.eq.false").or("analisado.is.null,analisado.eq.false");
    }
    else if (filters.emAnalise === "analisado") query = query.eq("analisado", true);
    if (filters.problemaJudit === "sim") query = query.eq("problema_judit", true);
    else if (filters.problemaJudit === "nao") query = query.or("problema_judit.is.null,problema_judit.eq.false");
    if (filters.duplicado === "sim" && duplicateIds) query = query.in("id", duplicateIds);
    else if (filters.duplicado === "nao") query = query.or("ic_duplicado.is.null,ic_duplicado.eq.false");
    if (filters.fonteImportacao && filters.fonteImportacao !== "todas") {
      query = query.contains("fontes_importacao", [filters.fonteImportacao]);
    }
    if (filters.provasDigitais === "sim") query = query.ilike("provas_digitais", "s");
    else if (filters.provasDigitais === "nao") query = query.ilike("provas_digitais", "n");
    else if (filters.provasDigitais === "nao_selecionado") query = query.or("provas_digitais.is.null,provas_digitais.eq.");
    if (filters.situacaoEnvioCargaId && filters.situacaoEnvioCargaId !== "todas") {
      if (filters.situacaoEnvioCargaId === "__sem__") {
        query = query.is("situacao_envio_carga_id", null);
      } else {
        query = query.eq("situacao_envio_carga_id", filters.situacaoEnvioCargaId);
      }
    }
    if (filters.equipe === "sim") query = query.filter("equipe", "match", "[^[:space:]]");
    else if (filters.equipe === "nao") query = query.or('equipe.is.null,equipe.match."^[[:space:]]*$"');

    if (filters.idsAllowed && filters.idsAllowed.length > 0) {
      query = query.in("id", filters.idsAllowed);
    }

    query = query.range(from, from + PAGE - 1);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data as any[]) || [];
    for (const r of rows) all.push(r.id);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  // Dedup (join inner pode trazer duplicatas)
  return Array.from(new Set(all));
}

function hasActiveFilters(filters: DistribuicaoTstFilters): boolean {
  if (filters.processo) return true;
  if (filters.dossie) return true;
  if (filters.turma) return true;
  if (filters.relator) return true;
  if (filters.parte) return true;
  if (filters.nomeParte) return true;
  if (filters.aba_origem && filters.aba_origem !== "todas") return true;
  if (filters.benner && filters.benner !== "todos") return true;
  if (filters.dossieStatus && filters.dossieStatus !== "todos") return true;
  if (filters.processoStatus && filters.processoStatus !== "todos") return true;
  if (filters.judit && filters.judit !== "todos") return true;
  if (filters.erroJudit && filters.erroJudit !== "todos") return true;
  if (filters.situacaoProcesso && filters.situacaoProcesso !== "todos") return true;
  if (filters.subidaMassa && filters.subidaMassa !== "todos") return true;
  if (filters.mesAno && filters.mesAno !== "todos") return true;
  if (filters.dataInicio) return true;
  if (filters.dataFim) return true;
  if (filters.responsavelIds && filters.responsavelIds.length > 0) return true;
  if (filters.semTurma) return true;
  if (filters.status && filters.status !== "todos") return true;
  if (filters.emAnalise && filters.emAnalise !== "todos") return true;
  if (filters.problemaJudit && filters.problemaJudit !== "todos") return true;
  if (filters.duplicado && filters.duplicado !== "todos") return true;
  if (filters.centralizador && filters.centralizador !== "todos") return true;
  if (filters.fonteImportacao && filters.fonteImportacao !== "todas") return true;
  if (filters.provasDigitais && filters.provasDigitais !== "todos") return true;
  if (filters.situacaoEnvioCargaId && filters.situacaoEnvioCargaId !== "todas") return true;
  if (filters.equipe && filters.equipe !== "todos") return true;
  if (filters.idsAllowed && filters.idsAllowed.length > 0) return true;
  return false;
}

export function useDistribuicoesTst(filters: DistribuicaoTstFilters = {}, stickyId?: string | null) {
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

    let idsWithoutResponsavel: string[] | null = null;
    if (wantsUnassigned) {
      // Otimização: usa a coluna denormalizada `tem_responsavel` mantida por
      // trigger em vez de carregar todos os IDs e percorrer em chunks.
      // Não precisamos popular idsWithoutResponsavel — o filtro é aplicado
      // diretamente em buildQuery via .eq("tem_responsavel", false).
    }

    const selectClause = hasResponsavelFilter
      ? "*, dados_benner_responsaveis!inner(usuario_id)"
      : "*";

    // "Apenas duplicados": traz todos os IDs dos processos que têm pares reais,
    // ordenados por processo, para identificar e arquivar manualmente.
    let duplicateIds: string[] | null = null;
    let duplicateArchivedRows: any[] = [];
    if (filters.duplicado === "sim") {
      try {
        const grp = await fetchDuplicateGroups();
        duplicateIds = grp.activeIds;
        duplicateArchivedRows = grp.archivedRows;
      } catch (e: any) {
        toast.error("Erro ao buscar processos duplicados: " + (e?.message || e));
        setLoading(false);
        return;
      }
      if (duplicateIds.length === 0 && duplicateArchivedRows.length === 0) {
        setDados([]);
        setTotalCount(0);
        setResponsaveisMap(new Map());
        setLoading(false);
        return;
      }
    }

    // Build fresh query with all filters applied; optionally restricted to a chunk of IDs.
    const buildQuery = (chunkIds: string[] | null, withCount: boolean) => {
      let query: any = supabase
        .from("dados_benner" as any)
        .select(selectClause, withCount ? { count: "exact" } : undefined)
        .not("aba_origem", "is", null);

      if (filters.duplicado === "sim") {
        query = query.order("processo", { ascending: true, nullsFirst: false });
      } else if (filters.emAnalise === "sim") {
        query = query.order("em_analise_em", { ascending: true, nullsFirst: false });
      } else if (!hasActiveFilters(filters)) {
        query = query
          .order("data_distribuicao_real", { ascending: false, nullsFirst: false })
          .order("processo", { ascending: true, nullsFirst: false });
      } else {
        query = query
          .order("updated_at", { ascending: false, nullsFirst: false })
          .order("processo", { ascending: true, nullsFirst: false });
      }

      if (hasResponsavelFilter) {
        query = query.in("dados_benner_responsaveis.usuario_id", realRespIds);
      }
      if (wantsUnassigned) {
        query = query.eq("tem_responsavel", false);
      }
      if (chunkIds) query = query.in("id", chunkIds);

      if (filters.aba_origem && filters.aba_origem !== "todas") query = query.eq("aba_origem", filters.aba_origem);
    if (filters.centralizador && filters.centralizador !== "todos") {
      if (filters.centralizador === "__sem__") query = query.or("centralizador.is.null,centralizador.eq.");
      else query = query.eq("centralizador", filters.centralizador);
    }
    if (filters.benner === "sim") query = query.eq("benner_atualizado", true);
    else if (filters.benner === "nao") query = query.or("benner_atualizado.is.null,benner_atualizado.eq.false");
    if (filters.dossieStatus === "preenchido") query = query.not("dossie", "is", null).neq("dossie", "");
    else if (filters.dossieStatus === "nao_preenchido") query = query.or("dossie.is.null,dossie.eq.");
    else if (filters.dossieStatus === "valido") query = query.like("dossie", "__.__.___.______%/__");
    else if (filters.dossieStatus === "invalido") query = query.not("dossie", "is", null).neq("dossie", "").not("dossie", "like", "__.__.___.______%/__");
    else if (filters.dossieStatus === "invalido_ou_nao_preenchido") query = query.or("dossie.is.null,dossie.eq.,dossie.not.like.__.__.___.______%/__");
    // Processo CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (somente dígitos)
    const CNJ_REGEX = "^[0-9]{7}-[0-9]{2}\\.[0-9]{4}\\.[0-9]\\.[0-9]{2}\\.[0-9]{4}$";
    if (filters.processoStatus === "valido") query = query.filter("processo", "match", CNJ_REGEX);
    else if (filters.processoStatus === "invalido") query = query.or(`processo.is.null,processo.eq.,processo.not.match."${CNJ_REGEX}"`);
    if (filters.judit === "sim") query = query.eq("judit_preenchido", true);
    else if (filters.judit === "nao") query = query.or("judit_preenchido.is.null,judit_preenchido.eq.false");
    if (filters.erroJudit === "sim") query = query.eq("erro_judit", true);
    else if (filters.erroJudit === "nao") query = query.or("erro_judit.is.null,erro_judit.eq.false");
    if (filters.situacaoProcesso === "ativo") {
      query = query.ilike("situacao_processo", "ativo").or("transito_julgado.is.null,transito_julgado.eq.false");
    } else if (filters.situacaoProcesso === "transito") {
      query = query.eq("transito_julgado", true);
    } else if (filters.situacaoProcesso === "outros") {
      query = query.or("situacao_processo.is.null,situacao_processo.not.ilike.ativo").or("transito_julgado.is.null,transito_julgado.eq.false");
    } else if (filters.situacaoProcesso === "outro_escritorio") {
      query = query.eq("processo_outro_escritorio", true);
    } else if (filters.situacaoProcesso === "segredo_justica") {
      query = query.eq("segredo_justica", true);
    } else if (filters.situacaoProcesso === "a_fazer") {
      query = query
        .or("transito_julgado.is.null,transito_julgado.eq.false")
        .or("processo_outro_escritorio.is.null,processo_outro_escritorio.eq.false")
        .or("segredo_justica.is.null,segredo_justica.eq.false")
        .or("status.is.null,status.neq.pronto_envio");
    }
    if (filters.subidaMassa === "sim") query = query.eq("subida_em_massa", true);
    else if (filters.subidaMassa === "nao") query = query.or("subida_em_massa.is.null,subida_em_massa.eq.false");
    if (filters.processo) query = query.ilike("processo", `%${filters.processo}%`);
    if (filters.dossie) query = query.ilike("dossie", `%${filters.dossie}%`);
    if (filters.turma) query = query.ilike("turma", `%${filters.turma}%`);
    if (filters.relator) query = query.ilike("relator", `%${filters.relator}%`);
    if (filters.parte) query = query.ilike("recorrente", `%${filters.parte}%`);
    if (filters.nomeParte) {
      const escaped = filters.nomeParte.replace(/[,()]/g, " ").trim();
      query = query.or(`reclamante.ilike.%${escaped}%,reclamada.ilike.%${escaped}%`);
    }
    if (filters.mesAno === "sem-data") {
      query = query.is("data_distribuicao_real", null);
    } else if (filters.mesAno && filters.mesAno !== "todos") {
      const start = `${filters.mesAno}-01`;
      const [y, m] = filters.mesAno.split("-").map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      query = query.gte("data_distribuicao_real", start).lt("data_distribuicao_real", nextMonth);
    }
    if (filters.dataInicio) query = query.gte("data_distribuicao_real", filters.dataInicio);
    if (filters.dataFim) query = query.lte("data_distribuicao_real", filters.dataFim);
    if (filters.semTurma) query = query.or("turma.is.null,turma.eq.");
    if (filters.status && filters.status !== "todos") query = query.eq("status", filters.status);
    if (filters.emAnalise === "sim") query = query.eq("em_analise", true);
    else if (filters.emAnalise === "nao") {
      query = query.or("em_analise.is.null,em_analise.eq.false").or("analisado.is.null,analisado.eq.false");
    }
    else if (filters.emAnalise === "analisado") query = query.eq("analisado", true);
    if (filters.problemaJudit === "sim") query = query.eq("problema_judit", true);
    else if (filters.problemaJudit === "nao") query = query.or("problema_judit.is.null,problema_judit.eq.false");
    if (filters.duplicado === "sim" && duplicateIds && !chunkIds) query = query.in("id", duplicateIds);
    else if (filters.duplicado === "nao") query = query.or("ic_duplicado.is.null,ic_duplicado.eq.false");
    if (filters.fonteImportacao && filters.fonteImportacao !== "todas") {
      query = query.contains("fontes_importacao", [filters.fonteImportacao]);
    }
    if (filters.provasDigitais === "sim") query = query.ilike("provas_digitais", "s");
    else if (filters.provasDigitais === "nao") query = query.ilike("provas_digitais", "n");
    else if (filters.provasDigitais === "nao_selecionado") query = query.or("provas_digitais.is.null,provas_digitais.eq.");
    if (filters.situacaoEnvioCargaId && filters.situacaoEnvioCargaId !== "todas") {
      if (filters.situacaoEnvioCargaId === "__sem__") {
        query = query.is("situacao_envio_carga_id", null);
      } else {
        query = query.eq("situacao_envio_carga_id", filters.situacaoEnvioCargaId);
      }
    }
    if (filters.equipe === "sim") query = query.filter("equipe", "match", "[^[:space:]]");
    else if (filters.equipe === "nao") query = query.or('equipe.is.null,equipe.match."^[[:space:]]*$"');
      return query;
    };

    let rawRows: any[] = [];
    let count = 0;

    // Curto-circuito: se idsAllowed foi explicitamente passado e estiver vazio,
    // não há resultados possíveis.
    if (filters.idsAllowed && filters.idsAllowed.length === 0) {
      setDados([]);
      setTotalCount(0);
      setResponsaveisMap(new Map());
      setLoading(false);
      return;
    }

    // Determina o conjunto de IDs alvo a ser percorrido em chunks (evita URL gigante).
    // Combina "sem responsável" (wantsUnassigned) e o filtro de TAGs (idsAllowed).
    let chunkSource: string[] | null = null;
    if (filters.idsAllowed && filters.idsAllowed.length > 0) {
      chunkSource = filters.idsAllowed;
    }
    if (duplicateIds) {
      const dupSet = new Set(duplicateIds);
      chunkSource = chunkSource
        ? chunkSource.filter((id) => dupSet.has(id))
        : duplicateIds;
    }

    if (chunkSource) {
      if (chunkSource.length === 0 && duplicateArchivedRows.length === 0) {
        setDados([]);
        setTotalCount(0);
        setResponsaveisMap(new Map());
        setLoading(false);
        return;
      }
      // URL com muitos UUIDs estoura ("Failed to fetch") → executa em chunks de 200.
      const CHUNK = 200;
      const chunks: string[][] = [];
      for (let i = 0; i < chunkSource.length; i += CHUNK) {
        chunks.push(chunkSource.slice(i, i + CHUNK));
      }
      const results = chunks.length > 0
        ? await Promise.all(chunks.map((c) => buildQuery(c, false)))
        : [];
      const merged: any[] = [];
      for (const res of results) {
        if (res.error) {
          toast.error("Erro ao carregar distribuições: " + res.error.message);
          setLoading(false);
          return;
        }
        for (const r of (res.data as any[]) || []) merged.push(r);
      }
      // Anexa registros arquivados duplicados (quando filtro = "Apenas duplicados").
      if (filters.duplicado === "sim" && duplicateArchivedRows.length > 0) {
        for (const a of duplicateArchivedRows) {
          const snap = (a.snapshot && typeof a.snapshot === "object") ? a.snapshot : {};
          merged.push({
            ...snap,
            id: a.id,
            processo: a.processo ?? snap.processo ?? null,
            dossie: a.dossie ?? snap.dossie ?? null,
            aba_origem: a.aba_origem ?? snap.aba_origem ?? null,
            coordenacao_id: a.coordenacao_id ?? snap.coordenacao_id ?? null,
            updated_at: a.arquivado_em ?? snap.updated_at ?? null,
            created_at: snap.created_at ?? a.arquivado_em ?? null,
            ic_arquivado: true,
          });
        }
      }
      // Reordena conforme a ordem global escolhida
      merged.sort((a, b) => {
        if (filters.duplicado === "sim") {
          const av = a.processo ?? "";
          const bv = b.processo ?? "";
          if (av === bv) return 0;
          return av > bv ? 1 : -1;
        }
        if (filters.emAnalise === "sim") {
          const av = a.em_analise_em ?? "";
          const bv = b.em_analise_em ?? "";
          if (av === bv) return 0;
          return av > bv ? 1 : -1;
        }
        // Padrão: salvos primeiro (updated_at desc), depois por número do processo (asc)
        const av = a.updated_at ?? "";
        const bv = b.updated_at ?? "";
        if (av !== bv) return av > bv ? -1 : 1;
        const ap = a.processo ?? "";
        const bp = b.processo ?? "";
        if (ap === bp) return 0;
        return ap > bp ? 1 : -1;
      });
      count = merged.length;
      const from = (page - 1) * PAGE_SIZE;
      rawRows = merged.slice(from, from + PAGE_SIZE);
    } else {
      const from = (page - 1) * PAGE_SIZE;
      const query = buildQuery(null, true).range(from, from + PAGE_SIZE - 1);
      const { data, error, count: c } = await query;
      if (error) {
        toast.error("Erro ao carregar distribuições: " + error.message);
        setLoading(false);
        return;
      }
      rawRows = (data as any[]) || [];
      count = c || 0;
    }

    let rows = rawRows.map(bennerToDistribuicao);
    if (filters.duplicado === "sim") {
      rows = rows.map((row) => ({ ...row, ic_duplicado: true }));
    }
    setTotalCount(count);

    // Se houver um registro recém-editado (sticky) que NÃO bate mais com
    // os filtros atuais, busca-o à parte e prepende na lista para que a
    // advogada continue vendo o que acabou de salvar.
    if (stickyId && !rows.some((r) => r.id === stickyId)) {
      const { data: stickyData } = await supabase
        .from("dados_benner" as any)
        .select("*")
        .eq("id", stickyId)
        .maybeSingle();
      if (stickyData) {
        rows = [bennerToDistribuicao(stickyData as any), ...rows];
      }
    }
    setDados(rows);

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
  }, [page, JSON.stringify(filters), stickyId || ""]);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const filtersKey = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [filtersKey]);

  const saveDado = async (dado: DistribuicaoTstInsert, id?: string): Promise<boolean | string> => {
    const payload = distribuicaoToBenner(dado);
    const shouldPersistResponsaveis = Array.isArray(dado.responsaveis_ids);
    const responsaveisIds = shouldPersistResponsaveis ? (dado.responsaveis_ids || []) : [];
    let rowId = id;
    if (!payload.aba_origem) payload.aba_origem = "Manual";

    // Estratégia: quando há id, salva EXCLUSIVAMENTE a linha ativa exata. Isso
    // permite alterar também processo/dossiê sem tocar em duplicatas legadas.
    let savedRowId: string | null = null;

    if (id) {
      const { data: updatedById, error } = await supabase
        .from("dados_benner" as any)
        .update(payload as any)
        .eq("id", id)
        .select("id");
      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
      const rowsById = (updatedById as any[]) || [];
      if (rowsById.length > 0) {
        savedRowId = rowsById[0].id;
        rowId = savedRowId;
      }
      if (!savedRowId) {
        toast.error("Nenhum registro ativo encontrado para este id. A alteração não foi salva.");
        return false;
      }
    }

    // IMPORTANTE: NÃO usar mais (processo, dossiê) como chave de UPDATE.
    // A base contém duplicatas legadas (mesmo processo, dossiês iguais ou um
    // deles vazio) e atualizar por processo/dossiê acaba salvando na linha
    // errada — ou em várias linhas — silenciosamente. Enquanto a base não for
    // higienizada, qualquer save sem `id` é tratado como inserção nova.
    if (!savedRowId && !id) {
      // Não havia linha ativa: insere uma nova.
      payload.status = "rascunho";
      const { data: ins, error } = await supabase.from("dados_benner" as any).insert(payload as any).select("id").single();
      if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
      rowId = (ins as any)?.id;
    }
    // Persist responsáveis apenas quando o formulário já terminou de carregá-los.
    if (rowId && shouldPersistResponsaveis) {
      await supabase.from("dados_benner_responsaveis" as any).delete().eq("dados_benner_id", rowId);
      if (responsaveisIds.length > 0) {
        await supabase.from("dados_benner_responsaveis" as any).insert(
          responsaveisIds.map(uid => ({ dados_benner_id: rowId, usuario_id: uid })) as any
        );
      }
    }
    await fetchDados();
    // Retorna o id (novo ou existente) para que callers possam abrir abas dependentes
    // imediatamente após o auto-save (ex.: botão Judit em "Novo registro").
    return rowId || true;
  };

  const deleteDado = async (id: string) => {
    const { error } = await supabase.rpc("arquivar_dados_benner" as any, { _id: id });
    if (error) { toast.error("Erro ao arquivar: " + error.message); return false; }
    toast.success("Registro arquivado! Apenas administradores podem restaurá-lo.");
    fetchDados();
    return true;
  };

  return { dados, responsaveisMap, loading, fetchDados, saveDado, deleteDado, page, setPage, totalCount, totalPages };
}

/**
 * Conta linhas por mês (YYYY-MM) da `data_distribuicao_real` aplicando os
 * mesmos filtros do hook principal — exceto `mesAno`, para que o dropdown
 * mostre todos os meses disponíveis dentro do recorte atual.
 * Pagina por 1000 e agrupa em memória.
 */
export async function fetchMesesDataRealFiltered(
  filters: DistribuicaoTstFilters
): Promise<{ key: string; count: number }[]> {
  const f: DistribuicaoTstFilters = { ...filters, mesAno: undefined };

  const UNASSIGNED = "__sem_responsavel__";
  const respIds = f.responsavelIds || [];
  const wantsUnassigned = respIds.includes(UNASSIGNED);
  const realRespIds = respIds.filter((id) => id !== UNASSIGNED);
  const hasResponsavelFilter = realRespIds.length > 0;

  let duplicateIds: string[] | null = null;
  if (f.duplicado === "sim") {
    duplicateIds = await fetchDuplicateDistribuicaoTstIds();
    if (duplicateIds.length === 0) return [];
  }

  const selectClause = hasResponsavelFilter
    ? "id, data_distribuicao_real, dados_benner_responsaveis!inner(usuario_id)"
    : "id, data_distribuicao_real";

  const counts = new Map<string, number>();
  const seen = new Set<string>();
  const PAGE = 1000;
  let from = 0;
  while (true) {
    let query = supabase
      .from("dados_benner" as any)
      .select(selectClause)
      .not("aba_origem", "is", null)
      .order("id", { ascending: true });

    if (hasResponsavelFilter) query = query.in("dados_benner_responsaveis.usuario_id", realRespIds);
    if (wantsUnassigned) query = query.eq("tem_responsavel", false);

    if (f.aba_origem && f.aba_origem !== "todas") query = query.eq("aba_origem", f.aba_origem);
    if (f.centralizador && f.centralizador !== "todos") {
      if (f.centralizador === "__sem__") query = query.or("centralizador.is.null,centralizador.eq.");
      else query = query.eq("centralizador", f.centralizador);
    }
    if (f.benner === "sim") query = query.eq("benner_atualizado", true);
    else if (f.benner === "nao") query = query.or("benner_atualizado.is.null,benner_atualizado.eq.false");
    if (f.dossieStatus === "preenchido") query = query.not("dossie", "is", null).neq("dossie", "");
    else if (f.dossieStatus === "nao_preenchido") query = query.or("dossie.is.null,dossie.eq.");
    else if (f.dossieStatus === "valido") query = query.like("dossie", "__.__.___.______%/__");
    else if (f.dossieStatus === "invalido") query = query.not("dossie", "is", null).neq("dossie", "").not("dossie", "like", "__.__.___.______%/__");
    else if (f.dossieStatus === "invalido_ou_nao_preenchido") query = query.or("dossie.is.null,dossie.eq.,dossie.not.like.__.__.___.______%/__");
    const CNJ_REGEX = "^[0-9]{7}-[0-9]{2}\\.[0-9]{4}\\.[0-9]\\.[0-9]{2}\\.[0-9]{4}$";
    if (f.processoStatus === "valido") query = query.filter("processo", "match", CNJ_REGEX);
    else if (f.processoStatus === "invalido") query = query.or(`processo.is.null,processo.eq.,processo.not.match."${CNJ_REGEX}"`);
    if (f.judit === "sim") query = query.eq("judit_preenchido", true);
    else if (f.judit === "nao") query = query.or("judit_preenchido.is.null,judit_preenchido.eq.false");
    if (f.erroJudit === "sim") query = query.eq("erro_judit", true);
    else if (f.erroJudit === "nao") query = query.or("erro_judit.is.null,erro_judit.eq.false");
    if (f.situacaoProcesso === "ativo") {
      query = query.ilike("situacao_processo", "ativo").or("transito_julgado.is.null,transito_julgado.eq.false");
    } else if (f.situacaoProcesso === "transito") {
      query = query.eq("transito_julgado", true);
    } else if (f.situacaoProcesso === "outros") {
      query = query.or("situacao_processo.is.null,situacao_processo.not.ilike.ativo").or("transito_julgado.is.null,transito_julgado.eq.false");
    } else if (f.situacaoProcesso === "outro_escritorio") {
      query = query.eq("processo_outro_escritorio", true);
    } else if (f.situacaoProcesso === "segredo_justica") {
      query = query.eq("segredo_justica", true);
    } else if (f.situacaoProcesso === "a_fazer") {
      query = query
        .or("transito_julgado.is.null,transito_julgado.eq.false")
        .or("processo_outro_escritorio.is.null,processo_outro_escritorio.eq.false")
        .or("segredo_justica.is.null,segredo_justica.eq.false")
        .or("status.is.null,status.neq.pronto_envio");
    }
    if (f.subidaMassa === "sim") query = query.eq("subida_em_massa", true);
    else if (f.subidaMassa === "nao") query = query.or("subida_em_massa.is.null,subida_em_massa.eq.false");
    if (f.processo) query = query.ilike("processo", `%${f.processo}%`);
    if (f.dossie) query = query.ilike("dossie", `%${f.dossie}%`);
    if (f.turma) query = query.ilike("turma", `%${f.turma}%`);
    if (f.relator) query = query.ilike("relator", `%${f.relator}%`);
    if (f.parte) query = query.ilike("recorrente", `%${f.parte}%`);
    if (f.nomeParte) {
      const escaped = f.nomeParte.replace(/[,()]/g, " ").trim();
      query = query.or(`reclamante.ilike.%${escaped}%,reclamada.ilike.%${escaped}%`);
    }
    if (f.dataInicio) query = query.gte("data_distribuicao_real", f.dataInicio);
    if (f.dataFim) query = query.lte("data_distribuicao_real", f.dataFim);
    if (f.semTurma) query = query.or("turma.is.null,turma.eq.");
    if (f.status && f.status !== "todos") query = query.eq("status", f.status);
    if (f.emAnalise === "sim") query = query.eq("em_analise", true);
    else if (f.emAnalise === "nao") {
      query = query.or("em_analise.is.null,em_analise.eq.false").or("analisado.is.null,analisado.eq.false");
    } else if (f.emAnalise === "analisado") query = query.eq("analisado", true);
    if (f.problemaJudit === "sim") query = query.eq("problema_judit", true);
    else if (f.problemaJudit === "nao") query = query.or("problema_judit.is.null,problema_judit.eq.false");
    if (f.duplicado === "sim" && duplicateIds) query = query.in("id", duplicateIds);
    else if (f.duplicado === "nao") query = query.or("ic_duplicado.is.null,ic_duplicado.eq.false");
    if (f.fonteImportacao && f.fonteImportacao !== "todas") {
      query = query.contains("fontes_importacao", [f.fonteImportacao]);
    }
    if (f.provasDigitais === "sim") query = query.ilike("provas_digitais", "s");
    else if (f.provasDigitais === "nao") query = query.ilike("provas_digitais", "n");
    else if (f.provasDigitais === "nao_selecionado") query = query.or("provas_digitais.is.null,provas_digitais.eq.");
    if (f.situacaoEnvioCargaId && f.situacaoEnvioCargaId !== "todas") {
      if (f.situacaoEnvioCargaId === "__sem__") {
        query = query.is("situacao_envio_carga_id", null);
      } else {
        query = query.eq("situacao_envio_carga_id", f.situacaoEnvioCargaId);
      }
    }
    if (f.equipe === "sim") query = query.filter("equipe", "match", "[^[:space:]]");
    else if (f.equipe === "nao") query = query.or('equipe.is.null,equipe.match."^[[:space:]]*$"');

    if (f.idsAllowed && f.idsAllowed.length > 0) {
      query = query.in("id", f.idsAllowed);
    }

    query = query.range(from, from + PAGE - 1);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data as any[]) || [];
    for (const r of rows) {
      // Dedup id (join inner pode duplicar linhas)
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const d = r.data_distribuicao_real;
      const key = !d || typeof d !== "string" || d.length < 7 ? "sem-data" : d.slice(0, 7);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => {
      if (a.key === "sem-data") return 1;
      if (b.key === "sem-data") return -1;
      return b.key.localeCompare(a.key);
    });
}
