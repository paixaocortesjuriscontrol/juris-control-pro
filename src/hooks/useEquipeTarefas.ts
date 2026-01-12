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

export function useEquipeTarefasStats(coordenacaoId: string | null, allCoordenacaoIds?: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["equipe-tarefas-stats", coordenacaoId, allCoordenacaoIds],
    queryFn: async () => {
      // Determine which coordination(s) to fetch
      const coordIds = coordenacaoId 
        ? [coordenacaoId] 
        : (allCoordenacaoIds || []);

      if (coordIds.length === 0) return [];

      // Get members of all target coordinations
      const { data: membros, error: membrosError } = await supabase
        .from("membros_coordenacao")
        .select(`
          usuario_id,
          cargo,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome, email)
        `)
        .in("coordenacao_id", coordIds);

      if (membrosError) throw membrosError;
      if (!membros || membros.length === 0) return [];

      // Deduplicate members (in case same user is in multiple coordinations)
      const uniqueMembros = membros.reduce((acc, membro) => {
        if (!acc.find(m => m.usuario_id === membro.usuario_id)) {
          acc.push(membro);
        }
        return acc;
      }, [] as typeof membros);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Get tasks for each member
      const statsPromises = uniqueMembros.map(async (membro) => {
        // Handle nested usuario object
        const usuario = Array.isArray(membro.usuario) ? membro.usuario[0] : membro.usuario;
        
        const { data: tarefas, error: tarefasError } = await supabase
          .from("tarefas")
          .select("id, status, prioridade, data_vencimento")
          .eq("responsavel_id", membro.usuario_id);

        if (tarefasError) throw tarefasError;

        const total = tarefas?.length || 0;
        const pendentes = tarefas?.filter(t => t.status === "pendente").length || 0;
        const cumpridas = tarefas?.filter(t => t.status === "cumprido").length || 0;
        const urgentes = tarefas?.filter(t => t.prioridade === "urgente" && t.status === "pendente").length || 0;
        
        const atrasadas = tarefas?.filter(t => {
          if (t.status !== "pendente" || !t.data_vencimento) return false;
          const dataVenc = new Date(t.data_vencimento);
          return dataVenc < hoje;
        }).length || 0;

        return {
          usuario_id: membro.usuario_id,
          nome: usuario?.nome || "Sem nome",
          email: usuario?.email || "",
          cargo: membro.cargo,
          total_tarefas: total,
          pendentes,
          atrasadas,
          cumpridas,
          urgentes,
        } as MembroTarefaStats;
      });

      const stats = await Promise.all(statsPromises);
      return stats.sort((a, b) => b.total_tarefas - a.total_tarefas);
    },
    enabled: !!user && (!!coordenacaoId || (allCoordenacaoIds && allCoordenacaoIds.length > 0)),
  });
}

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
        : (allCoordenacaoIds || []);

      if (coordIds.length === 0) return [];

      // Get member IDs for target coordinations
      const { data: membros, error: membrosError } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .in("coordenacao_id", coordIds);

      if (membrosError) throw membrosError;

      // Deduplicate member IDs
      const membroIds = [...new Set(membros?.map(m => m.usuario_id) || [])];
      
      if (membroIds.length === 0) return [];

      // Determine which IDs to query
      const targetIds = filters.membroId && filters.membroId !== "all" 
        ? [filters.membroId] 
        : membroIds;

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
        .in("responsavel_id", targetIds)
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
    },
    enabled: !!user && (!!coordenacaoId || (allCoordenacaoIds && allCoordenacaoIds.length > 0)),
  });
}

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
  });
}
