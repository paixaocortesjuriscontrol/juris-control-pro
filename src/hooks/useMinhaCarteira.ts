import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, parseISO, isAfter, differenceInDays } from "date-fns";

export type ProcessoDelegado = {
  id: string;
  numero: string;
  assunto: string | null;
  area: string;
  status: string;
  polo_ativo: string | null;
  polo_passivo: string | null;
  tribunal: string | null;
  vara: string | null;
  comarca: string | null;
  valor_causa: number | null;
  data_distribuicao: string | null;
  created_at: string;
  coordenacao: {
    id: string;
    nome: string;
    coordenador: {
      id: string;
      nome: string;
    } | null;
  } | null;
  cliente: {
    id: string;
    nome: string;
  } | null;
  prazos_count: number;
  prazos_pendentes: number;
};

export type TarefaDelegada = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_vencimento: string;
  status: "pendente" | "cumprido" | "atrasado";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  observacoes: string | null;
  created_at: string;
  processo: {
    id: string;
    numero: string;
    assunto: string | null;
  } | null;
  dias_restantes: number;
  is_atrasado: boolean;
};

export function useMinhaCarteira() {
  const { user } = useAuth();

  const processosQuery = useQuery({
    queryKey: ["minha-carteira-processos", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: processos, error } = await supabase
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
          created_at,
          coordenacao:coordenacoes!processos_coordenacao_id_fkey(
            id,
            nome,
            coordenador:profiles!coordenacoes_coordenador_id_fkey(id, nome)
          ),
          cliente:clientes!processos_cliente_id_fkey(id, nome)
        `)
        .eq("advogado_responsavel_id", user.id)
        .in("status", ["ativo", "pendente", "urgente"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get prazos count for each processo
      const processosWithPrazos = await Promise.all(
        (processos || []).map(async (processo) => {
          const { data: prazos, error: prazosError } = await supabase
            .from("prazos")
            .select("id, status")
            .eq("processo_id", processo.id);

          if (prazosError) {
            return {
              ...processo,
              prazos_count: 0,
              prazos_pendentes: 0,
            };
          }

          return {
            ...processo,
            prazos_count: prazos?.length || 0,
            prazos_pendentes: prazos?.filter(p => p.status === "pendente").length || 0,
          };
        })
      );

      return processosWithPrazos as ProcessoDelegado[];
    },
    enabled: !!user?.id,
  });

  const tarefasQuery = useQuery({
    queryKey: ["minha-carteira-tarefas", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: tarefas, error } = await supabase
        .from("prazos")
        .select(`
          id,
          titulo,
          descricao,
          data_vencimento,
          status,
          prioridade,
          observacoes,
          created_at,
          processo:processos!prazos_processo_id_fkey(id, numero, assunto)
        `)
        .eq("responsavel_id", user.id)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;

      const today = startOfDay(new Date());

      return (tarefas || []).map((tarefa) => {
        const dataVencimento = parseISO(tarefa.data_vencimento);
        const isAtrasado = isAfter(today, dataVencimento);
        const dias = differenceInDays(dataVencimento, today);

        return {
          ...tarefa,
          dias_restantes: dias,
          is_atrasado: isAtrasado,
        } as TarefaDelegada;
      });
    },
    enabled: !!user?.id,
  });

  const statsQuery = useQuery({
    queryKey: ["minha-carteira-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: processos, error: processosError } = await supabase
        .from("processos")
        .select("id, status")
        .eq("advogado_responsavel_id", user.id);

      if (processosError) throw processosError;

      const { data: tarefas, error: tarefasError } = await supabase
        .from("prazos")
        .select("id, status, prioridade, data_vencimento")
        .eq("responsavel_id", user.id);

      if (tarefasError) throw tarefasError;

      const today = startOfDay(new Date());
      
      const tarefasPendentes = tarefas?.filter(t => t.status === "pendente") || [];
      const tarefasAtrasadas = tarefasPendentes.filter(t => {
        const dataVencimento = parseISO(t.data_vencimento);
        return isAfter(today, dataVencimento);
      });
      const tarefasUrgentes = tarefasPendentes.filter(t => t.prioridade === "urgente");
      const tarefasProximas = tarefasPendentes.filter(t => {
        const dataVencimento = parseISO(t.data_vencimento);
        const dias = differenceInDays(dataVencimento, today);
        return dias >= 0 && dias <= 7;
      });

      return {
        totalProcessos: processos?.length || 0,
        processosAtivos: processos?.filter(p => p.status === "ativo").length || 0,
        processosUrgentes: processos?.filter(p => p.status === "urgente").length || 0,
        totalTarefas: tarefas?.length || 0,
        tarefasPendentes: tarefasPendentes.length,
        tarefasAtrasadas: tarefasAtrasadas.length,
        tarefasUrgentes: tarefasUrgentes.length,
        tarefasProximas: tarefasProximas.length,
        tarefasCumpridas: tarefas?.filter(t => t.status === "cumprido").length || 0,
      };
    },
    enabled: !!user?.id,
  });

  return {
    processos: processosQuery.data || [],
    tarefas: tarefasQuery.data || [],
    stats: statsQuery.data,
    isLoading: processosQuery.isLoading || tarefasQuery.isLoading || statsQuery.isLoading,
    refetch: () => {
      processosQuery.refetch();
      tarefasQuery.refetch();
      statsQuery.refetch();
    },
  };
}
