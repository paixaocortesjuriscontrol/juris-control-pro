import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Users, BookOpen } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface Linha { nome: string; total: number; ganhos: number; perdidos: number; acordos: number; recente: number; anterior: number }
interface Dados {
  reclamantes: Linha[];
  materias: Linha[];
  top_materias: string[];
  evolucao: { mes: string; materia: string; n: number }[];
  alertas: { tipo: "materia" | "reclamante"; nome: string; recente: number; anterior: number }[];
}

export interface FiltrosInteligencia {
  coordenacaoId: string | null; equipe: string | null; tribunal: string | null; dataInicio: string | null; dataFim: string | null;
}

const CORES = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const fmtMes = (m: string) => { const [y, mm] = m.split("-"); return `${mm}/${y.slice(2)}`; };

function Tendencia({ recente, anterior }: { recente: number; anterior: number }) {
  if (recente > anterior) return <TrendingUp className="h-4 w-4 text-red-500 inline" />;
  if (recente < anterior) return <TrendingDown className="h-4 w-4 text-emerald-500 inline" />;
  return <Minus className="h-4 w-4 text-muted-foreground inline" />;
}

function Ranking({ titulo, icone, itens }: { titulo: string; icone: React.ReactNode; itens: Linha[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2">{icone}{titulo}</CardTitle></CardHeader>
      <CardContent className="max-h-96 overflow-auto">
        {itens.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">Sem dados</div> : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground sticky top-0 bg-card">
              <tr><th className="text-left py-1">Nome</th><th>Qtd</th><th>Derrota</th><th>Acordo</th><th title="Últimos 3 meses x 3 anteriores">Tend.</th></tr>
            </thead>
            <tbody>
              {itens.map((i) => {
                const dec = i.ganhos + i.perdidos;
                return (
                  <tr key={i.nome} className="border-t border-border/50">
                    <td className="py-1 pr-2 max-w-[260px] truncate" title={i.nome}>{i.nome}</td>
                    <td className="text-center font-medium">{i.total}</td>
                    <td className="text-center">{dec > 0 ? `${Math.round((i.perdidos / dec) * 100)}%` : "—"}</td>
                    <td className="text-center">{i.total > 0 ? `${Math.round((i.acordos / i.total) * 100)}%` : "—"}</td>
                    <td className="text-center" title={`${i.recente} recentes x ${i.anterior} antes`}><Tendencia recente={i.recente} anterior={i.anterior} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export default function OfensoresTendencias({ filtros }: { filtros: FiltrosInteligencia }) {
  const { data, isLoading } = useQuery({
    queryKey: ["inteligencia-ofensores", JSON.stringify(filtros)],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_inteligencia_ofensores", {
        p_coordenacao_id: filtros.coordenacaoId, p_equipe: filtros.equipe, p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim, p_tribunal: filtros.tribunal,
      });
      if (error) throw error;
      return data as Dados;
    },
    staleTime: 60000,
  });

  const serie = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    (data?.evolucao || []).forEach((e) => {
      const r = map.get(e.mes) || { mes: fmtMes(e.mes) };
      r[e.materia] = e.n; map.set(e.mes, r);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [data]);

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Ofensores e tendências</h2>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Alertas de crescimento (últimos 3 meses x 3 anteriores)</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(data?.alertas || []).length === 0 ? <span className="text-sm text-muted-foreground">Nenhum crescimento fora do normal no período.</span> :
            data!.alertas.map((a) => (
              <Badge key={a.tipo + a.nome} variant="outline" className="border-amber-500/50 text-xs font-normal">
                {a.tipo === "materia" ? "Matéria" : "Reclamante"}: {a.nome} — {a.anterior} → {a.recente}
              </Badge>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução mensal das matérias mais recorrentes (12 meses)</CardTitle></CardHeader>
        <CardContent>
          {serie.length === 0 ? <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">Sem dados</div> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="mes" fontSize={12} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                  {(data?.top_materias || []).map((m, i) => <Line key={m} dataKey={m} name={m.length > 40 ? m.slice(0, 40) + "…" : m} stroke={CORES[i % CORES.length]} strokeWidth={2} dot={false} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Ranking titulo="Reclamantes mais recorrentes" icone={<Users className="h-4 w-4" />} itens={data?.reclamantes || []} />
        <Ranking titulo="Matérias mais recorrentes" icone={<BookOpen className="h-4 w-4" />} itens={data?.materias || []} />
      </div>
    </div>
  );
}
