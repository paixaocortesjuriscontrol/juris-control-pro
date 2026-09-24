import { useMemo, useState } from "react";
import OfensoresTendencias from "@/components/inteligencia/OfensoresTendencias";
import PanoramaProcessos from "@/components/inteligencia/PanoramaProcessos";
import OportunidadesAcordo from "@/components/inteligencia/OportunidadesAcordo";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Trophy, TrendingDown, Handshake, Scale, DollarSign, Filter, X, ChevronRight, TableProperties,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type SerieItem = { nome: string; total: number; ganhos: number; perdidos: number; acordos: number };
type MesItem = { mes: string; total: number; ganhos: number; perdidos: number; acordos: number; sem_resultado: number };

interface InteligenciaData {
  totais: { total: number; ganhos: number; perdidos: number; acordos: number; sem_resultado: number };
  por_mes: MesItem[];
  por_turma: SerieItem[];
  por_relator: SerieItem[];
  por_equipe: SerieItem[];
  financeiro: { valor_causa: number; valor_condenacao: number; valor_pago: number; provisionado_provavel: number };
}

interface FiltrosDisponiveis {
  equipes: string[];
  tribunais: { valor: string; tst: boolean; processos: boolean }[];
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtMes = (mes: string) => {
  const [y, m] = mes.split("-");
  return `${m}/${y}`;
};

function TabelaDesempenho({ titulo, itens, onOpen }: { titulo: string; itens: SerieItem[]; onOpen: () => void }) {
  const destaque = itens[0];
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TableProperties className="h-4 w-4 text-primary" />
              {titulo}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {itens.length > 0 ? `${itens.length} registros encontrados` : "Sem dados no período"}
            </p>
            {destaque && (
              <p className="mt-1 truncate text-sm" title={destaque.nome}>
                Maior volume: <span className="font-medium">{destaque.nome}</span> ({destaque.total})
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onOpen} disabled={itens.length === 0}>
            Ver dados <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PainelDesempenho({
  titulo,
  itens,
  open,
  onOpenChange,
}: {
  titulo: string;
  itens: SerieItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[min(92vw,900px)]">
        <SheetHeader className="pr-8">
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>{itens.length} registros conforme os filtros aplicados.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 overflow-x-auto rounded-md border">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-3 py-3 text-right font-medium">Ganhos</th>
                <th className="px-3 py-3 text-right font-medium">Perdidos</th>
                <th className="px-3 py-3 text-right font-medium">Acordos</th>
                <th className="px-4 py-3 text-right font-medium">% Êxito</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => {
                const decididos = item.ganhos + item.perdidos;
                const taxa = decididos > 0 ? Math.round((item.ganhos / decididos) * 100) : null;
                return (
                  <tr key={item.nome} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{item.nome}</td>
                    <td className="px-3 py-3 text-right">{item.total}</td>
                    <td className="px-3 py-3 text-right text-emerald-600">{item.ganhos}</td>
                    <td className="px-3 py-3 text-right text-destructive">{item.perdidos}</td>
                    <td className="px-3 py-3 text-right text-sky-600">{item.acordos}</td>
                    <td className="px-4 py-3 text-right font-semibold">{taxa === null ? "—" : `${taxa}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function InteligenciaJuridica() {
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [equipe, setEquipe] = useState<string>("todas");
  const [tribunal, setTribunal] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [painelDesempenho, setPainelDesempenho] = useState<"turma" | "relator" | "equipe" | null>(null);

  const { data: coordenacoes } = useCoordenacoes();

  const { data: filtrosDisponiveis } = useQuery({
    queryKey: ["inteligencia-filtros"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_inteligencia_filtros");
      if (error) throw error;
      return data as FiltrosDisponiveis;
    },
    staleTime: 300000,
  });

  const equipes = filtrosDisponiveis?.equipes || [];
  const tribunais = filtrosDisponiveis?.tribunais || [];

  const filtros = useMemo(() => ({
    coordenacaoId: coordenacaoId === "todas" ? null : coordenacaoId,
    equipe: equipe === "todas" ? null : equipe,
    tribunal: tribunal === "todos" ? null : tribunal,
    dataInicio: dataInicio || null,
    dataFim: dataFim || null,
  }), [coordenacaoId, equipe, tribunal, dataInicio, dataFim]);

  const { data, isLoading } = useQuery({
    queryKey: ["inteligencia-dashboard", JSON.stringify(filtros)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_inteligencia_dashboard", {
        p_coordenacao_id: filtros.coordenacaoId,
        p_equipe: filtros.equipe,
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_tribunal: filtros.tribunal,
      });
      if (error) throw error;
      return data as unknown as InteligenciaData;
    },
    staleTime: 60000,
  });

  const limparFiltros = () => {
    setCoordenacaoId("todas");
    setEquipe("todas");
    setTribunal("todos");
    setDataInicio("");
    setDataFim("");
  };

  const t = data?.totais;
  const decididos = (t?.ganhos || 0) + (t?.perdidos || 0);
  const taxaExito = decididos > 0 ? Math.round(((t?.ganhos || 0) / decididos) * 100) : null;

  const chartData = (data?.por_mes || []).map((m) => ({ ...m, mes: fmtMes(m.mes) }));

  return (
    <MainLayout title="Inteligência Jurídica" subtitle="Indicadores estratégicos, tendências e oportunidades">
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          Inteligência Jurídica
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Indicadores estratégicos calculados do histórico real da base: resultados, acordos e desempenho por turma, relator e equipe.
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-1">
              <Filter className="h-4 w-4" /> Filtros
            </div>
            <div className="min-w-[220px]">
              <label className="text-xs text-muted-foreground">Coordenação</label>
              <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {(coordenacoes || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <label className="text-xs text-muted-foreground">Equipe</label>
              <Select value={equipe} onValueChange={setEquipe}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {equipes.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs text-muted-foreground">Tribunal</label>
              <Select value={tribunal} onValueChange={setTribunal}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tribunais.map((tr) => (
                    <SelectItem key={tr.valor} value={tr.valor}>
                      {tr.valor} · {tr.tst && tr.processos ? "Ambas as bases" : tr.tst ? "Distribuição TST" : "Processos e Casos"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Distribuição de</label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">até</label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de totais */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Scale className="h-4 w-4" /> Processos</div>
              <div className="text-2xl font-bold mt-1">{t?.total ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="h-4 w-4 text-emerald-500" /> Ganhos</div>
              <div className="text-2xl font-bold mt-1 text-emerald-500">{t?.ganhos ?? 0}</div>
              {taxaExito !== null && <div className="text-xs text-muted-foreground">{taxaExito}% de êxito nos decididos</div>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingDown className="h-4 w-4 text-red-500" /> Perdidos</div>
              <div className="text-2xl font-bold mt-1 text-red-500">{t?.perdidos ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Handshake className="h-4 w-4 text-sky-500" /> Acordos</div>
              <div className="text-2xl font-bold mt-1 text-sky-500">{t?.acordos ?? 0}</div>
              {t && t.total > 0 && <div className="text-xs text-muted-foreground">{Math.round((t.acordos / t.total) * 100)}% do total</div>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-4 w-4 text-amber-500" /> Valor pago</div>
              <div className="text-xl font-bold mt-1">{fmtBRL(data?.financeiro?.valor_pago ?? 0)}</div>
              <div className="text-xs text-muted-foreground">Condenação: {fmtBRL(data?.financeiro?.valor_condenacao ?? 0)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Evolução mensal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Evolução mensal (por data de distribuição)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72" />
          ) : chartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="mes" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ganhos" name="Ganhos" stackId="a" fill="#10b981" />
                  <Bar dataKey="perdidos" name="Perdidos" stackId="a" fill="#ef4444" />
                  <Bar dataKey="acordos" name="Acordos" stackId="a" fill="#0ea5e9" />
                   <Bar dataKey="sem_resultado" name="Sem resultado" stackId="a" fill="hsl(var(--muted-foreground))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabelas de desempenho */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <TabelaDesempenho titulo="Desempenho por Turma" itens={data?.por_turma || []} onOpen={() => setPainelDesempenho("turma")} />
        <TabelaDesempenho titulo="Desempenho por Relator" itens={data?.por_relator || []} onOpen={() => setPainelDesempenho("relator")} />
        <TabelaDesempenho titulo="Desempenho por Equipe" itens={data?.por_equipe || []} onOpen={() => setPainelDesempenho("equipe")} />
      </div>

      <PainelDesempenho
        titulo={painelDesempenho === "turma" ? "Desempenho por Turma" : painelDesempenho === "relator" ? "Desempenho por Relator" : "Desempenho por Equipe"}
        itens={painelDesempenho === "turma" ? data?.por_turma || [] : painelDesempenho === "relator" ? data?.por_relator || [] : data?.por_equipe || []}
        open={painelDesempenho !== null}
        onOpenChange={(open) => !open && setPainelDesempenho(null)}
      />

      {/* Financeiro */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Indicadores financeiros (processos cadastrados)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Valor das causas</div>
              <div className="text-lg font-semibold">{fmtBRL(data?.financeiro?.valor_causa ?? 0)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Condenações</div>
              <div className="text-lg font-semibold">{fmtBRL(data?.financeiro?.valor_condenacao ?? 0)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Valores pagos</div>
              <div className="text-lg font-semibold">{fmtBRL(data?.financeiro?.valor_pago ?? 0)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Provisionado (provável)</div>
              <div className="text-lg font-semibold">{fmtBRL(data?.financeiro?.provisionado_provavel ?? 0)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <OfensoresTendencias filtros={filtros} />

      <PanoramaProcessos filtros={filtros} />

      <OportunidadesAcordo filtros={filtros} />
    </div>
    </MainLayout>
  );
}
