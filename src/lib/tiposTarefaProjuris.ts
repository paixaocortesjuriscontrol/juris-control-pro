/** Converte os tipos de tarefa do Projuris (tarefatipo.csv) em Modelos de tarefas. */
export interface ModeloTarefaProjuris {
  projuris_cd: string;
  nome: string;
  tipo: "tarefa" | "evento";
  padroes: Record<string, string>;
}

// tarefaprazotipo: 1 Dias corridos, 2 CPC antigo, 3 Prazo inverso, 4 CPC novo
function unidade(cd: string): string {
  if (cd === "1") return "corridos";
  if (cd === "3") return "inverso";
  return "uteis";
}

export function montarModelosTarefaProjuris(linhas: Record<string, string>[]): ModeloTarefaProjuris[] {
  const out: ModeloTarefaProjuris[] = [];
  for (const l of linhas) {
    if ((l.flativo || "").trim() !== "S" || (l.dtexclusao || "").trim()) continue;
    const nome = (l.nmtarefatipo || "").trim();
    if (!nome) continue;
    const un = unidade((l.cdtarefaprazotipo || "").trim());
    const sufixo = un === "corridos" ? "d" : "du";
    const padroes: Record<string, string> = { projuris_cd: String(l.cdtarefatipo).trim() };
    const prazo = Number(l.nuprazopadrao);
    const fatal = Number(l.nuprazofatal);
    if (prazo > 0) { padroes.prazo_dias = String(prazo); padroes.prazo_unidade = un; }
    if (fatal > 0 && un !== "inverso") padroes.data_fatal = `+${fatal}${sufixo}`;
    const hora = (l.hrpadrao || "").trim();
    if (/^\d{2}:\d{2}/.test(hora) && hora !== "00:00:00") padroes.hora_prevista = hora.slice(0, 5);
    if ((l.decor || "").trim()) padroes.cor = l.decor.trim();
    out.push({
      projuris_cd: padroes.projuris_cd,
      nome,
      tipo: (l.fltarefacompromissotipo || "").trim() === "COMPROMISSO" ? "evento" : "tarefa",
      padroes,
    });
  }
  return out;
}
