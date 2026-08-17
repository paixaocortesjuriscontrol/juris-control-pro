import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SaudeSlot {
  id: string;
  label: string | null;
  base_url: string;
  enabled: boolean | null;
  ultima_checagem_em: string | null;
  saude_status: string | null;
  saude_motivo: string | null;
  latencia_ms: number | null;
  cert_expira_em: string | null;
  cert_dias_restantes: number | null;
}

/** Saúde persistida de cada VPS do pool (gravada pela checagem diária). */
export function useSaudePoolDjen() {
  return useQuery({
    queryKey: ["saude-pool-djen"],
    staleTime: 30_000,
    queryFn: async (): Promise<SaudeSlot[]> => {
      const { data, error } = await (supabase.from("djen_proxy_pool") as any)
        .select(
          "id, label, base_url, enabled, ultima_checagem_em, saude_status, saude_motivo, latencia_ms, cert_expira_em, cert_dias_restantes",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as SaudeSlot[];
    },
  });
}

/** Dispara a checagem agora (sem enviar e-mail) e recarrega os selos. */
export function useChecarSaudePoolDjen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slotId?: string) => {
      const { data, error } = await supabase.functions.invoke("verificar-saude-pool-djen", {
        body: { somenteChecar: true, ...(slotId ? { slotId } : {}) },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["saude-pool-djen"] });
    },
  });
}

export type NivelSaude = "ok" | "atencao" | "critico" | "desconhecido";

export function nivelSaude(s: SaudeSlot | undefined): NivelSaude {
  if (!s || !s.saude_status) return "desconhecido";
  if (s.saude_status !== "ok") return "critico";
  if (s.cert_dias_restantes !== null && s.cert_dias_restantes <= 15) return "atencao";
  return "ok";
}
