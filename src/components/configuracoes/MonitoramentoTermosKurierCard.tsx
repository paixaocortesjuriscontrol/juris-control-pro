import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDjenTermosKurier } from "@/hooks/useDjenTermosKurier";
import { useDjenTermosKurierScheduler } from "@/hooks/useDjenTermosKurierScheduler";
import { KurierCredenciaisPanel } from "./KurierCredenciaisPanel";
import { Play, Square, RotateCcw, ShieldAlert, Save, Activity, Loader2, Search, CalendarIcon } from "lucide-react";

function formatDuracao(s: number) {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export function MonitoramentoTermosKurierCard() {
  const { progress, isRunning, canResume, executar, retomar, cancelar, forceKill, resetTotal } = useDjenTermosKurier();
  const { config, saveConfig } = useDjenTermosKurierScheduler();
  const [baseUrlDraft, setBaseUrlDraft] = useState<string | null>(null);
  const [freqDraft, setFreqDraft] = useState<string | null>(null);
  const today = new Date();
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const ymd = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : undefined);

  const baseUrlValor = baseUrlDraft ?? config.baseUrl;
  const freqValor = freqDraft ?? String(config.frequenciaMin);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" /> Monitoramento Kurier
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Consome a fila de publicações Kurier via API REST KJuridico. Cada login ativo é processado em paralelo (até 3 simultâneos), em lotes de 50, e confirmado automaticamente.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="kurier-ativo" className="text-sm">Auto-execução</Label>
              <Switch
                id="kurier-ativo"
                checked={config.ativo}
                onCheckedChange={(v) => saveConfig({ ativo: v })}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Frequência (min)</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  min={5}
                  value={freqValor}
                  onChange={(e) => setFreqDraft(e.target.value)}
                  className="h-9"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={freqDraft === null || Number(freqValor) < 5}
                  onClick={async () => { await saveConfig({ frequenciaMin: Number(freqValor) }); setFreqDraft(null); }}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Base URL da API Kurier</Label>
              <div className="flex gap-1">
                <Input
                  value={baseUrlValor}
                  onChange={(e) => setBaseUrlDraft(e.target.value)}
                  placeholder="https://www.kurierservicos.com.br/wsservicos"
                  className="h-9 font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={baseUrlDraft === null || !baseUrlValor.startsWith("http")}
                  onClick={async () => { await saveConfig({ baseUrl: baseUrlValor.trim() }); setBaseUrlDraft(null); }}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Início (opcional)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy") : "Fim (opcional)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFim} onSelect={setDataFim} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => executar(ymd(dataInicio), ymd(dataFim))} disabled={isRunning} className="bg-primary">
              <Search className="h-4 w-4 mr-1" />
              Buscar Kurier com termos DJEN → Análise DJEN
            </Button>
            {canResume && !isRunning && (
              <Button variant="secondary" onClick={() => retomar(ymd(dataInicio), ymd(dataFim))}>
                <RotateCcw className="h-4 w-4 mr-1" /> Retomar
              </Button>
            )}
            <Button variant="outline" disabled={!isRunning} onClick={() => void cancelar()}>
              <Square className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void forceKill(true)}>
              <ShieldAlert className="h-4 w-4 mr-1" /> Force Kill + limpar
            </Button>
            <Button variant="ghost" onClick={() => void resetTotal()}>
              Reset total
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Consome todas as publicações pendentes na fila Kurier (todas as credenciais ativas), aplica os termos
            de todos os monitoramentos DJEN ativos, e envia os matches para a tela Análise DJEN com origem
            <span className="font-mono"> kurier</span>. Duplicadas são marcadas automaticamente.
          </p>

          {progress.status !== "idle" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={
                    progress.status === "concluido" ? "default" :
                    progress.status === "erro" || progress.status === "cancelado" ? "destructive" :
                    "secondary"
                  }>{progress.status}</Badge>
                  <span className="text-muted-foreground">{progress.mensagem}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDuracao(progress.tempoDecorrido)} · {progress.credenciaisConcluidas}/{progress.totalCredenciais}
                </div>
              </div>
              <Progress value={progress.percentage} />
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{progress.novas}</strong> novas</span>
                <span><strong className="text-foreground">{progress.duplicadas}</strong> dup</span>
                <span><strong className="text-foreground">{progress.confirmadas}</strong> confirmadas</span>
                <span><strong className="text-foreground">{progress.descartadas}</strong> descartadas</span>
              </div>

              <div className="border rounded-md divide-y max-h-72 overflow-auto">
                {progress.tracks.map((t) => (
                  <div key={t.credencialId} className="flex items-center justify-between gap-2 p-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {t.status === "executando" && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                      <span className="font-mono shrink-0">{t.login}</span>
                      <span className="text-muted-foreground truncate">{t.mensagem}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="h-5">+{t.novas}</Badge>
                      <Badge variant="secondary" className="h-5">dup {t.duplicadas}</Badge>
                      <Badge variant={
                        t.status === "concluido" ? "default" :
                        t.status === "erro" ? "destructive" :
                        t.status === "executando" ? "secondary" : "outline"
                      } className="h-5">{t.status}</Badge>
                    </div>
                  </div>
                ))}
                {progress.tracks.length === 0 && (
                  <div className="p-3 text-center text-muted-foreground">Sem credenciais ativas com senha cadastrada.</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <KurierCredenciaisPanel />
    </div>
  );
}