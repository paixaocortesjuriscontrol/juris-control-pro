/**
 * DJET Pautas Paralela Card
 *
 * Card UI dedicado à captura de PAUTAS DE JULGAMENTO da Justiça do
 * Trabalho via download dos PDFs do caderno Judiciário do DEJT.
 * 100% independente do card "DJEN Termos Paralela".
 */

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, FileText, PlayCircle, StopCircle,
  CheckCircle2, XCircle, Clock, CalendarIcon, RotateCcw, Skull,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDjetPautasParalela } from "@/hooks/useDjetPautasParalela";
import { useDjetPautasParalelaScheduler } from "@/hooks/useDjetPautasParalelaScheduler";

const TRACK_COLORS: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  executando: "bg-primary/15 text-primary border-primary/30",
  concluido: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  erro: "bg-destructive/15 text-destructive border-destructive/30",
  cancelado: "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function SchedulerPanel() {
const DIAS_SEMANA = [
  { idx: 0, label: "Dom", full: "Domingo" },
  { idx: 1, label: "Seg", full: "Segunda" },
  { idx: 2, label: "Ter", full: "Terça" },
  { idx: 3, label: "Qua", full: "Quarta" },
  { idx: 4, label: "Qui", full: "Quinta" },
  { idx: 5, label: "Sex", full: "Sexta" },
  { idx: 6, label: "Sáb", full: "Sábado" },
];

