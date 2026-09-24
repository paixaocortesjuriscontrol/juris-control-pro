import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import type { FiltrosInteligencia } from "./OfensoresTendencias";

interface Item { nome: string; total: number; valor_causa: number }
interface Dados {
  total: number; ativos: number; encerrados: number;
  resultado: { exito: number; parcial: number; sem_exito: number };
  por_area: Item[]; por_tribunal: Item[]; por_mes: { mes: string; total: number }[];
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtMes = (m: string) => { const [y, mm] = m.split("-"); return `${mm}/${y.slice(2)}`; };

function Lista({ titulo, itens }: { titulo: string; itens: Item[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{titulo}</CardTitle></CardHeader>
      <CardContent className="max-h-80 overflow-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground"><tr><th className="text-left py-1">Nome</th><th>Qtd</th><th className="text-right">Valor da causa</th></tr></thead>
          <tbody>{itens.map((i) => (
            <tr key={i.nome} className="border-t border-border/50">
              <td className="py-1 truncate max-w-[200px]" title={i.nome}>{i.nome}</td>
              <td className="text-center">{i.total}</td>
              <td className="text-right">{fmtBRL(Number(i.valor_causa))}</td>
            </tr>))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function PanoramaProcessos({ filtros }: { filtros: FiltrosInteligencia }) {
  const { data, isLoading } = useQuery({
    queryKey: ["inteligencia-processos", JSON.stringify(filtros)],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_inteligencia_processos", {
        p_coordenacao_id: filtros.coordenacaoId, p_data_inicio: filtros.dataInicio, p_data_fim: filtros.dataFim, p_tribunal: filtros.tribunal,
      });
      if (error) throw error;
      return data as Dados;
    },
    staleTime: 60000,
  });

  if (isLoading) return <Skeleton className="h-80" />;
  if (!data) return null;
  const r = data.resultado;
  const dec = r.exito + r.parcial + r.sem_exito;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" />Processos e Casos</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["Processos", data.total], ["Ativos", data.ativos], ["Encerrados", data.encerrados],
          ["Com resultado", dec],
          ["Taxa de êxito", dec ? `${Math.round(((r.exito + r.parcial * 0.5) / dec) * 100)}%` : "—"],
        ].map(([l, v]) => (
          <Card key={String(l)}><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-2xl font-bold mt-1">{v}</div></CardContent></Card>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">Resultados: {r.exito} com êxito · {r.parcial} com êxito parcial · {r.sem_exito} sem êxito (êxito parcial conta como meio ponto na taxa).</div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Novos processos por mês (24 meses)</CardTitle></CardHeader>
        <CardContent><div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.por_mes.map((m) => ({ ...m, mes: fmtMes(m.mes) }))}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="mes" fontSize={12} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip />
              <Bar dataKey="total" name="Processos" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div></CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Lista titulo="Por área" itens={data.por_area} />
        <Lista titulo="Tribunais com mais processos" itens={data.por_tribunal} />
      </div>
    </div>
  );
}
