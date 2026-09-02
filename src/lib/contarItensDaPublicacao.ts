import { supabase } from "@/integrations/supabase/client";

export interface PubParaContagem {
  id: string;
  tipo_origem?: string | null;
}

/**
 * Conta quantos itens (audiências e tarefas) já foram criados a partir das
 * publicações informadas. Usado para avisar o usuário antes de descartar
 * uma publicação que já gerou agendamentos.
 */
export async function contarItensDaPublicacao(pubs: PubParaContagem[]): Promise<{
  audiencias: number;
  tarefas: number;
  total: number;
}> {
  const termoIds = pubs.filter((p) => p.tipo_origem === "termo").map((p) => p.id);
  const processoIds = pubs.filter((p) => p.tipo_origem === "processo").map((p) => p.id);

  const audiencias = new Set<string>();
  const tarefas = new Set<string>();

  try {
    if (termoIds.length) {
      const [audDiretas, audLink, tarLink] = await Promise.all([
        (supabase as any).from("audiencias_detectadas").select("id").in("publicacao_id", termoIds),
        (supabase as any).from("audiencias_publicacoes").select("audiencia_id").in("publicacao_id", termoIds),
        (supabase as any).from("tarefas_publicacoes").select("tarefa_id").in("publicacao_id", termoIds),
      ]);
      for (const r of audDiretas?.data ?? []) audiencias.add(r.id);
      for (const r of audLink?.data ?? []) audiencias.add(r.audiencia_id);
      for (const r of tarLink?.data ?? []) tarefas.add(r.tarefa_id);
    }

    if (processoIds.length) {
      const [audLink, tarLink] = await Promise.all([
        (supabase as any)
          .from("audiencias_publicacoes_processos")
          .select("audiencia_id")
          .in("publicacao_processo_id", processoIds),
        (supabase as any)
          .from("tarefas_publicacoes_processos")
          .select("tarefa_id")
          .in("publicacao_processo_id", processoIds),
      ]);
      for (const r of audLink?.data ?? []) audiencias.add(r.audiencia_id);
      for (const r of tarLink?.data ?? []) tarefas.add(r.tarefa_id);
    }
  } catch (e) {
    console.error("[contarItensDaPublicacao] falha ao contar itens:", e);
  }

  return { audiencias: audiencias.size, tarefas: tarefas.size, total: audiencias.size + tarefas.size };
}

/** Texto de aviso para o diálogo de confirmação de descarte. */
export function textoAvisoItens(c: { audiencias: number; tarefas: number; total: number }): string {
  if (c.total === 0) return "";
  const partes: string[] = [];
  if (c.audiencias) partes.push(`${c.audiencias} audiência(s)`);
  if (c.tarefas) partes.push(`${c.tarefas} tarefa(s)/prazo(s)`);
  return (
    `\n\nATENÇÃO: esta seleção já gerou ${partes.join(" e ")}. ` +
    `Esses itens serão MANTIDOS na agenda/pasta do processo — apenas a publicação sai da lista.`
  );
}
