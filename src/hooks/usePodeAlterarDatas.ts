import { useUserRole } from "@/hooks/useUserRole";

/**
 * Perfis SEM permissão para alterar datas de prazos/tarefas/eventos/audiências.
 * Admin, coordenador, assistente coordenador e advogados podem alterar.
 */
const PERFIS_BLOQUEADOS = ["estagiario", "assistente", "secretaria"] as const;

export function usePodeAlterarDatas() {
  const { role, loading } = useUserRole();
  const bloqueado = !!role && (PERFIS_BLOQUEADOS as readonly string[]).includes(role);
  return {
    podeAlterarDatas: !bloqueado,
    datasBloqueadas: bloqueado,
    loading,
    motivoBloqueio: "Seu perfil não tem permissão para alterar datas.",
  };
}
