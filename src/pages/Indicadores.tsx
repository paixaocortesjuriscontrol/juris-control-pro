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

function buildBuckets(): { key: string; label: string }[] {
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

export default function Indicadores() {
  const { user } = useAuth();
  const [escopo, setEscopo] = useState<"minhas" | "todas">("minhas");

  const buckets = useMemo(() => buildBuckets(), []);
  const inicio = useMemo(() => startOfMonth(subMonths(new Date(), MESES - 1)).toISOString(), []);

  const { data, isLoading } = useQuery({
    queryKey: ["indicadores-atividades-concluidas", user?.id, escopo],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const soMinhas = escopo === "minhas";

      let qTarefas = supabase
        .from("tarefas")
        .select("tipo_tarefa,updated_at,data_vencimento,status,responsavel_id")
        .eq("status", "cumprido")
        .gte("updated_at", inicio);
      if (soMinhas) qTarefas = qTarefas.eq("responsavel_id", user!.id);

      let qAud = supabase
        .from("audiencias_detectadas")
        .select("updated_at,data_audiencia,status,tratado_por,criado_por")
        .in("status", ["tratado", "concluido"])
        .gte("updated_at", inicio);
      if (soMinhas) qAud = qAud.or(`tratado_por.eq.${user!.id},criado_por.eq.${user!.id}`);

      let qEventos = supabase
        .from("eventos_agenda")
        .select("updated_at,concluido_em,data_inicio,status,criado_por")
        .in("status", ["concluido", "cumprido", "realizado"])
        .gte("updated_at", inicio);
      if (soMinhas) qEventos = qEventos.eq("criado_por", user!.id);

      const [tarefas, audiencias, eventos] = await Promise.all([qTarefas, qAud, qEventos]);
      if (tarefas.error) throw tarefas.error;
      if (audiencias.error) throw audiencias.error;
      if (eventos.error) throw eventos.error;

      const mapa = new Map<string, Serie>();
      for (const b of buckets) {
        mapa.set(b.key, { mes: b.label, Prazos: 0, "Audiências": 0, Eventos: 0, Tarefas: 0, total: 0 });
      }

      const add = (iso: string | null | undefined, campo: keyof typeof CORES) => {
        if (!iso) return;
        const key = iso.slice(0, 7);
        const item = mapa.get(key);
        if (!item) return;
        item[campo] += 1;
        item.total += 1;
      };

      for (const t of tarefas.data ?? []) {
        const tipo = (t as any).tipo_tarefa as string | null;
        add((t as any).updated_at, tipo === "PRAZO" ? "Prazos" : "Tarefas");
      }
      for (const a of audiencias.data ?? []) add((a as any).updated_at, "Audiências");
      for (const e of eventos.data ?? [])
        add((e as any).concluido_em ?? (e as any).updated_at, "Eventos");

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
      subtitle="Produtividade por tipo de atividade nos últimos 12 meses"
      headerActions={
        <Select value={escopo} onValueChange={(v) => setEscopo(v as "minhas" | "todas")}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minhas">Minha responsabilidade</SelectItem>
            <SelectItem value="todas">Todas que eu posso ver</SelectItem>
          </SelectContent>
        </Select>
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