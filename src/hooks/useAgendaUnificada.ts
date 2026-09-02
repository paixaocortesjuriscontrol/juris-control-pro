import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { startOfDay, endOfDay, parseISO, differenceInDays, addDays, addMonths, addYears } from "date-fns";
import { format } from "date-fns";
import { registrarAuditoriaTarefa } from "@/hooks/useAuditoriaTarefas";
import { dataInicioAudiencia } from "@/utils/date";
import { sincronizarWorkflowPorItem } from "@/lib/workflowExecutor";

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
  recorrencia_pai_id?: string | null;
  tarefa_pai_id?: string | null;
  /** true quando a situação exibida veio da baixa individual da ocorrência */
  baixa_individual?: boolean;
  status: string;
  prioridade?: string;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
  processo_id: string | null;
  coordenacao_id?: string | null;
  processo?: { id: string; numero: string; assunto?: string | null; cliente_id?: string | null; coordenacao_id?: string | null } | null;
  participantes?: { usuario_id: string; usuario?: { id: string; nome: string } }[];
  enviar_whatsapp?: boolean;
  total_parcelas?: number | null;
  grupo_parcelas?: string | null;
  numero_parcela?: number | null;
  valor_parcela?: number | null;
  dias_restantes?: number;
  is_atrasado?: boolean;
  // Para eventos
  criado_por?: string;
  // Para tarefas
  responsavel_id?: string;
  responsaveis_ids?: string[];
  responsavel?: { id: string; nome: string } | null;
  delegado_por_id?: string;
  criador?: { id: string; nome: string } | null;
  tipo_tarefa?: string | null;
  data_vencimento?: string | null;
  data_fatal?: string | null;
  data_prevista?: string | null;
  data_cumprimento?: string | null;
  origem_importacao?: string | null;
  ranking_data_conclusao?: string | null;
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
  coordenacaoIds?: string[];
  clienteId?: string;
  origens?: ("evento" | "tarefa")[]; // Filtrar por origem
  fetchAll?: boolean; // Se true, busca todas as tarefas sem filtrar por usuário (para admins)
  pessoal?: boolean; // Se true, inclui tarefas criadas pelo usuário mesmo que delegadas a outros
  strictCoordenacaoIsolation?: boolean; // Se true, exclui itens sem processo da visão por coordenação
  enabled?: boolean; // Se false, a query não é executada
}

const PAGE_SIZE = 1000; // Supabase default limit
export const AGENDA_INFINITE_QUERY_KEY = "agenda-unificada-infinite-v1" as const;

const normalizeDedupText = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

const normalizeProcessDigits = (value: string | null | undefined) => String(value ?? "").replace(/\D/g, "");

const normalizeRecorrenciaTipo = (tipo: string | null | undefined) => {
  const normalized = String(tipo ?? "").toLowerCase().trim();
  if (["daily", "diaria", "diário", "diario"].includes(normalized)) return "daily";
  if (["weekdays", "uteis", "úteis", "dias_uteis", "dias-uteis", "business", "businessdays"].includes(normalized)) return "weekdays";
  if (["weekly", "semanal"].includes(normalized)) return "weekly";
  if (["monthly", "mensal"].includes(normalized)) return "monthly";
  if (["yearly", "annual", "anual"].includes(normalized)) return "yearly";
  return normalized;
};

/**
 * Proteção apenas de identidade: garante que o MESMO registro (origem + id) não
 * apareça duas vezes na tela ao juntar páginas. Não escondemos mais itens por
 * título/data/responsável — se o usuário criou duas tarefas iguais, as duas aparecem.
 */
const getAgendaDedupKey = (item: ItemAgendaUnificado) => `${item.origem}:${item.id}`;


