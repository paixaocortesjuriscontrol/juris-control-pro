/**
 * DJEN Termos Paralela Card
 *
 * Card UI separado dos cards Pro/Flash. Mostra uma barra de progresso por
 * tribunal, ordenada por prioridade (TST → STF → STJ → TRFs → TRTs → TJs).
 * Até 5 tribunais executam em paralelo; demais ficam "Pendente".
 */

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Loader2, Zap, PlayCircle, StopCircle,
  CheckCircle2, XCircle, Clock, CalendarIcon, RotateCcw, Skull,
  Server, Globe, Wifi, WifiOff, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDjenTermosParalela } from "@/hooks/useDjenTermosParalela";
import { useDjenTermosParalelaScheduler } from "@/hooks/useDjenTermosParalelaScheduler";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { HorariosDoDiaPicker } from "@/components/djen/HorariosDoDiaPicker";
import { DiasSemanaPicker, DIAS_SEMANA_DEFAULT } from "@/components/djen/DiasSemanaPicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getDjenProxyPoolStats,
  isDjenProxyPoolEnabled,
  getDjenProxySlotsRuntime,
  syncDjenProxyPoolFromSupabase,
} from "@/utils/djenProxyPool";
import { formatMonitoramentoLabel } from '@/utils/monitoramentoLabel';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  idle: { label: 'Aguardando', color: 'text-muted-foreground', bg: 'bg-muted/50' },
  executando: { label: 'Executando', color: 'text-primary', bg: 'bg-primary/10' },
  concluido: { label: 'Concluído', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  cancelado: { label: 'Cancelado', color: 'text-amber-600', bg: 'bg-amber-500/10' },
  erro: { label: 'Erro', color: 'text-destructive', bg: 'bg-destructive/10' },
};

