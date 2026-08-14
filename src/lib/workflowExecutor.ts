import { supabase } from "@/integrations/supabase/client";
import { format, addDays, addBusinessDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { registrarAuditoriaTarefa } from "@/hooks/useAuditoriaTarefas";

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
  tipo_item: WorkflowItemType;
  titulo: string;
  descricao?: string | null;
  dias_offset?: number | null;
  unidade_offset?: "uteis" | "corridos" | null;
  referencia_data?: "inicio_fluxo" | "etapa_anterior" | null;
  responsavel_tipo?: "predefinido" | "etapa_anterior" | "iniciador" | null;
  responsavel_id?: string | null;
  advogados_ids?: string[] | null;
  envolvidos_ids?: string[] | null;
  prioridade?: "baixa" | "media" | "alta" | "urgente" | null;
  encadeamento?: "sempre" | "sucesso" | null;
  condicao_situacao_anterior?: string | null;
  requer_sucesso?: boolean;
  observacoes?: string | null;
  total_parcelas?: number | null;
  intervalo_parcelas?: "semanal" | "quinzenal" | "mensal" | null;
  data_inicio?: string | null;
  hora_inicio?: string | null;
  data_fim?: string | null;
  hora_fim?: string | null;
  local?: string | null;
  modalidade?: string | null;
  vara_camara?: string | null;
  comarca?: string | null;
  alerta_minutos?: number[] | null;
  alerta_dias?: number | null;
  alerta_unidade?: "uteis" | "corridos" | null;
  enviar_whatsapp?: boolean;
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
  processo_id?: string | null;
  processo_numero?: string | null;
  iniciado_por: string;
  coordenacao_id: string;
  status: "em_andamento" | "concluido" | "cancelado";
  iniciado_em: string;
  concluido_em?: string | null;
  created_at: string;
  updated_at: string;
  workflow?: Workflow | null;
}

export interface WorkflowExecucaoEtapa {
  id: string;
  execucao_id: string;
  etapa_id: string;
  item_id: string | null;
  item_tipo: WorkflowItemType | null;
  item_status: string | null;
  ordem: number;
  status: "pendente" | "materializada" | "concluida" | "cancelada";
  materializada_em: string | null;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
  etapa?: WorkflowEtapa | null;
}

export interface IniciarWorkflowInput {
  workflow_id: string;
  processo_id?: string;
  processo_numero?: string;
  coordenacao_id: string;
  responsavel_inicial?: string;
  observacoes?: string;
}

export interface CriarProximaEtapaInput {
  execucaoId: string;
  etapaId: string;
  dataReferencia: Date;
}

