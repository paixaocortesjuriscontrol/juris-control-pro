import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "@/hooks/useDistribuicoesTst";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const LARGE_IDS_THRESHOLD = 1000;

async function calcularResultadoChunked(filters: DistribuicaoTstFilters): Promise<Resultado> {
  const ids = await fetchAllDistribuicaoTstIds(filters);
  if (ids.length === 0) {
    return { total: 0, periodoInicio: null, periodoFim: null, principais: [], transversais: [] };
  }

  let total = 0;
  let prontosEnvio = 0;
  let aFazer = 0;
  let transito = 0;
  let outroEscritorio = 0;
  let segredoJustica = 0;
  let acordo = 0;
  let cejusc = 0;
  let midiaNegativa = 0;
  let recursoTerceiro = 0;
  let periodoInicio: string | null = null;
  let periodoFim: string | null = null;

  const PAGE = 500;
  for (let i = 0; i < ids.length; i += PAGE) {
    const batch = ids.slice(i, i + PAGE);
    const { data, error } = await supabase
      .from("dados_benner" as any)
      .select("id, transito_julgado, processo_outro_escritorio, segredo_justica, status, acordo, cejusc, midia_negativa, recurso_terceiro, data_distribuicao_real, data_distribuicao_planilha")
      .in("id", batch);
    if (error) throw error;
    for (const row of (data as any[]) || []) {
      total += 1;
      const status = String(row.status || "");
      const dataBase = row.data_distribuicao_real || row.data_distribuicao_planilha || null;
      if (dataBase && (!periodoInicio || dataBase < periodoInicio)) periodoInicio = dataBase;
      if (dataBase && (!periodoFim || dataBase > periodoFim)) periodoFim = dataBase;
      const concluido = status === "pronto_envio" || status === "planilhado" || status === "enviado";
      if (concluido) prontosEnvio += 1;
      if (
        row.transito_julgado !== true &&
        row.processo_outro_escritorio !== true &&
        row.segredo_justica !== true &&
        !concluido
      ) aFazer += 1;
      if (row.transito_julgado === true) transito += 1;
      if (row.processo_outro_escritorio === true) outroEscritorio += 1;
      if (row.segredo_justica === true) segredoJustica += 1;
      if (row.acordo === true || String(row.acordo || "").trim().toLowerCase() === "sim") acordo += 1;
      if (row.cejusc === true) cejusc += 1;
      const midia = String(row.midia_negativa || "").trim().toLowerCase();
      if (midia && midia !== "não" && midia !== "nao") midiaNegativa += 1;
      if (row.recurso_terceiro === true) recursoTerceiro += 1;
    }
  }

  return {
    total,
    periodoInicio,
    periodoFim,
    principais: [
      { situacao: "Completos/Prontos para enviar", quantidade: prontosEnvio },
      { situacao: "A Fazer", quantidade: aFazer },
      { situacao: "Trânsito em julgado", quantidade: transito },
      { situacao: "Outro escritório", quantidade: outroEscritorio },
      { situacao: "Segredo de justiça", quantidade: segredoJustica },
    ],
    transversais: [
      { situacao: "Acordo", quantidade: acordo, transversal: true },
      { situacao: "CEJUSC", quantidade: cejusc, transversal: true },
      { situacao: "Mídia negativa", quantidade: midiaNegativa, transversal: true },
      { situacao: "Recurso de terceiro", quantidade: recursoTerceiro, transversal: true },
    ],
  };
}

export function TotalPorSituacaoCard({ filters, filtrosResumo, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    (async () => {
      setLoading(true);
      setResultado(null);
      try {
        if ((filters.idsAllowed?.length || 0) > LARGE_IDS_THRESHOLD) {
          const result = await calcularResultadoChunked(filters);
          if (!abortRef.current) setResultado(result);
          return;
        }

        const { data, error } = await supabase.rpc(
          "get_distribuicao_tst_situacao_totais" as any,
          { filters: filters as any },
        );
        if (abortRef.current) return;
        if (error) throw error;
        const row: any = Array.isArray(data) ? data[0] : data;
        const total = Number(row?.total) || 0;
        const principais: SituacaoRow[] = [
          { situacao: "Completos/Prontos para enviar", quantidade: Number(row?.prontos_envio) || 0 },
          { situacao: "A Fazer", quantidade: Number(row?.a_fazer) || 0 },
          { situacao: "Trânsito em julgado", quantidade: Number(row?.transito_julgado) || 0 },
          { situacao: "Outro escritório", quantidade: Number(row?.outro_escritorio) || 0 },
          { situacao: "Segredo de justiça", quantidade: Number(row?.segredo_justica) || 0 },
        ];
        const transversais: SituacaoRow[] = [
          { situacao: "Acordo", quantidade: Number(row?.acordo) || 0, transversal: true },
          { situacao: "CEJUSC", quantidade: Number(row?.cejusc) || 0, transversal: true },
          { situacao: "Mídia negativa", quantidade: Number(row?.midia_negativa) || 0, transversal: true },
          { situacao: "Recurso de terceiro", quantidade: Number(row?.recurso_terceiro) || 0, transversal: true },
        ];

        setResultado({
          total,
          periodoInicio: row?.periodo_inicio || null,
          periodoFim: row?.periodo_fim || null,
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Calculando totais...
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