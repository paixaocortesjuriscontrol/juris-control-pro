/**
 * Helpers compartilhados pelo preenchimento Judit em Distribuição TST.
 *
 * Usado por:
 *  - src/components/distribuicao-tst/DistribuicaoTstForm.tsx (botão "Judit" do
 *    formulário, registro a registro)
 *  - src/components/distribuicao-tst/DossiesNaoLocalizadosButton.tsx (botão
 *    "Judit" da geração em lote de Dossiês Não Localizados)
 *
 * Ambos DEVEM aplicar EXATAMENTE as mesmas regras: extração de partes por
 * person_type (não por polo ACTIVE/PASSIVE — que no TST é recorrente/recorrido),
 * normalização de Tipo de Recurso e Parte Recorrente, classificação automática
 * de Turma/Relator, lógica de trânsito em julgado, e persistência de anexos /
 * partes / judit_anexos / judit_logs.
 */
import { supabase } from "@/integrations/supabase/client";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { getJuditAttachmentDedupKey } from "@/lib/juditAnexosDedup";
import {
  classificarTurmaDB,
  classificarRelatorDB,
  TurmaTst,
  RelatorTst,
} from "@/hooks/useClassificacaoTst";

/** Lista fixa do dropdown MultiTipoRecurso (planilha "alterações" 2026-06). */
export const OPCOES_RECURSO_NORM = [
  "Ação Rescisória",
  "Agravo de Instrumento",
  "Agravo em Recurso Extraordinário",
  "Agravo Interno",
  "Embargos de Declaração",
  "Embargos de Divergência",
  "Embargos SDI",
  "Incidente de arguição de inconstitucionalidade",
  "Incidente de assunção de competência",
  "Incidente de recurso repetitivo",
  "Incidente de resolução de demanda repetitiva",
  "Incidente de superação e revisão dos precedentes",
  "Mandado de Segurança",
  "Medida Cautelar",
  "Reclamação",
  "Recurso de Revista",
  "Recurso de Revista com Agravo (ARR)",
  "Recurso Especial",
  "Recurso Extraordinário",
  "Recurso Ordinário",
];

/** Mapeamento de valores legados para a nova lista (planilha "alterações"). */
export const ALTERACOES_LEGADAS: Record<string, string> = {
  "agravo": "Agravo Interno",
  "agravo de instrumento em recurso de revista": "Agravo de Instrumento",
  "recurso de revista com agravo": "Agravo de Instrumento",
  "recurso ordinario em mandado de seguranca": "Recurso Ordinário",
  "embargos a sdi": "Embargos SDI",
  "agravo regimental": "Agravo Interno",
  "recurso ordinario trabalhista": "Recurso Ordinário",
  "recurso ordinario em procedimento sumarissimo": "Recurso Ordinário",
  "recurso ordinario em acao rescisoria": "Ação Rescisória",
};

export const SIGLAS_RECURSO: Record<string, string> = {
  // TST
  rr: "Recurso de Revista",
  rrag: "Agravo de Instrumento",
  arr: "Agravo de Instrumento",
  ararr: "Agravo de Instrumento",
  airr: "Agravo de Instrumento",
  aiarr: "Agravo de Instrumento",
  e: "Embargos SDI",
  esdi: "Embargos SDI",
  ediv: "Embargos de Divergência",
  err: "Embargos de Declaração",
  // TRT
  ro: "Recurso Ordinário",
  rot: "Recurso Ordinário",
  rotsum: "Recurso Ordinário",
  rops: "Recurso Ordinário",
  roms: "Recurso Ordinário",
  roar: "Ação Rescisória",
  ar: "Ação Rescisória",
  // Embargos
  ed: "Embargos de Declaração",
  edcl: "Embargos de Declaração",
  // Agravos
  ag: "Agravo Interno",
  agr: "Agravo Interno",
  agint: "Agravo Interno",
  agi: "Agravo Interno",
  ai: "Agravo de Instrumento",
  // Cortes superiores
  re: "Recurso Extraordinário",
  are: "Agravo em Recurso Extraordinário",
  resp: "Recurso Especial",
  aresp: "Agravo em Recurso Extraordinário",
  // Outros
  ms: "Mandado de Segurança",
  mc: "Medida Cautelar",
  rcl: "Reclamação",
};

