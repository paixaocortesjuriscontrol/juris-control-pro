import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface Notificacao {
  id: string;
  usuario_id: string;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'warning' | 'success' | 'djen';
  lida: boolean;
  link: string | null;
  dados: any;
  created_at: string;
}

export interface PrazoPendente {
  id: string;
  titulo: string;
  data_vencimento: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  processo: {
    id: string;
    numero: string;
    coordenacao_id: string | null;
  } | null;
  dias_restantes: number;
  is_atrasado: boolean;
}

export function useNotificacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notificacoes = [], isLoading, refetch } = useQuery({
    queryKey: ['notificacoes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notificacao[];
    },
    enabled: !!user?.id,
  });

  // Query for pending tarefas where user is responsible
  const { data: prazosPendentes = [], isLoading: isLoadingPrazos } = useQuery({
    queryKey: ['tarefas-pendentes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('tarefas')
        .select(`
          id,
          titulo,
          data_vencimento,
          prioridade,
          processo:processos!tarefas_processo_id_fkey(id, numero, coordenacao_id)
        `)
        .eq('responsavel_id', user.id)
        .eq('status', 'pendente')
        .order('data_vencimento', { ascending: true })
        .limit(20);

      if (error) throw error;
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      return ((data || []) as any[]).map(prazo => {
        const vencimento = new Date(prazo.data_vencimento + 'T00:00:00');
        const diffTime = vencimento.getTime() - hoje.getTime();
        const dias_restantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
          ...prazo,
          dias_restantes,
          is_atrasado: dias_restantes < 0,
        } as PrazoPendente;
      });
    },
    enabled: !!user?.id,
  });

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notificacoes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notificacoes', user.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notificacoes', user.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notificacoes', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Realtime subscription for tarefas changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('tarefas-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tarefas',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tarefas-pendentes', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const naoLidas = notificacoes.filter(n => !n.lida);
  
  // Count prazos that are overdue or due within 3 days as "urgent"
  const prazosUrgentes = prazosPendentes.filter(p => p.dias_restantes <= 3);
  
  // Total count for badge
  const totalPendentes = naoLidas.length + prazosUrgentes.length;

  const marcarComoLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const marcarTodasComoLidas = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('usuario_id', user.id)
        .eq('lida', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const excluirNotificacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  return {
    notificacoes,
    naoLidas,
    prazosPendentes,
    prazosUrgentes,
    totalPendentes,
    isLoading: isLoading || isLoadingPrazos,
    refetch,
    marcarComoLida,
    marcarTodasComoLidas,
    excluirNotificacao,
  };
}
