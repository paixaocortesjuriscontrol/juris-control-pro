import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Database, PlayCircle, CheckCircle2, AlertTriangle, Loader2,
  StopCircle, Skull, Clock, XCircle,
} from "lucide-react";
import { useDjenDataJud } from "@/hooks/useDjenDataJud";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { cn } from "@/lib/utils";

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

export function MonitoramentoDataJudCard() {
  const { isRunning, progress, executar, forceReset } = useDjenDataJud();
  const [showKillDialog, setShowKillDialog] = useState(false);
  const [filtroCoordenacaoId, setFiltroCoordenacaoId] = useState<string>('');
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState<string>('');
  const [diasBusca, setDiasBusca] = useState<string>('7');

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

  const duracao = progress.finished_at && progress.started_at
    ? Math.round((new Date(progress.finished_at).getTime() - new Date(progress.started_at).getTime()) / 1000)
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
  }, [forceReset]);

  return (
    <>
      <Card className={cn("relative overflow-hidden", isRunning && "ring-2 ring-primary/30")}>
        <CardHeader className="flex flex-row items-center gap-4 pb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Monitoramento DataJud (CNJ)</CardTitle>
            <CardDescription>
              Busca complementar de movimentações via API pública do CNJ
            </CardDescription>
          </div>
          <Badge variant="secondary" className={cn("gap-1", statusConfig.bg, statusConfig.color)}>
            <StatusIcon className={cn("h-3 w-3", statusConfig.animate && "animate-spin")} />
            {statusConfig.label}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros: Coordenação e Termos */}
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
            {coordenacaoEfetiva && (
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
                      {m.descricao || m.termo_busca || `${m.tipo || 'Termo'} ${m.oab || ''} ${m.uf || ''}`.trim() || m.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Filtro de Filtro de exibição da coordenação/termo em execução */}
          {isRunning && (filtroCoordenacaoId || filtroMonitoramentoId) && (
            <div className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-xs text-primary font-medium">
              Executando: {coordenacoes.find((c) => c.id === filtroCoordenacaoId)?.nome ?? 'Coord.'}
              {filtroMonitoramentoId && (
                <> • {monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.descricao || monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.termo_busca || 'Termo'}</>
              )}
            </div>
          )}

          {/* Dias de busca */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Período de busca</label>
            <Select value={diasBusca} onValueChange={setDiasBusca} disabled={isRunning}>
              <SelectTrigger className="h-9">
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

          {/* Progress */}
          {(effectiveStatus === 'em_andamento' || effectiveStatus === 'concluido') && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress.termoAtual && (
                    <span className="font-medium">
                      🔍 {progress.termoAtual}
                      {progress.termoTipo && (
                        <span className="text-xs ml-1">({progress.termoTipo})</span>
                      )}
                    </span>
                  )}
                  {!progress.termoAtual && (
                    <span>Tribunais: {progress.tribunaisProcessados}/{progress.totalTribunais || '?'}</span>
                  )}
                </span>
                <span className="font-mono font-medium">{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>
          )}

          {/* Totalizadores */}
          {(effectiveStatus === 'concluido' || (effectiveStatus === 'em_andamento' && progress.tribunaisProcessados > 0)) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-primary">
                ✓ {progress.novas} novas encontradas
              </span>
              <span className="text-muted-foreground">
                ↔ {progress.duplicadas} duplicadas
              </span>
              <span className="text-muted-foreground">
                📊 {progress.tribunaisProcessados} tribunais
              </span>
              {progress.monitoramentosProcessados !== undefined && (
                <span className="text-muted-foreground">
                  📋 {progress.monitoramentosProcessados} monitoramentos
                </span>
              )}
            </div>
          )}

          {/* Tempo */}
          {duracao > 0 && effectiveStatus === 'concluido' && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Duração: {formatDuration(duracao)}</span>
            </div>
          )}

          {/* Erros */}
          {effectiveStatus === 'erro' && progress.erro && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {progress.erro}
            </div>
          )}

          {progress.erros && progress.erros.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                {progress.erros.length} erro(s) parciais
              </summary>
              <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                {progress.erros.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}

          {/* Indicadores de tipo de busca */}
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <Badge variant="secondary">Query por tipo: Advogado/Parte/Palavra-chave</Badge>
            <Badge variant="secondary">API DataJud CNJ</Badge>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2 flex-wrap">
            {isRunning ? (
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled
              >
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                onClick={handleExecutar}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Executar
              </Button>
            )}
          </div>

          {/* Botão Reset Total */}
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowKillDialog(true)}
                  >
                    <Skull className="h-4 w-4 mr-1" />
                    Reset Total
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Forçar cancelamento e limpar todo o estado</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Indicador background */}
          {isRunning && (
            <p className="text-xs text-center text-muted-foreground">
              💡 Execução continua em background mesmo ao sair desta tela
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Busca movimentações nos tribunais usando a API pública do DataJud/CNJ.
            A query varia conforme o tipo do monitoramento (Advogado, Parte ou Palavra-chave).
          </p>
        </CardContent>
      </Card>

      {/* Dialog de kill */}
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
