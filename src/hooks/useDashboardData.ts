import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardStats {
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
}

export function useDashboardStats(coordenacaoId?: string | null) {
  return useQuery({
    queryKey: ["dashboard-stats", coordenacaoId],
    queryFn: async () => {
      // Se filtrar por coordenação, calcular stats localmente
      if (coordenacaoId && coordenacaoId !== "todas") {
        // Buscar processos da coordenação
        const { data: processos, error: procError } = await supabase
          .from("processos")
          .select("id, status, advogado_responsavel_id")
          .eq("coordenacao_id", coordenacaoId);
        
        if (procError) throw procError;
        
        const procs = processos || [];
        const processosIds = procs.map(p => p.id);
        
        // Buscar tarefas urgentes (próximos 7 dias)
        const hoje = new Date();
        const hojeStr = hoje.toISOString().split("T")[0];
        const seteDias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
        const seteDiasStr = seteDias.toISOString().split("T")[0];
        
        let prazosUrgentes = 0;
        if (processosIds.length > 0) {
          const { count } = await supabase
            .from("tarefas")
            .select("id", { count: "exact", head: true })
            .in("processo_id", processosIds)
            .eq("status", "pendente")
            .gte("data_vencimento", hojeStr)
            .lte("data_vencimento", seteDiasStr);
          prazosUrgentes = count || 0;
        }
        
        // Calcular status counts
        const statusCount = {
          ativo: procs.filter(p => p.status === "ativo").length,
          pendente: procs.filter(p => p.status === "pendente").length,
          urgente: procs.filter(p => p.status === "urgente").length,
          encerrado: procs.filter(p => p.status === "encerrado").length,
          arquivado: procs.filter(p => p.status === "arquivado").length,
        };
        
        // Buscar membros da coordenação
        const { count: totalMembros } = await supabase
          .from("membros_coordenacao")
          .select("id", { count: "exact", head: true })
          .eq("coordenacao_id", coordenacaoId);
        
        return {
          totalProcessos: procs.length,
          processosAtivos: statusCount.ativo,
          processosDistribuidos: procs.filter(p => p.advogado_responsavel_id).length,
          processosSemCoordenacao: 0,
          statusCount,
          prazosUrgentes,
          totalAdvogados: totalMembros || 0,
          totalCoordenacoes: 1,
        } as DashboardStats;
      }
      
      // Sem filtro - usar RPC global
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      
      if (error) throw error;
      
      return data as unknown as DashboardStats;
    },
    staleTime: 30000,
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
    queryKey: ["upcoming-tarefas", limit],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          id,
          titulo,
          descricao,
          data_vencimento,
          prioridade,
          status,
          processo:processos!tarefas_processo_id_fkey(numero)
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
