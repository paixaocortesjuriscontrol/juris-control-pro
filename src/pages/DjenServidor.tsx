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
import { Server, Activity, FileSearch, GitCompare, PlayCircle, Loader2, CalendarIcon, CheckCircle2, XCircle, Clock, StopCircle, Zap, Newspaper, Radar } from "lucide-react";
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
  useComparadorAnalise,
  useTickAge,
  useExecucaoServidorAoVivo,
  useCancelarExecucaoServidor,
  type ConfigServidor,
  type ProgressoItem,
} from "@/hooks/useDjenServidor";
import { DjenServidorParalelaCard } from "@/components/djen/DjenServidorParalelaCard";

const LABELS: Record<string, string> = {
  djen_paralela_servidor: "DJEN Termos",
  kurier_servidor: "DJEN Kurier",
  djet_pautas_servidor: "DJEN Pautas",
};

const STATUS_HEADER: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: "Aguardando", color: "text-amber-700", bg: "bg-amber-500/10" },
  executando: { label: "Executando", color: "text-primary", bg: "bg-primary/10" },
  concluido: { label: "Concluído", color: "text-emerald-700", bg: "bg-emerald-500/10" },
  cancelado: { label: "Cancelado", color: "text-amber-700", bg: "bg-amber-500/10" },
  erro: { label: "Erro", color: "text-destructive", bg: "bg-destructive/10" },
  idle: { label: "Ocioso", color: "text-muted-foreground", bg: "bg-muted/50" },
};

const ITEM_STATUS: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  executando: "bg-primary/15 text-primary border-primary/30",
  concluido: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  erro: "bg-destructive/15 text-destructive border-destructive/30",
  cancelado: "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

