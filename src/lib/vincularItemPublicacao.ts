import { supabase } from "@/integrations/supabase/client";

/**
 * Liga um item (prazo/tarefa/audiência) à publicação de origem.
 * Usado no início do workflow e em cada etapa seguinte materializada.
 * Ignora duplicidade (item já vinculado).
 */
/**
 * A Análise DJEN Servidor lista a tabela antiga `publicacoes_djen_servidor`,
 * cujos IDs não existem em `publicacoes_djen` (destino do vínculo). Encontra a
 * publicação equivalente pelo id_djen (mesma coordenação primeiro) ou dedup_key.
 */
async function resolverPublicacaoUnificada(id: string): Promise<string | null> {
  const { data: direto } = await supabase.from("publicacoes_djen").select("id").eq("id", id).maybeSingle();
  if (direto?.id) return direto.id;
  const { data: srv } = await (supabase as any)
    .from("publicacoes_djen_servidor")
    .select("id_djen, dedup_key, coordenacao_id")
    .eq("id", id)
    .maybeSingle();
  if (!srv) return null;
  if (srv.id_djen) {
    const { data: rows } = await (supabase as any)
      .from("publicacoes_djen").select("id, coordenacao_id").eq("id_djen", srv.id_djen).limit(20);
    const lista = (rows ?? []) as { id: string; coordenacao_id: string | null }[];
    const mesma = lista.find((r) => r.coordenacao_id === srv.coordenacao_id) ?? lista[0];
    if (mesma) return mesma.id;
  }
  if (srv.dedup_key) {
    const { data: rows } = await (supabase as any)
      .from("publicacoes_djen").select("id, coordenacao_id").eq("dedup_key", srv.dedup_key).limit(20);
    const lista = (rows ?? []) as { id: string; coordenacao_id: string | null }[];
    const mesma = lista.find((r) => r.coordenacao_id === srv.coordenacao_id) ?? lista[0];
    if (mesma) return mesma.id;
  }
  // Sem cópia na lista nova: cria agora (função confere acesso à coordenação).
  const { data: criada, error } = await (supabase as any).rpc("garantir_publicacao_unificada", { p_servidor_id: id });
  if (error) throw error;
  return (criada as string) ?? null;
}

export async function vincularItemPublicacao(
  item: { id: string; tipo: string },
  origem: { tipo?: string | null; id?: string | null },
) {
  if (!origem?.id || !origem.tipo || !item?.id) return;
  const tipo = item.tipo.toLowerCase();
  if (origem.tipo === "termo") {
    const unificada = await resolverPublicacaoUnificada(origem.id);
    if (!unificada) throw new Error("Publicação de origem não encontrada para vincular.");
    origem = { ...origem, id: unificada };
  }
  let res: { error: any } | null = null;
  if (tipo === "tarefa" || tipo === "prazo") {
    if (origem.tipo === "termo") {
      res = await supabase.from("tarefas_publicacoes").insert({ tarefa_id: item.id, publicacao_id: origem.id });
    } else if (origem.tipo === "processo") {
      res = await supabase.from("tarefas_publicacoes_processos").insert({ tarefa_id: item.id, publicacao_processo_id: origem.id });
    }
  } else if (tipo === "audiencia") {
    if (origem.tipo === "termo") {
      res = await supabase.from("audiencias_publicacoes").insert({ audiencia_id: item.id, publicacao_id: origem.id });
    } else if (origem.tipo === "processo") {
      res = await supabase.from("audiencias_publicacoes_processos").insert({ audiencia_id: item.id, publicacao_processo_id: origem.id });
    } else if (origem.tipo === "descartada") {
      res = await supabase.from("audiencias_publicacoes_descartadas").insert({ audiencia_id: item.id, publicacao_descartada_id: origem.id });
    }
  }
  if (res?.error && res.error.code !== "23505") throw res.error;
}
