import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProcessos() {
  return useQuery({
    queryKey: ["processos"],
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
          tribunal,
          vara,
          comarca,
          valor_causa,
          data_distribuicao,
          coordenacao_id,
          created_at,
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(id, nome),
          cliente:clientes!processos_cliente_id_fkey(id, nome, tipo)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useProcessoStats() {
  return useQuery({
    queryKey: ["processo-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("area, status");

      if (error) throw error;

      const processos = data || [];
      
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
