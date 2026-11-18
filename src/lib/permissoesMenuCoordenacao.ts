export type RegraMenuCoordenacao = {
  coordenacao_id: string;
  cargo: string | null;
  user_id: string | null;
  menu_path: string;
  permitido: boolean;
};
export type VinculoCoordenacao = { coordenacao_id: string; cargo: string | null };

/**
 * Cargo da coordenação é texto livre ("Advogada", "Estagiária", "Assistente").
 * Converte para a chave canônica usada nas regras (sem acento, masculino, snake_case).
 */
export const normalizarCargo = (c: string | null | undefined): string => {
  const b = String(c || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (!b) return "";
  if (b.includes("assistente") && b.includes("coordenad")) return "assistente_coordenador";
  if (b.includes("coordenad")) return "coordenador";
  if (b.includes("controlad")) return "controladoria";
  if (b.includes("advogad") && b.includes("temp")) return "advogado_temporario";
  if (b.includes("advogad") && (b.includes("senior") || b.includes("sr"))) return "advogado_senior";
  if (b.includes("advogad")) return "advogado";
  if (b.includes("estagiari")) return "estagiario";
  if (b.includes("secretari")) return "secretaria";
  if (b.includes("assistente") && b.includes("geral")) return "assistente_juridico_geral";
  if (b.includes("assistente")) return "assistente";
  if (b.includes("admin")) return "admin";
  return b.replace(/\s+/g, "_");
};

/**
 * Prioridade: regra global do usuário > regra do membro na coordenação > regra do cargo > liberado.
 * Com várias coordenações, basta uma liberar.
 */
export function menuPermitido(
  path: string,
  userId: string,
  global: Record<string, boolean>,
  vinculos: VinculoCoordenacao[],
  regras: RegraMenuCoordenacao[],
): boolean {
  if (global[path] !== undefined) return global[path];
  if (!vinculos.length) return true;
  return vinculos.some((v) => {
    const daCoord = regras.filter((r) => r.coordenacao_id === v.coordenacao_id && r.menu_path === path);
    const membro = daCoord.find((r) => r.user_id === userId);
    if (membro) return membro.permitido;
    const cargo = daCoord.find((r) => r.cargo && normalizarCargo(r.cargo) === normalizarCargo(v.cargo));
    if (cargo) return cargo.permitido;
    return true;
  });
}

export const CARGOS_COORDENACAO = [
  { value: "coordenador", label: "Coordenador" },
  { value: "assistente_coordenador", label: "Assistente Coordenador" },
  { value: "controladoria", label: "Controladoria" },
  { value: "advogado_senior", label: "Advogado Sênior" },
  { value: "advogado", label: "Advogado" },
  { value: "estagiario", label: "Estagiário" },
  { value: "assistente", label: "Assistente" },
  { value: "secretaria", label: "Secretária" },
];
