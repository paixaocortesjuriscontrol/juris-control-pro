import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getItemRawId } from "@/hooks/useItensComAtividades";

type ItemBase = { id: string; origem?: string };

async function emLotes(ids: string[], fn: (lote: string[]) => Promise<string[]>) {
  const out: string[] = [];
  for (let i = 0; i < ids.length; i += 200) out.push(...(await fn(ids.slice(i, i + 200))));
  return out;
}

/**
 * Retorna o Set de ids "crus" (getItemRawId) dos itens do painel que foram
 * criados a partir de uma publicação (tarefas/prazos e audiências).
 */
export function useItensDePublicacao(itens: ItemBase[], enabled: boolean) {
  const tarefaIds = new Set<string>();
  const audIds = new Set<string>();
  for (const it of itens) {
    if (!it?.id) continue;
    const raw = getItemRawId(String(it.id));
    if (String(it.id).startsWith("audiencia-det-")) audIds.add(raw);
    else if (it.origem === "tarefa") tarefaIds.add(raw);
  }
  const t = Array.from(tarefaIds).sort();
  const a = Array.from(audIds).sort();

  return useQuery({
    queryKey: ["itens-de-publicacao", t.join(","), a.join(",")],
    enabled: enabled && (t.length > 0 || a.length > 0),
    staleTime: 60_000,
    queryFn: async () => {
      const sb = supabase as any;
      const [t1, t2, a1, a2, a3] = await Promise.all([
        emLotes(t, async (l) => ((await sb.from("tarefas_publicacoes").select("tarefa_id").in("tarefa_id", l)).data ?? []).map((r: any) => r.tarefa_id)),
        emLotes(t, async (l) => ((await sb.from("tarefas_publicacoes_processos").select("tarefa_id").in("tarefa_id", l)).data ?? []).map((r: any) => r.tarefa_id)),
        emLotes(a, async (l) => ((await sb.from("audiencias_publicacoes").select("audiencia_id").in("audiencia_id", l)).data ?? []).map((r: any) => r.audiencia_id)),
        emLotes(a, async (l) => ((await sb.from("audiencias_publicacoes_processos").select("audiencia_id").in("audiencia_id", l)).data ?? []).map((r: any) => r.audiencia_id)),
        emLotes(a, async (l) => ((await sb.from("audiencias_detectadas").select("id").in("id", l).not("publicacao_id", "is", null)).data ?? []).map((r: any) => r.id)),
      ]);
      return new Set<string>([...t1, ...t2, ...a1, ...a2, ...a3].map(String));
    },
  });
}
