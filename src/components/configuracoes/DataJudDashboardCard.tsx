import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Database, PlayCircle, CheckCircle2, Loader2,
  StopCircle, Skull, Clock, XCircle, Mail,
} from "lucide-react";
import { useDjenDataJud } from "@/hooks/useDjenDataJud";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { cn } from "@/lib/utils";
import type { MonitoringStats } from "@/hooks/useMonitoringDashboard";
import { useEnviarResumoManual } from "@/hooks/useEnviarResumoManual";

type Props = {
  stats: MonitoringStats;
  onAfterMutation: () => void;
};

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  icon: typeof Clock;
  animate?: boolean;
}> = {
  idle: { label: 'Aguardando', color: 'text-muted-foreground', bg: 'bg-muted/50', icon: Database },
  em_andamento: { label: 'Executando', color: 'text-primary', bg: 'bg-primary/10', icon: Loader2, animate: true },
  concluido: { label: 'Concluído', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  erro: { label: 'Erro', color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function DataJudDashboardCard({ stats, onAfterMutation }: Props) {
  const { isRunning, progress, executar, forceReset } = useDjenDataJud();
  const [showKillDialog, setShowKillDialog] = useState(false);
  const [filtroCoordenacaoId, setFiltroCoordenacaoId] = useState<string>('');
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState<string>('');
  const [diasBusca, setDiasBusca] = useState<string>('7');
  const { enviando, enviarResumo } = useEnviarResumoManual();

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const coordenacaoEfetiva = filtroCoordenacaoId || null;

  const { data: monitoramentos = [] } = useQuery({
    queryKey: ['monitoramentos-djen-datajud-filter', coordenacaoEfetiva],
    queryFn: async () => {
      if (!coordenacaoEfetiva) return [];
      const { data, error } = await supabase
        .from('monitoramentos_djen')
        .select('id, termo_busca, descricao, tipo, oab, uf')
        .eq('coordenacao_id', coordenacaoEfetiva)
        .eq('ativo', true);
      if (error) throw error;
      const list = (data || []) as { id: string; termo_busca: string; descricao?: string; tipo?: string; oab?: string; uf?: string }[];
      const getLabel = (m: typeof list[0]) =>
        m.descricao || m.termo_busca || `${m.tipo || 'Termo'} ${m.oab || ''} ${m.uf || ''}`.trim() || m.id.slice(0, 8);
      return list.sort((a, b) => getLabel(a).localeCompare(getLabel(b), 'pt-BR', { sensitivity: 'base' }));
    },
    enabled: !!coordenacaoEfetiva,
  });

  useEffect(() => {
    if (!filtroCoordenacaoId) setFiltroMonitoramentoId('');
  }, [filtroCoordenacaoId]);

  const effectiveStatus = progress.status || 'idle';
  const statusConfig = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.idle;
  const StatusIcon = statusConfig.icon;

  const percentage = progress.percentage ?? (
    progress.totalTribunais > 0
      ? Math.round((progress.tribunaisProcessados / progress.totalTribunais) * 100)
      : 0
  );

  const duracao = progress.started_at
    ? Math.round((new Date(progress.finished_at || new Date()).getTime() - new Date(progress.started_at).getTime()) / 1000)
    : 0;

  const handleExecutar = useCallback(() => {
    const dias = parseInt(diasBusca, 10) || 7;
    const filtros: { coordenacaoId?: string; monitoramentoIds?: string[] } = {};
    if (filtroCoordenacaoId) filtros.coordenacaoId = filtroCoordenacaoId;
    if (filtroMonitoramentoId) filtros.monitoramentoIds = [filtroMonitoramentoId];
    executar(dias, Object.keys(filtros).length > 0 ? filtros : undefined);
  }, [executar, diasBusca, filtroCoordenacaoId, filtroMonitoramentoId]);

  const handleForceKill = useCallback(() => {
    setShowKillDialog(false);
    forceReset();
    onAfterMutation();
  }, [forceReset, onAfterMutation]);

  return (
    <>
      <Card className={cn(
        "overflow-hidden transition-all duration-300",
        isRunning && "ring-2 ring-primary/30 shadow-lg shadow-primary/10",
        effectiveStatus === 'erro' && "ring-1 ring-destructive/30",
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-xl", statusConfig.bg)}>
                <Database className={cn("h-5 w-5", statusConfig.color, isRunning && "animate-pulse")} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">DataJud (CNJ)</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">manual</Badge>
                </div>
              </div>
            </div>
            <Badge variant="outline" className={cn("gap-1.5 font-medium", statusConfig.color, statusConfig.bg)}>
              <StatusIcon className={cn("h-3.5 w-3.5", statusConfig.animate && "animate-spin")} />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Filtros */}
          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Coordenação</label>
              <select
                className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs disabled:opacity-70"
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
            {coordenacaoEfetiva && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Termo</label>
                <select
                  className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs disabled:opacity-70"
                  value={filtroMonitoramentoId}
                  onChange={(e) => setFiltroMonitoramentoId(e.target.value)}
                  disabled={isRunning}
                >
                  <option value="">Todos</option>
                  {monitoramentos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.descricao || m.termo_busca || `${m.tipo || 'Termo'} ${m.oab || ''} ${m.uf || ''}`.trim() || m.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Período</label>
              <Select value={diasBusca} onValueChange={setDiasBusca} disabled={isRunning}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Últimos 3 dias</SelectItem>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="14">Últimos 14 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Execution indicator */}
          {isRunning && (filtroCoordenacaoId || filtroMonitoramentoId) && (
            <div className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-xs text-primary font-medium">
              Executando: {coordenacoes.find((c) => c.id === filtroCoordenacaoId)?.nome ?? 'Todas'}
              {filtroMonitoramentoId && (
                <> • {monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.descricao || monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.termo_busca || 'Termo'}</>
              )}
            </div>
          )}

          {/* Progress */}
          {(effectiveStatus === 'em_andamento' || effectiveStatus === 'concluido') && (
            <div className={cn(
              "rounded-xl p-3 space-y-2 border-2 transition-all",
              statusConfig.bg,
              isRunning && "shadow-lg shadow-primary/10"
            )}>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">
                    {progress.termoAtual ? (
                      <span className="text-xs">🔍 {progress.termoAtual}</span>
                    ) : (
                      <span className="text-xs">Tribunais: {progress.tribunaisProcessados}/{progress.totalTribunais || '?'}</span>
                    )}
                  </span>
                  <span className={cn("font-bold", statusConfig.color)}>{percentage}%</span>
                </div>
                <Progress value={percentage} className={cn("h-2.5", isRunning && "animate-pulse")} />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-background/60 rounded-lg p-2 text-center border">
                  <div className="text-[10px] text-muted-foreground">Processados</div>
                  <div className="text-base font-bold font-mono">{progress.tribunaisProcessados.toLocaleString('pt-BR')}</div>
                </div>
                <div className="bg-background/60 rounded-lg p-2 text-center border">
                  <div className="text-[10px] text-muted-foreground">Encontrados / Descartadas</div>
                  <div className="text-base font-bold font-mono text-emerald-600">{progress.novas.toLocaleString('pt-BR')}</div>
                  <div className="text-xs font-mono text-destructive">{progress.duplicadas.toLocaleString('pt-BR')}</div>
                </div>
                <div className="bg-background/60 rounded-lg p-2 text-center border">
                  <div className="text-[10px] text-muted-foreground">Total</div>
                  <div className="text-base font-bold font-mono">{progress.totalTribunais > 0 ? progress.totalTribunais.toLocaleString('pt-BR') : '-'}</div>
                </div>
                <div className="bg-background/60 rounded-lg p-2 text-center border">
                  <div className="text-[10px] text-muted-foreground">Tempo</div>
                  <div className={cn("text-base font-bold font-mono", isRunning && "text-primary")}>{duracao > 0 ? formatDuration(duracao) : '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Erros */}
          {effectiveStatus === 'erro' && progress.erro && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium line-clamp-2">{progress.erro}</span>
              </div>
            </div>
          )}

          {progress.erros && progress.erros.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">{progress.erros.length} erro(s) parciais</summary>
              <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                {progress.erros.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}

          {/* Today stats */}
          <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
            <span className="font-medium">Hoje:</span>
            <div className="flex items-center gap-3">
              <span>⚡ {stats.todayStats.executions}</span>
              <span className="text-emerald-600">↑ {stats.todayStats.novas ?? 0}</span>
            </div>
          </div>

          {/* Last execution */}
          {progress.finished_at && effectiveStatus === 'concluido' && (
            <div className="text-xs text-muted-foreground text-center">
              Última execução: {new Date(progress.finished_at).toLocaleString('pt-BR')}
            </div>
          )}

          {/* Running indicator */}
          {isRunning && (
            <div className="flex items-center justify-center gap-2 text-primary py-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Execução em andamento...</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleExecutar}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Executar
                </>
              )}
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowKillDialog(true)}
                  >
                    <Skull className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset Total - Limpar estado</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => enviarResumo('datajud_termos' as any)}
                    disabled={enviando['datajud_termos'] || false}
                  >
                    {enviando['datajud_termos'] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enviar resumo de hoje</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Kill Dialog */}
      <AlertDialog open={showKillDialog} onOpenChange={setShowKillDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Total?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá limpar todo o estado do monitoramento DataJud (status, progresso, contadores).
              Nenhuma movimentação já salva será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button variant="destructive" onClick={handleForceKill}>
              Confirmar Reset
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