export async function fetchAgendaPage(
  filters: AgendaUnificadaFilters,
  page: number,
  userId: string | undefined,
): Promise<ItemAgendaUnificado[]> {
  const user = userId ? { id: userId } : null;
  if (!user?.id) return [];

      const resultItems: ItemAgendaUnificado[] = [];
      const seenIds = new Set<string>(); // Dedup: track seen IDs
      const today = startOfDay(new Date());
      const tipoFilters = filters.tipos ?? [];
      const eventTypeFilters = ["evento", "prazo", "audiencia", "parcelamento", "prazo_parcela"];
      const taskTypeFilters = ["tarefa", "tarefa_delegada", "evento", "prazo", "audiencia", "parcelamento"];
      const incluirEventos = !filters.origens || filters.origens.includes("evento");
      const incluirTarefas = !filters.origens || filters.origens.includes("tarefa");
      const incluirEventosPorTipo = tipoFilters.length === 0 || tipoFilters.some((t) => eventTypeFilters.includes(t));
      const incluirTarefasPorTipo = tipoFilters.length === 0 || tipoFilters.some((t) => taskTypeFilters.includes(t));
      const coordScopeIds = filters.coordenacaoIds?.length
        ? filters.coordenacaoIds
        : filters.coordenacaoId
          ? [filters.coordenacaoId]
          : [];
      const hasCoordScope = coordScopeIds.length > 0;

      // Calculate pagination ranges for each source separately
      // When fetchAll (admin escritório), use larger page size to reduce round trips
      const halfPage = filters.fetchAll ? PAGE_SIZE : Math.floor(PAGE_SIZE / 2);
      const from = page * halfPage;
      const to = from + halfPage - 1;

      // Constants for queries
      const EVENTOS_SELECT_WITH_JOINS = "*,processo:processos!eventos_agenda_processo_id_fkey(id,numero,assunto,coordenacao_id)" as const;
      const EVENTOS_SELECT_BASE = "*" as const;
      const TAREFAS_SELECT_WITH_JOINS =
        "id,titulo,descricao,data_vencimento,data_fatal,data_prevista,data_cumprimento,tipo_tarefa,status,prioridade,observacoes,origem,created_at,updated_at,processo_id,coordenacao_id,responsavel_id,criado_por,identificador_projuris,hora_fatal,hora_prevista,data_base,prazo_dias,prazo_unidade,link_local,orgao,partes_ativas,partes_passivas,recorrente,recorrencia_tipo,recorrencia_intervalo,recorrencia_fim,recorrencia_rrule,processo:processos!tarefas_processo_id_fkey(id,numero,assunto,cliente_id,coordenacao_id),responsavel:profiles!tarefas_responsavel_id_fkey(id,nome)" as const;
      const TAREFAS_SELECT_BASE =
        "id,titulo,descricao,data_vencimento,data_fatal,data_prevista,data_cumprimento,tipo_tarefa,status,prioridade,observacoes,origem,created_at,updated_at,processo_id,coordenacao_id,responsavel_id,criado_por,identificador_projuris,hora_fatal,hora_prevista,data_base,prazo_dias,prazo_unidade,link_local,orgao,partes_ativas,partes_passivas,recorrente,recorrencia_tipo,recorrencia_intervalo,recorrencia_fim,recorrencia_rrule" as const;

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
      if (incluirEventos && incluirEventosPorTipo) {
        let queryEventos = buildEventosQuery(true);

        if (!filters.fetchAll && !hasCoordScope) {
          // Quando há filtro de membros (coordenação/pessoas), precisamos buscar eventos
          // onde esses usuários são criadores OU participantes (senão o coordenador não enxerga
          // eventos delegados aos membros, como parcelamentos criados pelo admin).
          const targetUserIds =
            filters.responsavelIds && filters.responsavelIds.length > 0 ? filters.responsavelIds : [user.id];

          const { data: participacoesUsuarios } = await supabase
            .from("participantes_evento")
            .select("evento_id")
            .in("usuario_id", targetUserIds);

          const eventosParticipante = participacoesUsuarios?.map((p) => p.evento_id) || [];

          const orParts: string[] = [];
          if (targetUserIds.length > 0) orParts.push(`criado_por.in.(${targetUserIds.join(",")})`);
          if (eventosParticipante.length > 0) orParts.push(`id.in.(${eventosParticipante.join(",")})`);

          if (orParts.length > 0) {
            queryEventos = queryEventos.or(orParts.join(","));
          } else {
            // fallback defensivo
            queryEventos = queryEventos.eq("criado_por", user.id);
          }
        }

        if (filters.tipos && filters.tipos.length > 0) {
          const tiposEvento = filters.tipos.filter((t) => eventTypeFilters.includes(t));
          if (tiposEvento.length > 0) {
            queryEventos = queryEventos.in("tipo", tiposEvento);
          }
        }

        if (filters.status && filters.status !== "todas") {
          queryEventos = queryEventos.eq("status", filters.status === "pendente" ? "pendente" : filters.status);
        }

        if (filters.dataInicio) {
          // Eventos recorrentes que começaram antes da janela precisam ser incluídos
          // para que a expansão de ocorrências no cliente cubra o intervalo pedido.
          const diIso = filters.dataInicio.toISOString();
          queryEventos = queryEventos.or(
            `data_inicio.gte.${diIso},recorrente.eq.true,recorrencia_tipo.not.is.null`
          );
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
          if (!filters.fetchAll && !hasCoordScope) {
            const targetUserIds =
              filters.responsavelIds && filters.responsavelIds.length > 0 ? filters.responsavelIds : [user.id];

            const { data: participacoesUsuarios } = await supabase
              .from("participantes_evento")
              .select("evento_id")
              .in("usuario_id", targetUserIds);

            const eventosParticipante = participacoesUsuarios?.map((p) => p.evento_id) || [];

            const orParts: string[] = [];
            if (targetUserIds.length > 0) orParts.push(`criado_por.in.(${targetUserIds.join(",")})`);
            if (eventosParticipante.length > 0) orParts.push(`id.in.(${eventosParticipante.join(",")})`);

            if (orParts.length > 0) {
              queryEventosFallback = queryEventosFallback.or(orParts.join(","));
            } else {
              queryEventosFallback = queryEventosFallback.eq("criado_por", user.id);
            }
          }
          if (filters.tipos && filters.tipos.length > 0) {
            const tiposEvento = filters.tipos.filter((t) => eventTypeFilters.includes(t));
            if (tiposEvento.length > 0) {
              queryEventosFallback = queryEventosFallback.in("tipo", tiposEvento);
            }
          }
          if (filters.status && filters.status !== "todas") {
            queryEventosFallback = queryEventosFallback.eq("status", filters.status === "pendente" ? "pendente" : filters.status);
          }
          if (filters.dataInicio) {
            const diIso = filters.dataInicio.toISOString();
            queryEventosFallback = queryEventosFallback.or(
              `data_inicio.gte.${diIso},recorrente.eq.true,recorrencia_tipo.not.is.null`
            );
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
          const { data: participanteRows } = await supabase
            .from("participantes_evento")
            .select("evento_id, usuario_id")
            .in("evento_id", eventIds);

          const eventProcessCoordIds = new Map<string, string[]>();
          if (hasCoordScope) {
            const { data: eventoProcessosRows } = await (supabase as any)
              .from("evento_processos")
              .select("evento_id, processo:processos(coordenacao_id)")
              .in("evento_id", eventIds);

            (eventoProcessosRows || []).forEach((row: any) => {
              const coordId = row?.processo?.coordenacao_id;
              if (!row?.evento_id || !coordId) return;
              const current = eventProcessCoordIds.get(row.evento_id) || [];
              current.push(coordId);
              eventProcessCoordIds.set(row.evento_id, current);
            });
          }

          const participantUserIds = Array.from(
            new Set((participanteRows || []).map((p: any) => p.usuario_id).filter(Boolean))
          );

          const profilesById = new Map<string, { id: string; nome: string }>();
          if (participantUserIds.length > 0) {
            const { data: participantesUsuarios } = await supabase
              .from("profiles")
              .select("id, nome")
              .in("id", participantUserIds);
            (participantesUsuarios || []).forEach((u: any) => {
              if (u?.id) profilesById.set(u.id, { id: u.id, nome: u.nome });
            });
          }

          const participantes = (participanteRows || []).map((p: any) => ({
            ...p,
            usuario: profilesById.get(p.usuario_id),
          }));

          let eventosFiltered = eventos;
          if (!hasCoordScope && filters.responsavelIds && filters.responsavelIds.length > 0) {
            eventosFiltered = eventos.filter((evento: any) => {
              const eventParticipants = participantes?.filter((p) => p.evento_id === evento.id) || [];
              const participantIds = eventParticipants.map((p) => p.usuario_id);
              return (
                filters.responsavelIds!.includes(evento.criado_por) ||
                participantIds.some((id) => filters.responsavelIds!.includes(id))
              );
            });
          }

          if (hasCoordScope) {
            eventosFiltered = eventosFiltered.filter((evento: any) => {
              const direct = (evento as any).coordenacao_id;
              if (direct) return coordScopeIds.includes(direct);
              const procCoord = evento.processo && (evento.processo as { coordenacao_id?: string | null }).coordenacao_id;
              if (procCoord) return coordScopeIds.includes(procCoord);
              const linkedCoords = eventProcessCoordIds.get(evento.id) || [];
              if (linkedCoords.some((coordId) => coordScopeIds.includes(coordId))) return true;
              if (filters.strictCoordenacaoIsolation) return false;
              if (filters.responsavelIds && filters.responsavelIds.length > 0) {
                const eventParticipants = participantes?.filter((p) => p.evento_id === evento.id) || [];
                const participantIds = eventParticipants.map((p) => p.usuario_id);
                return (
                  filters.responsavelIds.includes(evento.criado_por) ||
                  participantIds.some((id) => filters.responsavelIds!.includes(id))
                );
              }
              return false;
            });
          }

          for (const evento of eventosFiltered) {
            // Datas efetivas para o evento: original + expansão de recorrência
            const parcelamentoOuGrupo = !!(evento as any).grupo_parcelas;
            // Tolera casos legados em que a coluna `recorrente` não foi marcada,
            // mas `recorrencia_tipo` está preenchido.
            const isRecorrente = !!evento.recorrencia_tipo && !parcelamentoOuGrupo;
            const dataOriginal = parseISO(evento.data_inicio);
            const dataFimEvento = evento.data_fim ? parseISO(evento.data_fim) : null;
            const duracaoMs = dataFimEvento ? dataFimEvento.getTime() - dataOriginal.getTime() : 0;

            const windowStart = filters.dataInicio ?? new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const windowEnd =
              filters.dataFim ?? new Date(today.getFullYear(), today.getMonth() + 3, 0, 23, 59, 59);
            const recorrenciaFim = evento.recorrencia_fim
              ? String(evento.recorrencia_fim).length <= 10
                ? endOfDay(parseISO(evento.recorrencia_fim))
                : parseISO(evento.recorrencia_fim)
              : null;
            const hardStop = recorrenciaFim && recorrenciaFim < windowEnd ? recorrenciaFim : windowEnd;

            const ocorrencias: Date[] = [];
            if (!isRecorrente) {
              ocorrencias.push(dataOriginal);
            } else {
              const tipo = normalizeRecorrenciaTipo(evento.recorrencia_tipo);
              const intervalo = Math.max(1, Number(evento.recorrencia_intervalo || 1));
              const diasSemana: number[] | null = Array.isArray(evento.recorrencia_dias_semana)
                ? evento.recorrencia_dias_semana
                : null;

              let cursor = new Date(dataOriginal);
              let safety = 0;
              const MAX = 500;
              while (cursor <= hardStop && safety < MAX) {
                safety++;
                if (cursor >= windowStart) {
                  if (tipo === "weekly" && diasSemana && diasSemana.length > 0) {
                    // expandir os dias marcados dentro da semana do cursor
                    for (const d of diasSemana) {
                      const diff = ((d - cursor.getDay()) + 7) % 7;
                      const occ = addDays(cursor, diff);
                      if (occ >= windowStart && occ <= hardStop) ocorrencias.push(occ);
                    }
                  } else {
                    if (tipo === "weekdays") {
                      const dow = cursor.getDay();
                      if (dow !== 0 && dow !== 6) ocorrencias.push(new Date(cursor));
                    } else {
                      ocorrencias.push(new Date(cursor));
                    }
                  }
                }
                // avança conforme a frequência
                if (tipo === "daily") cursor = addDays(cursor, intervalo);
                else if (tipo === "weekdays") {
                  // Avança 1 dia por vez até cair em dia útil (Seg–Sex)
                  do {
                    cursor = addDays(cursor, 1);
                  } while (cursor.getDay() === 0 || cursor.getDay() === 6);
                }
                else if (tipo === "weekly") cursor = addDays(cursor, 7 * intervalo);
                else if (tipo === "monthly") cursor = addMonths(cursor, intervalo);
                else if (tipo === "yearly") cursor = addYears(cursor, intervalo);
                else break;
              }

              // garantir a data original mesmo se antes da janela ficaria sem exibição
              if (ocorrencias.length === 0 && dataOriginal >= windowStart && dataOriginal <= hardStop) {
                ocorrencias.push(dataOriginal);
              }
            }

            for (const occ of ocorrencias) {
              const occIso = occ.toISOString();
              const occId = isRecorrente ? `${evento.id}::${occIso.slice(0, 10)}` : evento.id;
              if (seenIds.has(occId)) continue;
              seenIds.add(occId);

              const diasRestantes = differenceInDays(startOfDay(occ), today);
              const isAtrasado = diasRestantes < 0 && evento.status !== "concluido";
              const dataFimOcc = duracaoMs > 0 ? new Date(occ.getTime() + duracaoMs).toISOString() : evento.data_fim;

              resultItems.push({
                id: occId,
                titulo: evento.titulo,
                descricao: evento.descricao,
                tipo: evento.tipo,
                origem: "evento",
                data_inicio: occIso,
                data_fim: dataFimOcc,
                dia_inteiro: evento.dia_inteiro || false,
                local: evento.local,
                recorrente: evento.recorrente || false,
                recorrencia_tipo: evento.recorrencia_tipo,
                recorrencia_pai_id: isRecorrente ? evento.id : null,
                status: evento.status,
                concluido_em: evento.concluido_em,
                created_at: evento.created_at,
                updated_at: evento.updated_at,
                processo_id: evento.processo_id,
                coordenacao_id: (evento as any).coordenacao_id ?? null,
                processo: evento.processo,
                participantes: participantes?.filter((p) => p.evento_id === evento.id) || [],
                enviar_whatsapp: evento.enviar_whatsapp,
                total_parcelas: evento.total_parcelas,
                grupo_parcelas: (evento as any).grupo_parcelas ?? null,
                numero_parcela: (evento as any).numero_parcela ?? null,
                valor_parcela: (evento as any).valor_parcela ?? null,
                criado_por: evento.criado_por,
                dias_restantes: diasRestantes,
                is_atrasado: isAtrasado,
              });
            }
          }
        }
      }

      // ========= BUSCAR TAREFAS =========
      if (incluirTarefas && incluirTarefasPorTipo) {
        let queryTarefas = buildTarefasQuery(true);

        // Tarefas onde o(s) usuário(s) alvo aparecem em tarefa_responsaveis
        // (multi-responsáveis): sem isso, prazos com mais de um responsável só
        // apareciam para o responsável "principal" (tarefas.responsavel_id).
        const targetTaskUserIds =
          filters.responsavelIds && filters.responsavelIds.length > 0 ? filters.responsavelIds : [user.id];
        let tarefaIdsPorResponsavel: string[] = [];
        if (!filters.fetchAll && coordScopeIds.length === 0) {
          // IMPORTANTE: restringir ao período exibido. Sem isso a lista de ids
          // podia chegar a milhares e a URL do filtro `or(...)` estourava o
          // limite do servidor, fazendo a consulta falhar e "sumir tudo".
          let vinculosQuery = supabase
            .from("tarefa_responsaveis")
            .select("tarefa_id, tarefas!inner(data_vencimento)")
            .in("usuario_id", targetTaskUserIds);
          if (filters.dataInicio) {
            const di = filters.dataInicio;
            vinculosQuery = vinculosQuery.gte(
              "tarefas.data_vencimento",
              `${di.getFullYear()}-${String(di.getMonth() + 1).padStart(2, "0")}-${String(di.getDate()).padStart(2, "0")}`,
            );
          }
          if (filters.dataFim) {
            const df = filters.dataFim;
            vinculosQuery = vinculosQuery.lte(
              "tarefas.data_vencimento",
              `${df.getFullYear()}-${String(df.getMonth() + 1).padStart(2, "0")}-${String(df.getDate()).padStart(2, "0")}`,
            );
          }
          const { data: vinculos } = await vinculosQuery.limit(2000);
          tarefaIdsPorResponsavel = Array.from(
            new Set((vinculos || []).map((v: any) => v.tarefa_id).filter(Boolean))
          ).slice(0, 400);
        }
        const buildTarefasOr = (ids: string) => {
          const parts = [`responsavel_id.in.(${ids})`, `criado_por.in.(${ids})`];
          if (tarefaIdsPorResponsavel.length > 0) {
            parts.push(`id.in.(${tarefaIdsPorResponsavel.join(",")})`);
          }
          return parts.join(",");
        };

        if (filters.fetchAll) {
          // Admin vendo todas - sem filtro
        } else if (coordScopeIds.length > 0) {
          // Coordenador: vê todas as tarefas da(s) coordenação(ões), independente de criador/responsável.
          // Usa o campo tarefas.coordenacao_id (sincronizado por trigger), assim tarefas sem processo
          // também aparecem no escopo da coordenação.
          queryTarefas = queryTarefas.in("coordenacao_id", coordScopeIds);
        } else if (filters.responsavelIds && filters.responsavelIds.length > 0) {
          // Tarefas onde o usuário (ou qualquer membro filtrado) é responsável
          // principal, co-responsável ou criador.
          queryTarefas = queryTarefas.or(buildTarefasOr(filters.responsavelIds.join(",")));
        } else {
          // Usuário comum vendo apenas suas próprias tarefas
          queryTarefas = queryTarefas.or(buildTarefasOr(user.id));
        }

        if (filters.status && filters.status !== "todas") {
          if (filters.status === "pendente") {
            queryTarefas = queryTarefas.eq("status", "pendente");
          } else if (filters.status === "concluido") {
            queryTarefas = queryTarefas.eq("status", "cumprido");
          }
        }

        if (filters.dataInicio) {
          const di = filters.dataInicio;
          const diStr = `${di.getFullYear()}-${String(di.getMonth() + 1).padStart(2, "0")}-${String(di.getDate()).padStart(2, "0")}`;
          queryTarefas = queryTarefas.gte("data_vencimento", diStr);
        }

        if (filters.dataFim) {
          const df = filters.dataFim;
          const dfStr = `${df.getFullYear()}-${String(df.getMonth() + 1).padStart(2, "0")}-${String(df.getDate()).padStart(2, "0")}`;
          queryTarefas = queryTarefas.lte("data_vencimento", dfStr);
        }

        // Ordenar por data_vencimento para que os registros mais próximos cheguem primeiro
        queryTarefas = queryTarefas.order("data_vencimento", { ascending: true, nullsFirst: false });

        // Apply range for pagination
        queryTarefas = queryTarefas.range(from, to);

        let { data: tarefas, error: tarefasError } = await queryTarefas;

        if (tarefasError) {
          console.error("Erro ao buscar tarefas:", tarefasError);
          let queryTarefasFallback = buildTarefasQuery(false);
          let shouldRunFallbackQuery = true;

          if (filters.fetchAll) {
            // sem filtro
          } else if (coordScopeIds.length > 0) {
            // Fallback sem join: filtrar por processos da(s) coordenação(ões)
            const { data: processosCoord } = await supabase
              .from("processos")
              .select("id")
              .in("coordenacao_id", coordScopeIds);

            const processoIds = (processosCoord || []).map((p: { id: string }) => p.id);

            if (processoIds.length === 0) {
              shouldRunFallbackQuery = false;
              tarefas = [];
              tarefasError = null;
            } else {
              queryTarefasFallback = queryTarefasFallback.in("processo_id", processoIds);
            }
          } else if (filters.responsavelIds && filters.responsavelIds.length > 0) {
            queryTarefasFallback = queryTarefasFallback.or(buildTarefasOr(filters.responsavelIds.join(",")));
          } else {
            queryTarefasFallback = queryTarefasFallback.or(buildTarefasOr(user.id));
          }

          if (shouldRunFallbackQuery) {
            if (filters.status && filters.status !== "todas") {
              if (filters.status === "pendente") {
                queryTarefasFallback = queryTarefasFallback.eq("status", "pendente");
              } else if (filters.status === "concluido") {
                queryTarefasFallback = queryTarefasFallback.eq("status", "cumprido");
              }
            }
            if (filters.dataInicio) {
              const di = filters.dataInicio;
              const diStr = `${di.getFullYear()}-${String(di.getMonth() + 1).padStart(2, "0")}-${String(di.getDate()).padStart(2, "0")}`;
              queryTarefasFallback = queryTarefasFallback.gte("data_vencimento", diStr);
            }
            if (filters.dataFim) {
              const df = filters.dataFim;
              const dfStr = `${df.getFullYear()}-${String(df.getMonth() + 1).padStart(2, "0")}-${String(df.getDate()).padStart(2, "0")}`;
              queryTarefasFallback = queryTarefasFallback.lte("data_vencimento", dfStr);
            }
            queryTarefasFallback = queryTarefasFallback.range(from, to);
            const fallbackRes = await queryTarefasFallback;
            tarefas = fallbackRes.data;
            tarefasError = fallbackRes.error;
          }
        }

        if (!tarefasError && tarefas) {
          const incluirTipoTarefa = !filters.tipos || filters.tipos.length === 0 || filters.tipos.some((t) => taskTypeFilters.includes(t));

          if (incluirTipoTarefa) {
            let tarefasFiltradas = tarefas;
            if (filters.tipos && filters.tipos.length > 0) {
              tarefasFiltradas = tarefasFiltradas.filter((t: any) => {
                const tipoUpper = (t.tipo_tarefa ?? "").toUpperCase().trim();
                const isAudiencia = tipoUpper === "AUDIÊNCIA" || tipoUpper === "AUDIENCIA";
                const isPrazo = tipoUpper === "PRAZO";
                const isEventoLegacy = tipoUpper === "EVENTO";
                const isParcelamentoLegacy = tipoUpper === "PARCELAMENTO" || tipoUpper === "PARCELAMENTO_RECORRENTE";
                const isTarefa = !isAudiencia && !isPrazo && !isEventoLegacy && !isParcelamentoLegacy;
                return (
                  (filters.tipos!.includes("audiencia") && isAudiencia) ||
                  (filters.tipos!.includes("prazo") && isPrazo) ||
                  (filters.tipos!.includes("evento") && isEventoLegacy) ||
                  (filters.tipos!.includes("parcelamento") && isParcelamentoLegacy) ||
                  ((filters.tipos!.includes("tarefa") || filters.tipos!.includes("tarefa_delegada")) && isTarefa)
                );
              });
            }
            if (filters.clienteId) {
              tarefasFiltradas = tarefasFiltradas.filter(
                (t: any) => t.processo && (t.processo as { cliente_id?: string }).cliente_id === filters.clienteId
              );
            }
            if (coordScopeIds.length > 0) {
              tarefasFiltradas = tarefasFiltradas.filter((t: any) => {
                const direct = (t as any).coordenacao_id;
                if (direct) return coordScopeIds.includes(direct);
                const procCoord = t.processo && (t.processo as { coordenacao_id?: string | null }).coordenacao_id;
                if (procCoord) return coordScopeIds.includes(procCoord);
                if (filters.strictCoordenacaoIsolation) return false;
                if (filters.responsavelIds && filters.responsavelIds.length > 0) {
                  return filters.responsavelIds.includes(t.responsavel_id);
                }
                return false;
              });
            }

            // Buscar criadores separadamente (sem FK no banco)
            const criadorIds = [...new Set(tarefasFiltradas.map((t: any) => t.criado_por as string).filter(Boolean))] as string[];

            // Buscar todos os responsáveis (multi-responsáveis) das tarefas exibidas
            const respMap: Record<string, string[]> = {};
            const tarefaIdsExibidas = tarefasFiltradas.map((t: any) => t.id as string);
            if (tarefaIdsExibidas.length > 0) {
              const { data: respRows } = await supabase
                .from("tarefa_responsaveis")
                .select("tarefa_id, usuario_id")
                .in("tarefa_id", tarefaIdsExibidas);
              (respRows || []).forEach((r: any) => {
                if (!r?.tarefa_id || !r?.usuario_id) return;
                (respMap[r.tarefa_id] ||= []).push(r.usuario_id);
              });
            }
            let criadoresMap: Record<string, { id: string; nome: string }> = {};
            if (criadorIds.length > 0) {
              const { data: criadores } = await supabase
                .from("profiles")
                .select("id,nome")
                .in("id", criadorIds);
              if (criadores) {
                criadoresMap = Object.fromEntries(criadores.map(c => [c.id, c]));
              }
            }

            for (const tarefa of tarefasFiltradas) {
              const dataBaseISO: string | null = tarefa.data_vencimento ?? tarefa.data_fatal ?? tarefa.created_at ?? null;
              if (!dataBaseISO) continue;

              const dataBase = parseISO(dataBaseISO);
              const statusUnificado = tarefa.status === "cumprido" ? "concluido" : tarefa.status;
              const tipoTarefaUpper = (tarefa.tipo_tarefa ?? "").toUpperCase().trim();
              // No modo fetchAll (admin/escritório), não classificar como "delegada" — o tipo vem do banco.
              // No modo pessoal, tarefas criadas por outros são "delegadas".
              const tipoTarefa = tipoTarefaUpper === "AUDIÊNCIA" || tipoTarefaUpper === "AUDIENCIA"
                ? "audiencia"
                : tipoTarefaUpper === "EVENTO"
                ? "evento"
                : tipoTarefaUpper === "PRAZO"
                ? "prazo"
                : (!filters.fetchAll && tarefa.criado_por !== user.id && tarefa.responsavel_id === user.id)
                ? "tarefa_delegada"
                : "tarefa";

              // Expansão de recorrência para tarefas/prazos
              const isRecorrenteT = !!(tarefa as any).recorrencia_tipo;
              const windowStartT = filters.dataInicio ?? new Date(today.getFullYear(), today.getMonth() - 1, 1);
              const windowEndT =
                filters.dataFim ?? new Date(today.getFullYear(), today.getMonth() + 3, 0, 23, 59, 59);
              const recorrenciaFimT = (tarefa as any).recorrencia_fim
                ? endOfDay(parseISO(String((tarefa as any).recorrencia_fim)))
                : null;
              const hardStopT = recorrenciaFimT && recorrenciaFimT < windowEndT ? recorrenciaFimT : windowEndT;

              const ocorrenciasT: Date[] = [];
              if (!isRecorrenteT) {
                ocorrenciasT.push(dataBase);
              } else {
                const tipo = normalizeRecorrenciaTipo((tarefa as any).recorrencia_tipo);
                const intervalo = Math.max(1, Number((tarefa as any).recorrencia_intervalo || 1));
                let cursor = new Date(dataBase);
                let safety = 0;
                const MAX = 500;
                while (cursor <= hardStopT && safety < MAX) {
                  safety++;
                  if (cursor >= windowStartT) {
                    if (tipo === "weekdays") {
                      const dow = cursor.getDay();
                      if (dow !== 0 && dow !== 6) ocorrenciasT.push(new Date(cursor));
                    } else {
                      ocorrenciasT.push(new Date(cursor));
                    }
                  }
                  if (tipo === "daily") cursor = addDays(cursor, intervalo);
                  else if (tipo === "weekdays") {
                    do { cursor = addDays(cursor, 1); } while (cursor.getDay() === 0 || cursor.getDay() === 6);
                  } else if (tipo === "weekly") cursor = addDays(cursor, 7 * intervalo);
                  else if (tipo === "monthly") cursor = addMonths(cursor, intervalo);
                  else if (tipo === "yearly") cursor = addYears(cursor, intervalo);
                  else break;
                }
                if (ocorrenciasT.length === 0 && dataBase >= windowStartT && dataBase <= hardStopT) {
                  ocorrenciasT.push(dataBase);
                }
              }

              for (const occ of ocorrenciasT) {
                const occIso = occ.toISOString();
                const occId = isRecorrenteT ? `${tarefa.id}::${occIso.slice(0, 10)}` : tarefa.id;
                if (seenIds.has(occId)) continue;
                seenIds.add(occId);
                const diasRestantes = differenceInDays(startOfDay(occ), today);
                const isAtrasado = diasRestantes < 0 && tarefa.status === "pendente";

                resultItems.push({
                  id: occId,
                  titulo: tarefa.titulo,
                  descricao: tarefa.descricao,
                  tipo: tipoTarefa,
                  origem: "tarefa",
                  data_inicio: `${format(occ, "yyyy-MM-dd")}T00:00:00`,
                  data_fim: null,
                  dia_inteiro: true,
                  local: null,
                  recorrente: !!(tarefa as any).recorrente || isRecorrenteT,
                  recorrencia_tipo: (tarefa as any).recorrencia_tipo ?? null,
                  recorrencia_pai_id: isRecorrenteT ? tarefa.id : null,
                  tarefa_pai_id: isRecorrenteT ? tarefa.id : null,
                  status: statusUnificado,
                  prioridade: tarefa.prioridade,
                  concluido_em: tarefa.status === "cumprido" ? tarefa.updated_at : null,
                  created_at: tarefa.created_at,
                  updated_at: tarefa.updated_at,
                  processo_id: tarefa.processo_id,
                  coordenacao_id: tarefa.coordenacao_id,
                  processo: tarefa.processo
                    ? {
                        id: tarefa.processo.id,
                        numero: tarefa.processo.numero,
                        assunto: tarefa.processo.assunto,
                        cliente_id: (tarefa.processo as { cliente_id?: string }).cliente_id,
                      }
                    : null,
                  responsavel_id: tarefa.responsavel_id,
                  responsaveis_ids: Array.from(
                    new Set([...(respMap[tarefa.id] || []), ...(tarefa.responsavel_id ? [tarefa.responsavel_id] : [])])
                  ),
                  responsavel: tarefa.responsavel,
                  criado_por: tarefa.criado_por,
                  criador: tarefa.criado_por ? criadoresMap[tarefa.criado_por] || null : null,
                  dias_restantes: diasRestantes,
                  is_atrasado: isAtrasado,
                  tipo_tarefa: tarefa.tipo_tarefa,
                  data_vencimento: tarefa.data_vencimento,
                  data_fatal: tarefa.data_fatal,
                  data_prevista: (tarefa as any).data_prevista ?? null,
                  data_cumprimento: (tarefa as any).data_cumprimento ?? null,
                  origem_importacao: (tarefa as any).origem ?? null,
                });
              }
            }
          }
        }
      }

      // ========= BUSCAR PRAZOS FATAIS TST (processos com data_fatal) =========
      {
        let queryPrazos = supabase
          .from("processos")
          .select("id, numero, polo_ativo, polo_passivo, data_fatal, coordenacao_id, criado_por_tst, responsavel_tst_id, responsavel_tst, equipe_tst, decisao_tst, status, prazo_fatal_conferido")
          .not("data_fatal", "is", null);

        if (!filters.fetchAll) {
          // Filter: user is creator OR responsible
          queryPrazos = queryPrazos.or(`criado_por_tst.eq.${user.id},responsavel_tst_id.eq.${user.id}`);
        }

        if (filters.dataInicio) {
          const di = filters.dataInicio;
          const diStr = `${di.getFullYear()}-${String(di.getMonth() + 1).padStart(2, "0")}-${String(di.getDate()).padStart(2, "0")}`;
          queryPrazos = queryPrazos.gte("data_fatal", diStr);
        }

        if (filters.dataFim) {
          const df = filters.dataFim;
          const dfStr = `${df.getFullYear()}-${String(df.getMonth() + 1).padStart(2, "0")}-${String(df.getDate()).padStart(2, "0")}`;
          queryPrazos = queryPrazos.lte("data_fatal", dfStr);
        }

        if (filters.coordenacaoId) {
          queryPrazos = queryPrazos.eq("coordenacao_id", filters.coordenacaoId);
        }

        queryPrazos = queryPrazos.order("data_fatal", { ascending: true }).range(from, to);

        const { data: prazosTst, error: prazosError } = await queryPrazos;

        if (!prazosError && prazosTst) {
          // Fetch responsável names
          const respIds = [...new Set(prazosTst.map((p: any) => p.responsavel_tst_id).filter(Boolean))] as string[];
          const criadorIds = [...new Set(prazosTst.map((p: any) => p.criado_por_tst).filter(Boolean))] as string[];
          const allUserIds = [...new Set([...respIds, ...criadorIds])];
          let usersMap: Record<string, { id: string; nome: string }> = {};
          if (allUserIds.length > 0) {
            const { data: users } = await supabase.from("profiles").select("id,nome").in("id", allUserIds);
            if (users) usersMap = Object.fromEntries(users.map(u => [u.id, u]));
          }

          for (const prazo of prazosTst) {
            const prazoId = `prazo-tst-${prazo.id}`;
            if (seenIds.has(prazoId)) continue;
            seenIds.add(prazoId);

            const dataBase = parseISO(prazo.data_fatal!);
            const diasRestantes = differenceInDays(startOfDay(dataBase), today);
            const isAtrasado = diasRestantes < 0;
            const isConferido = !!(prazo as any).prazo_fatal_conferido;

            resultItems.push({
              id: prazoId,
              titulo: `[PRAZO FATAL] ${prazo.numero}`,
              descricao: prazo.decisao_tst || `Prazo fatal para processo ${prazo.numero}`,
              tipo: "prazo",
              origem: "evento" as const,
              data_inicio: `${prazo.data_fatal}T00:00:00`,
              data_fim: null,
              dia_inteiro: true,
              local: null,
              recorrente: false,
              recorrencia_tipo: null,
              status: isConferido ? "cumprido" : (isAtrasado ? "atrasado" : "pendente"),
              concluido_em: null,
              created_at: prazo.data_fatal! + "T00:00:00",
              updated_at: prazo.data_fatal! + "T00:00:00",
              processo_id: prazo.id,
              processo: { id: prazo.id, numero: prazo.numero },
              responsavel_id: prazo.responsavel_tst_id,
              responsavel: prazo.responsavel_tst_id ? usersMap[prazo.responsavel_tst_id] || null : null,
              criado_por: prazo.criado_por_tst,
              criador: prazo.criado_por_tst ? usersMap[prazo.criado_por_tst] || null : null,
              dias_restantes: diasRestantes,
              is_atrasado: isAtrasado,
            });
          }
        }
      }

      // ========= ORDENAR RESULTADOS =========
      // ========= BUSCAR AUDIÊNCIAS DETECTADAS (manuais e DJEN) =========
      const incluirAudiencias =
        (!filters.tipos || filters.tipos.length === 0 || filters.tipos.includes("audiencia")) &&
        (!filters.origens || filters.origens.includes("evento") || filters.origens.includes("tarefa"));

      if (incluirAudiencias) {
        let queryAud = supabase
          .from("audiencias_detectadas")
          .select(
            "id, titulo, tipo_audiencia, processo_id, processo_numero, data_audiencia, hora, hora_fim, status, observacoes, local_audiencia, forum, sala_forum, modalidade, criado_por, coordenacao_id, created_at, updated_at"
          )
          .not("data_audiencia", "is", null);

        // Se há filtro de coordenação (admin escolheu uma coord específica), usa-o
        // como escopo — inclui audiências importadas via pauta Excel que não têm
        // o admin como criador/advogado.
        const coordScopeIdsAud = filters.coordenacaoIds?.length
          ? filters.coordenacaoIds
          : filters.coordenacaoId
            ? [filters.coordenacaoId]
            : null;

        if (coordScopeIdsAud) {
          queryAud = queryAud.in("coordenacao_id", coordScopeIdsAud);
        } else if (!filters.fetchAll) {
          const targetUserIds =
            filters.responsavelIds && filters.responsavelIds.length > 0 ? filters.responsavelIds : [user.id];

          const { data: audAdvs } = await supabase
            .from("audiencias_advogados")
            .select("audiencia_id")
            .in("advogado_id", targetUserIds);
          const { data: audEnv } = await supabase
            .from("audiencia_envolvidos")
            .select("audiencia_id")
            .in("usuario_id", targetUserIds);

          const audIds = [
            ...new Set([
              ...(audAdvs ?? []).map((a: any) => a.audiencia_id),
              ...(audEnv ?? []).map((a: any) => a.audiencia_id),
            ]),
          ];

          const orParts: string[] = [];
          // Importante: audiências vindas de cargas em massa (planilhas/pauta) têm o
          // usuário que fez o upload como "criado_por". No modo pessoal isso fazia o
          // admin ver milhares de audiências que não são dele. Só contam como pessoais
          // as audiências criadas manualmente (ou por vínculo real de advogado/envolvido).
          if (targetUserIds.length > 0) {
            orParts.push(
              `and(criado_por.in.(${targetUserIds.join(",")}),or(origem.is.null,origem.not.in.(importacao,pauta_excel)))`
            );
          }
          if (audIds.length > 0) orParts.push(`id.in.(${audIds.join(",")})`);

          if (orParts.length > 0) {
            queryAud = queryAud.or(orParts.join(","));
          } else {
            queryAud = queryAud.eq("criado_por", user.id);
          }
        }

        if (filters.dataInicio) {
          queryAud = queryAud.gte("data_audiencia", filters.dataInicio.toISOString());
        }
        if (filters.dataFim) {
          queryAud = queryAud.lte("data_audiencia", filters.dataFim.toISOString());
        }

        queryAud = queryAud.range(from, to);

        const { data: audiencias, error: audError } = await queryAud;

        if (!audError && audiencias) {
          for (const aud of audiencias as any[]) {
            const audKey = `audiencia-det-${aud.id}`;
            if (seenIds.has(audKey)) continue;
            seenIds.add(audKey);

            const dataISO: string = aud.data_audiencia;
            const dataInicioAud = dataInicioAudiencia(dataISO, aud) ?? dataISO;
            const dataBase = parseISO(dataISO);
            const diasRestantes = differenceInDays(startOfDay(dataBase), today);
            const statusUnificado =
              aud.status === "cumprido" || aud.status === "concluido"
                ? "concluido"
                : aud.status || "pendente";
            const isAtrasado = diasRestantes < 0 && statusUnificado === "pendente";

            resultItems.push({
              id: audKey,
              titulo: aud.titulo || aud.tipo_audiencia || `Audiência ${aud.processo_numero ?? ""}`.trim(),
              descricao: aud.observacoes ?? null,
              tipo: "audiencia",
              origem: "evento",
              data_inicio: dataInicioAud,
              data_fim: null,
              dia_inteiro: !aud.hora,
              hora_prevista: aud.hora ?? null,
              local: aud.local_audiencia || aud.forum || null,
              recorrente: false,
              recorrencia_tipo: null,
              status: statusUnificado,
              concluido_em: null,
              created_at: aud.created_at,
              updated_at: aud.updated_at,
              processo_id: aud.processo_id ?? null,
              processo: aud.processo_numero
                ? { id: aud.processo_id ?? aud.id, numero: aud.processo_numero }
                : null,
              criado_por: aud.criado_por,
              coordenacao_id: aud.coordenacao_id ?? null,
              dias_restantes: diasRestantes,
              is_atrasado: isAtrasado,
            });
          }
        }
      }

      // Dedup final (por chave de negócio DJEN) antes de ordenar
      // ========= EXPANDIR PARCELAS (parcelas_evento) =========
      const incluirParcelas =
        !filters.tipos || filters.tipos.length === 0 ||
        filters.tipos.includes("parcelamento") || filters.tipos.includes("prazo_parcela");

      if (incluirParcelas) {
        // Buscar parcelas direto pela data de vencimento (o evento-pai pode
        // estar em outro mês — ex.: parcelamento criado em junho com parcelas
        // que se estendem por julho/agosto).
        let queryParcelas = supabase
          .from("parcelas_evento")
          .select("id, evento_id, numero, data_vencimento, valor, status, observacoes, created_at, updated_at")
          .order("data_vencimento", { ascending: true });

        if (filters.dataInicio) {
          const di = filters.dataInicio;
          const diStr = `${di.getFullYear()}-${String(di.getMonth() + 1).padStart(2, "0")}-${String(di.getDate()).padStart(2, "0")}`;
          queryParcelas = queryParcelas.gte("data_vencimento", diStr);
        }
        if (filters.dataFim) {
          const df = filters.dataFim;
          const dfStr = `${df.getFullYear()}-${String(df.getMonth() + 1).padStart(2, "0")}-${String(df.getDate()).padStart(2, "0")}`;
          queryParcelas = queryParcelas.lte("data_vencimento", dfStr);
        }

        const { data: parcelas } = await queryParcelas;

        if (parcelas && parcelas.length > 0) {
          // Carrega eventos-pai que ainda não estão em resultItems
          const parentMap = new Map(
            resultItems
              .filter((it) => it.tipo === "parcelamento")
              .map((it) => [it.id, it])
          );
          const missingParentIds = [...new Set((parcelas as any[]).map(p => p.evento_id))].filter(id => !parentMap.has(id));
          if (missingParentIds.length > 0) {
            let queryParents = supabase
              .from("eventos_agenda")
              .select("id, titulo, descricao, local, processo_id, criado_por, coordenacao_id, status, processo:processos(id,numero,coordenacao_id)")
              .in("id", missingParentIds);
            const { data: parentsRaw } = await queryParents;
            let parents = (parentsRaw ?? []) as any[];
            const parentProcessCoordIds = new Map<string, string[]>();
            const parentParticipantIds = new Map<string, string[]>();
            if (coordScopeIds.length > 0) {
              const [{ data: parentLinks }, { data: parentParticipants }] = await Promise.all([
                (supabase as any)
                .from("evento_processos")
                .select("evento_id, processo:processos(coordenacao_id)")
                  .in("evento_id", missingParentIds),
                supabase
                  .from("participantes_evento")
                  .select("evento_id, usuario_id")
                  .in("evento_id", missingParentIds),
              ]);
              (parentLinks || []).forEach((row: any) => {
                const coordId = row?.processo?.coordenacao_id;
                if (!row?.evento_id || !coordId) return;
                const current = parentProcessCoordIds.get(row.evento_id) || [];
                current.push(coordId);
                parentProcessCoordIds.set(row.evento_id, current);
              });
              (parentParticipants || []).forEach((row: any) => {
                if (!row?.evento_id || !row?.usuario_id) return;
                const current = parentParticipantIds.get(row.evento_id) || [];
                current.push(row.usuario_id);
                parentParticipantIds.set(row.evento_id, current);
              });
            }
            // Filtro de escopo: se houver coordenação selecionada, prioriza pais dessa
            // coordenação (direto ou via processo). Caso contrário, restringe por
            // criado_por/responsavelIds quando não é fetchAll.
            if (coordScopeIds.length > 0) {
              parents = parents.filter((pe: any) => {
                const linkedCoords = parentProcessCoordIds.get(pe.id) || [];
                return (
                  coordScopeIds.includes(pe.coordenacao_id) ||
                  (pe.processo && coordScopeIds.includes(pe.processo.coordenacao_id)) ||
                  linkedCoords.some((coordId) => coordScopeIds.includes(coordId)) ||
                  (!filters.strictCoordenacaoIsolation &&
                    !!filters.responsavelIds?.length &&
                    (filters.responsavelIds.includes(pe.criado_por) ||
                      (parentParticipantIds.get(pe.id) || []).some((uid) => filters.responsavelIds!.includes(uid))))
                );
              });
            } else if (!filters.fetchAll && filters.responsavelIds && filters.responsavelIds.length > 0) {
              parents = parents.filter((pe: any) => filters.responsavelIds!.includes(pe.criado_por));
            }
            for (const pe of parents) {
              parentMap.set(pe.id, {
                id: pe.id,
                titulo: pe.titulo,
                descricao: pe.descricao,
                tipo: "parcelamento",
                origem: "evento",
                local: pe.local,
                processo_id: pe.processo_id,
                coordenacao_id: pe.coordenacao_id ?? pe.processo?.coordenacao_id ?? null,
                processo: pe.processo ?? null,
                criado_por: pe.criado_por,
                status: pe.status ?? null,
              } as any);
            }
          }

          for (const p of (parcelas ?? []) as any[]) {
            const parent = parentMap.get(p.evento_id);
            if (!parent) continue;
            const pid = `parcela-${p.id}`;
            if (seenIds.has(pid)) continue;
            seenIds.add(pid);

            const dataBase = parseISO(p.data_vencimento);
            const diasRestantes = differenceInDays(startOfDay(dataBase), today);
            const parentStatus = (parent as any).status as string | null | undefined;
            const parentEncerrado =
              parentStatus === "cancelado" ||
              parentStatus === "concluido" ||
              parentStatus === "tratado";
            let statusUnificado = p.status === "pago" ? "concluido" : p.status || "pendente";
            if (parentEncerrado) statusUnificado = parentStatus!;
            const isAtrasado = diasRestantes < 0 && statusUnificado === "pendente";

            resultItems.push({
              id: pid,
              titulo: `Parcela ${p.numero ?? ""} - ${parent.titulo}`.trim(),
              descricao: p.observacoes ?? parent.descricao ?? null,
              tipo: "prazo_parcela",
              origem: "evento",
              data_inicio: `${p.data_vencimento}T00:00:00`,
              data_fim: null,
              dia_inteiro: true,
              local: parent.local ?? null,
              recorrente: false,
              recorrencia_tipo: null,
              status: statusUnificado,
              concluido_em: p.status === "pago" ? p.updated_at : null,
              created_at: p.created_at,
              updated_at: p.updated_at,
              processo_id: parent.processo_id ?? null,
              coordenacao_id: parent.coordenacao_id ?? parent.processo?.coordenacao_id ?? null,
              processo: parent.processo ?? null,
              grupo_parcelas: parent.id,
              numero_parcela: p.numero ?? null,
              valor_parcela: p.valor ?? null,
              criado_por: parent.criado_por,
              dias_restantes: diasRestantes,
              is_atrasado: isAtrasado,
            });
          }
        }
      }


      // ===== Baixa INDIVIDUAL de ocorrências recorrentes =====
      // Itens recorrentes são um único registro no banco. A situação gravada em
      // `ocorrencias_recorrentes_status` vale só para aquela data, sobrepondo a
      // situação da série (que continua no registro-pai).
      const idsRecorrentes = Array.from(
        new Set(
          resultItems
            .filter((i: any) => !!i.recorrencia_pai_id)
            .map((i: any) => String(i.recorrencia_pai_id)),
        ),
      );
      if (idsRecorrentes.length > 0) {
        const { data: baixas } = await supabase
          .from("ocorrencias_recorrentes_status")
          .select("origem, item_id, data_ocorrencia, status, concluido_em")
          .in("item_id", idsRecorrentes);
        if (baixas && baixas.length > 0) {
          const mapa = new Map<string, any>();
          for (const b of baixas as any[]) {
            mapa.set(`${b.origem}:${b.item_id}:${String(b.data_ocorrencia).slice(0, 10)}`, b);
          }
          for (const item of resultItems as any[]) {
            if (!item.recorrencia_pai_id) continue;
            const dia = String(item.id).split("::")[1]?.slice(0, 10)
              ?? String(item.data_inicio ?? "").slice(0, 10);
            const b = mapa.get(`${item.origem}:${item.recorrencia_pai_id}:${dia}`);
            if (!b) continue;
            item.status = b.status;
            item.concluido_em = b.concluido_em ?? null;
            item.baixa_individual = true;
          }
        }
      }

      const dedupedItems: ItemAgendaUnificado[] = [];
      const seenKeys = new Set<string>();
      for (const item of resultItems) {
        const key = getAgendaDedupKey(item);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        dedupedItems.push(item);
      }


      const now = new Date();
      const futureItems = dedupedItems
        .filter((e) => new Date(e.data_inicio) >= now)
        .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
      const pastItems = dedupedItems
        .filter((e) => new Date(e.data_inicio) < now)
        .sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime());

      return [...futureItems, ...pastItems];
}

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
    queryFn: async ({ pageParam }) => fetchAgendaPage(filters, pageParam as number, user?.id),
    enabled: !!user && filters.enabled !== false,
  });
}

