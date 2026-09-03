/**
 * Filtro da Distribuição TST por existência de matérias (pedidos) cadastradas
 * para o dossiê na tabela `pedidos_por_dossie`.
 *
 * Retorna apenas a lista de dossiês que possuem matérias cadastradas (~centenas
 * de itens); a filtragem em si acontece no banco, dentro das consultas de lista
 * e dos totalizadores. Assim evitamos varrer os 15 mil registros no navegador.
 */
import { useQuery } from "@tanstack/react-query";
import { ensurePedidosPorDossie } from "@/utils/pedidosPorDossieCache";

export type FiltroPedidosDossie = "todos" | "com" | "sem";

async function carregarDossies(): Promise<string[]> {
  const mapa = await ensurePedidosPorDossie();
  const lista: string[] = [];
  for (const [dossie, itens] of mapa.entries()) {
    if (dossie && itens && itens.size > 0) lista.push(dossie);
  }
  return lista;
}

/** Dossiês com matérias cadastradas (vazio/undefined enquanto carrega). */
export function usePedidosDossieFiltro(filtro: FiltroPedidosDossie) {
  const ativo = filtro === "com" || filtro === "sem";
  const { data, isLoading } = useQuery({
    queryKey: ["dossies-com-pedidos"],
    enabled: ativo,
    staleTime: 5 * 60_000,
    queryFn: carregarDossies,
  });

  return { dossiesComPedidos: data, loading: ativo && isLoading };
}
