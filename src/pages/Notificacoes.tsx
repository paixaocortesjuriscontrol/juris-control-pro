import { useState, useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Newspaper, 
  Scale, 
  RefreshCw, 
  Radar,
  Eye,
  CheckCheck,
  Filter,
  TrendingUp,
  Building2,
  Settings,
  LayoutDashboard,
  ListTodo,
  Gavel,
  FileWarning,
  Search,
  X,
  CalendarDays,
  FileText,
  Activity,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useNotificacoesCounts, useNotificacoesCountsByCoordenacao, type NotificacoesCounts } from "@/hooks/useNotificacoesCounts";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { useMonitoramentoDistribuicao } from "@/hooks/useMonitoramentoDistribuicao";
import { useMonitoramento360 } from "@/hooks/useMonitoramento360";
import { useRedistribuicoes } from "@/hooks/useRedistribuicoes";
import { formatDistanceToNow, format, isAfter, isBefore, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { DashboardCoordenacoes } from "@/components/notificacoes/DashboardCoordenacoes";
import { CoordenacaoDetalhesView } from "@/components/notificacoes/CoordenacaoDetalhesView";
import { GerarRelatorioPdfDialog } from "@/components/notificacoes/GerarRelatorioPdfDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export default function Notificacoes() {
  // Central de Notificações
  // Mantém a UI responsiva: carregamento incremental (evita payloads gigantes)
  const PAGE_SIZE = 200;

  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  // Padrão: Hoje (comportamento original)
  const [periodoInicio, setPeriodoInicio] = useState<Date | undefined>(() => startOfDay(new Date()));
  const [periodoFim, setPeriodoFim] = useState<Date | undefined>(() => startOfDay(new Date()));
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  
  
  const navigate = useNavigate();

  const clearPeriodo = () => {
    setPeriodoInicio(undefined);
    setPeriodoFim(undefined);
  };

  const setPeriodoHoje = () => {
    const hoje = startOfDay(new Date());
    setPeriodoInicio(hoje);
    setPeriodoFim(hoje);
  };

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const { user } = useAuth();
  const { isAdmin, loading: loadingRole } = useUserRole();

  // Coordenações visíveis (RBAC): admin vê tudo; demais veem apenas onde são membros
  const { data: minhasCoordenacoes = [] } = useQuery({
    queryKey: ["minhas-coordenacoes-notificacoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id);
      if (error) throw error;
      return (data || []).map((m: any) => m.coordenacao_id as string);
    },
    enabled: !!user?.id && !isAdmin,
  });

  const visibleCoordIds = useMemo(() => {
    if (isAdmin) return coordenacoes.map((c) => c.id);
    return minhasCoordenacoes;
  }, [isAdmin, coordenacoes, minhasCoordenacoes]);
  const { 
    notificacoes, 
    naoLidas, 
    marcarComoLida, 
    marcarTodasComoLidas,
    excluirNotificacao 
  } = useNotificacoes();
  
  const { publicacoes, monitoramentos: monitoramentosDjen } = useMonitoramentosDjen();
  const { distribuicoesEncontradas } = useMonitoramentoDistribuicao();
  const { alertas } = useMonitoramento360();
  const { data: redistribuicoesData = [] } = useRedistribuicoes({
    dataInicio: periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined,
    dataFim: periodoFim ? format(periodoFim, "yyyy-MM-dd") : undefined,
  });

  // Counts quando usuário seleciona uma coordenação específica
  const { data: countsSingle = undefined } = useNotificacoesCounts({
    coordenacaoId,
    periodoInicio,
    periodoFim,
    statusFilter,
    prioridadeFilter,
    searchQuery,
  });

  // Counts por coordenação (para somar e garantir que os totalizadores batam com os cards)
  const { data: countsByCoord = undefined } = useNotificacoesCountsByCoordenacao({
    coordenacaoIds: visibleCoordIds,
    periodoInicio,
    periodoFim,
    statusFilter,
    searchQuery,
  });

  const counts: NotificacoesCounts | undefined = useMemo(() => {
    // Se uma coordenação foi selecionada, usar o count específico
    if (coordenacaoId !== "todas") return countsSingle;

    const zero: NotificacoesCounts = {
      djen: 0,
      distribuicoes: 0,
      alertas360: 0,
      redistribuicoes: 0,
      andamentos: 0,
      prazos: 0,
      tarefas: 0,
      audiencias: 0,
      intimacoes: 0,
      total: 0,
    };

    if (!countsByCoord) return zero;

    const out = { ...zero };
    for (const id of visibleCoordIds) {
      const c = countsByCoord[id];
      if (!c) continue;
      out.djen += c.djen;
      out.distribuicoes += c.distribuicoes;
      out.alertas360 += c.alertas360;
      out.redistribuicoes += c.redistribuicoes;
      out.andamentos += c.andamentos;
      out.prazos += c.prazos;
      out.tarefas += c.tarefas;
      out.audiencias += c.audiencias;
      out.intimacoes += c.intimacoes;
    }

    out.total =
      out.djen +
      out.distribuicoes +
      out.alertas360 +
      out.redistribuicoes +
      out.andamentos +
      out.prazos +
      out.tarefas +
      out.audiencias +
      out.intimacoes;

    return out;
  }, [coordenacaoId, countsSingle, countsByCoord, visibleCoordIds]);

  // ===== TAREFAS: paginação incremental (evita tentar carregar “todas”) =====
  // ===== TAREFAS: paginação incremental com LEFT JOIN (igual prazos) =====
  const tarefasPaged = useInfiniteQuery({
    queryKey: [
      "tarefas-pendentes-notificacoes-paged",
      statusFilter,
      prioridadeFilter,
      periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : null,
      periodoFim ? format(periodoFim, "yyyy-MM-dd") : null,
      searchQuery,
    ],
    initialPageParam: 0,
    // Só buscar quando a aba de Tarefas estiver aberta (evita lentidão no Dashboard)
    enabled: activeTab === "tarefas",
    queryFn: async ({ pageParam }) => {
      const q = searchQuery.trim();
      const inicio = periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined;
      const fim = periodoFim ? format(periodoFim, "yyyy-MM-dd") : undefined;

      // LEFT JOIN para incluir tarefas sem processo
      let query = supabase
        .from("tarefas")
        .select(`
          id,
          titulo,
          status,
          data_vencimento,
          prioridade,
          processo:processos!tarefas_processo_id_fkey(
            id,
            numero,
            coordenacao_id
          )
        `)
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      // Filtro por status
      if (statusFilter !== "todas") {
        const status = statusFilter === "concluido" ? "cumprido" : statusFilter;
        query = query.eq("status", status as "pendente" | "cumprido" | "atrasado");
      }

      // Filtros adicionais
      if (prioridadeFilter !== "todas") {
        query = query.eq("prioridade", prioridadeFilter as "baixa" | "media" | "alta" | "urgente");
      }
      if (inicio) query = query.gte("data_vencimento", inicio);
      if (fim) query = query.lte("data_vencimento", fim);
      if (q) {
        query = query.ilike("titulo", `%${q}%`);
      }

      const from = Number(pageParam) || 0;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await query.range(from, to);
      if (error) throw error;
      return (data || []) as any[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage) return undefined;
      return lastPage.length >= PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined;
    },
  });

  // Filtrar tarefas por coordenação client-side (igual prazos)
  const tarefasPendentesData = useMemo(() => {
    const allTarefas = tarefasPaged.data?.pages?.flat() ?? [];
    
    return allTarefas.filter((tarefa: any) => {
      const coordId = tarefa.processo?.coordenacao_id;
      
      if (coordenacaoId === "todas") {
        // Se "todas", mostrar tarefas sem processo + tarefas das coordenações visíveis
        return !coordId || visibleCoordIds.includes(coordId);
      }
      
      // Se coordenação específica, mostrar apenas tarefas dessa coordenação
      return coordId === coordenacaoId;
    });
  }, [tarefasPaged.data, coordenacaoId, visibleCoordIds]);

  // ===== PRAZOS: paginação incremental (prazos = tarefas pendentes com data_vencimento) =====
  // PRAZOS: SEMPRE mostra vencimentos nos próximos 6 dias (hoje + 5)
  // Ignora filtro de período do usuário - regra de negócio fixa
  const prazosPaged = useInfiniteQuery({
    queryKey: [
      "prazos-notificacoes-paged",
      coordenacaoId,
      visibleCoordIds,
      prioridadeFilter,
      searchQuery,
      // Removido periodoInicio/periodoFim - prazos sempre usam hoje + 5 dias
    ],
    initialPageParam: 0,
    // A aba "Todos" exibe um resumo de prazos; por isso habilita também em "todos"
    enabled: activeTab === "prazos" || activeTab === "todos",
    queryFn: async ({ pageParam }) => {
      const q = searchQuery.trim();
      
      // REGRA FIXA: hoje + 5 dias (6 dias total)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const daquiCincoDias = new Date(hoje);
      daquiCincoDias.setDate(daquiCincoDias.getDate() + 5); // hoje + 5 dias
      
      const inicio = format(hoje, "yyyy-MM-dd");
      const fim = format(daquiCincoDias, "yyyy-MM-dd");

      // LEFT JOIN para incluir tarefas sem processo
      let query = supabase
        .from("tarefas")
        .select(
          `
            id,
            titulo,
            data_vencimento,
            data_fatal,
            data_prevista,
            prioridade,
            processo:processos!tarefas_processo_id_fkey(
              id,
              numero,
              coordenacao_id
            )
          `
        )
        .eq("status", "pendente")
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      // Filtro de data: usa qualquer campo de data relevante
      // Prazos com data_vencimento, data_fatal ou data_prevista nos próximos 5 dias
      query = query.or(`data_vencimento.gte.${inicio},data_fatal.gte.${inicio},data_prevista.gte.${inicio}`);
      query = query.or(`data_vencimento.lte.${fim},data_fatal.lte.${fim},data_prevista.lte.${fim}`);

      // Filtros adicionais
      if (prioridadeFilter !== "todas") {
        query = query.eq(
          "prioridade",
          prioridadeFilter as "baixa" | "media" | "alta" | "urgente"
        );
      }
      if (q) {
        query = query.ilike("titulo", `%${q}%`);
      }

      const from = Number(pageParam) || 0;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await query.range(from, to);
      if (error) throw error;
      return (data || []) as any[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage) return undefined;
      return lastPage.length >= PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined;
    },
  });

  const prazosPendentesData = useMemo(() => {
    const allPrazos = prazosPaged.data?.pages?.flat() ?? [];
    
    // Filtrar por coordenação client-side (já que usamos LEFT JOIN)
    return allPrazos.filter((prazo: any) => {
      // Se não tem processo ou coordenacao_id, inclui na lista geral
      const coordId = prazo.processo?.coordenacao_id;
      
      if (coordenacaoId === "todas") {
        // Se "todas", mostrar tarefas sem processo + tarefas das coordenações visíveis
        return !coordId || visibleCoordIds.includes(coordId);
      }
      
      // Se coordenação específica, mostrar apenas tarefas dessa coordenação
      return coordId === coordenacaoId;
    });
  }, [prazosPaged.data, coordenacaoId, visibleCoordIds]);

  const prazosComMeta = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const daquiCincoDias = new Date(hoje);
    daquiCincoDias.setDate(daquiCincoDias.getDate() + 5); // hoje + 5 dias

    return prazosPendentesData
      .map((prazo: any) => {
        // Usa data_vencimento, data_fatal ou data_prevista (primeira disponível)
        const dataStr = prazo.data_vencimento || prazo.data_fatal || prazo.data_prevista;
        if (!dataStr) return null;
        
        const vencimento = new Date(dataStr + "T00:00:00");
        const diffTime = vencimento.getTime() - hoje.getTime();
        const dias_restantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          ...prazo,
          data_efetiva: dataStr, // data usada para cálculo
          dias_restantes,
          is_atrasado: dias_restantes < 0,
        };
      })
      .filter((prazo: any) => {
        if (!prazo) return false;
        // Filtrar apenas prazos dentro da janela de 5 dias (hoje a hoje+4)
        const dataEfetiva = new Date(prazo.data_efetiva + "T00:00:00");
        return dataEfetiva >= hoje && dataEfetiva <= daquiCincoDias;
      });
  }, [prazosPendentesData]);

  // Buscar audiências pendentes
  const { data: audienciasPendentesData = [] } = useQuery({
    queryKey: ["audiencias-pendentes-notificacoes", statusFilter],
    enabled: activeTab === "audiencias",
    queryFn: async () => {
      const pageSize = 1000;

      const buildQuery = () => {
        let query = supabase
          .from("audiencias_detectadas")
          .select(`
            id,
            processo_numero,
            data_audiencia,
            hora,
            tipo_audiencia,
            status,
            processo:processos!audiencias_detectadas_processo_id_fkey(
              id,
              numero,
              coordenacao_id
            )
          `)
          .order("data_audiencia", { ascending: true, nullsFirst: false });

        if (statusFilter !== "todas") {
          query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
        }

        return query;
      };

      const all: any[] = [];
      for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const { data, error } = await buildQuery().range(from, to);
        if (error) throw error;
        const chunk = data || [];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
      }

      return all;
    },
  });

  // Buscar intimações pendentes
  const { data: intimacoesPendentesData = [] } = useQuery({
    queryKey: ["intimacoes-pendentes-notificacoes", statusFilter],
    enabled: activeTab === "intimacoes",
    queryFn: async () => {
      const pageSize = 1000;

      const buildQuery = () => {
        let query = supabase
          .from("intimacoes_detectadas")
          .select(`
            id,
            processo_numero,
            data_intimacao,
            tipo_intimacao,
            status,
            processo:processos!intimacoes_detectadas_processo_id_fkey(
              id,
              numero,
              coordenacao_id
            )
          `)
          .order("data_intimacao", { ascending: true, nullsFirst: false });

        if (statusFilter !== "todas") {
          query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
        }

        return query;
      };

      const all: any[] = [];
      for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const { data, error } = await buildQuery().range(from, to);
        if (error) throw error;
        const chunk = data || [];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
      }

      return all;
    },
  });

  // ===== ANDAMENTOS: paginação incremental (evita tentar carregar “tudo”) =====
  const andamentosPaged = useInfiniteQuery({
    queryKey: ["andamentos-notificacoes-paged", periodoInicio, periodoFim],
    initialPageParam: 0,
    enabled: activeTab === "andamentos",
    queryFn: async ({ pageParam }) => {
      // Se não houver filtro de período, usar últimos N dias para evitar timeout
      const inicioDia = periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined;
      const fimDiaMaisUm = periodoFim ? format(new Date(periodoFim.getTime() + 86400000), "yyyy-MM-dd") : undefined;

      let query = supabase
        .from("movimentacoes")
        .select(`
          id,
          descricao,
          data_movimentacao,
          created_at,
          tipo,
          fonte,
          processo:processos!movimentacoes_processo_id_fkey(
            id,
            numero,
            coordenacao_id
          )
        `)
        .neq("tipo", "Redistribuição")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      // Filtrar por período apenas quando usuário define
      if (inicioDia) query = query.gte("created_at", inicioDia);
      if (fimDiaMaisUm) query = query.lt("created_at", fimDiaMaisUm);

      const from = Number(pageParam) || 0;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await query.range(from, to);
      if (error) throw error;
      return (data || []) as any[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage) return undefined;
      return lastPage.length >= PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined;
    },
  });

  const andamentosData = useMemo(() => {
    return andamentosPaged.data?.pages?.flat() ?? [];
  }, [andamentosPaged.data]);

  // Filter helper functions - usando useMemo para garantir reatividade
  const matchesSearch = useMemo(() => {
    return (text: string | null | undefined) => {
      if (!searchQuery) return true;
      return text?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    };
  }, [searchQuery]);

  const matchesPeriodo = useMemo(() => {
    return (dateStr: string | null | undefined) => {
      if (!dateStr) return true;
      if (!periodoInicio && !periodoFim) return true;
      
      try {
        const date = startOfDay(parseISO(dateStr));
        if (periodoInicio && isBefore(date, startOfDay(periodoInicio))) return false;
        if (periodoFim && isAfter(date, startOfDay(periodoFim))) return false;
        return true;
      } catch {
        return true;
      }
    };
  }, [periodoInicio, periodoFim]);

  const matchesPrioridade = useMemo(() => {
    return (prioridade: string | null | undefined) => {
      if (prioridadeFilter === "todas") return true;
      return prioridade === prioridadeFilter;
    };
  }, [prioridadeFilter]);

  // Filter DJEN publications by coordination and filters - usando created_at (data da captura)
  const publicacoesNaoLidas = publicacoes.filter(p => statusFilter === "todas" || !p.lida);
  const publicacoesFiltradas = useMemo(() => {
    return publicacoesNaoLidas.filter(p => {
      if (coordenacaoId !== "todas") {
        const mon = monitoramentosDjen.find(m => m.id === p.monitoramento_id);
        if (mon?.coordenacao_id !== coordenacaoId) return false;
      }
      if (!matchesSearch(p.conteudo) && !matchesSearch(p.processo_numero)) return false;
      // Usar created_at (data da captura) para filtro de período
      if (!matchesPeriodo(p.created_at)) return false;
      return true;
    });
  }, [publicacoesNaoLidas, coordenacaoId, monitoramentosDjen, matchesSearch, matchesPeriodo]);

  // Filter distributions by coordination
  const distribuicoesPendentes = distribuicoesEncontradas.filter(d => 
    statusFilter === "todas" || d.status === 'pendente'
  );
  const distribuicoesFiltradas = useMemo(() => {
    return distribuicoesPendentes.filter(d => {
      if (coordenacaoId !== "todas") {
        if ((d as any).monitoramento?.coordenacao_id !== coordenacaoId) return false;
      }
      if (!matchesSearch(d.numero_processo) && !matchesSearch(d.polo_ativo) && !matchesSearch(d.polo_passivo)) return false;
      if (!matchesPeriodo(d.data_distribuicao)) return false;
      return true;
    });
  }, [distribuicoesPendentes, coordenacaoId, searchQuery, periodoInicio, periodoFim]);

  // Filter alerts by coordination
  const alertasPendentes = alertas.filter(a => 
    statusFilter === "todas" || a.status === 'pendente'
  );
  const alertasFiltrados = useMemo(() => {
    return alertasPendentes.filter(a => {
      if (coordenacaoId !== "todas" && a.processo?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(a.termo_encontrado) && !matchesSearch(a.processo?.numero)) return false;
      if (!matchesPeriodo(a.created_at)) return false;
      if (!matchesPrioridade(a.prioridade)) return false;
      return true;
    });
  }, [alertasPendentes, coordenacaoId, searchQuery, periodoInicio, periodoFim, prioridadeFilter]);

  // Redistribuições filtradas por período
  const redistribuicoesFiltradas = useMemo(() => {
    return redistribuicoesData.filter(r => {
      if (coordenacaoId !== "todas") {
        const coord = coordenacoes.find(c => c.id === coordenacaoId);
        if (!coord || r.coordenacao_nome !== coord.nome) return false;
      }
      if (!matchesSearch(r.processo_numero)) return false;
      return true;
    });
  }, [redistribuicoesData, coordenacaoId, coordenacoes, searchQuery]);

  // Filter prazos by coordination
  const prazosFiltrados = useMemo(() => {
    return prazosComMeta.filter((p: any) => {
      // (coordenação/periodo/prioridade já aplicados server-side; mantém client-side como segurança)
      if (coordenacaoId !== "todas" && p.processo?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(p.titulo) && !matchesSearch(p.processo?.numero)) return false;
      if (!matchesPeriodo(p.data_vencimento)) return false;
      if (!matchesPrioridade(p.prioridade)) return false;
      return true;
    });
  }, [prazosComMeta, coordenacaoId, matchesSearch, matchesPeriodo, matchesPrioridade]);

  // Filter notificacoes by coordination
  const notificacoesFiltradas = useMemo(() => {
    const baseNotifs = statusFilter === "todas" ? notificacoes : naoLidas;
    return baseNotifs.filter(n => {
      if (coordenacaoId !== "todas") {
        const processoId = n.dados?.processo_id;
        if (!processoId) return false;
        const alertaRelacionado = alertas.find(a => a.processo_id === processoId);
        if (alertaRelacionado?.processo?.coordenacao_id !== coordenacaoId) return false;
      }
      if (!matchesSearch(n.titulo) && !matchesSearch(n.mensagem)) return false;
      if (!matchesPeriodo(n.created_at)) return false;
      return true;
    });
  }, [notificacoes, naoLidas, statusFilter, coordenacaoId, alertas, searchQuery, periodoInicio, periodoFim]);

  // Filter tarefas by coordination
  // Tarefas já filtradas por coordenação no useMemo acima; aqui apenas filtro de busca adicional
  const tarefasFiltradas = useMemo(() => {
    return tarefasPendentesData.filter(t => {
      // Busca em título ou número do processo
      if (searchQuery.trim() && !matchesSearch(t.titulo) && !matchesSearch((t.processo as any)?.numero)) return false;
      return true;
    });
  }, [tarefasPendentesData, searchQuery, matchesSearch]);

  // Filter audiencias by coordination
  const audienciasFiltradas = useMemo(() => {
    return audienciasPendentesData.filter(a => {
      if (coordenacaoId !== "todas" && (a.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(a.processo_numero) && !matchesSearch((a.processo as any)?.numero) && !matchesSearch(a.tipo_audiencia)) return false;
      if (!matchesPeriodo(a.data_audiencia)) return false;
      return true;
    });
  }, [audienciasPendentesData, coordenacaoId, searchQuery, periodoInicio, periodoFim]);

  // Filter intimacoes by coordination
  const intimacoesFiltradas = useMemo(() => {
    return intimacoesPendentesData.filter(i => {
      if (coordenacaoId !== "todas" && (i.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(i.processo_numero) && !matchesSearch((i.processo as any)?.numero) && !matchesSearch(i.tipo_intimacao)) return false;
      if (!matchesPeriodo(i.data_intimacao)) return false;
      return true;
    });
  }, [intimacoesPendentesData, coordenacaoId, searchQuery, periodoInicio, periodoFim]);

  // Filter andamentos by coordination and period (client-side backup for period matching)
  const andamentosFiltrados = useMemo(() => {
    return andamentosData.filter(a => {
      if (coordenacaoId !== "todas" && (a.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(a.descricao) && !matchesSearch((a.processo as any)?.numero) && !matchesSearch(a.tipo)) return false;
      // Período já é filtrado no banco; manter filtro local como backup apenas se período foi definido
      if (periodoInicio || periodoFim) {
        if (!matchesPeriodo((a as any).created_at)) return false;
      }
      return true;
    });
  }, [andamentosData, coordenacaoId, searchQuery, periodoInicio, periodoFim, matchesPeriodo]);

  // Stats - valores reais para os cards
  const stats = useMemo(() => {
    const base = counts ?? {
      djen: 0,
      distribuicoes: 0,
      alertas360: 0,
      redistribuicoes: 0,
      andamentos: 0,
      prazos: 0,
      tarefas: 0,
      audiencias: 0,
      intimacoes: 0,
      total: 0,
    };
    return {
      ...base,
      notificacoes: notificacoesFiltradas.length,
    };
  }, [counts, notificacoesFiltradas.length]);

  const hasActiveFilters =
    searchQuery ||
    prioridadeFilter !== "todas" ||
    statusFilter !== "pendente" ||
    !!periodoInicio ||
    !!periodoFim ||
    coordenacaoId !== "todas";

  const clearAllFilters = () => {
    setSearchQuery("");
    setPrioridadeFilter("todas");
    setStatusFilter("pendente");
    clearPeriodo();
    setCoordenacaoId("todas");
  };

  const getIconByType = (tipo: string) => {
    switch (tipo) {
      case 'djen': return <Newspaper className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'success': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getColorByType = (tipo: string) => {
    switch (tipo) {
      case 'djen': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'warning': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'success': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'urgente': return 'bg-red-500/10 text-red-500';
      case 'alta': return 'bg-orange-500/10 text-orange-500';
      case 'media': return 'bg-amber-500/10 text-amber-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleSelectCoordenacao = (id: string, category?: string) => {
    setCoordenacaoId(id);
    setFilterCategory(category);
    setActiveTab("detalhes");
  };

  const handleBackToDashboard = () => {
    setCoordenacaoId("todas");
    setFilterCategory(undefined);
    setActiveTab("dashboard");
  };

  return (
    <MainLayout title="Central de Notificações" subtitle={`${stats.total} alertas encontrados`}>
      {/* Filters Bar */}
      <div className="bg-card rounded-xl border border-border/50 p-4 mb-6 animate-fade-in">
        <div className="flex flex-col gap-4">
          {/* Search Row */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por processo, termo, título..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Second Row - Coordination, Member & Period */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Period Filters */}
            <div className="flex gap-1">
              <Button
                variant={!periodoInicio && !periodoFim ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={clearPeriodo}
              >
                Tudo
              </Button>
              <Button
                variant={periodoInicio && periodoFim ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={setPeriodoHoje}
              >
                Hoje
              </Button>
            </div>

            {/* Period Filters - Data Início */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-2 w-full sm:w-auto", periodoInicio && "bg-primary/10")}>
                  <CalendarDays className="w-4 h-4" />
                  <span className="hidden sm:inline">De:</span>
                  {periodoInicio ? format(periodoInicio, "dd/MM/yyyy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                  <p className="text-sm font-medium">Data Início</p>
                </div>
                <Calendar
                  mode="single"
                  selected={periodoInicio}
                  onSelect={setPeriodoInicio}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                  initialFocus
                />
                <div className="p-3 border-t flex justify-between gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setPeriodoInicio(startOfDay(new Date()))}
                  >
                    Hoje
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setPeriodoInicio(undefined)}
                  >
                    Limpar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Period Filters - Data Fim */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-2 w-full sm:w-auto", periodoFim && "bg-primary/10")}>
                  <CalendarDays className="w-4 h-4" />
                  <span className="hidden sm:inline">Até:</span>
                  {periodoFim ? format(periodoFim, "dd/MM/yyyy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                  <p className="text-sm font-medium">Data Fim</p>
                </div>
                <Calendar
                  mode="single"
                  selected={periodoFim}
                  onSelect={setPeriodoFim}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                  initialFocus
                />
                <div className="p-3 border-t flex justify-between gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setPeriodoFim(startOfDay(new Date()))}
                  >
                    Hoje
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setPeriodoFim(undefined)}
                  >
                    Limpar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Results counter chip */}
            <Badge variant="outline" className="h-8 px-3 text-xs font-medium bg-primary/10 border-primary/30 text-primary">
              {stats.total} alerta{stats.total !== 1 ? "s" : ""} encontrado{stats.total !== 1 ? "s" : ""}
            </Badge>
            
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-8 text-xs gap-1">
              <X className="w-3 h-3" />
              Limpar filtros
            </Button>

            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setPdfDialogOpen(true)} 
              className="h-8 text-xs gap-1 bg-gold hover:bg-gold/90 text-navy-deep"
            >
              <Download className="w-3 h-3" />
              Relatório PDF
            </Button>
          </div>

        </div>
      </div>

      <GerarRelatorioPdfDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        periodoInicio={periodoInicio}
        periodoFim={periodoFim}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
      />


      {/* Cards de resumo por tipo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-3 mb-6">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "dashboard" && "ring-2 ring-primary"
          )}
          onClick={() => setActiveTab("dashboard")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <LayoutDashboard className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="mt-2 text-xs font-medium">Dashboard</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "djen" && "ring-2 ring-blue-500"
          )}
          onClick={() => setActiveTab("djen")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <Newspaper className="w-4 h-4 text-blue-500" />
              </div>
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 text-xs px-1.5">
                {stats.djen}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">DJEN</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "distribuicoes" && "ring-2 ring-purple-500"
          )}
          onClick={() => setActiveTab("distribuicoes")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Scale className="w-4 h-4 text-purple-500" />
              </div>
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 text-xs px-1.5">
                {stats.distribuicoes}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Distribuições</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "alertas360" && "ring-2 ring-amber-500"
          )}
          onClick={() => setActiveTab("alertas360")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Radar className="w-4 h-4 text-amber-500" />
              </div>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-xs px-1.5">
                {stats.alertas360}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Alertas 360°</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "redistribuicoes" && "ring-2 ring-cyan-500"
          )}
          onClick={() => setActiveTab("redistribuicoes")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-cyan-500/10">
                <RefreshCw className="w-4 h-4 text-cyan-500" />
              </div>
              <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-500 text-xs px-1.5">
                {stats.redistribuicoes}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Redistrib.</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "prazos" && "ring-2 ring-red-500"
          )}
          onClick={() => setActiveTab("prazos")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-red-500/10">
                <Clock className="w-4 h-4 text-red-500" />
              </div>
              <Badge variant="secondary" className="bg-red-500/10 text-red-500 text-xs px-1.5">
                {stats.prazos}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Prazos</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "tarefas" && "ring-2 ring-green-500"
          )}
          onClick={() => setActiveTab("tarefas")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-green-500/10">
                <ListTodo className="w-4 h-4 text-green-500" />
              </div>
              <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-xs px-1.5">
                {stats.tarefas}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Tarefas</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "audiencias" && "ring-2 ring-indigo-500"
          )}
          onClick={() => setActiveTab("audiencias")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-indigo-500/10">
                <Gavel className="w-4 h-4 text-indigo-500" />
              </div>
              <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-500 text-xs px-1.5">
                {stats.audiencias}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Audiências</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "intimacoes" && "ring-2 ring-orange-500"
          )}
          onClick={() => setActiveTab("intimacoes")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-orange-500/10">
                <FileWarning className="w-4 h-4 text-orange-500" />
              </div>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 text-xs px-1.5">
                {stats.intimacoes}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Intimações</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "andamentos" && "ring-2 ring-violet-600"
          )}
          onClick={() => setActiveTab("andamentos")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-violet-600/10">
                <Activity className="w-4 h-4 text-violet-600" />
              </div>
              <Badge variant="secondary" className="bg-violet-600/10 text-violet-600 text-xs px-1.5">
                {stats.andamentos}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Andamentos</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "todos" && "ring-2 ring-primary"
          )}
          onClick={() => setActiveTab("todos")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary text-xs px-1.5">
                {stats.total}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Área de conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">

        {/* Dashboard por Coordenação */}
        <TabsContent value="dashboard" className="space-y-4">
          <DashboardCoordenacoes 
            onSelectCoordenacao={handleSelectCoordenacao}
            selectedCoordenacaoId={coordenacaoId}
            periodoInicio={periodoInicio}
            periodoFim={periodoFim}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
          />
        </TabsContent>

        {/* Detalhes da Coordenação */}
        <TabsContent value="detalhes" className="space-y-4">
          {coordenacaoId !== "todas" && (
            <CoordenacaoDetalhesView
              coordenacaoId={coordenacaoId}
              periodoInicio={periodoInicio}
              periodoFim={periodoFim}
              statusFilter={statusFilter}
              searchQuery={searchQuery}
              filterCategory={filterCategory}
              onBack={handleBackToDashboard}
              onClearCategory={() => setFilterCategory(undefined)}
            />
          )}
        </TabsContent>

        {/* Todos */}
        <TabsContent value="todos" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* DJEN resumido */}
            {stats.djen > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-blue-500" />
                    Publicações DJEN ({stats.djen})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {publicacoesFiltradas.slice(0, 5).map((pub) => {
                      const processoDisplay = pub.processo_numero || (() => {
                        const match = pub.conteudo?.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
                        return match ? match[1] : null;
                      })();
                      return (
                        <div key={pub.id} className="py-2 border-b last:border-0">
                          <p className="text-sm font-medium truncate">{processoDisplay || 'Publicação DJEN'}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{pub.conteudo?.substring(0, 100)}...</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pub.data_publicacao && formatDistanceToNow(new Date(pub.data_publicacao), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("djen")}>
                    Ver todas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Alertas 360 resumido */}
            {stats.alertas360 > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Radar className="w-4 h-4 text-amber-500" />
                    Alertas 360° ({stats.alertas360})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {alertasFiltrados.slice(0, 5).map((alerta) => (
                      <div key={alerta.id} className="py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <Badge className={getPrioridadeColor(alerta.prioridade)} variant="outline">
                            {alerta.prioridade}
                          </Badge>
                          <span className="text-sm font-medium truncate">{alerta.termo_encontrado}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Processo: {alerta.processo?.numero}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("alertas360")}>
                    Ver todos
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Prazos */}
            {prazosFiltrados.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500" />
                    Prazos ({prazosFiltrados.length}{prazosPaged.hasNextPage ? "+" : ""})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {prazosFiltrados.slice(0, 5).map((prazo) => (
                      <div key={prazo.id} className="py-2 border-b last:border-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate flex-1">{prazo.titulo}</p>
                          <Badge 
                            variant={prazo.is_atrasado ? "destructive" : "outline"}
                            className={prazo.is_atrasado ? "" : "bg-amber-500/10 text-amber-500"}
                          >
                            {prazo.is_atrasado ? 'Atrasado' : `${prazo.dias_restantes}d`}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Processo: {prazo.processo?.numero}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vencimento: {format(new Date(prazo.data_vencimento), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => navigate('/prazos')}>
                    Ver todos
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Distribuições resumido */}
            {stats.distribuicoes > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scale className="w-4 h-4 text-purple-500" />
                    Distribuições ({stats.distribuicoes})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {distribuicoesFiltradas.slice(0, 5).map((dist) => (
                      <div key={dist.id} className="py-2 border-b last:border-0">
                        <p className="text-sm font-medium truncate">{dist.numero_processo}</p>
                        <p className="text-xs text-muted-foreground">{dist.classe || 'Sem classe'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dist.tribunal || 'Tribunal não informado'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("distribuicoes")}>
                    Ver todas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Redistribuições resumido */}
            {stats.redistribuicoes > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-cyan-500" />
                    Redistribuições ({stats.redistribuicoes})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {redistribuicoesFiltradas.slice(0, 5).map((red) => (
                      <div key={red.id} className="py-2 border-b last:border-0">
                        <p className="text-sm font-medium truncate">{red.processo_numero}</p>
                        <p className="text-xs text-muted-foreground">{red.vara_antiga} → {red.vara_nova}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(red.data_redistribuicao), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("redistribuicoes")}>
                    Ver todas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Notificações do sistema */}
            {notificacoesFiltradas.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    Notificações ({notificacoesFiltradas.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {notificacoesFiltradas.slice(0, 5).map((notif) => (
                      <div 
                        key={notif.id} 
                        className="py-2 border-b last:border-0 flex items-start justify-between gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2"
                        onClick={() => {
                          marcarComoLida.mutate(notif.id);
                          if (notif.link) {
                            navigate(notif.link);
                          }
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className={cn("p-1 rounded", getColorByType(notif.tipo))}>
                              {getIconByType(notif.tipo)}
                            </div>
                            <p className="text-sm font-medium">{notif.titulo}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.mensagem}</p>
                        </div>
                        <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => marcarTodasComoLidas.mutate()}>
                    Marcar todas como lidas
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {stats.total === 0 && (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
                <h3 className="text-lg font-semibold">Tudo em dia!</h3>
                <p className="text-muted-foreground">Não há notificações ou alertas pendentes.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DJEN */}
        <TabsContent value="djen">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-blue-500" />
                Publicações DJEN não lidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {publicacoesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma publicação pendente
                </div>
              ) : (
                  <div className="space-y-3">
                    {publicacoesFiltradas.map((pub) => {
                      const monitoramento = monitoramentosDjen.find(m => m.id === pub.monitoramento_id);
                      const processoDisplay = pub.processo_numero || (() => {
                        const match = pub.conteudo?.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
                        return match ? match[1] : null;
                      })();
                      return (
                        <Card key={pub.id} className="bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                                    {monitoramento?.termo_busca || 'Monitoramento'}
                                  </Badge>
                                  {pub.fonte && (
                                    <Badge variant="secondary">{pub.fonte}</Badge>
                                  )}
                                </div>
                                <p className="font-medium">{processoDisplay || 'Publicação DJEN'}</p>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                                  {pub.conteudo}
                                </p>
                                {(pub as any).resumo_ia && (
                                  <div className="mt-2 p-2 bg-primary/5 rounded text-sm">
                                    <strong>Resumo IA:</strong> {(pub as any).resumo_ia}
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">
                                  {pub.data_publicacao && format(new Date(pub.data_publicacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate('/analise-djen')}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Analisar
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribuições */}
        <TabsContent value="distribuicoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-500" />
                Distribuições Encontradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {distribuicoesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma distribuição pendente
                </div>
              ) : (
                  <div className="space-y-3">
                    {distribuicoesFiltradas.map((dist) => (
                      <Card key={dist.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium">{dist.numero_processo}</p>
                              <p className="text-sm text-muted-foreground">{dist.classe}</p>
                              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Polo ativo:</span>
                                  <p className="truncate">{dist.polo_ativo || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Polo passivo:</span>
                                  <p className="truncate">{dist.polo_passivo || '-'}</p>
                                </div>
                              </div>
                              {dist.tribunal && (
                                <Badge variant="secondary" className="mt-2">{dist.tribunal}</Badge>
                              )}
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/monitoramento-distribuicao')}
                            >
                              Gerenciar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alertas 360 */}
        <TabsContent value="alertas360">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radar className="w-5 h-5 text-amber-500" />
                Alertas de Monitoramento 360°
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertasFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum alerta pendente
                </div>
              ) : (
                  <div className="space-y-3">
                    {alertasFiltrados.map((alerta) => (
                      <Card key={alerta.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getPrioridadeColor(alerta.prioridade)}>
                                  {alerta.prioridade.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="font-medium">Termo: {alerta.termo_encontrado}</p>
                              <p className="text-sm text-muted-foreground">
                                Processo: {alerta.processo?.numero}
                              </p>
                              {alerta.contexto && (
                                <p className="text-sm mt-2 p-2 bg-muted rounded line-clamp-2">
                                  {alerta.contexto}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDistanceToNow(new Date(alerta.created_at), { addSuffix: true, locale: ptBR })}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/monitoramento-360')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Redistribuições */}
        <TabsContent value="redistribuicoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-500" />
                Redistribuições Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {redistribuicoesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma redistribuição recente
                </div>
              ) : (
                  <div className="space-y-3">
                    {redistribuicoesFiltradas.map((red) => (
                      <Card key={red.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium">{red.processo_numero}</p>
                              <p className="text-sm text-muted-foreground">
                                {red.vara_antiga} → {red.vara_nova}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDistanceToNow(new Date(red.data_redistribuicao), { addSuffix: true, locale: ptBR })}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/redistribuicoes')}
                            >
                              Gerenciar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prazos */}
        <TabsContent value="prazos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-500" />
                Prazos ({prazosFiltrados.length}{prazosPaged.hasNextPage ? "+" : ""})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prazosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum prazo encontrado
                </div>
              ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Exibindo {prazosFiltrados.length}{prazosPaged.hasNextPage ? "+" : ""}
                      </p>
                      {prazosPaged.hasNextPage && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={prazosPaged.isFetchingNextPage}
                          onClick={() => prazosPaged.fetchNextPage()}
                        >
                          {prazosPaged.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
                        </Button>
                      )}
                    </div>
                    {prazosFiltrados.map((prazo) => (
                      <Card key={prazo.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge 
                                  variant={prazo.is_atrasado ? "destructive" : "outline"}
                                  className={prazo.is_atrasado ? "" : "bg-amber-500/10 text-amber-500"}
                                >
                                  {prazo.is_atrasado ? 'ATRASADO' : `${prazo.dias_restantes} dias`}
                                </Badge>
                              </div>
                              <p className="font-medium">{prazo.titulo}</p>
                              <p className="text-sm text-muted-foreground">
                                Processo: {prazo.processo?.numero}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Vencimento: {format(new Date(prazo.data_vencimento), "dd/MM/yyyy")}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/prazos')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tarefas */}
        <TabsContent value="tarefas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-green-500" />
                Tarefas Pendentes ({stats.tarefas})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tarefasFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma tarefa pendente
                </div>
              ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Exibindo {tarefasFiltradas.length} de {stats.tarefas}
                      </p>
                      {tarefasPaged.hasNextPage && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={tarefasPaged.isFetchingNextPage}
                          onClick={() => tarefasPaged.fetchNextPage()}
                        >
                          {tarefasPaged.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
                        </Button>
                      )}
                    </div>
                    {tarefasFiltradas.map((tarefa) => (
                      <Card key={tarefa.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getPrioridadeColor(tarefa.prioridade)}>
                                  {tarefa.prioridade.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="font-medium">{tarefa.titulo}</p>
                              <p className="text-sm text-muted-foreground">
                                Processo: {(tarefa.processo as any)?.numero || '-'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Vencimento: {format(new Date(tarefa.data_vencimento), "dd/MM/yyyy")}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/minha-agenda')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audiências */}
        <TabsContent value="audiencias">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-indigo-500" />
                Audiências Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {audienciasFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma audiência pendente
                </div>
              ) : (
                  <div className="space-y-3">
                    {audienciasFiltradas.map((audiencia) => (
                      <Card key={audiencia.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500">
                                  {audiencia.tipo_audiencia || 'Audiência'}
                                </Badge>
                              </div>
                              <p className="font-medium">{audiencia.processo_numero || (audiencia.processo as any)?.numero}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {audiencia.data_audiencia && format(new Date(audiencia.data_audiencia), "dd/MM/yyyy")}
                                {audiencia.hora && ` às ${audiencia.hora}`}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/painel-audiencias')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intimações */}
        <TabsContent value="intimacoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-orange-500" />
                Intimações Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {intimacoesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma intimação pendente
                </div>
              ) : (
                  <div className="space-y-3">
                    {intimacoesFiltradas.map((intimacao) => (
                      <Card key={intimacao.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
                                  {intimacao.tipo_intimacao || 'Intimação'}
                                </Badge>
                              </div>
                              <p className="font-medium">{intimacao.processo_numero || (intimacao.processo as any)?.numero}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {intimacao.data_intimacao && format(new Date(intimacao.data_intimacao), "dd/MM/yyyy")}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/painel-intimacoes')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Andamentos */}
        <TabsContent value="andamentos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-violet-600" />
                Andamentos Recentes ({stats.andamentos})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {andamentosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {periodoInicio || periodoFim 
                    ? "Nenhum andamento encontrado no período selecionado"
                    : "Nenhum andamento nos últimos 90 dias. Use o filtro de período para buscar datas específicas."}
                </div>
              ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Exibindo {andamentosFiltrados.length} de {stats.andamentos}
                      </p>
                      {andamentosPaged.hasNextPage && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={andamentosPaged.isFetchingNextPage}
                          onClick={() => andamentosPaged.fetchNextPage()}
                        >
                          {andamentosPaged.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
                        </Button>
                      )}
                    </div>
                    {andamentosFiltrados.map((andamento) => {
                      const coordId = (andamento.processo as any)?.coordenacao_id;
                      const coord = coordenacoes.find(c => c.id === coordId);
                      return (
                        <Card key={andamento.id} className="bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <Badge variant="outline" className="bg-violet-600/10 text-violet-600">
                                    {andamento.tipo || 'Movimentação'}
                                  </Badge>
                                  {andamento.fonte && (
                                    <Badge variant="secondary" className="text-xs">
                                      {andamento.fonte}
                                    </Badge>
                                  )}
                                  {coord && (
                                    <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
                                      <Building2 className="w-3 h-3 mr-1" />
                                      {coord.nome}
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-medium line-clamp-2">{andamento.descricao}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Processo: {(andamento.processo as any)?.numero || '-'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Capturado: {(andamento as any).created_at && format(new Date((andamento as any).created_at), "dd/MM/yyyy HH:mm")}
                                </p>
                              </div>
                              {(andamento.processo as any)?.id && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => navigate(`/processos/${(andamento.processo as any).id}`)}
                                >
                                  Ver processo
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para gerar PDF */}
      <GerarRelatorioPdfDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        periodoInicio={periodoInicio}
        periodoFim={periodoFim}
        statusFilter={statusFilter}
      />
    </MainLayout>
  );
}
