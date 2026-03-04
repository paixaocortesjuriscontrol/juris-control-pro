import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MembroTarefaStats {
  usuario_id: string;
  nome: string;
  email: string;
  cargo: string | null;
  total_tarefas: number;
  pendentes: number;
  atrasadas: number;
  cumpridas: number;
  urgentes: number;
}

export interface TarefaEquipe {
  id: string;
  titulo: string;
  descricao: string | null;
  data_vencimento: string | null;
  data_cumprimento: string | null;
  status: string;
  prioridade: string;
  responsavel_id: string | null;
  processo_id: string | null;
  created_at: string;
  responsavel: {
    id: string;
    nome: string;
  } | null;
  processo: {
    numero: string;
  } | null;
}

/**
 * Hook para buscar coordenações do usuário logado.
 * Admins veem todas; usuários comuns veem apenas as suas.
 */
export function useMinhasCoordenacoes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["minhas-coordenacoes-equipe", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Verificar se é admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdmin = roles?.some(r => r.role === "admin");

      if (isAdmin) {
        const { data, error } = await supabase
          .from("coordenacoes")
          .select("id, nome, area")
          .order("nome");
        if (error) throw error;
        return data || [];
      }

      // Usuário comum: buscar coordenações que é membro
      const { data: membros, error: memberError } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id);

      if (memberError) throw memberError;

      const coordIds = (membros || []).map(m => m.coordenacao_id);
      if (coordIds.length === 0) return [];

      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .in("id", coordIds)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60000,
  });
}

/**
 * Hook otimizado para buscar estatísticas de tarefas por membro
 */
export function useEquipeTarefasStats(
  coordenacaoId: string | null,
  allCoordenacaoIds?: string[],
  coordLoading?: boolean
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["equipe-tarefas-stats", coordenacaoId, allCoordenacaoIds],
    queryFn: async () => {
      let coordIds: string[] = [];

      if (coordenacaoId) {
        coordIds = [coordenacaoId];
      } else if (allCoordenacaoIds !== undefined) {
        coordIds = allCoordenacaoIds;
      } else {
        // Admin global fallback: fetch all coordinations
        const { data: todasCoords } = await supabase
          .from("coordenacoes")
          .select("id");
        coordIds = todasCoords?.map(c => c.id) || [];
      }

      if (coordIds.length === 0) return [] as MembroTarefaStats[];

      const { data, error } = await supabase
        .rpc('get_equipe_tarefas_stats', { p_coordenacao_ids: coordIds });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        usuario_id: row.usuario_id,
        nome: row.nome || "Sem nome",
        email: row.email || "",
        cargo: row.cargo,
        total_tarefas: Number(row.total_tarefas) || 0,
        pendentes: Number(row.pendentes) || 0,
        atrasadas: Number(row.atrasadas) || 0,
        cumpridas: Number(row.cumpridas) || 0,
        urgentes: Number(row.urgentes) || 0,
      })) as MembroTarefaStats[];
    },
    // Só executa quando não está carregando coordenações E os IDs estão prontos
    enabled: !!user && !coordLoading && (
      coordenacaoId !== null ||
      allCoordenacaoIds === undefined || // admin sem seleção específica
      (allCoordenacaoIds !== undefined && allCoordenacaoIds.length > 0)
    ),
    staleTime: 30000,
  });
}

/**
 * Hook para buscar tarefas da equipe com filtros
 */
export function useEquipeTarefas(
  coordenacaoId: string | null,
  filters: {
    membroId?: string;
    status?: string;
    prioridade?: string;
    search?: string;
  },
  allCoordenacaoIds?: string[],
  coordLoading?: boolean
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["equipe-tarefas", coordenacaoId, filters, allCoordenacaoIds],
    queryFn: async () => {
      let coordIds: string[] = [];

      if (coordenacaoId) {
        coordIds = [coordenacaoId];
      } else if (allCoordenacaoIds !== undefined) {
        coordIds = allCoordenacaoIds;
      } else {
        // Admin global fallback
        const { data: todasCoords } = await supabase
          .from("coordenacoes")
          .select("id");
        coordIds = todasCoords?.map(c => c.id) || [];
      }

      if (coordIds.length === 0) return [] as TarefaEquipe[];

      if (filters.membroId && filters.membroId !== "all") {
        return await fetchTarefasForMembers([filters.membroId], filters);
      }

      const { data: membros, error: membrosError } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .in("coordenacao_id", coordIds);

      if (membrosError) throw membrosError;

      const membroIds = [...new Set(membros?.map(m => m.usuario_id) || [])];
      if (membroIds.length === 0) return [];

      return await fetchTarefasForMembers(membroIds, filters);
    },
    enabled: !!user && !coordLoading && (
      coordenacaoId !== null ||
      allCoordenacaoIds === undefined ||
      (allCoordenacaoIds !== undefined && allCoordenacaoIds.length > 0)
    ),
    staleTime: 30000,
  });
}

async function fetchTarefasForMembers(
  memberIds: string[],
  filters: { status?: string; prioridade?: string; search?: string }
): Promise<TarefaEquipe[]> {
  let query = supabase
    .from("tarefas")
    .select(`
      id,
      titulo,
      descricao,
      data_vencimento,
      data_cumprimento,
      status,
      prioridade,
      responsavel_id,
      processo_id,
      created_at,
      responsavel:profiles!tarefas_responsavel_id_fkey(id, nome),
      processo:processos!tarefas_processo_id_fkey(numero)
    `)
    .in("responsavel_id", memberIds)
    .order("data_vencimento", { ascending: true, nullsFirst: false });

  const today = new Date().toISOString().split("T")[0];

  if (filters.status && filters.status !== "all") {
    if (filters.status === "atrasado") {
      query = query.neq("status", "cumprido").lt("data_vencimento", today);
    } else {
      query = query.eq("status", filters.status as "pendente" | "cumprido" | "atrasado");
    }
  }

  if (filters.prioridade && filters.prioridade !== "all") {
    query = query.eq("prioridade", filters.prioridade as "baixa" | "media" | "alta" | "urgente");
  }

  if (filters.search) {
    query = query.ilike("titulo", `%${filters.search}%`);
  }

  const { data, error } = await query.limit(200);
  if (error) throw error;

  const normalized = (data || []).map(item => ({
    ...item,
    responsavel: Array.isArray(item.responsavel) ? item.responsavel[0] : item.responsavel,
    processo: Array.isArray(item.processo) ? item.processo[0] : item.processo,
  }));

  return normalized as unknown as TarefaEquipe[];
}
