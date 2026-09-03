import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";

type ProcessoRow = {
  id: string;
  numero: string;
  polo_ativo: string | null;
  polo_passivo: string | null;
  area: string | null;
  status: string | null;
  coordenacao_id: string | null;
  advogado_responsavel_id: string | null;
};

const PAGE_SIZE = 25;

/** Situações consideradas encerradas — excluídas por padrão da reatribuição. */
const STATUS_CONCLUIDOS = [
  "encerrado",
  "arquivado",
  "arquivado_parcialmente",
  "arquivado_definitivamente",
] as const;

const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
  direito_privado: "Direito Privado",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  urgente: "Urgente",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
  arquivado_parcialmente: "Arquivado parcialmente",
  arquivado_definitivamente: "Arquivado definitivamente",
  suspenso: "Suspenso",
};

async function fetchAllIdsDoResponsavel(usuarioId: string): Promise<string[]> {
  const ids = new Set<string>();
  // Vínculos N:N
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("processos_responsaveis")
      .select("processo_id")
      .eq("usuario_id", usuarioId)
      .range(from, from + 999);
    if (error) throw error;
    (data ?? []).forEach((r: any) => r.processo_id && ids.add(r.processo_id));
    if (!data || data.length < 1000) break;
  }
  // Responsável principal (coluna legada)
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("processos")
      .select("id")
      .eq("advogado_responsavel_id", usuarioId)
      .range(from, from + 999);
    if (error) throw error;
    (data ?? []).forEach((r: any) => r.id && ids.add(r.id));
    if (!data || data.length < 1000) break;
  }
  return Array.from(ids);
}

