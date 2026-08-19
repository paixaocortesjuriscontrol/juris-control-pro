import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  PlayCircle,
  RotateCcw,
  Server,
  Skull,
  StopCircle,
  Trash2,
  Wifi,
  XCircle,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import {
  useCancelarExecucaoServidor,
  useConfiguracoesServidor,
  useEnfileirarManual,
  useExecucaoServidorAoVivo,
  useTickAge,
  useWorkersServidor,
  type ProgressoItem,
} from "@/hooks/useDjenServidor";
import { formatMonitoramentoLabel } from "@/utils/monitoramentoLabel";
import { HorariosDoDiaPicker } from "@/components/djen/HorariosDoDiaPicker";
import { DiasSemanaPicker, DIAS_SEMANA_DEFAULT } from "@/components/djen/DiasSemanaPicker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Monta o texto do tooltip de falhas de um tribunal (termo, dia e código). */
function detalheFalhas(track: ProgressoItem): string {
  const linhas: string[] = [];
  const codigos = Object.entries(track.errosPorCodigo || {});
  if (codigos.length > 0) {
    linhas.push(codigos.map(([cod, qtd]) => `${/^\d{3}$/.test(cod) ? `HTTP ${cod}` : cod}: ${qtd}`).join(" · "));
  }
  if ((track.paresRecuperados || 0) > 0) linhas.push(`${track.paresRecuperados} recuperado(s) no retry`);
  if ((track.paresComFalha || 0) > 0) linhas.push(`${track.paresComFalha} termo(s)/dia sem coleta`);
  for (const d of (track.erroDetalhes || []).slice(0, 10)) {
    linhas.push(`• ${d.termo || "termo ?"}${d.dia ? ` (${d.dia})` : ""} — ${d.codigo && /^\d{3}$/.test(d.codigo) ? `HTTP ${d.codigo}` : d.codigo || "erro"}`);
  }
  if (linhas.length === 0) linhas.push(track.erro || "");
  return linhas.join("\n");
}

type MonitoramentoOption = {
  id: string;
  termo_busca?: string | null;
  descricao?: string | null;
  tipo?: string | null;
  oab?: string | null;
  uf?: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  idle: { label: "Aguardando", color: "text-muted-foreground", bg: "bg-muted/50" },
  pendente: { label: "Aguardando", color: "text-amber-700", bg: "bg-amber-500/10" },
  executando: { label: "Executando", color: "text-[hsl(var(--area-civil))]", bg: "bg-[hsl(var(--area-civil))]/10" },
  concluido: { label: "Concluído", color: "text-muted-foreground", bg: "bg-muted/50" },
  cancelado: { label: "Cancelado", color: "text-amber-700", bg: "bg-amber-500/10" },
  erro: { label: "Erro", color: "text-destructive", bg: "bg-destructive/10" },
  falhou: { label: "Falhou", color: "text-destructive", bg: "bg-destructive/10" },
};

