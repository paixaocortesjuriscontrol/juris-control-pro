import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FalhaTribunalResumo {
  tribunal: string;
  pendentes: number;
  abandonadas: number;
  total: number;
  ultimoErro: string | null;
}

/**
 * Resumo das falhas de captura do dia (DJEN servidor), agrupadas por tribunal.
 */
export function useFalhasDoDiaPorTribunal(dataYmd: string | null | undefined) {
  return useQuery({
    queryKey: ["falhas-dia-tribunal", dataYmd],
    enabled: !!dataYmd,
    staleTime: 60_000,
    queryFn: async (): Promise<FalhaTribunalResumo[]> => {
      const { data, error } = await supabase
        .from("execucoes_servidor_falhas")
        .select("payload, status, ultimo_erro, tentativas")
        .eq("dia_brt", dataYmd as string)
        .neq("status", "resolvido")
        .limit(2000);
      if (error) throw error;

      const mapa = new Map<string, FalhaTribunalResumo>();
      for (const row of data || []) {
        const payload = (row.payload || {}) as Record<string, unknown>;
        const tribunal = String(payload.tribunal || "—").toUpperCase();
        const atual =
          mapa.get(tribunal) || {
            tribunal,
            pendentes: 0,
            abandonadas: 0,
            total: 0,
            ultimoErro: null as string | null,
          };
        atual.total += 1;
        if (row.status === "abandonado") atual.abandonadas += 1;
        else atual.pendentes += 1;
        if (!atual.ultimoErro && row.ultimo_erro) atual.ultimoErro = row.ultimo_erro;
        mapa.set(tribunal, atual);
      }

      return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
    },
  });
}