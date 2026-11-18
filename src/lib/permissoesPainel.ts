import type { Database } from "@/integrations/supabase/types";

import { normalizarCargo } from "@/lib/permissoesMenuCoordenacao";

type AppRole = Database["public"]["Enums"]["app_role"];

const CARGOS_REMANEJAR = new Set(["coordenador", "assistente_coordenador", "controladoria"]);


/** O remanejamento em lote é uma ação de gestão: vale o perfil geral ou o cargo dentro de alguma coordenação. */
export function podeRemanejarNoPainel(role: AppRole | null, cargosCoordenacao: string[] = []): boolean {
  if (role === "admin" || role === "coordenador" || role === "assistente_coordenador" || role === "controladoria") return true;
  return cargosCoordenacao.some((c) => CARGOS_REMANEJAR.has(normalizarCargo(c)));
}