const TRACK_COLORS: Record<string, string> = {
  pendente: 'bg-muted/50 text-muted-foreground border-border',
  executando: 'bg-[hsl(var(--area-civil))]/15 text-[hsl(var(--area-civil))] border-[hsl(var(--area-civil))]/30',
  concluido: 'bg-muted/60 text-muted-foreground border-border',
  concluido_com_resultado: 'bg-[hsl(var(--status-active))]/15 text-[hsl(var(--status-active))] border-[hsl(var(--status-active))]/30',
  erro: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelado: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ----------------------------------------------------------------------------
// Sub-componentes do agendador (isolados para suas próprias subscriptions)
// ----------------------------------------------------------------------------
function SchedulerParalelaPanel() {
  const { ativo, horarios, diasSemana, proximoHorario, start, stop, setHorarios, setDiasSemana } =
    useDjenTermosParalelaScheduler();

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
      <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
        <Label htmlFor="djen-paralela-scheduler-toggle" className="text-sm font-medium">
          Ativar agendamento
        </Label>
        <Switch
          id="djen-paralela-scheduler-toggle"
          checked={ativo}
          onCheckedChange={(checked) => {
            if (checked) { start(); toast.success('Agendamento Paralela ativado'); }
            else { stop(); toast.info('Agendamento Paralela desativado'); }
          }}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Horários BRT (até 3 por dia)</Label>
        <HorariosDoDiaPicker
          value={horarios}
          onChange={(next) => {
            setHorarios(next);
            toast.success(next.length > 0 ? `Horários: ${next.join(', ')}` : 'Horários limpos');
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
  );
}

export function MonitoramentoTermosParalelaCard() {
  const queryClient = useQueryClient();
  const {
    progress,
    isRunning,
    canResume,
    checkpoint,
    executar,
    retomar,
    cancelar,
    forceKill,
    resetTotal,
  } = useDjenTermosParalela();

  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);

  // Filtros: Coordenação e Termos (igual ao Pro)
  const [filtroCoordenacaoId, setFiltroCoordenacaoId] = useState<string>('');
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<string>('');

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const coordenacaoFiltroEfetivo = filtroCoordenacaoId || null;

  const { data: monitoramentos = [] } = useQuery({
    queryKey: ['monitoramentos-djen-coord-termos-paralela', coordenacaoFiltroEfetivo],
    queryFn: async () => {
      if (!coordenacaoFiltroEfetivo) return [];
      const { data, error } = await supabase
        .from('monitoramentos_djen')
        .select('id, termo_busca, descricao, tipo, oab, uf')
        .eq('coordenacao_id', coordenacaoFiltroEfetivo)
        .eq('ativo', true);
      if (error) throw error;
      const list = (data || []) as { id: string; termo_busca: string; descricao?: string; tipo?: string; oab?: string; uf?: string }[];
      const getLabel = (m: typeof list[0]) =>
        formatMonitoramentoLabel(m);
      return list.sort((a, b) => getLabel(a).localeCompare(getLabel(b), 'pt-BR', { sensitivity: 'base' }));
    },
    enabled: !!coordenacaoFiltroEfetivo,
  });

  useEffect(() => {
    if (!filtroCoordenacaoId) setFiltroMonitoramentoId('');
  }, [filtroCoordenacaoId]);

  useEffect(() => {
    setFiltroMonitoramentoId('');
  }, [filtroTipo]);

  const monitoramentosFiltrados = filtroTipo
    ? monitoramentos.filter((m) => (m.tipo || '') === filtroTipo)
    : monitoramentos;

  const getFilterParams = useCallback(() => ({
    coordenacaoId: filtroCoordenacaoId || undefined,
    monitoramentoIds: filtroMonitoramentoId
      ? [filtroMonitoramentoId]
      : (filtroCoordenacaoId && monitoramentosFiltrados.length > 0 && (filtroTipo || monitoramentos.length > 0)
          ? monitoramentosFiltrados.map((m) => m.id)
          : undefined),
  }), [filtroCoordenacaoId, filtroMonitoramentoId, filtroTipo, monitoramentos, monitoramentosFiltrados]);

  // Estatísticas vivas do pool (para o painel de roteamento)
  const [poolStats, setPoolStats] = useState(() => getDjenProxyPoolStats());
  const [poolEnabled, setPoolEnabled] = useState(() => isDjenProxyPoolEnabled());
  const [poolSlots, setPoolSlots] = useState(() => getDjenProxySlotsRuntime());

  useEffect(() => {
    const tick = () => {
      setPoolStats(getDjenProxyPoolStats());
      setPoolEnabled(isDjenProxyPoolEnabled());
      setPoolSlots(getDjenProxySlotsRuntime());
    };
    // Sincroniza do Supabase ao montar (caso este navegador ainda não tenha
    // o cache local populado) e depois aplica o tick.
    syncDjenProxyPoolFromSupabase().finally(tick);
    const id = window.setInterval(tick, 1500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!dataInicio && !dataFim) {
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);
      setDataInicio(hoje);
      setDataFim(hoje);
    }
  }, [dataInicio, dataFim]);

  const getDataYmd = (date?: Date) => date ? format(date, 'yyyy-MM-dd') : undefined;

  const statusConfig = STATUS_CONFIG[progress.status] || STATUS_CONFIG.idle;

  const handleLimparPublicacoes = useCallback(async () => {
    if (!dataInicio || !dataFim) {
      toast.error('Selecione data de início e fim');
      return;
    }
    const filters = getFilterParams();
    if (!filters.coordenacaoId && !filters.monitoramentoIds?.length) {
      toast.error('Selecione uma coordenação ou termo para limpar com segurança.');
      return;
    }
    if (!confirm('Limpar publicações/descartadas da Paralela no período selecionado para o filtro atual?')) return;

    try {
      await forceKill(true);
      toast.info('Limpando publicações da Paralela...');
      const { data, error } = await supabase.functions.invoke('limpar-djen-hoje', {
        body: {
          modo: 'intervalo',
          tipo: 'termos',
          dataInicio: getDataYmd(dataInicio),
          dataFim: getDataYmd(dataFim),
          coordenacaoId: filters.coordenacaoId,
          monitoramentoIds: filters.monitoramentoIds,
        },
      });
      if (error) throw error;
      await resetTotal();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['descartadas-djen'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['djen-stats'], refetchType: 'active' }),
      ]);
      toast.success((data as any)?.message ?? 'Limpeza concluída');
    } catch (err: any) {
      console.error('[Paralela] Erro ao limpar publicações:', err);
      toast.error(`Erro ao limpar: ${err?.message ?? String(err)}`);
    }
  }, [dataInicio, dataFim, forceKill, resetTotal, getFilterParams, queryClient]);

  const handleExecutar = useCallback(() => {
    if (!dataInicio || !dataFim) {
      toast.error('Selecione data de início e fim');
      return;
    }
    const filters = getFilterParams();
    console.log('[Paralela] handleExecutar', {
      coordenacaoId: filters.coordenacaoId,
      monitoramentoIdsCount: filters.monitoramentoIds?.length ?? 0,
      monitoramentosCarregados: monitoramentos.length,
    });
    executar(getDataYmd(dataInicio), getDataYmd(dataFim), filters.coordenacaoId, filters.monitoramentoIds);
  }, [dataInicio, dataFim, executar, getFilterParams, monitoramentos.length]);

  const handleRetomar = useCallback(() => {
    if (!checkpoint) return;
    const filters = getFilterParams();
    retomar(filters.coordenacaoId, filters.monitoramentoIds);
  }, [checkpoint, retomar, getFilterParams]);

  // Mapa id→label dos slots para exibir contadores legíveis
  const slotLabelById: Record<string, string> = {};
  poolSlots.forEach(s => { slotLabelById[s.id] = s.label || s.baseUrl; });

  const hydratedStats = progress.poolStats;
  const routingStats = poolStats.total > 0 ? poolStats : {
    total: hydratedStats?.total ?? poolStats.total,
    direct: hydratedStats?.direct ?? poolStats.direct,
    byProxy: hydratedStats?.byProxy ?? poolStats.byProxy,
    rateLimitsByProxy: hydratedStats?.rateLimitsByProxy ?? poolStats.rateLimitsByProxy,
    errorsByProxy: hydratedStats?.errorsByProxy ?? poolStats.errorsByProxy,
  };
  const totalProxyCalls = Object.values(routingStats.byProxy).reduce((a, b) => a + b, 0);
  const totalRateLimits = Object.values(routingStats.rateLimitsByProxy).reduce((a, b) => a + b, 0);
  const proxiesOnline = poolSlots.filter(s => s.enabled && s.online).length;
  const proxiesTotal = poolSlots.filter(s => s.enabled).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle>DJEN Termos Paralela</CardTitle>
            <Badge variant="outline" className="text-xs">
              {progress.concorrencia} worker{progress.concorrencia > 1 ? 's' : ''} (1 por IP)
            </Badge>
            {poolEnabled ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 text-xs gap-1">
                <Server className="h-3 w-3" /> Pool VPS ativo · {proxiesOnline}/{proxiesTotal}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1">
                <Globe className="h-3 w-3" /> Direto (browser)
              </Badge>
            )}
          </div>
          <div className={cn("px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2", statusConfig.bg, statusConfig.color)}>
            {progress.status === 'executando' && <Loader2 className="h-4 w-4 animate-spin" />}
            {progress.status === 'concluido' && <CheckCircle2 className="h-4 w-4" />}
            {progress.status === 'cancelado' && <StopCircle className="h-4 w-4" />}
            {progress.status === 'erro' && <XCircle className="h-4 w-4" />}
            {progress.status === 'idle' && <Clock className="h-4 w-4" />}
            {statusConfig.label}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Agendamento automático */}
        <SchedulerParalelaPanel />

        {/* Filtros: Coordenação e Termos */}
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
              {coordenacoes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
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
                {monitoramentosFiltrados.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatMonitoramentoLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {isRunning && (filtroCoordenacaoId || filtroMonitoramentoId) && (
          <div className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-xs text-primary font-medium">
            Executando: {coordenacoes.find((c) => c.id === filtroCoordenacaoId)?.nome ?? 'Todas'}
            {filtroMonitoramentoId && (
              <> • {formatMonitoramentoLabel(monitoramentos.find((m) => m.id === filtroMonitoramentoId) || {})}</>
            )}
          </div>
        )}

        {/* Seleção de datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data início</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, 'dd/MM/yyyy') : 'Selecione'}
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
                <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, 'dd/MM/yyyy') : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dataFim} onSelect={setDataFim} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExecutar} disabled={isRunning} className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Executar Paralela
          </Button>
          {canResume && (
            <Button onClick={handleRetomar} disabled={isRunning} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Retomar
            </Button>
          )}
          {isRunning && (
            <Button onClick={cancelar} variant="destructive" className="gap-2">
              <StopCircle className="h-4 w-4" />
              Cancelar
            </Button>
          )}
          <Button
            onClick={() => forceKill(false)}
            variant="ghost"
            size="sm"
            className="gap-2 ml-auto"
            title="Para a execução preservando o checkpoint para retomar depois"
          >
            <Skull className="h-4 w-4" />
            Forçar Parada
          </Button>
          <Button onClick={handleLimparPublicacoes} disabled={isRunning} variant="outline" size="sm" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Limpar filtro
          </Button>
          <Button
            onClick={() => {
              if (confirm('Reset Total: apaga TUDO (checkpoint, progresso, stats, execuções órfãs no banco). Continuar?')) {
                resetTotal();
              }
            }}
            variant="destructive"
            size="sm"
            className="gap-2"
            title="Limpa absolutamente tudo: checkpoint, progresso, stats do pool e execuções órfãs no banco"
          >
            <Trash2 className="h-4 w-4" />
            Reset Total
          </Button>
        </div>

        {/* Progresso global */}
        {progress.totalTribunais > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Progresso global: {progress.tribunaisConcluidos}/{progress.totalTribunais} tribunais
              </span>
              <span className="text-muted-foreground">
                {progress.percentage}% • {formatDuration(progress.tempoDecorrido)}
              </span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
              <span>✅ Novas: <strong className="text-emerald-600">{progress.novas}</strong></span>
              <span>♻️ Duplicadas: <strong>{progress.duplicadas}</strong></span>
              <span>❌ Descartadas: <strong>{progress.descartadas}</strong></span>
            </div>
            {progress.mensagem && (
              <p className="text-xs text-muted-foreground italic pt-1">{progress.mensagem}</p>
            )}
          </div>
        )}

        {/* Painel de roteamento (Pool VPS) */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Server className="h-4 w-4 text-primary" />
              Roteamento da sessão
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {routingStats.total} chamadas
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border bg-background p-2">
              <div className="text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3" /> Direto (browser)
              </div>
              <div className="text-base font-bold tabular-nums">{routingStats.direct}</div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-muted-foreground flex items-center gap-1">
                <Server className="h-3 w-3" /> Via VPS
              </div>
              <div className="text-base font-bold tabular-nums text-primary">
                {totalProxyCalls}
              </div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-muted-foreground">Rate-limits (429)</div>
              <div className={cn(
                "text-base font-bold tabular-nums",
                totalRateLimits > 0 ? "text-amber-600" : ""
              )}>{totalRateLimits}</div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-muted-foreground">VPS online</div>
              <div className="text-base font-bold tabular-nums">
                {proxiesOnline}/{proxiesTotal}
              </div>
            </div>
          </div>
          {poolSlots.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {poolSlots.map(s => {
                const calls = routingStats.byProxy[s.id] || 0;
                const rl = routingStats.rateLimitsByProxy[s.id] || 0;
                const isSlow = !!(s as any).slow;
                return (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className={cn(
                      "text-[11px] gap-1 font-mono",
                      !s.online
                        ? "border-destructive/40 text-destructive bg-destructive/5"
                        : isSlow
                          ? "border-amber-500/50 text-amber-700 bg-amber-500/10"
                          : "border-emerald-500/40 text-emerald-700 bg-emerald-500/5"
                    )}
                    title={
                      !s.online
                        ? `Offline — ${s.lastError ?? ''}`
                        : isSlow
                          ? `Lento — upstream (PJE) demorou > 45s na última chamada. VPS continua na fila.`
                          : `Online — ${s.baseUrl}`
                    }
                  >
                    {s.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {s.label}
                    {isSlow && <span className="opacity-80">· lento</span>}
                    <span className="opacity-70">· {calls}</span>
                    {rl > 0 && <span className="text-amber-600">⚠ {rl}</span>}
                  </Badge>
                );
              })}
            </div>
          )}
          {!poolEnabled && (
            <p className="text-[11px] text-muted-foreground italic">
              Pool VPS desabilitado — todas as chamadas estão indo direto do navegador.
            </p>
          )}
        </div>

        {/* Tracks por tribunal */}
        {progress.tracks.length > 0 && (
          <div className="h-[1800px] overflow-y-auto pr-1">
            <h4 className="text-sm font-semibold sticky top-0 bg-card py-1 z-10">
              Tribunais ({progress.tracks.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {progress.tracks.map((track) => {
              const pct = track.total > 0
                ? Math.min(100, Math.round((track.current / track.total) * 100))
                : 0;
              const hasAchados = (track.novas || 0) > 0 || (track.duplicadas || 0) > 0;
              const colorKey = track.status === 'concluido' && hasAchados ? 'concluido_com_resultado' : track.status;
              const colorClass = TRACK_COLORS[colorKey] || TRACK_COLORS.pendente;
              const totalCallsTrack =
                track.callsDirect +
                Object.values(track.callsByProxy || {}).reduce((a, b) => a + b, 0);
              return (
                <div
                  key={`${track.tipo}|${track.tribunal}|${track.monId ?? ''}`}
                  className={cn("border rounded-md p-2 space-y-1", colorClass)}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-sm">{track.tribunal}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {track.tipo}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {track.status}
                      </Badge>
                      {track.monLabel && (
                        <span className="text-[11px] truncate max-w-[40ch] opacity-80" title={track.monLabel}>
                          {track.monLabel}
                        </span>
                      )}
                      {track.status === 'executando' && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {/* Última rota usada (só relevante quando executou algo) */}
                      {track.lastViaKind && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] gap-1 font-mono",
                            track.lastViaKind === 'proxy'
                              ? "border-primary/50 text-primary bg-primary/10"
                              : "border-muted-foreground/30 text-muted-foreground bg-muted/40"
                          )}
                          title={`Última chamada via ${track.lastViaLabel}`}
                        >
                          {track.lastViaKind === 'proxy'
                            ? <Server className="h-3 w-3" />
                            : <Globe className="h-3 w-3" />}
                          {track.lastViaLabel}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs tabular-nums whitespace-nowrap">
                      {track.current}/{track.total} • {pct}%
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate flex-1 opacity-80">
                      {track.mensagem}
                    </span>
                    <span className="whitespace-nowrap tabular-nums opacity-80">
                      ✅{track.novas} ♻️{track.duplicadas} ❌{track.descartadas}
                    </span>
                  </div>
                  {/* Detalhamento de uso por rota neste tribunal */}
                  {totalCallsTrack > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 text-[10px]">
                      {track.callsDirect > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-background/60 border font-mono inline-flex items-center gap-1">
                          <Globe className="h-2.5 w-2.5" /> Direto · {track.callsDirect}
                        </span>
                      )}
                      {Object.entries(track.callsByProxy || {}).map(([id, n]) => (
                        <span
                          key={id}
                          className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary font-mono inline-flex items-center gap-1"
                        >
                          <Server className="h-2.5 w-2.5" />
                          {slotLabelById[id] || id} · {n}
                        </span>
                      ))}
                    </div>
                  )}
                  {track.ultimoErro && (
                    <p className="text-xs text-destructive italic">⚠ {track.ultimoErro}</p>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        )}

        {progress.tracks.length === 0 && progress.status === 'idle' && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Selecione o período e clique em <strong>Executar Paralela</strong> para iniciar.
            Cada IP (Direto + cada VPS) processa 1 tribunal por vez em paralelo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}