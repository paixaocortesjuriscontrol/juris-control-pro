import type { TipoModelo } from "@/hooks/useModelosTitulo";

export type KindCampo = "date" | "time" | "text" | "textarea" | "number" | "select" | "bool";

export interface CampoModelo {
  key: string;
  label: string;
  kind: KindCampo;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

const MODALIDADE = [
  { value: "presencial", label: "Presencial" },
  { value: "virtual", label: "Virtual" },
  { value: "hibrida", label: "Híbrida" },
];

const UNIDADE = [
  { value: "uteis", label: "Dias úteis" },
  { value: "corridos", label: "Dias corridos" },
];

const RECORRENCIA = [
  { value: "nenhuma", label: "Não se repete" },
  { value: "daily", label: "Dias corridos" },
  { value: "weekdays", label: "Dias úteis (Seg–Sex)" },
  { value: "weekly", label: "Semanalmente" },
  { value: "monthly", label: "Mensalmente" },
  { value: "yearly", label: "Anualmente" },
];

/** Campos que podem receber preenchimento padrão em cada tipo de modelo. */
export const CAMPOS_MODELO: Record<TipoModelo, CampoModelo[]> = {
  prazo: [
    { key: "prazo_dias", label: "Prazo (dias)", kind: "number" },
    { key: "prazo_unidade", label: "Unidade do prazo", kind: "select", options: UNIDADE },
    { key: "data_limite", label: "Data limite", kind: "date" },
    { key: "data_fatal", label: "Prazo fatal", kind: "date" },
    { key: "alerta_dias", label: "Alertar com antecedência (dias)", kind: "number" },
    { key: "alerta_unidade", label: "Unidade do alerta", kind: "select", options: UNIDADE },
    { key: "recorrencia_tipo", label: "Frequência", kind: "select", options: RECORRENCIA },
    { key: "recorrencia_intervalo", label: "Intervalo", kind: "number" },
    { key: "recorrencia_fim", label: "Repetir até", kind: "date" },
    { key: "observacoes", label: "Observações", kind: "textarea" },
  ],
  tarefa: [
    { key: "data_base", label: "Data base", kind: "date" },
    { key: "prazo_dias", label: "Prazo (dias)", kind: "number" },
    { key: "prazo_unidade", label: "Unidade do prazo", kind: "select", options: UNIDADE },
    { key: "data_vencimento", label: "Data prevista", kind: "date" },
    { key: "hora_prevista", label: "Hora prevista", kind: "time" },
    { key: "data_fatal", label: "Data fatal", kind: "date" },
    { key: "hora_fatal", label: "Hora fatal", kind: "time" },
    { key: "alerta_dias", label: "Alertar com antecedência (dias)", kind: "number" },
    { key: "alerta_unidade", label: "Unidade do alerta", kind: "select", options: UNIDADE },
    { key: "local", label: "Local", kind: "text" },
    { key: "recorrencia_tipo", label: "Frequência", kind: "select", options: RECORRENCIA },
    { key: "recorrencia_intervalo", label: "Intervalo", kind: "number" },
    { key: "recorrencia_fim", label: "Repetir até", kind: "date" },
    { key: "descricao", label: "Descrição", kind: "textarea" },
  ],
  evento: [
    { key: "prazo_dias", label: "Prazo (dias)", kind: "number" },
    { key: "prazo_unidade", label: "Unidade do prazo", kind: "select", options: UNIDADE },
    { key: "data_inicio", label: "Data de início", kind: "date" },
    { key: "hora_inicio", label: "Hora de início", kind: "time" },
    { key: "data_fim", label: "Data de término", kind: "date" },
    { key: "hora_fim", label: "Hora de término", kind: "time" },
    { key: "dia_inteiro", label: "Dia inteiro", kind: "bool" },
    { key: "local", label: "Local", kind: "text" },
    { key: "modalidade", label: "Modalidade", kind: "select", options: MODALIDADE },
    { key: "alerta_minutos", label: "Alertar com antecedência (minutos)", kind: "number" },
    { key: "recorrencia_tipo", label: "Frequência", kind: "select", options: RECORRENCIA },
    { key: "recorrencia_intervalo", label: "Intervalo", kind: "number" },
    { key: "recorrencia_fim", label: "Repetir até", kind: "date" },
    { key: "observacoes", label: "Observações", kind: "textarea" },
  ],
  audiencia: [
    { key: "prazo_dias", label: "Prazo (dias)", kind: "number" },
    { key: "prazo_unidade", label: "Unidade do prazo", kind: "select", options: UNIDADE },
    { key: "data_audiencia", label: "Data da audiência", kind: "date" },
    { key: "hora", label: "Hora de início", kind: "time" },
    { key: "hora_fim", label: "Hora de término", kind: "time" },
    { key: "modalidade", label: "Modalidade", kind: "select", options: MODALIDADE },
    { key: "alerta_valor", label: "Alertar com antecedência", kind: "number" },
    { key: "alerta_unidade", label: "Unidade do alerta", kind: "select", options: UNIDADE },
    { key: "forum", label: "Fórum", kind: "text" },
    { key: "sala_forum", label: "Sala do fórum", kind: "text" },
    { key: "local_audiencia", label: "Local / link", kind: "text" },
    { key: "vara_camara", label: "Vara / Câmara", kind: "text" },
    { key: "comarca", label: "Comarca", kind: "text" },
    { key: "polo_ativo", label: "Polo ativo", kind: "text" },
    { key: "cliente", label: "Cliente", kind: "text" },
    { key: "terceirizado", label: "Terceirizada", kind: "text" },
    { key: "preposto", label: "Preposto(s)", kind: "textarea" },
    { key: "testemunhas", label: "Testemunha(s)", kind: "textarea" },
    { key: "observacoes", label: "Observações", kind: "textarea" },
  ],
  parcela: [
    { key: "dataVencimento", label: "Data da 1ª parcela", kind: "date" },
    { key: "totalParcelas", label: "Quantidade de parcelas", kind: "number" },
    { key: "valorPadrao", label: "Valor por parcela", kind: "text", placeholder: "Ex: 1500,00" },
    {
      key: "intervalo",
      label: "Periodicidade",
      kind: "select",
      options: [
        { value: "mensal", label: "Mensal" },
        { value: "quinzenal", label: "Quinzenal" },
        { value: "semanal", label: "Semanal" },
        { value: "anual", label: "Anual" },
      ],
    },
    { key: "hora_alerta", label: "Hora base do alerta", kind: "time" },
    { key: "descricao", label: "Descrição", kind: "textarea" },
  ],
};