type CoordenacaoOption = { id: string; nome: string };
type MonitoramentoOption = { id: string; termo_busca?: string | null; descricao?: string | null; tipo?: string | null; oab?: string | null; uf?: string | null };

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
  const cancelar = useCancelarExecucaoServidor();
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
        .select("tipo, horarios_execucao")
        .in("tipo", ["djen", "djen_paralela"]);
      if (error) throw error;
      return Array.from(new Set((data || []).flatMap((row) => row.horarios_execucao || []))) as string[];
    },
  });
  useEffect(() => {
    setHorariosTexto((JSON.parse(horariosKey) as string[]).join(", "));
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
      return ((data || []) as MonitoramentoOption[]).sort((a, b) =>
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
          {cfg.frequencia} · Servidor: {(cfg.horarios_execucao || []).join(", ") || "sem horário fixo"}
          {cfg.ultima_execucao && <> · Última: {fmtDate(cfg.ultima_execucao)}</>}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-primary" /> Agendamento do servidor
            </div>
            {cfg.ativo ? <Badge variant="default">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Horários BRT do servidor</label>
              <Input
                value={horariosTexto}
                onChange={(e) => setHorariosTexto(e.target.value)}
                onBlur={handleHorariosBlur}
                placeholder={cfg.frequencia === "diario" ? "07:30, 13:30" : "opcional"}
                disabled={ativaAgora}
                className={conflitoHorarioNormal ? "border-destructive focus-visible:ring-destructive" : undefined}
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleHorariosBlur} disabled={ativaAgora || conflitoHorarioNormal}>
              Salvar horário
            </Button>
          </div>
          {isParalela && horariosDjenNormal.length > 0 && (
            <p className={cn("text-xs", conflitoHorarioNormal ? "text-destructive" : "text-muted-foreground")}>
              DJEN normal: {horariosDjenNormal.join(", ")} {conflitoHorarioNormal && "· escolha outro horário para o servidor"}
            </p>
          )}
        </div>

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
                {(coordenacoes as CoordenacaoOption[]).map((c) => (
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
                  {(monitoramentos as MonitoramentoOption[]).map((m) => (
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
          disabled={ativaAgora || enfileirar.isPending || conflitoHorarioNormal}
        >
          {(ativaAgora || enfileirar.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
          {ativaAgora ? "Executando..." : "Executar agora"}
        </Button>

        {ativaAgora && exec?.id && (
          <Button
            size="sm"
            variant="destructive"
            className="w-full"
            onClick={() => cancelar.mutate(exec.id)}
            disabled={cancelar.isPending}
          >
            <StopCircle className="h-4 w-4 mr-2" />
            {cancelar.isPending ? "Cancelando..." : "Cancelar execução"}
          </Button>
        )}

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

function EngineTab({ tipo }: { tipo: string }) {
  const { data: cfgs = [], toggle, updateConfig } = useConfiguracoesServidor();
  const cfg = cfgs.find((c) => c.tipo === tipo);
  if (!cfg) {
    return <p className="text-sm text-muted-foreground">Configuração ainda não criada para <code>{tipo}</code>.</p>;
  }
  return (
    <div className="max-w-4xl mx-auto">
      <EngineCard
        cfg={cfg}
        onToggle={(id, ativo) => toggle.mutate({ id, ativo })}
        onConfig={(id, patch) => updateConfig.mutate({ id, patch })}
      />
    </div>
  );
}

function WorkersPanel() {
  const { data: workers = [] } = useWorkersServidor();
  const tick = useTickAge();
  return (
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
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");
  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const analise = useComparadorAnalise();
  const data = analise.data;
  const isLoading = analise.isPending;

  const handleAnalisar = () => {
    if (!dataInicio || !dataFim) return;
    analise.mutate({ dataInicio, dataFim, coordenacaoId: coordenacaoId || undefined });
  };

  const exportarRelatorioCsv = () => {
    if (!data) return;
    const header = "coordenacao,tipo_pesquisa,total_servidor,total_browser,em_ambos,so_servidor,so_browser\n";
    const body = data.linhas
      .map((l) =>
        [
          JSON.stringify(l.coordenacaoNome),
          l.tipo,
          l.totalServidor,
          l.totalBrowser,
          l.emAmbos,
          l.soServidor,
          l.soBrowser,
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_comparador_${dataInicio}_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tipoLabel: Record<string, string> = {
    advogado: "Advogado/OAB",
    processo: "Processo",
    "palavra-chave": "Palavra-chave",
    parte: "Parte",
    sem_monitoramento: "Sem monitoramento",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><GitCompare className="h-4 w-4" /> Comparador Servidor × Browser</CardTitle>
        <CardDescription>
          Escolha o período e clique em <strong>Analisar</strong> para gerar um relatório completo
          comparando, coordenação a coordenação e por tipo de pesquisa, quantas publicações foram
          capturadas pelo servidor (VPS) e pelo navegador, e quais são exclusivas de cada origem.
        </CardDescription>
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
          <div className="min-w-[220px]">
            <label className="text-xs text-muted-foreground">Coordenação</label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              value={coordenacaoId}
              onChange={(e) => setCoordenacaoId(e.target.value)}
            >
              <option value="">Todas</option>
              {(coordenacoes as CoordenacaoOption[]).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleAnalisar} disabled={isLoading || !dataInicio || !dataFim}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitCompare className="h-4 w-4 mr-2" />}
            Analisar
          </Button>
          {data && (
            <Button variant="outline" onClick={exportarRelatorioCsv}>
              Exportar CSV
            </Button>
          )}
        </div>
        {analise.error && (
          <p className="text-sm text-destructive">Erro ao gerar relatório: {(analise.error as Error).message}</p>
        )}
        {!data && !isLoading && (
          <p className="text-sm text-muted-foreground">
            Selecione um intervalo de datas (opcionalmente uma coordenação) e clique em <strong>Analisar</strong>.
          </p>
        )}
        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Servidor</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{data.totais.servidor}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Browser</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{data.totais.browser}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Em ambos</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{data.totais.emAmbos}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Só Servidor</CardTitle></CardHeader><CardContent className="text-xl font-semibold text-emerald-700">{data.totais.soServidor}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Só Browser</CardTitle></CardHeader><CardContent className="text-xl font-semibold text-amber-700">{data.totais.soBrowser}</CardContent></Card>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Como ler:</strong> cada linha mostra uma combinação de coordenação e tipo de pesquisa (Advogado/OAB, Processo, Palavra-chave, Parte).</p>
              <p>• <strong>Servidor</strong>: publicações capturadas pelo pipeline da VPS (24/7).</p>
              <p>• <strong>Browser</strong>: publicações capturadas pela execução agendada no navegador.</p>
              <p>• <strong>Em ambos</strong>: publicações idênticas encontradas pelas duas origens (sem divergência).</p>
              <p>• <strong>Só Servidor</strong>: o pipeline da VPS encontrou, o navegador não — indica que o servidor está capturando casos extras.</p>
              <p>• <strong>Só Browser</strong>: o navegador encontrou e o servidor não — indica lacuna no pipeline da VPS para revisar.</p>
            </div>

            {data.linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma publicação no período para os critérios selecionados.</p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coordenação</TableHead>
                      <TableHead>Tipo de pesquisa</TableHead>
                      <TableHead className="text-right">Servidor</TableHead>
                      <TableHead className="text-right">Browser</TableHead>
                      <TableHead className="text-right">Em ambos</TableHead>
                      <TableHead className="text-right">Só Servidor</TableHead>
                      <TableHead className="text-right">Só Browser</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.linhas.map((l) => {
                      const diff = l.soServidor - l.soBrowser;
                      return (
                        <TableRow key={`${l.coordenacaoId}-${l.tipo}`}>
                          <TableCell className="font-medium">{l.coordenacaoNome}</TableCell>
                          <TableCell><Badge variant="outline">{tipoLabel[l.tipo] || l.tipo}</Badge></TableCell>
                          <TableCell className="text-right">{l.totalServidor}</TableCell>
                          <TableCell className="text-right">{l.totalBrowser}</TableCell>
                          <TableCell className="text-right">{l.emAmbos}</TableCell>
                          <TableCell className="text-right text-emerald-700">{l.soServidor}</TableCell>
                          <TableCell className="text-right text-amber-700">{l.soBrowser}</TableCell>
                          <TableCell className={cn("text-right font-medium", diff > 0 ? "text-emerald-700" : diff < 0 ? "text-destructive" : "text-muted-foreground")}>
                            {diff > 0 ? `+${diff}` : diff}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Relatório gerado em {new Date(data.geradoEm).toLocaleString("pt-BR")} • Período {data.dataInicio} a {data.dataFim}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DjenServidor() {
  const [tab, setTab] = useState("servidor");
  return (
    <MainLayout
      title="DJEN Servidor"
      subtitle="Pipeline DJEN/Kurier/Pautas executado 24/7 na VPS, com tabela separada para comparação"
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="servidor"><Zap className="h-4 w-4 mr-1" />DJEN Termos</TabsTrigger>
          <TabsTrigger value="pautas"><Newspaper className="h-4 w-4 mr-1" />DJEN Pautas</TabsTrigger>
          <TabsTrigger value="kurier"><Radar className="h-4 w-4 mr-1" />DJEN Kurier</TabsTrigger>
          <TabsTrigger value="workers"><Server className="h-4 w-4 mr-1" />Workers</TabsTrigger>
          <TabsTrigger value="execucoes"><Activity className="h-4 w-4 mr-1" />Execuções</TabsTrigger>
          <TabsTrigger value="publicacoes"><FileSearch className="h-4 w-4 mr-1" />Publicações</TabsTrigger>
          <TabsTrigger value="comparador"><GitCompare className="h-4 w-4 mr-1" />Comparador</TabsTrigger>
        </TabsList>
        <TabsContent value="servidor"><div className="space-y-4"><DjenServidorParalelaCard /></div></TabsContent>
        <TabsContent value="pautas"><EngineTab tipo="djet_pautas_servidor" /></TabsContent>
        <TabsContent value="kurier"><EngineTab tipo="kurier_servidor" /></TabsContent>
        <TabsContent value="workers"><WorkersPanel /></TabsContent>
        <TabsContent value="execucoes"><ExecucoesPanel /></TabsContent>
        <TabsContent value="publicacoes"><PublicacoesPanel /></TabsContent>
        <TabsContent value="comparador"><ComparadorPanel /></TabsContent>
      </Tabs>
    </MainLayout>
  );
}