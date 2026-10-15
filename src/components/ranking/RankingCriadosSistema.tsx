import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Medal } from "lucide-react";

/** Origens de itens criados dentro do sistema (sem importações/planilhas/migrações). */
const ORIGENS_SISTEMA = ["analise_djen", "workflow", "ia_djen", "publicacao"];
const CONCLUIDOS = ["cumprido", "tratado", "protocolado", "baixado", "verificado", "concluido_sem_sucesso"];
const ENCERRADOS = [...CONCLUIDOS, "cancelado", "cancelado_oculto", "minutado_revisao"];

type Tipo = "prazo" | "tarefa" | "audiencia" | "evento" | "parcelamento";
const tipoDe = (t: string | null): Tipo => {
  const v = (t || "").toLowerCase();
  if (v.startsWith("audi")) return "audiencia";
  if (v.startsWith("prazo")) return "prazo";
  if (v.startsWith("evento")) return "evento";
  if (v.startsWith("parcel")) return "parcelamento";
  return "tarefa";
};

type Item = {
  id: string;
  criado_por: string | null;
  responsavel_id: string | null;
  status: string;
  tipo: Tipo;
  prazo: string | null;
  data_cumprimento: string | null;
};

const pct = (l: { bNoPrazo: number; bAtraso: number }) => { const t = l.bNoPrazo + l.bAtraso; return t ? Math.round((l.bNoPrazo / t) * 100) : 0; };

type Linha = { uid: string; nome: string; criados: number; atribuidos: number; concluidos: number; baixou: number; bNoPrazo: number; bAtraso: number; noPrazo: number; pendentes: number; atrasados: number };

interface Props {
  inicio: string;
  fim: string;
  coordenacaoId: string | null;
  usuarioId: string | null;
}

