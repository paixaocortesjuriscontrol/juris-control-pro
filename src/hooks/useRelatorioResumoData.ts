import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function fetchAllRecords(
  table: "processos" | "clientes" | "movimentacoes",
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

export function useRelatorioResumoData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-resumo-data"],
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled,
    queryFn: async () => {
      const [processos, clientes, movimentacoes] = await Promise.all([
        fetchAllRecords("processos", "id, area, status, created_at, cliente_id, polo_ativo, polo_passivo, data_encerramento"),
        fetchAllRecords("clientes", "id, tipo"),
        fetchAllRecords("movimentacoes", "id"),
      ]);

      const anoAtual = new Date().getFullYear();

      // 1. Processos por área
      const processosPerArea = [
        { name: "Cível", value: processos.filter(p => p.area === "civil").length, color: "#3B82F6" },
        { name: "Trabalhista", value: processos.filter(p => p.area === "trabalhista").length, color: "#22C55E" },
        { name: "Empresarial", value: processos.filter(p => p.area === "empresarial").length, color: "#8B5CF6" },
      ];

      // Processos por tipo de pessoa
      const processosPorTipoPessoa = [
        { 
          name: "Pessoa Física", 
          value: processos.filter(p => {
            const cliente = clientes.find(c => c.id === p.cliente_id);
            return cliente?.tipo === "pessoa_fisica";
          }).length,
          color: "#3B82F6"
        },
        { 
          name: "Pessoa Jurídica", 
          value: processos.filter(p => {
            const cliente = clientes.find(c => c.id === p.cliente_id);
            return cliente?.tipo === "pessoa_juridica";
          }).length,
          color: "#8B5CF6"
        },
        {
          name: "Sem Cliente",
          value: processos.filter(p => !p.cliente_id).length,
          color: "#94A3B8"
        }
      ];

      // Processos ativos no ano atual
      const processosAtivosAnoAtual = processos.filter(p => {
        const created = new Date(p.created_at);
        return created.getFullYear() === anoAtual && p.status === "ativo";
      }).length;

      // Média de envolvidos por processo
      const countEnvolvidos = (polo: string | null) => {
        if (!polo) return 0;
        return polo.split(/[,;]/).filter(p => p.trim()).length;
      };
      const totalEnvolvidos = processos.reduce((acc, p) => {
        return acc + countEnvolvidos(p.polo_ativo) + countEnvolvidos(p.polo_passivo);
      }, 0);
      const mediaEnvolvidos = processos.length > 0 ? (totalEnvolvidos / processos.length).toFixed(1) : "0";

      // Processos por mês (últimos 6 meses)
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const hoje = new Date();
      const processosMensais = [];
      
      for (let i = 5; i >= 0; i--) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const mesIndex = data.getMonth();
        const ano = data.getFullYear();
        
        const novos = processos.filter(p => {
          const created = new Date(p.created_at);
          return created.getMonth() === mesIndex && created.getFullYear() === ano;
        }).length;

        const encerrados = processos.filter(p => {
          if (!p.data_encerramento) return false;
          const encerramento = new Date(p.data_encerramento);
          return encerramento.getMonth() === mesIndex && encerramento.getFullYear() === ano;
        }).length;

        processosMensais.push({ mes: meses[mesIndex], novos, encerrados });
      }

      return {
        totalProcessos: processos.length,
        processosAtivosAnoAtual,
        mediaEnvolvidos,
        totalMovimentacoes: movimentacoes.length,
        processosPerArea,
        processosPorTipoPessoa,
        processosMensais,
      };
    },
  });
}
