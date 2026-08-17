import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { format, startOfYear, startOfMonth, subMonths } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LabelList } from "recharts";
import { Trophy, FileDown, Medal, Target, AlertTriangle, CheckCircle2, Gauge, TrendingUp, Info } from "lucide-react";
import { gerarRankingPdfCompleto } from "@/lib/rankingAtendimentoPdf";

const NAVY = "hsl(222 47% 18%)";
const GOLD = "hsl(43 74% 49%)";
const VERDE = "#1fa971";
const VERMELHO = "#f2545b";
const AZUL = "#3b9ae1";

type LinhaGeral = {
  usuario_id: string;
  nome: string;
  abertos_prazos: number;
  abertos_tarefas: number;
  abertos_audiencias: number;
  abertos_eventos: number;
  abertos_parcelamentos: number;
  abertos_total: number;
  concluidos: number;
  concluidos_no_prazo: number;
  concluidos_atraso: number;
  /** Conclusões com prazo próprio (data fatal/prevista) — base do % no prazo */
  concluidos_avaliaveis?: number;
  prazos_perdidos: number;
  atividades_total: number;
  atividades_concluidas: number;
};

type LinhaTst = {
  usuario_id: string;
  nome: string;
  total: number;
  sem_pendencia: number;
  com_pendencia: number;
  pendencias_total: number;
  judit_preenchidos: number;
  prontos: number;
};