export function normalizarTipoRecurso(raw: any): string | null {
  if (raw == null) return null;
  const txt = String(raw).trim();
  if (!txt) return null;
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const partes: string[] = [];
  for (const bloco of txt.split(/\s*\+\s*/)) {
    const b = bloco.trim();
    if (!b) continue;
    const subs = b.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
    if (subs.length > 1 && subs.every((s) => SIGLAS_RECURSO[norm(s)])) {
      partes.push(...subs);
    } else {
      partes.push(b);
    }
  }
  const mapped: string[] = [];
  const vistos = new Set<string>();
  for (const p of partes) {
    const alvo = norm(p);
    let nome = SIGLAS_RECURSO[alvo];
    if (!nome) {
      const hit = OPCOES_RECURSO_NORM.find((opt) => norm(opt) === alvo);
      nome = hit || p;
    }
    // Aplica mapeamento de valores legados (planilha "alterações")
    const legada = ALTERACOES_LEGADAS[norm(nome)];
    if (legada) nome = legada;
    const k = norm(nome);
    if (vistos.has(k)) continue;
    vistos.add(k);
    mapped.push(nome);
  }
  return mapped.length ? mapped.join(" + ") : null;
}

export function normalizarParteRecorrente(
  recorrenteRaw: any,
  reclamante: string,
  reclamada: string,
): string | null {
  if (recorrenteRaw == null) return null;
  const txt = String(recorrenteRaw).trim();
  if (!txt) return null;
  const baixo = txt.toLowerCase();
  if (baixo === "reclamante") return "Reclamante";
  if (baixo === "reclamada" || baixo === "reclamado") return "Reclamada";
  if (/reclamante\s+e\s+reclamad/.test(baixo)) return "Reclamante e Reclamada";
  if (baixo === "terceiro") return "Terceiro";
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokens = (s: string) => norm(s).split(/[\s,/]+/).filter((t) => t.length >= 3);
  const recList = txt.split(/\s*[,/]\s*/).map((s) => s.trim()).filter(Boolean);
  const recTokens = recList.flatMap(tokens);
  const reclTokens = new Set(tokens(reclamante || ""));
  const readTokens = new Set(tokens(reclamada || ""));
  let bateRecl = false;
  let bateRead = false;
  for (const t of recTokens) {
    if (reclTokens.has(t)) bateRecl = true;
    if (readTokens.has(t)) bateRead = true;
  }
  if (bateRecl && bateRead) return "Reclamante e Reclamada";
  if (bateRecl) return "Reclamante";
  if (bateRead) return "Reclamada";
  return "Terceiro";
}

export function normalizarValorPorCampo(
  campo: string,
  valor: any,
  reclamante: string,
  reclamada: string,
): any {
  if (valor === null || valor === undefined) return valor;
  if (
    campo === "tipo_recurso" ||
    campo === "tipo_recurso_reclamante" ||
    campo === "tipo_recurso_banco" ||
    campo === "tipo_recurso_terceiro"
  ) {
    return normalizarTipoRecurso(valor);
  }
  if (campo === "parte_recorrente") {
    return normalizarParteRecorrente(valor, reclamante, reclamada);
  }
  return valor;
}

export function isTurmaOficialTst(t: string | null | undefined): boolean {
  if (!t) return false;
  const norm = String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return /^[1-8][ªa]?\s*turma$/.test(norm);
}

/** Extrai reclamante / reclamada da Judit usando EXATAMENTE a mesma regra do
 *  formulário: prioriza `data.reclamante`/`data.reclamada` (já desambiguados
 *  pelo backend) e cai para `person_type` (RECLAMANTE/AUTOR/REQUERENTE/etc.).
 *  NUNCA usa polo ACTIVE/PASSIVE — no TST significa recorrente/recorrido. */
export function extrairReclamanteReclamada(juditData: any) {
  const partes = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];
  const nomesPorPersonType = (re: RegExp) =>
    [...new Set(
      partes
        .filter((p: any) => !p?.is_advogado && re.test(String(p?.tipo_pessoa || "")))
        .map((p: any) => String(p?.nome || "").trim())
        .filter(Boolean),
    )].join(" / ");
  const reclamante =
    (juditData?.reclamante && String(juditData.reclamante).trim()) ||
    nomesPorPersonType(/RECLAMANTE|AUTOR|EXEQUENTE|REQUERENTE/i) ||
    "";
  const reclamada =
    (juditData?.reclamada && String(juditData.reclamada).trim()) ||
    nomesPorPersonType(/RECLAMAD|R[ÉE]U|EXECUTAD|REQUERID/i) ||
    "";
  return { reclamante, reclamada };
}

/** Documentos (CPF/CNPJ) das partes ativas reais (reclamante após
 *  desambiguação por person_type), formatados. */
