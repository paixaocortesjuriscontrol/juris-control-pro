import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  Shield,
  Clock,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useExecucoesDoDiaPorCoordenacao,
  type TipoEngineLocal,
} from "@/hooks/useExecucoesDoDiaPorCoordenacao";

interface Props {
  dataYmd: string | null | undefined;
}

function fmtHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return "--:--";
  }
}

function rotuloEngine(t: TipoEngineLocal): string {
  if (t === "kurier") return "Kurier";
  if (t === "processos") return "Processos";
  if (t === "servidor-termos") return "Servidor · Termos";
  if (t === "servidor-pautas") return "Servidor · Pautas";
  if (t === "stf") return "Servidor · STF";
  return "Termos";
}

export function ExecucoesDoDiaAdminCard({ dataYmd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useExecucoesDoDiaPorCoordenacao(dataYmd);

  if (!dataYmd) return null;
  if (isLoading) return null;
  if (!data || data.execucoes.length < 2) return null;

  const { execucoes, linhas } = data;

  // Totais por execução (rodapé)
  const totaisPorExec = execucoes.map((e) => {
    let total = 0;
    let novas = 0;
    for (const l of linhas) {
      const c = l.celulas.find((x) => x.execId === e.id);
      if (c) {
        total += c.total;
        novas += c.novas;
      }
    }
    return { execId: e.id, total, novas };
  });

  return (
    <Card className="border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20">
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
          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          Execuções do dia por coordenação
          <span className="text-muted-foreground font-normal">
            ({new Date(dataYmd + "T12:00:00").toLocaleDateString("pt-BR")})
          </span>
          <Badge variant="outline" className="text-[10px] ml-1">
            {execucoes.length} execuções
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] ml-1 border-amber-500/40 text-amber-700 dark:text-amber-300"
          >
            <Shield className="h-3 w-3 mr-1" /> admin
          </Badge>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="px-3 md:px-6 pb-3 md:pb-4">
          {linhas.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhuma publicação encontrada nas execuções deste dia.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Coordenação</TableHead>
                    {execucoes.map((e) => (
                      <TableHead key={e.id} className="text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 text-xs font-medium">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {fmtHora(e.iniciado_em)}
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 mt-1"
                        >
                          {rotuloEngine(e.tipoEngine)}
                        </Badge>
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l) => (
                    <TableRow key={l.coordenacaoId}>
                      <TableCell className="font-medium text-sm">
                        {l.nome}
                      </TableCell>
                      {l.celulas.map((c, idx) => {
                        const isFirstNonZero =
                          idx === l.celulas.findIndex((x) => x.total > 0);
                        return (
                          <TableCell
                            key={c.execId}
                            className="text-center whitespace-nowrap text-sm"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-foreground">{c.total}</span>
                              {!isFirstNonZero && c.novas > 0 && (
                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                  +{c.novas}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center text-sm font-semibold">
                        {l.totalGeral}
                        {l.novasGeral > 0 && (
                          <span className="ml-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                            (+{l.novasGeral})
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold text-sm">Totais</TableCell>
                    {totaisPorExec.map((t, idx) => (
                      <TableCell
                        key={t.execId}
                        className="text-center text-sm font-semibold"
                      >
                        {t.total}
                        {idx > 0 && t.novas > 0 && (
                          <span className="ml-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                            +{t.novas}
                          </span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-center text-sm font-semibold">
                      {totaisPorExec.reduce((a, t) => a + t.total, 0)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              <p className="text-[11px] text-muted-foreground mt-2">
                <strong className="text-emerald-700 dark:text-emerald-400">+N</strong>{" "}
                = publicações vistas pela 1ª vez naquela execução, dentro da
                coordenação (comparado às execuções anteriores do mesmo dia).
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}