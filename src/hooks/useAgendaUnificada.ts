import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { startOfDay, parseISO, isAfter, differenceInDays } from "date-fns";

// Interface unificada que representa tanto eventos quanto tarefas
export interface ItemAgendaUnificado {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  origem: "evento" | "tarefa"; // Para identificar a origem
  data_inicio: string;
  data_fim: string | null;
  dia_inteiro: boolean;
  local: string | null;
  recorrente: boolean;
  recorrencia_tipo: string | null;
  status: string;
  prioridade?: string;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
  processo_id: string | null;
  processo?: { id: string; numero: string; assunto?: string | null; cliente_id?: string | null } | null;
  participantes?: { usuario_id: string; usuario?: { id: string; nome: string } }[];
  enviar_whatsapp?: boolean;
  total_parcelas?: number | null;
  dias_restantes?: number;
  is_atrasado?: boolean;
  // Para eventos
  criado_por?: string;
  // Para tarefas
  responsavel_id?: string;
  responsavel?: { id: string; nome: string } | null;
  delegado_por_id?: string;
  tipo_tarefa?: string | null;
  data_vencimento?: string | null;
  data_fatal?: string | null;
  // Projuris-specific fields
  identificador_projuris?: string | null;
  hora_criacao?: string | null;
  hora_prevista?: string | null;
  hora_fatal?: string | null;
  hora_conclusao?: string | null;
  link_local?: string | null;
  orgao?: string | null;
  orgao_julgador?: string | null;
  instancia?: string | null;
  situacao_processo?: string | null;
  partes_ativas?: string | null;
  partes_passivas?: string | null;
  outras_partes?: string | null;
  envolvimento_clientes?: string | null;
  criado_por_nome?: string | null;
  concluido_por_nome?: string | null;
  grupos_trabalho?: string | null;
  marcadores?: string | null;
  modulo?: string | null;
  quadro_kanban?: string | null;
}

export interface AgendaUnificadaFilters {
  tipos?: string[];
  status?: string;
  dataInicio?: Date;
  dataFim?: Date;
  responsavelIds?: string[];
  coordenacaoId?: string;
  clienteId?: string;
  origens?: ("evento" | "tarefa")[]; // Filtrar por origem
}

