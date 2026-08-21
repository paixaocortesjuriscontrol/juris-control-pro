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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Server, Activity, FileSearch, GitCompare, PlayCircle, Loader2, CalendarIcon, CheckCircle2, XCircle, Clock, StopCircle, Zap, Newspaper, Radar, Landmark, Star } from "lucide-react";
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
import { DjenServidorStfCard } from "@/components/djen/DjenServidorStfCard";
import { MonitoramentoTermosKurierCard } from "@/components/configuracoes/MonitoramentoTermosKurierCard";
import { MonitoramentoDjetPautasCard } from "@/components/configuracoes/MonitoramentoDjetPautasCard";
import { HorariosDoDiaPicker } from "@/components/djen/HorariosDoDiaPicker";
import { DiasSemanaPicker, DIAS_SEMANA_DEFAULT } from "@/components/djen/DiasSemanaPicker";
import { AcompanhamentoEspecialPanel } from "@/components/djen/AcompanhamentoEspecialPanel";

const LABELS: Record<string, string> = {
  djen_paralela_servidor: "DJEN Termos",
  kurier_servidor: "DJEN Kurier",
  djet_pautas_servidor: "DJEN Pautas",
};

const STATUS_HEADER: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: "Aguardando", color: "text-amber-700", bg: "bg-amber-500/10" },
  executando: { label: "Executando", color: "text-[hsl(var(--area-civil))]", bg: "bg-[hsl(var(--area-civil))]/10" },
  concluido: { label: "Concluído", color: "text-muted-foreground", bg: "bg-muted/50" },
  cancelado: { label: "Cancelado", color: "text-amber-700", bg: "bg-amber-500/10" },
  erro: { label: "Erro", color: "text-destructive", bg: "bg-destructive/10" },
  idle: { label: "Ocioso", color: "text-muted-foreground", bg: "bg-muted/50" },
};

