import { norm, digitos } from "@/lib/migracaoProjuris";

/** Coluna CLASSIFICAÇÃO define o tipo (PRAZO/TAREFA); nada é inferido pelo título. */
export function tipoWorkflow(v: unknown): "prazo" | "tarefa" | null {
  const s = norm(v);
  if (s.startsWith("prazo")) return "prazo";
  if (s.startsWith("tarefa")) return "tarefa";
  return null;
}

/** A planilha não traz TAR.: a identidade é processo + título + data fatal. */
export function chaveWorkflow(dig: string, titulo: string, fatal: string | null): string {
  return `wf:${digitos(dig)}:${norm(titulo)}:${fatal || ""}`;
}
