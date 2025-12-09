import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCoordenacoesFull() {
  return useQuery({
    queryKey: ["coordenacoes-full"],
    queryFn: async () => {
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

      const coordenacoesWithDetails = await Promise.all(
        (coordenacoes || []).map(async (coord) => {
          const [membrosResult, processosResult] = await Promise.all([
            supabase.from("membros_coordenacao").select(`
              id,
              cargo,
              usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome, email)
            `).eq("coordenacao_id", coord.id),
            supabase.from("processos").select("id, advogado_responsavel_id").eq("coordenacao_id", coord.id),
          ]);

          const membros = membrosResult.data || [];
          const processos = processosResult.data || [];

          // Calculate process count per member
          const membrosWithProcessCount = membros.map(m => {
            const memberProcessCount = processos.filter(p => p.advogado_responsavel_id === m.usuario?.id).length;
            return {
              ...m,
              processCount: memberProcessCount,
            };
          });

          // Calculate unassigned processes (no advogado_responsavel_id)
          const unassignedCount = processos.filter(p => !p.advogado_responsavel_id).length;
          const assignedCount = processos.filter(p => p.advogado_responsavel_id).length;

          return {
            ...coord,
            membros: membrosWithProcessCount,
            processCount: processos.length,
            unassignedCount,
            assignedCount,
          };
        })
      );

      return coordenacoesWithDetails;
    },
  });
}
