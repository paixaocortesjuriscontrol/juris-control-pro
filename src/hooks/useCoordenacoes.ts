import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCoordenacoesFull() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["coordenacoes-full", "v2", user?.id],
    refetchOnMount: "always",
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      // Verificar se é admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdmin = roleData?.role === "admin";

      // Buscar IDs de coordenações do usuário (caso não seja admin)
      let coordenacoesIds: string[] | null = null;
      if (!isAdmin) {
        const { data: membros } = await supabase
          .from("membros_coordenacao")
          .select("coordenacao_id")
          .eq("usuario_id", user.id);

        coordenacoesIds = (membros || []).map((m) => m.coordenacao_id);

        // Se não é membro de nenhuma coordenação, retorna vazio
        if (coordenacoesIds.length === 0) return [];
      }

      // Buscar coordenações filtradas
      let coordQuery = supabase
        .from("coordenacoes")
        .select(`
          id,
          nome,
          area,
          descricao,
          monitorar_redistribuicoes,
          monitorar_distribuicoes,
          coordenador:profiles!coordenacoes_coordenador_id_fkey(id, nome, email, telefone)
        `)
        .order("nome");

      if (!isAdmin && coordenacoesIds) {
        coordQuery = coordQuery.in("id", coordenacoesIds);
      }

      const { data: coordenacoes, error: coordError } = await coordQuery;
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

      // ID da coordenação da Dra. Renata (usa dados_benner / Distribuição TST como fonte de verdade)
      const RENATA_COORD_ID = "3e47fc83-3539-4fa7-9fcf-33825120e1b7";

      const coordenacoesWithDetails = await Promise.all(
        (coordenacoes || []).map(async (coord) => {
          // Buscar membros da coordenação
          const { data: membros } = await supabase
            .from("membros_coordenacao")
            .select(`
              id,
              cargo,
              usuario_id,
              usuario:profiles_basic!membros_coordenacao_usuario_id_fkey(id, nome)
            `)
            .eq("coordenacao_id", coord.id);

          const isRenata = coord.id === RENATA_COORD_ID;

          // Buscar contagem de processos por membro
          const membrosWithProcessCount = await Promise.all(
            (membros || []).map(async (m: any) => {
              const userId = m.usuario?.id || m.usuario_id;
              if (!userId) return { ...m, processCount: 0 };

              if (isRenata) {
                // Conta dados_benner distintos vinculados ao usuário (Distribuição TST)
                const { data: links } = await supabase
                  .from("dados_benner_responsaveis" as any)
                  .select("dados_benner_id, dados_benner!inner(coordenacao_id, aba_origem)" as any)
                  .eq("usuario_id", userId)
                  .eq("dados_benner.coordenacao_id", coord.id)
                  .not("dados_benner.aba_origem", "is", null);
                const distinct = new Set(((links as any[]) || []).map(l => l.dados_benner_id));
                return { ...m, processCount: distinct.size };
              }

              // Conta processos onde o usuário é responsável principal (legado)
              // ou está vinculado em processos_responsaveis (múltiplos responsáveis)
              const [{ data: principais }, { data: vinculos }] = await Promise.all([
                supabase
                  .from("processos")
                  .select("id")
                  .eq("coordenacao_id", coord.id)
                  .eq("advogado_responsavel_id", userId),
                supabase
                  .from("processos_responsaveis")
                  .select("processo_id, processos!inner(coordenacao_id)")
                  .eq("usuario_id", userId)
                  .eq("processos.coordenacao_id", coord.id),
              ]);

              const ids = new Set<string>();
              (principais || []).forEach((p: any) => ids.add(p.id));
              (vinculos || []).forEach((v: any) => ids.add(v.processo_id));

              return { ...m, processCount: ids.size };
            })
          );

          let stats = statsMap.get(coord.id) || { total: 0, distribuidos: 0, naoDistribuidos: 0 };

          if (isRenata) {
            // Override: usa dados_benner como fonte para Dra. Renata
            const { count: totalDb } = await supabase
              .from("dados_benner" as any)
              .select("id", { count: "exact", head: true })
              .eq("coordenacao_id", coord.id)
              .not("aba_origem", "is", null);

            // Distribuídos: dados_benner que têm pelo menos 1 responsável
            const { data: comResp } = await supabase
              .from("dados_benner_responsaveis" as any)
              .select("dados_benner_id, dados_benner!inner(coordenacao_id, aba_origem)" as any)
              .eq("dados_benner.coordenacao_id", coord.id)
              .not("dados_benner.aba_origem", "is", null);
            const distribuidosCount = new Set(((comResp as any[]) || []).map(r => r.dados_benner_id)).size;

            stats = {
              total: totalDb || 0,
              distribuidos: distribuidosCount,
              naoDistribuidos: Math.max((totalDb || 0) - distribuidosCount, 0),
            };
          }

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
