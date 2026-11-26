export type ItemExportacaoPublicacao = { id: string; origem?: string };

const idBaseItem = (id: string) => String(id).replace(/^audiencia-det-/, "").split(/::|:/)[0];

export function dataPublicacaoDjenExportacao(
  datas: ReadonlyMap<string, string>,
  item: ItemExportacaoPublicacao,
): string {
  const bruta = datas.get(idBaseItem(item.id));
  const iso = String(bruta ?? "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

async function lerEmLotes(
  ids: string[],
  consulta: (lote: string[]) => any,
): Promise<any[]> {
  const linhas: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await consulta(ids.slice(i, i + 200));
    if (error) throw error;
    linhas.push(...(data ?? []));
  }
  return linhas;
}

/** Busca a data DJEN de tarefas/prazos e audiências, inclusive publicações descartadas. */
export async function buscarDatasPublicacaoDjen(
  itens: ItemExportacaoPublicacao[],
): Promise<Map<string, string>> {
  const tarefaIds = new Set<string>();
  const audienciaIds = new Set<string>();
  for (const item of itens) {
    const id = idBaseItem(item.id);
    if (!id || id.startsWith("prazo-tst-") || id.startsWith("parcela-")) continue;
    if (String(item.id).startsWith("audiencia-det-")) audienciaIds.add(id);
    else if (item.origem === "tarefa") tarefaIds.add(id);
  }

  const t = [...tarefaIds];
  const a = [...audienciaIds];
  if (t.length === 0 && a.length === 0) return new Map();
  const { supabase } = await import("@/integrations/supabase/client");
  const db = supabase as any;
  const [tp, tpp, ap, app, apd, ad] = await Promise.all([
    lerEmLotes(t, (lote) => db.from("tarefas_publicacoes").select("tarefa_id, publicacao_id").in("tarefa_id", lote)),
    lerEmLotes(t, (lote) => db.from("tarefas_publicacoes_processos").select("tarefa_id, publicacao_processo_id").in("tarefa_id", lote)),
    lerEmLotes(a, (lote) => db.from("audiencias_publicacoes").select("audiencia_id, publicacao_id").in("audiencia_id", lote)),
    lerEmLotes(a, (lote) => db.from("audiencias_publicacoes_processos").select("audiencia_id, publicacao_processo_id").in("audiencia_id", lote)),
    lerEmLotes(a, (lote) => db.from("audiencias_publicacoes_descartadas").select("audiencia_id, publicacao_descartada_id").in("audiencia_id", lote)),
    lerEmLotes(a, (lote) => db.from("audiencias_detectadas").select("id, publicacao_id").in("id", lote).not("publicacao_id", "is", null)),
  ]);

  const itemPub = new Map<string, string>();
  const itemPubProc = new Map<string, string>();
  const itemPubDesc = new Map<string, string>();
  for (const r of tp) if (r.publicacao_id && !itemPub.has(r.tarefa_id)) itemPub.set(r.tarefa_id, r.publicacao_id);
  for (const r of ap) if (r.publicacao_id && !itemPub.has(r.audiencia_id)) itemPub.set(r.audiencia_id, r.publicacao_id);
  for (const r of ad) if (r.publicacao_id && !itemPub.has(r.id)) itemPub.set(r.id, r.publicacao_id);
  for (const r of tpp) if (r.publicacao_processo_id && !itemPubProc.has(r.tarefa_id)) itemPubProc.set(r.tarefa_id, r.publicacao_processo_id);
  for (const r of app) if (r.publicacao_processo_id && !itemPubProc.has(r.audiencia_id)) itemPubProc.set(r.audiencia_id, r.publicacao_processo_id);
  for (const r of apd) if (r.publicacao_descartada_id && !itemPubDesc.has(r.audiencia_id)) itemPubDesc.set(r.audiencia_id, r.publicacao_descartada_id);

  const dataPorPub = new Map<string, string>();
  const dataPorProc = new Map<string, string>();
  const dataPorDesc = new Map<string, string>();
  await Promise.all([
    lerEmLotes([...new Set(itemPub.values())], (lote) =>
      db.from("publicacoes_djen").select("id, data_publicacao, data_disponibilizacao").in("id", lote)),
    lerEmLotes([...new Set(itemPubProc.values())], (lote) =>
      db.from("publicacoes_djen_processos").select("id, data_publicacao, data_disponibilizacao").in("id", lote)),
    lerEmLotes([...new Set(itemPubDesc.values())], (lote) =>
      db.from("publicacoes_djen_descartadas").select("id, data_publicacao, data_disponibilizacao").in("id", lote)),
  ]).then(([pubs, procs, descartadas]) => {
    pubs.forEach((r) => dataPorPub.set(String(r.id), r.data_publicacao ?? r.data_disponibilizacao));
    procs.forEach((r) => dataPorProc.set(String(r.id), r.data_publicacao ?? r.data_disponibilizacao));
    descartadas.forEach((r) => dataPorDesc.set(String(r.id), r.data_publicacao ?? r.data_disponibilizacao));
  });

  const resultado = new Map<string, string>();
  const ids = new Set([...itemPub.keys(), ...itemPubProc.keys(), ...itemPubDesc.keys()]);
  ids.forEach((itemId) => {
    const pubId = itemPub.get(itemId);
    const procId = itemPubProc.get(itemId);
    const descId = itemPubDesc.get(itemId);
    const data = (pubId && dataPorPub.get(pubId))
      || (procId && dataPorProc.get(procId))
      || (descId && dataPorDesc.get(descId))
      || "";
    resultado.set(itemId, data);
  });
  return resultado;
}
