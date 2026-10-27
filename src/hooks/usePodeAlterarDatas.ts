import { usePodeReagendar } from "@/hooks/usePodeReagendar";

/**
 * A configuração "Quem pode reagendar" da coordenação e do tipo do item
 * controla a alteração de datas, sem uma trava adicional por perfil.
 */
export function usePodeAlterarDatas(coordenacaoId?: string | null, tipoItem?: string | null) {
  const { podeReagendar, loading: loadingReagendar } = usePodeReagendar(coordenacaoId, tipoItem);
  const bloqueado = !podeReagendar;
  return {
    podeAlterarDatas: !bloqueado,
    datasBloqueadas: bloqueado,
    loading: loadingReagendar,
    motivoBloqueio: "Você não está autorizado a reagendar/alterar datas neste tipo de tarefa.",
  };
}