export function RankingCriadosSistema({ inicio, fim, coordenacaoId, usuarioId }: Props) {
  const [tipo, setTipo] = useState<"todos" | Tipo>("todos");
  const [visao, setVisao] = useState<"geral" | "produtividade" | "pontualidade">("geral");

  const q = useQuery({
    queryKey: ["ranking-criados-sistema", inicio, fim, coordenacaoId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_ranking_criados_sistema", {
        p_inicio: inicio, p_fim: fim, p_coordenacao_id: coordenacaoId || null,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const linhas = useMemo<Linha[]>(() => {
    if (!q.data) return [];
    const m = new Map<string, Linha>();
    q.data.filter((r) => tipo === "todos" || r.tipo === tipo).forEach((r) => {
      let l = m.get(r.uid);
      if (!l) { l = { uid: r.uid, nome: r.nome || "Sem nome", criados: 0, atribuidos: 0, concluidos: 0, baixou: 0, bNoPrazo: 0, bAtraso: 0, noPrazo: 0, pendentes: 0, atrasados: 0 }; m.set(r.uid, l); }
      l.criados += r.criados; l.atribuidos += r.atribuidos; l.concluidos += r.concluidos; l.noPrazo += r.no_prazo;
      l.pendentes += r.pendentes; l.atrasados += r.atrasados; l.baixou += r.baixou; l.bNoPrazo += r.b_no_prazo; l.bAtraso += r.b_atraso;
    });
    return Array.from(m.values())
      .filter((l) => !usuarioId || l.uid === usuarioId)
      .filter((l) => visao !== "pontualidade" || l.bNoPrazo + l.bAtraso > 0)
      .sort((a, b) => {
        if (visao === "pontualidade") return pct(b) - pct(a) || b.bNoPrazo - a.bNoPrazo;
        if (visao === "produtividade") return b.baixou + b.criados - (a.baixou + a.criados) || b.baixou - a.baixou;
        return b.baixou - a.baixou || b.concluidos - a.concluidos || b.criados - a.criados;
      });
  }, [q.data, tipo, usuarioId, visao]);

  const tot = linhas.reduce((s, l) => ({ c: s.c + l.criados, k: s.k + l.baixou, p: s.p + l.pendentes, a: s.a + l.atrasados }), { c: 0, k: 0, p: 0, a: 0 });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground">
          Considera somente itens cadastrados dentro do sistema no período (manualmente, pela Análise DJEN, por fluxos ou pela IA). Itens vindos de importações, planilhas, Projuris e Astrea ficam de fora.
        </CardContent>
      </Card>

      <Tabs value={visao} onValueChange={(v) => setVisao(v as any)}>
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="produtividade">Produtividade</TabsTrigger>
          <TabsTrigger value="pontualidade">Pontualidade</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="prazo">Prazos</TabsTrigger>
          <TabsTrigger value="tarefa">Tarefas</TabsTrigger>
          <TabsTrigger value="audiencia">Audiências</TabsTrigger>
          <TabsTrigger value="evento">Eventos</TabsTrigger>
          <TabsTrigger value="parcelamento">Parcelamentos</TabsTrigger>
        </TabsList>
        <TabsContent value={tipo} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["Criados no sistema", tot.c], ["Concluídos", tot.k], ["Pendentes", tot.p], ["Atrasados", tot.a]].map(([l, v]) => (
              <Card key={l as string}><CardContent className="py-4"><div className="text-xs uppercase text-muted-foreground">{l}</div><div className="text-2xl font-semibold">{v}</div></CardContent></Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Ranking — criados no sistema</CardTitle>
              <CardDescription>{visao === "produtividade" ? "Ordenado pelo total produzido: itens que a pessoa cadastrou mais itens a que ela deu baixa." : visao === "pontualidade" ? "Ordenado pelo percentual de baixas feitas até a data do prazo, creditadas a quem deu a baixa." : null} {visao === "geral" && <>Ordenado por "Deu baixa" (quem realmente baixou o item, pelo registro de alterações). "Criou" conta quem cadastrou; "Atribuídos", "Concluídos (como responsável)", pendentes e atrasados contam responsáveis e corresponsáveis.</>}</CardDescription>
            </CardHeader>
            <CardContent>
              {q.isLoading ? <Skeleton className="h-40 w-full" /> : q.error ? (
                <p className="text-sm text-destructive">Não foi possível carregar o ranking. Atualize a página.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead><TableHead>Profissional</TableHead>
                      {visao === "geral" && <>
                        <TableHead className="text-right">Criou</TableHead><TableHead className="text-right">Atribuídos</TableHead>
                        <TableHead className="text-right">Deu baixa</TableHead><TableHead className="text-right">Concluídos (como responsável)</TableHead><TableHead className="text-right">No prazo</TableHead>
                        <TableHead className="text-right">Pendentes</TableHead><TableHead className="text-right">Atrasados</TableHead>
                      </>}
                      {visao === "produtividade" && <>
                        <TableHead className="text-right">Criou</TableHead><TableHead className="text-right">Deu baixa</TableHead>
                        <TableHead className="text-right">Total produzido</TableHead><TableHead className="text-right">Pendentes</TableHead>
                      </>}
                      {visao === "pontualidade" && <>
                        <TableHead className="text-right">Baixas com prazo</TableHead><TableHead className="text-right">No prazo</TableHead>
                        <TableHead className="text-right">Com atraso</TableHead><TableHead className="text-right">% no prazo</TableHead>
                      </>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nenhum item criado no sistema no período.</TableCell></TableRow>}
                    {linhas.map((l, i) => (
                      <TableRow key={l.uid}>
                        <TableCell>{i < 3 ? <span className="inline-flex items-center gap-1"><Medal className="w-4 h-4 text-primary" />{i + 1}</span> : i + 1}</TableCell>
                        <TableCell>{l.nome}</TableCell>
                        {visao === "geral" && <>
                          <TableCell className="text-right">{l.criados}</TableCell>
                          <TableCell className="text-right">{l.atribuidos}</TableCell>
                          <TableCell className="text-right font-semibold">{l.baixou}</TableCell>
                          <TableCell className="text-right">{l.concluidos}</TableCell>
                          <TableCell className="text-right">{l.noPrazo}</TableCell>
                          <TableCell className="text-right">{l.pendentes}</TableCell>
                          <TableCell className="text-right text-destructive">{l.atrasados}</TableCell>
                        </>}
                        {visao === "produtividade" && <>
                          <TableCell className="text-right">{l.criados}</TableCell>
                          <TableCell className="text-right">{l.baixou}</TableCell>
                          <TableCell className="text-right font-semibold">{l.criados + l.baixou}</TableCell>
                          <TableCell className="text-right">{l.pendentes}</TableCell>
                        </>}
                        {visao === "pontualidade" && <>
                          <TableCell className="text-right">{l.bNoPrazo + l.bAtraso}</TableCell>
                          <TableCell className="text-right">{l.bNoPrazo}</TableCell>
                          <TableCell className="text-right text-destructive">{l.bAtraso}</TableCell>
                          <TableCell className="text-right font-semibold">{pct(l)}%</TableCell>
                        </>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
