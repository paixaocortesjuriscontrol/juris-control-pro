import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarIcon, PlayCircle, Loader2, CheckCircle2, XCircle, Clock, Info, RefreshCw, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AcompanhamentoEspecialDivergencias } from "./AcompanhamentoEspecialDivergencias";

type Execucao = {
  id: string;
  slot: number | null;
  disparo: string;
  status: string;
  iniciado_em: string;
  finalizado_em: string | null;
  duracao_ms: number | null;
  total_processos: number;
  total_novos_eventos: number;
  total_erros: number;
  erro: string | null;
  detalhes?: any;
};

const HORARIOS = [
  { slot: 10, hora: "10:00 BRT", freq: "freq ≥ 1 (todo processo em acompanhamento)", cron: "0 13 * * * UTC" },
  { slot: 14, hora: "14:00 BRT", freq: "freq ≥ 3 (só processos com 3 checagens/dia)", cron: "0 17 * * * UTC" },
  { slot: 18, hora: "18:00 BRT", freq: "freq ≥ 2 (processos com 2+ checagens/dia)", cron: "0 21 * * * UTC" },
];

const STATUS_BADGE: Record<string, { label: string; className: string; Icon: any }> = {
  executando: { label: "Executando", className: "bg-blue-500/15 text-blue-700 border-blue-500/30", Icon: Loader2 },
  concluido: { label: "Concluído", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", Icon: CheckCircle2 },
  erro: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle },
};

