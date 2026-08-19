import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  Shield,
  Clock,
  AlertTriangle,
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
  type ExecucaoResumo,
} from "@/hooks/useExecucoesDoDiaPorCoordenacao";
import { useFalhasDoDiaPorTribunal } from "@/hooks/useFalhasDoDiaPorTribunal";

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

/** Texto do tooltip do badge "parcial": diz qual tribunal ficou de fora e por quê. */
function detalheParcial(e: ExecucaoResumo): string {
  const partes: string[] = [
    `Rodada parcial: ${e.unidadesNaoColetadas || 0} unidade(s) (tribunal × monitoramento) ficaram sem coleta.`,
  ];
  const falhas = e.falhasPorTribunal || [];
  if (falhas.length > 0) {
    partes.push(
      "Tribunais pendentes: " +
        falhas
          .map((f) => {
            const det: string[] = [];
            if (f.unidades) det.push(`${f.unidades} unid.`);
            if (f.abandonadas) det.push(`${f.abandonadas} abandonada(s)`);
            if (f.ultimo_erro) det.push(f.ultimo_erro.slice(0, 80));
            return `${f.tribunal}${det.length ? ` (${det.join(", ")})` : ""}`;
          })
          .join(" · "),
    );
  }
  const d = e.diagnostico;
  if (d) {
    const tec: string[] = [];
    if (d.erros_5xx) tec.push(`${d.erros_5xx} erro(s) 5xx`);
    if (d.rate_limit_429) tec.push(`${d.rate_limit_429} rate limit (429)`);
    if (tec.length) partes.push(tec.join(" · "));
    if (d.topTribunais && d.topTribunais.length > 0) {
      partes.push(
        "Tempo por tribunal: " +
          d.topTribunais.map((t) => `${t.tribunal} ${t.segundos}s`).join(" · "),
      );
    }
  }
  partes.push("Os números desta coluna podem estar incompletos.");
  return partes.join("\n");
}

export function ExecucoesDoDiaAdminCard({ dataYmd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useExecucoesDoDiaPorCoordenacao(dataYmd);
  const { data: falhas } = useFalhasDoDiaPorTribunal(dataYmd);

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
          {falhas && falhas.length > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] ml-1 border-destructive/40 text-destructive"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              {falhas.reduce((a, f) => a + f.total, 0)} falhas
            </Badge>
          )}
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
          {falhas && falhas.length > 0 && (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Falhas de captura por tribunal
              </div>
              <div className="flex flex-wrap gap-1.5">
                {falhas.map((f) => (
                  <Badge
                    key={f.tribunal}
                    variant="outline"
                    className="text-[11px] font-normal border-destructive/30"
                    title={f.ultimoErro || undefined}
                  >
                    <span className="font-semibold mr-1">{f.tribunal}</span>
                    {f.pendentes > 0 && <span>{f.pendentes} pend.</span>}
                    {f.abandonadas > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        {f.abandonadas} abandon.
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}
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
                        {e.parcial && (
                          <div
                            className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                            title={detalheParcial(e)}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            parcial
                            {e.unidadesNaoColetadas
                              ? ` (${e.unidadesNaoColetadas})`
                              : ""}
                            {e.falhasPorTribunal && e.falhasPorTribunal.length > 0 && (
                              <span className="font-semibold">
                                · {e.falhasPorTribunal.map((f) => f.tribunal).slice(0, 2).join(", ")}
                              </span>
                            )}
                          </div>
                        )}
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