/**
 * useAgendaUnificada - wrapper legado que retorna a primeira página (compatibilidade).
 * Para paginação completa, use useAgendaUnificadaPaginated diretamente.
 */
export function useAgendaUnificada(filters: AgendaUnificadaFilters = {}) {
  const infiniteQuery = useAgendaUnificadaPaginated(filters);

  // Flatten all pages and deduplicate by business key (DJEN) / id fallback
  const rawData = infiniteQuery.data?.pages?.flat() ?? [];
  const seen = new Set<string>();
  const data = rawData.filter((item) => {
    const key = getAgendaDedupKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

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
        const tarefaId = String(id).split("::")[0];
        const { error } = await supabase.from("tarefas").update({ status: tarefaStatus, updated_at: new Date().toISOString() }).eq("id", tarefaId);
        if (error) throw error;
        await registrarAuditoriaTarefa({
          acao: "atualizar",
          sucesso: true,
          dadosEntrada: { id: tarefaId, status: tarefaStatus },
          origem: "useAgendaUnificada.useUpdateItemAgenda",
          tarefaId,
          tipoItem: "tarefa",
        });
        // Workflow: concluiu a etapa -> materializa a próxima imediatamente
        const avancou = await sincronizarWorkflowPorItem(tarefaId, tarefaStatus);
        return { avancou };
      } else {
        const { error } = await supabase.from("eventos_agenda").update({ status, concluido_em, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        await registrarAuditoriaTarefa({
          acao: "atualizar",
          sucesso: true,
          dadosEntrada: { id, status, concluido_em },
          origem: "useAgendaUnificada.useUpdateItemAgenda",
          itemId: id,
          tipoItem: "evento",
        });
        const avancou = await sincronizarWorkflowPorItem(id, status);
        return { avancou };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["workflow-execucoes"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-execucao-etapas"] });
      toast.success("Item atualizado com sucesso!");
      if (result?.avancou) toast.success("Próxima etapa do workflow criada!");
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
        await registrarAuditoriaTarefa({
          acao: "deletar",
          sucesso: true,
          dadosEntrada: { id },
          origem: "useAgendaUnificada.useDeleteItemAgenda",
          tarefaId: id,
          tipoItem: "tarefa",
        });
      } else {
        const { error } = await supabase.from("eventos_agenda").delete().eq("id", id);
        if (error) throw error;
        await registrarAuditoriaTarefa({
          acao: "deletar",
          sucesso: true,
          dadosEntrada: { id },
          origem: "useAgendaUnificada.useDeleteItemAgenda",
          itemId: id,
          tipoItem: "evento",
        });
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
