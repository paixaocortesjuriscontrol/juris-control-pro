import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { startOfDay, parseISO, differenceInDays } from "date-fns";

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
  fetchAll?: boolean; // Se true, busca todas as tarefas sem filtrar por usuário (para admins)
}

const PAGE_SIZE = 1000; // Supabase default limit
const AGENDA_INFINITE_QUERY_KEY = "agenda-unificada-infinite-v1" as const;

/**
 * useAgendaUnificadaPaginated - usa useInfiniteQuery para carregar páginas de 1000 registros sob demanda.
 */
export function useAgendaUnificadaPaginated(filters: AgendaUnificadaFilters = {}) {
  const { user } = useAuth();

  return useInfiniteQuery<ItemAgendaUnificado[], Error>({
    // Important: new key avoids React Query cache shape mismatch (array vs InfiniteData)
    // that can crash hasNextPage/getNextPageParam.
    queryKey: [AGENDA_INFINITE_QUERY_KEY, filters, user?.id],
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // Defensive check: if lastPage is undefined or not an array, no more pages
      if (!lastPage || !Array.isArray(lastPage) || lastPage.length === 0) {
        return undefined;
      }
      // Se a última página retornou PAGE_SIZE itens, provavelmente há mais
      if (lastPage.length === PAGE_SIZE) return allPages.length;
      return undefined;
    },
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      if (!user?.id) return [];

      const resultItems: ItemAgendaUnificado[] = [];
      const today = startOfDay(new Date());
      const incluirEventos = !filters.origens || filters.origens.includes("evento");
      const incluirTarefas = !filters.origens || filters.origens.includes("tarefa");

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Constants for queries
      const EVENTOS_SELECT_WITH_JOINS = "*,processo:processos(id,numero,assunto)" as const;
      const EVENTOS_SELECT_BASE = "*" as const;
      const TAREFAS_SELECT_WITH_JOINS =
        "id,titulo,descricao,data_vencimento,data_fatal,tipo_tarefa,status,prioridade,observacoes,created_at,updated_at,processo_id,responsavel_id,criado_por,identificador_projuris,hora_fatal,link_local,orgao,partes_ativas,partes_passivas,processo:processos!tarefas_processo_id_fkey(id,numero,assunto,cliente_id,coordenacao_id),responsavel:profiles!tarefas_responsavel_id_fkey(id,nome)" as const;
      const TAREFAS_SELECT_BASE =
        "id,titulo,descricao,data_vencimento,data_fatal,tipo_tarefa,status,prioridade,observacoes,created_at,updated_at,processo_id,responsavel_id,criado_por,identificador_projuris,hora_fatal,link_local,orgao,partes_ativas,partes_passivas" as const;

      const buildEventosQuery = (withJoins: boolean) => {
        if (withJoins) {
          return supabase.from("eventos_agenda").select(EVENTOS_SELECT_WITH_JOINS) as any;
        }
        return supabase.from("eventos_agenda").select(EVENTOS_SELECT_BASE) as any;
      };

      const buildTarefasQuery = (withJoins: boolean) => {
        if (withJoins) {
          return supabase.from("tarefas").select(TAREFAS_SELECT_WITH_JOINS) as any;
        }
        return supabase.from("tarefas").select(TAREFAS_SELECT_BASE) as any;
      };

      // ========= BUSCAR EVENTOS =========
      if (incluirEventos) {
        let queryEventos = buildEventosQuery(true);

        if (!filters.fetchAll) {
          const { data: participacoesUsuario } = await supabase
            .from("participantes_evento")
            .select("evento_id")
            .eq("usuario_id", user.id);

          const eventosParticipante = participacoesUsuario?.map((p) => p.evento_id) || [];

          if (eventosParticipante.length > 0) {
            queryEventos = queryEventos.or(`criado_por.eq.${user.id},id.in.(${eventosParticipante.join(",")})`);
          } else {
            queryEventos = queryEventos.eq("criado_por", user.id);
          }
        }

        if (filters.tipos && filters.tipos.length > 0) {
          const tiposEvento = filters.tipos.filter((t) =>
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

        // Apply range for pagination
        queryEventos = queryEventos.range(from, to);

        let { data: eventos, error: eventosError } = await queryEventos;

        if (eventosError) {
          console.error("Erro ao buscar eventos:", eventosError);
          // fallback sem joins
          let queryEventosFallback = buildEventosQuery(false);
          if (!filters.fetchAll) {
            const { data: participacoesUsuario } = await supabase
              .from("participantes_evento")
              .select("evento_id")
              .eq("usuario_id", user.id);
            const eventosParticipante = participacoesUsuario?.map((p) => p.evento_id) || [];
            if (eventosParticipante.length > 0) {
              queryEventosFallback = queryEventosFallback.or(`criado_por.eq.${user.id},id.in.(${eventosParticipante.join(",")})`);
            } else {
              queryEventosFallback = queryEventosFallback.eq("criado_por", user.id);
            }
          }
          if (filters.tipos && filters.tipos.length > 0) {
            const tiposEvento = filters.tipos.filter((t) =>
              ["evento", "prazo", "audiencia", "parcelamento", "prazo_parcela"].includes(t)
            );
            if (tiposEvento.length > 0) {
              queryEventosFallback = queryEventosFallback.in("tipo", tiposEvento);
            }
          }
          if (filters.status && filters.status !== "todas") {
            queryEventosFallback = queryEventosFallback.eq("status", filters.status === "pendente" ? "pendente" : filters.status);
          }
          if (filters.dataInicio) {
            queryEventosFallback = queryEventosFallback.gte("data_inicio", filters.dataInicio.toISOString());
          }
          if (filters.dataFim) {
            queryEventosFallback = queryEventosFallback.lte("data_inicio", filters.dataFim.toISOString());
          }
          queryEventosFallback = queryEventosFallback.range(from, to);
          const fallbackRes = await queryEventosFallback;
          eventos = fallbackRes.data;
          eventosError = fallbackRes.error;
        }

        if (!eventosError && eventos && eventos.length > 0) {
          const eventIds = eventos.map((e: any) => e.id);
          const { data: participantes } = await supabase
            .from("participantes_evento")
            .select("evento_id, usuario_id")
            .in("evento_id", eventIds);

          let eventosFiltered = eventos;
          if (filters.responsavelIds && filters.responsavelIds.length > 0) {
            eventosFiltered = eventos.filter((evento: any) => {
              const eventParticipants = participantes?.filter((p) => p.evento_id === evento.id) || [];
              const participantIds = eventParticipants.map((p) => p.usuario_id);
              return (
                filters.responsavelIds!.includes(evento.criado_por) ||
                participantIds.some((id) => filters.responsavelIds!.includes(id))
              );
            });
          }

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
              participantes: participantes?.filter((p) => p.evento_id === evento.id) || [],
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
        let queryTarefas = buildTarefasQuery(true);

        if (filters.fetchAll) {
          // Admin vendo todas
        } else if (filters.responsavelIds && filters.responsavelIds.length > 0) {
          if (filters.responsavelIds.includes(user.id)) {
            queryTarefas = queryTarefas.or(`responsavel_id.in.(${filters.responsavelIds.join(",")}),criado_por.eq.${user.id}`);
          } else {
            const membrosFilter = filters.responsavelIds.join(",");
            queryTarefas = queryTarefas.or(`responsavel_id.in.(${membrosFilter}),and(criado_por.eq.${user.id},responsavel_id.in.(${membrosFilter}))`);
          }
        } else {
          queryTarefas = queryTarefas.or(`responsavel_id.eq.${user.id},criado_por.eq.${user.id}`);
        }

        if (filters.status && filters.status !== "todas") {
          if (filters.status === "pendente") {
            queryTarefas = queryTarefas.eq("status", "pendente");
          } else if (filters.status === "concluido") {
            queryTarefas = queryTarefas.eq("status", "cumprido");
          }
        }

        if (filters.dataInicio) {
          queryTarefas = queryTarefas.gte("data_vencimento", filters.dataInicio.toISOString().split("T")[0]);
        }

        if (filters.dataFim) {
          queryTarefas = queryTarefas.lte("data_vencimento", filters.dataFim.toISOString().split("T")[0]);
        }

        // Apply range for pagination
        queryTarefas = queryTarefas.range(from, to);

        let { data: tarefas, error: tarefasError } = await queryTarefas;

        if (tarefasError) {
          console.error("Erro ao buscar tarefas:", tarefasError);
          let queryTarefasFallback = buildTarefasQuery(false);
          if (filters.fetchAll) {
            // sem filtro
          } else if (filters.responsavelIds && filters.responsavelIds.length > 0) {
            if (filters.responsavelIds.includes(user.id)) {
              queryTarefasFallback = queryTarefasFallback.or(`responsavel_id.in.(${filters.responsavelIds.join(",")}),criado_por.eq.${user.id}`);
            } else {
              const membrosFilter = filters.responsavelIds.join(",");
              queryTarefasFallback = queryTarefasFallback.or(`responsavel_id.in.(${membrosFilter}),and(criado_por.eq.${user.id},responsavel_id.in.(${membrosFilter}))`);
            }
          } else {
            queryTarefasFallback = queryTarefasFallback.or(`responsavel_id.eq.${user.id},criado_por.eq.${user.id}`);
          }
          if (filters.status && filters.status !== "todas") {
            if (filters.status === "pendente") {
              queryTarefasFallback = queryTarefasFallback.eq("status", "pendente");
            } else if (filters.status === "concluido") {
              queryTarefasFallback = queryTarefasFallback.eq("status", "cumprido");
            }
          }
          if (filters.dataInicio) {
            queryTarefasFallback = queryTarefasFallback.gte("data_vencimento", filters.dataInicio.toISOString().split("T")[0]);
          }
          if (filters.dataFim) {
            queryTarefasFallback = queryTarefasFallback.lte("data_vencimento", filters.dataFim.toISOString().split("T")[0]);
          }
          queryTarefasFallback = queryTarefasFallback.range(from, to);
          const fallbackRes = await queryTarefasFallback;
          tarefas = fallbackRes.data;
          tarefasError = fallbackRes.error;
        }

        if (!tarefasError && tarefas) {
          const incluirTipoTarefa = !filters.tipos || filters.tipos.length === 0 || filters.tipos.includes("tarefa") || filters.tipos.includes("tarefa_delegada");

          if (incluirTipoTarefa) {
            let tarefasFiltradas = tarefas;
            if (filters.clienteId) {
              tarefasFiltradas = tarefasFiltradas.filter(
                (t: any) => t.processo && (t.processo as { cliente_id?: string }).cliente_id === filters.clienteId
              );
            }
            if (filters.coordenacaoId) {
              tarefasFiltradas = tarefasFiltradas.filter((t: any) => {
                const procCoord = t.processo && (t.processo as { coordenacao_id?: string | null }).coordenacao_id;
                if (procCoord) return procCoord === filters.coordenacaoId;
                if (filters.responsavelIds && filters.responsavelIds.length > 0) {
                  return filters.responsavelIds.includes(t.responsavel_id);
                }
                return false;
              });
            }

            for (const tarefa of tarefasFiltradas) {
              const dataBaseISO: string | null = tarefa.data_vencimento ?? tarefa.data_fatal ?? tarefa.created_at ?? null;
              if (!dataBaseISO) continue;

              const dataBase = parseISO(dataBaseISO);
              const diasRestantes = differenceInDays(startOfDay(dataBase), today);
              const isAtrasado = diasRestantes < 0 && tarefa.status === "pendente";

              const statusUnificado = tarefa.status === "cumprido" ? "concluido" : tarefa.status;
              const tipoTarefa = tarefa.criado_por !== user.id ? "tarefa_delegada" : "tarefa";

              resultItems.push({
                id: tarefa.id,
                titulo: tarefa.titulo,
                descricao: tarefa.descricao,
                tipo: tipoTarefa,
                origem: "tarefa",
                data_inicio:
                  tarefa.data_vencimento || tarefa.data_fatal
                    ? `${(tarefa.data_vencimento ?? tarefa.data_fatal)!}T00:00:00`
                    : tarefa.created_at,
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
                processo: tarefa.processo
                  ? {
                      id: tarefa.processo.id,
                      numero: tarefa.processo.numero,
                      assunto: tarefa.processo.assunto,
                      cliente_id: (tarefa.processo as { cliente_id?: string }).cliente_id,
                    }
                  : null,
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
      const futureItems = resultItems.filter((e) => new Date(e.data_inicio) >= now).sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
      const pastItems = resultItems.filter((e) => new Date(e.data_inicio) < now).sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime());

      return [...futureItems, ...pastItems];
    },
    enabled: !!user,
  });
}

/**
 * useAgendaUnificada - wrapper legado que retorna a primeira página (compatibilidade).
 * Para paginação completa, use useAgendaUnificadaPaginated diretamente.
 */
export function useAgendaUnificada(filters: AgendaUnificadaFilters = {}) {
  const infiniteQuery = useAgendaUnificadaPaginated(filters);

  // Flatten all pages into a single array for backward compatibility
  const data = infiniteQuery.data?.pages?.flat() ?? [];

  return {
    data,
    isLoading: infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error,
    // Infinite query specific methods
    fetchNextPage: infiniteQuery.fetchNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    refetch: infiniteQuery.refetch,
  };
}

export function useUpdateItemAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      origem,
      status,
      concluido_em,
    }: {
      id: string;
      origem: "evento" | "tarefa";
      status?: string;
      concluido_em?: string | null;
    }) => {
      if (origem === "tarefa") {
        const tarefaStatus = (status === "concluido" ? "cumprido" : status) as "atrasado" | "cumprido" | "pendente";
        const { error } = await supabase.from("tarefas").update({ status: tarefaStatus, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("eventos_agenda").update({ status, concluido_em, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
      toast.success("Item atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar item:", error);
      toast.error("Erro ao atualizar item");
    },
  });
}

export function useDeleteItemAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, origem }: { id: string; origem: "evento" | "tarefa" }) => {
      if (origem === "tarefa") {
        const { error } = await supabase.from("tarefas").delete().eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("eventos_agenda").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
      toast.success("Item excluído com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao excluir item:", error);
      toast.error("Erro ao excluir item");
    },
  });
}
