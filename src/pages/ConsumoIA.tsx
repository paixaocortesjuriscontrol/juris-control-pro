import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  Coins,
  Download,
  Activity,
  DollarSign,
  Hash,
  AlertCircle,
} from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  edge_function: string;
  origem: string | null;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  custo_usd: number | null;
  duracao_ms: number | null;
  status: string;
  erro: string | null;
  metadata: Record<string, unknown> | null;
};

const COTACAO_BRL = 5.5;
const PAGE_SIZE = 50;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function fmtUsd(n: number) {
  return `$${n.toFixed(4)}`;
}
function fmtBrl(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtInt(n: number) {
  return n.toLocaleString("pt-BR");
}

export default function ConsumoIA() {
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const [fnFilter, setFnFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const rangeFrom = `${from}T00:00:00Z`;
  const rangeTo = `${to}T23:59:59Z`;

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["ai_usage_logs", from, to, fnFilter, userFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("ai_usage_logs" as any)
        .select("*")
        .gte("created_at", rangeFrom)
        .lte("created_at", rangeTo)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (fnFilter !== "all") q = q.eq("edge_function", fnFilter);
      if (userFilter !== "all") q = q.eq("user_email", userFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as Row[]) || [];
    },
  });

  if (error) {
    toast.error("Erro ao carregar consumo: " + (error as Error).message);
  }

  const data = rows ?? [];

  const kpis = useMemo(() => {
    const totalChamadas = data.length;
    const totalPrompt = data.reduce((s, r) => s + (r.prompt_tokens ?? 0), 0);
    const totalCompletion = data.reduce((s, r) => s + (r.completion_tokens ?? 0), 0);
    const totalTokens = totalPrompt + totalCompletion;
    const totalUsd = data.reduce((s, r) => s + (Number(r.custo_usd) || 0), 0);
    const erros = data.filter((r) => r.status !== "success").length;
    return { totalChamadas, totalTokens, totalPrompt, totalCompletion, totalUsd, erros };
  }, [data]);

  const perDay = useMemo(() => {
    const map = new Map<string, { dia: string; prompt: number; completion: number; usd: number }>();
    for (const r of data) {
      const d = r.created_at.slice(0, 10);
      const e = map.get(d) ?? { dia: d, prompt: 0, completion: 0, usd: 0 };
      e.prompt += r.prompt_tokens ?? 0;
      e.completion += r.completion_tokens ?? 0;
      e.usd += Number(r.custo_usd) || 0;
      map.set(d, e);
    }
    return Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia));
  }, [data]);

  const topFunctions = useMemo(() => {
    const map = new Map<string, { name: string; usd: number; chamadas: number }>();
    for (const r of data) {
      const e = map.get(r.edge_function) ?? { name: r.edge_function, usd: 0, chamadas: 0 };
      e.usd += Number(r.custo_usd) || 0;
      e.chamadas += 1;
      map.set(r.edge_function, e);
    }
    return Array.from(map.values()).sort((a, b) => b.usd - a.usd).slice(0, 10);
  }, [data]);

  const topUsers = useMemo(() => {
    const map = new Map<string, { name: string; usd: number; chamadas: number }>();
    for (const r of data) {
      const key = r.user_email || "(sem usuário)";
      const e = map.get(key) ?? { name: key, usd: 0, chamadas: 0 };
      e.usd += Number(r.custo_usd) || 0;
      e.chamadas += 1;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.usd - a.usd).slice(0, 10);
  }, [data]);

  const fnOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of data) set.add(r.edge_function);
    return Array.from(set).sort();
  }, [data]);

  const userOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of data) if (r.user_email) set.add(r.user_email);
    return Array.from(set).sort();
  }, [data]);

  const pagedRows = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));

  function exportCsv() {
    const headers = [
      "data",
      "usuario",
      "tela",
      "edge_function",
      "modelo",
      "prompt_tokens",
      "completion_tokens",
      "total_tokens",
      "custo_usd",
      "duracao_ms",
      "status",
      "erro",
    ];
    const lines = [headers.join(";")];
    for (const r of data) {
      lines.push([
        r.created_at,
        r.user_email ?? "",
        r.origem ?? "",
        r.edge_function,
        r.model,
        r.prompt_tokens ?? 0,
        r.completion_tokens ?? 0,
        r.total_tokens ?? 0,
        (Number(r.custo_usd) || 0).toFixed(6),
        r.duracao_ms ?? "",
        r.status,
        (r.erro ?? "").replace(/[\n;]/g, " ").slice(0, 300),
      ].join(";"));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consumo-ia-${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MainLayout
      title="Consumo de IA"
      subtitle="Relatório detalhado de tokens, custo, usuários e telas que consomem IA."
    >
      <div className="p-4 lg:p-6 space-y-6">
        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="w-4 h-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Função</Label>
                <Select value={fnFilter} onValueChange={setFnFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {fnOptions.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Usuário</Label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {userOptions.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="success">Sucesso</SelectItem>
                    <SelectItem value="error">Erro</SelectItem>
                    <SelectItem value="rate_limited">Rate limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button className="w-full" variant="outline" onClick={exportCsv} disabled={!data.length}>
                  <Download className="w-4 h-4 mr-2" /> CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={<Activity className="w-4 h-4" />} label="Chamadas" value={fmtInt(kpis.totalChamadas)} sub={`${kpis.erros} erro(s)`} />
          <KpiCard icon={<Hash className="w-4 h-4" />} label="Tokens totais" value={fmtInt(kpis.totalTokens)} sub={`${fmtInt(kpis.totalPrompt)} in / ${fmtInt(kpis.totalCompletion)} out`} />
          <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Custo USD" value={fmtUsd(kpis.totalUsd)} sub="estimado" />
          <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Custo BRL" value={fmtBrl(kpis.totalUsd * COTACAO_BRL)} sub={`× ${COTACAO_BRL}`} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tokens por dia</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {isLoading ? <Skeleton className="h-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perDay}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmtInt(v)} />
                    <Legend />
                    <Bar dataKey="prompt" name="Prompt" stackId="a" fill="#60a5fa" />
                    <Bar dataKey="completion" name="Completion" stackId="a" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top funções (USD)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFunctions} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip formatter={(v: number) => fmtUsd(v)} />
                  <Bar dataKey="usd" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top usuários (USD)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topUsers} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={200} />
                  <Tooltip formatter={(v: number) => fmtUsd(v)} />
                  <Bar dataKey="usd" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela detalhada */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Chamadas ({fmtInt(data.length)})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nenhuma chamada no período. A coleta é feita automaticamente a cada chamada de IA — verifique se houve uso no intervalo.
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/hora</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Tela</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead className="text-right">Prompt</TableHead>
                        <TableHead className="text-right">Completion</TableHead>
                        <TableHead className="text-right">Custo USD</TableHead>
                        <TableHead className="text-right">ms</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedRows.map((r) => (
                        <TableRow key={r.id} className={r.status !== "success" ? "bg-destructive/5" : ""}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(r.created_at), "dd/MM HH:mm:ss")}
                          </TableCell>
                          <TableCell className="text-xs">{r.user_email || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.origem || "—"}</TableCell>
                          <TableCell className="text-xs">{r.edge_function}</TableCell>
                          <TableCell className="text-xs">{r.model}</TableCell>
                          <TableCell className="text-xs text-right">{fmtInt(r.prompt_tokens ?? 0)}</TableCell>
                          <TableCell className="text-xs text-right">{fmtInt(r.completion_tokens ?? 0)}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{fmtUsd(Number(r.custo_usd) || 0)}</TableCell>
                          <TableCell className="text-xs text-right">{r.duracao_ms ?? "—"}</TableCell>
                          <TableCell>
                            {r.status === "success" ? (
                              <Badge variant="secondary" className="text-[10px]">ok</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <AlertCircle className="w-3 h-3" /> {r.status}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">
                    Página {page + 1} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      Anterior
                    </Button>
                    <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      Próxima
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}