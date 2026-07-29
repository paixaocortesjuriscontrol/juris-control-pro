import { useUserRole } from "@/hooks/useUserRole";

/**
 * Somente admin, coordenador e assistente coordenador podem cancelar
 * itens criados pelo botão "+ Adicionar" (tarefa, prazo, evento, audiência, parcelamento).
 */
export function usePodeCancelarItens() {
  const { isAdminOrCoordinator, loading } = useUserRole();
  return { podeCancelar: isAdminOrCoordinator, loading };
}
