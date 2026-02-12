import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Database, PlayCircle, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useDjenDataJud } from "@/hooks/useDjenDataJud";

export function MonitoramentoDataJudCard() {
  const { isRunning, progress, executar } = useDjenDataJud();

  const statusLabel = {
    idle: "Parado",
    em_andamento: "Executando...",
    concluido: "Concluído",
    erro: "Erro",
  }[progress.status] || progress.status;

  const statusVariant = {
    idle: "secondary" as const,
    em_andamento: "default" as const,
    concluido: "default" as const,
    erro: "destructive" as const,
  }[progress.status] || ("secondary" as const);

  const StatusIcon = {
    idle: Database,
    em_andamento: Loader2,
    concluido: CheckCircle2,
    erro: AlertTriangle,
  }[progress.status] || Database;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Database className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">Monitoramento DataJud (CNJ)</CardTitle>
          <CardDescription>
            Busca complementar de movimentações processuais via API pública do CNJ
          </CardDescription>
        </div>
        <Badge variant={statusVariant} className="gap-1">
          <StatusIcon className={`h-3 w-3 ${progress.status === 'em_andamento' ? 'animate-spin' : ''}`} />
          {statusLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        {progress.status === 'em_andamento' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Tribunais processados: {progress.tribunaisProcessados}</span>
              <span>Novas: {progress.novas}</span>
            </div>
            <Progress value={undefined} className="h-2" />
          </div>
        )}

        {/* Resultado */}
        {progress.status === 'concluido' && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">{progress.novas}</p>
              <p className="text-xs text-muted-foreground">Novas encontradas</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{progress.duplicadas}</p>
              <p className="text-xs text-muted-foreground">Duplicadas ignoradas</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{progress.tribunaisProcessados}</p>
              <p className="text-xs text-muted-foreground">Tribunais consultados</p>
            </div>
          </div>
        )}

        {/* Erros */}
        {progress.status === 'erro' && progress.erro && (
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

        {/* Action */}
        <Button
          onClick={() => executar(7)}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4 mr-2" />
              Executar (últimos 7 dias)
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          Busca movimentações nos tribunais configurados usando a API pública do DataJud/CNJ.
          Complementa o DJEN Termos capturando publicações "sem efeito intimatório".
        </p>
      </CardContent>
    </Card>
  );
}
