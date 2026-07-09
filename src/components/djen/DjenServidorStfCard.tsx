import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Loader2, PlayCircle, StopCircle, Clock, CheckCircle2, XCircle, Server, CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  useCancelarExecucaoServidor,
  useConfiguracoesServidor,
  useEnfileirarManual,
  useExecucaoServidorAoVivo,
  type ProgressoItem,
} from "@/hooks/useDjenServidor";
import { HorariosDoDiaPicker } from "@/components/djen/HorariosDoDiaPicker";
import { DiasSemanaPicker, DIAS_SEMANA_DEFAULT } from "@/components/djen/DiasSemanaPicker";

const TIPO = "djen_stf_servidor";

const STATUS_LABEL: Record<string, { label: string; cls: string; icon: JSX.Element }> = {
  pendente: { label: "Aguardando", cls: "text-amber-700 bg-amber-500/10", icon: <Clock className="h-4 w-4" /> },
  executando: { label: "Executando", cls: "text-blue-700 bg-blue-500/10", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  concluido: { label: "Concluído", cls: "text-muted-foreground bg-muted/50", icon: <CheckCircle2 className="h-4 w-4" /> },
  cancelado: { label: "Cancelado", cls: "text-amber-700 bg-amber-500/10", icon: <StopCircle className="h-4 w-4" /> },
  erro: { label: "Erro", cls: "text-destructive bg-destructive/10", icon: <XCircle className="h-4 w-4" /> },
  idle: { label: "Aguardando", cls: "text-muted-foreground bg-muted/50", icon: <Clock className="h-4 w-4" /> },
};

const TRACK_COLORS: Record<string, string> = {
  pendente: "bg-muted/50 text-muted-foreground border-border",
  executando: "bg-[hsl(var(--area-civil))]/15 text-[hsl(var(--area-civil))] border-[hsl(var(--area-civil))]/30",
  concluido: "bg-muted/60 text-muted-foreground border-border",
  concluido_com_resultado: "bg-[hsl(var(--status-active))]/15 text-[hsl(var(--status-active))] border-[hsl(var(--status-active))]/30",
  erro: "bg-destructive/15 text-destructive border-destructive/30",
  cancelado: "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

function statusPct(item: ProgressoItem): number {
  if (typeof item.current === "number" && typeof item.total === "number" && item.total > 0) {
    return Math.min(100, Math.round((item.current / item.total) * 100));
  }
  if (item.status === "concluido") return 100;
  if (item.status === "erro" || item.status === "cancelado") return 100;
  if (item.status === "executando") return 50;
  return 0;
}

export function DjenServidorStfCard() {
  const { data: configs = [], toggle, updateConfig } = useConfiguracoesServidor();
  const cfg = configs.find((c) => c.tipo === TIPO);
  const live = useExecucaoServidorAoVivo(TIPO);
  const enfileirar = useEnfileirarManual();
  const cancelar = useCancelarExecucaoServidor();

  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  useEffect(() => {
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    setDataInicio((v) => v || hoje);
    setDataFim((v) => v || hoje);
  }, []);

  const { data: contagemAtivos } = useQuery({
    queryKey: ["stf-servidor", "monitoramentos-ativos"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("monitoramentos_djen")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .eq("arquivado", false)
        .eq("busca_stf_ativa", true);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30_000,
  });

  const diasSemana = ((cfg?.metadata as any)?.dias_semana as number[] | undefined) || DIAS_SEMANA_DEFAULT;

  const handleToggleAgenda = useCallback(async (checked: boolean) => {
    if (!cfg) return;
    await toggle.mutateAsync({ id: cfg.id, ativo: checked });
  }, [cfg, toggle]);

  const handleHorariosChange = useCallback(async (proximos: string[]) => {
    if (!cfg) return;
    await updateConfig.mutateAsync({ id: cfg.id, patch: { horarios_execucao: proximos } });
  }, [cfg, updateConfig]);

  const handleDiasSemanaChange = useCallback(async (dias: number[]) => {
    if (!cfg) return;
    const meta = { ...(cfg.metadata as any || {}), dias_semana: dias };
    await updateConfig.mutateAsync({ id: cfg.id, patch: { metadata: meta } });
  }, [cfg, updateConfig]);

  const handleExecutar = useCallback(() => {
    if (!dataInicio || !dataFim) {
      toast.error("Selecione data de início e fim");
      return;
    }
    enfileirar.mutate({
      tipo: TIPO,
      payload: {
        dataInicio: format(dataInicio, "yyyy-MM-dd"),
        dataFim: format(dataFim, "yyyy-MM-dd"),
      },
    });
  }, [enfileirar, dataInicio, dataFim]);

  const exec = live.data;
  const execStatus = exec?.status || "idle";
  const isRunning = execStatus === "pendente" || execStatus === "executando";
  const statusCfg = STATUS_LABEL[execStatus] || STATUS_LABEL.idle;
  const progress = exec?.progresso as any;
  const tracks = ((progress?.itens || []) as ProgressoItem[]).map((t) =>
    execStatus === "cancelado" && (t.status === "executando" || t.status === "pendente")
      ? { ...t, status: "cancelado" as const, mensagem: "Cancelado pelo usuário" }
      : t
  );
  const total = progress?.totalItens ?? tracks.length;
  const done = progress?.concluidos ?? tracks.filter((t) => ["concluido", "erro", "cancelado"].includes(t.status)).length;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const novas = Number(progress?.novas ?? exec?.resultado?.novas ?? 0);
  const descartadas = Number(progress?.descartadas ?? exec?.resultado?.descartadas ?? 0);
  const duplicatas = Number(progress?.duplicatas ?? exec?.resultado?.duplicatas ?? 0);

  const handleParar = useCallback(() => {
    if (exec?.id && isRunning) cancelar.mutate(exec.id);
    else toast.info("Não há execução ativa para parar");
  }, [cancelar, exec?.id, isRunning]);

  if (!cfg) {
    return <p className="text-sm text-muted-foreground">Configuração STF Servidor ainda não criada.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            <CardTitle>STF Servidor</CardTitle>
            <Badge variant="outline" className="text-xs">
              {contagemAtivos ?? 0} monitoramento{contagemAtivos === 1 ? "" : "s"} com STF ativo
            </Badge>
          </div>
          <div className={cn("px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2", statusCfg.cls)}>
            {statusCfg.icon}
            {statusCfg.label}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          O STF <strong>não</strong> publica no DJEN / PJe Comunica. Este motor consulta o portal
          <strong> DJE-STF (digital.stf.jus.br)</strong> nas 13 VPS, usando as mesmas regras (data do dia BRT,
          validação estrita, exclusões, condição concomitante) do DJEN Termos Servidor. Só rodam os monitoramentos
          com a opção <em>"Também buscar no STF"</em> ligada.
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              Agendamento automático
            </div>
            <Badge variant={cfg.ativo ? "default" : "secondary"}>{cfg.ativo ? "Ativo" : "Inativo"}</Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
            <label htmlFor="stf-servidor-scheduler-toggle" className="text-sm font-medium">Ativar agendamento</label>
            <Switch id="stf-servidor-scheduler-toggle" checked={cfg.ativo} onCheckedChange={handleToggleAgenda} />
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

        {(isRunning || progress) && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{done}/{total} monitoramentos</span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded bg-emerald-500/10 text-emerald-700 px-2 py-1 text-center">Novas: <strong>{novas}</strong></div>
              <div className="rounded bg-amber-500/10 text-amber-700 px-2 py-1 text-center">Descartadas: <strong>{descartadas}</strong></div>
              <div className="rounded bg-muted px-2 py-1 text-center">Duplicatas: <strong>{duplicatas}</strong></div>
            </div>
          </div>
        )}

        {tracks.length > 0 && (
          <div className="max-h-[1200px] overflow-y-auto pr-1">
            <h4 className="text-sm font-semibold sticky top-0 bg-card py-1 z-10">Monitoramentos ({tracks.length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {tracks.map((track) => {
                const p = statusPct(track);
                const hasAchados = (track.novas || 0) > 0 || (track.duplicatas || 0) > 0;
                const key = track.status === "concluido" && hasAchados ? "concluido_com_resultado" : track.status;
                const cls = TRACK_COLORS[key] || TRACK_COLORS.pendente;
                return (
                  <div key={track.id} className={cn("border rounded-md p-2 space-y-1", cls)}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-xs">STF</span>
                        {track.tipo && <Badge variant="outline" className="text-xs capitalize">{track.tipo}</Badge>}
                        <Badge variant="outline" className="text-xs capitalize">{track.status}</Badge>
                        <span className="text-[11px] truncate max-w-[38ch] opacity-80" title={track.label}>{track.label}</span>
                        {track.status === "executando" && <Loader2 className="h-3 w-3 animate-spin" />}
                        <Badge variant="outline" className="text-[10px] gap-1 font-mono border-primary/50 text-primary bg-primary/10">
                          <Server className="h-3 w-3" /> VPS
                        </Badge>
                      </div>
                      <div className="text-xs tabular-nums whitespace-nowrap">{track.current ?? (p === 100 ? 1 : 0)}/{track.total ?? 1} • {p}%</div>
                    </div>
                    <Progress value={p} className="h-1.5" />
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate flex-1 opacity-80">{track.mensagem || "—"}</span>
                      <span className="whitespace-nowrap tabular-nums opacity-80">✅{track.novas || 0} ♻️{track.duplicatas || 0} ❌{track.descartadas || 0}</span>
                    </div>
                    {track.erro && <p className="text-xs text-destructive italic">⚠ {track.erro}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
          <Button onClick={handleExecutar} disabled={isRunning || enfileirar.isPending} size="sm">
            <PlayCircle className="h-4 w-4 mr-1" />
            Executar agora
          </Button>
          {isRunning && (
            <Button onClick={handleParar} variant="outline" size="sm">
              <StopCircle className="h-4 w-4 mr-1" />
              Parar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}