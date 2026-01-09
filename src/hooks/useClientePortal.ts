import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
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
    id: string;
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

export interface ClientePortalStats {
  totalProcessos: number;
  ativos: number;
  encerrados: number;
  totalMovimentacoes: number;
  processosPorStatus: { name: string; value: number; color: string }[];
  processosPorArea: { name: string; value: number; color: string }[];
  movimentacoesPorMes: { mes: string; total: number }[];
  audienciasProximas: number;
  intimacoesPendentes: number;
}

// Use the new database function for stats (no 1000 limit)
export function useClienteStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cliente-portal-stats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.rpc("get_cliente_portal_stats", {
        _user_id: user.id,
      });

      if (error) {
        console.error("Error fetching client stats:", error);
        throw error;
      }

      return data as unknown as ClientePortalStats;
    },
    enabled: !!user,
    staleTime: 30000,
  });
}

// Use the new paginated function for processes
export function useClienteProcessosPaginados(
  filters: {
    status?: string;
    area?: string;
    search?: string;
  } = {}
) {
  const { user } = useAuth();
  const pageSize = 50;

  return useInfiniteQuery({
    queryKey: ["cliente-processos-paginados", user?.id, filters],
    queryFn: async ({ pageParam = 1 }) => {
      if (!user) return { processos: [], totalCount: 0, hasMore: false };

      const { data, error } = await supabase.rpc("get_cliente_processos_paginados", {
        _user_id: user.id,
        _page: pageParam,
        _page_size: pageSize,
        _status: filters.status || null,
        _area: filters.area || null,
        _search: filters.search || null,
      });

      if (error) {
        console.error("Error fetching client processes:", error);
        throw error;
      }

      const processos = (data || []).map((p: any) => ({
        ...p,
        advogado_responsavel: p.advogado_responsavel?.id ? p.advogado_responsavel : null,
      })) as ProcessoCliente[];

      const totalCount = data?.[0]?.total_count || 0;
      const hasMore = pageParam * pageSize < totalCount;

      return { processos, totalCount, hasMore };
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!user,
  });
}

// Legacy function for backward compatibility - now uses paginated version internally
export function useClienteProcessos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cliente-processos", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc("get_cliente_processos_paginados", {
        _user_id: user.id,
        _page: 1,
        _page_size: 100,
        _status: null,
        _area: null,
        _search: null,
      });

      if (error) {
        console.error("Error fetching client processes:", error);
        throw error;
      }

      return (data || []).map((p: any) => ({
        ...p,
        advogado_responsavel: p.advogado_responsavel?.id ? p.advogado_responsavel : null,
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

      // Get movements directly - RLS will handle access control
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, data_movimentacao, descricao, tipo, processo_id")
        .eq("processo_id", processoId)
        .order("data_movimentacao", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching movements:", error);
        throw error;
      }

      return data as MovimentacaoCliente[];
    },
    enabled: !!user && !!processoId,
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
