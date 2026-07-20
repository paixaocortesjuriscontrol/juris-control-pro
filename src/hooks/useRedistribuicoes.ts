// Deprecated: funcionalidade de Redistribuições removida do sistema.
// Este hook permanece como stub para preservar compatibilidade com telas legadas
// enquanto elas são gradualmente removidas.
export function useRedistribuicoes(_params?: any) {
  return {
    data: [] as any[],
    isLoading: false,
    error: null,
    refetch: async () => ({ data: [] as any[] }),
  };
}
export default useRedistribuicoes;