export function extrairDocumentosReclamante(juditData: any, reclamanteJoined: string): string {
  const partes = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];
  const nomes = new Set(
    String(reclamanteJoined || "")
      .split(/\s*\/\s*/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (nomes.size === 0) return "";
  const docs = [...new Set(
    partes
      .filter((p: any) => !p?.is_advogado && nomes.has(String(p?.nome || "").trim()))
      .map((p: any) => formatDoc(p?.documento))
      .filter((s: string) => !!s),
  )];
  return docs.join("; ");
}

export function formatDoc(doc: string | null | undefined): string {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return String(doc || "");
}

/** Resumo Ativo/Passivo da Judit (usado para o campo `recorrente`). */
export function getJuditPartesResumo(juditData: any, fallback?: string | null) {
  const parties = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];
  const nonLawyers = parties.filter((p: any) => p?.nome && !p?.is_advogado);
  const ativos = [...new Set(nonLawyers
    .filter((p: any) => String(p?.polo || "").toUpperCase() === "ACTIVE")
    .map((p: any) => String(p.nome).trim()).filter(Boolean))];
  const passivos = [...new Set(nonLawyers
    .filter((p: any) => String(p?.polo || "").toUpperCase() === "PASSIVE")
    .map((p: any) => String(p.nome).trim()).filter(Boolean))];
  const partes: string[] = [];
  if (ativos.length > 0) partes.push(`Ativo: ${ativos.join(", ")}`);
  if (passivos.length > 0) partes.push(`Passivo: ${passivos.join(", ")}`);
  if (partes.length > 0) return partes.join("\n");
  const r = String(juditData?.recorrente ?? "").trim();
  return r || fallback || "";
}

export interface BuildJuditPatchResult {
  patch: Record<string, any>;
  reclamante: string;
  reclamada: string;
  erroJuditFlag: boolean;
}

/**
 * Constrói o patch a ser aplicado em `dados_benner` para um registro de
 * distribuição TST, com EXATAMENTE as mesmas regras do botão Judit do form.
 *
 * @param current  registro atual (para preservar valores já existentes em
 *                 campos cujo dropdown é fixo — segue a política "Judit é
 *                 fonte da verdade: sobrescreve quando tem valor")
 */
export function buildJuditPatch(
  juditData: any,
  turmasTst: TurmaTst[],
  relatoresTst: RelatorTst[],
): BuildJuditPatchResult {
  const { reclamante, reclamada } = extrairReclamanteReclamada(juditData);

  const hasValue = (v: any) => v !== null && v !== undefined && String(v).trim() !== "";
  const patch: Record<string, any> = {};
  const apply = (field: string, novo: any) => {
    if (hasValue(novo)) patch[field] = novo;
  };

  apply("dossie", juditData?.dossie);
  apply("data_distribuicao_real", juditData?.data_distribuicao);
  apply("data_distribuicao", juditData?.data_distribuicao);
  apply("relator", juditData?.relator);
  apply("turma", juditData?.turma);

  if (patch.turma) {
    const c = classificarTurmaDB(String(patch.turma), turmasTst);
    if (c === "POSITIVO") patch.turma_favorabilidade = "POSITIVA";
    else if (c === "NEGATIVO") patch.turma_favorabilidade = "NEGATIVA";
  }
  if (patch.relator) {
    const r = classificarRelatorDB(String(patch.relator), relatoresTst);
    if (r?.classificacao === "POSITIVO") patch.relator_favorabilidade = "POSITIVO";
    else if (r?.classificacao === "NEGATIVO") patch.relator_favorabilidade = "NEGATIVO";
  }

  apply("reclamante", reclamante);
  apply("reclamada", reclamada);
  apply("parte_recorrente", normalizarParteRecorrente(juditData?.recorrente, reclamante, reclamada));
  apply("recorrente", getJuditPartesResumo(juditData, null));

  apply("tipo_recurso", normalizarTipoRecurso(juditData?.tipo_recurso));
  apply("tipo_recurso_reclamante", normalizarTipoRecurso(juditData?.tipo_recurso_reclamante));
  apply("tipo_recurso_banco", normalizarTipoRecurso(juditData?.tipo_recurso_banco));
  apply("tipo_recurso_terceiro", normalizarTipoRecurso(juditData?.tipo_recurso_terceiro));

  const situacao = (juditData?.situacao_processo || "").toString();
  if (situacao) patch.situacao_processo = situacao;
  const baixado = (juditData?.processo_baixado || "").toString().toUpperCase();
  if (baixado) patch.processo_baixado = baixado;
  const juditAtivo = /ativ|active|em\s*curso|em\s*tramita|andamento/i.test(situacao) || baixado === "N";
  const ehTransito = !juditAtivo && (/arquivad|baixad|tr[âa]nsito/i.test(situacao) || baixado === "S");
  // Precedência: detecção por movimentação (Edge Function). Fallback: heurística.
  const transitoDet = juditData?.transito_julgado_detectado;
  const dataTransitoDet = juditData?.data_transito_julgado_detectada || null;
  if (transitoDet === true) {
    patch.transito_julgado = true;
    if (dataTransitoDet) patch.data_transito_julgado = dataTransitoDet;
  } else if (transitoDet === false) {
    patch.transito_julgado = false;
    patch.data_transito_julgado = null;
  } else if (juditAtivo) {
    patch.transito_julgado = false;
    patch.data_transito_julgado = null;
  } else if (ehTransito) {
    patch.transito_julgado = true;
  }

  // Pauta / julgamento / resultados (mantidos do payload completo do batch)
  if (juditData?.tem_data_julgamento) patch.tem_data_julgamento = juditData.tem_data_julgamento;
  if (juditData?.data_julgamento) patch.data_julgamento = juditData.data_julgamento;
  if (juditData?.horario_julgamento) patch.horario_julgamento = juditData.horario_julgamento;
  if (juditData?.tipo_julgamento) patch.tipo_julgamento = juditData.tipo_julgamento;
  if (juditData?.resultado_sem_transcendencia) patch.resultado_sem_transcendencia = true;
  if (juditData?.resultado_nao_conhecido) patch.resultado_nao_conhecido = true;
  if (juditData?.resultado_conhecido_provido) patch.resultado_conhecido_provido = true;
  if (juditData?.resultado_conhecido_nao_provido) patch.resultado_conhecido_nao_provido = true;
  if (juditData?.resultado_outra) patch.resultado_outra = juditData.resultado_outra;

  const tribunaisAceitos = ["TST", "STF", "STJ"];
  if (juditData?.tribunal && tribunaisAceitos.includes(juditData.tribunal)) {
    patch.tribunal = juditData.tribunal;
  }

  const turmaFinal = patch.turma || "";
  const erroJuditFlag = !isTurmaOficialTst(turmaFinal);
  patch.erro_judit = erroJuditFlag;

  return { patch, reclamante, reclamada, erroJuditFlag };
}