export function useAgendaUnificada(filters: AgendaUnificadaFilters = {}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["agenda-unificada", filters, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const resultItems: ItemAgendaUnificado[] = [];
      const today = startOfDay(new Date());
      const incluirEventos = !filters.origens || filters.origens.includes("evento");
      const incluirTarefas = !filters.origens || filters.origens.includes("tarefa");

      // ========= BUSCAR EVENTOS =========
      if (incluirEventos) {
        // Get events where user is a participant
        const { data: participacoesUsuario } = await supabase
          .from("participantes_evento")
          .select("evento_id")
          .eq("usuario_id", user.id);
        
        const eventosParticipante = participacoesUsuario?.map(p => p.evento_id) || [];

        let queryEventos = supabase
          .from("eventos_agenda")
          .select(`
            *,
            processo:processos(id, numero, assunto)
          `);

        // Filter: created by user OR user is participant
        if (eventosParticipante.length > 0) {
          queryEventos = queryEventos.or(`criado_por.eq.${user.id},id.in.(${eventosParticipante.join(',')})`);
        } else {
          queryEventos = queryEventos.eq("criado_por", user.id);
        }

        // Filtros de tipo para eventos
        if (filters.tipos && filters.tipos.length > 0) {
          const tiposEvento = filters.tipos.filter(t => 
            ["evento", "prazo", "audiencia", "parcelamento", "prazo_parcela"].includes(t)
          );
          if (tiposEvento.length > 0) {
            queryEventos = queryEventos.in("tipo", tiposEvento);
          }
        }
        
        if (filters.status && filters.status !== "todas") {
          queryEventos = queryEventos.eq("status", filters.status === "pendente" ? "pendente" : filters.status);
        }
        
        if (filters.dataInicio) {
          queryEventos = queryEventos.gte("data_inicio", filters.dataInicio.toISOString());
        }
        
        if (filters.dataFim) {
          queryEventos = queryEventos.lte("data_inicio", filters.dataFim.toISOString());
        }

        const { data: eventos, error: eventosError } = await queryEventos;
        
        if (eventosError) {
          console.error("Erro ao buscar eventos:", eventosError);
        } else if (eventos && eventos.length > 0) {
          // Get participants for each event
          const eventIds = eventos.map(e => e.id);
          const { data: participantes } = await supabase
            .from("participantes_evento")
            .select("evento_id, usuario_id")
            .in("evento_id", eventIds);

          // Filter by responsavel if needed
          let eventosFiltered = eventos;
          if (filters.responsavelIds && filters.responsavelIds.length > 0) {
            eventosFiltered = eventos.filter(evento => {
              const eventParticipants = participantes?.filter(p => p.evento_id === evento.id) || [];
              const participantIds = eventParticipants.map(p => p.usuario_id);
              return (
                filters.responsavelIds!.includes(evento.criado_por) ||
                participantIds.some(id => filters.responsavelIds!.includes(id))
              );
            });
          }

          // Transform events to unified format
          for (const evento of eventosFiltered) {
            const dataEvento = parseISO(evento.data_inicio);
            const diasRestantes = differenceInDays(startOfDay(dataEvento), today);
            const isAtrasado = diasRestantes < 0 && evento.status !== "concluido";

            resultItems.push({
              id: evento.id,
              titulo: evento.titulo,
              descricao: evento.descricao,
              tipo: evento.tipo,
              origem: "evento",
              data_inicio: evento.data_inicio,
              data_fim: evento.data_fim,
              dia_inteiro: evento.dia_inteiro || false,
              local: evento.local,
              recorrente: evento.recorrente || false,
              recorrencia_tipo: evento.recorrencia_tipo,
              status: evento.status,
              concluido_em: evento.concluido_em,
              created_at: evento.created_at,
              updated_at: evento.updated_at,
              processo_id: evento.processo_id,
              processo: evento.processo,
              participantes: participantes?.filter(p => p.evento_id === evento.id) || [],
              enviar_whatsapp: evento.enviar_whatsapp,
              total_parcelas: evento.total_parcelas,
              criado_por: evento.criado_por,
              dias_restantes: diasRestantes,
              is_atrasado: isAtrasado,
            });
          }
        }
      }

      // ========= BUSCAR TAREFAS =========
      if (incluirTarefas) {
        let queryTarefas = supabase
          .from("tarefas")
          .select(`
            id,
            titulo,
            descricao,
            data_vencimento,
            data_fatal,
            tipo_tarefa,
            status,
            prioridade,
            observacoes,
            created_at,
            updated_at,
            processo_id,
            responsavel_id,
            criado_por,
            identificador_projuris,
            hora_fatal,
            link_local,
            orgao,
            partes_ativas,
            partes_passivas,
            processo:processos!tarefas_processo_id_fkey(id, numero, assunto, cliente_id, coordenacao_id),
            responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
          `);

        // Filtrar por responsável OU se é o criador
        // Se o filtro de membro está ativo, mostra tarefas onde o responsável está no filtro OU o usuário logado é criador
        if (filters.responsavelIds && filters.responsavelIds.length > 0) {
          // Se o próprio usuário logado está no filtro, mostra também onde ele é criador
          if (filters.responsavelIds.includes(user.id)) {
            queryTarefas = queryTarefas.or(`responsavel_id.in.(${filters.responsavelIds.join(',')}),criado_por.eq.${user.id}`);
          } else {
            // Só mostra do membro selecionado (mas também inclui as que o usuário criou para esse membro)
            const membrosFilter = filters.responsavelIds.join(',');
            queryTarefas = queryTarefas.or(`responsavel_id.in.(${membrosFilter}),and(criado_por.eq.${user.id},responsavel_id.in.(${membrosFilter}))`);
          }
        } else {
          // Sem filtro de membro: mostrar todas onde o usuário é responsável OU criador
          queryTarefas = queryTarefas.or(`responsavel_id.eq.${user.id},criado_por.eq.${user.id}`);
        }

        // Filtrar por status
        if (filters.status && filters.status !== "todas") {
          if (filters.status === "pendente") {
            queryTarefas = queryTarefas.eq("status", "pendente");
          } else if (filters.status === "concluido") {
            queryTarefas = queryTarefas.eq("status", "cumprido");
          }
        }

        // Filtrar por data
        if (filters.dataInicio) {
          queryTarefas = queryTarefas.gte("data_vencimento", filters.dataInicio.toISOString().split('T')[0]);
        }
        
        if (filters.dataFim) {
          queryTarefas = queryTarefas.lte("data_vencimento", filters.dataFim.toISOString().split('T')[0]);
        }

        const { data: tarefas, error: tarefasError } = await queryTarefas;

        if (tarefasError) {
          console.error("Erro ao buscar tarefas:", tarefasError);
        } else if (tarefas) {
          // Filtrar por tipos se "tarefa" ou "tarefa_delegada" estiver incluído
          const incluirTipoTarefa = !filters.tipos || filters.tipos.length === 0 || 
            filters.tipos.includes("tarefa") || filters.tipos.includes("tarefa_delegada");
          
          if (incluirTipoTarefa) {
            // Filtrar por cliente e coordenação se especificado
            let tarefasFiltradas = tarefas;
            if (filters.clienteId) {
              tarefasFiltradas = tarefasFiltradas.filter(t => 
                t.processo && (t.processo as { cliente_id?: string }).cliente_id === filters.clienteId
              );
            }
            if (filters.coordenacaoId) {
              tarefasFiltradas = tarefasFiltradas.filter(t => {
                const procCoord = t.processo && (t.processo as { coordenacao_id?: string | null }).coordenacao_id;
                if (procCoord) return procCoord === filters.coordenacaoId;

                // Sem processo: manter apenas se o responsável estiver no conjunto de pessoas filtradas
                // (ex.: quando a página passa os membros da coordenação via responsavelIds).
                if (filters.responsavelIds && filters.responsavelIds.length > 0) {
                  return filters.responsavelIds.includes(t.responsavel_id);
                }

                return false;
              });
            }

            for (const tarefa of tarefasFiltradas) {
              const dataVencimento = parseISO(tarefa.data_vencimento);
              const diasRestantes = differenceInDays(startOfDay(dataVencimento), today);
              const isAtrasado = diasRestantes < 0 && tarefa.status === "pendente";

              // Mapear status da tarefa para status unificado
              const statusUnificado = tarefa.status === "cumprido" ? "concluido" : tarefa.status;

              // Determinar se é tarefa delegada (criada por outro) ou própria
              const tipoTarefa = tarefa.criado_por !== user.id ? "tarefa_delegada" : "tarefa";

              resultItems.push({
                id: tarefa.id,
                titulo: tarefa.titulo,
                descricao: tarefa.descricao,
                tipo: tipoTarefa,
                origem: "tarefa",
                data_inicio: `${tarefa.data_vencimento}T00:00:00`,
                data_fim: null,
                dia_inteiro: true,
                local: null,
                recorrente: false,
                recorrencia_tipo: null,
                status: statusUnificado,
                prioridade: tarefa.prioridade,
                concluido_em: tarefa.status === "cumprido" ? tarefa.updated_at : null,
                created_at: tarefa.created_at,
                updated_at: tarefa.updated_at,
                processo_id: tarefa.processo_id,
                processo: tarefa.processo ? { 
                  id: tarefa.processo.id, 
                  numero: tarefa.processo.numero, 
                  assunto: tarefa.processo.assunto,
                  cliente_id: (tarefa.processo as { cliente_id?: string }).cliente_id
                } : null,
                responsavel_id: tarefa.responsavel_id,
                responsavel: tarefa.responsavel,
                criado_por: tarefa.criado_por,
                dias_restantes: diasRestantes,
                is_atrasado: isAtrasado,
                tipo_tarefa: tarefa.tipo_tarefa,
                data_vencimento: tarefa.data_vencimento,
                data_fatal: tarefa.data_fatal,
              });
            }
          }
        }
      }

      // ========= ORDENAR RESULTADOS =========
      const now = new Date();
      
      // Separar futuros e passados
      const futureItems = resultItems
        .filter(e => new Date(e.data_inicio) >= now)
        .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
      
      const pastItems = resultItems
        .filter(e => new Date(e.data_inicio) < now)
        .sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime());
      
      return [...futureItems, ...pastItems];
    },
    enabled: !!user,
  });
}

