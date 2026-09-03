import { useEffect, useMemo } from "react";

/**
 * Persiste os filtros da Análise DJEN em sessionStorage para que, ao sair da
 * tela (abrir um processo, ir para outra página) e voltar, a lista continue com
 * o mesmo recorte que o usuário havia montado.
 *
 * Uso:
 *   const iniciais = useFiltrosDjenIniciais(CHAVE, PADROES);
 *   const [dataInicio, setDataInicio] = useState(iniciais.dataInicio);
 *   ...
 *   usePersistirFiltrosDjen(CHAVE, { dataInicio, dataFim, ... });
 */
export function useFiltrosDjenIniciais<T extends Record<string, unknown>>(
  chave: string,
  padroes: T,
): T {
  return useMemo(() => {
    if (typeof window === "undefined") return padroes;
    try {
      const raw = window.sessionStorage.getItem(chave);
      if (!raw) return padroes;
      const salvo = JSON.parse(raw);
      if (!salvo || typeof salvo !== "object") return padroes;
      const out: Record<string, unknown> = { ...padroes };
      for (const k of Object.keys(padroes)) {
        if (salvo[k] !== undefined && salvo[k] !== null) out[k] = salvo[k];
      }
      return out as T;
    } catch {
      return padroes;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
}

export function usePersistirFiltrosDjen(chave: string, valores: Record<string, unknown>) {
  const serializado = JSON.stringify(valores);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(chave, serializado);
    } catch {
      /* storage cheio/indisponível — filtros apenas não persistem */
    }
  }, [chave, serializado]);
}