const TRACK_COLORS: Record<string, string> = {
  pendente: "bg-muted/50 text-muted-foreground border-border",
  executando: "bg-[hsl(var(--area-civil))]/15 text-[hsl(var(--area-civil))] border-[hsl(var(--area-civil))]/30",
  concluido: "bg-muted/60 text-muted-foreground border-border",
  concluido_com_resultado: "bg-[hsl(var(--status-active))]/15 text-[hsl(var(--status-active))] border-[hsl(var(--status-active))]/30",
  erro: "bg-destructive/15 text-destructive border-destructive/30",
  cancelado: "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

function ymd(date?: Date) {
  return date ? format(date, "yyyy-MM-dd") : undefined;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function nextRunLabel(horario?: string) {
  if (!horario) return null;
  const [h, m] = horario.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const today = new Date();
  const isToday = next.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = next.toDateString() === tomorrow.toDateString();
  const prefix = isToday ? "Hoje" : isTomorrow ? "Amanhã" : next.toLocaleDateString("pt-BR");
  return `${prefix} às ${horario}`;
}

function statusPct(item: ProgressoItem) {
  if (typeof item.current === "number" && typeof item.total === "number" && item.total > 0) {
    return Math.min(100, Math.round((item.current / item.total) * 100));
  }
  if (item.status === "concluido") return 100;
  if (item.status === "erro" || item.status === "cancelado") return 100;
  if (item.status === "executando") return 50;
  return 0;
}

export function DjenServidorParalelaCard() {
  const queryClient = useQueryClient();
  const { data: configs = [], toggle, updateConfig } = useConfiguracoesServidor();
  const cfg = configs.find((c) => c.tipo === "djen_paralela_servidor");
  const live = useExecucaoServidorAoVivo("djen_paralela_servidor");
  const enfileirar = useEnfileirarManual();
  const cancelar = useCancelarExecucaoServidor();
  const { data: workers = [] } = useWorkersServidor();
  const nowTick = useTickAge();

  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [filtroCoordenacaoId, setFiltroCoordenacaoId] = useState("");
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");

  useEffect(() => {
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    setDataInicio((value) => value || hoje);
    setDataFim((value) => value || hoje);
  }, []);

  const diasSemana = ((cfg?.metadata as any)?.dias_semana as number[] | undefined) || DIAS_SEMANA_DEFAULT;

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const coordenacaoFiltroEfetivo = filtroCoordenacaoId || null;

  const { data: monitoramentos = [] } = useQuery({
    queryKey: ["djen-servidor-monitoramentos-card", coordenacaoFiltroEfetivo],
    queryFn: async () => {
      if (!coordenacaoFiltroEfetivo) return [];
      const { data, error } = await supabase
        .from("monitoramentos_djen")
        .select("id, termo_busca, descricao, tipo, oab, uf")
        .eq("coordenacao_id", coordenacaoFiltroEfetivo)
        .eq("ativo", true);
      if (error) throw error;
      return ((data || []) as MonitoramentoOption[]).sort((a, b) =>
        formatMonitoramentoLabel(a).localeCompare(formatMonitoramentoLabel(b), "pt-BR", { sensitivity: "base" })
      );
    },
    enabled: !!coordenacaoFiltroEfetivo,
  });

  useEffect(() => {
    if (!filtroCoordenacaoId) setFiltroMonitoramentoId("");
  }, [filtroCoordenacaoId]);

  useEffect(() => {
    setFiltroMonitoramentoId("");
  }, [filtroTipo]);

  const monitoramentosFiltrados = filtroTipo
    ? monitoramentos.filter((m) => (m.tipo || "") === filtroTipo)
    : monitoramentos;

  const exec = live.data;
  const execStatus = exec?.status || "idle";
  const isRunning = execStatus === "pendente" || execStatus === "executando";
  const statusConfig = STATUS_CONFIG[execStatus] || STATUS_CONFIG.idle;

  // Heartbeat watchdog visual: detecta worker travado
  const heartbeatMs = exec?.heartbeat_at ? nowTick - new Date(exec.heartbeat_at).getTime() : null;
  const heartbeatSec = heartbeatMs != null ? Math.floor(heartbeatMs / 1000) : null;
  const heartbeatStale = isRunning && heartbeatSec != null && heartbeatSec > 120;
  const heartbeatDead = isRunning && heartbeatSec != null && heartbeatSec > 180;
  const heartbeatColor =
    heartbeatSec == null ? "text-muted-foreground"
    : heartbeatDead ? "text-destructive"
    : heartbeatStale ? "text-amber-500"
    : "text-emerald-500";

  const handleDestravar = useCallback(async () => {
    if (!exec?.id) return;
    const { error } = await supabase.rpc("destravar_execucao_servidor" as never, { p_id: exec.id } as never);
    if (error) {
      toast.error(`Falha ao destravar: ${error.message}`);
      return;
    }
    toast.success("Execução destravada — pode rodar novamente");
    await queryClient.invalidateQueries({ queryKey: ["djen-servidor"] });
  }, [exec?.id, queryClient]);
  const progress = exec?.progresso;
  const tracks = ((progress?.itens || []) as ProgressoItem[]).map((track) =>
    execStatus === "cancelado" && (track.status === "executando" || track.status === "pendente")
      ? { ...track, status: "cancelado" as const, mensagem: "Cancelado pelo usuário" }
      : track
  );
  const total = progress?.totalItens ?? tracks.length;
  const done = progress?.concluidos ?? tracks.filter((t) => ["concluido", "erro", "cancelado"].includes(t.status)).length;
  const falhas = progress?.falhas ?? tracks.filter((t) => t.status === "erro").length;
  // Durante a execução, sempre somar dos tracks ao vivo (resultado só fica
  // disponível ao final). Mesmo no fim, se a soma dos tracks for maior que o
  // resultado, usamos a soma — assim descartadas/duplicadas aparecem certo
  // mesmo quando o backend gravou `resultado.descartadas = 0` por falha de
  // consolidação.
  const sumNovas = tracks.reduce((sum, t) => sum + (Number(t.novas) || 0), 0);
  const sumDup = tracks.reduce((sum, t) => sum + (Number(t.duplicatas) || 0), 0);
  const sumDesc = tracks.reduce((sum, t) => sum + (Number(t.descartadas) || 0), 0);
  const resultadoNovas = Number(exec?.resultado?.novas ?? NaN);
  const resultadoDup = Number(exec?.resultado?.duplicatas ?? NaN);
  const resultadoDesc = Number(exec?.resultado?.descartadas ?? NaN);
  const progressoNovas = Number(progress?.novas ?? NaN);
  const progressoDup = Number(progress?.duplicatas ?? NaN);
  const progressoDesc = Number(progress?.descartadas ?? NaN);
  const novas = isRunning
    ? Math.max(sumNovas, Number.isFinite(progressoNovas) ? progressoNovas : 0)
    : Math.max(sumNovas, Number.isFinite(resultadoNovas) ? resultadoNovas : 0);
  const duplicadas = isRunning
    ? Math.max(sumDup, Number.isFinite(progressoDup) ? progressoDup : 0)
    : Math.max(sumDup, Number.isFinite(resultadoDup) ? resultadoDup : 0);
  const descartadas = isRunning
    ? Math.max(sumDesc, Number.isFinite(progressoDesc) ? progressoDesc : 0)
    : Math.max(sumDesc, Number.isFinite(resultadoDesc) ? resultadoDesc : 0);
  const percentage = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const tempoDecorrido = exec?.iniciado_em
    ? Math.max(0, Math.floor(((exec.finalizado_em ? new Date(exec.finalizado_em).getTime() : nowTick) - new Date(exec.iniciado_em).getTime()) / 1000))
    : 0;
  const erroVisivel = exec?.erro && !(isRunning && /^\s*\[reset_orfao\]\s*$/i.test(exec.erro)) ? exec.erro : null;
  const workersServidor = workers.filter((w) => w.worker_id.includes("djen_paralela_servidor") || w.current_tipo === "djen_paralela_servidor");
  const workersBase = workersServidor.length > 0 ? workersServidor : workers;
  const workersOnline = workersBase.filter((w) => Date.now() - new Date(w.heartbeat_at).getTime() < 90_000);
  const currentWorker = workers.find((w) => w.current_execucao_id === exec?.id) || workersServidor.find((w) => w.status === "busy");

  const handleHorariosChange = useCallback(async (proximos: string[]) => {
    if (!cfg) return;
    await updateConfig.mutateAsync({ id: cfg.id, patch: { horarios_execucao: proximos } });
  }, [cfg, updateConfig]);

  const handleDiasSemanaChange = useCallback(async (dias: number[]) => {
    if (!cfg) return;
    const meta = { ...(cfg.metadata as any || {}), dias_semana: dias };
    await updateConfig.mutateAsync({ id: cfg.id, patch: { metadata: meta } });
  }, [cfg, updateConfig]);

  const handleToggleAgenda = useCallback(async (checked: boolean) => {
    if (!cfg) return;
    await toggle.mutateAsync({ id: cfg.id, ativo: checked });
  }, [cfg, toggle]);

  const handleExecutar = useCallback(() => {
    if (!dataInicio || !dataFim) {
      toast.error("Selecione data de início e fim");
      return;
    }
    const payload: Record<string, unknown> = {
      dataInicio: ymd(dataInicio),
      dataFim: ymd(dataFim),
      resetCheckpoint: true,
    };
    if (filtroCoordenacaoId) payload.coordenacaoId = filtroCoordenacaoId;
    if (filtroMonitoramentoId) {
      payload.monitoramentoIds = [filtroMonitoramentoId];
    } else if (filtroTipo && monitoramentosFiltrados.length > 0) {
      payload.monitoramentoIds = monitoramentosFiltrados.map((m) => m.id);
    }
    enfileirar.mutate({ tipo: "djen_paralela_servidor", payload });
  }, [dataInicio, dataFim, enfileirar, filtroCoordenacaoId, filtroMonitoramentoId, filtroTipo, monitoramentosFiltrados]);

  const handleRetomar = useCallback(() => {
    const payloadAnterior = (exec?.payload || {}) as Record<string, unknown>;
    const dataInicioRetomada = typeof payloadAnterior.dataInicio === "string"
      ? payloadAnterior.dataInicio
      : ymd(dataInicio);
    const dataFimRetomada = typeof payloadAnterior.dataFim === "string"
      ? payloadAnterior.dataFim
      : ymd(dataFim) || dataInicioRetomada;

    if (!dataInicioRetomada || !dataFimRetomada) {
      toast.error("Não foi possível identificar o período da execução anterior");
      return;
    }
    const payload: Record<string, unknown> = {
      ...payloadAnterior,
      dataInicio: dataInicioRetomada,
      dataFim: dataFimRetomada,
      retomar: true,
      resetCheckpoint: false,
    };
    enfileirar.mutate({ tipo: "djen_paralela_servidor", payload });
  }, [dataInicio, dataFim, enfileirar, exec?.payload]);

  const handleForcarParada = useCallback(() => {
    if (exec?.id && isRunning) cancelar.mutate(exec.id);
    else toast.info("Não há execução ativa para parar");
  }, [cancelar, exec?.id, isRunning]);

  const handleLimparFiltro = useCallback(async () => {
    setFiltroCoordenacaoId("");
    setFiltroMonitoramentoId("");
    setFiltroTipo("");
    await queryClient.invalidateQueries({ queryKey: ["djen-servidor"] });
    toast.success("Filtro limpo");
  }, [queryClient]);

  const handleResetTotal = useCallback(async () => {
    if (!confirm("Reset Total: cancela a execução ativa e limpa o checkpoint. A próxima execução começará do zero. Continuar?")) return;
    if (exec?.id && isRunning) await cancelar.mutateAsync(exec.id);
    await queryClient.invalidateQueries({ queryKey: ["djen-servidor"] });
    toast.success("Reset feito. Clique em 'Executar agora' para uma nova rodada limpa.");
  }, [cancelar, exec?.id, isRunning, queryClient]);

  if (!cfg) {
    return <p className="text-sm text-muted-foreground">Configuração ainda não criada para DJEN Termos.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle>DJEN Termos</CardTitle>
            <Badge variant="outline" className="text-xs">
              {workersBase.length || 0} worker{workersBase.length === 1 ? "" : "s"} VPS
            </Badge>
            <Badge className="bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 text-xs gap-1">
              <Server className="h-3 w-3" /> Pool VPS ativo · {workersOnline.length}/{workersBase.length || 0}
            </Badge>
          </div>
          <div className={cn("px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2", statusConfig.bg, statusConfig.color)}>
            {execStatus === "executando" && <Loader2 className="h-4 w-4 animate-spin" />}
            {execStatus === "concluido" && <CheckCircle2 className="h-4 w-4" />}
            {execStatus === "cancelado" && <StopCircle className="h-4 w-4" />}
            {execStatus === "erro" && <XCircle className="h-4 w-4" />}
            {(execStatus === "idle" || execStatus === "pendente") && <Clock className="h-4 w-4" />}
            {statusConfig.label}
          </div>
          {isRunning && heartbeatSec != null && (
            <div className={cn("flex items-center gap-1 text-xs font-medium", heartbeatColor)}>
              {heartbeatDead ? <AlertTriangle className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
              <span>
                Heartbeat: há {heartbeatSec}s
                {heartbeatDead ? " — worker travado" : heartbeatStale ? " — lento" : ""}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              Agendamento automático
            </div>
            <Badge variant={cfg.ativo ? "default" : "secondary"}>{cfg.ativo ? "Ativo" : "Inativo"}</Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
            <label htmlFor="djen-servidor-scheduler-toggle" className="text-sm font-medium">Ativar agendamento</label>
            <Switch id="djen-servidor-scheduler-toggle" checked={cfg.ativo} onCheckedChange={handleToggleAgenda} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Horários BRT (até 3 por dia)</label>
            <HorariosDoDiaPicker
              value={(cfg.horarios_execucao || []) as string[]}
              onChange={handleHorariosChange}
              disabled={!cfg.ativo}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Dias da semana</label>
            <DiasSemanaPicker
              value={diasSemana}
              onChange={handleDiasSemanaChange}
              disabled={!cfg.ativo}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Coordenação</label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
              value={filtroCoordenacaoId}
              onChange={(e) => setFiltroCoordenacaoId(e.target.value)}
              disabled={isRunning}
            >
              <option value="">Todos</option>
              {coordenacoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          {coordenacaoFiltroEfetivo && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                disabled={isRunning}
              >
                <option value="">Todos</option>
                <option value="advogado">Advogado</option>
                <option value="palavra-chave">Palavra-chave</option>
                <option value="processo">Processo</option>
                <option value="parte">Parte</option>
                <option value="geral">Busca Geral</option>
              </select>
            </div>
          )}
          {coordenacaoFiltroEfetivo && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Termo</label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
                value={filtroMonitoramentoId}
                onChange={(e) => setFiltroMonitoramentoId(e.target.value)}
                disabled={isRunning}
              >
                <option value="">Todos</option>
                {monitoramentosFiltrados.map((m) => <option key={m.id} value={m.id}>{formatMonitoramentoLabel(m)}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data início</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal h-9" disabled={isRunning}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data fim</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal h-9" disabled={isRunning}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dataFim} onSelect={setDataFim} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExecutar} disabled={isRunning || enfileirar.isPending} className="gap-2">
            {enfileirar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Executar Servidor
          </Button>
          {(execStatus === "erro" || execStatus === "falhou" || execStatus === "cancelado") && (
            <Button onClick={handleRetomar} disabled={isRunning || enfileirar.isPending} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Retomar
            </Button>
          )}
          {isRunning && (
            <Button onClick={handleForcarParada} variant="destructive" className="gap-2" disabled={cancelar.isPending}>
              <StopCircle className="h-4 w-4" />
              Cancelar
            </Button>
          )}
          {isRunning && heartbeatStale && (
            <Button onClick={handleDestravar} variant="destructive" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Destravar (worker {heartbeatSec}s sem heartbeat)
            </Button>
          )}
          <Button onClick={handleForcarParada} variant="ghost" size="sm" className="gap-2 ml-auto">
            <Skull className="h-4 w-4" />
            Forçar Parada
          </Button>
          <Button onClick={handleLimparFiltro} disabled={isRunning} variant="outline" size="sm" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Limpar filtro
          </Button>
          <Button onClick={handleResetTotal} variant="destructive" size="sm" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Reset Total
          </Button>
        </div>

        {total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progresso global: {done}/{total} tribunais</span>
              <span className="text-muted-foreground">{percentage}% • {formatDuration(tempoDecorrido)}</span>
            </div>
            <Progress value={percentage} className="h-2" />
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
              <span>✅ Novas: <strong className="text-emerald-600">{novas}</strong></span>
              <span>♻️ Duplicadas: <strong>{duplicadas}</strong></span>
              <span>❌ Descartadas: <strong>{descartadas}</strong></span>
              {falhas > 0 && <span>⚠️ Falhas: <strong className="text-destructive">{falhas}</strong></span>}
            </div>
            {(() => {
              // Coleta VPS únicas efetivamente executando shards agora, a partir dos tracks
              const labels = new Set<string>();
              for (const t of tracks) {
                if (t.status !== "executando" || !t.via) continue;
                if (t.via.multiplas && Array.isArray(t.via.labels)) {
                  for (const l of t.via.labels) if (l) labels.add(String(l));
                } else if (t.via.label) {
                  labels.add(String(t.via.label));
                }
              }
              const arr = Array.from(labels);
              if (arr.length === 0) return null;
              return (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground">VPS em execução ({arr.length}):</span>
                  {arr.map((l) => (
                    <Badge key={l} variant="outline" className="text-[10px] gap-1 font-mono border-[hsl(var(--area-civil))]/40 text-[hsl(var(--area-civil))] bg-[hsl(var(--area-civil))]/10">
                      <Wifi className="h-3 w-3" /> {l}
                    </Badge>
                  ))}
                </div>
              );
            })()}
            {progress?.atual?.label && <p className="text-xs text-muted-foreground italic pt-1">Executando: {progress.atual.label}</p>}
            {erroVisivel && <p className="text-xs text-destructive italic pt-1">{erroVisivel}</p>}
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Server className="h-4 w-4 text-primary" />
              Roteamento da sessão
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{done} chamadas</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border bg-background p-2">
              <div className="text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> Direto (browser)</div>
              <div className="text-base font-bold tabular-nums">0</div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-muted-foreground flex items-center gap-1"><Server className="h-3 w-3" /> Via VPS</div>
              <div className="text-base font-bold tabular-nums text-primary">{done}</div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-muted-foreground">Rate-limits (429)</div>
              <div className="text-base font-bold tabular-nums">0</div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-muted-foreground">VPS online</div>
              <div className="text-base font-bold tabular-nums">{workersOnline.length}/{workersBase.length || 0}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {workersBase.map((worker) => (
              <Badge key={worker.id} variant="outline" className="text-[11px] gap-1 font-mono border-emerald-500/40 text-emerald-700 bg-emerald-500/5">
                <Wifi className="h-3 w-3" />
                {worker.worker_id.replace(/^hostinger-01-/, "")}
                <span className="opacity-70">· {worker.current_execucao_id === exec?.id ? "ativo" : worker.status}</span>
              </Badge>
            ))}
            {currentWorker && workersBase.length === 0 && (
              <Badge variant="outline" className="text-[11px] gap-1 font-mono border-primary/40 text-primary bg-primary/5">
                <Wifi className="h-3 w-3" /> {currentWorker.worker_id}
              </Badge>
            )}
          </div>
        </div>

        {tracks.length > 0 ? (
          <div className="h-[1800px] overflow-y-auto pr-1">
            <h4 className="text-sm font-semibold sticky top-0 bg-card py-1 z-10">Tribunais ({tracks.length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {tracks.map((track) => {
                const pct = statusPct(track);
                const hasAchados = (track.novas || 0) > 0 || (track.duplicatas || 0) > 0;
                const colorKey = track.status === "concluido" && hasAchados
                  ? "concluido_com_resultado"
                  : track.status;
                const colorClass = TRACK_COLORS[colorKey] || TRACK_COLORS.pendente;
                return (
                  <div key={track.id} className={cn("border rounded-md p-2 space-y-1", colorClass)}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-sm">{track.tribunal || track.label}</span>
                        {track.tipo && <Badge variant="outline" className="text-xs capitalize">{track.tipo}</Badge>}
                        <Badge variant="outline" className="text-xs capitalize">
                          {track.parcial && track.status === "concluido" ? "concluído parcial" : track.status}
                        </Badge>
                        {track.tribunal && <span className="text-[11px] truncate max-w-[40ch] opacity-80" title={track.label}>{track.label}</span>}
                        {track.status === "executando" && <Loader2 className="h-3 w-3 animate-spin" />}
                        {track.status === "executando" && track.via?.multiplas && Array.isArray(track.via?.labels) && track.via.labels.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {track.via.labels.map((l) => (
                              <Badge key={l} variant="outline" className="text-[10px] gap-1 font-mono border-primary/50 text-primary bg-primary/10">
                                <Server className="h-3 w-3" /> {l}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1 font-mono border-primary/50 text-primary bg-primary/10">
                            <Server className="h-3 w-3" /> {track.status === "executando" ? (track.via?.label || "VPS") : "VPS"}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs tabular-nums whitespace-nowrap">{track.current ?? (pct === 100 ? 1 : 0)}/{track.total ?? 1} • {pct}%</div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate flex-1 opacity-80">{track.mensagem || track.data || "Aguardando slot..."}</span>
                      <span className="whitespace-nowrap tabular-nums opacity-80">✅{track.novas || 0} ♻️{track.duplicatas || 0} ❌{track.descartadas || 0}</span>
                    </div>
                    {track.erro && (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p
                              className={cn(
                                "text-xs italic cursor-help underline decoration-dotted underline-offset-2",
                                track.parcial ? "text-destructive" : "text-amber-700",
                              )}
                            >
                              ⚠ {track.erro}
                              {track.parcial
                                ? ` · ${track.paresComFalha || 0} termo(s)/dia sem coleta`
                                : " (recuperado no retry)"}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[420px] whitespace-pre-line text-xs">
                            {detalheFalhas(track)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            Selecione o período e clique em <strong>Executar Servidor</strong> para iniciar.
            A execução roda na VPS e grava em <strong>publicacoes_djen_servidor</strong>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}