import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Server, Activity, FileSearch, GitCompare, PlayCircle, Loader2, CalendarIcon, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { formatMonitoramentoLabel } from "@/utils/monitoramentoLabel";
import {
  useConfiguracoesServidor,
  useExecucoesServidor,
  useWorkersServidor,
  usePublicacoesServidor,
  useEnfileirarManual,
  useComparadorPublicacoes,
  useTickAge,
  useExecucaoServidorAoVivo,
  type ConfigServidor,
  type ProgressoItem,
} from "@/hooks/useDjenServidor";

const LABELS: Record<string, string> = {
  djen_paralela_servidor: "DJEN Servidor",
  kurier_servidor: "DJEN Kurier",
  djet_pautas_servidor: "DJET Pautas DEJT",
};

const STATUS_HEADER: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: "Aguardando", color: "text-amber-700", bg: "bg-amber-500/10" },
  executando: { label: "Executando", color: "text-primary", bg: "bg-primary/10" },
  concluido: { label: "Concluído", color: "text-emerald-700", bg: "bg-emerald-500/10" },
  erro: { label: "Erro", color: "text-destructive", bg: "bg-destructive/10" },
  idle: { label: "Ocioso", color: "text-muted-foreground", bg: "bg-muted/50" },
};

const ITEM_STATUS: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  executando: "bg-primary/15 text-primary border-primary/30",
  concluido: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  erro: "bg-destructive/15 text-destructive border-destructive/30",
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR");
  } catch {
    return s;
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pendente: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    executando: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    concluido: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    erro: "bg-red-500/15 text-red-600 border-red-500/30",
  };
  return <Badge variant="outline" className={map[status] || ""}>{status}</Badge>;
}

function ymd(d?: Date) { return d ? format(d, "yyyy-MM-dd") : undefined; }

/**
 * Card por engine — agora com filtros (coordenação + termo), datas (início/fim)
 * e barra de progresso ao vivo por monitoramento × dia.
 */
