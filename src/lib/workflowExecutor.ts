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
