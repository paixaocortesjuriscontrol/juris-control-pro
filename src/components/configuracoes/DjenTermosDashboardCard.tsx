import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Newspaper, PlayCircle, StopCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MonitoringStats } from "@/hooks/useMonitoringDashboard";
import { cn } from "@/lib/utils";
import { useBuscaDjenDireta } from "@/hooks/useBuscaDjenDireta";
import { withTimeout } from "@/utils/withTimeout";

type Props = {
  stats: MonitoringStats;
  isExecuting: boolean;
  isCancelling: boolean;
  onReativarConfig: (tipo: string) => Promise<void>;
  onAfterMutation: () => void;
};

export function DjenTermosDashboardCard({
  stats,
  isExecuting,
  isCancelling,
  onReativarConfig,
  onAfterMutation,
}: Props) {
  const {
    progresso,
    executando,
    executarMonitoramento,
    cancelarExecucao,
  } = useBuscaDjenDireta();

  const [limpando, setLimpando] = useState(false);

  const percent = useMemo(() => {
    if (progresso.totalMonitoramentos <= 0) return 0;
    return Math.round((progresso.monitoramentoAtual / progresso.totalMonitoramentos) * 100);
  }, [progresso.monitoramentoAtual, progresso.totalMonitoramentos]);

  const md = (stats.config?.metadata as Record<string, any> | null) || {};
  const isPaused = stats.config?.ativo === false || md.paused_globally === true;

  const handleExecutar = async () => {
    if (executando || isExecuting) return;

    try {
      if (isPaused) {
        await onReativarConfig('djen');
      }
      await executarMonitoramento();
      toast.info('DJEN Termos iniciado (busca direta).');
    } catch (e: any) {
      toast.error(`Erro ao iniciar DJEN: ${e?.message || 'erro desconhecido'}`);
    }
  };

  const handleCancelar = () => {
    try {
      cancelarExecucao();
      toast.success('Cancelamento solicitado.');
    } catch (e: any) {
      toast.error(`Erro ao cancelar: ${e?.message || 'erro desconhecido'}`);
    }
  };

  const handleLimparHoje = async () => {
    if (!confirm('Isso vai limpar TODAS as publicações DJEN capturadas hoje. Deseja continuar?')) return;

    setLimpando(true);
    try {
      if (executando) {
        handleCancelar();
        await new Promise((r) => setTimeout(r, 600));
      }

      // A limpeza pode levar >60s (alto volume). Mantemos timeout mais folgado.
      const { data, error } = await withTimeout(
        supabase.functions.invoke('limpar-djen-hoje'),
        180_000,
        'A limpeza demorou mais que 180s. Verifique o log da função e tente novamente.'
      );
      if (error) throw error;

      toast.success((data as any)?.message ?? 'Limpeza concluída!');
      onAfterMutation();
    } catch (e: any) {
      toast.error(`Erro ao limpar: ${e?.message || 'erro desconhecido'}`);
    } finally {
      setLimpando(false);
    }
  };

  const showProgress = executando && progresso.status === 'executando';

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      (executando || stats.status === 'running') && "ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", "bg-muted/50")}>
              <Newspaper className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{stats.nome}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{stats.config?.frequencia || 'diário'}</Badge>
                {isPaused && (
                  <Badge variant="secondary" className="text-xs">Desativado</Badge>
                )}
                <Badge variant="secondary" className="text-xs">Busca direta</Badge>
              </div>
            </div>
          </div>
          {/* Status simples para busca direta */}
          <Badge variant="outline" className={cn("gap-1.5 font-medium", executando ? "text-blue-600" : "text-muted-foreground")}>
            {executando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Newspaper className="h-3.5 w-3.5" />}
            {executando ? 'Executando' : 'Aguardando'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progresso real (frontend) */}
        {showProgress && (
          <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">
                {progresso.totalMonitoramentos > 0
                  ? `Processando: ${progresso.monitoramentoAtual}/${progresso.totalMonitoramentos}`
                  : 'Processando...'}
              </span>
              <span className="font-bold text-primary">{percent}%</span>
            </div>
            <Progress value={percent} className="h-2.5" />
            {progresso.mensagem && (
              <div className="text-xs text-muted-foreground">{progresso.mensagem}</div>
            )}
          </div>
        )}

        {/* Resumo ao terminar */}
        {(progresso.status === 'concluido' || progresso.status === 'erro') && !showProgress && (
          <div className="p-3 bg-muted/30 rounded-lg border">
            <div className="text-sm font-medium">{progresso.mensagem || 'Execução finalizada'}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Novas: {progresso.publicacoesNovas} • Duplicadas: {progresso.publicacoesDuplicadas}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={handleExecutar}
            disabled={executando || isExecuting || stats.status === 'timeout'}
          >
            {(executando || isExecuting) ? (
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

          <Button
            size="sm"
            variant="destructive"
            onClick={handleCancelar}
            disabled={isCancelling || (!executando && stats.status !== 'timeout')}
            title="Cancelar"
          >
            {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleLimparHoje}
            disabled={limpando}
            title="Limpar DJEN hoje"
          >
            {limpando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
