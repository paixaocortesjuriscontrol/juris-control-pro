/**
 * DJET Pautas Paralela Card
 *
 * Card UI dedicado à captura de PAUTAS DE JULGAMENTO da Justiça do
 * Trabalho via download dos PDFs do caderno Judiciário do DEJT.
 * 100% independente do card "DJEN Termos Paralela".
 */

import { useState } from "react";
import { format } from "date-fns";
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
  const { ativo, horario, proximoHorario, start, stop, setTime } = useDjetPautasParalelaScheduler();
  const [editing, setEditing] = useState(false);
  const [tempTime, setTempTime] = useState(horario);

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          Agendamento automático
        </div>
        <Badge variant={ativo ? "default" : "secondary"}>
          {ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
          <span className="text-xs text-muted-foreground">Horário diário (BRT)</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                type="time"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                className="h-7 w-24 text-xs"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const [h, m] = tempTime.split(":").map(Number);
                  if (!isNaN(h) && !isNaN(m)) setTime(h, m);
                  setEditing(false);
                }}
              >Salvar</Button>
            </div>
          ) : (
            <button
              type="button"
              className="text-sm font-mono hover:underline"
              onClick={() => { setTempTime(horario); setEditing(true); }}
            >{horario}</button>
          )}
        </div>
        <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
          <span className="text-xs text-muted-foreground">Próxima execução</span>
          <span className="text-sm font-mono">{proximoHorario || "—"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={ativo} onCheckedChange={(v) => (v ? start() : stop())} />
        <Label className="text-sm">{ativo ? "Desativar agendamento" : "Ativar agendamento diário"}</Label>
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
          <Button onClick={() => executar(ymd(dataInicio), ymd(dataFim))} disabled={isRunning}>
            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Executar
          </Button>
          {canResume && (
            <Button variant="outline" onClick={() => retomar()}>
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