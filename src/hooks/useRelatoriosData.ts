import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRelatoriosData() {
  return useQuery({
    queryKey: ["relatorios-data"],
    queryFn: async () => {
      const [processosResult, prazosResult, profilesResult, clientesResult, movimentacoesResult] = await Promise.all([
        supabase.from("processos").select("id, area, status, created_at, advogado_responsavel_id, cliente_id, vara, polo_ativo, polo_passivo, data_distribuicao, data_encerramento"),
        supabase.from("prazos").select("id, status, titulo, processo_id, data_vencimento, data_cumprimento"),
        supabase.from("profiles").select("id, nome"),
        supabase.from("clientes").select("id, nome, tipo"),
        supabase.from("movimentacoes").select("id, processo_id, data_movimentacao, tipo"),
      ]);

      const processos = processosResult.data || [];
      const prazos = prazosResult.data || [];
      const profiles = profilesResult.data || [];
      const clientes = clientesResult.data || [];
      const movimentacoes = movimentacoesResult.data || [];

      const anoAtual = new Date().getFullYear();

      // 1. Processos por área
      const processosPerArea = [
        { name: "Cível", value: processos.filter(p => p.area === "civil").length, color: "#3B82F6" },
        { name: "Trabalhista", value: processos.filter(p => p.area === "trabalhista").length, color: "#22C55E" },
        { name: "Empresarial", value: processos.filter(p => p.area === "empresarial").length, color: "#8B5CF6" },
      ];

      // 2. Prazos por status (atividades)
      const prazosStatus = [
        { name: "Cumpridos", value: prazos.filter(p => p.status === "cumprido").length, color: "#22C55E" },
        { name: "Pendentes", value: prazos.filter(p => p.status === "pendente").length, color: "#EAB308" },
        { name: "Atrasados", value: prazos.filter(p => p.status === "atrasado").length, color: "#EF4444" },
      ];

      // 3. Produtividade por advogado
      const produtividadeAdvogados = profiles.map(profile => {
        const processosCount = processos.filter(p => p.advogado_responsavel_id === profile.id).length;
        return {
          nome: profile.nome,
          processos: processosCount,
        };
      }).filter(p => p.processos > 0).sort((a, b) => b.processos - a.processos).slice(0, 5);

      // 4. Processos por mês (últimos 6 meses)
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

        processosMensais.push({
          mes: meses[mesIndex],
          novos,
          encerrados,
        });
      }

      // 5. Total de processos por cliente com estatísticas detalhadas
      const processosPorCliente = clientes.map(cliente => {
        const processosCliente = processos.filter(p => p.cliente_id === cliente.id);
        const ativos = processosCliente.filter(p => p.status === "ativo").length;
        const encerrados = processosCliente.filter(p => p.status === "encerrado" || p.status === "arquivado").length;
        const prazosCliente = prazos.filter(p => {
          const processo = processosCliente.find(proc => proc.id === p.processo_id);
          return !!processo;
        });
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

      // 6. Total de processos por tipo de pessoa (física vs jurídica)
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

      // 7. Processos ativos no ano atual
      const processosAtivosAnoAtual = processos.filter(p => {
        const created = new Date(p.created_at);
        return created.getFullYear() === anoAtual && p.status === "ativo";
      }).length;

      // 8. Média de envolvidos por processo (polo_ativo + polo_passivo)
      const countEnvolvidos = (polo: string | null) => {
        if (!polo) return 0;
        return polo.split(/[,;]/).filter(p => p.trim()).length;
      };
      const totalEnvolvidos = processos.reduce((acc, p) => {
        return acc + countEnvolvidos(p.polo_ativo) + countEnvolvidos(p.polo_passivo);
      }, 0);
      const mediaEnvolvidos = processos.length > 0 ? (totalEnvolvidos / processos.length).toFixed(1) : "0";

      // 9. Processos por vara
      const varasMap = new Map<string, number>();
      processos.forEach(p => {
        const vara = p.vara || "Não informada";
        varasMap.set(vara, (varasMap.get(vara) || 0) + 1);
      });
      const processosPorVara = Array.from(varasMap.entries())
        .map(([vara, total]) => ({ vara, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // 10. Duração dos processos por cliente principal
      const duracaoClientes = clientes.map(cliente => {
        const processosCliente = processos.filter(p => p.cliente_id === cliente.id);
        if (processosCliente.length === 0) return null;
        
        const duracoes = processosCliente.map(p => {
          const inicio = p.data_distribuicao ? new Date(p.data_distribuicao) : new Date(p.created_at);
          const fim = p.data_encerramento ? new Date(p.data_encerramento) : new Date();
          return Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        });
        
        const mediaDias = duracoes.reduce((a, b) => a + b, 0) / duracoes.length;
        return { 
          nome: cliente.nome, 
          mediaDias: Math.round(mediaDias),
          processos: processosCliente.length
        };
      }).filter(Boolean).sort((a, b) => (b?.processos || 0) - (a?.processos || 0)).slice(0, 10) as { nome: string; mediaDias: number; processos: number }[];

      // 11. Atividades concluídas vs não concluídas
      const atividadesConcluidas = prazos.filter(p => p.status === "cumprido").length;
      const atividadesNaoConcluidas = prazos.filter(p => p.status !== "cumprido").length;

      // 12. Atividades por área (através do processo)
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

      // 13. Quantidade de atividades por tipo de tarefa (título)
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

      // 14. Evolução dos andamentos por ano
      const andamentosPorAno = new Map<number, number>();
      movimentacoes.forEach(m => {
        const ano = new Date(m.data_movimentacao).getFullYear();
        andamentosPorAno.set(ano, (andamentosPorAno.get(ano) || 0) + 1);
      });
      const evolucaoAndamentos = Array.from(andamentosPorAno.entries())
        .map(([ano, total]) => ({ ano: ano.toString(), total }))
        .sort((a, b) => parseInt(a.ano) - parseInt(b.ano));

      // 15. Quantidade de andamentos por área
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

      // Totais gerais
      const totalProcessos = processos.length;
      const totalPrazos = prazos.length;
      const totalMovimentacoes = movimentacoes.length;

      return {
        processosPerArea,
        prazosStatus,
        produtividadeAdvogados,
        processosMensais,
        processosPorCliente,
        processosPorTipoPessoa,
        processosAtivosAnoAtual,
        mediaEnvolvidos,
        processosPorVara,
        duracaoClientes,
        atividadesConcluidas,
        atividadesNaoConcluidas,
        atividadesPorArea,
        atividadesPorTarefa,
        evolucaoAndamentos,
        andamentosPorArea,
        totalProcessos,
        totalPrazos,
        totalMovimentacoes,
      };
    },
  });
}