function formatDuracao(ms: number | null) {
  if (!ms || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

export function AcompanhamentoEspecialPanel() {
  const qc = useQueryClient();
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState<Date>(new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000));
  const [dataFim, setDataFim] = useState<Date>(hoje);
  const [slotFiltro, setSlotFiltro] = useState<string>("todos");
  const [executando, setExecutando] = useState<number | null>(null);
  const [detalheExec, setDetalheExec] = useState<Execucao | null>(null);

  const { data: execucoes, isLoading, refetch } = useQuery({
    queryKey: ["execucoes-acompanhamento-especial", dataInicio.toISOString().slice(0, 10), dataFim.toISOString().slice(0, 10), slotFiltro],
    queryFn: async () => {
      const inicio = new Date(dataInicio);
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      let q = supabase
        .from("execucoes_acompanhamento_especial")
        .select("id, slot, disparo, status, iniciado_em, finalizado_em, duracao_ms, total_processos, total_novos_eventos, total_erros, erro, detalhes")
        .gte("iniciado_em", inicio.toISOString())
        .lte("iniciado_em", fim.toISOString())
        .order("iniciado_em", { ascending: false })
        .limit(300);
      if (slotFiltro !== "todos") q = q.eq("slot", Number(slotFiltro));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Execucao[];
    },
  });

  const stats = useMemo(() => {
    const list = execucoes ?? [];
    return {
      total: list.length,
      concluidas: list.filter((e) => e.status === "concluido").length,
      erros: list.filter((e) => e.status === "erro").length,
      novosEventos: list.reduce((a, e) => a + (e.total_novos_eventos ?? 0), 0),
    };
  }, [execucoes]);

  const executarManual = async (slot: number) => {
    setExecutando(slot);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("judit-acompanhamento-especial", {
        body: { slot, manual: true, invocado_por: userData.user?.id ?? null },
      });
      if (error) throw error;
      const resultados: any[] = data?.resultados ?? [];
      const novos = resultados.reduce(
        (a, r) => a + (typeof r?.novos === "number" ? r.novos : 0),
        0
      );
      const consultados = resultados.filter((r) => typeof r?.novos === "number").length;
      const skipped = resultados.filter((r) => r?.skipped).length;
      const erros = resultados.filter((r) => r?.erro).length;
      toast.success(`Slot ${slot}h executado`, {
        description: `${consultados} consultado(s) na Judit · ${novos} novo(s) evento(s) · ${skipped} pulado(s) · ${erros} erro(s)`,
      });
      await qc.invalidateQueries({ queryKey: ["execucoes-acompanhamento-especial"] });
    } catch (e: any) {
      toast.error("Falha ao executar", { description: e?.message ?? String(e) });
    } finally {
      setExecutando(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Card explicativo */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-full bg-blue-500/10 p-2">
              <Server className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Acompanhamento Especial
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> 100% Server-Side
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Rotina que consulta a API Judit para os processos marcados com <strong>“Acompanhamento Especial”</strong>,
                registra novas movimentações em <code className="text-xs bg-muted px-1 rounded">acompanhamento_especial_eventos</code>
                {" "}e notifica os responsáveis por sino, e-mail e WhatsApp. A cada consulta os dados da Judit são
                gravados no processo como se o botão Judit tivesse sido clicado: as abas <strong>Partes</strong>,
                <strong> Andamentos</strong> e <strong>Análise Judit</strong> são sempre atualizadas e, na Visão Geral,
                apenas os campos vazios são completados — nada digitado pelo advogado é sobrescrito.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/40 border p-3 text-sm">
            <div className="flex items-center gap-2 font-medium mb-1">
              <Info className="h-4 w-4 text-blue-600" />
              Como executa
            </div>
            <p className="text-muted-foreground">
              É uma <strong>Supabase Edge Function</strong> agendada pelo <strong>pg_cron</strong> nos horários abaixo.
              Não roda na VPS e <strong>não depende de nenhum browser aberto</strong> — a Judit é consultada por HTTP direto,
              tudo dentro do runtime do Supabase.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {HORARIOS.map((h) => (
              <div key={h.slot} className="rounded-lg border p-3 space-y-2 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold">{h.hora}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">slot {h.slot}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{h.freq}</p>
                <p className="text-[10px] font-mono text-muted-foreground/70">{h.cron}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={executando !== null}
                  onClick={() => executarManual(h.slot)}
                >
                  {executando === h.slot ? (
                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Executando…</>
                  ) : (
                    <><PlayCircle className="mr-2 h-3 w-3" /> Executar agora</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Divergências detectadas entre Judit e o formulário */}
      <AcompanhamentoEspecialDivergencias />

      {/* Execuções + filtros */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Execuções</CardTitle>
              <CardDescription>Histórico das rotinas automáticas e manuais</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-3 w-3" /> Atualizar
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-3 pt-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">De</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[160px] justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataInicio, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={(d) => d && setDataInicio(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Até</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[160px] justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataFim, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFim} onSelect={(d) => d && setDataFim(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Slot</label>
              <Select value={slotFiltro} onValueChange={setSlotFiltro}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="10">10h BRT</SelectItem>
                  <SelectItem value="14">14h BRT</SelectItem>
                  <SelectItem value="18">18h BRT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Concluídas</div>
              <div className="text-2xl font-semibold text-emerald-600">{stats.concluidas}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Com erro</div>
              <div className="text-2xl font-semibold text-destructive">{stats.erros}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Novos eventos</div>
              <div className="text-2xl font-semibold text-blue-600">{stats.novosEventos}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : (execucoes ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma execução no período selecionado.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Disparo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Processos</TableHead>
                    <TableHead className="text-right">Novos</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(execucoes ?? []).map((e) => {
                    const badge = STATUS_BADGE[e.status] ?? STATUS_BADGE.executando;
                    const Icon = badge.Icon;
                    return (
                      <TableRow key={e.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetalheExec(e)}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(e.iniciado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {e.slot != null ? <Badge variant="outline">{e.slot}h</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              e.disparo === "manual"
                                ? "bg-purple-500/10 text-purple-700 border-purple-500/30"
                                : "bg-muted"
                            }
                          >
                            {e.disparo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("gap-1", badge.className)}>
                            <Icon className={cn("h-3 w-3", e.status === "executando" && "animate-spin")} />
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{e.total_processos}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {e.total_novos_eventos > 0 ? (
                            <span className="text-blue-600">{e.total_novos_eventos}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {e.total_erros > 0 ? (
                            <span className="text-destructive">{e.total_erros}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDuracao(e.duracao_ms)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog detalhe da execução */}
      <Dialog open={!!detalheExec} onOpenChange={(o) => !o && setDetalheExec(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da execução</DialogTitle>
            <DialogDescription>
              {detalheExec &&
                `${format(new Date(detalheExec.iniciado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })} · slot ${detalheExec.slot ?? "—"}h · ${detalheExec.disparo}`}
            </DialogDescription>
          </DialogHeader>
          {detalheExec && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Processos</div><div className="font-semibold">{detalheExec.total_processos}</div></div>
                <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Novos eventos</div><div className="font-semibold text-blue-600">{detalheExec.total_novos_eventos}</div></div>
                <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Erros</div><div className="font-semibold text-destructive">{detalheExec.total_erros}</div></div>
                <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Duração</div><div className="font-semibold">{formatDuracao(detalheExec.duracao_ms)}</div></div>
              </div>
              {detalheExec.erro && (
                <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive whitespace-pre-wrap">
                  {detalheExec.erro}
                </div>
              )}
              {Array.isArray(detalheExec.detalhes?.resultados) && detalheExec.detalhes.resultados.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Processo ID</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead className="text-right">Novos</TableHead>
                        <TableHead className="text-right">Steps</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalheExec.detalhes.resultados.map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-mono">{r.processo_id?.slice(0, 8) ?? "—"}…</TableCell>
                          <TableCell>
                            {r.skipped ? (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">pulado: {r.skipped}</Badge>
                            ) : r.erro ? (
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">erro: {String(r.erro).slice(0, 60)}</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">consultado</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{typeof r.novos === "number" ? r.novos : "—"}</TableCell>
                          <TableCell className="text-right">{typeof r.total_steps === "number" ? r.total_steps : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">Sem detalhes por processo.</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}