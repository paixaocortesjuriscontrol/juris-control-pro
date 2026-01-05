import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface EventoAgenda {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  dia_inteiro: boolean;
  local: string | null;
  recorrente: boolean;
  recorrencia_tipo: string | null;
  recorrencia_intervalo: number | null;
  recorrencia_fim: string | null;
  recorrencia_dias_semana: number[] | null;
  processo_id: string | null;
  criado_por: string;
  status: string;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
  enviar_whatsapp: boolean;
  participantes?: { usuario_id: string; usuario?: { id: string; nome: string } }[];
  processo?: { id: string; numero: string } | null;
}

export interface EventoFilters {
  tipos?: string[];
  status?: string;
  dataInicio?: Date;
  dataFim?: Date;
  responsavelIds?: string[];
  coordenacaoId?: string;
}

export interface NovoEvento {
  titulo: string;
  descricao?: string;
  tipo: string;
  data_inicio: string;
  data_fim?: string;
  dia_inteiro?: boolean;
  local?: string;
  recorrente?: boolean;
  recorrencia_tipo?: string;
  recorrencia_intervalo?: number;
  recorrencia_fim?: string;
  recorrencia_dias_semana?: number[];
  processo_id?: string;
  participantes_ids?: string[];
  alerta_minutos?: number[];
}

export function useEventosAgenda(filters: EventoFilters = {}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["eventos-agenda", filters],
    queryFn: async () => {
      let query = supabase
        .from("eventos_agenda")
        .select(`
          *,
          processo:processos(id, numero)
        `)
        .order("data_inicio", { ascending: true });

      if (filters.tipos && filters.tipos.length > 0) {
        query = query.in("tipo", filters.tipos);
      }
      
      if (filters.status && filters.status !== "todas") {
        query = query.eq("status", filters.status);
      }
      
      if (filters.dataInicio) {
        query = query.gte("data_inicio", filters.dataInicio.toISOString());
      }
      
      if (filters.dataFim) {
        query = query.lte("data_inicio", filters.dataFim.toISOString());
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Get participants for each event
      if (data && data.length > 0) {
        const eventIds = data.map(e => e.id);
        const { data: participantes } = await supabase
          .from("participantes_evento")
          .select("evento_id, usuario_id")
          .in("evento_id", eventIds);
        
        // Filter by responsavel if needed
        if (filters.responsavelIds && filters.responsavelIds.length > 0) {
          const filteredEvents = data.filter(evento => {
            const eventParticipants = participantes?.filter(p => p.evento_id === evento.id) || [];
            const participantIds = eventParticipants.map(p => p.usuario_id);
            return (
              filters.responsavelIds!.includes(evento.criado_por) ||
              participantIds.some(id => filters.responsavelIds!.includes(id))
            );
          });
          return filteredEvents as EventoAgenda[];
        }
        
        return data.map(evento => ({
          ...evento,
          participantes: participantes?.filter(p => p.evento_id === evento.id) || []
        })) as EventoAgenda[];
      }
      
      return data as EventoAgenda[];
    },
    enabled: !!user,
  });
}

export function useEventoStats() {
  const { user } = useAuth();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  return useQuery({
    queryKey: ["eventos-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_agenda")
        .select("id, status, data_inicio");
      
      if (error) throw error;
      
      const concluidas = data?.filter(e => e.status === "concluido").length || 0;
      const pendentes = data?.filter(e => {
        const dataEvento = new Date(e.data_inicio);
        dataEvento.setHours(0, 0, 0, 0);
        return e.status === "pendente" && dataEvento.getTime() === hoje.getTime();
      }).length || 0;
      const atrasadas = data?.filter(e => {
        const dataEvento = new Date(e.data_inicio);
        return e.status === "pendente" && dataEvento < hoje;
      }).length || 0;
      
      return { concluidas, pendentes, atrasadas };
    },
    enabled: !!user,
  });
}

export function useCreateEvento() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (evento: NovoEvento) => {
      // Get current user from session to ensure we have the ID
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      const userId = sessionUser?.id || user?.id;
      
      if (!userId) {
        throw new Error("Usuário não autenticado");
      }

      const { participantes_ids, alerta_minutos, ...eventoData } = evento;
      
      const { data, error } = await supabase
        .from("eventos_agenda")
        .insert({
          ...eventoData,
          criado_por: userId,
        })
        .select()
        .single();

      if (error) throw error;

      // Add participants
      if (participantes_ids && participantes_ids.length > 0) {
        const participantesData = participantes_ids.map(participantId => ({
          evento_id: data.id,
          usuario_id: participantId,
        }));
        
        const { error: partError } = await supabase.from("participantes_evento").insert(participantesData);
        if (partError) console.error("Erro ao adicionar participantes:", partError);
      }

      // Add alerts
      if (alerta_minutos && alerta_minutos.length > 0) {
        const alertasData = alerta_minutos.map(minutos => ({
          evento_id: data.id,
          minutos_antes: minutos,
        }));
        
        const { error: alertError } = await supabase.from("alertas_evento").insert(alertasData);
        if (alertError) console.error("Erro ao adicionar alertas:", alertError);
      }

      // Send email notifications to participants
      const allParticipants = [...(participantes_ids || []), userId];
      try {
        await supabase.functions.invoke('notificar-evento', {
          body: {
            evento_id: data.id,
            participantes_ids: allParticipants,
            tipo_notificacao: 'criacao'
          }
        });
      } catch (emailError) {
        console.error("Erro ao enviar notificações por email:", emailError);
        // Don't fail the event creation if email fails
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["eventos-stats"] });
      toast.success("Evento criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar evento: " + error.message);
    },
  });
}

export function useUpdateEvento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      participantes_ids,
      alerta_minutos,
      ...updates 
    }: Partial<EventoAgenda> & { id: string; participantes_ids?: string[]; alerta_minutos?: number[] }) => {
      const { data, error } = await supabase
        .from("eventos_agenda")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Evento não encontrado ou sem permissão para editar");

      // Update participants if provided
      if (participantes_ids !== undefined) {
        await supabase.from("participantes_evento").delete().eq("evento_id", id);
        
        if (participantes_ids.length > 0) {
          const participantesData = participantes_ids.map(userId => ({
            evento_id: id,
            usuario_id: userId,
          }));
          await supabase.from("participantes_evento").insert(participantesData);
        }
      }

      // Update alerts if provided
      if (alerta_minutos !== undefined) {
        await supabase.from("alertas_evento").delete().eq("evento_id", id);
        
        if (alerta_minutos.length > 0) {
          const alertasData = alerta_minutos.map(minutos => ({
            evento_id: id,
            minutos_antes: minutos,
          }));
          await supabase.from("alertas_evento").insert(alertasData);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["eventos-stats"] });
      toast.success("Evento atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar evento: " + error.message);
    },
  });
}

export function useDeleteEvento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("eventos_agenda")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["eventos-stats"] });
      toast.success("Evento excluído!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir evento: " + error.message);
    },
  });
}
