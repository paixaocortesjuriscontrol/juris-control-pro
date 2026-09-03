import { useCallback, useState } from "react";

const STORAGE_KEY = "comentarios-vistos:v1";

type VistosMap = Record<string, string>;

function ler(): VistosMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VistosMap) : {};
  } catch {
    return {};
  }
}

/**
 * Controle local (por navegador/usuário) de quais comentários já foram vistos.
 * Guarda, para cada item, a data/hora do último comentário visualizado.
 */
export function useComentariosVistos() {
  const [vistos, setVistos] = useState<VistosMap>(() => ler());

  const marcarVisto = useCallback((chave: string, ultimoComentarioIso?: string | null) => {
    if (!chave) return;
    const quando = ultimoComentarioIso || new Date().toISOString();
    setVistos((atual) => {
      if (atual[chave] && atual[chave] >= quando) return atual;
      const proximo = { ...atual, [chave]: quando };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(proximo));
      } catch {
        /* ignora quota */
      }
      return proximo;
    });
  }, []);

  /** Há comentário mais recente do que o último visto para esta chave? */
  const temNaoVisto = useCallback(
    (chave: string | null | undefined, ultimoComentarioIso: string | null | undefined) => {
      if (!chave || !ultimoComentarioIso) return false;
      const visto = vistos[chave];
      return !visto || visto < ultimoComentarioIso;
    },
    [vistos]
  );

  return { vistos, marcarVisto, temNaoVisto };
}