function pct(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

const HOJE = () => format(new Date(), "yyyy-MM-dd");

type Preset = "mes" | "trimestre" | "semestre" | "ano" | "custom";

function rangeDoPreset(preset: Preset): { inicio: string; fim: string } | null {
  const hoje = new Date();
  if (preset === "mes") return { inicio: format(startOfMonth(hoje), "yyyy-MM-dd"), fim: HOJE() };
  if (preset === "trimestre") return { inicio: format(startOfMonth(subMonths(hoje, 2)), "yyyy-MM-dd"), fim: HOJE() };
  if (preset === "semestre") return { inicio: format(startOfMonth(subMonths(hoje, 5)), "yyyy-MM-dd"), fim: HOJE() };
  if (preset === "ano") return { inicio: format(startOfYear(hoje), "yyyy-MM-dd"), fim: HOJE() };
  return null;
}

export default function RankingAtendimento() {
  const { user } = useAuth();
  const { isAdmin, coordenacoes } = useCoordenacoesDoUsuario();

  const [inicio, setInicio] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [fim, setFim] = useState(format(new Date(), "yyyy-MM-dd"));
  const [coordenacaoId, setCoordenacaoId] = useState("todas");
  const [usuarioId, setUsuarioId] = useState("todos");
  const [aba, setAba] = useState("geral");
  const [preset, setPreset] = useState<Preset>("ano");

  const aplicarPreset = (p: Preset) => {
    setPreset(p);
    const r = rangeDoPreset(p);
    if (r) {
      setInicio(r.inicio);
      setFim(r.fim);
    }
  };

  const { data: roles } = useQuery({
    queryKey: ["ranking-roles", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data || []).map((r: any) => r.role as string);
    },
  });

  const podeVerOutros =
    isAdmin || (roles || []).some((r) => r === "admin" || r === "coordenador" || r === "assistente_coordenador");

  const { data: usuarios } = useQuery({
    queryKey: ["ranking-usuarios", coordenacaoId, coordenacoes.map((c) => c.id).join(",")],
    enabled: podeVerOutros,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const ids = coordenacaoId !== "todas" ? [coordenacaoId] : coordenacoes.map((c) => c.id);
      if (ids.length === 0) return [] as { id: string; nome: string }[];
      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .in("coordenacao_id", ids);
      const { data: coords } = await supabase.from("coordenacoes").select("coordenador_id").in("id", ids);
      const userIds = Array.from(
        new Set(
          [...(membros || []).map((m: any) => m.usuario_id), ...(coords || []).map((c: any) => c.coordenador_id)].filter(
            Boolean
          )
        )
      );
      if (userIds.length === 0) return [] as { id: string; nome: string }[];
      const { data: profs } = await supabase.from("profiles_basic" as any).select("id, nome").in("id", userIds);
      return ((profs || []) as any[])
        .map((p) => ({ id: p.id as string, nome: (p.nome as string) || "Sem nome" }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });

  const filtroParams = {
    p_inicio: inicio,
    p_fim: fim,
    p_coordenacao_id: coordenacaoId === "todas" ? null : coordenacaoId,
    p_usuario_id: !podeVerOutros ? user?.id ?? null : usuarioId === "todos" ? null : usuarioId,
  };

  const geralQuery = useQuery({
    queryKey: ["ranking-geral", filtroParams],
    enabled: !!inicio && !!fim,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ranking_atendimento_geral" as any, filtroParams as any);
      if (error) throw error;
      return (data || []) as unknown as LinhaGeral[];
    },
  });

  const tstQuery = useQuery({
    queryKey: ["ranking-tst", filtroParams],
    enabled: !!inicio && !!fim,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ranking_atendimento_tst" as any, filtroParams as any);
      if (error) throw error;
      return (data || []) as unknown as LinhaTst[];
    },
  });

  const geral = geralQuery.data || [];
  const tst = tstQuery.data || [];

  const totaisGeral = useMemo(() => {
    return geral.reduce(
      (acc, l) => ({
        abertos: acc.abertos + Number(l.abertos_total),
        concluidos: acc.concluidos + Number(l.concluidos),
        noPrazo: acc.noPrazo + Number(l.concluidos_no_prazo),
        avaliaveis: acc.avaliaveis + Number(l.concluidos_avaliaveis ?? 0),
        perdidos: acc.perdidos + Number(l.prazos_perdidos),
        atividades: acc.atividades + Number(l.atividades_total || 0),
        atividadesConcl: acc.atividadesConcl + Number(l.atividades_concluidas || 0),
      }),
      { abertos: 0, concluidos: 0, noPrazo: 0, avaliaveis: 0, perdidos: 0, atividades: 0, atividadesConcl: 0 }
    );
  }, [geral]);

  const totaisTst = useMemo(() => {
    return tst.reduce(
      (acc, l) => ({
        total: acc.total + Number(l.total),
        sem: acc.sem + Number(l.sem_pendencia),
        com: acc.com + Number(l.com_pendencia),
        pend: acc.pend + Number(l.pendencias_total),
        prontos: acc.prontos + Number(l.prontos || 0),
      }),
      { total: 0, sem: 0, com: 0, pend: 0, prontos: 0 }
    );
  }, [tst]);

  const graficoGeral = useMemo(
    () =>
      [...geral]
        .sort((a, b) => Number(b.concluidos) - Number(a.concluidos))
        .slice(0, 12)
        .map((l) => ({
          nome: l.nome.split(" ").slice(0, 2).join(" "),
          Criados: Number(l.abertos_total),
          "No prazo": Number(l.concluidos_no_prazo),
          "Com atraso": Number(l.concluidos_atraso),
        })),
    [geral]
  );

  const graficoTst = useMemo(
    () =>
      [...tst]
        .sort((a, b) => Number(b.prontos || 0) - Number(a.prontos || 0) || Number(b.sem_pendencia) - Number(a.sem_pendencia))
        .slice(0, 12)
        .map((l) => ({
          nome: l.nome.split(" ").slice(0, 2).join(" "),
          Prontos: Number(l.prontos || 0),
          "Sem pendência": Number(l.sem_pendencia),
          "Com pendência": Number(l.com_pendencia),
        })),
    [tst]
  );

  const nomeCoordenacao =
    coordenacaoId === "todas" ? "Todas as coordenações" : coordenacoes.find((c) => c.id === coordenacaoId)?.nome || "-";
  const nomeUsuario = usuarioId === "todos" ? "Todos os usuários" : usuarios?.find((u) => u.id === usuarioId)?.nome || "-";
  const periodoLabel = `${format(new Date(inicio + "T12:00:00"), "dd/MM/yyyy")} a ${format(
    new Date(fim + "T12:00:00"),
    "dd/MM/yyyy"
  )}`;

  const exportarPdf = () => {
    const topo = (arr: any[], n = 12) => arr.slice(0, n);
    const nomesCurtos = (arr: any[]) => topo(arr).map((l) => l.nome.split(" ").slice(0, 2).join(" "));

    gerarRankingPdfCompleto({
      titulo: "Ranking de Atendimento",
      periodo: periodoLabel,
      filtros: `${nomeCoordenacao} | ${nomeUsuario}`,
      nomeArquivo: "ranking_atendimento_completo",
      secoes: [
        {
          titulo: "Visão Geral",
          subtitulo: "Produtividade e cumprimento de prazos por profissional",
          notas: [
            "Criados no período: itens (prazos, tarefas, audiências, eventos, parcelamentos) cadastrados no período em que o profissional é autor ou responsável. Cargas/importações não entram.",
            "Atividades: subatividades vinculadas a um item; contadas quando o profissional é responsável, envolvido ou concluiu a atividade.",
          ],
          resumo: [
            { label: "Criados no período", valor: totaisGeral.abertos },
            { label: "Concluídos", valor: totaisGeral.concluidos },
            { label: "No prazo", valor: totaisGeral.noPrazo },
            { label: "% no prazo", valor: `${pct(totaisGeral.noPrazo, totaisGeral.concluidos)}%` },
            { label: "Atividades concl.", valor: `${totaisGeral.atividadesConcl}/${totaisGeral.atividades}` },
            { label: "Prazos perdidos", valor: totaisGeral.perdidos },
          ],
          grafico: {
            titulo: "Top 12 — criados, no prazo e com atraso",
            categorias: nomesCurtos(geralOrdenado),
            series: [
              { nome: "Criados", valores: topo(geralOrdenado).map((l) => Number(l.abertos_total)), cor: [59, 154, 225] },
              { nome: "No prazo", valores: topo(geralOrdenado).map((l) => Number(l.concluidos_no_prazo)), cor: [31, 169, 113] },
              { nome: "Com atraso", valores: topo(geralOrdenado).map((l) => Number(l.concluidos_atraso)), cor: [242, 84, 91] },
            ],
          },
          colunas: [
            { header: "#", width: 10, key: "pos" },
            { header: "Profissional", width: 58, key: "nome" },
            { header: "Criados", width: 22, key: "abertos_total", align: "right" },
            { header: "Prazos", width: 20, key: "abertos_prazos", align: "right" },
            { header: "Audiências", width: 24, key: "abertos_audiencias", align: "right" },
            { header: "Eventos", width: 20, key: "abertos_eventos", align: "right" },
            { header: "Parcelam.", width: 22, key: "abertos_parcelamentos", align: "right" },
            { header: "Concluídos", width: 24, key: "concluidos", align: "right" },
            { header: "No prazo", width: 22, key: "concluidos_no_prazo", align: "right" },
            { header: "Atraso", width: 20, key: "concluidos_atraso", align: "right" },
            { header: "Ativid.", width: 20, key: "atividades_total", align: "right" },
            { header: "Ativid. concl.", width: 26, key: "atividades_concluidas", align: "right" },
            { header: "% no prazo", width: 24, key: "taxa", align: "right" },
            { header: "Prazos perdidos", width: 28, key: "prazos_perdidos", align: "right" },
          ] as any,
          linhas: geralOrdenado.map((l, idx) => ({
            pos: String(idx + 1),
            nome: l.nome,
            abertos_total: l.abertos_total,
            abertos_prazos: l.abertos_prazos,
            abertos_audiencias: l.abertos_audiencias,
            abertos_eventos: l.abertos_eventos,
            abertos_parcelamentos: l.abertos_parcelamentos,
            concluidos: l.concluidos,
            concluidos_no_prazo: l.concluidos_no_prazo,
            concluidos_atraso: l.concluidos_atraso,
            atividades_total: l.atividades_total ?? 0,
            atividades_concluidas: l.atividades_concluidas ?? 0,
            taxa: `${pct(Number(l.concluidos_no_prazo), Number(l.concluidos))}%`,
            prazos_perdidos: l.prazos_perdidos,
          })),
        },
        {
          titulo: "Produtividade",
          subtitulo: "Volume entregue por profissional (itens concluídos + atividades concluídas)",
          resumo: [
            { label: "Itens concluídos", valor: totaisGeral.concluidos },
            { label: "Atividades concluídas", valor: totaisGeral.atividadesConcl },
            { label: "Entregas totais", valor: totaisGeral.concluidos + totaisGeral.atividadesConcl },
            { label: "Criados no período", valor: totaisGeral.abertos },
          ],
          grafico: {
            titulo: "Top 12 — volume entregue",
            categorias: nomesCurtos(produtividade),
            series: [
              { nome: "Itens concluídos", valores: topo(produtividade).map((l) => Number(l.concluidos)), cor: [24, 37, 68] },
              {
                nome: "Atividades concluídas",
                valores: topo(produtividade).map((l) => Number(l.atividades_concluidas || 0)),
                cor: [59, 154, 225],
              },
            ],
          },
          colunas: [
            { header: "#", width: 12, key: "pos" },
            { header: "Profissional", width: 70, key: "nome" },
            { header: "Criados no período", width: 38, key: "abertos_total", align: "right" },
            { header: "Itens concluídos", width: 34, key: "concluidos", align: "right" },
            { header: "Atividades concl.", width: 36, key: "atividades_concluidas", align: "right" },
            { header: "Entregas totais", width: 34, key: "entregas", align: "right" },
          ] as any,
          linhas: produtividade.map((l, idx) => ({
            pos: String(idx + 1),
            nome: l.nome,
            abertos_total: l.abertos_total,
            concluidos: l.concluidos,
            atividades_concluidas: l.atividades_concluidas ?? 0,
            entregas: l.entregas,
          })),
        },
        {
          titulo: "Pontualidade",
          subtitulo: "Cumprimento de prazos por profissional (mínimo de 5 conclusões para ranquear)",
          resumo: [
            { label: "Concluídos", valor: totaisGeral.concluidos },
            { label: "No prazo", valor: totaisGeral.noPrazo },
            { label: "% no prazo", valor: `${pct(totaisGeral.noPrazo, totaisGeral.concluidos)}%` },
            { label: "Prazos perdidos", valor: totaisGeral.perdidos },
          ],
          grafico: {
            titulo: "Top 12 — % no prazo x prazos perdidos",
            categorias: nomesCurtos(pontualidade.filter((l) => l.relevante)),
            series: [
              {
                nome: "% no prazo",
                valores: topo(pontualidade.filter((l) => l.relevante)).map((l) => l.taxa),
                cor: [31, 169, 113],
              },
              {
                nome: "Prazos perdidos",
                valores: topo(pontualidade.filter((l) => l.relevante)).map((l) => Number(l.prazos_perdidos)),
                cor: [242, 84, 91],
              },
            ],
          },
          colunas: [
            { header: "#", width: 12, key: "pos" },
            { header: "Profissional", width: 70, key: "nome" },
            { header: "Concluídos", width: 28, key: "concluidos", align: "right" },
            { header: "No prazo", width: 26, key: "concluidos_no_prazo", align: "right" },
            { header: "Com atraso", width: 28, key: "concluidos_atraso", align: "right" },
            { header: "% no prazo", width: 28, key: "taxa", align: "right" },
            { header: "Prazos perdidos", width: 34, key: "prazos_perdidos", align: "right" },
          ] as any,
          linhas: pontualidade.map((l, idx) => ({
            pos: String(idx + 1),
            nome: l.relevante ? l.nome : `${l.nome} (amostra baixa)`,
            concluidos: l.concluidos,
            concluidos_no_prazo: l.concluidos_no_prazo,
            concluidos_atraso: l.concluidos_atraso,
            taxa: `${l.taxa}%`,
            prazos_perdidos: l.prazos_perdidos,
          })),
        },
        ...(tstOrdenado.length > 0 ? [{
          titulo: "TST — Distribuição",
          subtitulo: "Qualidade do preenchimento dos dados da Distribuição TST",
          resumo: [
            { label: "Processos", valor: totaisTst.total },
            { label: "Marcados Pronto", valor: totaisTst.prontos },
            { label: "Sem pendência", valor: totaisTst.sem },
            { label: "Com pendência", valor: totaisTst.com },
            { label: "% completos", valor: `${pct(totaisTst.sem, totaisTst.total)}%` },
            { label: "Campos pendentes", valor: totaisTst.pend },
          ],
          grafico: {
            titulo: "Top 12 — processos marcados Pronto e preenchimento",
            categorias: nomesCurtos(tstOrdenado),
            series: [
              { nome: "Prontos", valores: topo(tstOrdenado).map((l) => Number(l.prontos || 0)), cor: [30, 58, 138] },
              { nome: "Sem pendência", valores: topo(tstOrdenado).map((l) => Number(l.sem_pendencia)), cor: [31, 169, 113] },
              { nome: "Com pendência", valores: topo(tstOrdenado).map((l) => Number(l.com_pendencia)), cor: [242, 84, 91] },
            ],
          },
          colunas: [
            { header: "#", width: 12, key: "pos" },
            { header: "Profissional", width: 70, key: "nome" },
            { header: "Processos", width: 28, key: "total", align: "right" },
            { header: "Prontos", width: 24, key: "prontos", align: "right" },
            { header: "Sem pendência", width: 32, key: "sem_pendencia", align: "right" },
            { header: "Com pendência", width: 32, key: "com_pendencia", align: "right" },
            { header: "% completos", width: 28, key: "taxa", align: "right" },
            { header: "Campos pendentes", width: 34, key: "pendencias_total", align: "right" },
            { header: "Judit preenchido", width: 32, key: "judit_preenchidos", align: "right" },
          ] as any,
          linhas: tstOrdenado.map((l, idx) => ({
            pos: String(idx + 1),
            nome: l.nome,
            total: l.total,
            prontos: l.prontos || 0,
            sem_pendencia: l.sem_pendencia,
            com_pendencia: l.com_pendencia,
            taxa: `${pct(Number(l.sem_pendencia), Number(l.total))}%`,
            pendencias_total: l.pendencias_total,
            judit_preenchidos: l.judit_preenchidos,
          })),
        }] as any : []),
      ],
    });
  };

  const medalha = (idx: number) =>
    idx === 0 ? "text-[hsl(43_74%_49%)]" : idx === 1 ? "text-muted-foreground" : idx === 2 ? "text-amber-700" : "";

  const geralOrdenado = useMemo(
    () =>
      [...geral].sort(
        (a, b) =>
          pct(Number(b.concluidos_no_prazo), Number(b.concluidos_avaliaveis ?? 0)) -
            pct(Number(a.concluidos_no_prazo), Number(a.concluidos_avaliaveis ?? 0)) ||
          Number(b.concluidos) - Number(a.concluidos)
      ),
    [geral]
  );

  // Produtividade: volume entregue (itens concluídos + atividades concluídas)
  const produtividade = useMemo(
    () =>
      [...geral]
        .map((l) => ({
          ...l,
          entregas: Number(l.concluidos) + Number(l.atividades_concluidas || 0),
        }))
        .sort((a, b) => b.entregas - a.entregas || Number(b.concluidos) - Number(a.concluidos)),
    [geral]
  );

  // Pontualidade: percentual no prazo (mínimo de 5 conclusões para entrar no ranking)
  const pontualidade = useMemo(
    () =>
      [...geral]
        .map((l) => ({
          ...l,
          avaliaveis: Number(l.concluidos_avaliaveis ?? 0),
          taxa: pct(Number(l.concluidos_no_prazo), Number(l.concluidos_avaliaveis ?? 0)),
          relevante: Number(l.concluidos_avaliaveis ?? 0) >= 5,
        }))
        .sort(
          (a, b) =>
            Number(b.relevante) - Number(a.relevante) ||
            b.taxa - a.taxa ||
            Number(a.prazos_perdidos) - Number(b.prazos_perdidos)
        ),
    [geral]
  );

  const graficoProdutividade = useMemo(
    () =>
      produtividade.slice(0, 12).map((l) => ({
        nome: l.nome.split(" ").slice(0, 2).join(" "),
        Concluídos: Number(l.concluidos),
        "Atividades concl.": Number(l.atividades_concluidas || 0),
      })),
    [produtividade]
  );

  const graficoPontualidade = useMemo(
    () =>
      pontualidade
        .filter((l) => l.relevante)
        .slice(0, 12)
        .map((l) => ({
          nome: l.nome.split(" ").slice(0, 2).join(" "),
          "% no prazo": l.taxa,
          "Prazos perdidos": Number(l.prazos_perdidos),
        })),
    [pontualidade]
  );

  const tstOrdenado = useMemo(
    () =>
      [...tst].sort(
        (a, b) =>
          Number(b.prontos || 0) - Number(a.prontos || 0) ||
          pct(Number(b.sem_pendencia), Number(b.total)) - pct(Number(a.sem_pendencia), Number(a.total)) ||
          Number(b.total) - Number(a.total)
      ),
    [tst]
  );

  return (
    <MainLayout
      title="Ranking de Atendimento"
      subtitle="Desempenho do escritório por profissional, coordenação e período"
    >
      <div className="space-y-4">
        {/* Filtros */}
        <Card className="border-l-4" style={{ borderLeftColor: GOLD }}>
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Período</p>
              <Select value={preset} onValueChange={(v) => aplicarPreset(v as Preset)}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes">Mês atual</SelectItem>
                  <SelectItem value="trimestre">Último trimestre</SelectItem>
                  <SelectItem value="semestre">Último semestre</SelectItem>
                  <SelectItem value="ano">Anual (ano corrente)</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Data inicial</p>
              <Input
                type="date"
                value={inicio}
                onChange={(e) => {
                  setInicio(e.target.value);
                  setPreset("custom");
                }}
                className="h-9 w-40"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Data final</p>
              <Input
                type="date"
                value={fim}
                onChange={(e) => {
                  setFim(e.target.value);
                  setPreset("custom");
                }}
                className="h-9 w-40"
              />
            </div>
            {podeVerOutros && (
              <>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Coordenação</p>
                  <Select
                    value={coordenacaoId}
                    onValueChange={(v) => {
                      setCoordenacaoId(v);
                      setUsuarioId("todos");
                    }}
                  >
                    <SelectTrigger className="h-9 w-64">
                      <SelectValue placeholder="Coordenação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as coordenações</SelectItem>
                      {[...coordenacoes]
                        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Profissional</p>
                  <Select value={usuarioId} onValueChange={setUsuarioId}>
                    <SelectTrigger className="h-9 w-56">
                      <SelectValue placeholder="Profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os usuários</SelectItem>
                      {(usuarios || []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="ml-auto">
              <Button onClick={exportarPdf} className="gap-2">
                <FileDown className="w-4 h-4" />
                Exportar PDF (todas as abas)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Legenda dos indicadores */}
        <Card className="bg-muted/40">
          <CardContent className="p-4 grid gap-2 md:grid-cols-2 text-xs text-muted-foreground">
            <p className="flex gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">Criados no período</strong> (antes “Abertos”): itens — prazos,
                tarefas, audiências, eventos e parcelamentos — cadastrados dentro do período em que o profissional é o
                autor do cadastro ou responsável. Cargas e importações em massa não são contadas.
              </span>
            </p>
            <p className="flex gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">Atividades concl.</strong>: subatividades criadas dentro de um item
                (aba “Atividades” da tarefa) e concluídas no período, em que o profissional é responsável, envolvido ou
                quem concluiu. Fica próximo de zero porque o recurso de atividades ainda é pouco usado — quanto mais as
                equipes registrarem atividades, mais esse número cresce.
              </span>
            </p>
          </CardContent>
        </Card>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="geral" className="gap-2">
              <Trophy className="w-4 h-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="produtividade" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Produtividade
            </TabsTrigger>
            <TabsTrigger value="pontualidade" className="gap-2">
              <Gauge className="w-4 h-4" />
              Pontualidade
            </TabsTrigger>
            <TabsTrigger value="tst" className="gap-2">
              <Target className="w-4 h-4" />
              TST
            </TabsTrigger>
          </TabsList>

          {/* ---------------- GERAL ---------------- */}
          <TabsContent value="geral" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {(
                [
                  ["Criados no período", totaisGeral.abertos, AZUL],
                  ["Concluídos", totaisGeral.concluidos, NAVY],
                  ["Concluídos no prazo", totaisGeral.noPrazo, VERDE],
                  ["% no prazo", `${pct(totaisGeral.noPrazo, totaisGeral.avaliaveis)}%`, GOLD],
                  ["Prazos perdidos", totaisGeral.perdidos, VERMELHO],
                ] as [string, number | string, string][]
              ).map(([label, valor, cor]) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                    </div>
                    {geralQuery.isLoading ? (
                      <Skeleton className="h-7 w-16 mt-2" />
                    ) : (
                      <p className="text-2xl font-bold mt-1">{valor}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top 12 — produtividade e pontualidade</CardTitle>
                <CardDescription>Itens criados no período, concluídos no prazo e concluídos com atraso</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {geralQuery.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoGeral} margin={{ top: 16, right: 8, bottom: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="nome" angle={-25} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Criados" fill={AZUL} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="No prazo" fill={VERDE} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Com atraso" fill={VERMELHO} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking detalhado</CardTitle>
                <CardDescription>Ordenado pelo percentual de conclusões dentro do prazo</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead className="text-right">Criados</TableHead>
                      <TableHead className="text-right">Prazos</TableHead>
                      <TableHead className="text-right">Audiências</TableHead>
                      <TableHead className="text-right">Eventos</TableHead>
                      <TableHead className="text-right">Parcelam.</TableHead>
                      <TableHead className="text-right">Concluídos</TableHead>
                      <TableHead className="text-right">No prazo</TableHead>
                      <TableHead className="text-right">Atraso</TableHead>
                      <TableHead className="text-right">Atividades</TableHead>
                      <TableHead className="text-right">Ativid. concl.</TableHead>
                      <TableHead className="text-right">% no prazo</TableHead>
                      <TableHead className="text-right">Prazos perdidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geralQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={14}>
                          <Skeleton className="h-24 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : geralOrdenado.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="text-center text-muted-foreground py-10">
                          Nenhum dado no período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      geralOrdenado.map((l, idx) => (
                        <TableRow key={l.usuario_id}>
                          <TableCell>
                            <span className="flex items-center gap-1 font-semibold">
                              {idx < 3 && <Medal className={`w-4 h-4 ${medalha(idx)}`} />}
                              {idx + 1}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell className="text-right">{l.abertos_total}</TableCell>
                          <TableCell className="text-right">{l.abertos_prazos}</TableCell>
                          <TableCell className="text-right">{l.abertos_audiencias}</TableCell>
                          <TableCell className="text-right">{l.abertos_eventos}</TableCell>
                          <TableCell className="text-right">{l.abertos_parcelamentos}</TableCell>
                          <TableCell className="text-right font-semibold">{l.concluidos}</TableCell>
                          <TableCell className="text-right text-green-600">{l.concluidos_no_prazo}</TableCell>
                          <TableCell className="text-right text-amber-600">{l.concluidos_atraso}</TableCell>
                          <TableCell className="text-right">{l.atividades_total ?? 0}</TableCell>
                          <TableCell className="text-right text-blue-600">{l.atividades_concluidas ?? 0}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {pct(Number(l.concluidos_no_prazo), Number(l.concluidos_avaliaveis ?? 0))}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(l.prazos_perdidos) > 0 ? (
                              <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                                <AlertTriangle className="w-3 h-3" />
                                {l.prazos_perdidos}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- TST ---------------- */}
          {/* ---------------- PRODUTIVIDADE ---------------- */}
          <TabsContent value="produtividade" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(
                [
                  ["Itens concluídos", totaisGeral.concluidos, NAVY],
                  ["Atividades concluídas", totaisGeral.atividadesConcl, AZUL],
                  ["Entregas totais", totaisGeral.concluidos + totaisGeral.atividadesConcl, VERDE],
                  ["Criados no período", totaisGeral.abertos, GOLD],
                ] as [string, number | string, string][]
              ).map(([label, valor, cor]) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                    </div>
                    {geralQuery.isLoading ? (
                      <Skeleton className="h-7 w-16 mt-2" />
                    ) : (
                      <p className="text-2xl font-bold mt-1">{valor}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top 12 — volume entregue</CardTitle>
                <CardDescription>Itens concluídos e atividades concluídas no período</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {geralQuery.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoProdutividade} margin={{ top: 16, right: 8, bottom: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="nome" angle={-25} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Concluídos" fill={NAVY} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="Concluídos" position="top" style={{ fontSize: 10 }} />
                      </Bar>
                      <Bar dataKey="Atividades concl." fill={AZUL} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking de produtividade</CardTitle>
                <CardDescription>Ordenado pelo total de entregas (itens + atividades concluídas)</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead className="text-right">Criados</TableHead>
                      <TableHead className="text-right">Concluídos</TableHead>
                      <TableHead className="text-right">Atividades concl.</TableHead>
                      <TableHead className="text-right">Entregas totais</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geralQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-24 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : produtividade.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          Nenhum dado no período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      produtividade.map((l, idx) => (
                        <TableRow key={l.usuario_id}>
                          <TableCell>
                            <span className="flex items-center gap-1 font-semibold">
                              {idx < 3 && <Medal className={`w-4 h-4 ${medalha(idx)}`} />}
                              {idx + 1}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell className="text-right">{l.abertos_total}</TableCell>
                          <TableCell className="text-right font-semibold">{l.concluidos}</TableCell>
                          <TableCell className="text-right text-blue-600">{l.atividades_concluidas ?? 0}</TableCell>
                          <TableCell className="text-right font-semibold">{l.entregas}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- PONTUALIDADE ---------------- */}
          <TabsContent value="pontualidade" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(
                [
                  ["Concluídos", totaisGeral.concluidos, NAVY],
                  ["No prazo", totaisGeral.noPrazo, VERDE],
                  ["% no prazo", `${pct(totaisGeral.noPrazo, totaisGeral.avaliaveis)}%`, GOLD],
                  ["Prazos perdidos", totaisGeral.perdidos, VERMELHO],
                ] as [string, number | string, string][]
              ).map(([label, valor, cor]) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                    </div>
                    {geralQuery.isLoading ? (
                      <Skeleton className="h-7 w-16 mt-2" />
                    ) : (
                      <p className="text-2xl font-bold mt-1">{valor}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top 12 — pontualidade</CardTitle>
                <CardDescription>
                  Percentual no prazo (mínimo de 5 conclusões com prazo próprio no período)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {geralQuery.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoPontualidade} margin={{ top: 16, right: 8, bottom: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="nome" angle={-25} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Bar dataKey="% no prazo" fill={VERDE} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="% no prazo" position="top" style={{ fontSize: 10 }} />
                      </Bar>
                      <Bar dataKey="Prazos perdidos" fill={VERMELHO} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking de pontualidade</CardTitle>
                <CardDescription>
                  O percentual considera apenas conclusões com prazo próprio (data fatal/prevista). Tarefas vindas de
                  importações sem prazo próprio — em que a data do compromisso é a própria data de conclusão — ficam de
                  fora do cálculo. Quem tem menos de 5 conclusões avaliáveis aparece ao final.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead className="text-right">Concluídos</TableHead>
                      <TableHead className="text-right">Com prazo</TableHead>
                      <TableHead className="text-right">No prazo</TableHead>
                      <TableHead className="text-right">Atraso</TableHead>
                      <TableHead className="text-right">% no prazo</TableHead>
                      <TableHead className="text-right">Prazos perdidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geralQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Skeleton className="h-24 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : pontualidade.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                          Nenhum dado no período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      pontualidade.map((l, idx) => (
                        <TableRow key={l.usuario_id} className={l.relevante ? "" : "opacity-70"}>
                          <TableCell>
                            <span className="flex items-center gap-1 font-semibold">
                              {l.relevante && idx < 3 && <Medal className={`w-4 h-4 ${medalha(idx)}`} />}
                              {idx + 1}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {l.nome}
                            {!l.relevante && (
                              <span className="ml-2 text-xs text-muted-foreground">(amostra baixa)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{l.concluidos}</TableCell>
                          <TableCell className="text-right text-green-600">{l.concluidos_no_prazo}</TableCell>
                          <TableCell className="text-right text-amber-600">{l.concluidos_atraso}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {l.taxa}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(l.prazos_perdidos) > 0 ? (
                              <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                                <AlertTriangle className="w-3 h-3" />
                                {l.prazos_perdidos}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tst" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {(
                [
                  ["Processos", totaisTst.total, NAVY],
                  ["Marcados Pronto", totaisTst.prontos, NAVY],
                  ["Sem pendência", totaisTst.sem, VERDE],
                  ["Com pendência", totaisTst.com, VERMELHO],
                  ["% completos", `${pct(totaisTst.sem, totaisTst.total)}%`, GOLD],
                  ["Campos pendentes", totaisTst.pend, AZUL],
                ] as [string, number | string, string][]
              ).map(([label, valor, cor]) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                    </div>
                    {tstQuery.isLoading ? (
                      <Skeleton className="h-7 w-16 mt-2" />
                    ) : (
                      <p className="text-2xl font-bold mt-1">{valor}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top 12 — processos marcados Pronto e preenchimento</CardTitle>
                <CardDescription>
                  "Prontos" = processos marcados como Pronto para enviar dentro do período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {tstQuery.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoTst} margin={{ top: 16, right: 8, bottom: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="nome" angle={-25} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Prontos" fill={NAVY} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="Prontos" position="top" style={{ fontSize: 10 }} />
                      </Bar>
                      <Bar dataKey="Sem pendência" fill={VERDE} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="Sem pendência" position="top" style={{ fontSize: 10 }} />
                      </Bar>
                      <Bar dataKey="Com pendência" fill={VERMELHO} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking detalhado — TST</CardTitle>
                <CardDescription>Ordenado pela quantidade de processos marcados como Pronto no período</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead className="text-right">Processos</TableHead>
                      <TableHead className="text-right">Prontos</TableHead>
                      <TableHead className="text-right">Sem pendência</TableHead>
                      <TableHead className="text-right">Com pendência</TableHead>
                      <TableHead className="text-right">% completos</TableHead>
                      <TableHead className="text-right">Campos pendentes</TableHead>
                      <TableHead className="text-right">Judit preenchido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tstQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <Skeleton className="h-24 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : tstOrdenado.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                          Nenhum dado no período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      tstOrdenado.map((l, idx) => (
                        <TableRow key={l.usuario_id}>
                          <TableCell>
                            <span className="flex items-center gap-1 font-semibold">
                              {idx < 3 && <Medal className={`w-4 h-4 ${medalha(idx)}`} />}
                              {idx + 1}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell className="text-right font-semibold">{l.total}</TableCell>
                          <TableCell className="text-right font-semibold" style={{ color: NAVY }}>
                            {l.prontos || 0}
                          </TableCell>
                          <TableCell className="text-right text-green-600">{l.sem_pendencia}</TableCell>
                          <TableCell className="text-right text-destructive">{l.com_pendencia}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{pct(Number(l.sem_pendencia), Number(l.total))}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">{l.pendencias_total}</TableCell>
                          <TableCell className="text-right">{l.judit_preenchidos}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
