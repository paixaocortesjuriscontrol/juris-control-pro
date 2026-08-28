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
  Download,
  Activity,
  DollarSign,
  Hash,
  AlertCircle,
  Scale,
  Paperclip,
} from "lucide-react";

// Tabela de preços Judit (BRL) — mesma referência da fatura mensal enviada
// pela Judit para PAIXAO CORTES E ADVOGADOS ASSOCIADOS.
const PRECOS_BRL: Record<string, number> = {
  com_anexos: 3.75, // Consulta processual com anexos
  on_demand: 0.25,  // Consulta processual on demand
  datalake: 0.25,   // Consulta processual datalake
  cache_local: 0,   // Reaproveitamento do resultado já obtido no mesmo dia
};

const ROTULO_TIPO: Record<string, string> = {
  com_anexos: "Consulta com anexos",
  on_demand: "Consulta on demand",
  datalake: "Consulta datalake",
  cache_local: "Reaproveitado do dia (sem custo)",
};

const PAGE_SIZE = 50;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function fmtBrl(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtInt(n: number) {
  return n.toLocaleString("pt-BR");
}

type Row = {
  id: string;
  created_at: string;
  created_by: string | null;
  processo_numero: string;
  tribunal: string | null;
  request_payload: any;
  status: string;
  error_message: string | null;
  origem: string | null;
  user_email: string | null;
  tipo_cobranca: string | null;
};

function detectarTipo(payload: any, salvo: string | null): keyof typeof PRECOS_BRL {
  if (salvo && (salvo === "com_anexos" || salvo === "on_demand" || salvo === "datalake" || salvo === "cache_local")) {
    return salvo as any;
  }
  const p = payload || {};
  if (p.com_anexos === true || p.with_attachments === true) return "com_anexos";
  if (p.on_demand === true || p.force_refresh === true) return "on_demand";
  return "datalake";
}

export default function ConsumoJudit() {
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [somenteCobrado, setSomenteCobrado] = useState<boolean>(true);
  const [page, setPage] = useState(0);

  const rangeFrom = `${from}T00:00:00Z`;
  const rangeTo = `${to}T23:59:59Z`;

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["judit_logs_consumo", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("judit_logs" as any)
        .select("id, created_at, created_by, processo_numero, tribunal, request_payload, status, error_message, origem, user_email, tipo_cobranca")
        .gte("created_at", rangeFrom)
        .lte("created_at", rangeTo)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data as unknown as Row[]) || [];
    },
  });

  // Perfis para exibir nome/email quando a coluna user_email ainda não foi preenchida.
  const userIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows ?? []) if (r.created_by) s.add(r.created_by);
    return Array.from(s);
  }, [rows]);

  const { data: profiles } = useQuery({
    queryKey: ["profiles_by_ids", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles" as any)
        .select("id, nome, email")
        .in("id", userIds);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const perfilMap = useMemo(() => {
    const m = new Map<string, { nome: string | null; email: string | null }>();
    for (const p of profiles ?? []) m.set(p.id, { nome: p.nome, email: p.email });
    return m;
  }, [profiles]);

  if (error) {
    toast.error("Erro ao carregar consumo Judit: " + (error as Error).message);
  }

  const enriched = useMemo(() => {
    return (rows ?? []).map((r) => {
      const tipo = detectarTipo(r.request_payload, r.tipo_cobranca);
      const perfil = r.created_by ? perfilMap.get(r.created_by) : undefined;
      const email = r.user_email || perfil?.email || null;
      const nome = perfil?.nome || email || "(desconhecido)";
      // Reaproveitamento do resultado do mesmo dia não gera chamada à Judit.
      const cobrado = r.status === "sucesso" && tipo !== "cache_local";
      const custo = cobrado ? PRECOS_BRL[tipo] : 0;
      return { ...r, tipo, email, nome, cobrado, custo };
    });
  }, [rows, perfilMap]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (tipoFilter !== "all" && r.tipo !== tipoFilter) return false;
      if (userFilter !== "all" && (r.email || "") !== userFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (somenteCobrado && !r.cobrado) return false;
      return true;
    });
  }, [enriched, tipoFilter, userFilter, statusFilter, somenteCobrado]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const totalCobrado = filtered.filter((r) => r.cobrado).length;
    const custoTotal = filtered.reduce((s, r) => s + r.custo, 0);
    const porTipo: Record<string, { qtd: number; custo: number }> = {};
    for (const r of filtered) {
      const t = r.tipo;
      porTipo[t] = porTipo[t] || { qtd: 0, custo: 0 };
      porTipo[t].qtd += r.cobrado ? 1 : 0;
      porTipo[t].custo += r.custo;
    }
    return { total, totalCobrado, custoTotal, porTipo };
  }, [filtered]);

  const perDay = useMemo(() => {
    const map = new Map<string, { dia: string; com_anexos: number; on_demand: number; datalake: number; cache_local: number; custo: number }>();
    for (const r of filtered) {
      const d = r.created_at.slice(0, 10);
      const e = map.get(d) ?? { dia: d, com_anexos: 0, on_demand: 0, datalake: 0, cache_local: 0, custo: 0 };
      if (r.cobrado) (e as any)[r.tipo] += 1;
      e.custo += r.custo;
      map.set(d, e);
    }
    return Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia));
  }, [filtered]);

  const topUsuarios = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; custo: number }>();
    for (const r of filtered) {
      const key = r.nome;
      const e = map.get(key) ?? { name: key, qtd: 0, custo: 0 };
      if (r.cobrado) e.qtd += 1;
      e.custo += r.custo;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.custo - a.custo).slice(0, 10);
  }, [filtered]);

  const topTelas = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; custo: number }>();
    for (const r of filtered) {
      const key = r.origem || "(não informado)";
      const e = map.get(key) ?? { name: key, qtd: 0, custo: 0 };
      if (r.cobrado) e.qtd += 1;
      e.custo += r.custo;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.custo - a.custo).slice(0, 10);
  }, [filtered]);

  const userOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of enriched) if (r.email) s.add(r.email);
    return Array.from(s).sort();
  }, [enriched]);

  const pagedRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  function exportCsv() {
    const headers = [
      "data",
      "usuario",
      "email",
      "tela",
      "processo",
      "tribunal",
      "tipo",
      "status",
      "custo_brl",
      "erro",
    ];
    const lines = [headers.join(";")];
    for (const r of filtered) {
      lines.push([
        r.created_at,
        r.nome,
        r.email ?? "",
        r.origem ?? "",
        r.processo_numero,
        r.tribunal ?? "",
        ROTULO_TIPO[r.tipo] ?? r.tipo,
        r.status,
        r.custo.toFixed(2).replace(".", ","),
        (r.error_message ?? "").replace(/[\n;]/g, " ").slice(0, 300),
      ].join(";"));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consumo-judit-${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MainLayout
      title="Consumo Judit"
      subtitle="Faturamento detalhado de consultas Judit — por tipo, usuário, tela e período."
    >
      <div className="p-4 lg:p-6 space-y-6">
        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4" /> Filtros
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
                <Label className="text-xs">Tipo de consulta</Label>
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="com_anexos">Com anexos (R$ 3,75)</SelectItem>
                    <SelectItem value="on_demand">On demand (R$ 0,25)</SelectItem>
                    <SelectItem value="datalake">Datalake (R$ 0,25)</SelectItem>
                    <SelectItem value="cache_local">Reaproveitado do dia (R$ 0,00)</SelectItem>
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
                    <SelectItem value="sucesso">Sucesso</SelectItem>
                    <SelectItem value="erro_api">Erro API</SelectItem>
                    <SelectItem value="erro_funcao">Erro função</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={somenteCobrado ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSomenteCobrado((v) => !v)}
                >
                  {somenteCobrado ? "Só cobradas" : "Todas"}
                </Button>
                <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={<Activity className="w-4 h-4" />} label="Chamadas cobradas" value={fmtInt(kpis.totalCobrado)} sub={`${fmtInt(kpis.total)} no total`} />
          <KpiCard icon={<Paperclip className="w-4 h-4" />} label="Com anexos" value={fmtInt(kpis.porTipo["com_anexos"]?.qtd ?? 0)} sub={fmtBrl(kpis.porTipo["com_anexos"]?.custo ?? 0)} />
          <KpiCard icon={<Hash className="w-4 h-4" />} label="Sem anexos (datalake/on demand)" value={fmtInt((kpis.porTipo["datalake"]?.qtd ?? 0) + (kpis.porTipo["on_demand"]?.qtd ?? 0))} sub={`${fmtBrl((kpis.porTipo["datalake"]?.custo ?? 0) + (kpis.porTipo["on_demand"]?.custo ?? 0))} · ${fmtInt(enriched.filter((r) => r.tipo === "cache_local").length)} reaproveitadas do dia`} />
          <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Custo total BRL" value={fmtBrl(kpis.custoTotal)} sub="estimado (tabela Judit)" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Consultas por dia</CardTitle>
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
                    <Bar dataKey="com_anexos" name="Com anexos" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="on_demand" name="On demand" stackId="a" fill="#8b5cf6" />
                    <Bar dataKey="datalake" name="Datalake" stackId="a" fill="#60a5fa" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top usuários (BRL)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topUsuarios} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={160} />
                  <Tooltip formatter={(v: number) => fmtBrl(v)} />
                  <Bar dataKey="custo" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top telas (BRL)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTelas} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={220} />
                  <Tooltip formatter={(v: number) => fmtBrl(v)} />
                  <Bar dataKey="custo" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela detalhada */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Consultas ({fmtInt(filtered.length)})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nenhuma consulta Judit no período com esses filtros.
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
                        <TableHead>Processo</TableHead>
                        <TableHead>Tribunal</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Custo BRL</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedRows.map((r) => (
                        <TableRow key={r.id} className={r.status !== "sucesso" ? "bg-destructive/5" : ""}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss")}
                          </TableCell>
                          <TableCell className="text-xs">{r.nome}</TableCell>
                          <TableCell className="text-xs font-mono">{r.origem || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.processo_numero}</TableCell>
                          <TableCell className="text-xs">{r.tribunal || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {ROTULO_TIPO[r.tipo] ?? r.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono">{fmtBrl(r.custo)}</TableCell>
                          <TableCell>
                            {r.status === "sucesso" ? (
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

        <div className="text-[11px] text-muted-foreground leading-relaxed">
          Cobrança estimada com base na tabela Judit vigente: consulta com anexos R$ 3,75; consulta on demand
          e datalake R$ 0,25 cada. Apenas consultas com status "sucesso" são consideradas cobradas — erros
          de API/função ficam visíveis, porém com custo R$ 0,00. Os totais aqui refletem apenas o que o
          sistema conseguiu registrar; para conferência oficial, cruze com a fatura mensal enviada pela Judit.
        </div>
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