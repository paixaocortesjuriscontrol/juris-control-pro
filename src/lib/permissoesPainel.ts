import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** O remanejamento em lote é uma ação de gestão, não de execução da atividade. */
export function podeRemanejarNoPainel(role: AppRole | null): boolean {
  return role === "admin" || role === "coordenador" || role === "assistente_coordenador";
}
