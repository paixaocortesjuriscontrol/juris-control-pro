import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, PlayCircle, XCircle, StopCircle, RotateCcw, Clock, Loader2, Trash2 } from "lucide-react";
import { useDjenTermosPro } from "@/hooks/useDjenTermosPro";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Props {
  coordenacaoId: string;
}

function formatTempo(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  const sec = segundos % 60;
  if (min < 60) return `${min}m${sec > 0 ? ` ${sec}s` : ''}`;
  const hrs = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hrs}h${remMin > 0 ? ` ${remMin}m` : ''}`;
}

export function MonitoramentoTermosProCard({ coordenacaoId }: Props) {
  const navigate = useNavigate();
  const {
    progress,
    isRunning,
    canResume,
    executar,
    retomar,
    cancelar,
    forceKill,
  } = useDjenTermosPro();

  const isExecutando = progress.status === 'executando';
  const isConcluido = progress.status === 'concluido';
  const isErro = progress.status === 'erro';

  return (
    <Card className={cn(
      "transition-all duration-200",
      isExecutando && "border-primary/50 shadow-md",
      isConcluido && "border-green-500/30",
      isErro && "border-destructive/50",
    )}>
      <CardHeader className="flex flex-row items-center gap-4">
        <div className={cn(
          "p-2 rounded-lg",
          isExecutando ? "bg-primary/20" : "bg-amber-500/10"
        )}>
          <Zap className={cn(
            "h-6 w-6",
            isExecutando ? "text-primary animate-pulse" : "text-amber-600"
          )} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">DJEN Termos Pro</CardTitle>
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
              Novo
            </Badge>
          </div>
          <CardDescription>
            Motor de busca com validação por metadados estruturados da API
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Painel de execução */}
        {isExecutando && (
          <div className="rounded-lg p-3 space-y-3 border bg-primary/5 border-primary/20">
            {/* Barra de progresso */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progresso global</span>
                <span className="font-medium">{progress.percentage}%</span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
            </div>

            {/* Grid de métricas */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dia:</span>
                <span className="font-mono">{progress.diaAtualYmd} ({progress.diaAtualIndice}/{progress.totalDias})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Termo:</span>
                <span className="font-mono">{progress.termoAtualNoDia}/{progress.totalTermos}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Novas:</span>
                <span className="font-mono text-green-600">{progress.novas}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Descartadas:</span>
                <span className="font-mono text-orange-600">{progress.descartadas}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Duplicadas:</span>
                <span className="font-mono text-muted-foreground">{progress.duplicadas}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tempo:</span>
                <span className="font-mono">{formatTempo(progress.tempoDecorrido)}</span>
              </div>
            </div>

            {/* Termo atual */}
            {progress.termoAtual && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="truncate">{progress.mensagem || progress.termoAtual}</span>
              </div>
            )}
          </div>
        )}

        {/* Resultado concluído */}
        {isConcluido && progress.novas > 0 && (
          <div className="rounded-lg p-3 border bg-green-500/5 border-green-500/20">
            <div className="text-sm text-green-700">
              ✅ {progress.novas} novas publicações encontradas • {progress.duplicadas} duplicadas • {progress.descartadas} descartadas
            </div>
          </div>
        )}

        {/* Erro */}
        {isErro && (
          <div className="rounded-lg p-3 border bg-destructive/5 border-destructive/20">
            <div className="text-sm text-destructive">{progress.mensagem}</div>
          </div>
        )}

        {/* Checkpoint disponível */}
        {canResume && !isExecutando && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Checkpoint disponível para retomada</span>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/monitoramento360')}
          >
            Ver alertas
          </Button>

          {canResume && !isExecutando && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => retomar(coordenacaoId || undefined)}
              disabled={isRunning}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Retomar
            </Button>
          )}

          {isExecutando ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={cancelar}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => forceKill(false)}
                title="Forçar parada"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => executar(undefined, undefined, coordenacaoId || undefined)}
              disabled={isRunning}
              className="flex-1"
            >
              <PlayCircle className="h-4 w-4 mr-1" />
              Executar Pro
            </Button>
          )}

          {!isExecutando && (isConcluido || isErro) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => forceKill(true)}
              title="Limpar estado"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
