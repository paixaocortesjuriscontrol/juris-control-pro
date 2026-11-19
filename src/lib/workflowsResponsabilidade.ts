/** Execuções que entram no Excel de Minhas Responsabilidades: dos workflows listados ou iniciadas pela pessoa, sem repetir. */
export function selecionarExecucoesExcel(
  execucoes: { id: string; workflow_id: string; iniciado_por?: string | null }[],
  workflowIds: string[],
  uid: string,
  incluirIniciadas = true,
) {
  const ids = new Set(workflowIds);
  const vistos = new Set<string>();
  return execucoes.filter((e) => {
    if (vistos.has(e.id)) return false;
    const ok = ids.has(e.workflow_id) || (incluirIniciadas && !!uid && e.iniciado_por === uid);
    if (ok) vistos.add(e.id);
    return ok;
  });
}

export const REGRA_RESPONSAVEL: Record<string, string> = {
  predefinido: "Fixo",
  etapa_anterior: "Etapa anterior",
  iniciador: "Quem iniciou",
};
