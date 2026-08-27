import { supabase } from "@/integrations/supabase/client";
import { format, addDays, addBusinessDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export type WorkflowItemType =
  | "PRAZO"
  | "TAREFA"
  | "AUDIENCIA"
  | "EVENTO"
  | "PARCELAMENTO";

export const WORKFLOW_ITEM_LABELS: Record<WorkflowItemType, string> = {
  PRAZO: "Prazo",
  TAREFA: "Tarefa",
  AUDIENCIA: "Audiência",
  EVENTO: "Evento",
  PARCELAMENTO: "Parcelamento",
};

export const WORKFLOW_ITEM_SITUACAO_INICIAL: Record<WorkflowItemType, string> = {
  PRAZO: "pendente",
  TAREFA: "pendente",
  AUDIENCIA: "pendente",
  EVENTO: "pendente",
  PARCELAMENTO: "pendente",
};

export interface WorkflowEtapa {
  id: string;
  workflow_id: string;
  ordem: number;
  titulo: string;
  tipo_item: WorkflowItemType;
  tipo_prazo: "dias_corridos" | "dias_uteis";
  dias_previsto: number;
  dias_fatal?: number | null;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  descricao?: string | null;
  exibir_kanban: boolean;
  regra_responsavel: "predefinido" | "etapa_anterior" | "iniciador";
  condicao: "sempre" | "sucesso_anterior";
  etapa_anterior_id?: string | null;
  responsavel_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Workflow {
  id: string;
  coordenacao_id: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  coordenacao?: { id: string; nome: string } | null;
}

export interface WorkflowExecucao {
  id: string;
  workflow_id: string;
  processo_id: string;
  iniciado_por: string | null;
  coordenacao_id: string;
  data_inicio: string;
  status: "em_andamento" | "concluido" | "cancelado";
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
  workflow?: Workflow | null;
}

export interface WorkflowExecucaoEtapa {
  id: string;
  execucao_id: string;
  etapa_id: string;
  item_id: string | null;
  item_tipo: WorkflowItemType;
  status: "pendente" | "materializada" | "concluida" | "cancelada";
  sucesso: boolean;
  ordem: number;
  data_prevista_calculada: string | null;
  data_fatal_calculada: string | null;
  created_at: string;
  updated_at: string;
  etapa?: WorkflowEtapa | null;
}

export interface IniciarWorkflowInput {
  workflow_id: string;
  processo_id?: string;
  processo_numero?: string;
  coordenacao_id?: string;
  responsavel_inicial?: string;
  observacoes?: string;
}

export function calcularDataOffset(
  base: Date,
  dias: number,
  unidade: "dias_corridos" | "dias_uteis" = "dias_corridos"
): Date {
  if (unidade === "dias_uteis") {
    return addBusinessDays(base, dias);
  }
  return addDays(base, dias);
}

export function formatarDataISOBrasilia(data: Date): string {
  const zoned = toZonedTime(data, "America/Sao_Paulo");
  return format(zoned, "yyyy-MM-dd");
}

export function formatarTimestampISOBrasilia(
  data: string,
  hora?: string | null
): string {
  const h = hora || "12:00";
  return `${data}T${h}:00-03:00`;
}

export function resolverResponsavelEtapa(
  etapa: WorkflowEtapa,
  contexto: {
    responsavelAnterior?: string | null;
    iniciadorId?: string | null;
    responsavelInicial?: string | null;
  }
): string | null | undefined {
  switch (etapa.regra_responsavel) {
    case "predefinido":
      return (etapa as any).responsavel_id || contexto.responsavelInicial || undefined;
    case "etapa_anterior":
      return contexto.responsavelAnterior || contexto.responsavelInicial || undefined;
    case "iniciador":
      return contexto.iniciadorId || contexto.responsavelInicial || undefined;
    default:
      return contexto.responsavelInicial || undefined;
  }
}

export async function criarItemWorkflow(
  execucao: WorkflowExecucao,
  etapa: WorkflowEtapa,
  dataReferencia: Date,
  responsavelId?: string | null,
  processoId?: string,
  processoNumero?: string
): Promise<{ id: string; tipo: WorkflowItemType } | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || execucao.iniciado_por;

  // Responsáveis configurados na etapa (múltiplos)
  let responsaveisEtapa: string[] = [];
  try {
    const { data: resp } = await supabase
      .from("workflow_etapa_responsaveis")
      .select("usuario_id")
      .eq("etapa_id", etapa.id);
    responsaveisEtapa = ((resp as any[]) || []).map((r) => r.usuario_id).filter(Boolean);
  } catch {
    responsaveisEtapa = [];
  }
  const responsavelPrincipal = responsavelId || responsaveisEtapa[0] || null;
  const todosResponsaveis = Array.from(
    new Set([...(responsavelPrincipal ? [responsavelPrincipal] : []), ...responsaveisEtapa])
  );

  const dataBase = calcularDataOffset(
    dataReferencia,
    etapa.dias_previsto || 0,
    etapa.tipo_prazo || "dias_corridos"
  );
  const dataBaseStr = formatarDataISOBrasilia(dataBase);
  const dataFatal = etapa.dias_fatal
    ? formatarDataISOBrasilia(
        calcularDataOffset(dataReferencia, etapa.dias_fatal, etapa.tipo_prazo || "dias_corridos")
      )
    : dataBaseStr;

  const tipo = String(etapa.tipo_item || "TAREFA").toUpperCase() as WorkflowItemType;
  const itemBase: Record<string, any> = {
    coordenacao_id: execucao.coordenacao_id,
    criado_por: userId,
    status: WORKFLOW_ITEM_SITUACAO_INICIAL[tipo],
  };
  if (processoId) itemBase.processo_id = processoId;
  if (processoNumero) itemBase.processo_numero = processoNumero;

  try {
    switch (tipo) {
      case "PRAZO":
      case "TAREFA": {
        const { data, error } = await supabase
          .from("tarefas")
          .insert({
            ...itemBase,
            titulo: etapa.titulo,
            descricao: etapa.descricao || null,
            tipo_tarefa: tipo,
            origem: "workflow",
            data_vencimento: dataBaseStr,
            data_base: dataBaseStr,
            data_fatal: dataFatal,
            prioridade: etapa.prioridade || "media",
            responsavel_id: responsavelPrincipal,
            observacoes: etapa.descricao || null,
            prazo_dias: etapa.dias_previsto || 0,
            prazo_unidade: etapa.tipo_prazo === "dias_uteis" ? "uteis" : "corridos",
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        if (todosResponsaveis.length) {
          await supabase.from("tarefa_responsaveis").insert(
            todosResponsaveis.map((u) => ({ tarefa_id: data.id, usuario_id: u }))
          );
        }
        return { id: data.id, tipo };
      }

      case "AUDIENCIA": {
        const dataAudienciaISO = formatarTimestampISOBrasilia(dataBaseStr, "12:00");
        const novaAudienciaId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : undefined;
        const { error } = await supabase.from("audiencias_detectadas").insert({
          ...(novaAudienciaId ? { id: novaAudienciaId } : {}),
          ...itemBase,
          processo_id: processoId || null,
          processo_numero: processoNumero || null,
          titulo: etapa.titulo,
          tipo_audiencia: etapa.titulo,
          data_audiencia: dataAudienciaISO,
          hora: "12:00",
          hora_brasilia: "12:00",
          observacoes: etapa.descricao || null,
          origem: "workflow",
        } as any);
        if (error) throw error;
        const id =
          novaAudienciaId ||
          (await buscarAudienciaPorTituloData(etapa.titulo, dataAudienciaISO)) ||
          "";
        if (id && todosResponsaveis.length) {
          await supabase
            .from("audiencia_envolvidos")
            .insert(todosResponsaveis.map((u) => ({ audiencia_id: id, usuario_id: u })));
        }
        return { id, tipo };
      }

      case "EVENTO": {
        const dataInicio = formatarTimestampISOBrasilia(dataBaseStr, "09:00");
        const { data, error } = await supabase
          .from("eventos_agenda")
          .insert({
            ...itemBase,
            titulo: etapa.titulo,
            descricao: etapa.descricao || null,
            tipo: "evento",
            data_inicio: dataInicio,
            data_fim: null,
            dia_inteiro: true,
            total_parcelas: null,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        if (todosResponsaveis.length) {
          await supabase
            .from("participantes_evento")
            .insert(todosResponsaveis.map((u) => ({ evento_id: data.id, usuario_id: u })));
        }
        return { id: data.id, tipo };
      }

      case "PARCELAMENTO": {
        const dataInicio = formatarTimestampISOBrasilia(dataBaseStr, "09:00");
        const totalParcelas = (etapa as any).total_parcelas || 12;
        const intervalo = (etapa as any).intervalo_parcelas || "mensal";
        const intervaloDias =
          intervalo === "semanal" ? 7 : intervalo === "quinzenal" ? 15 : 30;
        const { data: evento, error } = await supabase
          .from("eventos_agenda")
          .insert({
            ...itemBase,
            titulo: etapa.titulo,
            descricao: etapa.descricao || `Parcelamento com ${totalParcelas} parcelas`,
            tipo: "parcelamento",
            data_inicio: dataInicio,
            dia_inteiro: true,
            total_parcelas: totalParcelas,
            recorrente: true,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        if (todosResponsaveis.length) {
          await supabase
            .from("participantes_evento")
            .insert(todosResponsaveis.map((u) => ({ evento_id: evento.id, usuario_id: u })));
        }
        const parcelas = Array.from({ length: totalParcelas }, (_, i) => ({
          evento_id: evento.id,
          numero: i + 1,
          data_vencimento: formatarDataISOBrasilia(addDays(dataBase, i * intervaloDias)),
          status: "pendente",
        }));
        await supabase.from("parcelas_evento").insert(parcelas);
        return { id: evento.id, tipo };
      }

      default:
        return null;
    }
  } catch (err: any) {
    console.error("Erro ao criar item de workflow:", err);
    throw err;
  }
}

async function buscarAudienciaPorTituloData(
  titulo: string,
  dataISO: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("audiencias_detectadas")
    .select("id")
    .eq("data_audiencia", dataISO)
    .ilike("titulo", titulo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.id;
}

/* ------------------------------------------------------------------ */
/* Avanço automático de etapas                                        */
/* ------------------------------------------------------------------ */

/** Situações que indicam conclusão COM sucesso de um item. */
export const WORKFLOW_STATUS_SUCESSO = [
  "cumprido",
  "protocolado",
  "baixado",
  "verificado",
  "tratado",
];

/** Situações que indicam conclusão SEM sucesso (interrompe o ramo). */
export const WORKFLOW_STATUS_INSUCESSO = ["concluido_sem_sucesso", "cancelado"];

export async function buscarResponsavelItem(
  tipoRaw: WorkflowItemType | null,
  itemId: string | null
): Promise<string | null> {
  if (!tipoRaw || !itemId) return null;
  const tipo = String(tipoRaw).toUpperCase() as WorkflowItemType;
  try {
    switch (tipo) {
      case "PRAZO":
      case "TAREFA": {
        const { data } = await supabase
          .from("tarefas")
          .select("responsavel_id")
          .eq("id", itemId)
          .maybeSingle();
        return (data as any)?.responsavel_id || null;
      }
      case "AUDIENCIA": {
        const { data } = await supabase
          .from("audiencias_detectadas")
          .select("criado_por")
          .eq("id", itemId)
          .maybeSingle();
        return (data as any)?.criado_por || null;
      }
      case "EVENTO":
      case "PARCELAMENTO": {
        const { data } = await supabase
          .from("participantes_evento")
          .select("usuario_id")
          .eq("evento_id", itemId)
          .limit(1)
          .maybeSingle();
        return (data as any)?.usuario_id || null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Conclui a etapa ativa de uma execução e materializa a próxima etapa elegível.
 * Retorna { concluido: true } quando não há mais etapas a materializar.
 */
export async function avancarExecucaoWorkflow(
  execucaoId: string,
  sucesso = true
): Promise<{ concluido: boolean }> {
  const { data: execucao, error: execError } = await supabase
    .from("workflow_execucoes")
    .select("*")
    .eq("id", execucaoId)
    .maybeSingle();
  if (execError || !execucao) throw execError || new Error("Execução não encontrada");

  const { data: etapasExec, error: etapasError } = await supabase
    .from("workflow_execucao_etapas")
    .select("*, etapa:workflow_etapas(*)")
    .eq("execucao_id", execucaoId)
    .order("ordem", { ascending: true });
  if (etapasError || !etapasExec) throw etapasError || new Error("Etapas não encontradas");

  const execucaoCast = execucao as any;
  const etapas = (etapasExec as any[]).map((e) => ({
    ...e,
    etapa: e.etapa as WorkflowEtapa,
  })) as WorkflowExecucaoEtapa[];

  const etapaConcluida = etapas.find((e) => e.status === "materializada");
  if (!etapaConcluida) throw new Error("Nenhuma etapa ativa para concluir");

  const ordemAtual = etapaConcluida.etapa?.ordem || 0;
  await supabase
    .from("workflow_execucao_etapas")
    .update({ status: "concluida", sucesso })
    .eq("id", etapaConcluida.id);
  etapaConcluida.status = "concluida" as any;
  etapaConcluida.sucesso = sucesso as any;

  let proxima = etapas.find(
    (e) => (e.etapa?.ordem || 0) > ordemAtual && e.status === "pendente"
  );
  while (proxima) {
    const condicao = proxima.etapa?.condicao || "sempre";
    if (condicao === "sucesso_anterior") {
      const refId = proxima.etapa?.etapa_anterior_id;
      let ok: boolean;
      if (refId) {
        const ref = etapas.find((e) => e.etapa_id === refId);
        ok = ref?.status === "concluida" && !!ref?.sucesso;
      } else {
        ok = !!etapaConcluida.sucesso;
      }
      if (!ok) {
        await supabase
          .from("workflow_execucao_etapas")
          .update({ status: "cancelada", sucesso: false })
          .eq("id", proxima.id);
        const proximaOrdem = proxima.etapa?.ordem || 0;
        proxima = etapas.find(
          (e) => (e.etapa?.ordem || 0) > proximaOrdem && e.status === "pendente"
        );
        continue;
      }
    }
    break;
  }

  if (!proxima) {
    await supabase
      .from("workflow_execucoes")
      .update({ status: "concluido" })
      .eq("id", execucaoId);
    return { concluido: true };
  }

  const dataReferencia = new Date();
  const responsavelAnterior = etapaConcluida.item_id
    ? await buscarResponsavelItem(etapaConcluida.item_tipo, etapaConcluida.item_id)
    : null;
  const responsavel = resolverResponsavelEtapa(proxima.etapa as WorkflowEtapa, {
    responsavelAnterior,
    iniciadorId: execucaoCast.iniciado_por,
  });

  const item = await criarItemWorkflow(
    execucaoCast as WorkflowExecucao,
    proxima.etapa as WorkflowEtapa,
    dataReferencia,
    responsavel,
    execucaoCast.processo_id,
    execucaoCast.processo_numero
  );

  const tp = (proxima.etapa?.tipo_prazo || "dias_corridos") as
    | "dias_corridos"
    | "dias_uteis";
  const dataPrevista = proxima.etapa?.dias_previsto
    ? formatarDataISOBrasilia(
        calcularDataOffset(dataReferencia, proxima.etapa.dias_previsto, tp)
      )
    : formatarDataISOBrasilia(dataReferencia);
  const dataFatal = proxima.etapa?.dias_fatal
    ? formatarDataISOBrasilia(
        calcularDataOffset(dataReferencia, proxima.etapa.dias_fatal, tp)
      )
    : dataPrevista;

  await supabase
    .from("workflow_execucao_etapas")
    .update({
      status: "materializada",
      item_id: item?.id || null,
      item_tipo: item?.tipo || (proxima.etapa as WorkflowEtapa).tipo_item,
      data_prevista_calculada: dataPrevista,
      data_fatal_calculada: dataFatal,
    })
    .eq("id", proxima.id);

  return { concluido: false };
}

/** Lê a situação atual de um item criado por workflow. */
async function lerStatusItem(
  tipoRaw: WorkflowItemType | null,
  itemId: string
): Promise<string | null> {
  const tipo = String(tipoRaw || "TAREFA").toUpperCase();
  try {
    if (tipo === "TAREFA" || tipo === "PRAZO") {
      const { data } = await supabase
        .from("tarefas")
        .select("status")
        .eq("id", itemId)
        .maybeSingle();
      return (data as any)?.status || null;
    }
    if (tipo === "AUDIENCIA") {
      const { data } = await supabase
        .from("audiencias_detectadas")
        .select("status")
        .eq("id", itemId)
        .maybeSingle();
      return (data as any)?.status || null;
    }
    const { data } = await supabase
      .from("eventos_agenda")
      .select("status")
      .eq("id", itemId)
      .maybeSingle();
    return (data as any)?.status || null;
  } catch {
    return null;
  }
}

/**
 * Verifica os itens ativos de workflow: se o item já foi concluído
 * (com ou sem sucesso) na tela de tarefas/agenda, avança a execução.
 * Retorna quantas execuções avançaram.
 */
export async function sincronizarWorkflowsPorItens(): Promise<number> {
  const { data, error } = await supabase
    .from("workflow_execucao_etapas")
    .select("id, execucao_id, item_id, item_tipo, status")
    .eq("status", "materializada")
    .not("item_id", "is", null);
  if (error || !data) return 0;

  let avancadas = 0;
  for (const row of data as any[]) {
    const status = await lerStatusItem(row.item_tipo, row.item_id);
    if (!status) continue;
    const sucesso = WORKFLOW_STATUS_SUCESSO.includes(status);
    const insucesso = WORKFLOW_STATUS_INSUCESSO.includes(status);
    if (!sucesso && !insucesso) continue;
    try {
      await avancarExecucaoWorkflow(row.execucao_id, sucesso);
      avancadas++;
    } catch (err) {
      console.error("Falha ao avançar workflow", row.execucao_id, err);
    }
  }
  return avancadas;
}
