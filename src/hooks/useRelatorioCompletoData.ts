import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardStatsRelatorio {
  totalProcessos: number;
  processosAtivos: number;
  processosDistribuidos: number;
  processosNaoDistribuidos: number;
  prazosUrgentes: number;
  totalAdvogados: number;
  totalCoordenacoes: number;
}

export interface CoordenacaoRelatorio {
  id: string;
  nome: string;
  area: string;
  coordenador: string;
  totalMembros: number;
  totalProcessos: number;
  processosDistribuidos: number;
  processosNaoDistribuidos: number;
  membros: Array<{
    nome: string;
    cargo: string;
    processos: number;
  }>;
}

export interface AudienciasStatsRelatorio {
  pendentes: number;
  tratadas: number;
  confirmadas: number;
  ignoradas: number;
  proximas7Dias: number;
  total: number;
}

export interface IntimacoesStatsRelatorio {
  pendentes: number;
  tratadas: number;
  vencidas: number;
  proximas7Dias: number;
  emAndamento: number;
  total: number;
}

export interface DjenStatsRelatorio {
  totalPublicacoes: number;
  publicacoesNaoLidas: number;
  publicacoesHoje: number;
  porCoordenacao: Array<{
    coordenacao: string;
    total: number;
    naoLidas: number;
  }>;
}

export interface NotificacoesStatsRelatorio {
  total: number;
  naoLidas: number;
  prazosUrgentes: number;
  alertasSistema: number;
}

export interface RelatorioCompletoData {
  dashboardStats: DashboardStatsRelatorio;
  coordenacoes: CoordenacaoRelatorio[];
  audienciasStats: AudienciasStatsRelatorio;
  intimacoesStats: IntimacoesStatsRelatorio;
  djenStats: DjenStatsRelatorio;
  notificacoesStats: NotificacoesStatsRelatorio;
}

