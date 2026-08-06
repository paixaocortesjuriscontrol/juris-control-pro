import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  LabelList,
} from "recharts";
import { BarChart3, HelpCircle } from "lucide-react";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";

type Serie = {
  mes: string;
  Prazos: number;
  "Audiências": number;
  Eventos: number;
  Tarefas: number;
  total: number;
};

const CORES = {
  Prazos: "#f2545b",
  "Audiências": "#f5c04a",
  Eventos: "#1fa971",
  Tarefas: "#3b9ae1",
} as const;

const MESES = 12;
const ANO_INICIAL = 2022;

function buildBucketsUltimos12(): { key: string; label: string }[] {
  const base = startOfMonth(new Date());
  const list: { key: string; label: string }[] = [];
  for (let i = MESES - 1; i >= 0; i--) {
    const d = subMonths(base, i);
    const label =
      d.getMonth() === 0
        ? `${format(d, "LLLL", { locale: ptBR })}/${format(d, "yyyy")}`
        : format(d, "LLLL", { locale: ptBR });
    list.push({ key: format(d, "yyyy-MM"), label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return list;
}

function buildBucketsDoAno(ano: number): { key: string; label: string }[] {
  const list: { key: string; label: string }[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(ano, m, 1);
    const label = format(d, "LLLL", { locale: ptBR });
    list.push({ key: format(d, "yyyy-MM"), label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return list;
}

function buildBucketsPorAno(): { key: string; label: string }[] {
  const atual = new Date().getFullYear();
  const list: { key: string; label: string }[] = [];
  for (let a = ANO_INICIAL; a <= atual; a++) list.push({ key: String(a), label: String(a) });
  return list;
}

export default function Indicadores() {
  const { user } = useAuth();
  const { isAdmin, coordenacoes } = useCoordenacoesDoUsuario();
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [usuarioId, setUsuarioId] = useState<string>("todos");
  const [ano, setAno] = useState<string>("ultimos12");

  // Papel do usuário: só admin/coordenador/assistente coordenador podem ver de outros
  const { data: roles } = useQuery({
    queryKey: ["indicadores-roles", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data || []).map((r: any) => r.role as string);
    },
  });

  const podeVerOutros =
    isAdmin || (roles || []).some((r) => r === "admin" || r === "coordenador" || r === "assistente_coordenador");

  // Coordenações disponíveis: admin = todas; coordenador = só as suas
  const coordenacoesDisponiveis = coordenacoes;

  // Usuários da coordenação escolhida (ou de todas as coordenações permitidas)
  const { data: usuarios } = useQuery({
    queryKey: [
      "indicadores-usuarios",
      coordenacaoId,
      podeVerOutros,
      coordenacoesDisponiveis.map((c) => c.id).join(","),
    ],
    enabled: podeVerOutros,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const ids =
        coordenacaoId !== "todas" ? [coordenacaoId] : coordenacoesDisponiveis.map((c) => c.id);
      if (ids.length === 0) return [] as { id: string; nome: string }[];

      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .in("coordenacao_id", ids);
      const { data: coords } = await supabase
        .from("coordenacoes")
        .select("coordenador_id")
        .in("id", ids);

      const userIds = Array.from(
        new Set([
          ...(membros || []).map((m: any) => m.usuario_id),
          ...(coords || []).map((c: any) => c.coordenador_id),
        ].filter(Boolean))
      );
      if (userIds.length === 0) return [] as { id: string; nome: string }[];

      const { data: profs } = await supabase
        .from("profiles_basic" as any)
        .select("id, nome")
        .in("id", userIds);

      return ((profs || []) as any[])
        .map((p) => ({ id: p.id as string, nome: (p.nome as string) || "Sem nome" }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });

  const anosDisponiveis = useMemo(() => {
    const atual = new Date().getFullYear();
    const list: number[] = [];
    for (let a = atual; a >= ANO_INICIAL; a--) list.push(a);
    return list;
  }, []);

  const agrupamento: "mes" | "ano" = ano === "todos" ? "ano" : "mes";

  const buckets = useMemo(() => {
    if (ano === "ultimos12") return buildBucketsUltimos12();
    if (ano === "todos") return buildBucketsPorAno();
    return buildBucketsDoAno(Number(ano));
  }, [ano]);

  const { inicio, fim } = useMemo(() => {
    if (ano === "ultimos12")
      return { inicio: startOfMonth(subMonths(new Date(), MESES - 1)).toISOString(), fim: null as string | null };
    if (ano === "todos")
      return { inicio: new Date(Date.UTC(ANO_INICIAL, 0, 1)).toISOString(), fim: null as string | null };
    const a = Number(ano);
    return {
      inicio: new Date(Date.UTC(a, 0, 1)).toISOString(),
      fim: new Date(Date.UTC(a + 1, 0, 1)).toISOString() as string | null,
    };
  }, [ano]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "indicadores-atividades-concluidas",
      user?.id,
      podeVerOutros,
      coordenacaoId,
      usuarioId,
      ano,
      coordenacoesDisponiveis.map((c) => c.id).join(","),
    ],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      // Agregação feita no servidor (evita o limite de 1000 linhas do PostgREST)
      const { data: rows, error } = await supabase.rpc("get_indicadores_atividades" as any, {
        p_inicio: inicio,
        p_fim: fim,
        p_coordenacao_id: podeVerOutros && coordenacaoId !== "todas" ? coordenacaoId : null,
        p_usuario_id: podeVerOutros && usuarioId !== "todos" ? usuarioId : null,
        p_agrupamento: agrupamento,
      });
      if (error) throw error;

      const mapa = new Map<string, Serie>();
      for (const b of buckets) {
        mapa.set(b.key, { mes: b.label, Prazos: 0, "Audiências": 0, Eventos: 0, Tarefas: 0, total: 0 });
      }

      for (const r of (rows ?? []) as any[]) {
        const item = mapa.get(r.periodo as string);
        if (!item) continue;
        item.Prazos = Number(r.prazos) || 0;
        item["Audiências"] = Number(r.audiencias) || 0;
        item.Eventos = Number(r.eventos) || 0;
        item.Tarefas = Number(r.tarefas) || 0;
        item.total = item.Prazos + item["Audiências"] + item.Eventos + item.Tarefas;
      }

      return buckets.map((b) => mapa.get(b.key)!);
    },
  });

  const totais = useMemo(() => {
    const acc = { Prazos: 0, "Audiências": 0, Eventos: 0, Tarefas: 0, total: 0 };
    for (const row of data ?? []) {
      acc.Prazos += row.Prazos;
      acc["Audiências"] += row["Audiências"];
      acc.Eventos += row.Eventos;
      acc.Tarefas += row.Tarefas;
      acc.total += row.total;
    }
    return acc;
  }, [data]);

  return (
    <MainLayout
      title="Indicadores"
      subtitle={
        ano === "ultimos12"
          ? "Produtividade por tipo de atividade nos últimos 12 meses"
          : ano === "todos"
          ? "Produtividade por tipo de atividade, consolidada por ano"
          : `Produtividade por tipo de atividade em ${ano}`
      }
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ultimos12">Últimos 12 meses</SelectItem>
              <SelectItem value="todos">Todos os anos</SelectItem>
              {anosDisponiveis.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {podeVerOutros ? (
            <>
            <Select
              value={coordenacaoId}
              onValueChange={(v) => {
                setCoordenacaoId(v);
                setUsuarioId("todos");
              }}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Coordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">
                  {isAdmin ? "Todas as coordenações" : "Todas as minhas coordenações"}
                </SelectItem>
                {coordenacoesDisponiveis.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={usuarioId} onValueChange={setUsuarioId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os usuários</SelectItem>
                {(usuarios ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Minhas atividades</span>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(
            [
              ["Total", totais.total, "hsl(var(--primary))"],
              ["Prazos", totais.Prazos, CORES.Prazos],
              ["Audiências", totais["Audiências"], CORES["Audiências"]],
              ["Eventos", totais.Eventos, CORES.Eventos],
              ["Tarefas", totais.Tarefas, CORES.Tarefas],
            ] as [string, number, string][]
          ).map(([label, value, cor]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-16 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Atividades concluídas
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </CardTitle>
            <CardDescription>
              Confira todas as atividades concluídas nos últimos 12 meses para avaliar a produtividade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[460px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={480}>
                <BarChart data={data ?? []} layout="vertical" margin={{ left: 24, right: 48, top: 8, bottom: 8 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="mes"
                    width={100}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Prazos" stackId="a" fill={CORES.Prazos} />
                  <Bar dataKey="Audiências" stackId="a" fill={CORES["Audiências"]} />
                  <Bar dataKey="Eventos" stackId="a" fill={CORES.Eventos} />
                  <Bar dataKey="Tarefas" stackId="a" fill={CORES.Tarefas} radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="total" position="right" style={{ fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}