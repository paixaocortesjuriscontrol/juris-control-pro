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

export function useEquipeTarefasStats(coordenacaoId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["equipe-tarefas-stats", coordenacaoId],
    queryFn: async () => {
      if (!coordenacaoId) return [];

      // Get members of the coordination
      const { data: membros, error: membrosError } = await supabase
        .from("membros_coordenacao")
        .select(`
          usuario_id,
          cargo,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome, email)
        `)
        .eq("coordenacao_id", coordenacaoId);

      if (membrosError) throw membrosError;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Get tasks for each member
      const statsPromises = (membros || []).map(async (membro) => {
        const { data: tarefas, error: tarefasError } = await supabase
          .from("prazos")
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
          nome: membro.usuario?.nome || "Sem nome",
          email: membro.usuario?.email || "",
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
    enabled: !!coordenacaoId && !!user,
  });
}

export function useEquipeTarefas(
  coordenacaoId: string | null,
  filters: {
    membroId?: string;
    status?: string;
    prioridade?: string;
    search?: string;
  }
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["equipe-tarefas", coordenacaoId, filters],
    queryFn: async () => {
      if (!coordenacaoId) return [];

      // Get member IDs for this coordination
      const { data: membros, error: membrosError } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .eq("coordenacao_id", coordenacaoId);

      if (membrosError) throw membrosError;

      const membroIds = membros?.map(m => m.usuario_id) || [];
      
      if (membroIds.length === 0) return [];

      let query = supabase
        .from("prazos")
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
          responsavel:profiles!prazos_responsavel_id_fkey(id, nome),
          processo:processos!prazos_processo_id_fkey(numero)
        `)
        .in("responsavel_id", filters.membroId ? [filters.membroId] : membroIds)
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

      return (data || []) as TarefaEquipe[];
    },
    enabled: !!coordenacaoId && !!user,
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

      return memberships?.map(m => m.coordenacao).filter(Boolean) || [];
    },
    enabled: !!user,
  });
}
