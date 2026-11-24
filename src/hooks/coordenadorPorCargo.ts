import type { Database } from "@/integrations/supabase/types";
import { normalizarCargo } from "@/lib/permissoesMenuCoordenacao";

type AppRole = Database["public"]["Enums"]["app_role"];

const CARGOS_GESTAO = new Set(["coordenador", "assistente_coordenador"]);

/** Coordenador pelo perfil geral OU pelo cargo em alguma coordenação (membros_coordenacao). */
export function ehCoordenadorPorRoleOuCargo(role: AppRole | null, cargos: string[] = []): boolean {
  if (role === "coordenador" || role === "assistente_coordenador") return true;
  return cargos.some((c) => CARGOS_GESTAO.has(normalizarCargo(c)));
}