function SchedulerPanel() {
  const { ativo, horario, horariosPorDia, proximoHorario, start, stop, setHorarioDia } = useDjetPautasParalelaScheduler();
  const wdHoje = new Date().getDay();

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          Agendamento automático por dia da semana
        </div>
        <Badge variant={ativo ? "default" : "secondary"}>
          {ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
          <span className="text-muted-foreground">Hoje (BRT)</span>
          <span className="font-mono">{horario || "Desativado"}</span>
        </div>
        <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
          <span className="text-muted-foreground">Próxima execução</span>
          <span className="font-mono">{proximoHorario || "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
        {DIAS_SEMANA.map((d) => {
          const valor = horariosPorDia[d.idx] || "";
          const ativoDia = valor.trim() !== "";
          const isHoje = d.idx === wdHoje;
          return (
            <div
              key={d.idx}
              className={cn(
                "rounded-md border bg-background px-2 py-2 space-y-1.5",
                isHoje && "border-primary/50 ring-1 ring-primary/20"
              )}
            >
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold">
                  {d.label}{isHoje ? " (hoje)" : ""}
                </Label>
                <Switch
                  checked={ativoDia}
                  onCheckedChange={(v) => setHorarioDia(d.idx, v ? (valor || "07:30") : "")}
                />
              </div>
              <Input
                type="time"
                value={valor || ""}
                disabled={!ativoDia}
                onChange={(e) => setHorarioDia(d.idx, e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={ativo} onCheckedChange={(v) => (v ? start() : stop())} />
        <Label className="text-sm">{ativo ? "Desativar agendamento" : "Ativar agendamento"}</Label>
      </div>
    </div>
  );
}

export function MonitoramentoDjetPautasCard() {
  const { progress, isRunning, canResume, executar, retomar, cancelar, forceKill, resetTotal } = useDjetPautasParalela();
  const today = new Date();
  const [dataInicio, setDataInicio] = useState<Date>(today);
  const [dataFim, setDataFim] = useState<Date>(today);

  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  // Filtros: Coordenação e Termo
  const [filtroCoordenacaoId, setFiltroCoordenacaoId] = useState<string>("");
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState<string>("");
  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const coordenacaoFiltroEfetivo = filtroCoordenacaoId || null;

  const { data: monitoramentos = [] } = useQuery({
    queryKey: ["monitoramentos-djen-coord-djet-pautas", coordenacaoFiltroEfetivo],
    queryFn: async () => {
      if (!coordenacaoFiltroEfetivo) return [];
      const { data, error } = await supabase
        .from("monitoramentos_djen")
        .select("id, tipo, termo_busca, oab, uf, descricao, ativo, coordenacao_id")
        .eq("coordenacao_id", coordenacaoFiltroEfetivo)
        .eq("ativo", true)
        .order("descricao", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!coordenacaoFiltroEfetivo,
  });

  useEffect(() => {
    if (!filtroCoordenacaoId) setFiltroMonitoramentoId("");
  }, [filtroCoordenacaoId]);

  const filterParams = useMemo(() => ({
    coordenacaoId: filtroCoordenacaoId || undefined,
    monitoramentoIds: filtroMonitoramentoId
      ? [filtroMonitoramentoId]
      : (filtroCoordenacaoId && monitoramentos.length > 0
          ? monitoramentos.map((m) => m.id)
          : undefined),
  }), [filtroCoordenacaoId, filtroMonitoramentoId, monitoramentos]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          DJET Pautas Paralela (caderno Judiciário)
          <Badge variant="outline" className="ml-2 text-xs">DEJT • PDFs</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Baixa os PDFs do caderno Judiciário do DEJT por tribunal/dia, extrai blocos de
          pauta de julgamento e casa com os termos dos seus monitoramentos. Independente
          da DJEN Termos Paralela.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <SchedulerPanel />

        {/* Filtros: Coordenação e Termo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Coordenação</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
              value={filtroCoordenacaoId}
              onChange={(e) => setFiltroCoordenacaoId(e.target.value)}
              disabled={isRunning}
            >
              <option value="">Todas</option>
              {coordenacoes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          {coordenacaoFiltroEfetivo && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Termo</Label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
                value={filtroMonitoramentoId}
                onChange={(e) => setFiltroMonitoramentoId(e.target.value)}
                disabled={isRunning}
              >
                <option value="">Todos</option>
                {monitoramentos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.descricao || m.termo_busca || `${m.tipo || "Termo"} ${m.oab || ""} ${m.uf || ""}`.trim() || m.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {isRunning && (filtroCoordenacaoId || filtroMonitoramentoId) && (
          <div className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-xs text-primary font-medium">
            Executando: {coordenacoes.find((c) => c.id === filtroCoordenacaoId)?.nome ?? "Todas"}
            {filtroMonitoramentoId && (
              <> • {monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.descricao || monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.termo_busca || "Termo"}</>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Data início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataInicio, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={(d) => d && setDataInicio(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Data fim</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataFim, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={(d) => d && setDataFim(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => executar(ymd(dataInicio), ymd(dataFim), filterParams.coordenacaoId, filterParams.monitoramentoIds)}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Executar
          </Button>
          {canResume && (
            <Button variant="outline" onClick={() => retomar(filterParams.coordenacaoId, filterParams.monitoramentoIds)}>
              <RotateCcw className="mr-2 h-4 w-4" /> Retomar checkpoint
            </Button>
          )}
          <Button variant="outline" onClick={cancelar} disabled={!isRunning}>
            <StopCircle className="mr-2 h-4 w-4" /> Cancelar
          </Button>
          <Button variant="destructive" onClick={() => forceKill(false)}>
            <Skull className="mr-2 h-4 w-4" /> Force kill
          </Button>
          <Button variant="ghost" onClick={resetTotal}>Reset total</Button>
        </div>

        {progress.status !== "idle" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{progress.status}</Badge>
                <span className="text-muted-foreground">{progress.mensagem}</span>
              </div>
              <span className="font-mono text-muted-foreground">
                {formatDuration(progress.tempoDecorrido)}
              </span>
            </div>
            <Progress value={progress.percentage} />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-muted-foreground">Novas</div>
                <div className="text-lg font-bold text-emerald-600">{progress.novas}</div>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-muted-foreground">Duplicadas</div>
                <div className="text-lg font-bold text-muted-foreground">{progress.duplicadas}</div>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-muted-foreground">Tribunais</div>
                <div className="text-lg font-bold">{progress.tribunaisConcluidos}/{progress.totalTribunais}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-auto">
              {progress.tracks.map((track) => {
                const pct = track.total > 0 ? Math.floor((track.current / track.total) * 100) : 0;
                const Icon = track.status === "concluido" ? CheckCircle2
                  : track.status === "erro" ? XCircle
                  : track.status === "executando" ? Loader2
                  : Clock;
                return (
                  <div
                    key={track.tribunal}
                    className={cn("rounded-md border px-3 py-2 space-y-1", TRACK_COLORS[track.status])}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <Icon className={cn("h-3.5 w-3.5", track.status === "executando" && "animate-spin")} />
                        {track.tribunal}
                      </div>
                      <span className="font-mono text-xs">{track.current}/{track.total}</span>
                    </div>
                    <Progress value={pct} className="h-1" />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{track.diaAtual || "—"}</span>
                      <span>+{track.novas} • {track.diasSemPdf} sem PDF</span>
                    </div>
                    {track.ultimoErro && (
                      <div className="text-[10px] text-destructive truncate" title={track.ultimoErro}>
                        {track.ultimoErro}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}