import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Handshake } from "lucide-react";
import type { FiltrosInteligencia } from "./OfensoresTendencias";

interface Item {
  id: string; processo: string | null; dossie: string | null; reclamante: string | null; turma: string | null; relator: string | null;
  equipe: string | null; tipo_recurso_reclamante: string | null; prob: number; vezes_media: number; confianca: "alta" | "media" | "baixa";
  valor_causa: number | null; valor_condenacao: number | null; provisionamento_provavel: number | null;
}
interface Dados { taxa_geral: number; total_abertos: number; acordos_historicos: number; itens: Item[] }

const fmtBRL = (v: number | null) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
const confCls = { alta: "border-emerald-500/50", media: "border-amber-500/50", baixa: "border-border" };
const confTxt = { alta: "Alta", media: "Média", baixa: "Baixa" };

export default function OportunidadesAcordo({ filtros }: { filtros: FiltrosInteligencia }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["inteligencia-acordo", JSON.stringify(filtros)],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_inteligencia_oportunidades_acordo", {
        p_coordenacao_id: filtros.coordenacaoId, p_equipe: filtros.equipe, p_tribunal: filtros.tribunal, p_limite: 200,
      });
      if (error) throw error;
      return data as Dados;
    },
    staleTime: 120000,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Handshake className="h-5 w-5 text-primary" />Oportunidades de acordo</h2>
      {isLoading ? <Skeleton className="h-80" /> : error ? (
        <div className="text-sm text-destructive">Não foi possível calcular as oportunidades agora.</div>
      ) : data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {data.total_abertos} processos em aberto analisados · taxa histórica de acordo da base: {data.taxa_geral}% ({data.acordos_historicos} acordos).
              Lista ordenada pela maior propensão e, em empate, pelo maior valor envolvido. É uma sugestão estatística, não uma decisão.
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[560px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground sticky top-0 bg-card">
                <tr>
                  <th className="text-left py-1">Processo / Dossiê</th><th className="text-left">Reclamante</th><th className="text-left">Relator / Turma</th>
                  <th>Propensão</th><th>x média</th><th>Confiança</th><th className="text-right">Valor envolvido</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((i) => (
                  <tr key={i.id} className="border-t border-border/50">
                    <td className="py-1 pr-2"><div className="font-medium">{i.processo || "—"}</div><div className="text-muted-foreground">{i.dossie}</div></td>
                    <td className="pr-2 max-w-[200px] truncate" title={i.reclamante || ""}>{i.reclamante || "—"}</td>
                    <td className="pr-2 max-w-[200px]"><div className="truncate" title={i.relator || ""}>{i.relator || "—"}</div><div className="text-muted-foreground">{i.turma}</div></td>
                    <td className="text-center font-semibold">{i.prob}%</td>
                    <td className="text-center">{i.vezes_media}x</td>
                    <td className="text-center"><Badge variant="outline" className={`text-[10px] font-normal ${confCls[i.confianca]}`}>{confTxt[i.confianca]}</Badge></td>
                    <td className="text-right">{fmtBRL(i.provisionamento_provavel ?? i.valor_condenacao ?? i.valor_causa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
