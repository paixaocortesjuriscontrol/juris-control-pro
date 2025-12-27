import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function fetchAllRecords(
  table: "processos" | "prazos" | "movimentacoes",
  selectQuery: string
): Promise<any[]> {
  let allRecords: any[] = [];
  const batchSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select(selectQuery)
      .range(from, from + batchSize - 1);

    if (error) throw error;
    
    if (data && data.length > 0) {
      allRecords = [...allRecords, ...data];
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allRecords;
}

export function useRelatorioAtividadesData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-atividades-data"],
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled,
    queryFn: async () => {
      const [processos, prazos, movimentacoes] = await Promise.all([
        fetchAllRecords("processos", "id, area"),
        fetchAllRecords("prazos", "id, status, processo_id"),
        fetchAllRecords("movimentacoes", "id, processo_id, data_movimentacao"),
      ]);

      // Prazos por status
      const prazosStatus = [
        { name: "Cumpridos", value: prazos.filter(p => p.status === "cumprido").length, color: "#22C55E" },
        { name: "Pendentes", value: prazos.filter(p => p.status === "pendente").length, color: "#EAB308" },
        { name: "Atrasados", value: prazos.filter(p => p.status === "atrasado").length, color: "#EF4444" },
      ];

      // Atividades concluídas vs não concluídas
      const atividadesConcluidas = prazos.filter(p => p.status === "cumprido").length;
      const atividadesNaoConcluidas = prazos.filter(p => p.status !== "cumprido").length;

      // Atividades por área
      const atividadesPorArea = [
        { 
          name: "Cível", 
          concluidas: prazos.filter(p => {
            const processo = processos.find(proc => proc.id === p.processo_id);
            return processo?.area === "civil" && p.status === "cumprido";
          }).length,
          pendentes: prazos.filter(p => {
            const processo = processos.find(proc => proc.id === p.processo_id);
            return processo?.area === "civil" && p.status !== "cumprido";
          }).length,
        },
        { 
          name: "Trabalhista", 
          concluidas: prazos.filter(p => {
            const processo = processos.find(proc => proc.id === p.processo_id);
            return processo?.area === "trabalhista" && p.status === "cumprido";
          }).length,
          pendentes: prazos.filter(p => {
            const processo = processos.find(proc => proc.id === p.processo_id);
            return processo?.area === "trabalhista" && p.status !== "cumprido";
          }).length,
        },
        { 
          name: "Empresarial", 
          concluidas: prazos.filter(p => {
            const processo = processos.find(proc => proc.id === p.processo_id);
            return processo?.area === "empresarial" && p.status === "cumprido";
          }).length,
          pendentes: prazos.filter(p => {
            const processo = processos.find(proc => proc.id === p.processo_id);
            return processo?.area === "empresarial" && p.status !== "cumprido";
          }).length,
        },
      ];

      // Evolução dos andamentos por ano
      const andamentosPorAno = new Map<number, number>();
      movimentacoes.forEach(m => {
        const ano = new Date(m.data_movimentacao).getFullYear();
        andamentosPorAno.set(ano, (andamentosPorAno.get(ano) || 0) + 1);
      });
      const evolucaoAndamentos = Array.from(andamentosPorAno.entries())
        .map(([ano, total]) => ({ ano: ano.toString(), total }))
        .sort((a, b) => parseInt(a.ano) - parseInt(b.ano));

      // Andamentos por área
      const andamentosPorArea = [
        { 
          name: "Cível", 
          value: movimentacoes.filter(m => {
            const processo = processos.find(p => p.id === m.processo_id);
            return processo?.area === "civil";
          }).length,
          color: "#3B82F6"
        },
        { 
          name: "Trabalhista", 
          value: movimentacoes.filter(m => {
            const processo = processos.find(p => p.id === m.processo_id);
            return processo?.area === "trabalhista";
          }).length,
          color: "#22C55E"
        },
        { 
          name: "Empresarial", 
          value: movimentacoes.filter(m => {
            const processo = processos.find(p => p.id === m.processo_id);
            return processo?.area === "empresarial";
          }).length,
          color: "#8B5CF6"
        },
      ];

      return {
        totalPrazos: prazos.length,
        prazosStatus,
        atividadesConcluidas,
        atividadesNaoConcluidas,
        atividadesPorArea,
        evolucaoAndamentos,
        andamentosPorArea,
      };
    },
  });
}
