/**
 * Fluxos (workflows) já iniciados no Projuris → execuções do Juris Control.
 * workflowcontrole = um fluxo iniciado; workflowexecucao = cada etapa dele (módulo 4 = tarefa criada).
 * Etapas de versões antigas do modelo são ligadas à etapa importada pelo título (ou posição na cadeia).
 */
export interface EtapaImportada {
  chave: string; // cdetapaworkflow da versão importada
  workflowOrigem: string; // cdworkflow original
  etapaId: string;
  ordem: number;
  titulo: string;
  tipoItem: string;
}

export interface EtapaPlano {
  etapaId: string;
  ordem: number;
  tipoItem: string;
  status: "pendente" | "materializada" | "concluida" | "cancelada";
  sucesso: boolean;
  cdtarefa: string | null;
}

export interface ExecucaoPlano {
  cdcontrole: string;
  workflowOrigem: string;
  cdprocesso: string | null;
  dataInicio: string; // YYYY-MM-DD
  status: "em_andamento" | "concluido" | "cancelada";
  etapas: EtapaPlano[];
}

const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const vivo = (r: Record<string, string>) => r.flativo !== "f" && !r.dtexclusao;

export function montarExecucoesWorkflow(
  workflows: Record<string, string>[],
  etapasCsv: Record<string, string>[],
  controles: Record<string, string>[],
  execucoes: Record<string, string>[],
  importadas: EtapaImportada[],
): { planos: ExecucaoPlano[]; semModelo: number; etapasSemPar: number } {
  const original = new Map(workflows.map((w) => [w.cdworkflow, w.cdworkfloworiginal || w.cdworkflow]));
  const porWf = new Map<string, EtapaImportada[]>();
  for (const e of importadas) {
    const l = porWf.get(e.workflowOrigem) || [];
    l.push(e);
    porWf.set(e.workflowOrigem, l);
  }
  for (const l of porWf.values()) l.sort((a, b) => a.ordem - b.ordem);
  const porChave = new Map(importadas.map((e) => [e.chave, e]));

  // posição de cada etapa na cadeia da sua versão (1 = primeira)
  const etapaCsv = new Map(etapasCsv.map((e) => [e.cdetapaworkflow, e]));
  const posicao = (cd: string) => {
    let n = 0, atual = etapaCsv.get(cd);
    const vistos = new Set<string>();
    while (atual && !vistos.has(atual.cdetapaworkflow)) {
      vistos.add(atual.cdetapaworkflow); n++;
      atual = atual.cdetapaworkflowanterior ? etapaCsv.get(atual.cdetapaworkflowanterior) : undefined;
    }
    return n;
  };
  const casar = (cd: string, wf: string, seq: number): EtapaImportada | undefined => {
    const direta = porChave.get(cd);
    if (direta) return direta;
    const lista = porWf.get(wf) || [];
    const src = etapaCsv.get(cd);
    // etapa ausente do arquivo: usa a sequência em que rodou dentro do fluxo
    if (!src) return lista.find((e) => e.ordem === seq);
    const t = norm(src.detitulo);
    const mesmos = lista.filter((e) => norm(e.titulo) === t);
    if (mesmos.length === 1) return mesmos[0];
    const p = posicao(cd);
    return lista.find((e) => e.ordem === p);
  };

  const execPorControle = new Map<string, Record<string, string>[]>();
  for (const x of execucoes) {
    if (x.dtexclusao || x.flativo === "f") continue;
    const l = execPorControle.get(x.cdworkflowcontrole) || [];
    l.push(x);
    execPorControle.set(x.cdworkflowcontrole, l);
  }

  const planos: ExecucaoPlano[] = [];
  let semModelo = 0, etapasSemPar = 0;
  for (const c of controles) {
    if (!vivo(c)) continue;
    const wf = original.get(c.cdworkflow) || c.cdworkflow;
    const lista = porWf.get(wf);
    if (!lista?.length) { semModelo++; continue; }
    const execs = (execPorControle.get(c.cdworkflowcontrole) || []).sort((a, b) => (a.dtinicio || "").localeCompare(b.dtinicio || ""));
    const porEtapa = new Map<string, Record<string, string>>();
    const vistasEtapa: string[] = [];
    for (const x of execs) {
      if (!vistasEtapa.includes(x.cdetapaworkflow)) vistasEtapa.push(x.cdetapaworkflow);
      const alvo = casar(x.cdetapaworkflow, wf, vistasEtapa.indexOf(x.cdetapaworkflow) + 1);
      if (!alvo) { etapasSemPar++; continue; }
      porEtapa.set(alvo.etapaId, x); // fica a mais recente
    }
    const aberta = (x?: Record<string, string>) => !!x && !x.dtconclusao && !x.dtcancelamento;
    const ordemAberta = Math.min(...lista.filter((e) => aberta(porEtapa.get(e.etapaId))).map((e) => e.ordem), Infinity);
    const emAndamento = ordemAberta !== Infinity;
    const etapas: EtapaPlano[] = lista.map((e) => {
      const x = porEtapa.get(e.etapaId);
      const cdtarefa = x && x.cdmodulo === "4" && x.cdregistrovinculo ? x.cdregistrovinculo : null;
      let status: EtapaPlano["status"], sucesso = true;
      if (x && aberta(x)) status = "materializada";
      else if (x && x.dtcancelamento) { status = "cancelada"; sucesso = false; }
      else if (x) status = "concluida";
      else if (emAndamento && e.ordem > ordemAberta) status = "pendente";
      else { status = "cancelada"; sucesso = false; }
      return { etapaId: e.etapaId, ordem: e.ordem, tipoItem: e.tipoItem, status, sucesso, cdtarefa };
    });
    const todasCanceladas = etapas.every((e) => e.status === "cancelada");
    planos.push({
      cdcontrole: c.cdworkflowcontrole,
      workflowOrigem: wf,
      cdprocesso: c.cdmodulo === "3" && c.cdregistrovinculo ? c.cdregistrovinculo : null,
      dataInicio: (c.dtinicio || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      status: emAndamento ? "em_andamento" : todasCanceladas ? "cancelada" : "concluido",
      etapas,
    });
  }
  return { planos, semModelo, etapasSemPar };
}
