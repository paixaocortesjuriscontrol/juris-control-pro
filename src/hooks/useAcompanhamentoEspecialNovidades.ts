import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMonitoramentoCounts } from "@/hooks/useMonitoramentoCounts";

/**
 * Novidades do Acompanhamento Especial no escopo do usuário logado.
 * Usa exatamente os mesmos contadores da tela Monitoramento
 * (movimentações não lidas + divergências Judit pendentes),
 * para que o badge do header nunca divirja da tela.
 */
export function useAcompanhamentoEspecialNovidades() {
  const queryClient = useQueryClient();
  const { movimentacoes, divergencias, total } = useMonitoramentoCounts();

  const marcarComoVistas = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["monitoramento-counts"] });
  }, [queryClient]);

  return {
    eventos: movimentacoes,
    divergencias,
    total,
    temNovidades: total > 0,
    marcarComoVistas,
  };
}
