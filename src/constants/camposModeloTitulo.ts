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

/** Campos que podem receber preenchimento padrão em cada tipo de modelo. */
export const CAMPOS_MODELO: Record<TipoModelo, CampoModelo[]> = {
  prazo: [
    { key: "prazo_dias", label: "Prazo (dias)", kind: "number" },
    { key: "prazo_unidade", label: "Unidade do prazo", kind: "select", options: UNIDADE },
    { key: "data_limite", label: "Data prevista", kind: "date" },
    { key: "data_fatal", label: "Data fatal", kind: "date" },
    { key: "observacoes", label: "Observações", kind: "textarea" },
  ],
  tarefa: [
    { key: "prazo_dias", label: "Prazo (dias)", kind: "number" },
    { key: "prazo_unidade", label: "Unidade do prazo", kind: "select", options: UNIDADE },
    { key: "data_vencimento", label: "Data prevista", kind: "date" },
    { key: "hora_prevista", label: "Hora prevista", kind: "time" },
    { key: "data_fatal", label: "Data fatal", kind: "date" },
    { key: "hora_fatal", label: "Hora fatal", kind: "time" },
    { key: "local", label: "Local", kind: "text" },
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
    { key: "observacoes", label: "Observações", kind: "textarea" },
  ],
  audiencia: [
    { key: "prazo_dias", label: "Prazo (dias)", kind: "number" },
    { key: "prazo_unidade", label: "Unidade do prazo", kind: "select", options: UNIDADE },
    { key: "data_audiencia", label: "Data da audiência", kind: "date" },
    { key: "hora", label: "Hora de início", kind: "time" },
    { key: "hora_fim", label: "Hora de término", kind: "time" },
    { key: "modalidade", label: "Modalidade", kind: "select", options: MODALIDADE },
    { key: "forum", label: "Fórum", kind: "text" },
    { key: "sala_forum", label: "Sala do fórum", kind: "text" },
    { key: "local_audiencia", label: "Local / link", kind: "text" },
    { key: "vara_camara", label: "Vara / Câmara", kind: "text" },
    { key: "comarca", label: "Comarca", kind: "text" },
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