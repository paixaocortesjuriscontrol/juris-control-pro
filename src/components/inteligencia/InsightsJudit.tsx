import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scale, BookOpen, MapPin, Gavel, Clock, Map, Users } from "lucide-react";
import type { FiltrosInteligencia } from "./OfensoresTendencias";

interface Linha {
  nome?: string; vara?: string; uf?: string; juiz?: string; oab?: string;
  qtd: number; ganhos: number; perdidos: number; acordos?: number;
}
interface Dados {
  processos_com_judit: number; processos_base: number;
  advogados: Linha[]; assuntos: Linha[]; varas: Linha[]; ufs: Linha[]; juizes: Linha[];
  tempo: { amostra: number; media_dias_ate_tst: number | null; mediana_dias_ate_tst: number | null } | null;
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

const linhasValidas = (itens: Linha[] | undefined, rotulo: (linha: Linha) => string) =>
  (Array.isArray(itens) ? itens : []).filter((linha) => {
    if (!linha || typeof linha !== "object") return false;
    const nome = rotulo(linha).trim();
    return nome !== "" && nome !== "undefined" && Number.isFinite(Number(linha.qtd));
  });

function Tabela({ itens, rotulo, acordo }: { itens: Linha[]; rotulo: (l: Linha) => string; acordo?: boolean }) {
  const linhas = linhasValidas(itens, rotulo);
  return (
    <div className="overflow-auto max-h-[420px]">
      {linhas.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Sem dados</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground sticky top-0 bg-card">
            <tr>
              <th className="text-left py-1">Nome</th>
              <th className="text-center">Qtd</th>
              <th className="text-center">Êxito</th>
              {acordo && <th className="text-center">Acordo</th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={`${rotulo(l)}-${i}`} className="border-t border-border/50">
                <td className="py-1 pr-2 max-w-[280px] truncate" title={rotulo(l)}>{rotulo(l)}</td>
                <td className="text-center font-medium">{l.qtd}</td>
                <td className="text-center">{pct(l.ganhos, l.ganhos + l.perdidos)}</td>
                {acordo && <td className="text-center">{pct(l.acordos ?? 0, l.qtd)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function InsightsJudit({ filtros }: { filtros: FiltrosInteligencia }) {
  const [ativo, setAtivo] = useState(false);
  const { data, isLoading, error } = useQuery({
    enabled: ativo,
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

  if (!ativo) return (
    <Card><CardContent className="py-6 flex items-center justify-between gap-4">
      <div><div className="font-semibold">Análise dos dados da Judit</div>
        <div className="text-xs text-muted-foreground">Advogados adversários, assuntos oficiais, varas, estados, juízes e tempo até o TST.</div></div>
      <Button onClick={() => setAtivo(true)}>Carregar análise</Button>
    </CardContent></Card>
  );
  if (error) return (
    <Card><CardContent className="py-6 text-sm text-destructive">
      Não foi possível carregar a análise da Judit. <Button variant="link" onClick={() => location.reload()}>Tentar de novo</Button>
    </CardContent></Card>
  );
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  const t = data.tempo;
  const temAdv = linhasValidas(data.advogados, (l) => l.nome ?? "").length > 0;
  const temAss = linhasValidas(data.assuntos, (l) => l.nome ?? "").length > 0;
  const temVara = linhasValidas(data.varas, (l) => l.vara ?? "").length > 0;
  const temUf = linhasValidas(data.ufs, (l) => l.uf ?? "").length > 0;
  const temJuiz = linhasValidas(data.juizes, (l) => l.juiz ?? "").length > 0;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Dados da Judit</h2>
        <p className="text-xs text-muted-foreground">
          Calculado sobre {data.processos_com_judit.toLocaleString("pt-BR")} processos já consultados na Judit
          (de {data.processos_base.toLocaleString("pt-BR")} na Distribuição TST com os filtros de coordenação/equipe). Êxito = ganhos ÷ (ganhos + perdidos).
        </p>
      </div>

      <Tabs defaultValue="tempo">
        <TabsList className="w-full justify-start flex-wrap h-auto">
          <TabsTrigger value="tempo">
            <Clock className="h-3.5 w-3.5 mr-1" /> Tempo
          </TabsTrigger>
          {temAdv && (
            <TabsTrigger value="advogados">
              <Scale className="h-3.5 w-3.5 mr-1" /> Advogados
            </TabsTrigger>
          )}
          {temAss && (
            <TabsTrigger value="assuntos">
              <BookOpen className="h-3.5 w-3.5 mr-1" /> Assuntos
            </TabsTrigger>
          )}
          {(temVara || temUf) && (
            <TabsTrigger value="regiao">
              <Map className="h-3.5 w-3.5 mr-1" /> Varas e Região
            </TabsTrigger>
          )}
          {temJuiz && (
            <TabsTrigger value="juizes">
              <Gavel className="h-3.5 w-3.5 mr-1" /> Juízes
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tempo de tramitação */}
        <TabsContent value="tempo" className="mt-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Card><CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Tempo médio até remessa ao TST</div>
              <div className="text-2xl font-bold">{t?.media_dias_ate_tst != null ? `${t.media_dias_ate_tst} dias` : "—"}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Mediana até remessa ao TST</div>
              <div className="text-2xl font-bold">{t?.mediana_dias_ate_tst != null ? `${t.mediana_dias_ate_tst} dias` : "—"}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Processos com a remessa identificada</div>
              <div className="text-2xl font-bold">{t?.amostra ?? 0}</div>
            </CardContent></Card>
          </div>
          {t?.amostra === 0 && (
            <p className="text-sm text-muted-foreground mt-3 text-center">
              Nenhum processo teve a remessa ao TST identificada nas movimentações da Judit.
            </p>
          )}
        </TabsContent>

        {/* Advogados adversários */}
        {temAdv && (
          <TabsContent value="advogados" className="mt-3">
            <Card><CardContent className="pt-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Advogados adversários
              </h3>
              <Tabela itens={data.advogados} acordo rotulo={(l) => `${l.nome}${l.oab ? ` (OAB ${l.oab})` : ""}`} />
            </CardContent></Card>
          </TabsContent>
        )}

        {/* Assuntos oficiais */}
        {temAss && (
          <TabsContent value="assuntos" className="mt-3">
            <Card><CardContent className="pt-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Assuntos oficiais (CNJ)
              </h3>
              <Tabela itens={data.assuntos} acordo rotulo={(l) => l.nome ?? ""} />
            </CardContent></Card>
          </TabsContent>
        )}

        {/* Varas e Região */}
        {(temVara || temUf) && (
          <TabsContent value="regiao" className="mt-3">
            <div className="grid gap-3 lg:grid-cols-2">
              {temVara && (
                <Card><CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> Varas de origem
                  </h3>
                  <Tabela itens={data.varas} rotulo={(l) => `${l.vara}${l.uf ? ` · ${l.uf}` : ""}`} />
                </CardContent></Card>
              )}
              {temUf && (
                <Card><CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Map className="h-4 w-4" /> Estados
                  </h3>
                  <Tabela itens={data.ufs} rotulo={(l) => l.uf ?? ""} />
                </CardContent></Card>
              )}
            </div>
          </TabsContent>
        )}

        {/* Juízes */}
        {temJuiz && (
          <TabsContent value="juizes" className="mt-3">
            <Card><CardContent className="pt-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Gavel className="h-4 w-4" /> Juízes de 1º grau
              </h3>
              <Tabela itens={data.juizes} rotulo={(l) => l.juiz ?? ""} />
            </CardContent></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
