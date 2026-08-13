import { useUserRole } from "@/hooks/useUserRole";
import { usePodeReagendar } from "@/hooks/usePodeReagendar";

/**
 * Perfis SEM permissão para alterar datas de prazos/tarefas/eventos/audiências.
 * Admin, coordenador, assistente coordenador e advogados podem alterar.
 */
const PERFIS_BLOQUEADOS = ["estagiario", "assistente", "secretaria"] as const;

/**
 * Quem não pode reagendar (config. "Quem pode reagendar" da coordenação)
 * também não pode alterar datas/prazos do item.
 */
export function usePodeAlterarDatas(coordenacaoId?: string | null, tipoItem?: string | null) {
  const { role, loading } = useUserRole();
  const { podeReagendar, loading: loadingReagendar } = usePodeReagendar(coordenacaoId, tipoItem);
  const perfilBloqueado = !!role && (PERFIS_BLOQUEADOS as readonly string[]).includes(role);
  const bloqueado = perfilBloqueado || !podeReagendar;
  return {
    podeAlterarDatas: !bloqueado,
    datasBloqueadas: bloqueado,
    loading: loading || loadingReagendar,
    motivoBloqueio: perfilBloqueado
      ? "Seu perfil não tem permissão para alterar datas."
      : "Você não está autorizado a reagendar/alterar datas neste tipo de tarefa.",
  };
}
