import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { format, startOfYear } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LabelList } from "recharts";
import { Trophy, FileDown, Medal, Target, AlertTriangle, CheckCircle2 } from "lucide-react";
import { gerarRankingPdf } from "@/lib/rankingAtendimentoPdf";

const NAVY = "hsl(222 47% 18%)";
const GOLD = "hsl(43 74% 49%)";
const VERDE = "#1fa971";
const VERMELHO = "#f2545b";
const AZUL = "#3b9ae1";

type LinhaGeral = {
  usuario_id: string;
  nome: string;
  abertos_prazos: number;
  abertos_tarefas: number;
  abertos_audiencias: number;
  abertos_eventos: number;
  abertos_parcelamentos: number;
  abertos_total: number;
  concluidos: number;
  concluidos_no_prazo: number;
  concluidos_atraso: number;
  prazos_perdidos: number;
};

type LinhaTst = {
  usuario_id: string;
  nome: string;
  total: number;
  sem_pendencia: number;
  com_pendencia: number;
  pendencias_total: number;
  judit_preenchidos: number;
};

function pct(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

export default function RankingAtendimento() {
  const { user } = useAuth();
  const { isAdmin, coordenacoes } = useCoordenacoesDoUsuario();

  const [inicio, setInicio] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [fim, setFim] = useState(format(new Date(), "yyyy-MM-dd"));
  const [coordenacaoId, setCoordenacaoId] = useState("todas");
  const [usuarioId, setUsuarioId] = useState("todos");
  const [aba, setAba] = useState("geral");

  const { data: roles } = useQuery({
    queryKey: ["ranking-roles", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data || []).map((r: any) => r.role as string);
    },
  });

  const podeVerOutros =
    isAdmin || (roles || []).some((r) => r === "admin" || r === "coordenador" || r === "assistente_coordenador");

  const { data: usuarios } = useQuery({
    queryKey: ["ranking-usuarios", coordenacaoId, coordenacoes.map((c) => c.id).join(",")],
    enabled: podeVerOutros,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const ids = coordenacaoId !== "todas" ? [coordenacaoId] : coordenacoes.map((c) => c.id);
      if (ids.length === 0) return [] as { id: string; nome: string }[];
      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .in("coordenacao_id", ids);
      const { data: coords } = await supabase.from("coordenacoes").select("coordenador_id").in("id", ids);
      const userIds = Array.from(
        new Set(
          [...(membros || []).map((m: any) => m.usuario_id), ...(coords || []).map((c: any) => c.coordenador_id)].filter(
            Boolean
          )
        )
      );
      if (userIds.length === 0) return [] as { id: string; nome: string }[];
      const { data: profs } = await supabase.from("profiles_basic" as any).select("id, nome").in("id", userIds);
      return ((profs || []) as any[])
        .map((p) => ({ id: p.id as string, nome: (p.nome as string) || "Sem nome" }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });

  const filtroParams = {
    p_inicio: inicio,
    p_fim: fim,
    p_coordenacao_id: coordenacaoId === "todas" ? null : coordenacaoId,
    p_usuario_id: !podeVerOutros ? user?.id ?? null : usuarioId === "todos" ? null : usuarioId,
  };

  const geralQuery = useQuery({
    queryKey: ["ranking-geral", filtroParams],
    enabled: !!inicio && !!fim,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ranking_atendimento_geral" as any, filtroParams as any);
      if (error) throw error;
      return (data || []) as unknown as LinhaGeral[];
    },
  });

  const tstQuery = useQuery({
    queryKey: ["ranking-tst", filtroParams],
    enabled: !!inicio && !!fim,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ranking_atendimento_tst" as any, filtroParams as any);
      if (error) throw error;
      return (data || []) as unknown as LinhaTst[];
    },
  });

  const geral = geralQuery.data || [];
  const tst = tstQuery.data || [];

  const totaisGeral = useMemo(() => {
    return geral.reduce(
      (acc, l) => ({
        abertos: acc.abertos + Number(l.abertos_total),
        concluidos: acc.concluidos + Number(l.concluidos),
        noPrazo: acc.noPrazo + Number(l.concluidos_no_prazo),
        perdidos: acc.perdidos + Number(l.prazos_perdidos),
      }),
      { abertos: 0, concluidos: 0, noPrazo: 0, perdidos: 0 }
    );
  }, [geral]);

  const totaisTst = useMemo(() => {
    return tst.reduce(
      (acc, l) => ({
        total: acc.total + Number(l.total),
        sem: acc.sem + Number(l.sem_pendencia),
        com: acc.com + Number(l.com_pendencia),
        pend: acc.pend + Number(l.pendencias_total),
      }),
      { total: 0, sem: 0, com: 0, pend: 0 }
    );
  }, [tst]);

  const graficoGeral = useMemo(
    () =>
      [...geral]
        .sort((a, b) => Number(b.concluidos) - Number(a.concluidos))
        .slice(0, 12)
        .map((l) => ({
          nome: l.nome.split(" ").slice(0, 2).join(" "),
          Abertos: Number(l.abertos_total),
          "No prazo": Number(l.concluidos_no_prazo),
          "Com atraso": Number(l.concluidos_atraso),
        })),
    [geral]
  );

  const graficoTst = useMemo(
    () =>
      [...tst]
        .sort((a, b) => Number(b.sem_pendencia) - Number(a.sem_pendencia))
        .slice(0, 12)
        .map((l) => ({
          nome: l.nome.split(" ").slice(0, 2).join(" "),
          "Sem pendência": Number(l.sem_pendencia),
          "Com pendência": Number(l.com_pendencia),
        })),
    [tst]
  );

  const nomeCoordenacao =
    coordenacaoId === "todas" ? "Todas as coordenações" : coordenacoes.find((c) => c.id === coordenacaoId)?.nome || "-";
  const nomeUsuario = usuarioId === "todos" ? "Todos os usuários" : usuarios?.find((u) => u.id === usuarioId)?.nome || "-";
  const periodoLabel = `${format(new Date(inicio + "T12:00:00"), "dd/MM/yyyy")} a ${format(
    new Date(fim + "T12:00:00"),
    "dd/MM/yyyy"
  )}`;

  const exportarPdf = () => {
    if (aba === "geral") {
      gerarRankingPdf({
        titulo: "Ranking de Atendimento — Geral",
        subtitulo: "Produtividade e cumprimento de prazos por profissional",
        periodo: periodoLabel,
        filtros: `${nomeCoordenacao} | ${nomeUsuario}`,
        colunas: [
          { header: "#", width: 10 },
          { header: "Profissional", width: 60, key: "nome" },
          { header: "Abertos", width: 22, key: "abertos_total", align: "right" },
          { header: "Prazos", width: 20, key: "abertos_prazos", align: "right" },
          { header: "Audiências", width: 24, key: "abertos_audiencias", align: "right" },
          { header: "Eventos", width: 20, key: "abertos_eventos", align: "right" },
          { header: "Parcelam.", width: 22, key: "abertos_parcelamentos", align: "right" },
          { header: "Concluídos", width: 24, key: "concluidos", align: "right" },
          { header: "No prazo", width: 22, key: "concluidos_no_prazo", align: "right" },
          { header: "Atraso", width: 20, key: "concluidos_atraso", align: "right" },
          { header: "% no prazo", width: 24, key: "taxa", align: "right" },
          { header: "Prazos perdidos", width: 28, key: "prazos_perdidos", align: "right" },
        ].map((c: any, i) => ({ ...c, key: c.key || `pos${i}` })),
        linhas: [...geral]
          .sort((a, b) => pct(Number(b.concluidos_no_prazo), Number(b.concluidos)) - pct(Number(a.concluidos_no_prazo), Number(a.concluidos)))
          .map((l, idx) => ({
            pos0: String(idx + 1),
            nome: l.nome,
            abertos_total: l.abertos_total,
            abertos_prazos: l.abertos_prazos,
            abertos_audiencias: l.abertos_audiencias,
            abertos_eventos: l.abertos_eventos,
            abertos_parcelamentos: l.abertos_parcelamentos,
            concluidos: l.concluidos,
            concluidos_no_prazo: l.concluidos_no_prazo,
            concluidos_atraso: l.concluidos_atraso,
            taxa: `${pct(Number(l.concluidos_no_prazo), Number(l.concluidos))}%`,
            prazos_perdidos: l.prazos_perdidos,
          })),
        resumo: [
          { label: "Itens abertos", valor: totaisGeral.abertos },
          { label: "Concluídos", valor: totaisGeral.concluidos },
          { label: "Concluídos no prazo", valor: totaisGeral.noPrazo },
          { label: "% no prazo", valor: `${pct(totaisGeral.noPrazo, totaisGeral.concluidos)}%` },
          { label: "Prazos perdidos", valor: totaisGeral.perdidos },
        ],
        nomeArquivo: "ranking_atendimento_geral",
      });
    } else {
      gerarRankingPdf({
        titulo: "Ranking de Atendimento — TST (Distribuição)",
        subtitulo: "Qualidade do preenchimento dos dados da Distribuição TST",
        periodo: periodoLabel,
        filtros: `${nomeCoordenacao} | ${nomeUsuario}`,
        colunas: [
          { header: "#", width: 10, key: "pos" },
          { header: "Profissional", width: 70, key: "nome" },
          { header: "Processos", width: 28, key: "total", align: "right" },
          { header: "Sem pendência", width: 32, key: "sem_pendencia", align: "right" },
          { header: "Com pendência", width: 32, key: "com_pendencia", align: "right" },
          { header: "% completos", width: 28, key: "taxa", align: "right" },
          { header: "Campos pendentes", width: 34, key: "pendencias_total", align: "right" },
          { header: "Judit preenchido", width: 32, key: "judit_preenchidos", align: "right" },
        ],
        linhas: [...tst]
          .sort((a, b) => pct(Number(b.sem_pendencia), Number(b.total)) - pct(Number(a.sem_pendencia), Number(a.total)))
          .map((l, idx) => ({
            pos: String(idx + 1),
            nome: l.nome,
            total: l.total,
            sem_pendencia: l.sem_pendencia,
            com_pendencia: l.com_pendencia,
            taxa: `${pct(Number(l.sem_pendencia), Number(l.total))}%`,
            pendencias_total: l.pendencias_total,
            judit_preenchidos: l.judit_preenchidos,
          })),
        resumo: [
          { label: "Processos", valor: totaisTst.total },
          { label: "Sem pendência", valor: totaisTst.sem },
          { label: "Com pendência", valor: totaisTst.com },
          { label: "% completos", valor: `${pct(totaisTst.sem, totaisTst.total)}%` },
          { label: "Campos pendentes", valor: totaisTst.pend },
        ],
        nomeArquivo: "ranking_atendimento_tst",
      });
    }
  };

  const medalha = (idx: number) =>
    idx === 0 ? "text-[hsl(43_74%_49%)]" : idx === 1 ? "text-muted-foreground" : idx === 2 ? "text-amber-700" : "";

  const geralOrdenado = useMemo(
    () =>
      [...geral].sort(
        (a, b) =>
          pct(Number(b.concluidos_no_prazo), Number(b.concluidos)) -
            pct(Number(a.concluidos_no_prazo), Number(a.concluidos)) || Number(b.concluidos) - Number(a.concluidos)
      ),
    [geral]
  );

  const tstOrdenado = useMemo(
    () =>
      [...tst].sort(
        (a, b) =>
          pct(Number(b.sem_pendencia), Number(b.total)) - pct(Number(a.sem_pendencia), Number(a.total)) ||
          Number(b.total) - Number(a.total)
      ),
    [tst]
  );

  return (
    <MainLayout
      title="Ranking de Atendimento"
      subtitle="Desempenho do escritório por profissional, coordenação e período"
    >
      <div className="space-y-4">
        {/* Filtros */}
        <Card className="border-l-4" style={{ borderLeftColor: GOLD }}>
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Data inicial</p>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Data final</p>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9 w-40" />
            </div>
            {podeVerOutros && (
              <>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Coordenação</p>
                  <Select
                    value={coordenacaoId}
                    onValueChange={(v) => {
                      setCoordenacaoId(v);
                      setUsuarioId("todos");
                    }}
                  >
                    <SelectTrigger className="h-9 w-64">
                      <SelectValue placeholder="Coordenação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as coordenações</SelectItem>
                      {[...coordenacoes]
                        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Profissional</p>
                  <Select value={usuarioId} onValueChange={setUsuarioId}>
                    <SelectTrigger className="h-9 w-56">
                      <SelectValue placeholder="Profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os usuários</SelectItem>
                      {(usuarios || []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="ml-auto">
              <Button onClick={exportarPdf} className="gap-2">
                <FileDown className="w-4 h-4" />
                Exportar PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="geral" className="gap-2">
              <Trophy className="w-4 h-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="tst" className="gap-2">
              <Target className="w-4 h-4" />
              TST
            </TabsTrigger>
          </TabsList>

          {/* ---------------- GERAL ---------------- */}
          <TabsContent value="geral" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {(
                [
                  ["Itens abertos", totaisGeral.abertos, AZUL],
                  ["Concluídos", totaisGeral.concluidos, NAVY],
                  ["Concluídos no prazo", totaisGeral.noPrazo, VERDE],
                  ["% no prazo", `${pct(totaisGeral.noPrazo, totaisGeral.concluidos)}%`, GOLD],
                  ["Prazos perdidos", totaisGeral.perdidos, VERMELHO],
                ] as [string, number | string, string][]
              ).map(([label, valor, cor]) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                    </div>
                    {geralQuery.isLoading ? (
                      <Skeleton className="h-7 w-16 mt-2" />
                    ) : (
                      <p className="text-2xl font-bold mt-1">{valor}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top 12 — produtividade e pontualidade</CardTitle>
                <CardDescription>Itens abertos, concluídos no prazo e concluídos com atraso</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {geralQuery.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoGeral} margin={{ top: 16, right: 8, bottom: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="nome" angle={-25} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Abertos" fill={AZUL} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="No prazo" fill={VERDE} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Com atraso" fill={VERMELHO} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking detalhado</CardTitle>
                <CardDescription>Ordenado pelo percentual de conclusões dentro do prazo</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead className="text-right">Abertos</TableHead>
                      <TableHead className="text-right">Prazos</TableHead>
                      <TableHead className="text-right">Audiências</TableHead>
                      <TableHead className="text-right">Eventos</TableHead>
                      <TableHead className="text-right">Parcelam.</TableHead>
                      <TableHead className="text-right">Concluídos</TableHead>
                      <TableHead className="text-right">No prazo</TableHead>
                      <TableHead className="text-right">Atraso</TableHead>
                      <TableHead className="text-right">% no prazo</TableHead>
                      <TableHead className="text-right">Prazos perdidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geralQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={12}>
                          <Skeleton className="h-24 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : geralOrdenado.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-10">
                          Nenhum dado no período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      geralOrdenado.map((l, idx) => (
                        <TableRow key={l.usuario_id}>
                          <TableCell>
                            <span className="flex items-center gap-1 font-semibold">
                              {idx < 3 && <Medal className={`w-4 h-4 ${medalha(idx)}`} />}
                              {idx + 1}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell className="text-right">{l.abertos_total}</TableCell>
                          <TableCell className="text-right">{l.abertos_prazos}</TableCell>
                          <TableCell className="text-right">{l.abertos_audiencias}</TableCell>
                          <TableCell className="text-right">{l.abertos_eventos}</TableCell>
                          <TableCell className="text-right">{l.abertos_parcelamentos}</TableCell>
                          <TableCell className="text-right font-semibold">{l.concluidos}</TableCell>
                          <TableCell className="text-right text-green-600">{l.concluidos_no_prazo}</TableCell>
                          <TableCell className="text-right text-amber-600">{l.concluidos_atraso}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {pct(Number(l.concluidos_no_prazo), Number(l.concluidos))}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(l.prazos_perdidos) > 0 ? (
                              <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                                <AlertTriangle className="w-3 h-3" />
                                {l.prazos_perdidos}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- TST ---------------- */}
          <TabsContent value="tst" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {(
                [
                  ["Processos", totaisTst.total, NAVY],
                  ["Sem pendência", totaisTst.sem, VERDE],
                  ["Com pendência", totaisTst.com, VERMELHO],
                  ["% completos", `${pct(totaisTst.sem, totaisTst.total)}%`, GOLD],
                  ["Campos pendentes", totaisTst.pend, AZUL],
                ] as [string, number | string, string][]
              ).map(([label, valor, cor]) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                    </div>
                    {tstQuery.isLoading ? (
                      <Skeleton className="h-7 w-16 mt-2" />
                    ) : (
                      <p className="text-2xl font-bold mt-1">{valor}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top 12 — preenchimento da Distribuição TST</CardTitle>
                <CardDescription>Baseado nos dados Benner e nas regras de pendência da tela</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {tstQuery.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoTst} margin={{ top: 16, right: 8, bottom: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="nome" angle={-25} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Sem pendência" fill={VERDE} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="Sem pendência" position="top" style={{ fontSize: 10 }} />
                      </Bar>
                      <Bar dataKey="Com pendência" fill={VERMELHO} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking detalhado — TST</CardTitle>
                <CardDescription>Ordenado pelo percentual de processos sem pendência</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead className="text-right">Processos</TableHead>
                      <TableHead className="text-right">Sem pendência</TableHead>
                      <TableHead className="text-right">Com pendência</TableHead>
                      <TableHead className="text-right">% completos</TableHead>
                      <TableHead className="text-right">Campos pendentes</TableHead>
                      <TableHead className="text-right">Judit preenchido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tstQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-24 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : tstOrdenado.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                          Nenhum dado no período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      tstOrdenado.map((l, idx) => (
                        <TableRow key={l.usuario_id}>
                          <TableCell>
                            <span className="flex items-center gap-1 font-semibold">
                              {idx < 3 && <Medal className={`w-4 h-4 ${medalha(idx)}`} />}
                              {idx + 1}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell className="text-right font-semibold">{l.total}</TableCell>
                          <TableCell className="text-right text-green-600">{l.sem_pendencia}</TableCell>
                          <TableCell className="text-right text-destructive">{l.com_pendencia}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{pct(Number(l.sem_pendencia), Number(l.total))}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">{l.pendencias_total}</TableCell>
                          <TableCell className="text-right">{l.judit_preenchidos}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
