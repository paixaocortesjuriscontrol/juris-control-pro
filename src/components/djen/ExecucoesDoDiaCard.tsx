import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Sparkles,
  ListFilter,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useExecucoesDoDiaServidor, type ExecucaoDoDia } from "@/hooks/useExecucoesDoDiaServidor";

interface Props {
  coordenacaoId: string | null | undefined;
  dataDisponibilizacao: string | null | undefined;
  /** Execução atualmente "focada" para destacar apenas suas novas */
  execucaoSelecionadaId: string | null;
  onSelecionarExecucao: (exec: ExecucaoDoDia | null) => void;
}

function fmtHora(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function rotuloEngine(t: "paralela" | "pautas"): string {
  return t === "pautas" ? "Pautas" : "Termos";
}

export function ExecucoesDoDiaCard({
  coordenacaoId,
  dataDisponibilizacao,
  execucaoSelecionadaId,
  onSelecionarExecucao,
}: Props) {
  const { data: execs, isLoading } = useExecucoesDoDiaServidor(
    coordenacaoId,
    dataDisponibilizacao,
  );
  const [expanded, setExpanded] = useState(false);

  // Só faz sentido mostrar diferenças quando há 2+ execuções no dia
  if (!dataDisponibilizacao) return null;
  if (isLoading) return null;
  if (!execs || execs.length < 2) return null;

  return (
    <Card className="border-indigo-200 dark:border-indigo-900 bg-gradient-to-br from-indigo-50/70 to-purple-50/40 dark:from-indigo-950/30 dark:to-purple-950/20">
      <CardHeader
        className="pb-2 px-3 md:px-6 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="text-sm md:text-base flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Execuções do dia{" "}
          <span className="text-muted-foreground font-normal">
            ({new Date(dataDisponibilizacao + "T12:00:00").toLocaleDateString("pt-BR")})
          </span>
          <Badge variant="outline" className="text-[10px] ml-1">
            {execs.length}
          </Badge>
          {execucaoSelecionadaId && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7"
              onClick={(e) => {
                e.stopPropagation();
                onSelecionarExecucao(null);
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Limpar filtro
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      {expanded && (
      <CardContent className="px-3 md:px-6 pb-3 md:pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {execs.map((e) => {
            const selecionada = execucaoSelecionadaId === e.id;
            return (
              <div
                key={e.id}
                className={`rounded-lg border p-3 transition-colors ${
                  selecionada
                    ? "border-indigo-500 bg-indigo-100/70 dark:bg-indigo-950/40"
                    : "border-border bg-background/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {fmtHora(e.started_at)}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {rotuloEngine(e.tipoEngine)}
                    </Badge>
                    {e.parcial && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-700 dark:text-amber-300"
                        title={`Rodada parcial: ${e.unidadesNaoColetadas || 0} unidade(s) ficaram sem coleta (rate limit do DJEN). O total abaixo está incompleto.`}
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        parcial
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.totalVistas} {e.totalVistas === 1 ? "publicação" : "publicações"}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {e.primeiraDoDia ? (
                    <span className="text-xs text-muted-foreground italic">
                      1ª execução do dia
                    </span>
                  ) : (
                    <span className="text-xs">
                      <strong
                        className={
                          e.novasCount > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }
                      >
                        {e.novasCount}
                      </strong>{" "}
                      nova{e.novasCount === 1 ? "" : "s"} vs. anterior
                    </span>
                  )}
                  {!e.primeiraDoDia && e.novasCount > 0 && (
                    <Button
                      size="sm"
                      variant={selecionada ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => onSelecionarExecucao(selecionada ? null : e)}
                    >
                      <ListFilter className="h-3 w-3 mr-1" />
                      {selecionada ? "Filtrando" : `Ver ${e.novasCount}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      )}
    </Card>
  );
}
