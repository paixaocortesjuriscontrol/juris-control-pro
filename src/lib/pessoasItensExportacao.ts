import { supabase } from "@/integrations/supabase/client";

type Fonte = "tarefas" | "audiencias" | "eventos" | string;
const TABELAS: Record<string, { resp: [string, string, string]; env: [string, string, string] }> = {
  tarefas: { resp: ["tarefa_responsaveis", "tarefa_id", "usuario_id"], env: ["tarefa_envolvidos", "tarefa_id", "usuario_id"] },
  audiencias: { resp: ["audiencias_advogados", "audiencia_id", "advogado_id"], env: ["audiencia_envolvidos", "audiencia_id", "usuario_id"] },
  eventos: { resp: ["evento_responsaveis", "evento_id", "usuario_id"], env: ["evento_envolvidos", "evento_id", "usuario_id"] },
};

export const idBaseItem = (id: unknown) => String(id ?? "").replace("audiencia-det-", "").split("::")[0].split(":")[0];

/** Nomes atuais de responsáveis e envolvidos por item (chave `fonte:id`). */
export async function buscarPessoasItens(itens: { id: unknown; _fonte: Fonte }[]) {
  const porFonte = new Map<string, Set<string>>();
  itens.forEach((i) => {
    if (!TABELAS[i._fonte]) return;
    if (!porFonte.has(i._fonte)) porFonte.set(i._fonte, new Set());
    porFonte.get(i._fonte)!.add(idBaseItem(i.id));
  });
  const ligacoes: { chave: string; usuario: string; papel: "resp" | "env" }[] = [];
  for (const [fonte, set] of porFonte) {
    const ids = [...set];
    for (let k = 0; k < ids.length; k += 200) {
      const lote = ids.slice(k, k + 200);
      for (const papel of ["resp", "env"] as const) {
        const [tab, colItem, colUser] = TABELAS[fonte][papel];
        const { data, error } = await (supabase as any).from(tab).select(`${colItem}, ${colUser}`).in(colItem, lote);
        if (error) throw error;
        (data ?? []).forEach((r: any) => ligacoes.push({ chave: `${fonte}:${r[colItem]}`, usuario: r[colUser], papel }));
      }
    }
  }
  const uids = [...new Set(ligacoes.map((l) => l.usuario))];
  const nomes = new Map<string, string>();
  for (let k = 0; k < uids.length; k += 200) {
    const { data } = await (supabase as any).from("profiles_basic").select("id, nome").in("id", uids.slice(k, k + 200));
    (data ?? []).forEach((p: any) => nomes.set(p.id, p.nome));
  }
  const out = new Map<string, { resp: string[]; env: string[] }>();
  ligacoes.forEach((l) => {
    const nome = nomes.get(l.usuario);
    if (!nome) return;
    const v = out.get(l.chave) ?? { resp: [], env: [] };
    if (!v[l.papel].includes(nome)) v[l.papel].push(nome);
    out.set(l.chave, v);
  });
  return out;
}
