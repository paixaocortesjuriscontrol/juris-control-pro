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

type Linha = { uid: string; nome: string; criados: number; atribuidos: number; concluidos: number; noPrazo: number; pendentes: number; atrasados: number };

interface Props {
  inicio: string;
  fim: string;
  coordenacaoId: string | null;
  usuarioId: string | null;
}

export function RankingCriadosSistema({ inicio, fim, coordenacaoId, usuarioId }: Props) {
  const [tipo, setTipo] = useState<"todos" | Tipo>("todos");

  const q = useQuery({
    queryKey: ["ranking-criados-sistema", inicio, fim, coordenacaoId],
    queryFn: async () => {
      const itens: Item[] = [];
      const fimExcl = new Date(fim + "T00:00:00");
      fimExcl.setDate(fimExcl.getDate() + 1);
      for (let from = 0; ; from += 1000) {
        let qb = supabase
          .from("tarefas")
          .select("id, criado_por, responsavel_id, status, tipo_tarefa, data_fatal, data_vencimento, data_prevista, data_cumprimento")
          .or(`origem.is.null,origem.in.(${ORIGENS_SISTEMA.join(",")})`)
          .gte("created_at", inicio)
          .lt("created_at", fimExcl.toISOString().slice(0, 10))
          .order("id")
          .range(from, from + 999);
        if (coordenacaoId) qb = qb.eq("coordenacao_id", coordenacaoId);
        const { data, error } = await qb;
        if (error) throw error;
        (data || []).forEach((t: any) =>
          itens.push({
            id: t.id,
            criado_por: t.criado_por,
            responsavel_id: t.responsavel_id,
            status: String(t.status),
            tipo: tipoDe(t.tipo_tarefa),
            prazo: t.data_fatal || t.data_vencimento || t.data_prevista || null,
            data_cumprimento: t.data_cumprimento,
          })
        );
        if (!data || data.length < 1000) break;
      }
      // corresponsáveis
      const resp = new Map<string, Set<string>>();
      itens.forEach((i) => resp.set(i.id, new Set(i.responsavel_id ? [i.responsavel_id] : [])));
      const ids = itens.map((i) => i.id);
      for (let k = 0; k < ids.length; k += 200) {
        const { data } = await supabase.from("tarefa_responsaveis").select("tarefa_id, usuario_id").in("tarefa_id", ids.slice(k, k + 200));
        (data || []).forEach((r: any) => resp.get(r.tarefa_id)?.add(r.usuario_id));
      }
      const uids = new Set<string>();
      itens.forEach((i) => { if (i.criado_por) uids.add(i.criado_por); resp.get(i.id)?.forEach((u) => uids.add(u)); });
      const nomes = new Map<string, string>();
      const arr = Array.from(uids);
      for (let k = 0; k < arr.length; k += 200) {
        const { data } = await supabase.from("profiles_basic" as any).select("id, nome").in("id", arr.slice(k, k + 200));
        ((data || []) as any[]).forEach((p) => nomes.set(p.id, p.nome || "Sem nome"));
      }
      return { itens, resp: Array.from(resp.entries()).map(([k, v]) => [k, Array.from(v)] as const), nomes: Array.from(nomes.entries()) };
    },
  });

  const linhas = useMemo<Linha[]>(() => {
    if (!q.data) return [];
    const resp = new Map(q.data.resp);
    const nomes = new Map(q.data.nomes);
    const hoje = new Date().toISOString().slice(0, 10);
    const m = new Map<string, Linha>();
    const get = (uid: string) => {
      let l = m.get(uid);
      if (!l) { l = { uid, nome: nomes.get(uid) || "Sem nome", criados: 0, atribuidos: 0, concluidos: 0, noPrazo: 0, pendentes: 0, atrasados: 0 }; m.set(uid, l); }
      return l;
    };
    q.data.itens.filter((i) => tipo === "todos" || i.tipo === tipo).forEach((i) => {
      if (i.criado_por) get(i.criado_por).criados++;
      (resp.get(i.id) || []).forEach((u) => {
        const l = get(u);
        l.atribuidos++;
        if (CONCLUIDOS.includes(i.status)) {
          l.concluidos++;
          if (i.prazo && i.data_cumprimento && i.data_cumprimento.slice(0, 10) <= i.prazo) l.noPrazo++;
        } else if (!ENCERRADOS.includes(i.status)) {
          l.pendentes++;
          if (i.prazo && i.prazo < hoje) l.atrasados++;
        }
      });
    });
    return Array.from(m.values())
      .filter((l) => !usuarioId || l.uid === usuarioId)
      .sort((a, b) => b.concluidos - a.concluidos || b.criados - a.criados);
  }, [q.data, tipo, usuarioId]);

  const tot = linhas.reduce((s, l) => ({ c: s.c + l.criados, k: s.k + l.concluidos, p: s.p + l.pendentes, a: s.a + l.atrasados }), { c: 0, k: 0, p: 0, a: 0 });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground">
          Considera somente itens cadastrados dentro do sistema no período (manualmente, pela Análise DJEN, por fluxos ou pela IA). Itens vindos de importações, planilhas, Projuris e Astrea ficam de fora.
        </CardContent>
      </Card>

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
              <CardDescription>Ordenado por itens concluídos. "Criou" conta quem cadastrou; as demais colunas contam responsáveis e corresponsáveis.</CardDescription>
            </CardHeader>
            <CardContent>
              {q.isLoading ? <Skeleton className="h-40 w-full" /> : q.error ? (
                <p className="text-sm text-destructive">Não foi possível carregar o ranking. Atualize a página.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead><TableHead>Profissional</TableHead>
                      <TableHead className="text-right">Criou</TableHead><TableHead className="text-right">Atribuídos</TableHead>
                      <TableHead className="text-right">Concluídos</TableHead><TableHead className="text-right">No prazo</TableHead>
                      <TableHead className="text-right">Pendentes</TableHead><TableHead className="text-right">Atrasados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum item criado no sistema no período.</TableCell></TableRow>}
                    {linhas.map((l, i) => (
                      <TableRow key={l.uid}>
                        <TableCell>{i < 3 ? <span className="inline-flex items-center gap-1"><Medal className="w-4 h-4 text-primary" />{i + 1}</span> : i + 1}</TableCell>
                        <TableCell>{l.nome}</TableCell>
                        <TableCell className="text-right">{l.criados}</TableCell>
                        <TableCell className="text-right">{l.atribuidos}</TableCell>
                        <TableCell className="text-right font-semibold">{l.concluidos}</TableCell>
                        <TableCell className="text-right">{l.noPrazo}</TableCell>
                        <TableCell className="text-right">{l.pendentes}</TableCell>
                        <TableCell className="text-right text-destructive">{l.atrasados}</TableCell>
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
