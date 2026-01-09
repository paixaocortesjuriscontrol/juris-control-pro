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
      // Se filtrar por coordenação, usar COUNTs ao invés de buscar registros
      if (coordenacaoId && coordenacaoId !== "todas") {
        // Usar Promise.all para paralelizar as queries de contagem
        const [
          totalResult,
          ativoResult,
          pendenteResult,
          urgenteResult,
          encerradoResult,
          arquivadoResult,
          distribuidosResult,
          membrosResult,
        ] = await Promise.all([
          // Total de processos da coordenação
          supabase
            .from("processos")
            .select("id", { count: "exact", head: true })
            .eq("coordenacao_id", coordenacaoId),
          // Ativos
          supabase
            .from("processos")
            .select("id", { count: "exact", head: true })
            .eq("coordenacao_id", coordenacaoId)
            .eq("status", "ativo"),
          // Pendentes
          supabase
            .from("processos")
            .select("id", { count: "exact", head: true })
            .eq("coordenacao_id", coordenacaoId)
            .eq("status", "pendente"),
          // Urgentes
          supabase
            .from("processos")
            .select("id", { count: "exact", head: true })
            .eq("coordenacao_id", coordenacaoId)
            .eq("status", "urgente"),
          // Encerrados
          supabase
            .from("processos")
            .select("id", { count: "exact", head: true })
            .eq("coordenacao_id", coordenacaoId)
            .eq("status", "encerrado"),
          // Arquivados
          supabase
            .from("processos")
            .select("id", { count: "exact", head: true })
            .eq("coordenacao_id", coordenacaoId)
            .eq("status", "arquivado"),
          // Distribuídos (com advogado responsável)
          supabase
            .from("processos")
            .select("id", { count: "exact", head: true })
            .eq("coordenacao_id", coordenacaoId)
            .not("advogado_responsavel_id", "is", null),
          // Membros da coordenação
          supabase
            .from("membros_coordenacao")
            .select("id", { count: "exact", head: true })
            .eq("coordenacao_id", coordenacaoId),
        ]);
        
        // Prazos urgentes - usar query separada com COUNT
        const hoje = new Date();
        const hojeStr = hoje.toISOString().split("T")[0];
        const seteDias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
        const seteDiasStr = seteDias.toISOString().split("T")[0];
        
        // Contar tarefas urgentes via join com processos
        const { count: prazosUrgentesCount } = await supabase
          .from("tarefas")
          .select("id, processos!inner(coordenacao_id)", { count: "exact", head: true })
          .eq("processos.coordenacao_id", coordenacaoId)
          .eq("status", "pendente")
          .gte("data_vencimento", hojeStr)
          .lte("data_vencimento", seteDiasStr);

        const totalProcessos = totalResult.count || 0;
        
        return {
          totalProcessos,
          processosAtivos: ativoResult.count || 0,
          processosDistribuidos: distribuidosResult.count || 0,
          processosSemCoordenacao: 0,
          statusCount: {
            ativo: ativoResult.count || 0,
            pendente: pendenteResult.count || 0,
            urgente: urgenteResult.count || 0,
            encerrado: encerradoResult.count || 0,
            arquivado: arquivadoResult.count || 0,
          },
          prazosUrgentes: prazosUrgentesCount || 0,
          totalAdvogados: membrosResult.count || 0,
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
