import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, BookOpen, MapPin, Gavel, Clock, Map } from "lucide-react";
import type { FiltrosInteligencia } from "./OfensoresTendencias";

interface Linha { nome?: string; vara?: string; uf?: string; juiz?: string; oab?: string; qtd: number; ganhos: number; perdidos: number; acordos?: number }
interface Dados {
  processos_com_judit: number; processos_base: number;
  advogados: Linha[]; assuntos: Linha[]; varas: Linha[]; ufs: Linha[]; juizes: Linha[];
  tempo: { amostra: number; media_dias_ate_tst: number | null; mediana_dias_ate_tst: number | null } | null;
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

function Tabela({ titulo, icone, itens, rotulo, acordo }: { titulo: string; icone: React.ReactNode; itens: Linha[]; rotulo: (l: Linha) => string; acordo?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2">{icone}{titulo}</CardTitle></CardHeader>
      <CardContent className="max-h-80 overflow-auto">
        {itens.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">Sem dados</div> : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground sticky top-0 bg-card">
              <tr><th className="text-left py-1">Nome</th><th>Qtd</th><th>Êxito</th>{acordo && <th>Acordo</th>}</tr>
            </thead>
            <tbody>
              {itens.map((l, i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className="py-1 pr-2 max-w-[260px] truncate" title={rotulo(l)}>{rotulo(l)}</td>
                  <td className="text-center font-medium">{l.qtd}</td>
                  <td className="text-center">{pct(l.ganhos, l.ganhos + l.perdidos)}</td>
                  {acordo && <td className="text-center">{pct(l.acordos ?? 0, l.qtd)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export default function InsightsJudit({ filtros }: { filtros: FiltrosInteligencia }) {
  const { data, isLoading } = useQuery({
    queryKey: ["inteligencia-judit", filtros.coordenacaoId, filtros.equipe],
    staleTime: 300000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_inteligencia_judit", {
        p_coordenacao_id: filtros.coordenacaoId, p_equipe: filtros.equipe,
      });
      if (error) throw error;
      return data as Dados;
    },
  });

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  const t = data.tempo;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Dados da Judit</h2>
        <p className="text-xs text-muted-foreground">
          Calculado sobre {data.processos_com_judit.toLocaleString("pt-BR")} processos já consultados na Judit
          (de {data.processos_base.toLocaleString("pt-BR")} na Distribuição TST com os filtros de coordenação/equipe). Êxito = ganhos ÷ (ganhos + perdidos).
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Tempo médio até remessa ao TST</div>
          <div className="text-2xl font-bold">{t?.media_dias_ate_tst != null ? `${t.media_dias_ate_tst} dias` : "—"}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Mediana até remessa ao TST</div>
          <div className="text-2xl font-bold">{t?.mediana_dias_ate_tst != null ? `${t.mediana_dias_ate_tst} dias` : "—"}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Processos com a remessa identificada</div>
          <div className="text-2xl font-bold">{t?.amostra ?? 0}</div></CardContent></Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Tabela titulo="Advogados adversários" icone={<Scale className="h-4 w-4" />} itens={data.advogados} acordo rotulo={(l) => `${l.nome}${l.oab ? ` (OAB ${l.oab})` : ""}`} />
        <Tabela titulo="Assuntos oficiais (CNJ)" icone={<BookOpen className="h-4 w-4" />} itens={data.assuntos} acordo rotulo={(l) => l.nome ?? ""} />
        <Tabela titulo="Varas de origem" icone={<MapPin className="h-4 w-4" />} itens={data.varas} rotulo={(l) => `${l.vara}${l.uf ? ` · ${l.uf}` : ""}`} />
        <Tabela titulo="Estados" icone={<Map className="h-4 w-4" />} itens={data.ufs} rotulo={(l) => l.uf ?? ""} />
        <Tabela titulo="Juízes de 1º grau" icone={<Gavel className="h-4 w-4" />} itens={data.juizes} rotulo={(l) => l.juiz ?? ""} />
      </div>
    </div>
  );
}
