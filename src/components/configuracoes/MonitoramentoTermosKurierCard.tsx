import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { formatMonitoramentoLabel } from "@/utils/monitoramentoLabel";
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
import { HorariosDoDiaPicker } from "@/components/djen/HorariosDoDiaPicker";
import { DiasSemanaPicker, DIAS_SEMANA_DEFAULT } from "@/components/djen/DiasSemanaPicker";
import { Play, Square, RotateCcw, ShieldAlert, Save, Activity, Loader2, Search, CalendarIcon, Clock } from "lucide-react";
import { toast } from "sonner";

function formatDuracao(s: number) {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export function MonitoramentoTermosKurierCard() {
  const { progress, isRunning, canResume, executar, drenarBacklog, retomar, cancelar, forceKill, resetTotal } = useDjenTermosKurier();
  const {
    ativo,
    horarios,
    diasSemana,
    proximoHorario,
    baseUrl,
    start,
    stop,
    setHorarios,
    setDiasSemana,
    setBaseUrl,
  } = useDjenTermosKurierScheduler();
  const qc = useQueryClient();
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillDate, setBackfillDate] = useState<Date | undefined>(new Date());
  const [reprocessAllRunning, setReprocessAllRunning] = useState(false);
  const reprocessCancelRef = useRef(false);
  const [reprocessProgress, setReprocessProgress] = useState<{
    atual: number;
    total: number;
    credAtual: string;
    novas: number;
    duplicadas: number;
    descartadas: number;
  } | null>(null);
  const runBackfillDescartados = async () => {
    if (backfillRunning) return;
    setBackfillRunning(true);
    try {
      const dataYmd = backfillDate ? format(backfillDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      const { data: creds, error: credsErr } = await supabase
        .from("kurier_credenciais")
        .select("id, login")
        .eq("ativo", true);
      if (credsErr) throw credsErr;
      if (!creds?.length) { toast.warning("Nenhuma credencial Kurier ativa"); return; }
      toast.info(`Backfill iniciado para ${creds.length} credenciais (data ${dataYmd})…`);
      let totalNovas = 0;
      let totalDescartadas = 0;
      const erros: string[] = [];
      for (const c of creds) {
        try {
          const { data, error } = await supabase.functions.invoke("kurier-consultar-publicacoes", {
            body: {
              credencial_id: c.id,
              backfill_raw: true,
              backfill_motivo: "fora_janela_disp_antes",
              backfill_date: dataYmd,
            },
          });
          if (error) { erros.push(`${c.login}: ${error.message}`); continue; }
          totalNovas += Number((data as any)?.total_novas || 0);
          totalDescartadas += Number((data as any)?.total_descartadas || 0);
        } catch (e: any) {
          erros.push(`${c.login}: ${String(e?.message ?? e)}`);
        }
      }
      if (erros.length) toast.error(`Backfill com ${erros.length} erro(s). Ex.: ${erros[0]}`);
      toast.success(`Backfill concluído. Novas: ${totalNovas}, descartadas: ${totalDescartadas}.`);
      await qc.invalidateQueries({ queryKey: ["publicacoes-djen"] });
      await qc.invalidateQueries({ queryKey: ["publicacoes-unificadas"] });
    } finally {
      setBackfillRunning(false);
    }
  };
  // Reprocessa TODOS os raws do dia (independente de motivo_descarte).
  // Útil quando publicações de um dia foram apagadas por engano em
  // publicacoes_djen — os payloads brutos ficam preservados em
  // kurier_publicacoes_raw e podem ser recriados a partir daqui. Não
  // consome a fila da Kurier e não chama a API externa.
  const runReprocessAllRaw = async () => {
    if (reprocessAllRunning) return;
    const dataYmd = backfillDate ? format(backfillDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    const confirmar = window.confirm(
      `Reprocessar TODOS os payloads brutos do dia ${dataYmd}?\n\nIsso recria publicações em publicacoes_djen a partir de kurier_publicacoes_raw. As já existentes são ignoradas por dedup.`,
    );
    if (!confirmar) return;
    reprocessCancelRef.current = false;
    setReprocessAllRunning(true);
    setReprocessProgress({ atual: 0, total: 0, credAtual: "", novas: 0, duplicadas: 0, descartadas: 0 });
    try {
      const { data: creds, error: credsErr } = await supabase
        .from("kurier_credenciais")
        .select("id, login")
        .eq("ativo", true);
      if (credsErr) throw credsErr;
      if (!creds?.length) { toast.warning("Nenhuma credencial Kurier ativa"); return; }
      toast.info(`Reprocessando ${creds.length} credenciais para ${dataYmd}…`);
      let totalNovas = 0;
      let totalDuplicadas = 0;
      let totalDescartadas = 0;
      const erros: string[] = [];
      setReprocessProgress({ atual: 0, total: creds.length, credAtual: "", novas: 0, duplicadas: 0, descartadas: 0 });
      for (let i = 0; i < creds.length; i++) {
        if (reprocessCancelRef.current) {
          toast.warning(`Cancelado pelo usuário após ${i}/${creds.length} credenciais.`);
          break;
        }
        const c = creds[i];
        setReprocessProgress({ atual: i, total: creds.length, credAtual: c.login, novas: totalNovas, duplicadas: totalDuplicadas, descartadas: totalDescartadas });
        try {
          const { data, error } = await supabase.functions.invoke("kurier-consultar-publicacoes", {
            body: {
              credencial_id: c.id,
              backfill_raw: true,
              backfill_motivo: "todos",
              backfill_date: dataYmd,
            },
          });
          if (error) { erros.push(`${c.login}: ${error.message}`); continue; }
          totalNovas += Number((data as any)?.total_novas || 0);
          totalDuplicadas += Number((data as any)?.total_duplicadas || 0);
          totalDescartadas += Number((data as any)?.total_descartadas || 0);
        } catch (e: any) {
          erros.push(`${c.login}: ${String(e?.message ?? e)}`);
        }
        setReprocessProgress({ atual: i + 1, total: creds.length, credAtual: c.login, novas: totalNovas, duplicadas: totalDuplicadas, descartadas: totalDescartadas });
      }
      if (erros.length) toast.error(`Reprocessamento com ${erros.length} erro(s). Ex.: ${erros[0]}`);
      if (!reprocessCancelRef.current) {
        toast.success(`Reprocessamento concluído. Novas: ${totalNovas}, duplicadas: ${totalDuplicadas}, descartadas: ${totalDescartadas}.`);
      }
      await qc.invalidateQueries({ queryKey: ["publicacoes-djen"] });
      await qc.invalidateQueries({ queryKey: ["publicacoes-unificadas"] });
    } catch (e: any) {
      toast.error(`Falha: ${String(e?.message ?? e)}`);
    } finally {
      setReprocessAllRunning(false);
      reprocessCancelRef.current = false;
      setTimeout(() => setReprocessProgress(null), 8000);
    }
  };
  const [baseUrlDraft, setBaseUrlDraft] = useState<string | null>(null);
  const today = new Date();
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const ymd = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : undefined);

  // Filtros: Coordenação e Termo (mesmo padrão da Paralela)
  const [filtroCoordenacaoId, setFiltroCoordenacaoId] = useState<string>("");
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState<string>("");
  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const { data: monitoramentos = [] } = useQuery({
    queryKey: ["monitoramentos-djen-coord-kurier", filtroCoordenacaoId],
    queryFn: async () => {
      if (!filtroCoordenacaoId) return [] as any[];
      const { data, error } = await supabase
        .from("monitoramentos_djen")
        .select("id, termo_busca, descricao, tipo, oab, uf")
        .eq("coordenacao_id", filtroCoordenacaoId)
        .eq("ativo", true);
      if (error) throw error;
      const list = (data || []) as any[];
      return list.sort((a, b) =>
        formatMonitoramentoLabel(a).localeCompare(formatMonitoramentoLabel(b), "pt-BR", { sensitivity: "base" }),
      );
    },
    enabled: !!filtroCoordenacaoId,
  });
  useEffect(() => {
    if (!filtroCoordenacaoId) setFiltroMonitoramentoId("");
  }, [filtroCoordenacaoId]);

  const getFilters = () => ({
    coordenacaoId: filtroCoordenacaoId || undefined,
    monitoramentoIds: filtroMonitoramentoId
      ? [filtroMonitoramentoId]
      : (filtroCoordenacaoId && monitoramentos.length > 0
          ? monitoramentos.map((m: any) => m.id)
          : undefined),
  });

  const baseUrlValor = baseUrlDraft ?? baseUrl;

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
                Busca publicações Kurier por data de disponibilização/publicação na API REST KJuridico, igual à tela Kurier, sem depender da fila/backlog.
              </p>
            </div>
            <Badge variant={ativo ? "default" : "secondary"}>
              {ativo ? "Agendamento ativo" : "Agendamento inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" /> Agendamento automático
              </div>
              <Badge variant={ativo ? "default" : "secondary"}>{ativo ? "Ativo" : "Inativo"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <Label htmlFor="kurier-scheduler-toggle" className="text-sm font-medium">
                Ativar agendamento
              </Label>
              <Switch
                id="kurier-scheduler-toggle"
                checked={ativo}
                onCheckedChange={(checked) => {
                  if (checked) { start(); toast.success("Agendamento Kurier ativado"); }
                  else { stop(); toast.info("Agendamento Kurier desativado"); }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Horários BRT (até 3 por dia)</Label>
              <HorariosDoDiaPicker
                value={horarios}
                onChange={(next) => {
                  setHorarios(next);
                  toast.success(next.length > 0 ? `Horários: ${next.join(", ")}` : "Horários limpos");
                }}
                disabled={!ativo}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Dias da semana</Label>
              <DiasSemanaPicker
                value={diasSemana?.length ? diasSemana : DIAS_SEMANA_DEFAULT}
                onChange={(dias) => setDiasSemana(dias)}
                disabled={!ativo}
              />
            </div>
            {ativo && proximoHorario && (
              <div className="flex items-center gap-2 rounded-md bg-background p-2 border">
                <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Próxima execução</p>
                  <p className="text-sm font-medium">{proximoHorario}</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
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
                  onClick={() => { setBaseUrl(baseUrlValor.trim()); setBaseUrlDraft(null); }}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Filtros: Coordenação e Termo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Coordenação</Label>
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
            {filtroCoordenacaoId && (
              <div className="space-y-1">
                <Label className="text-xs">Termo</Label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
                  value={filtroMonitoramentoId}
                  onChange={(e) => setFiltroMonitoramentoId(e.target.value)}
                  disabled={isRunning}
                >
                  <option value="">Todos</option>
                  {monitoramentos.map((m: any) => (
                    <option key={m.id} value={m.id}>{formatMonitoramentoLabel(m)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

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
            <Button
              onClick={() => {
                const f = getFilters();
                executar(ymd(dataInicio), ymd(dataFim), f.coordenacaoId, f.monitoramentoIds, false);
              }}
              disabled={isRunning}
              className="bg-primary"
            >
              <Play className="h-4 w-4 mr-1" />
              Executar Kurier (fila + confirma)
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const f = getFilters();
                drenarBacklog(f.coordenacaoId, f.monitoramentoIds);
              }}
              disabled={isRunning}
            >
              <Search className="h-4 w-4 mr-1" />
              Drenar backlog
            </Button>
            {canResume && !isRunning && (
              <Button
                variant="secondary"
                onClick={() => {
                  const f = getFilters();
                  retomar(ymd(dataInicio), ymd(dataFim), f.coordenacaoId, f.monitoramentoIds, false);
                }}
              >
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
            <Separator orientation="vertical" className="h-6" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {backfillDate ? format(backfillDate, "dd/MM/yyyy") : "Data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={backfillDate} onSelect={setBackfillDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Button
              variant="secondary"
              onClick={() => void runBackfillDescartados()}
              disabled={backfillRunning}
              title="Reprocessa publicações Kurier que foram descartadas localmente por fora_janela_disp_antes"
            >
              {backfillRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Recuperar descartados (fora janela)
            </Button>
            <Button
              variant="secondary"
              onClick={() => void runReprocessAllRaw()}
              disabled={reprocessAllRunning}
              title="Reprocessa TODOS os payloads brutos deste dia (kurier_publicacoes_raw). Use quando as publicações do dia foram apagadas por engano."
            >
              {reprocessAllRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Reprocessar dia (todos brutos)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Consulta o endpoint personalizado da Kurier para o período escolhido, registra o total recebido e envia os matches para a tela Análise DJEN com origem
            <span className="font-mono"> kurier</span>. Duplicadas são marcadas automaticamente.
          </p>

          {reprocessProgress && (
            <div className="space-y-2 rounded-md border p-3 bg-muted/30">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {reprocessAllRunning && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span className="font-medium">
                    Reprocessando brutos {reprocessProgress.atual}/{reprocessProgress.total || "…"}
                  </span>
                  {reprocessProgress.credAtual && (
                    <span className="text-muted-foreground">· {reprocessProgress.credAtual}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {!reprocessAllRunning && "concluído"}
                </div>
                {reprocessAllRunning && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      reprocessCancelRef.current = true;
                      toast.info("Cancelando após a credencial atual…");
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
              <Progress value={reprocessProgress.total ? (reprocessProgress.atual / reprocessProgress.total) * 100 : 0} />
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{reprocessProgress.novas}</strong> novas</span>
                <span><strong className="text-foreground">{reprocessProgress.duplicadas}</strong> duplicadas</span>
                <span><strong className="text-foreground">{reprocessProgress.descartadas}</strong> descartadas</span>
              </div>
            </div>
          )}

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
                  <span><strong className="text-foreground">{progress.recebidas ?? 0}</strong> recebidas</span>
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