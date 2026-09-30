import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { format, subDays, eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from "recharts";
import { Activity, FileDown, FileSpreadsheet, Users, UserX, LogIn, MousePointerClick, Clock, Percent } from "lucide-react";
import { toast } from "sonner";
import { DadosUso, LinhaUso, dataHora, exportarExcel, exportarPdf, nivelUso, resumo, totalAcoes } from "@/lib/relatorioUsabilidade";

const hojeStr = () => format(new Date(), "yyyy-MM-dd");
const corNivel: Record<string, "default" | "secondary" | "outline" | "destructive"> = { Alto: "default", Médio: "secondary", Baixo: "outline", "Sem uso": "destructive" };

export default function UsabilidadeSistema() {
  const [inicio, setInicio] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [fim, setFim] = useState(hojeStr());
  const [coord, setCoord] = useState("todas");
  const [busca, setBusca] = useState("");
  const [nivel, setNivel] = useState("todos");
  const [situacao, setSituacao] = useState("todos");
  const [cadastroPeriodo, setCadastroPeriodo] = useState(false);
  const [minAcoes, setMinAcoes] = useState("");
  const [ordem, setOrdem] = useState<keyof LinhaUso | "total" | "nivel">("total");
  const [ordemDir, setOrdemDir] = useState<"asc" | "desc">("desc");
  const { coordenacoes } = useCoordenacoesDoUsuario();

  const { data, isLoading, error } = useQuery({
    queryKey: ["usabilidade", inicio, fim, coord],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_usabilidade_sistema", { _inicio: inicio, _fim: fim, _coordenacao_id: coord === "todas" ? null : coord });
      if (error) throw error;
      return data as DadosUso;
    },
  });

  const diasUteis = useMemo(() => {
    try { return eachDayOfInterval({ start: parseISO(inicio), end: parseISO(fim) }).filter((d) => !isWeekend(d)).length; } catch { return 0; }
  }, [inicio, fim]);

  const r = data ? resumo(data, diasUteis) : null;
  const linhas = useMemo(() => {
    const min = Number(minAcoes) || 0;
    const l = (data?.usuarios || []).filter((u) =>
      (!busca || `${u.nome} ${u.email}`.toLowerCase().includes(busca.toLowerCase()))
      && (nivel === "todos" || nivelUso(u, diasUteis) === nivel)
      && (situacao === "todos" || (situacao === "ativos" ? u.ativo : !u.ativo))
      && (!cadastroPeriodo || (u.criado_em && u.criado_em.slice(0, 10) >= inicio && u.criado_em.slice(0, 10) <= fim))
      && totalAcoes(u) >= min);
    const dir = ordemDir === "asc" ? 1 : -1;
    const nivelRank = (n: string) => ({ "Sem uso": 0, Baixo: 1, "Médio": 2, Alto: 3 }[n] ?? 0);
    return [...l].sort((a, b) => {
      if (ordem === "total") return (totalAcoes(a) - totalAcoes(b)) * dir;
      if (ordem === "nivel") return (nivelRank(nivelUso(a, diasUteis)) - nivelRank(nivelUso(b, diasUteis))) * dir;
      if (ordem === "nome") return String(a.nome).localeCompare(String(b.nome)) * dir;
      if (ordem === "ultimo_acesso") return String(a.ultimo_acesso || "").localeCompare(String(b.ultimo_acesso || "")) * dir;
      return (Number(a[ordem]) - Number(b[ordem])) * dir;
    });
  }, [data, busca, nivel, situacao, cadastroPeriodo, minAcoes, ordem, ordemDir, diasUteis, inicio, fim]);

  const coordNome = coord === "todas" ? "Todas as coordenações" : coordenacoes?.find((c: any) => c.id === coord)?.nome || "";
  const exp = async (tipo: "pdf" | "xlsx") => {
    if (!data) return;
    const p = { dados: { ...data, usuarios: linhas }, inicio, fim, coordenacao: coordNome, diasUteis };
    try { tipo === "pdf" ? exportarPdf(p) : await exportarExcel(p); } catch (e: any) { toast.error("Erro ao exportar: " + e.message); }
  };
  const serieDia = (data?.por_dia || []).map((d) => ({ ...d, label: d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7) }));
  const Th = ({ k, children }: { k: any; children: any }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap"
      onClick={() => { if (ordem === k) setOrdemDir((d) => (d === "desc" ? "asc" : "desc")); else { setOrdem(k); setOrdemDir(k === "nome" ? "asc" : "desc"); } }}>
      {children}{ordem === k ? (ordemDir === "desc" ? " ↓" : " ↑") : ""}
    </TableHead>
  );

  return (
    <MainLayout title="Usabilidade do Sistema" subtitle="Como cada pessoa está usando o Juris Control no período"
      headerActions={<div className="flex gap-2">
        <Button variant="outline" className="gap-2" onClick={() => exp("pdf")} disabled={!data}><FileDown className="w-4 h-4" />PDF</Button>
        <Button variant="outline" className="gap-2" onClick={() => exp("xlsx")} disabled={!data}><FileSpreadsheet className="w-4 h-4" />Excel</Button>
      </div>}>
      <div className="space-y-4">
        <Card><CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-muted-foreground">De</label><Input type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Até</label><Input type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} /></div>
          <div className="flex gap-1">
            {[7, 30, 90].map((n) => <Button key={n} size="sm" variant="ghost" onClick={() => { setInicio(format(subDays(new Date(), n - 1), "yyyy-MM-dd")); setFim(hojeStr()); }}>{n} dias</Button>)}
          </div>
          <div className="min-w-56"><label className="text-xs text-muted-foreground">Coordenação</label>
            <Select value={coord} onValueChange={setCoord}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas</SelectItem>{(coordenacoes || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
        </CardContent></Card>

        {error && <Card><CardContent className="pt-4 text-destructive">Não foi possível carregar: {(error as any).message}</CardContent></Card>}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {([
            [Users, "Usuários", r?.total], [Activity, "Com uso", r?.ativos], [UserX, "Sem uso", r?.semUso],
            [Percent, "Adoção", r ? `${r.adocao}%` : undefined], [LogIn, "Acessos", r?.acessos], [MousePointerClick, "Ações", r?.acoes],
          ] as const).map(([Icon, label, v]) => (
            <Card key={label}><CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="w-4 h-4" />{label}</div>
              {isLoading ? <Skeleton className="h-7 w-16 mt-1" /> : <div className="text-2xl font-bold">{(v ?? 0).toLocaleString?.("pt-BR") ?? v}</div>}
            </CardContent></Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-base">Uso diário</CardTitle>
            <CardDescription>Pessoas que usaram o sistema e ações feitas em itens, por dia (BRT){r ? ` · média de ${r.mediaDiaria} pessoa(s) por dia` : ""}</CardDescription></CardHeader>
            <CardContent className="h-64">{isLoading ? <Skeleton className="h-full" /> :
              <ResponsiveContainer><AreaChart data={serieDia}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
                <Area dataKey="usuarios" name="Pessoas" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                <Area dataKey="acoes" name="Ações em itens" stroke="hsl(var(--accent-foreground))" fill="hsl(var(--accent))" fillOpacity={0.3} />
              </AreaChart></ResponsiveContainer>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" />Horários de uso</CardTitle>
            <CardDescription>{r?.horaPico != null ? `Pico às ${r.horaPico}h` : "Acessos por hora (BRT)"}</CardDescription></CardHeader>
            <CardContent className="h-64">{isLoading ? <Skeleton className="h-full" /> :
              <ResponsiveContainer><BarChart data={data?.por_hora || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hora" fontSize={11} tickFormatter={(h) => `${h}h`} /><YAxis fontSize={11} /><Tooltip labelFormatter={(h) => `${h}h`} />
                <Bar dataKey="logins" name="Acessos" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer>}</CardContent></Card>
        </div>

        <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div><CardTitle className="text-base">Uso por pessoa</CardTitle>
            <CardDescription>Nível pela proporção de dias úteis com uso desde o cadastro de cada pessoa ({diasUteis} no período; cadastros importados sem acesso e desativados não entram): Alto ≥ 60%, Médio ≥ 25%. Clique no título da coluna para ordenar.</CardDescription></div>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Buscar pessoa" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-48" />
            <Select value={nivel} onValueChange={setNivel}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{["todos", "Alto", "Médio", "Baixo", "Sem uso"].map((n) => <SelectItem key={n} value={n}>{n === "todos" ? "Todos os níveis" : n}</SelectItem>)}</SelectContent></Select>
            <Select value={situacao} onValueChange={setSituacao}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Ativos e inativos</SelectItem><SelectItem value="ativos">Somente ativos</SelectItem><SelectItem value="inativos">Somente inativos</SelectItem></SelectContent></Select>
            <Input type="number" min={0} placeholder="Mín. de ações" value={minAcoes} onChange={(e) => setMinAcoes(e.target.value)} className="w-32" title="Mostrar só quem tem pelo menos este total de ações" />
            <Button variant={cadastroPeriodo ? "default" : "outline"} size="sm" onClick={() => setCadastroPeriodo((v) => !v)}>Cadastradas no período</Button>
          </div></CardHeader>
          <CardContent className="overflow-x-auto">{isLoading ? <Skeleton className="h-48" /> :
            <Table><TableHeader><TableRow>
              <Th k="nome">Pessoa</Th><TableHead>Nível</TableHead><Th k="dias_login">Dias ativos</Th><Th k="logins">Acessos</Th><Th k="ultimo_acesso">Último acesso</Th>
              <Th k="acoes_itens">Ações em itens</Th><Th k="criados">Criados</Th><Th k="atualizados">Alterados</Th><Th k="acoes_tst">Distrib. TST</Th>
              <Th k="consultas_judit">Judit</Th><Th k="usos_ia">IA</Th><Th k="total">Total</Th>
            </TableRow></TableHeader>
              <TableBody>{linhas.map((l) => { const nv = nivelUso(l, diasUteis); return (
                <TableRow key={l.id}>
                  <TableCell><div className="font-medium">{l.nome || "—"}</div><div className="text-xs text-muted-foreground">{l.email}</div></TableCell>
                  <TableCell><Badge variant={corNivel[nv]}>{nv}</Badge></TableCell>
                  <TableCell>{Math.max(l.dias_login, l.dias_acao)}</TableCell><TableCell>{l.logins}</TableCell>
                  <TableCell className="whitespace-nowrap">{dataHora(l.ultimo_acesso)}</TableCell>
                  <TableCell>{l.acoes_itens}</TableCell><TableCell>{l.criados}</TableCell><TableCell>{l.atualizados}</TableCell>
                  <TableCell>{l.acoes_tst}</TableCell><TableCell>{l.consultas_judit}</TableCell><TableCell>{l.usos_ia}</TableCell>
                  <TableCell className="font-semibold">{totalAcoes(l)}</TableCell>
                </TableRow>); })}
                {!linhas.length && <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Nenhuma pessoa encontrada.</TableCell></TableRow>}
              </TableBody></Table>}
          </CardContent></Card>
      </div>
    </MainLayout>
  );
}
