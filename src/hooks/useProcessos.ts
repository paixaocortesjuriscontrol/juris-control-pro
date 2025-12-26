import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProcessos() {
  return useQuery({
    queryKey: ["processos"],
    staleTime: 10 * 60 * 1000, // 10 minutes for processos
    gcTime: 60 * 60 * 1000, // 1 hour cache
    queryFn: async () => {
      // Fetch all processos in batches to bypass 1000 limit
      let allProcessos: any[] = [];
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
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
            tribunal,
            vara,
            comarca,
            valor_causa,
            data_distribuicao,
            coordenacao_id,
            pasta_id,
            created_at,
            advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(id, nome),
            cliente:clientes!processos_cliente_id_fkey(id, nome, tipo)
          `)
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allProcessos = [...allProcessos, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allProcessos;
    },
  });
}

export function useProcessoStats() {
  return useQuery({
    queryKey: ["processo-stats"],
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      // Fetch all processos in batches
      let allProcessos: any[] = [];
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("processos")
          .select("area, status")
          .range(from, from + batchSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allProcessos = [...allProcessos, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      const processos = allProcessos;
      
      const porArea = {
        civil: processos.filter(p => p.area === "civil").length,
        trabalhista: processos.filter(p => p.area === "trabalhista").length,
        empresarial: processos.filter(p => p.area === "empresarial").length,
      };

      const porStatus = {
        ativo: processos.filter(p => p.status === "ativo").length,
        pendente: processos.filter(p => p.status === "pendente").length,
        urgente: processos.filter(p => p.status === "urgente").length,
        encerrado: processos.filter(p => p.status === "encerrado").length,
        arquivado: processos.filter(p => p.status === "arquivado").length,
      };

      return { porArea, porStatus, total: processos.length };
    },
  });
}
