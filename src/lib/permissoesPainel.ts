import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const CARGOS_REMANEJAR = new Set(["coordenador", "assistente_coordenador", "controladoria"]);

const normalizarCargo = (c: string) =>
  c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, "_");

/** O remanejamento em lote é uma ação de gestão: vale o perfil geral ou o cargo dentro de alguma coordenação. */
export function podeRemanejarNoPainel(role: AppRole | null, cargosCoordenacao: string[] = []): boolean {
  if (role === "admin" || role === "coordenador" || role === "assistente_coordenador" || role === "controladoria") return true;
  return cargosCoordenacao.some((c) => CARGOS_REMANEJAR.has(normalizarCargo(c)));
}
