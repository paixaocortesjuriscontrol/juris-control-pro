/**
 * IDs da Distribuição TST separados por existência de matérias (pedidos)
 * cadastradas para o dossiê na tabela `pedidos_por_dossie`.
 *
 * A relação é feita pelo texto do dossiê (mesma chave usada em
 * `pedidosPorDossieCache`). Registros sem dossiê preenchido entram no grupo
 * "sem matérias cadastradas", pois também não há lista para comparar.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cachedAsync } from "@/utils/distribuicaoTstCache";
import { ensurePedidosPorDossie } from "@/utils/pedidosPorDossieCache";

export type FiltroPedidosDossie = "todos" | "com" | "sem";

async function carregarIds(): Promise<{ com: string[]; sem: string[] }> {
  const mapa = await ensurePedidosPorDossie();
  const PAGE = 1000;
  const com: string[] = [];
  const sem: string[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("dados_benner" as any)
      .select("id, dossie")
      .not("aba_origem", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as any[]) || [];
    for (const r of rows) {
      const dossie = String(r?.dossie || "").trim();
      const set = dossie ? mapa.get(dossie) : null;
      if (set && set.size > 0) com.push(r.id as string);
      else sem.push(r.id as string);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return { com, sem };
}

/** IDs permitidos para o filtro escolhido (null = filtro desligado). */
export function useIdsPorPedidosDossie(filtro: FiltroPedidosDossie) {
  const ativo = filtro === "com" || filtro === "sem";
  const { data, isLoading } = useQuery({
    queryKey: ["ids-por-pedidos-dossie"],
    enabled: ativo,
    staleTime: 60_000,
    queryFn: () => cachedAsync("ids-por-pedidos-dossie", carregarIds),
  });

  const ids = !ativo || !data ? null : filtro === "com" ? data.com : data.sem;
  return { ids, loading: ativo && isLoading };
}
