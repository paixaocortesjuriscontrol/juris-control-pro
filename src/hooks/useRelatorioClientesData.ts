import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function fetchAllRecords(
  table: "processos" | "prazos" | "profiles" | "clientes",
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

export function useRelatorioClientesData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-clientes-data"],
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled,
    queryFn: async () => {
      const [processos, prazos, profiles, clientes] = await Promise.all([
        fetchAllRecords("processos", "id, status, advogado_responsavel_id, cliente_id, vara, data_distribuicao, data_encerramento, created_at"),
        fetchAllRecords("prazos", "id, status, titulo, processo_id"),
        fetchAllRecords("profiles", "id, nome"),
        fetchAllRecords("clientes", "id, nome, tipo"),
      ]);

      // Produtividade por advogado
      const produtividadeAdvogados = profiles.map(profile => {
        const processosCount = processos.filter(p => p.advogado_responsavel_id === profile.id).length;
        return { nome: profile.nome, processos: processosCount };
      }).filter(p => p.processos > 0).sort((a, b) => b.processos - a.processos).slice(0, 5);

      // Processos por cliente
      const processosPorCliente = clientes.map(cliente => {
        const processosCliente = processos.filter(p => p.cliente_id === cliente.id);
        const ativos = processosCliente.filter(p => p.status === "ativo").length;
        const encerrados = processosCliente.filter(p => p.status === "encerrado" || p.status === "arquivado").length;
        const prazosCliente = prazos.filter(p => processosCliente.find(proc => proc.id === p.processo_id));
        const prazosPendentes = prazosCliente.filter(p => p.status !== "cumprido").length;
        
        return { 
          nome: cliente.nome, 
          tipo: cliente.tipo,
          total: processosCliente.length,
          ativos,
          encerrados,
          prazosPendentes
        };
      }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

      // Processos por vara
      const varasMap = new Map<string, number>();
      processos.forEach(p => {
        const vara = p.vara || "Não informada";
        varasMap.set(vara, (varasMap.get(vara) || 0) + 1);
      });
      const processosPorVara = Array.from(varasMap.entries())
        .map(([vara, total]) => ({ vara, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Duração por cliente
      const duracaoClientes = clientes.map(cliente => {
        const processosCliente = processos.filter(p => p.cliente_id === cliente.id);
        if (processosCliente.length === 0) return null;
        
        const duracoes = processosCliente.map(p => {
          const inicio = p.data_distribuicao ? new Date(p.data_distribuicao) : new Date(p.created_at);
          const fim = p.data_encerramento ? new Date(p.data_encerramento) : new Date();
          return Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        });
        
        const mediaDias = duracoes.reduce((a, b) => a + b, 0) / duracoes.length;
        return { nome: cliente.nome, mediaDias: Math.round(mediaDias), processos: processosCliente.length };
      }).filter(Boolean).sort((a, b) => (b?.processos || 0) - (a?.processos || 0)).slice(0, 10) as { nome: string; mediaDias: number; processos: number }[];

      // Atividades por tarefa
      const tarefasMap = new Map<string, { total: number; concluidas: number; atrasadas: number }>();
      prazos.forEach(p => {
        const titulo = p.titulo || "Sem título";
        const current = tarefasMap.get(titulo) || { total: 0, concluidas: 0, atrasadas: 0 };
        current.total++;
        if (p.status === "cumprido") current.concluidas++;
        if (p.status === "atrasado") current.atrasadas++;
        tarefasMap.set(titulo, current);
      });
      const atividadesPorTarefa = Array.from(tarefasMap.entries())
        .map(([titulo, dados]) => ({ titulo, ...dados }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      return {
        processosPorCliente,
        processosPorVara,
        duracaoClientes,
        atividadesPorTarefa,
        produtividadeAdvogados,
      };
    },
  });
}
