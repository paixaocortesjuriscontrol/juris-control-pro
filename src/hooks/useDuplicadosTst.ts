/**
 * Duplicados da Distribuição TST.
 *
 * Um processo é considerado duplicado quando existem 2 ou mais fichas ATIVAS
 * (não arquivadas, com `aba_origem` preenchida) com o mesmo número de processo.
 * A comparação usa somente os dígitos do número, para não depender de máscara.
 *
 * Nada aqui grava no banco — é só leitura para destacar na tela.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cachedAsync } from "@/utils/distribuicaoTstCache";
import { DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "./useDistribuicoesTst";

/** Chave de comparação de processo: dígitos quando houver CNJ completo. */
export function chaveProcessoDuplicado(processo?: string | null): string {
  const raw = String(processo || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 20 ? digits : raw.toLowerCase();
}

export interface MapaDuplicados {
  /** chave do processo -> ids das fichas ativas (2 ou mais). */
  grupos: Map<string, string[]>;
  /** todos os ids que pertencem a algum grupo duplicado. */
  ids: Set<string>;
}

/** Carrega (com cache curto) o mapa de grupos duplicados da base ativa. */
export function fetchMapaDuplicadosCached(): Promise<MapaDuplicados> {
  return cachedAsync("duplicados-mapa", async () => {
    const PAGE = 1000;
    const porProcesso = new Map<string, string[]>();
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("dados_benner" as any)
        .select("id, processo")
        .not("aba_origem", "is", null)
        .not("processo", "is", null)
        .order("processo", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data as any[]) || [];
      for (const r of rows) {
        const key = chaveProcessoDuplicado(r.processo);
        if (!key) continue;
        const arr = porProcesso.get(key);
        if (arr) arr.push(r.id);
        else porProcesso.set(key, [r.id]);
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    const grupos = new Map<string, string[]>();
    const ids = new Set<string>();
    porProcesso.forEach((arr, key) => {
      if (arr.length > 1) {
        grupos.set(key, arr);
        arr.forEach((id) => ids.add(id));
      }
    });
    return { grupos, ids };
  });
}

/**
 * Hook de consulta ao mapa de duplicados. Expõe helpers síncronos para a lista.
 */
export function useDuplicadosTst() {
  const [mapa, setMapa] = useState<MapaDuplicados | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setMapa(await fetchMapaDuplicadosCached());
    } catch (e) {
      console.warn("[useDuplicadosTst] falha ao carregar duplicados:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const idsDoGrupo = useCallback(
    (processo?: string | null): string[] => {
      const key = chaveProcessoDuplicado(processo);
      if (!key || !mapa) return [];
      return mapa.grupos.get(key) || [];
    },
    [mapa],
  );

  const qtdDuplicados = useCallback(
    (processo?: string | null): number => idsDoGrupo(processo).length,
    [idsDoGrupo],
  );

  const isDuplicado = useCallback(
    (processo?: string | null): boolean => idsDoGrupo(processo).length > 1,
    [idsDoGrupo],
  );

  return { mapa, loading, isDuplicado, qtdDuplicados, idsDoGrupo, refetch: carregar };
}

/**
 * Quantidade de fichas duplicadas que estão DENTRO dos filtros ativos da tela.
 * Interseção entre o conjunto global de duplicados e os ids filtrados
 * (mesma fonte usada pelos demais totalizadores).
 */
export function useDuplicadosNoFiltro(filters: DistribuicaoTstFilters) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      try {
        // Parte do conjunto (pequeno) de duplicados e pergunta ao banco quantos
        // deles passam pelos filtros. Assim não depende de varrer a base toda.
        const mapa = await fetchMapaDuplicadosCached();
        let dupIds = Array.from(mapa.ids);
        // Se o filtro já restringe ids (ex.: card "Revisar lista de matérias"),
        // faz a interseção em vez de sobrescrever.
        const jaRestrito = (filters as any).idsAllowed as string[] | undefined;
        if (jaRestrito && jaRestrito.length > 0) {
          const permitidos = new Set(jaRestrito);
          dupIds = dupIds.filter((id) => permitidos.has(id));
        }
        if (dupIds.length === 0) { if (!cancelado) setCount(0); return; }
        const ids = await fetchAllDistribuicaoTstIds({ ...filters, idsAllowed: dupIds } as any);
        if (cancelado) return;
        setCount(ids.length);
      } catch (e) {
        console.warn("[useDuplicadosNoFiltro] falha:", e);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  return { count, loading };
}
