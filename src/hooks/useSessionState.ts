import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** useState que sobrevive à troca de visão (desmontagem) guardando o valor na sessão do navegador. */
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) {
        const parsed = JSON.parse(raw);
        if (initial && typeof initial === "object" && !Array.isArray(initial) && parsed && typeof parsed === "object") {
          return { ...(initial as any), ...parsed };
        }
        return parsed as T;
      }
    } catch { /* ignore */ }
    return initial;
  });
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue];
}
