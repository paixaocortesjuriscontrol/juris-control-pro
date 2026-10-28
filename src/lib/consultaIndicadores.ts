import type { QueryClient } from "@tanstack/react-query";

/** Reuses completed batches while the agenda grows; prefix invalidation also refreshes batches. */
export async function consultarIndicadoresEmLotes<T>(
  queryClient: QueryClient,
  prefixo: string,
  escopo: readonly unknown[],
  ids: string[],
  tamanho: number,
  staleTime: number,
  consultar: (lote: string[]) => Promise<T[]>,
): Promise<T[]> {
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += tamanho) lotes.push(ids.slice(i, i + tamanho));
  const respostas = await Promise.all(lotes.map((lote) => queryClient.fetchQuery({
    queryKey: [prefixo, "lote", ...escopo, lote],
    staleTime,
    queryFn: () => consultar(lote),
  })));
  return respostas.flat();
}