export function useRelatorioCompletoData(enabled = true) {
  return useQuery({
    queryKey: ["relatorio-completo-data"],
    enabled,
    staleTime: 60_000,
    retry: 2,
    queryFn: async (): Promise<RelatorioCompletoData> => {
      // 1. Dashboard Stats (mesma fonte do Dashboard)
      const { data: dashData, error: dashError } = await supabase.rpc("get_dashboard_stats");
      if (dashError) throw dashError;
      const dash = dashData as any;

      // Prazos urgentes (3 dias) — usa tarefas (tabela atual do sistema)
      const hojeStr = new Date().toISOString().split("T")[0];
      const tresDiasStr = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { count: prazosUrgentes3Dias, error: prazosUrgentesError } = await supabase
        .from("tarefas")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente")
        .gte("data_vencimento", hojeStr)
        .lte("data_vencimento", tresDiasStr);
      if (prazosUrgentesError) throw prazosUrgentesError;

      const totalProcessos = Number(dash?.totalProcessos ?? 0);
      const processosDistribuidos = Number(dash?.processosDistribuidos ?? 0);

      const dashboardStats: DashboardStatsRelatorio = {
        totalProcessos,
        processosAtivos: Number(dash?.processosAtivos ?? 0),
        processosDistribuidos,
        // "Não distribuídos" = sem advogado responsável
        processosNaoDistribuidos: Math.max(0, totalProcessos - processosDistribuidos),
        prazosUrgentes: Number(prazosUrgentes3Dias ?? dash?.prazosUrgentes ?? 0),
        totalAdvogados: Number(dash?.totalAdvogados ?? 0),
        totalCoordenacoes: Number(dash?.totalCoordenacoes ?? 0),
      };

      // 2. Coordenações com membros e estatísticas
      const { data: coordenacoesRaw, error: coordenacoesError } = await supabase
        .from("coordenacoes")
        .select(`
          id,
          nome,
          area,
          coordenador:profiles!coordenacoes_coordenador_id_fkey(nome)
        `);
      if (coordenacoesError) throw coordenacoesError;

      const { data: statsData, error: statsError } = await supabase.rpc("get_coordenacao_stats");
      if (statsError) throw statsError;

      const statsMap = new Map<string, any>();
      (statsData || []).forEach((s: any) => {
        statsMap.set(s.coordenacao_id, {
          total: Number(s.total_processos) || 0,
          distribuidos: Number(s.processos_distribuidos) || 0,
          naoDistribuidos: Number(s.processos_nao_distribuidos) || 0,
        });
      });

      const coordenacoes: CoordenacaoRelatorio[] = await Promise.all(
        (coordenacoesRaw || []).map(async (c: any) => {
          const { data: membros } = await supabase
            .from("membros_coordenacao")
            .select(`
              cargo,
              usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
            `)
            .eq("coordenacao_id", c.id);

          const membrosWithCount = await Promise.all(
            (membros || []).map(async (m: any) => {
              if (!m.usuario?.id) return { nome: "N/A", cargo: m.cargo || "Membro", processos: 0 };
              const { count } = await supabase
                .from("processos")
                .select("id", { count: "exact", head: true })
                .eq("coordenacao_id", c.id)
                .eq("advogado_responsavel_id", m.usuario.id);
              return {
                nome: m.usuario.nome || "N/A",
                cargo: m.cargo || "Membro",
                processos: count || 0,
              };
            })
          );

          const stats = statsMap.get(c.id) || { total: 0, distribuidos: 0, naoDistribuidos: 0 };
          return {
            id: c.id,
            nome: c.nome,
            area: c.area,
            coordenador: (c.coordenador as any)?.nome || "Não definido",
            totalMembros: membrosWithCount.length,
            totalProcessos: stats.total,
            processosDistribuidos: stats.distribuidos,
            processosNaoDistribuidos: stats.naoDistribuidos,
            membros: membrosWithCount.sort((a, b) => b.processos - a.processos),
          };
        })
      );

      // 3. Audiências Stats
      const hoje = new Date().toISOString().split("T")[0];
      const seteDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [audPendentes, audTratadas, audConfirmadas, audIgnoradas, audProximas] = await Promise.all([
        supabase.from("audiencias_detectadas").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("audiencias_detectadas").select("*", { count: "exact", head: true }).eq("status", "tratado"),
        supabase.from("audiencias_detectadas").select("*", { count: "exact", head: true }).eq("status", "confirmado"),
        supabase.from("audiencias_detectadas").select("*", { count: "exact", head: true }).eq("status", "ignorado"),
        supabase.from("audiencias_detectadas").select("*", { count: "exact", head: true })
          .eq("status", "pendente").gte("data_audiencia", hoje).lte("data_audiencia", seteDias),
      ]);

      const audienciasStats: AudienciasStatsRelatorio = {
        pendentes: audPendentes.count || 0,
        tratadas: audTratadas.count || 0,
        confirmadas: audConfirmadas.count || 0,
        ignoradas: audIgnoradas.count || 0,
        proximas7Dias: audProximas.count || 0,
        total: (audPendentes.count || 0) + (audTratadas.count || 0) + (audConfirmadas.count || 0) + (audIgnoradas.count || 0),
      };

      // 4. Intimações Stats
      const [intPendentes, intTratadas, intVencidas, intProximas, intEmAndamento] = await Promise.all([
        supabase.from("intimacoes_detectadas").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("intimacoes_detectadas").select("*", { count: "exact", head: true }).eq("status", "tratado"),
        supabase.from("intimacoes_detectadas").select("*", { count: "exact", head: true })
          .eq("status", "pendente").lt("data_limite", hoje),
        supabase.from("intimacoes_detectadas").select("*", { count: "exact", head: true })
          .eq("status", "pendente").gte("data_limite", hoje).lte("data_limite", seteDias),
        supabase.from("intimacoes_detectadas").select("*", { count: "exact", head: true }).eq("status", "em_andamento"),
      ]);

      const intimacoesStats: IntimacoesStatsRelatorio = {
        pendentes: intPendentes.count || 0,
        tratadas: intTratadas.count || 0,
        vencidas: intVencidas.count || 0,
        proximas7Dias: intProximas.count || 0,
        emAndamento: intEmAndamento.count || 0,
        total: (intPendentes.count || 0) + (intTratadas.count || 0) + (intEmAndamento.count || 0),
      };

      // 5. DJEN Stats
      const hojeInicio = `${hoje}T00:00:00`;
      const hojeFim = `${hoje}T23:59:59`;

      const [djenTotal, djenNaoLidas, djenHoje] = await Promise.all([
        supabase.from("publicacoes_djen").select("*", { count: "exact", head: true }),
        supabase.from("publicacoes_djen").select("*", { count: "exact", head: true }).eq("lida", false),
        supabase.from("publicacoes_djen").select("*", { count: "exact", head: true })
          .gte("created_at", hojeInicio).lte("created_at", hojeFim),
      ]);

      // Stats por coordenação
      const { data: pubsCoord } = await supabase
        .from("publicacoes_djen")
        .select(`
          lida,
          monitoramento:monitoramentos_djen(coordenacao:coordenacoes(id, nome))
        `);

      const coordMap = new Map<string, { total: number; naoLidas: number; nome: string }>();
      (pubsCoord || []).forEach((p: any) => {
        const coordId = p.monitoramento?.coordenacao?.id;
        const coordNome = p.monitoramento?.coordenacao?.nome || "Sem coordenação";
        if (coordId) {
          const curr = coordMap.get(coordId) || { total: 0, naoLidas: 0, nome: coordNome };
          curr.total++;
          if (!p.lida) curr.naoLidas++;
          coordMap.set(coordId, curr);
        }
      });

      const djenStats: DjenStatsRelatorio = {
        totalPublicacoes: djenTotal.count || 0,
        publicacoesNaoLidas: djenNaoLidas.count || 0,
        publicacoesHoje: djenHoje.count || 0,
        porCoordenacao: Array.from(coordMap.values())
          .map((v) => ({ coordenacao: v.nome, total: v.total, naoLidas: v.naoLidas }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10),
      };

      // 6. Notificações Stats
      const [notTotal, notNaoLidas] = await Promise.all([
        supabase.from("notificacoes").select("*", { count: "exact", head: true }),
        supabase.from("notificacoes").select("*", { count: "exact", head: true }).eq("lida", false),
      ]);

      const { count: prazosUrgentesCount } = await supabase
        .from("tarefas")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente")
        .gte("data_vencimento", hoje)
        .lte("data_vencimento", new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

      const notificacoesStats: NotificacoesStatsRelatorio = {
        total: notTotal.count || 0,
        naoLidas: notNaoLidas.count || 0,
        prazosUrgentes: prazosUrgentesCount || 0,
        alertasSistema: 0, // Pode ser expandido conforme necessidade
      };

      return {
        dashboardStats,
        coordenacoes,
        audienciasStats,
        intimacoesStats,
        djenStats,
        notificacoesStats,
      };
    },
  });
}