function EngineCard({ cfg, onToggle, onConfig }: {
  cfg: ConfigServidor;
  onToggle: (id: string, ativo: boolean) => void;
  onConfig: (id: string, patch: { ativo?: boolean; frequencia?: string; horarios_execucao?: string[]; metadata?: unknown }) => void;
}) {
  const enfileirar = useEnfileirarManual();
  const live = useExecucaoServidorAoVivo(cfg.tipo);

  const today = useMemo(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }, []);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(today);
  const [dataFim, setDataFim] = useState<Date | undefined>(today);

  const isParalela = cfg.tipo === "djen_paralela_servidor";
  const horariosKey = JSON.stringify(cfg.horarios_execucao || []);
  const [horariosTexto, setHorariosTexto] = useState((cfg.horarios_execucao || []).join(", "));
  const { data: horariosDjenNormal = [] } = useQuery({
    queryKey: ["djen-normal-paralela-horarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_monitoramento")
        .select("horarios_execucao")
        .eq("tipo", "djen_paralela")
        .maybeSingle();
      if (error) throw error;
      return (data?.horarios_execucao || []) as string[];
    },
  });
  useEffect(() => {
    setHorariosTexto((cfg.horarios_execucao || []).join(", "));
  }, [cfg.id, horariosKey]);

  const horariosServidor = horariosTexto.split(",").map((h) => h.trim()).filter(Boolean);
  const conflitoHorarioNormal = isParalela && horariosServidor.some((h) => horariosDjenNormal.includes(h));

  const handleHorariosBlur = () => {
    if (conflitoHorarioNormal) return;
    const atual = JSON.stringify(cfg.horarios_execucao || []);
    const proximo = JSON.stringify(horariosServidor);
    if (atual !== proximo) onConfig(cfg.id, { horarios_execucao: horariosServidor });
  };

  // Filtros (só Paralela suporta hoje, mas UI presente para consistência)
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");
  const [monitoramentoId, setMonitoramentoId] = useState<string>("");
  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const { data: monitoramentos = [] } = useQuery({
    queryKey: ["djen-servidor-monitoramentos", coordenacaoId],
    queryFn: async () => {
      if (!coordenacaoId) return [];
      const { data, error } = await supabase
        .from("monitoramentos_djen")
        .select("id, termo_busca, descricao, tipo, oab, uf")
        .eq("coordenacao_id", coordenacaoId)
        .eq("ativo", true);
      if (error) throw error;
      return (data || []).sort((a: any, b: any) =>
        formatMonitoramentoLabel(a).localeCompare(formatMonitoramentoLabel(b), "pt-BR")
      );
    },
    enabled: !!coordenacaoId && isParalela,
  });
  useEffect(() => { if (!coordenacaoId) setMonitoramentoId(""); }, [coordenacaoId]);

  const exec = live.data;
  const execStatus = exec?.status || "idle";
  const ativaAgora = execStatus === "pendente" || execStatus === "executando";
  const headerCfg = STATUS_HEADER[execStatus] || STATUS_HEADER.idle;

  const progresso = exec?.progresso;
  const total = progresso?.totalItens ?? 0;
  const done = progresso?.concluidos ?? 0;
  const falhas = progresso?.falhas ?? 0;
  const pct = total > 0 ? Math.floor((done / total) * 100) : 0;
  const itens: ProgressoItem[] = progresso?.itens || [];

  const handleRun = () => {
    if (!dataInicio || !dataFim) return;
    const payload: Record<string, unknown> = {
      dataInicio: ymd(dataInicio),
      dataFim: ymd(dataFim),
    };
    if (isParalela) {
      if (coordenacaoId) payload.coordenacaoId = coordenacaoId;
      if (monitoramentoId) payload.monitoramentoIds = [monitoramentoId];
    }
    enfileirar.mutate({ tipo: cfg.tipo, payload });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{LABELS[cfg.tipo] || cfg.tipo}</CardTitle>
            <Switch checked={cfg.ativo} onCheckedChange={(v) => onToggle(cfg.id, v)} />
          </div>
          <div className={cn(
            "px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5",
            headerCfg.bg, headerCfg.color
          )}>
            {execStatus === "executando" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {execStatus === "concluido" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {execStatus === "erro" && <XCircle className="h-3.5 w-3.5" />}
            {(execStatus === "idle" || execStatus === "pendente") && <Clock className="h-3.5 w-3.5" />}
            {headerCfg.label}
          </div>
        </div>
        <CardDescription className="text-xs">
          {cfg.frequencia} · {(cfg.horarios_execucao || []).join(", ") || "—"}
          {cfg.ultima_execucao && <> · Última: {fmtDate(cfg.ultima_execucao)}</>}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Filtros Paralela */}
        {isParalela && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Coordenação</label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
                value={coordenacaoId}
                onChange={(e) => setCoordenacaoId(e.target.value)}
                disabled={ativaAgora}
              >
                <option value="">Todas</option>
                {coordenacoes.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            {coordenacaoId && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Termo</label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
                  value={monitoramentoId}
                  onChange={(e) => setMonitoramentoId(e.target.value)}
                  disabled={ativaAgora}
                >
                  <option value="">Todos</option>
                  {(monitoramentos as any[]).map((m) => (
                    <option key={m.id} value={m.id}>{formatMonitoramentoLabel(m)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Início</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal h-9" disabled={ativaAgora}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} initialFocus className="pointer-events-auto p-3" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal h-9" disabled={ativaAgora}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={setDataFim} initialFocus className="pointer-events-auto p-3" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={handleRun}
          disabled={ativaAgora || enfileirar.isPending}
        >
          {(ativaAgora || enfileirar.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
          {ativaAgora ? "Executando..." : "Executar agora"}
        </Button>

        {/* Progresso ao vivo */}
        {exec && (ativaAgora || execStatus === "concluido" || execStatus === "erro") && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {done}/{total} {total === 1 ? "item" : "itens"}
                {falhas > 0 && <span className="text-destructive"> · {falhas} erro(s)</span>}
              </span>
              <span className="font-medium">{pct}%</span>
            </div>
            <Progress value={pct} className="h-2" />
            {progresso?.atual && (
              <p className="text-xs text-muted-foreground truncate">
                <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                {progresso.atual.label}
              </p>
            )}
            {itens.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1 mt-2 pr-1">
                {itens.slice().reverse().slice(0, 50).map((it) => (
                  <div key={it.id} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", ITEM_STATUS[it.status])}>
                      {it.status}
                    </Badge>
                    <span className="truncate flex-1" title={it.label}>{it.label}</span>
                    {it.status === "concluido" && (it.novas ?? 0) > 0 && (
                      <span className="text-emerald-600 font-medium">+{it.novas}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {exec.erro && (
              <p className="text-xs text-destructive truncate" title={exec.erro}>{exec.erro}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VisaoGeral() {
  const { data: cfgs = [], toggle, updateConfig } = useConfiguracoesServidor();
  const { data: workers = [] } = useWorkersServidor();
  const tick = useTickAge();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {cfgs.map((cfg) => (
          <EngineCard
            key={cfg.id}
            cfg={cfg}
            onToggle={(id, ativo) => toggle.mutate({ id, ativo })}
            onConfig={(id, patch) => updateConfig.mutate({ id, patch })}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" /> Workers da VPS
          </CardTitle>
          <CardDescription>Heartbeat dos slots ativos no daemon Hostinger</CardDescription>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum worker registrado ainda. Suba o daemon na VPS.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo atual</TableHead>
                  <TableHead>Heartbeat (s)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.map((w) => {
                  const ageS = Math.floor((tick - new Date(w.heartbeat_at).getTime()) / 1000);
                  const stale = ageS > 60;
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-xs">{w.worker_id}</TableCell>
                      <TableCell className="text-xs">{w.host || "—"}</TableCell>
                      <TableCell>{statusBadge(w.status)}</TableCell>
                      <TableCell className="text-xs">{w.current_tipo || "—"}</TableCell>
                      <TableCell className={stale ? "text-red-600 text-xs" : "text-xs"}>{ageS}s</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExecucoesPanel() {
  const { data: execs = [], isLoading } = useExecucoesServidor(100);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Execuções ao vivo</CardTitle>
        <CardDescription>Realtime — últimas 100 execuções</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Agendado</TableHead>
                <TableHead>Iniciado</TableHead>
                <TableHead>Finalizado</TableHead>
                <TableHead>Tent.</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {execs.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{e.tipo}</TableCell>
                  <TableCell>{statusBadge(e.status)}</TableCell>
                  <TableCell className="font-mono text-xs">{e.worker_id || "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(e.agendado_para)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(e.iniciado_em)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(e.finalizado_em)}</TableCell>
                  <TableCell className="text-xs">{e.tentativas}</TableCell>
                  <TableCell className="text-xs max-w-md truncate">{e.erro || JSON.stringify(e.resultado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function todayYmd(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function PublicacoesPanel() {
  const [dataInicio, setDataInicio] = useState(todayYmd(-7));
  const [dataFim, setDataFim] = useState(todayYmd());
  const { data: pubs = [], isLoading } = usePublicacoesServidor({ dataInicio, dataFim, limit: 500 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><FileSearch className="h-4 w-4" /> Publicações encontradas (servidor)</CardTitle>
        <CardDescription>Tabela `publicacoes_djen_servidor` — origem = 'servidor'</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Início</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <Badge variant="outline">{pubs.length} resultados</Badge>
        </div>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tribunal</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Data pub.</TableHead>
                <TableHead>Encontrada em</TableHead>
                <TableHead>Trecho</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pubs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{p.tribunal || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{p.processo_numero || "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(p.data_publicacao)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(p.created_at)}</TableCell>
                  <TableCell className="text-xs max-w-md truncate">{p.conteudo?.slice(0, 200) || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ComparadorPanel() {
  const [dataInicio, setDataInicio] = useState(todayYmd(-7));
  const [dataFim, setDataFim] = useState(todayYmd());
  const { data, isLoading } = useComparadorPublicacoes({ dataInicio, dataFim });

  const exportarCsv = (rows: Array<{ processo_numero?: string | null; tribunal?: string | null; dedup_data_ref?: string | null; hash_conteudo: string }>, nome: string) => {
    const header = "tribunal,processo,data,hash\n";
    const body = rows.map((r) => `${r.tribunal || ""},${r.processo_numero || ""},${r.dedup_data_ref || ""},${r.hash_conteudo}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}_${dataInicio}_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><GitCompare className="h-4 w-4" /> Comparador Servidor × Browser</CardTitle>
        <CardDescription>Diff entre `publicacoes_djen_servidor` e `publicacoes_djen` no período</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground">Início</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Apenas Servidor ({data.soServidor.length})</CardTitle></CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" onClick={() => exportarCsv(data.soServidor, "so_servidor")}>Exportar CSV</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Apenas Browser ({data.soBrowser.length})</CardTitle></CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" onClick={() => exportarCsv(data.soBrowser, "so_browser")}>Exportar CSV</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Em ambos ({data.ambos.length})</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Total Servidor: {data.totalServidor}</p>
                <p className="text-xs text-muted-foreground">Total Browser: {data.totalBrowser}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DjenServidor() {
  const [tab, setTab] = useState("geral");
  return (
    <MainLayout
      title="DJEN Servidor"
      subtitle="Pipeline DJEN/Kurier/Pautas executado 24/7 na VPS, com tabela separada para comparação"
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral"><Server className="h-4 w-4 mr-1" />Visão geral</TabsTrigger>
          <TabsTrigger value="execucoes"><Activity className="h-4 w-4 mr-1" />Execuções</TabsTrigger>
          <TabsTrigger value="publicacoes"><FileSearch className="h-4 w-4 mr-1" />Publicações</TabsTrigger>
          <TabsTrigger value="comparador"><GitCompare className="h-4 w-4 mr-1" />Comparador</TabsTrigger>
        </TabsList>
        <TabsContent value="geral"><VisaoGeral /></TabsContent>
        <TabsContent value="execucoes"><ExecucoesPanel /></TabsContent>
        <TabsContent value="publicacoes"><PublicacoesPanel /></TabsContent>
        <TabsContent value="comparador"><ComparadorPanel /></TabsContent>
      </Tabs>
    </MainLayout>
  );
}