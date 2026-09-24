import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getItemRawId } from "@/hooks/useItensComAtividades";

type ItemBase = { id: string; origem?: string };

async function emLotes<T>(ids: string[], fn: (lote: string[]) => Promise<T[]>) {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) out.push(...(await fn(ids.slice(i, i + 200))));
  return out;
}

/**
 * Retorna um Map de id "cru" (getItemRawId) → data da publicação (ISO) para os
 * itens do painel que foram criados a partir de uma publicação
 * (tarefas/prazos e audiências). Itens sem vínculo não aparecem no Map.
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
      const [tp, tpp, ap, app, ad] = await Promise.all([
        emLotes(t, async (l) => (await sb.from("tarefas_publicacoes").select("tarefa_id, publicacao_id").in("tarefa_id", l)).data ?? []),
        emLotes(t, async (l) => (await sb.from("tarefas_publicacoes_processos").select("tarefa_id, publicacao_processo_id").in("tarefa_id", l)).data ?? []),
        emLotes(a, async (l) => (await sb.from("audiencias_publicacoes").select("audiencia_id, publicacao_id").in("audiencia_id", l)).data ?? []),
        emLotes(a, async (l) => (await sb.from("audiencias_publicacoes_processos").select("audiencia_id, publicacao_processo_id").in("audiencia_id", l)).data ?? []),
        emLotes(a, async (l) => (await sb.from("audiencias_detectadas").select("id, publicacao_id").in("id", l).not("publicacao_id", "is", null)).data ?? []),
      ]);

      // Vínculos item → publicação (publicacoes_djen) e item → publicacao_processo
      const itemPub = new Map<string, string>();
      const itemPubProc = new Map<string, string>();
      for (const r of tp as any[]) if (r.publicacao_id && !itemPub.has(r.tarefa_id)) itemPub.set(r.tarefa_id, r.publicacao_id);
      for (const r of ap as any[]) if (r.publicacao_id && !itemPub.has(r.audiencia_id)) itemPub.set(r.audiencia_id, r.publicacao_id);
      for (const r of ad as any[]) if (r.publicacao_id && !itemPub.has(r.id)) itemPub.set(r.id, r.publicacao_id);
      for (const r of tpp as any[]) if (r.publicacao_processo_id && !itemPubProc.has(r.tarefa_id)) itemPubProc.set(r.tarefa_id, r.publicacao_processo_id);
      for (const r of app as any[]) if (r.publicacao_processo_id && !itemPubProc.has(r.audiencia_id)) itemPubProc.set(r.audiencia_id, r.publicacao_processo_id);

      const pubIds = Array.from(new Set(itemPub.values()));
      const pubProcIds = Array.from(new Set(itemPubProc.values()));

      const dataPorPub = new Map<string, string>();
      const dataPorPubProc = new Map<string, string>();
      await Promise.all([
        emLotes(pubIds, async (l) => (await sb.from("publicacoes_djen").select("id, data_publicacao, data_disponibilizacao").in("id", l)).data ?? [])
          .then((rows: any[]) => rows.forEach((r) => dataPorPub.set(String(r.id), r.data_publicacao ?? r.data_disponibilizacao))),
        emLotes(pubProcIds, async (l) => (await sb.from("publicacoes_djen_processos").select("id, data_publicacao, data_disponibilizacao").in("id", l)).data ?? [])
          .then((rows: any[]) => rows.forEach((r) => dataPorPubProc.set(String(r.id), r.data_publicacao ?? r.data_disponibilizacao))),
      ]);

      const resultado = new Map<string, string>();
      itemPub.forEach((pubId, itemId) => {
        const d = dataPorPub.get(String(pubId));
        if (d) resultado.set(String(itemId), d);
        else resultado.set(String(itemId), "");
      });
      itemPubProc.forEach((ppId, itemId) => {
        if (resultado.has(String(itemId)) && resultado.get(String(itemId))) return;
        const d = dataPorPubProc.get(String(ppId));
        resultado.set(String(itemId), d ?? "");
      });
      return resultado;
    },
  });
}

/** Formata a data da publicação (date ou timestamp) para dd/MM/aaaa sem deslocar fuso. */
export function formatDataPublicacao(raw?: string | null): string | null {
  if (!raw) return null;
  const iso = String(raw).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
