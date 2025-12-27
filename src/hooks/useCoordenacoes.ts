import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCoordenacoesFull() {
  return useQuery({
    queryKey: ["coordenacoes-full"],
    queryFn: async () => {
      // Buscar coordenações com coordenador
      const { data: coordenacoes, error: coordError } = await supabase
        .from("coordenacoes")
        .select(`
          id,
          nome,
          area,
          descricao,
          coordenador:profiles!coordenacoes_coordenador_id_fkey(id, nome, email, telefone)
        `);

      if (coordError) throw coordError;

      // Usar a função RPC para obter estatísticas de processos (sem limite de 1000)
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_coordenacao_stats');

      if (statsError) throw statsError;

      // Criar mapa de estatísticas por coordenação
      const statsMap = new Map<string, { total: number; distribuidos: number; naoDistribuidos: number }>();
      (statsData || []).forEach((stat: any) => {
        statsMap.set(stat.coordenacao_id, {
          total: Number(stat.total_processos) || 0,
          distribuidos: Number(stat.processos_distribuidos) || 0,
          naoDistribuidos: Number(stat.processos_nao_distribuidos) || 0,
        });
      });

      const coordenacoesWithDetails = await Promise.all(
        (coordenacoes || []).map(async (coord) => {
          // Buscar membros da coordenação
          const { data: membros } = await supabase
            .from("membros_coordenacao")
            .select(`
              id,
              cargo,
              usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome, email)
            `)
            .eq("coordenacao_id", coord.id);

          // Buscar contagem de processos por membro usando count
          const membrosWithProcessCount = await Promise.all(
            (membros || []).map(async (m) => {
              if (!m.usuario?.id) {
                return { ...m, processCount: 0 };
              }
              
              const { count } = await supabase
                .from("processos")
                .select("id", { count: "exact", head: true })
                .eq("coordenacao_id", coord.id)
                .eq("advogado_responsavel_id", m.usuario.id);

              return {
                ...m,
                processCount: count || 0,
              };
            })
          );

          // Obter estatísticas da coordenação do mapa
          const stats = statsMap.get(coord.id) || { total: 0, distribuidos: 0, naoDistribuidos: 0 };

          return {
            ...coord,
            membros: membrosWithProcessCount,
            processCount: stats.total,
            unassignedCount: stats.naoDistribuidos,
            assignedCount: stats.distribuidos,
          };
        })
      );

      return coordenacoesWithDetails;
    },
  });
}