const ITEM_STATUS: Record<string, string> = {
  pendente: "bg-muted/50 text-muted-foreground border-border",
  executando: "bg-[hsl(var(--area-civil))]/15 text-[hsl(var(--area-civil))] border-[hsl(var(--area-civil))]/30",
  concluido: "bg-muted/60 text-muted-foreground border-border",
  concluido_com_resultado: "bg-[hsl(var(--status-active))]/15 text-[hsl(var(--status-active))] border-[hsl(var(--status-active))]/30",
  sem_caderno: "bg-amber-500/15 text-amber-700 border-amber-500/30",
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
  const horariosServidor = (cfg.horarios_execucao || []) as string[];
  const conflitoHorarioNormal = isParalela && horariosServidor.some((h) => horariosDjenNormal.includes(h));

  const persistirHorarios = (proximos: string[]) => {
    if (isParalela && proximos.some((h) => horariosDjenNormal.includes(h))) return;
    const atual = JSON.stringify(cfg.horarios_execucao || []);
    if (atual !== JSON.stringify(proximos)) onConfig(cfg.id, { horarios_execucao: proximos });
  };

  const diasSemana: number[] = Array.isArray((cfg.metadata as any)?.dias_semana)
    ? ((cfg.metadata as any).dias_semana as number[])
    : DIAS_SEMANA_DEFAULT;
  const persistirDiasSemana = (proximos: number[]) => {
    const meta = { ...((cfg.metadata as Record<string, unknown>) || {}), dias_semana: proximos };
    onConfig(cfg.id, { metadata: meta });
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
        .eq("ativo", true)
        .eq("arquivado", false);
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
  const sumNovas = itens.reduce((sum, it) => sum + (Number(it.novas) || 0), 0);
  const sumDup = itens.reduce((sum, it) => sum + (Number(it.duplicatas) || 0), 0);
  const sumDesc = itens.reduce((sum, it) => sum + (Number(it.descartadas) || 0), 0);
  const novasProgresso = Math.max(sumNovas, Number(progresso?.novas) || 0, Number(exec?.resultado?.novas) || 0);
  const duplicadasProgresso = Math.max(sumDup, Number(progresso?.duplicatas) || 0, Number(exec?.resultado?.duplicatas) || 0);
  const descartadasProgresso = Math.max(sumDesc, Number(progresso?.descartadas) || 0, Number(exec?.resultado?.descartadas) || 0);
  const encontradasProgresso = cfg.tipo === "djet_pautas_servidor"
    ? Math.max(
        novasProgresso + duplicadasProgresso,
        Number(exec?.resultado?.encontradas) || 0,
      )
    : novasProgresso;

  const handleRun = () => {
    if (!dataInicio || !dataFim) return;
    const payload: Record<string, unknown> = {
      dataInicio: ymd(dataInicio),
      dataFim: ymd(dataFim),
    };
    if (isParalela) payload.resetCheckpoint = true;
    if (isParalela) {
      if (coordenacaoId) payload.coordenacaoId = coordenacaoId;
      if (monitoramentoId) payload.monitoramentoIds = [monitoramentoId];
    }
    if (isPautas && reprocessarEdicoes) payload.reprocessarEdicoes = true;
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
              <Clock className="h-4 w-4 text-primary" /> Agendamento do servidor (até 3x/dia)
            </div>
            {cfg.ativo ? <Badge variant="default">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Horários BRT (até 3 por dia)</label>
            <HorariosDoDiaPicker
              value={horariosServidor}
              onChange={persistirHorarios}
              disabled={ativaAgora}
              conflitos={isParalela ? horariosDjenNormal : []}
              conflitoLabel={isParalela ? "Conflito com DJEN browser" : undefined}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Dias da semana</label>
            <DiasSemanaPicker
              value={diasSemana}
              onChange={persistirDiasSemana}
              disabled={ativaAgora}
            />
          </div>
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

        {isPautas && (
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={reprocessarEdicoes}
              onChange={(e) => setReprocessarEdicoes(e.target.checked)}
              disabled={ativaAgora}
            />
            <span>
              Reprocessar edição já lida (o DEJT publica só o caderno vigente; marque para
              varrer novamente a mesma edição)
            </span>
          </label>
        )}



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
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {cfg.tipo === "djet_pautas_servidor" && (
                <span>🔎 Encontradas: <strong>{encontradasProgresso}</strong></span>
              )}
              <span>✅ Novas: <strong className="text-[hsl(var(--status-active))]">{novasProgresso}</strong></span>
              <span>♻️ {cfg.tipo === "djet_pautas_servidor" ? "Já existentes" : "Duplicadas"}: <strong>{duplicadasProgresso}</strong></span>
              <span>❌ Descartadas: <strong>{descartadasProgresso}</strong></span>
            </div>
            {progresso?.atual && (
              <p className="text-xs text-muted-foreground truncate">
                <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                {progresso.atual.label}
              </p>
            )}
            {itens.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1 mt-2 pr-1">
                {itens.slice().reverse().slice(0, 50).map((it) => {
                  const statusKey = it.status === "concluido" && ((it.novas || 0) > 0 || (it.duplicatas || 0) > 0)
                    ? "concluido_com_resultado"
                    : it.status === "concluido" && (it.diasSemPdf || 0) > 0
                      ? "sem_caderno"
                      : it.status;
                  return (
                  <div key={it.id} className="flex items-center gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        ITEM_STATUS[statusKey]
                      )}
                    >
                      {statusKey === "sem_caderno" ? "sem caderno" : it.status}
                    </Badge>
                    <span className="truncate flex-1" title={it.mensagem || it.label}>
                      {it.label}
                      {it.mensagem && <span className="text-muted-foreground"> · {it.mensagem}</span>}
                    </span>
                    {it.status === "concluido" && (it.novas ?? 0) > 0 && (
                      <span className="text-emerald-600 font-medium">+{it.novas}</span>
                    )}
                  </div>
                  );
                })}
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
  const { data: execs = [], isLoading } = useExecucoesServidor(500);
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [dataFiltro, setDataFiltro] = useState<string>("");

  const filtrados = useMemo(() => {
    return execs.filter((e) => {
      if (tipoFiltro !== "todos" && e.tipo !== tipoFiltro) return false;
      if (
        statusFiltro === "sucesso" &&
        e.status !== "concluido" &&
        e.status !== "concluido_parcial"
      )
        return false;
      if (statusFiltro === "cancelado" && e.status !== "cancelado") return false;
      if (statusFiltro === "falhou" && e.status !== "falhou") return false;
      if (statusFiltro === "erro" && e.status !== "erro") return false;
      if (dataFiltro) {
        const ref = e.iniciado_em || e.agendado_para || e.created_at;
        if (!ref) return false;
        // Compara pelo dia em BRT
        const ymdBrt = new Date(ref).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        if (ymdBrt !== dataFiltro) return false;
      }
      return true;
    });
  }, [execs, tipoFiltro, statusFiltro, dataFiltro]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Execuções ao vivo</CardTitle>
        <CardDescription>Realtime — últimas 500 execuções (aplicar filtros abaixo)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="min-w-[180px]">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="djen_paralela_servidor">DJEN Termos</SelectItem>
                <SelectItem value="djet_pautas_servidor">DJEN Pautas</SelectItem>
                <SelectItem value="kurier_servidor">DJEN Kurier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sucesso">Sucesso</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="falhou">Falhou</SelectItem>
                <SelectItem value="erro">Com erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Data de execução (BRT)</label>
            <Input type="date" value={dataFiltro} onChange={(e) => setDataFiltro(e.target.value)} />
          </div>
          {dataFiltro && (
            <Button variant="ghost" size="sm" onClick={() => setDataFiltro("")}>Limpar data</Button>
          )}
          <Badge variant="outline">{filtrados.length} resultados</Badge>
        </div>
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
              {filtrados.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{LABELS[e.tipo] || e.tipo}</TableCell>
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
  const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  nowBrt.setDate(nowBrt.getDate() + offsetDays);
  const y = nowBrt.getFullYear();
  const m = String(nowBrt.getMonth() + 1).padStart(2, "0");
  const d = String(nowBrt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const [dataInicio, setDataInicio] = useState(todayYmd());
  const [dataFim, setDataFim] = useState(todayYmd());
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");
  const [origem, setOrigem] = useState<"todos" | "termos" | "pautas" | "kurier">("todos");
  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const analise = useComparadorAnalise();
  const data = analise.data;
  const isLoading = analise.isPending;

  const handleAnalisar = () => {
    if (!dataInicio || !dataFim) return;
    analise.mutate({ dataInicio, dataFim, coordenacaoId: coordenacaoId || undefined, origem });
  };

  const exportarRelatorioCsv = () => {
    if (!data) return;
    const header1 = "# Comparador DJEN Servidor x Browser — comparação independente por coordenação + id_djen. A mesma publicação em coordenações diferentes conta separadamente; dedup só remove repetição dentro da mesma coordenação.\n";
    const cols1 = "coordenacao,total_servidor,total_browser_djen,total_browser_oficial,em_ambos,so_servidor,so_browser,duplicadas_servidor,duplicadas_browser,djen_unico\n";
    const body1 = data.globalLinhas
      .map((l) =>
        [
          JSON.stringify(l.coordenacaoNome),
          l.totalServidor,
          l.totalBrowser,
          l.totalBrowserOficial,
          l.emAmbos,
          l.soServidor,
          l.soBrowser,
          l.duplicadasServidor,
          l.duplicadasBrowser,
          l.djenUnico,
        ].join(","),
      )
      .join("\n");
    const headerDiag = "\n\n# Quebra por tipo de monitoramento (diagnóstico secundário: tipo que capturou a publicação)\n";
    const colsDiag = "coordenacao,tipo_pesquisa,total_servidor,total_browser,em_ambos,so_servidor,so_browser\n";
    const bodyDiag = data.linhas
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
    const header2 = "\n\n# Resumo por fonte de busca (DJEN x Kurier x Pautas)\n";
    const cols2 = "coordenacao,djen_servidor,djen_browser,djen_unico,kurier,pautas_tst,browser_oficial\n";
    const body2 = data.porFonte.linhas
      .map((l) => [
        JSON.stringify(l.coordenacaoNome),
        l.djenServidor, l.djenBrowser, l.djenUnico, l.kurier, l.pautas ?? "", l.browserOficial,
      ].join(","))
      .join("\n");
    const totais = `\n\n# Totais\nfonte,total\nDJEN_servidor,${data.porFonte.totais.djenServidor}\nDJEN_browser,${data.porFonte.totais.djenBrowser}\nDJEN_unico,${data.porFonte.totais.djenUnico}\nKurier,${data.porFonte.totais.kurier}\nPautas_TST,${data.porFonte.totais.pautas}\nBrowser_oficial_analise_djen,${data.porFonte.totais.browserOficial}\n`;
    const header3 = "\n\n# Publicações exclusivas por origem (detalhamento auditável)\n";
    const cols3 = "coordenacao,origem,provavel_causa,motivo_exato,existe_na_mesma_origem_outra_coord,coords_mesma_origem_outra_coord,capturado_na_mesma_origem_em,existe_na_outra_origem_outra_coord,coords_outra_origem_outra_coord,capturado_na_outra_origem_em,tipo_pesquisa,termo_busca,monitoramento_id,tribunal,processo,data_publicacao,data_disponibilizacao,id_djen,capturado_em,execucao_id_servidor,execucao_servidor_status,execucao_servidor_agendada_para,execucao_servidor_finalizada_em\n";
    const body3 = (data.detalhes || [])
      .map((d) => [
        JSON.stringify(d.coordenacaoNome),
        d.origem,
        d.provavel_causa || "",
        d.motivo_exato || "",
        d.existe_na_mesma_origem_outra_coord ? "SIM" : "NÃO",
        JSON.stringify(d.coords_mesma_origem_outra_coord || ""),
        JSON.stringify(d.capturado_na_mesma_origem_em || ""),
        d.existe_na_outra_origem_outra_coord ? "SIM" : "NÃO",
        JSON.stringify(d.coords_outra_origem_outra_coord || ""),
        JSON.stringify(d.capturado_na_outra_origem_em || ""),
        d.tipo,
        JSON.stringify(d.termo_busca || ""),
        JSON.stringify(d.monitoramento_id || ""),
        JSON.stringify(d.tribunal || ""),
        JSON.stringify(d.processo_numero || ""),
        JSON.stringify(d.data_publicacao || ""),
        JSON.stringify(d.data_disponibilizacao || ""),
        JSON.stringify(d.id_djen || ""),
        JSON.stringify(d.capturado_em || ""),
        JSON.stringify(d.execucao_id_servidor || ""),
        JSON.stringify(d.execucao_servidor_status || ""),
        JSON.stringify(d.execucao_servidor_agendada_para || ""),
        JSON.stringify(d.execucao_servidor_finalizada_em || ""),
      ].join(","))
      .join("\n");
    const header4 = "\n\n# Publicações duplicadas por origem (mesma chave de comparação antes de comparar)\n";
    const cols4 = "coordenacao,origem,tipo_pesquisa,tribunal,processo,data_publicacao,data_disponibilizacao,id_djen_primeiro,ids_djen_todos,total_registros,duplicadas,termos_busca,monitoramento_ids\n";
    const body4 = (data.detalhesDuplicadas || [])
      .map((d) => [
        JSON.stringify(d.coordenacaoNome),
        d.origem,
        d.tipo,
        JSON.stringify(d.tribunal || ""),
        JSON.stringify(d.processo_numero || ""),
        JSON.stringify(d.data_publicacao || ""),
        JSON.stringify(d.data_disponibilizacao || ""),
        JSON.stringify(d.id_djen || ""),
        JSON.stringify((d.ids_djen || []).join(" | ")),
        d.total_registros,
        d.duplicadas,
        JSON.stringify(d.termos_busca.join(" | ")),
        JSON.stringify(d.monitoramento_ids.join(" | ")),
      ].join(","))
      .join("\n");
    const blob = new Blob(
      [header1 + cols1 + body1 + headerDiag + colsDiag + bodyDiag + header2 + cols2 + body2 + totais + header3 + cols3 + body3 + header4 + cols4 + body4 + "\n"],
      { type: "text/csv" },
    );
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
          O comparador usa <strong>data da captura (BRT)</strong>. O total “Browser oficial” é a mesma base da tela
          Análise DJEN (<code>publicacoes_djen</code>, incluindo Kurier/Pautas); os cards “Servidor × Browser DJEN”
          comparam apenas DJEN Termos por <code> coordenação + id_djen</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground">Início captura (BRT)</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim captura (BRT)</label>
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
          <div className="min-w-[180px]">
            <label className="text-xs text-muted-foreground">Origem</label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              value={origem}
              onChange={(e) => setOrigem(e.target.value as typeof origem)}
            >
              <option value="todos">Todos</option>
              <option value="termos">DJEN Termos</option>
              <option value="pautas">Pautas</option>
              <option value="kurier">Kurier</option>
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
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Servidor</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{data.totais.servidor}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Browser DJEN</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{data.totais.browser}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Browser oficial Análise</CardTitle></CardHeader><CardContent className="text-xl font-semibold text-primary">{data.totais.browserOficial}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Em ambos</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{data.totais.emAmbos}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Só Servidor</CardTitle></CardHeader><CardContent className="text-xl font-semibold text-emerald-700">{data.totais.soServidor}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Só Browser</CardTitle></CardHeader><CardContent className="text-xl font-semibold text-amber-700">{data.totais.soBrowser}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Duplicadas Servidor</CardTitle></CardHeader><CardContent className="text-xl font-semibold text-muted-foreground">{data.totais.duplicadasServidor}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Duplicadas Browser</CardTitle></CardHeader><CardContent className="text-xl font-semibold text-muted-foreground">{data.totais.duplicadasBrowser}</CardContent></Card>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Comparação por coordenação + id_djen</h3>
              {data.globalLinhas.length > 0 && (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coordenação</TableHead>
                        <TableHead className="text-right">Servidor</TableHead>
                        <TableHead className="text-right">Browser DJEN</TableHead>
                        <TableHead className="text-right">Browser oficial</TableHead>
                        <TableHead className="text-right">Em ambos</TableHead>
                        <TableHead className="text-right">Só Servidor</TableHead>
                        <TableHead className="text-right">Só Browser</TableHead>
                        <TableHead className="text-right">Dup. Servidor</TableHead>
                        <TableHead className="text-right">Dup. Browser</TableHead>
                        <TableHead className="text-right">DJEN único</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.globalLinhas.map((l) => (
                        <TableRow key={`global-${l.coordenacaoId}`}>
                          <TableCell className="font-medium">{l.coordenacaoNome}</TableCell>
                          <TableCell className="text-right">{l.totalServidor}</TableCell>
                          <TableCell className="text-right">{l.totalBrowser}</TableCell>
                          <TableCell className="text-right font-medium text-primary">{l.totalBrowserOficial}</TableCell>
                          <TableCell className="text-right">{l.emAmbos}</TableCell>
                          <TableCell className="text-right text-emerald-700">{l.soServidor}</TableCell>
                          <TableCell className="text-right text-amber-700">{l.soBrowser}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{l.duplicadasServidor}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{l.duplicadasBrowser}</TableCell>
                          <TableCell className="text-right font-medium text-primary">{l.djenUnico}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Esta é a leitura principal do DJEN: cada linha conta chaves únicas <code>coordenação + id_djen</code>. A coluna “Browser oficial” mostra o total da tela Análise DJEN para a mesma data de captura BRT.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Resumo por fonte de busca</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">DJEN (único servidor+browser)</CardTitle></CardHeader><CardContent className="text-xl font-semibold text-primary">{data.porFonte.totais.djenUnico}</CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Kurier</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{data.porFonte.totais.kurier}</CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Pautas TST {coordenacaoId ? "(N/A c/ filtro)" : ""}</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{coordenacaoId ? "—" : data.porFonte.totais.pautas}</CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Browser oficial Análise</CardTitle></CardHeader><CardContent className="text-xl font-semibold text-primary">{data.porFonte.totais.browserOficial}</CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total geral oficial</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{data.porFonte.totais.browserOficial + (coordenacaoId ? 0 : data.porFonte.totais.pautas)}</CardContent></Card>
              </div>
              {data.porFonte.linhas.length > 0 && (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coordenação</TableHead>
                        <TableHead className="text-right">DJEN Servidor</TableHead>
                        <TableHead className="text-right">DJEN Browser</TableHead>
                        <TableHead className="text-right">DJEN (único)</TableHead>
                        <TableHead className="text-right">Kurier</TableHead>
                        <TableHead className="text-right">Pautas TST</TableHead>
                        <TableHead className="text-right">Browser oficial</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.porFonte.linhas.map((l) => (
                        <TableRow key={`fonte-${l.coordenacaoId}`}>
                          <TableCell className="font-medium">{l.coordenacaoNome}</TableCell>
                          <TableCell className="text-right">{l.djenServidor}</TableCell>
                          <TableCell className="text-right">{l.djenBrowser}</TableCell>
                          <TableCell className="text-right font-medium text-primary">{l.djenUnico}</TableCell>
                          <TableCell className="text-right">{l.kurier}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{l.pautas ?? "—"}</TableCell>
                          <TableCell className="text-right font-medium text-primary">{l.browserOficial}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                <strong>Browser oficial Análise</strong> = registros da tabela oficial <code>publicacoes_djen</code> por data de captura BRT, incluindo Kurier/Pautas, para bater com a tela Análise DJEN. <strong>DJEN</strong> = comparador servidor × browser apenas de DJEN Termos (chave dedupada). <strong>Pautas TST</strong> = registros em <code>pautas_tst</code> com <code>data_julgamento</code> no período (sem coordenação — exibido apenas no total).
              </p>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Diagnóstico do período:</strong> {data.diagnostico.motivoDiferencaPrincipal}</p>
              <p>
                Execuções servidor na janela: DJEN Termos <strong>{data.diagnostico.execucoesDjenServidor}</strong>, Kurier servidor <strong>{data.diagnostico.execucoesKurierServidor}</strong>, Pautas servidor <strong>{data.diagnostico.execucoesPautasServidor}</strong>.
                {data.diagnostico.execucoesKurierServidor === 0 && data.diagnostico.browserKurier > 0 && (
                  <> Por isso o Browser oficial fica maior: há <strong>{data.diagnostico.browserKurier}</strong> publicações Kurier no Browser oficial, mas nenhuma execução Kurier servidor no dia analisado.</>
                )}
              </p>
              <p><strong>Como ler:</strong> os cinco cards acima (Total Servidor, Total Browser, Em ambos, Só Servidor, Só Browser) são a comparação <strong>por coordenação</strong> (chave <code>coordenação + id_djen</code>), independente do tipo de pesquisa.</p>
              <p>A tabela abaixo decompõe esses números pelo tipo do monitoramento que capturou cada publicação, só como diagnóstico — uma mesma publicação aparece em apenas um tipo por lado.</p>
              <p>• <strong>Servidor</strong>: publicações capturadas pelo pipeline da VPS (24/7).</p>
              <p>• <strong>Browser</strong>: publicações capturadas pela execução agendada no navegador.</p>
              <p>• <strong>Em ambos</strong>: mesma <code>id_djen</code> encontrada pelas duas origens (sem divergência).</p>
              <p>• <strong>Só Servidor</strong>: o pipeline da VPS encontrou, o navegador não — indica que o servidor está capturando casos extras.</p>
              <p>• <strong>Só Browser</strong>: o navegador encontrou e o servidor não — indica lacuna no pipeline da VPS para revisar.</p>
            </div>

            {data.execucoesServidor.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Execuções servidor usadas no diagnóstico</h3>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Motor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Agendado</TableHead>
                        <TableHead>Finalizado</TableHead>
                        <TableHead className="text-right">Novas</TableHead>
                        <TableHead className="text-right">Descartadas</TableHead>
                        <TableHead className="text-right">Duplicatas</TableHead>
                        <TableHead className="text-right">Monitoramentos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.execucoesServidor.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{LABELS[e.tipo] || e.tipo}</TableCell>
                          <TableCell>{statusBadge(e.status || "—")}</TableCell>
                          <TableCell className="text-xs">{fmtDate(e.agendado_para)}</TableCell>
                          <TableCell className="text-xs">{fmtDate(e.finalizado_em)}</TableCell>
                          <TableCell className="text-right">{e.novas ?? "—"}</TableCell>
                          <TableCell className="text-right">{e.descartadas ?? "—"}</TableCell>
                          <TableCell className="text-right">{e.duplicatas ?? "—"}</TableCell>
                          <TableCell className="text-right">{e.monitoramentos ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {data.linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma publicação no período para os critérios selecionados.</p>
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Quebra por tipo de monitoramento (diagnóstico)</h3>
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
          <TabsTrigger value="stf"><Landmark className="h-4 w-4 mr-1" />STF</TabsTrigger>
          <TabsTrigger value="pautas"><Newspaper className="h-4 w-4 mr-1" />DJEN Pautas</TabsTrigger>
          <TabsTrigger value="kurier"><Radar className="h-4 w-4 mr-1" />DJEN Kurier</TabsTrigger>
          <TabsTrigger value="workers"><Server className="h-4 w-4 mr-1" />Workers</TabsTrigger>
          <TabsTrigger value="execucoes"><Activity className="h-4 w-4 mr-1" />Execuções</TabsTrigger>
          <TabsTrigger value="publicacoes"><FileSearch className="h-4 w-4 mr-1" />Publicações</TabsTrigger>
          <TabsTrigger value="comparador"><GitCompare className="h-4 w-4 mr-1" />Comparador</TabsTrigger>
        <TabsTrigger value="acompanhamento-especial"><Star className="h-4 w-4 mr-1" />Acompanhamento Especial</TabsTrigger>
        </TabsList>
        <TabsContent value="servidor"><div className="space-y-4"><DjenServidorParalelaCard /></div></TabsContent>
        <TabsContent value="stf"><div className="space-y-4"><DjenServidorStfCard /></div></TabsContent>
        <TabsContent value="pautas"><MonitoramentoDjetPautasCard /></TabsContent>
        <TabsContent value="kurier"><MonitoramentoTermosKurierCard /></TabsContent>
        <TabsContent value="workers"><WorkersPanel /></TabsContent>
        <TabsContent value="execucoes"><ExecucoesPanel /></TabsContent>
        <TabsContent value="publicacoes"><PublicacoesPanel /></TabsContent>
        <TabsContent value="comparador"><ComparadorPanel /></TabsContent>
        <TabsContent value="acompanhamento-especial"><AcompanhamentoEspecialPanel /></TabsContent>
      </Tabs>
    </MainLayout>
  );
}