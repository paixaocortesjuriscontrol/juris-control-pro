export type MapaAnexo = { cd: string; modulo: string; entidade: string; caminho: string; nome: string };

export function normalizarCaminhoAnexo(path: string) {
  return path.trim().normalize("NFC").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").toLowerCase();
}

export const nomeBaseAnexo = (path: string) => normalizarCaminhoAnexo(path).split("/").pop() || "";

/** Never silently select the last of several same-named physical files. */
export function indexarAnexosZip<T extends { filename: string }>(entries: T[]) {
  const paths = new Map<string, T[]>();
  const names = new Map<string, T[]>();
  const add = (map: Map<string, T[]>, key: string, entry: T) => {
    if (!key) return;
    const list = map.get(key) || [];
    list.push(entry); map.set(key, list);
  };
  for (const entry of entries) {
    add(paths, normalizarCaminhoAnexo(entry.filename), entry);
    add(names, nomeBaseAnexo(entry.filename), entry);
  }
  return (record: Pick<MapaAnexo, "caminho" | "nome">): { entry?: T; ambiguous: boolean } => {
    const exact = paths.get(normalizarCaminhoAnexo(record.caminho)) || [];
    if (exact.length === 1) return { entry: exact[0], ambiguous: false };
    if (exact.length > 1) return { ambiguous: true };
    const stored = names.get(nomeBaseAnexo(record.caminho)) || [];
    if (stored.length === 1) return { entry: stored[0], ambiguous: false };
    if (stored.length > 1) return { ambiguous: true };
    const original = names.get(nomeBaseAnexo(record.nome)) || [];
    return original.length === 1 ? { entry: original[0], ambiguous: false } : { ambiguous: original.length > 1 };
  };
}

export function motivoModuloAnexo(modulo: string): string | null {
  if (modulo === "52") return "Relatório gerado pelo Projuris (não é anexo de caso)";
  if (modulo === "85") return "Planilha de importação do Projuris (não é anexo de caso)";
  return modulo === "3" || modulo === "4" ? null : `Vinculado a outro módulo do Projuris (${modulo})`;
}

/** Junta arquivo.csv (cd → caminho/nome) e arquivovinculomodulo.csv (cd → módulo/registro).
 *  Um anexo pode estar ligado ao processo e à tarefa: fica uma linha só, preferindo a tarefa. */
export const montarMapaBackup = (
  info: Map<string, { caminho: string; nome: string }>,
  vinc: { cd: string; modulo: string; entidade: string }[],
): MapaAnexo[] => {
  const porCd = new Map<string, { cd: string; modulo: string; entidade: string }>();
  for (const v of vinc) {
    const atual = porCd.get(v.cd);
    const peso = (m: string) => (m === "4" ? 3 : m === "3" ? 2 : 1);
    if (!atual || peso(v.modulo) > peso(atual.modulo)) porCd.set(v.cd, v);
  }
  const out: MapaAnexo[] = [];
  porCd.forEach((v) => {
    const i = info.get(v.cd);
    if (i) out.push({ ...v, caminho: i.caminho, nome: i.nome });
  });
  return out;
};
