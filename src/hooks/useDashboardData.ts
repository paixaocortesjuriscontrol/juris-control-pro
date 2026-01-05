import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      
      if (error) throw error;
      
      // The RPC returns a JSON object with all stats
      return data as {
        totalProcessos: number;
        processosAtivos: number;
        processosDistribuidos: number;
        processosSemCoordenacao: number;
        statusCount: {
          ativo: number;
          pendente: number;
          urgente: number;
          encerrado: number;
          arquivado: number;
        };
        prazosUrgentes: number;
        totalAdvogados: number;
        totalCoordenacoes: number;
      };
    },
    staleTime: 30000, // Cache for 30 seconds
  });
}

export function useRecentProcessos(limit = 3) {
  return useQuery({
    queryKey: ["recent-processos", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(`
          id,
          numero,
          assunto,
          area,
          status,
          polo_ativo,
          polo_passivo,
          created_at,
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(nome)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCoordenacoes() {
  return useQuery({
    queryKey: ["coordenacoes-dashboard"],
    queryFn: async () => {
      // Use security definer function for process counts (accessible to all users)
      const [coordenacoesResult, statsResult] = await Promise.all([
        supabase.from("coordenacoes").select(`
          id,
          nome,
          area,
          coordenador:profiles!coordenacoes_coordenador_id_fkey(id, nome, email, telefone)
        `),
        supabase.rpc('get_coordenacao_stats'),
      ]);

      if (coordenacoesResult.error) throw coordenacoesResult.error;
      
      const coordenacoes = coordenacoesResult.data || [];
      const stats = statsResult.data || [];

      // Create a map of stats by coordination id
      const statsMap = new Map(stats.map(s => [s.coordenacao_id, s]));

      // Get members for each coordination
      const coordenacoesWithDetails = await Promise.all(
        coordenacoes.map(async (coord) => {
          const membrosResult = await supabase
            .from("membros_coordenacao")
            .select(`
              id,
              cargo,
              usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
            `)
            .eq("coordenacao_id", coord.id);

          const coordStats = statsMap.get(coord.id);

          return {
            ...coord,
            membros: membrosResult.data || [],
            processCount: Number(coordStats?.total_processos || 0),
            processosDistribuidos: Number(coordStats?.processos_distribuidos || 0),
            processosNaoDistribuidos: Number(coordStats?.processos_nao_distribuidos || 0),
          };
        })
      );

      return coordenacoesWithDetails;
    },
  });
}

export function useRecentMovimentacoes(limit = 4) {
  return useQuery({
    queryKey: ["recent-movimentacoes", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select(`
          id,
          descricao,
          tipo,
          data_movimentacao,
          processo:processos!movimentacoes_processo_id_fkey(numero)
        `)
        .order("data_movimentacao", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpcomingPrazos(limit = 4) {
  return useQuery({
    queryKey: ["upcoming-prazos", limit],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("prazos")
        .select(`
          id,
          titulo,
          descricao,
          data_vencimento,
          prioridade,
          status,
          processo:processos!prazos_processo_id_fkey(numero)
        `)
        .eq("status", "pendente")
        .gte("data_vencimento", hoje)
        .order("data_vencimento", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
  });
}
