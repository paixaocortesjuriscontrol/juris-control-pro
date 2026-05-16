/**
 * STF Termos Dashboard Card
 *
 * UI para o engine "STF Termos Flash" — busca direta em digital.stf.jus.br/publico/publicacoes.
 * Reutiliza monitoramentos_djen (mesmos termos, exclusões e condicao_concomitante).
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCoordenacoesFull } from '@/hooks/useCoordenacoes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Loader2, Landmark, PlayCircle, StopCircle,
  CheckCircle2, XCircle, Clock, CalendarIcon, RotateCcw, Skull,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStfTermosFlash } from '@/hooks/useStfTermosFlash';
import { toast } from 'sonner';
import { formatMonitoramentoLabel } from '@/utils/monitoramentoLabel';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock; animate?: boolean }> = {
  idle: { label: 'Aguardando', color: 'text-muted-foreground', bg: 'bg-muted/50', icon: Clock },
  executando: { label: 'Executando', color: 'text-primary', bg: 'bg-primary/10', icon: Loader2, animate: true },
  concluido: { label: 'Concluído', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: StopCircle },
  erro: { label: 'Erro', color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function StfTermosDashboardCard() {
  const {
    progress, isRunning, canResume, checkpoint,
    executar, retomar, cancelar, limpar, forceKill,
  } = useStfTermosFlash();

  const [filtroCoordenacaoId, setFiltroCoordenacaoId] = useState<string>('');
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState<string>('');
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [showKillDialog, setShowKillDialog] = useState(false);

  const { data: coordenacoes = [] } = useCoordenacoesFull();

  const { data: monitoramentos = [] } = useQuery({
    queryKey: ['monitoramentos-djen-stf-flash', filtroCoordenacaoId],
    queryFn: async () => {
      if (!filtroCoordenacaoId) return [];
      const { data, error } = await supabase
        .from('monitoramentos_djen')
        .select('id, termo_busca, descricao, tipo, oab, uf')
        .eq('coordenacao_id', filtroCoordenacaoId)
        .eq('ativo', true);
      if (error) throw error;
      const list = (data || []) as { id: string; termo_busca: string; descricao?: string; tipo?: string; oab?: string; uf?: string }[];
      const getLabel = (m: typeof list[0]) =>
        formatMonitoramentoLabel(m);
      return list.sort((a, b) => getLabel(a).localeCompare(getLabel(b), 'pt-BR', { sensitivity: 'base' }));
    },
    enabled: !!filtroCoordenacaoId,
  });

  useEffect(() => {
    if (!filtroCoordenacaoId) setFiltroMonitoramentoId('');
  }, [filtroCoordenacaoId]);

  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (!dataInicio && !dataFim) {
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);
      setDataInicio(hoje);
      setDataFim(hoje);
    }
  }, [dataInicio, dataFim]);

  const getDataYmd = useCallback((date?: Date): string | undefined => {
    if (!date) return undefined;
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return format(d, 'yyyy-MM-dd');
  }, []);

  const statusConfig = STATUS_CONFIG[progress.status] || STATUS_CONFIG.idle;
  const StatusIcon = statusConfig.icon;
  const displayedPercentage = useMemo(() => {
    if (progress.status === 'concluido') return 100;
    const raw = Number.isFinite(progress.percentage) ? Math.round(progress.percentage) : 0;
    const clamped = Math.min(100, Math.max(0, raw));
    return isRunning ? Math.min(99, clamped) : clamped;
  }, [progress.percentage, progress.status, isRunning]);

  const getFilterParams = useCallback(() => ({
    coordenacaoId: filtroCoordenacaoId || undefined,
    monitoramentoIds: filtroMonitoramentoId
      ? [filtroMonitoramentoId]
      : (filtroCoordenacaoId && monitoramentos.length > 0 ? monitoramentos.map((m) => m.id) : undefined),
  }), [filtroCoordenacaoId, filtroMonitoramentoId, monitoramentos]);

  const handleExecutar = useCallback(() => {
    if (canResume) { setShowResumeDialog(true); return; }
    if (!dataInicio || !dataFim) {
      toast.error('Selecione data de início e fim antes de executar');
      return;
    }
    const filters = getFilterParams();
    executar(getDataYmd(dataInicio), getDataYmd(dataFim), filters.coordenacaoId, filters.monitoramentoIds);
  }, [canResume, dataInicio, dataFim, getDataYmd, executar, getFilterParams]);

  const handleRetomar = useCallback(() => {
    if (!checkpoint) return;
    const filters = getFilterParams();
    retomar(filters.coordenacaoId, filters.monitoramentoIds);
    setShowResumeDialog(false);
  }, [checkpoint, retomar, getFilterParams]);

  const handleNovaExecucao = useCallback(() => {
    setShowResumeDialog(false);
    const filters = getFilterParams();
    executar(getDataYmd(dataInicio), getDataYmd(dataFim), filters.coordenacaoId, filters.monitoramentoIds);
  }, [executar, getDataYmd, dataInicio, dataFim, getFilterParams]);

  return (
    <>
      <Card className={cn('relative overflow-hidden', isRunning && 'ring-2 ring-primary/30')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">STF Termos Flash</CardTitle>
            </div>
            <Badge variant="secondary" className={cn('gap-1', statusConfig.bg, statusConfig.color)}>
              <StatusIcon className={cn('h-3 w-3', statusConfig.animate && 'animate-spin')} />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            {filtroCoordenacaoId && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Termo</label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
                  value={filtroMonitoramentoId}
                  onChange={(e) => setFiltroMonitoramentoId(e.target.value)}
                  disabled={isRunning}
                >
                  <option value="">Todos</option>
                  {monitoramentos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {formatMonitoramentoLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data início</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full h-9 justify-start text-left font-normal', !dataInicio && 'text-muted-foreground')}
                    disabled={isRunning}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data fim</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full h-9 justify-start text-left font-normal', !dataFim && 'text-muted-foreground')}
                    disabled={isRunning}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFim} onSelect={setDataFim} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Progresso */}
          {(isRunning || progress.status === 'concluido') && (
            <div className="space-y-2">
              <Progress value={displayedPercentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.mensagem || '...'}</span>
                <span>{displayedPercentage}%</span>
              </div>
            </div>
          )}

          {/* Métricas */}
          {(progress.novas > 0 || progress.duplicadas > 0 || progress.descartadas > 0 || isRunning) && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-emerald-500/10 px-2 py-1.5">
                <div className="text-lg font-semibold text-emerald-700">{progress.novas}</div>
                <div className="text-xs text-muted-foreground">Novas</div>
              </div>
              <div className="rounded-md bg-amber-500/10 px-2 py-1.5">
                <div className="text-lg font-semibold text-amber-700">{progress.duplicadas}</div>
                <div className="text-xs text-muted-foreground">Duplicadas</div>
              </div>
              <div className="rounded-md bg-muted/50 px-2 py-1.5">
                <div className="text-lg font-semibold text-muted-foreground">{progress.descartadas}</div>
                <div className="text-xs text-muted-foreground">Descartadas</div>
              </div>
            </div>
          )}

          {/* Telemetria */}
          {(progress.chamadasApi > 0 || isRunning) && (
            <div className="text-xs text-muted-foreground border-t pt-2 grid grid-cols-2 gap-1">
              <span>Chamadas API: <strong>{progress.chamadasApi}</strong></span>
              <span>Páginas: <strong>{progress.paginasBuscadas}</strong></span>
              {progress.tempoDecorrido > 0 && (
                <span>Tempo: <strong>{formatDuration(progress.tempoDecorrido)}</strong></span>
              )}
              {progress.falhasBusca > 0 && (
                <span className="text-amber-600">Falhas: <strong>{progress.falhasBusca}</strong></span>
              )}
            </div>
          )}

          {progress.ultimoErroBusca && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-800">
              Último erro: {progress.ultimoErroBusca}
            </div>
          )}

          {/* Botões */}
          <div className="flex flex-wrap gap-2 pt-1">
            {!isRunning && (
              <Button onClick={handleExecutar} className="flex-1 min-w-[120px]" size="sm">
                <PlayCircle className="h-4 w-4 mr-1" /> Executar
              </Button>
            )}
            {isRunning && (
              <Button onClick={cancelar} variant="destructive" className="flex-1 min-w-[120px]" size="sm">
                <StopCircle className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            )}
            {canResume && !isRunning && (
              <Button onClick={handleRetomar} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-1" /> Retomar
              </Button>
            )}
            {(progress.status === 'concluido' || progress.status === 'cancelado' || progress.status === 'erro') && (
              <Button onClick={limpar} variant="ghost" size="sm">Limpar</Button>
            )}
            <Button onClick={() => setShowKillDialog(true)} variant="ghost" size="sm" className="text-destructive">
              <Skull className="h-4 w-4 mr-1" /> Force kill
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground border-t pt-2">
            Reutiliza os mesmos monitoramentos do DJEN (termos, exclusões, condição concomitante).
            Busca direta em <code>digital.stf.jus.br</code> via navegador do usuário.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retomar execução anterior?</AlertDialogTitle>
            <AlertDialogDescription>
              Existe uma execução pausada. Você quer retomar do ponto onde parou ou começar uma nova execução com as datas atuais?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={handleNovaExecucao}>Nova execução</Button>
            <AlertDialogAction onClick={handleRetomar}>Retomar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showKillDialog} onOpenChange={setShowKillDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force kill da execução STF Flash?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso aborta a execução atual e limpa o checkpoint salvo. Use apenas se a execução estiver travada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { forceKill(true); setShowKillDialog(false); }}>
              Force kill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}