/**
 * Resolve a coordenação de um usuário (membro ou coordenador titular).
 * Usado para gravar `coordenacao_id` no histórico de alertas enviados.
 */
const cache = new Map<string, string | null>();

export async function coordenacaoDoUsuario(
  supabase: any,
  usuarioId?: string | null,
): Promise<string | null> {
  if (!usuarioId) return null;
  if (cache.has(usuarioId)) return cache.get(usuarioId) ?? null;
  let coord: string | null = null;
  const { data: membro } = await supabase
    .from("membros_coordenacao")
    .select("coordenacao_id")
    .eq("usuario_id", usuarioId)
    .limit(1)
    .maybeSingle();
  coord = membro?.coordenacao_id ?? null;
  if (!coord) {
    const { data: titular } = await supabase
      .from("coordenacoes")
      .select("id")
      .eq("coordenador_id", usuarioId)
      .limit(1)
      .maybeSingle();
    coord = titular?.id ?? null;
  }
  cache.set(usuarioId, coord);
  return coord;
}