export function useAgendaUnificadaStats() {
  const { user } = useAuth();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  return useQuery({
    queryKey: ["agenda-unificada-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return { concluidas: 0, pendentes: 0, atrasadas: 0 };

      let concluidas = 0;
      let pendentes = 0;
      let atrasadas = 0;

      // ========= STATS DE EVENTOS =========
      const { data: participacoesUsuario } = await supabase
        .from("participantes_evento")
        .select("evento_id")
        .eq("usuario_id", user.id);
      
      const eventosParticipante = participacoesUsuario?.map(p => p.evento_id) || [];

      let queryEventos = supabase
        .from("eventos_agenda")
        .select("id, status, data_inicio");

      if (eventosParticipante.length > 0) {
        queryEventos = queryEventos.or(`criado_por.eq.${user.id},id.in.(${eventosParticipante.join(',')})`);
      } else {
        queryEventos = queryEventos.eq("criado_por", user.id);
      }

      const { data: eventos } = await queryEventos;
      
      if (eventos) {
        concluidas += eventos.filter(e => e.status === "concluido").length;
        pendentes += eventos.filter(e => {
          const dataEvento = new Date(e.data_inicio);
          dataEvento.setHours(0, 0, 0, 0);
          return e.status === "pendente" && dataEvento.getTime() === hoje.getTime();
        }).length;
        atrasadas += eventos.filter(e => {
          const dataEvento = new Date(e.data_inicio);
          return e.status === "pendente" && dataEvento < hoje;
        }).length;
      }

      // ========= STATS DE TAREFAS =========
      const { data: tarefas } = await supabase
        .from("tarefas")
        .select("id, status, data_vencimento")
        .or(`responsavel_id.eq.${user.id},criado_por.eq.${user.id}`);

      if (tarefas) {
        concluidas += tarefas.filter(t => t.status === "cumprido").length;
        pendentes += tarefas.filter(t => {
          const dataTarefa = new Date(t.data_vencimento);
          dataTarefa.setHours(0, 0, 0, 0);
          return t.status === "pendente" && dataTarefa.getTime() === hoje.getTime();
        }).length;
        atrasadas += tarefas.filter(t => {
          const dataTarefa = new Date(t.data_vencimento);
          return t.status === "pendente" && dataTarefa < hoje;
        }).length;
      }
      
      return { concluidas, pendentes, atrasadas };
    },
    enabled: !!user,
  });
}

export function useUpdateItemAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      origem,
      ...updates 
    }: { id: string; origem: "evento" | "tarefa"; status?: string; concluido_em?: string | null }) => {
      if (origem === "evento") {
        const { data, error } = await supabase
          .from("eventos_agenda")
          .update(updates)
          .eq("id", id)
          .select()
          .maybeSingle();

        if (error) throw error;
        return data;
      } else {
        // Para tarefas, mapear status
        const tarefaUpdates: Record<string, unknown> = {};
        if (updates.status) {
          tarefaUpdates.status = updates.status === "concluido" ? "cumprido" : updates.status;
        }

        const { data, error } = await supabase
          .from("tarefas")
          .update(tarefaUpdates)
          .eq("id", id)
          .select()
          .maybeSingle();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada-stats"] });
      queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["eventos-stats"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}

export function useDeleteItemAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, origem }: { id: string; origem: "evento" | "tarefa" }) => {
      if (origem === "evento") {
        const { error } = await supabase
          .from("eventos_agenda")
          .delete()
          .eq("id", id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tarefas")
          .delete()
          .eq("id", id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada-stats"] });
      queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });
}
