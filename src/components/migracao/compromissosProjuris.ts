import { norm, digitos } from "@/lib/migracaoProjuris";

export type TipoCompromisso = "evento" | "tarefa" | "audiencia";

/** Coluna "AGENDAR COMO" define o tipo; nada é inferido pelo título. */
export function tipoCompromisso(v: unknown): TipoCompromisso | null {
  const s = norm(v);
  if (s.startsWith("audien")) return "audiencia";
  if (s.startsWith("tarefa")) return "tarefa";
  if (s.startsWith("evento")) return "evento";
  return null;
}

/** Primeiro número CNJ (20 dígitos) encontrado no texto da observação. */
export function cnjDoTexto(v: unknown): string | null {
  const m = String(v ?? "").match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/);
  const d = m ? digitos(m[0]) : "";
  return d.length === 20 ? d : null;
}
