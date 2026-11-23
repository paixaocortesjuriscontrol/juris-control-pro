import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { carregarCoordenacoesDoUsuario } from "@/lib/coordenacoesDoUsuario";
import type { CoordenacaoUsuario } from "@/lib/coordenacoesDoUsuario";

export type { CoordenacaoUsuario } from "@/lib/coordenacoesDoUsuario";

/**
 * Regra única de coordenação para os formulários do botão "+ Adicionar":
 * - Admin ou usuário com mais de uma coordenação: precisa escolher.
 * - Usuário com exatamente uma coordenação: vinculação automática, sem select.
 * - Coordenador global pode pedir a lista ampliada apenas nos seletores de delegação.
 */
export function useCoordenacoesDoUsuario(options?: { incluirTodasParaCoordenador?: boolean }) {
  const { user } = useAuth();
  const incluirTodasParaCoordenador = !!options?.incluirTodasParaCoordenador;

  const query = useQuery({
    queryKey: ["coordenacoes-do-usuario", user?.id, incluirTodasParaCoordenador],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
    queryFn: () => carregarCoordenacoesDoUsuario(
      supabase,
      user!.id,
      incluirTodasParaCoordenador,
    ),
  });

  const data = query.data;
  const isAdmin = data?.isAdmin ?? false;
  const coordenacoes = data?.coordenacoes ?? [];
  const podeDelegar = data?.podeDelegar ?? false;
  // Coordenador de uma só coordenação também recebe a pré-seleção (o seletor segue visível).
  const unicaCoordenacaoId = !isAdmin && coordenacoes.length === 1 ? coordenacoes[0].id : null;
  const coordenacaoSugeridaId = !isAdmin
    ? (data?.idsProprias?.[0] || coordenacoes[0]?.id || null)
    : null;
  const precisaSelecionar = isAdmin || podeDelegar || coordenacoes.length > 1;

  return {
    isAdmin,
    coordenacoes,
    unicaCoordenacaoId,
    coordenacaoSugeridaId,
    precisaSelecionar,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
