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
 * Hook otimizado para buscar estatísticas de tarefas por membro
 * Usa RPC no banco para evitar N+1 queries
 */
export function useEquipeTarefasStats(coordenacaoId: string | null, allCoordenacaoIds?: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["equipe-tarefas-stats", coordenacaoId, allCoordenacaoIds],
    queryFn: async () => {
      // Determine which coordination(s) to fetch
      const coordIds = coordenacaoId 
        ? [coordenacaoId] 
        : (allCoordenacaoIds && allCoordenacaoIds.length > 0 ? allCoordenacaoIds : []);

      if (coordIds.length === 0) return [] as MembroTarefaStats[];

      // Usar RPC otimizada que faz tudo em uma única query
      const { data, error } = await supabase
        .rpc('get_equipe_tarefas_stats', { p_coordenacao_ids: coordIds });

      if (error) throw error;

      // Mapear para interface esperada
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
    enabled: !!user && (!!coordenacaoId || (allCoordenacaoIds && allCoordenacaoIds.length > 0)),
    staleTime: 30000, // Cache por 30s
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
  allCoordenacaoIds?: string[]
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["equipe-tarefas", coordenacaoId, filters, allCoordenacaoIds],
    queryFn: async () => {
      // Determine which coordination(s) to fetch
      const coordIds = coordenacaoId 
        ? [coordenacaoId] 
        : (allCoordenacaoIds && allCoordenacaoIds.length > 0 ? allCoordenacaoIds : []);

      if (coordIds.length === 0) return [] as TarefaEquipe[];

      // Se já temos membro específico, buscar direto
      if (filters.membroId && filters.membroId !== "all") {
        return await fetchTarefasForMembers([filters.membroId], filters);
      }

      // Buscar IDs dos membros das coordenações
      const { data: membros, error: membrosError } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .in("coordenacao_id", coordIds);

      if (membrosError) throw membrosError;

      // Deduplicate member IDs
      const membroIds = [...new Set(membros?.map(m => m.usuario_id) || [])];
      
      if (membroIds.length === 0) return [];

      return await fetchTarefasForMembers(membroIds, filters);
    },
    enabled: !!user && (!!coordenacaoId || (allCoordenacaoIds && allCoordenacaoIds.length > 0)),
    staleTime: 30000, // Cache por 30s
  });
}

/**
 * Função auxiliar para buscar tarefas de membros específicos
 */
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

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as "pendente" | "cumprido" | "atrasado");
  }

  if (filters.prioridade && filters.prioridade !== "all") {
    query = query.eq("prioridade", filters.prioridade as "baixa" | "media" | "alta" | "urgente");
  }

  if (filters.search) {
    query = query.ilike("titulo", `%${filters.search}%`);
  }

  const { data, error } = await query.limit(200);

  if (error) throw error;

  // Normalize nested objects
  const normalized = (data || []).map(item => ({
    ...item,
    responsavel: Array.isArray(item.responsavel) ? item.responsavel[0] : item.responsavel,
    processo: Array.isArray(item.processo) ? item.processo[0] : item.processo,
  }));

  return normalized as unknown as TarefaEquipe[];
}

/**
 * Hook para buscar coordenações do usuário
 */
export function useMinhasCoordenacoes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["minhas-coordenacoes", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Check if admin or coordinator
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdminOrCoord = roles?.some(r => r.role === "admin" || r.role === "coordenador");

      if (isAdminOrCoord) {
        // Return all coordinations for admins/coordinators
        const { data, error } = await supabase
          .from("coordenacoes")
          .select("id, nome, area")
          .order("nome");

        if (error) throw error;
        return data || [];
      }

      // For regular users, return coordinations they belong to
      const { data: memberships, error: memberError } = await supabase
        .from("membros_coordenacao")
        .select(`
          coordenacao:coordenacoes!membros_coordenacao_coordenacao_id_fkey(id, nome, area)
        `)
        .eq("usuario_id", user.id);

      if (memberError) throw memberError;

      // Flatten the nested coordenacao objects properly
      const coordenacoes = memberships?.map(m => {
        const coord = m.coordenacao;
        if (Array.isArray(coord)) {
          return coord[0];
        }
        return coord;
      }).filter(Boolean) || [];

      return coordenacoes as { id: string; nome: string; area: string }[];
    },
    enabled: !!user,
    staleTime: 60000, // Cache por 1 minuto
  });
}