/** Persiste anexos Judit (delete + insert, igual ao botão do form). */
export async function persistirJuditAnexos(
  processoNumero: string,
  attachments: any[],
  userId: string | null,
) {
  if (!attachments || attachments.length === 0) return;
  const numeroMasc = aplicarMascaraCnj(processoNumero);
  const rowsRaw = attachments.map((a: any) => ({
    processo_numero: processoNumero,
    cnj: a?.cnj || numeroMasc,
    instance: a?.instance != null ? String(a.instance) : null,
    attachment_id: String(a?.step_id || a?.attachment_id || ""),
    step_id: a?.step_id ? String(a.step_id) : null,
    attachment_name: a?.attachment_name || null,
    attachment_date: a?.attachment_date || null,
    extension: a?.extension || null,
    status: a?.status || "done",
    corrupted: a?.corrupted ?? false,
    raw_attachment: a,
    created_by: userId,
  })).filter((r: any) => r.attachment_id);
  const seen = new Set<string>();
  const rows = rowsRaw.filter((r: any) => {
    const key = getJuditAttachmentDedupKey(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (rows.length === 0) return;
  await supabase.from("judit_anexos" as any).delete().eq("processo_numero", processoNumero);
  await supabase.from("judit_anexos" as any).insert(rows);
}

/** Substitui as partes da origem 'judit' para um dados_benner. */
export async function persistirPartesJudit(bennerId: string, juditData: any) {
  const partiesDetail = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];
  if (!bennerId || partiesDetail.length === 0) return;
  await supabase
    .from("partes_processo_benner")
    .delete()
    .eq("dados_benner_id", bennerId)
    .eq("origem", "judit");
  const partesRows = partiesDetail.map((p: any) => ({
    dados_benner_id: bennerId,
    nome: p.nome || "Sem nome",
    documento: p.documento || null,
    tipo_pessoa: p.tipo_pessoa || null,
    polo: p.polo || null,
    is_advogado: !!p.is_advogado,
    origem: "judit",
  }));
  await supabase.from("partes_processo_benner").insert(partesRows);
}

/** Grava log da consulta (mesmo formato do botão do form). */
export async function gravarJuditLog(params: {
  processoNumero: string;
  tribunal: string;
  requestPayload: any;
  juditData: any;
  juditError: any;
  userId: string | null;
}) {
  try {
    await supabase.from("judit_logs" as any).insert({
      processo_numero: params.processoNumero,
      tribunal: params.tribunal,
      request_payload: params.requestPayload,
      raw_response: params.juditData ?? null,
      status: params.juditError
        ? "erro_funcao"
        : params.juditData?.error
        ? "erro_api"
        : "sucesso",
      error_message: params.juditError?.message || params.juditData?.error || null,
      created_by: params.userId,
    });
  } catch (e) {
    console.warn("Falha ao gravar judit_logs:", e);
  }
}