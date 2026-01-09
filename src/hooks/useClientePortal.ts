import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProcessoCliente {
  id: string;
  numero: string;
  assunto: string | null;
  area: string | null;
  status: string;
  polo_ativo: string | null;
  polo_passivo: string | null;
  tribunal: string | null;
  vara: string | null;
  comarca: string | null;
  data_distribuicao: string | null;
  created_at: string;
  advogado_responsavel: {
    nome: string;
  } | null;
}

export interface MovimentacaoCliente {
  id: string;
  data_movimentacao: string;
  descricao: string;
  tipo: string | null;
  processo_id: string;
}

export function useClienteProcessos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cliente-processos", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get client IDs linked to this user
      const { data: links, error: linksError } = await supabase
        .from("clientes_usuarios")
        .select("cliente_id")
        .eq("user_id", user.id)
        .eq("ativo", true);

      if (linksError) throw linksError;

      const clienteIds = links?.map(l => l.cliente_id) || [];
      if (clienteIds.length === 0) return [];

      // Get processes for these clients
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
          data_distribuicao,
          created_at,
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(nome)
        `)
        .in("cliente_id", clienteIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Normalize nested objects
      return (data || []).map(p => ({
        ...p,
        advogado_responsavel: Array.isArray(p.advogado_responsavel) 
          ? p.advogado_responsavel[0] 
          : p.advogado_responsavel,
      })) as ProcessoCliente[];
    },
    enabled: !!user,
  });
}

export function useClienteMovimentacoes(processoId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cliente-movimentacoes", user?.id, processoId],
    queryFn: async () => {
      if (!user || !processoId) return [];

      // Verify user has access to this process
      const { data: links } = await supabase
        .from("clientes_usuarios")
        .select("cliente_id")
        .eq("user_id", user.id)
        .eq("ativo", true);

      const clienteIds = links?.map(l => l.cliente_id) || [];
      if (clienteIds.length === 0) return [];

      // Check if process belongs to one of the user's clients
      const { data: processo } = await supabase
        .from("processos")
        .select("id, cliente_id")
        .eq("id", processoId)
        .single();

      if (!processo || !clienteIds.includes(processo.cliente_id || "")) {
        return [];
      }

      // Get movements
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, data_movimentacao, descricao, tipo, processo_id")
        .eq("processo_id", processoId)
        .order("data_movimentacao", { ascending: false })
        .limit(100);

      if (error) throw error;

      return data as MovimentacaoCliente[];
    },
    enabled: !!user && !!processoId,
  });
}

export function useClienteStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cliente-stats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get client IDs linked to this user
      const { data: links } = await supabase
        .from("clientes_usuarios")
        .select("cliente_id")
        .eq("user_id", user.id)
        .eq("ativo", true);

      const clienteIds = links?.map(l => l.cliente_id) || [];
      if (clienteIds.length === 0) {
        return { totalProcessos: 0, ativos: 0, encerrados: 0, totalMovimentacoes: 0 };
      }

      // Get process stats
      const { data: processos, error: processosError } = await supabase
        .from("processos")
        .select("id, status")
        .in("cliente_id", clienteIds);

      if (processosError) throw processosError;

      const processosIds = processos?.map(p => p.id) || [];
      
      // Get movement count
      let totalMovimentacoes = 0;
      if (processosIds.length > 0) {
        const { count } = await supabase
          .from("movimentacoes")
          .select("id", { count: "exact", head: true })
          .in("processo_id", processosIds);
        totalMovimentacoes = count || 0;
      }

      return {
        totalProcessos: processos?.length || 0,
        ativos: processos?.filter(p => ["ativo", "urgente", "pendente"].includes(p.status)).length || 0,
        encerrados: processos?.filter(p => ["encerrado", "arquivado"].includes(p.status)).length || 0,
        totalMovimentacoes,
      };
    },
    enabled: !!user,
  });
}

export function useClienteInfo() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cliente-info", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get linked clients
      const { data: links, error: linksError } = await supabase
        .from("clientes_usuarios")
        .select(`
          cliente:clientes(id, nome, cpf_cnpj, email, telefone, tipo)
        `)
        .eq("user_id", user.id)
        .eq("ativo", true);

      if (linksError) throw linksError;

      // Return first client (most common case)
      const clienteData = links?.[0]?.cliente;
      return Array.isArray(clienteData) ? clienteData[0] : clienteData;
    },
    enabled: !!user,
  });
}
