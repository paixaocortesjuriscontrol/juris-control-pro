import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DistribuicaoTstFilters,
  fetchAllDistribuicaoTstIds,
} from "@/hooks/useDistribuicoesTst";
import {
  getPendencias,
  COLUNAS_SELECT_PENDENCIAS,
} from "@/utils/distribuicaoTstPendencias";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, X, Download, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import {
  gerarRelatorioSituacaoExcel,
  SituacaoRow,
} from "@/lib/relatorioSituacaoDistribuicaoTst";

interface Props {
  filters: DistribuicaoTstFilters;
  filtrosResumo?: string[];
  onClose: () => void;
}

interface Resultado {
  total: number;
  periodoInicio: string | null;
  periodoFim: string | null;
  principais: SituacaoRow[];
  transversais: SituacaoRow[];
}

const BATCH = 500;

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try {
    const dt = new Date(d.length === 10 ? d + "T12:00:00" : d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
};

export function TotalPorSituacaoCard({ filters, filtrosResumo, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    (async () => {
      setLoading(true);
      setResultado(null);
      try {
        const ids = await fetchAllDistribuicaoTstIds(filters);
        if (abortRef.current) return;
        if (!ids || ids.length === 0) {
          setResultado({
            total: 0,
            periodoInicio: null,
            periodoFim: null,
            principais: [],
            transversais: [],
          });
          return;
        }

        const cols = Array.from(
          new Set([
            "id",
            "status",
            "processo_outro_escritorio",
            "segredo_justica",
            "transito_julgado",
            "acordo",
            "cejusc",
            "midia_negativa",
            "recurso_terceiro",
            "data_distribuicao_real",
            "data_distribuicao_planilha",
            ...COLUNAS_SELECT_PENDENCIAS,
          ]),
        ).join(", ");

        let outroEscritorio = 0;
        let segredo = 0;
        let transito = 0;
        let prontos = 0;
        let aFazer = 0;
        let acordoCount = 0;
        let cejuscCount = 0;
        let midiaCount = 0;
        let terceiroCount = 0;
        let minDate: string | null = null;
        let maxDate: string | null = null;

        setProgress({ current: 0, total: ids.length });

        for (let i = 0; i < ids.length; i += BATCH) {
          if (abortRef.current) return;
          const batch = ids.slice(i, i + BATCH);
          const { data, error } = await supabase
            .from("dados_benner" as any)
            .select(cols)
            .in("id", batch);
          if (error) throw error;

          for (const r of (data as any[]) || []) {
            const d = r.data_distribuicao_real || r.data_distribuicao_planilha || null;
            if (d) {
              if (!minDate || d < minDate) minDate = d;
              if (!maxDate || d > maxDate) maxDate = d;
            }

            // Prioridade mutuamente exclusiva:
            if (r.processo_outro_escritorio === true) {
              outroEscritorio++;
            } else if (r.segredo_justica === true) {
              segredo++;
            } else if (r.transito_julgado === true) {
              transito++;
            } else if (r.status === "pronto_envio" && getPendencias(r).length === 0) {
              prontos++;
            } else {
              aFazer++;
            }

            // Cortes transversais (não somam ao total):
            const acordoStr = String(r.acordo ?? "").trim().toLowerCase();
            if (acordoStr === "sim" || r.acordo === true) acordoCount++;
            if (r.cejusc === true) cejuscCount++;
            const mn = String(r.midia_negativa ?? "").trim().toLowerCase();
            if (mn && mn !== "não" && mn !== "nao") midiaCount++;
            if (r.recurso_terceiro === true) terceiroCount++;
          }

          setProgress({ current: Math.min(i + BATCH, ids.length), total: ids.length });
        }

        if (abortRef.current) return;

        const total = ids.length;
        const principais: SituacaoRow[] = [
          { situacao: "Completos/Prontos para enviar", quantidade: prontos },
          { situacao: "A Fazer", quantidade: aFazer },
          { situacao: "Trânsito em julgado", quantidade: transito },
          { situacao: "Outro escritório", quantidade: outroEscritorio },
          { situacao: "Segredo de justiça", quantidade: segredo },
        ];
        const transversais: SituacaoRow[] = [
          { situacao: "Acordo", quantidade: acordoCount, transversal: true },
          { situacao: "CEJUSC", quantidade: cejuscCount, transversal: true },
          { situacao: "Mídia negativa", quantidade: midiaCount, transversal: true },
          { situacao: "Recurso de terceiro", quantidade: terceiroCount, transversal: true },
        ];

        setResultado({
          total,
          periodoInicio: minDate,
          periodoFim: maxDate,
          principais,
          transversais,
        });
      } catch (err: any) {
        toast.error("Erro ao calcular totais: " + (err?.message || String(err)));
        setResultado({
          total: 0,
          periodoInicio: null,
          periodoFim: null,
          principais: [],
          transversais: [],
        });
      } finally {
        if (!abortRef.current) setLoading(false);
      }
    })();
    return () => {
      abortRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const handleExportarExcel = () => {
    if (!resultado) return;
    try {
      const { blob, filename } = gerarRelatorioSituacaoExcel({
        linhas: [...resultado.principais, ...resultado.transversais],
        total: resultado.total,
        periodoInicio: resultado.periodoInicio,
        periodoFim: resultado.periodoFim,
        filtrosResumo,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Planilha gerada.");
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err?.message || String(err)));
    }
  };

  const pct = (n: number) =>
    resultado && resultado.total > 0
      ? `${((n / resultado.total) * 100).toFixed(1)}%`
      : "0,0%";

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Total por Situação
            {resultado && (
              <span className="text-sm text-muted-foreground font-normal">
                — Período: {fmtDate(resultado.periodoInicio)} a {fmtDate(resultado.periodoFim)}
              </span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarExcel}
              disabled={loading || !resultado || resultado.total === 0}
            >
              <Download className="w-4 h-4 mr-2" /> Exportar Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando {progress.current} de {progress.total}...
            </div>
            <Progress
              value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
            />
          </div>
        ) : !resultado || resultado.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum registro encontrado com os filtros atuais.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold">{resultado.total}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {resultado.principais.map((l) => (
                <div
                  key={l.situacao}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>{l.situacao}</span>
                  <span className="font-semibold">
                    {l.quantidade}{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      ({pct(l.quantidade)})
                    </span>
                  </span>
                </div>
              ))}
            </div>

            {resultado.transversais.some((t) => t.quantidade > 0) && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Cortes transversais (não somam ao total):
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {resultado.transversais.map((l) => (
                    <div
                      key={l.situacao}
                      className="flex flex-col rounded-md border border-dashed px-3 py-2 text-sm"
                    >
                      <span className="text-xs text-muted-foreground">{l.situacao}</span>
                      <span className="font-semibold">
                        {l.quantidade}{" "}
                        <span className="text-xs text-muted-foreground font-normal">
                          ({pct(l.quantidade)})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}