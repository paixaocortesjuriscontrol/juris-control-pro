import { addDays } from "date-fns";
import { CAMPOS_MODELO, type CampoModelo } from "@/constants/camposModeloTitulo";
import type { WorkflowItemType } from "@/lib/workflowExecutor";

/**
 * Campos do item que podem ser pré-configurados em cada etapa do workflow.
 * São exatamente os mesmos campos dos formulários de Prazo, Tarefa, Audiência,
 * Evento e Parcelamento (mesma fonte usada pelos Modelos de Título), exceto os
 * que a etapa já controla por conta própria (prazo em dias, unidade e
 * descrição).
 */
const EXCLUIR = new Set(["prazo_dias", "prazo_unidade", "descricao"]);

const TIPO_MODELO: Record<WorkflowItemType, keyof typeof CAMPOS_MODELO> = {
  PRAZO: "prazo",
  TAREFA: "tarefa",
  AUDIENCIA: "audiencia",
  EVENTO: "evento",
  PARCELAMENTO: "parcela",
};

export function camposDaEtapa(tipo: WorkflowItemType): CampoModelo[] {
  const lista = CAMPOS_MODELO[TIPO_MODELO[tipo] ?? "tarefa"] ?? [];
  return lista.filter((c) => !EXCLUIR.has(c.key));
}

/** Modos de data relativos disponíveis para as etapas. */
export const MODOS_DATA_ETAPA: { value: string; label: string; precisaN?: boolean }[] = [
  { value: "", label: "Usar o prazo da etapa" },
  { value: "referencia", label: "No dia em que a etapa nascer" },
  { value: "d", label: "Em N dias corridos", precisaN: true },
  { value: "du", label: "Em N dias úteis", precisaN: true },
];

export function parseExprDataEtapa(expr?: string | null): { modo: string; n: number } {
  const v = String(expr || "").trim();
  if (!v) return { modo: "", n: 1 };
  const m = v.match(/^\+(\d+)(du|d)$/);
  if (m) return { modo: m[2], n: Number(m[1]) };
  return { modo: v, n: 1 };
}

export function montarExprDataEtapa(modo: string, n: number): string {
  if (!modo) return "";
  if (modo === "d" || modo === "du") return `+${Math.max(0, n || 0)}${modo}`;
  return modo;
}

function ehFimDeSemana(d: Date) {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/** Art. 775-A da CLT: prazos suspensos entre 20/12 e 20/01 (inclusive). */
function emSuspensaoClt(d: Date) {
  const mes = d.getMonth() + 1;
  const dia = d.getDate();
  return (mes === 12 && dia >= 20) || (mes === 1 && dia <= 20);
}

function addDiasUteis(base: Date, n: number) {
  const d = new Date(base);
  let restantes = n;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    if (!ehFimDeSemana(d) && !emSuspensaoClt(d)) restantes--;
  }
  return d;
}

/**
 * Resolve uma expressão relativa da etapa em uma data absoluta,
 * contada a partir da data de referência (nascimento da etapa).
 */
export function resolverDataEtapa(expr: string | null | undefined, base: Date): Date | null {
  const { modo, n } = parseExprDataEtapa(expr);
  if (!modo) return null;
  if (modo === "referencia" || modo === "hoje") return new Date(base);
  if (modo === "d") return addDays(base, n);
  if (modo === "du") return addDiasUteis(base, n);
  return null;
}

export type CamposItemEtapa = Record<string, any>;

/** Lê os campos configurados na etapa, ignorando valores vazios. */
export function lerCamposEtapa(etapa: any, tipo: WorkflowItemType): CamposItemEtapa {
  const bruto = (etapa?.campos_item ?? {}) as Record<string, any>;
  const out: CamposItemEtapa = {};
  for (const campo of camposDaEtapa(tipo)) {
    const v = bruto[campo.key];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[campo.key] = v;
  }
  return out;
}