export default function ReatribuirProcessos() {
  const queryClient = useQueryClient();

  // Filtros
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [coordFiltro, setCoordFiltro] = useState("all");
  const [respFiltro, setRespFiltro] = useState("all");
  const [situacao, setSituacao] = useState<"andamento" | "concluidos" | "todos">("andamento");
  const [page, setPage] = useState(0);

  // Seleção
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Destino
  const [novaCoordenacao, setNovaCoordenacao] = useState("keep");
  const [novoResponsavel, setNovoResponsavel] = useState("keep");
  const [substituirOrigem, setSubstituirOrigem] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);

  useEffect(() => {
    setPage(0);
  }, [buscaAplicada, coordFiltro, respFiltro, situacao]);

  const { data: coordenacoes } = useQuery({
    queryKey: ["reatribuir-coordenacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: usuarios } = useQuery({
    queryKey: ["reatribuir-usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []).filter((u: any) => u.ativo !== false);
    },
  });

  // IDs do responsável filtrado (considera vínculo N:N + coluna legada)
  const { data: idsDoResponsavel, isFetching: buscandoIds } = useQuery({
    queryKey: ["reatribuir-ids-responsavel", respFiltro],
    enabled: respFiltro !== "all",
    queryFn: () => fetchAllIdsDoResponsavel(respFiltro),
  });

  const { data: pagina, isFetching } = useQuery({
    queryKey: [
      "reatribuir-processos",
      buscaAplicada,
      coordFiltro,
      respFiltro,
      situacao,
      page,
      (idsDoResponsavel ?? []).length,
    ],
    enabled: respFiltro === "all" || !!idsDoResponsavel,
    queryFn: async () => {
      if (respFiltro !== "all" && (idsDoResponsavel ?? []).length === 0) {
        return { rows: [] as ProcessoRow[], total: 0 };
      }

      let q = supabase
        .from("processos")
        .select(
          "id, numero, polo_ativo, polo_passivo, area, status, coordenacao_id, advogado_responsavel_id",
          { count: "exact" },
        );

      if (coordFiltro === "sem") q = q.is("coordenacao_id", null);
      else if (coordFiltro !== "all") q = q.eq("coordenacao_id", coordFiltro);

      if (respFiltro !== "all") q = q.in("id", idsDoResponsavel ?? []);

      if (situacao === "andamento") q = q.not("status", "in", `(${STATUS_CONCLUIDOS.join(",")})`);
      else if (situacao === "concluidos") q = q.in("status", STATUS_CONCLUIDOS as unknown as string[]);

      const termo = buscaAplicada.trim();
      if (termo) {
        const digitos = termo.replace(/\D/g, "");
        const like = `%${termo}%`;
        const ors = [`numero.ilike.${like}`, `polo_ativo.ilike.${like}`, `polo_passivo.ilike.${like}`];
        if (digitos.length >= 4) ors.push(`numero.ilike.%${digitos}%`);
        q = q.or(ors.join(","));
      }

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as ProcessoRow[], total: count ?? 0 };
    },
  });

  const rows = pagina?.rows ?? [];
  const total = pagina?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const nomePorUsuario = useMemo(() => {
    const m = new Map<string, string>();
    (usuarios ?? []).forEach((u: any) => m.set(u.id, u.nome));
    return m;
  }, [usuarios]);

  const nomePorCoordenacao = useMemo(() => {
    const m = new Map<string, string>();
    (coordenacoes ?? []).forEach((c: any) => m.set(c.id, c.nome));
    return m;
  }, [coordenacoes]);

  const toggle = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const paginaToda = rows.length > 0 && rows.every((r) => selecionados.has(r.id));
  const togglePagina = () => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (paginaToda) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const selecionarTodosFiltrados = async () => {
    try {
      const ids: string[] = [];
      for (let from = 0; ; from += 1000) {
        let q = supabase.from("processos").select("id");
        if (coordFiltro === "sem") q = q.is("coordenacao_id", null);
        else if (coordFiltro !== "all") q = q.eq("coordenacao_id", coordFiltro);
        if (respFiltro !== "all") q = q.in("id", idsDoResponsavel ?? []);
        if (situacao === "andamento") q = q.not("status", "in", `(${STATUS_CONCLUIDOS.join(",")})`);
        else if (situacao === "concluidos") q = q.in("status", STATUS_CONCLUIDOS as unknown as string[]);
        const termo = buscaAplicada.trim();
        if (termo) {
          const like = `%${termo}%`;
          q = q.or(
            [`numero.ilike.${like}`, `polo_ativo.ilike.${like}`, `polo_passivo.ilike.${like}`].join(","),
          );
        }
        const { data, error } = await q.range(from, from + 999);
        if (error) throw error;
        (data ?? []).forEach((r: any) => ids.push(r.id));
        if (!data || data.length < 1000) break;
      }
      setSelecionados(new Set(ids));
      toast.success(`${ids.length} processo(s) selecionado(s)`);
    } catch (e: any) {
      toast.error("Erro ao selecionar todos", { description: e?.message });
    }
  };

  const limparFiltros = () => {
    setBusca("");
    setBuscaAplicada("");
    setCoordFiltro("all");
    setRespFiltro("all");
    setSituacao("andamento");
    setSelecionados(new Set());
  };

  const podeAplicar =
    selecionados.size > 0 && (novaCoordenacao !== "keep" || novoResponsavel !== "keep");

  const aplicar = async () => {
    const ids = Array.from(selecionados);
    setSalvando(true);
    setProgresso({ feitos: 0, total: ids.length });
    try {
      const patch: Record<string, any> = {};
      if (novaCoordenacao !== "keep") patch.coordenacao_id = novaCoordenacao === "none" ? null : novaCoordenacao;
      if (novoResponsavel !== "keep") patch.advogado_responsavel_id = novoResponsavel === "none" ? null : novoResponsavel;

      const BATCH = 100;
      for (let i = 0; i < ids.length; i += BATCH) {
        const lote = ids.slice(i, i + BATCH);
        const { error } = await supabase.from("processos").update(patch).in("id", lote);
        if (error) throw error;
        setProgresso({ feitos: Math.min(i + BATCH, ids.length), total: ids.length });
      }

      // Vínculos N:N — é onde a responsabilidade realmente é lida na maior parte do sistema
      if (novoResponsavel !== "keep" && novoResponsavel !== "none") {
        const coordDestino = novaCoordenacao !== "keep" && novaCoordenacao !== "none" ? novaCoordenacao : null;
        const vinculos = ids.map((processo_id) => ({
          processo_id,
          usuario_id: novoResponsavel,
          papel: "Responsável",
          ativo: true,
          ...(coordDestino ? { coordenacao_id: coordDestino } : {}),
        }));
        for (let i = 0; i < vinculos.length; i += 500) {
          const lote = vinculos.slice(i, i + 500);
          const { error } = await (supabase as any)
            .from("processos_responsaveis")
            .upsert(lote, { onConflict: "processo_id,usuario_id", ignoreDuplicates: true });
          if (error) throw error;
        }

        // Remove o responsável de origem quando a reatribuição parte de uma pessoa
        if (substituirOrigem && respFiltro !== "all" && respFiltro !== novoResponsavel) {
          for (let i = 0; i < ids.length; i += 200) {
            const lote = ids.slice(i, i + 200);
            const { error } = await supabase
              .from("processos_responsaveis")
              .delete()
              .eq("usuario_id", respFiltro)
              .in("processo_id", lote);
            if (error) throw error;
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["reatribuir-processos"] });
      await queryClient.invalidateQueries({ queryKey: ["reatribuir-ids-responsavel"] });
      await queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      await queryClient.invalidateQueries({ queryKey: ["processos"] });

      toast.success(`${ids.length} processo(s) reatribuído(s)`);
      setSelecionados(new Set());
      setNovaCoordenacao("keep");
      setNovoResponsavel("keep");
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error("Erro ao reatribuir", { description: e?.message });
    } finally {
      setSalvando(false);
      setProgresso(null);
    }
  };

  const resumoDestino = [
    novaCoordenacao !== "keep"
      ? `Coordenação → ${novaCoordenacao === "none" ? "sem coordenação" : nomePorCoordenacao.get(novaCoordenacao)}`
      : null,
    novoResponsavel !== "keep"
      ? `Responsável → ${novoResponsavel === "none" ? "sem responsável" : nomePorUsuario.get(novoResponsavel)}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <MainLayout
      title="Reatribuir Processos"
      subtitle="Transferência de processos entre coordenações e responsáveis"
    >
      <div className="space-y-4">
        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" /> Filtros
            </CardTitle>
            <CardDescription>
              A responsabilidade é considerada tanto pelo vínculo de responsáveis quanto pelo
              responsável principal do processo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Buscar processo / parte</Label>
                <div className="flex gap-2">
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setBuscaAplicada(busca)}
                    placeholder="Número, reclamante, reclamado..."
                  />
                  <Button variant="secondary" onClick={() => setBuscaAplicada(busca)}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Coordenação atual</Label>
                <Select value={coordFiltro} onValueChange={setCoordFiltro}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="sem">Sem coordenação</SelectItem>
                    {(coordenacoes ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Responsável atual</Label>
                <Select value={respFiltro} onValueChange={setRespFiltro}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all">Todos</SelectItem>
                    {(usuarios ?? []).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Situação</Label>
                <div className="flex gap-2">
                  <Select value={situacao} onValueChange={(v: any) => setSituacao(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="andamento">Em andamento (não concluídos)</SelectItem>
                      <SelectItem value="concluidos">Somente concluídos</SelectItem>
                      <SelectItem value="todos">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={limparFiltros} title="Limpar filtros">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Destino */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Destino da reatribuição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Nova coordenação</Label>
                <Select value={novaCoordenacao} onValueChange={setNovaCoordenacao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="keep">Manter atual</SelectItem>
                    <SelectItem value="none">Sem coordenação</SelectItem>
                    {(coordenacoes ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Novo responsável</Label>
                <Select value={novoResponsavel} onValueChange={setNovoResponsavel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="keep">Manter atual</SelectItem>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {(usuarios ?? []).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  id="substituir"
                  checked={substituirOrigem}
                  onCheckedChange={(v) => setSubstituirOrigem(!!v)}
                  disabled={respFiltro === "all"}
                />
                <Label htmlFor="substituir" className="text-xs leading-tight">
                  Remover o responsável atual filtrado dos processos transferidos
                </Label>
              </div>

              <Button
                className="w-full"
                disabled={!podeAplicar}
                onClick={() => setConfirmOpen(true)}
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Reatribuir {selecionados.size > 0 ? `(${selecionados.size})` : ""}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Processos
                <Badge variant="secondary">{total} encontrado(s)</Badge>
                {selecionados.size > 0 && (
                  <Badge className="bg-primary">{selecionados.size} selecionado(s)</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={selecionarTodosFiltrados} disabled={total === 0}>
                  Selecionar todos os filtrados
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())} disabled={!selecionados.size}>
                  Limpar seleção
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={paginaToda} onCheckedChange={togglePagina} />
                    </TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead>Partes</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Coordenação</TableHead>
                    <TableHead>Responsável principal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(isFetching || buscandoIds) && rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                        Nenhum processo encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((p) => (
                      <TableRow key={p.id} className={selecionados.has(p.id) ? "bg-primary/5" : undefined}>
                        <TableCell>
                          <Checkbox checked={selecionados.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          <Link to={`/processos/${p.id}`} target="_blank" className="text-primary hover:underline">
                            {p.numero}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs max-w-[280px] truncate">
                          {[p.polo_ativo, p.polo_passivo].filter(Boolean).join(" × ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{areaLabels[p.area ?? ""] || p.area || "—"}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline">{statusLabels[p.status ?? ""] || p.status || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.coordenacao_id ? nomePorCoordenacao.get(p.coordenacao_id) ?? "—" : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.advogado_responsavel_id
                            ? nomePorUsuario.get(p.advogado_responsavel_id) ?? "—"
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-3">
              <p className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPaginas}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page + 1 >= totalPaginas}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => !salvando && setConfirmOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reatribuição</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>{selecionados.size} processo(s) serão atualizados:</p>
                <ul className="list-disc pl-5">
                  {resumoDestino.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {substituirOrigem && respFiltro !== "all" && (
                  <p className="text-muted-foreground">
                    O responsável atual filtrado será removido desses processos.
                  </p>
                )}
                {progresso && (
                  <p className="text-muted-foreground">
                    Gravando {progresso.feitos} de {progresso.total}...
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Separator />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void aplicar();
              }}
              disabled={salvando}
            >
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
