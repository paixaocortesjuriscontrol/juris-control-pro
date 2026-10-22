export type MapaAnexo = { cd: string; modulo: string; entidade: string; caminho: string; nome: string };

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
