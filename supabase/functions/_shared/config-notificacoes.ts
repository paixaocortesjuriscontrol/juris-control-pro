// Preferências de notificação por coordenação.
// Linha com coordenacao_id NULL = padrão do usuário; linha com coordenacao_id = personalização.
// Linha específica com ativo=false desliga todos os avisos daquela coordenação.

export type ConfigNotif = Record<string, any>;

export async function carregarConfigsUsuarios(supabase: any, usuarioIds: string[]) {
  const mapa = new Map<string, { padrao: ConfigNotif | null; porCoord: Map<string, ConfigNotif> }>();
  if (usuarioIds.length === 0) return mapa;
  const { data } = await supabase
    .from("config_notificacoes_usuario")
    .select("*")
    .in("usuario_id", [...new Set(usuarioIds)]);
  for (const c of (data ?? []) as ConfigNotif[]) {
    if (!mapa.has(c.usuario_id)) mapa.set(c.usuario_id, { padrao: null, porCoord: new Map() });
    const m = mapa.get(c.usuario_id)!;
    if (c.coordenacao_id) m.porCoord.set(c.coordenacao_id, c);
    else m.padrao = c;
  }
  return mapa;
}

/** Retorna a config efetiva (ou undefined se não houver nenhuma). Se a coordenação estiver desativada, retorna null. */
export function resolverConfig(
  mapa: Awaited<ReturnType<typeof carregarConfigsUsuarios>>,
  usuarioId: string,
  coordenacaoId: string | null | undefined,
): ConfigNotif | null | undefined {
  const m = mapa.get(usuarioId);
  if (!m) return undefined;
  const esp = coordenacaoId ? m.porCoord.get(coordenacaoId) : undefined;
  if (esp) return esp.ativo === false ? null : esp;
  return m.padrao ?? undefined;
}