export function calcularDataOffset(
  base: Date,
  dias: number,
  unidade: "uteis" | "corridos" = "corridos"
): Date {
  if (unidade === "uteis") {
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

export async function buscarWorkflow(workflowId: string): Promise<Workflow | null> {
  const { data, error } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .maybeSingle();
  if (error) throw error;
  return data as Workflow | null;
}

export async function buscarEtapasWorkflow(workflowId: string): Promise<WorkflowEtapa[]> {
  const { data, error } = await supabase
    .from("workflow_etapas")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return (data || []) as WorkflowEtapa[];
}

export async function buscarExecucao(execucaoId: string): Promise<WorkflowExecucao | null> {
  const { data, error } = await supabase
    .from("workflow_execucoes")
    .select("*")
    .eq("id", execucaoId)
    .maybeSingle();
  if (error) throw error;
  return data as WorkflowExecucao | null;
}

export async function buscarEtapasExecucao(execucaoId: string): Promise<WorkflowExecucaoEtapa[]> {
  const { data, error } = await supabase
    .from("workflow_execucao_etapas")
    .select("*, etapa:workflow_etapas(*)")
    .eq("execucao_id", execucaoId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return (data || []) as WorkflowExecucaoEtapa[];
}

export async function buscarEtapaExecucaoPorItem(
  itemId: string,
  itemTipo: WorkflowItemType
): Promise<WorkflowExecucaoEtapa | null> {
  const { data, error } = await supabase
    .from("workflow_execucao_etapas")
    .select("*, etapa:workflow_etapas(*)")
    .eq("item_id", itemId)
    .eq("item_tipo", itemTipo)
    .maybeSingle();
  if (error) throw error;
  return data as WorkflowExecucaoEtapa | null;
}

export function resolverResponsavelEtapa(
  etapa: WorkflowEtapa,
  contexto: {
    responsavelAnterior?: string | null;
    iniciadorId?: string | null;
    responsavelInicial?: string | null;
  }
): string | null | undefined {
  switch (etapa.responsavel_tipo) {
    case "predefinido":
      return etapa.responsavel_id || undefined;
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

  const dataBase = calcularDataOffset(
    dataReferencia,
    etapa.dias_offset || 0,
    etapa.unidade_offset || "corridos"
  );
  const dataBaseStr = formatarDataISOBrasilia(dataBase);
  const tipo = etapa.tipo_item;
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
        const prazoDias = etapa.dias_offset || 0;
        const dataVencimento = dataBaseStr;
        const dataFatal = dataBaseStr;
        const dataBaseTarefa = dataBaseStr;
        const { data, error } = await supabase
          .from("tarefas")
          .insert({
            ...itemBase,
            titulo: etapa.titulo,
            descricao: etapa.descricao || null,
            tipo_tarefa: tipo,
            data_vencimento: dataVencimento,
            data_base: dataBaseTarefa,
            data_fatal: dataFatal,
            prioridade: etapa.prioridade || "media",
            responsavel_id: responsavelId || null,
            observacoes: etapa.observacoes || null,
            prazo_dias: prazoDias,
            prazo_unidade: etapa.unidade_offset || "corridos",
            alerta_dias: etapa.alerta_dias || null,
            alerta_unidade: etapa.alerta_unidade || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        return { id: data.id, tipo };
      }

      case "AUDIENCIA": {
        const hora = etapa.hora_inicio || "12:00";
        const dataAudienciaISO = formatarTimestampISOBrasilia(dataBaseStr, hora);
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
          hora: etapa.hora_inicio || null,
          hora_brasilia: etapa.hora_inicio || null,
          local_audiencia: etapa.local || null,
          modalidade: etapa.modalidade || null,
          vara_camara: etapa.vara_camara || null,
          comarca: etapa.comarca || null,
          observacoes: etapa.descricao || etapa.observacoes || null,
          origem: "workflow",
        });
        if (error) throw error;
        const id = novaAudienciaId || (await buscarAudienciaPorTituloData(etapa.titulo, dataAudienciaISO)) || "";
        if (etapa.advogados_ids && etapa.advogados_ids.length > 0 && id) {
          await supabase
            .from("audiencias_advogados")
            .insert(
              etapa.advogados_ids.map((adv) => ({
                audiencia_id: id,
                advogado_id: adv,
              }))
            );
        }
        if (etapa.envolvidos_ids && etapa.envolvidos_ids.length > 0 && id) {
          await supabase
            .from("audiencia_envolvidos")
            .insert(
              etapa.envolvidos_ids.map((uid) => ({
                audiencia_id: id,
                usuario_id: uid,
              }))
            );
        }
        return { id, tipo };
      }

      case "EVENTO": {
        const dataInicio = formatarTimestampISOBrasilia(
          dataBaseStr,
          etapa.hora_inicio || "09:00"
        );
        const dataFim = etapa.data_fim
          ? formatarTimestampISOBrasilia(
              formatarDataISOBrasilia(calcularDataOffset(dataBase, 0)),
              etapa.hora_fim || etapa.hora_inicio || "10:00"
            )
          : null;
        const { data, error } = await supabase
          .from("eventos_agenda")
          .insert({
            ...itemBase,
            titulo: etapa.titulo,
            descricao: etapa.descricao || null,
            tipo: "evento",
            data_inicio: dataInicio,
            data_fim: dataFim,
            dia_inteiro: false,
            local: etapa.local || null,
            enviar_whatsapp: etapa.enviar_whatsapp ?? false,
            total_parcelas: null,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (responsavelId) {
          await supabase
            .from("participantes_evento")
            .insert([{ evento_id: data.id, usuario_id: responsavelId }]);
        }
        return { id: data.id, tipo };
      }

      case "PARCELAMENTO": {
        const dataInicio = formatarTimestampISOBrasilia(
          dataBaseStr,
          etapa.hora_inicio || "09:00"
        );
        const totalParcelas = etapa.total_parcelas || 12;
        const intervalo = etapa.intervalo_parcelas || "mensal";
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
            enviar_whatsapp: etapa.enviar_whatsapp ?? false,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (responsavelId) {
          await supabase
            .from("participantes_evento")
            .insert([{ evento_id: evento.id, usuario_id: responsavelId }]);
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
    await registrarAuditoriaTarefa({
      acao: "erro_criar",
      sucesso: false,
      dadosEntrada: { execucao, etapa, dataReferencia, responsavelId },
      erroMensagem: err?.message || "Erro workflow",
      erroDetalhes: err,
      origem: "workflowExecutor.criarItemWorkflow",
      tipoItem: "workflow",
      coordenacaoId: execucao.coordenacao_id,
    });
    throw err;
  }
}

async function buscarAudienciaPorTituloData(titulo: string, dataISO: string): Promise<string | null> {
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
