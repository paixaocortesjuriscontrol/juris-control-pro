/** Leitura dos CSVs de checklist do Projuris (separador ";", campos entre aspas). */
export function lerCsvPontoVirgula(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((v) => v !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((v) => v !== "")) linhas.push(linha);
  const [cab, ...resto] = linhas;
  if (!cab) return [];
  const chaves = cab.map((k) => k.replace(/^\uFEFF/, "").trim());
  return resto.map((l) => Object.fromEntries(chaves.map((k, i) => [k, l[i] ?? ""])));
}

export interface ItemChecklistProjuris {
  chave: string; // cdchecklistitem
  tarefaChave: string; // cdregistrovinculo (tarefa no Projuris)
  ordem: number;
  marcado: boolean;
  titulo: string;
  nomeChecklist: string;
}

/** Cruza checklist → itens → vínculo com tarefa (módulo 4). Ignora inativos e itens sem tarefa. */
export function montarItensChecklist(
  checklists: Record<string, string>[],
  itens: Record<string, string>[],
  vinculos: Record<string, string>[],
): { itens: ItemChecklistProjuris[]; semTarefa: number } {
  const ativos = new Map(checklists.filter((c) => c.flativo === "S").map((c) => [c.cdchecklist, c]));
  const tarefa = new Map(vinculos.filter((v) => v.cdmodulo === "4").map((v) => [v.cdchecklist, v.cdregistrovinculo]));
  const saida: ItemChecklistProjuris[] = [];
  let semTarefa = 0;
  for (const i of itens) {
    if (i.flativo !== "S") continue;
    const ck = ativos.get(i.cdchecklist);
    if (!ck) continue;
    const t = tarefa.get(i.cdchecklist);
    if (!t) { semTarefa++; continue; }
    saida.push({
      chave: i.cdchecklistitem,
      tarefaChave: t,
      ordem: Number(i.nuordem) || 0,
      marcado: i.flchecked === "S",
      titulo: (i.nmchecklistitem || "").trim(),
      nomeChecklist: (ck.nmchecklist || "").trim(),
    });
  }
  return { itens: saida, semTarefa };
}
