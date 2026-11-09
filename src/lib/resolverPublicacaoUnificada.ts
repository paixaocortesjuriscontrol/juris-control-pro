export type ClienteResolverPublicacao = {
  rpc: (
    nome: "garantir_publicacao_unificada",
    args: { p_servidor_id: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

/**
 * Resolve a publicação no banco, que garante cópia e acesso da mesma coordenação.
 * Nenhum identificador de outra coordenação é escolhido no navegador.
 */
export async function resolverPublicacaoUnificada(
  id: string,
  cliente: ClienteResolverPublicacao,
): Promise<string | null> {
  const { data, error } = await cliente.rpc("garantir_publicacao_unificada", { p_servidor_id: id });
  if (error) throw error;
  return (data as string | null) ?? null;
}
