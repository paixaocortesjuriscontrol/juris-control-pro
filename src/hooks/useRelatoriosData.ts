import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRelatoriosData() {
  return useQuery({
    queryKey: ["relatorios-data"],
    queryFn: async () => {
      const [processosResult, prazosResult, profilesResult] = await Promise.all([
        supabase.from("processos").select("id, area, status, created_at, advogado_responsavel_id"),
        supabase.from("prazos").select("id, status"),
        supabase.from("profiles").select("id, nome"),
      ]);

      const processos = processosResult.data || [];
      const prazos = prazosResult.data || [];
      const profiles = profilesResult.data || [];

      // Processos por área
      const processosPerArea = [
        { name: "Cível", value: processos.filter(p => p.area === "civil").length, color: "#3B82F6" },
        { name: "Trabalhista", value: processos.filter(p => p.area === "trabalhista").length, color: "#22C55E" },
        { name: "Empresarial", value: processos.filter(p => p.area === "empresarial").length, color: "#8B5CF6" },
      ];

      // Prazos por status
      const prazosStatus = [
        { name: "Cumpridos", value: prazos.filter(p => p.status === "cumprido").length, color: "#22C55E" },
        { name: "Pendentes", value: prazos.filter(p => p.status === "pendente").length, color: "#EAB308" },
        { name: "Atrasados", value: prazos.filter(p => p.status === "atrasado").length, color: "#EF4444" },
      ];

      // Produtividade por advogado
      const produtividadeAdvogados = profiles.map(profile => {
        const processosCount = processos.filter(p => p.advogado_responsavel_id === profile.id).length;
        return {
          nome: profile.nome,
          processos: processosCount,
          audiencias: 0, // Would need separate table
          peticoes: 0, // Would need separate table
        };
      }).filter(p => p.processos > 0).sort((a, b) => b.processos - a.processos).slice(0, 5);

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
          const created = new Date(p.created_at);
          return created.getMonth() === mesIndex && created.getFullYear() === ano && 
                 (p.status === "encerrado" || p.status === "arquivado");
        }).length;

        processosMensais.push({
          mes: meses[mesIndex],
          novos,
          encerrados,
        });
      }

      return {
        processosPerArea,
        prazosStatus,
        produtividadeAdvogados,
        processosMensais,
      };
    },
  });
}
