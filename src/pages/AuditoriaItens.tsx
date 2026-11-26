import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, Search, Eye, CheckCircle2, XCircle, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { gerarRelatorioAuditoriaPdf } from "@/lib/relatorioAuditoriaCoordenacaoPdf";
import { gerarRelatorioAuditoriaExcel } from "@/lib/relatorioAuditoriaCoordenacaoExcel";
import { labelCampo, labelOrigem } from "@/lib/auditoriaCampos";
import { buscarReferenciasAuditoria, formatValorAuditoria, linhasDadosAuditoria } from "@/lib/auditoriaReferencias";
import { useReferenciasAuditoria } from "@/hooks/useReferenciasAuditoria";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface AuditoriaRow {
  id: string;
  created_at: string;
  usuario_id: string | null;
  acao: string;
  sucesso: boolean;
  origem: string;
  tipo_item: string | null;
  processo_id: string | null;
  tarefa_id: string | null;
  coordenacao_id: string | null;
  dados_entrada: any;
  dados_saida: any;
  erro_mensagem: string | null;
  erro_detalhes: any;
  user_agent: string | null;
  campos_alterados: any;
  titulo_saida?: string | null;
  descricao_saida?: string | null;
  nome_saida?: string | null;
  nome_arquivo_saida?: string | null;
  numero_saida?: string | null;
  titulo_entrada?: string | null;
  descricao_entrada?: string | null;
  nome_entrada?: string | null;
  nome_arquivo_entrada?: string | null;
  numero_entrada?: string | null;
  processo_numero_saida?: string | null;
  processo_numero_entrada?: string | null;
}

const TIPOS = ["tarefa", "prazo", "evento", "audiencia", "parcelamento"] as const;
const ACOES = ["criar", "atualizar", "deletar", "erro_criar", "erro_atualizar", "erro_deletar"] as const;

const getDiff = (r: AuditoriaRow): { campo: string; de: any; para: any }[] => {
  if (Array.isArray(r.campos_alterados)) return r.campos_alterados;
  return [];
};

const getTituloItem = (r: AuditoriaRow): string => {
  const fonte = r.dados_saida || r.dados_entrada || {};
  return fonte?.titulo || fonte?.descricao || fonte?.nome_arquivo || fonte?.nome || fonte?.numero
    || r.titulo_saida || r.descricao_saida || r.nome_arquivo_saida || r.nome_saida || r.numero_saida
    || r.titulo_entrada || r.descricao_entrada || r.nome_arquivo_entrada || r.nome_entrada || r.numero_entrada
    || "—";
};

const RELATORIO_SELECT = `
  id,created_at,usuario_id,acao,origem,tipo_item,processo_id,campos_alterados,
  titulo_saida:dados_saida->>titulo,descricao_saida:dados_saida->>descricao,
  nome_saida:dados_saida->>nome,nome_arquivo_saida:dados_saida->>nome_arquivo,numero_saida:dados_saida->>numero,
  processo_numero_saida:dados_saida->>processo_numero,
  titulo_entrada:dados_entrada->>titulo,descricao_entrada:dados_entrada->>descricao,
  nome_entrada:dados_entrada->>nome,nome_arquivo_entrada:dados_entrada->>nome_arquivo,numero_entrada:dados_entrada->>numero,
  processo_numero_entrada:dados_entrada->>processo_numero
`;

const aguardarPintura = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export default function AuditoriaItens() {
  const [tipoItem, setTipoItem] = useState<string>("todos");
  const [acao, setAcao] = useState<string>("todos");
  const [sucesso, setSucesso] = useState<string>("todos");
  const [origem, setOrigem] = useState("");
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [selected, setSelected] = useState<AuditoriaRow | null>(null);
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [progressoRelatorio, setProgressoRelatorio] = useState({ valor: 0, etapa: "", carregados: 0, total: 0 });

  const { isAdminOrCoordinator } = useUserRole();
  const podeRelatorio = isAdminOrCoordinator;
  const { data: coordenacoes } = useCoordenacoesFull();

  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ["auditoria-itens", tipoItem, acao, sucesso, origem, dataInicio, dataFim, coordenacaoId],
    queryFn: async () => {
      let q: any = supabase
        .from("auditoria_tarefas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (tipoItem !== "todos") q = q.eq("tipo_item", tipoItem);
      if (acao !== "todos") q = q.eq("acao", acao);
      if (sucesso !== "todos") q = q.eq("sucesso", sucesso === "sim");
      if (origem.trim()) q = q.ilike("origem", `%${origem.trim()}%`);
      if (coordenacaoId !== "todas") q = q.eq("coordenacao_id", coordenacaoId);
      if (dataInicio) q = q.gte("created_at", `${dataInicio}T00:00:00-03:00`);
      if (dataFim) q = q.lte("created_at", `${dataFim}T23:59:59.999-03:00`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AuditoriaRow[];
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set((rows || []).map((r) => r.usuario_id).filter(Boolean) as string[])),
    [rows]
  );
  const { data: profiles } = useQuery({
    queryKey: ["auditoria-profiles", userIds.sort().join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {} as Record<string, { nome: string; email: string }>;
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);
      const map: Record<string, { nome: string; email: string }> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = { nome: p.nome || p.email || p.id, email: p.email || "" };
      });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const { data: processoSelecionado } = useQuery({
    queryKey: ["auditoria-processo", selected?.processo_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("processos")
        .select("id, numero")
        .eq("id", selected!.processo_id!)
        .maybeSingle();
      return data as { id: string; numero: string | null } | null;
    },
    enabled: !!selected?.processo_id,
  });

  const camposVisiveis = useMemo(() => (rows || []).flatMap(getDiff), [rows]);
  const { referencias: referenciasVisiveis } = useReferenciasAuditoria(camposVisiveis, camposVisiveis.length > 0);
  const camposSelecionado = selected
    ? [...getDiff(selected), { campo: "dados", de: selected.dados_entrada, para: selected.dados_saida }]
    : [];
  const { referencias: referenciasSelecionado } = useReferenciasAuditoria(camposSelecionado, !!selected);

  const nomeCoordenacaoRegistro = (id: string | null) =>
    id ? (coordenacoes as any[] | undefined)?.find((c) => c.id === id)?.nome || "—" : "—";

  const nomeUsuario = (id: string | null) =>
    id ? profiles?.[id]?.nome || id.slice(0, 8) : "—";

  const emailUsuario = (id: string | null) => (id ? profiles?.[id]?.email || "" : "");

  const rowsFiltradas = useMemo(() => {
    const termo = buscaUsuario.trim().toLowerCase();
    if (!termo) return rows || [];
    return (rows || []).filter((r) =>
      `${nomeUsuario(r.usuario_id)} ${emailUsuario(r.usuario_id)}`.toLowerCase().includes(termo)
    );
  }, [rows, buscaUsuario, profiles]);

  const nomeCoordenacao = (id: string) =>
    (coordenacoes || []).find((c: any) => c.id === id)?.nome || "Todas as coordenações";

  const gerarRelatorio = async (formato: "pdf" | "excel" = "pdf") => {
    setGerandoPdf(true);
    const marcarProgresso = async (valor: number, etapa: string, carregados = 0, total = 0) => {
      setProgressoRelatorio({ valor, etapa, carregados, total });
      await aguardarPintura();
    };
    try {
      await marcarProgresso(2, "Preparando os filtros...");
      let idsFiltroUsuario: string[] | null = null;
      const termoUsuario = buscaUsuario.trim();
      if (termoUsuario) {
        const termoSeguro = termoUsuario.replace(/[%,()]/g, " ").trim();
        const { data: usuariosEncontrados, error: erroBuscaUsuario } = await supabase
          .from("profiles")
          .select("id")
          .or(`nome.ilike.%${termoSeguro}%,email.ilike.%${termoSeguro}%`)
          .limit(1000);
        if (erroBuscaUsuario) throw erroBuscaUsuario;
        idsFiltroUsuario = (usuariosEncontrados || []).map((u) => u.id);
        if (idsFiltroUsuario.length === 0) {
          toast.error("Nenhum usuário encontrado com esse nome ou e-mail.");
          return;
        }
      }

      const aplicarFiltros = (consulta: any) => {
        let q = consulta;
        if (tipoItem !== "todos") q = q.eq("tipo_item", tipoItem);
        if (acao !== "todos") q = q.eq("acao", acao);
        if (sucesso !== "todos") q = q.eq("sucesso", sucesso === "sim");
        if (origem.trim()) q = q.ilike("origem", `%${origem.trim()}%`);
        if (coordenacaoId !== "todas") q = q.eq("coordenacao_id", coordenacaoId);
        if (idsFiltroUsuario) q = q.in("usuario_id", idsFiltroUsuario);
        if (dataInicio) q = q.gte("created_at", `${dataInicio}T00:00:00-03:00`);
        if (dataFim) q = q.lte("created_at", `${dataFim}T23:59:59.999-03:00`);
        return q;
      };

      await marcarProgresso(5, "Contando as alterações...");
      const { count, error: erroContagem } = await aplicarFiltros(
        supabase.from("auditoria_tarefas").select("id", { count: "exact", head: true }),
      );
      if (erroContagem) throw erroContagem;
      const total = count ?? 0;
      if (total === 0) {
        toast.error("Nenhuma alteração no período/filtros selecionados.");
        return;
      }

      // Só os campos usados no arquivo: evita baixar JSONs completos e tokens de anexos.
      const coletados: AuditoriaRow[] = [];
      const paginas = Math.ceil(total / 1000);
      for (let page = 0; page < paginas; page++) {
        const q = aplicarFiltros((supabase as any).from("auditoria_tarefas").select(RELATORIO_SELECT))
          .order("created_at", { ascending: false })
          .range(page * 1000, page * 1000 + 999);
        const { data, error } = await q;
        if (error) throw error;
        coletados.push(...((data || []) as AuditoriaRow[]));
        await marcarProgresso(
          5 + Math.round((coletados.length / total) * 60),
          "Buscando as alterações...",
          coletados.length,
          total,
        );
      }

      await marcarProgresso(70, "Identificando usuários e processos...", coletados.length, total);
      const ids = Array.from(new Set(coletados.map((r) => r.usuario_id).filter(Boolean) as string[]));
      const mapaUsuarios = new Map<string, { nome: string; email: string }>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", ids.slice(i, i + 200));
        if (error) throw error;
        (data || []).forEach((p: any) =>
          mapaUsuarios.set(p.id, { nome: p.nome || p.email || "Usuário sem nome", email: p.email || "" }),
        );
      }

      const processoIds = Array.from(new Set(coletados.map((r) => r.processo_id).filter(Boolean) as string[]));
      const referencias = await buscarReferenciasAuditoria(coletados.flatMap(getDiff), {
        processoIds,
        usuarioIds: ids,
      });

      await marcarProgresso(85, "Organizando os dados...", coletados.length, total);
      const params = {
        coordenacaoNome: coordenacaoId === "todas" ? "Todas as coordenações" : nomeCoordenacao(coordenacaoId),
        periodo:
          dataInicio || dataFim
            ? `${dataInicio ? dataInicio.split("-").reverse().join("/") : "início"} a ${
                dataFim ? dataFim.split("-").reverse().join("/") : "sem data final"
              }`
            : "Todo o histórico",
        tipoLabel: tipoItem === "todos" ? "Todos" : tipoItem,
        usuarioLabel: termoUsuario || "Todos",
        rows: coletados.map((r) => ({
          created_at: r.created_at,
          usuarioNome: (r.usuario_id && mapaUsuarios.get(r.usuario_id)?.nome) || "Sistema",
          usuarioEmail: (r.usuario_id && mapaUsuarios.get(r.usuario_id)?.email) || "",
          tipo_item: r.tipo_item,
          titulo: getTituloItem(r),
          acao: r.acao,
          origem: labelOrigem(r.origem),
          processo: (r.processo_id && referencias.processos[r.processo_id])
            || r.processo_numero_saida
            || r.processo_numero_entrada
            || (r.processo_id ? "Processo excluído ou não identificado" : ""),
          campos: getDiff(r),
        })),
        labelCampo,
        formatValor: (campo: string, valor: any) => formatValorAuditoria(campo, valor, referencias),
      };
      await marcarProgresso(95, formato === "excel" ? "Gerando a planilha Excel..." : "Gerando o PDF...", coletados.length, total);
      if (formato === "excel") gerarRelatorioAuditoriaExcel(params);
      else gerarRelatorioAuditoriaPdf(params);
      await marcarProgresso(100, "Relatório pronto.", coletados.length, total);
      toast.success(`${coletados.length} alteração(ões) no relatório.`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar o relatório");
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <MainLayout
      title="Auditoria de Itens"
      subtitle="Histórico de criação, atualização e exclusão de tarefas, prazos, eventos, audiências e parcelamentos."
    >
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipoItem} onValueChange={setTipoItem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ação</Label>
            <Select value={acao} onValueChange={setAcao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {ACOES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Resultado</Label>
            <Select value={sucesso} onValueChange={setSucesso}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sim">Sucesso</SelectItem>
                <SelectItem value="nao">Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Origem (tela)</Label>
            <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="ex: nova_tarefa_page" />
          </div>
          <div>
            <Label>Coordenação</Label>
            <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(coordenacoes || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Usuário</Label>
            <Input value={buscaUsuario} onChange={(e) => setBuscaUsuario(e.target.value)} placeholder="nome ou e-mail" />
          </div>
          <div>
            <Label>De</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="md:col-span-3 lg:col-span-6 flex justify-end gap-2">
            {podeRelatorio && (
              <Button onClick={() => gerarRelatorio("pdf")} variant="outline" disabled={gerandoPdf}>
                {gerandoPdf ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                Relatório de Auditoria (PDF)
              </Button>
            )}
            {podeRelatorio && (
              <Button onClick={() => gerarRelatorio("excel")} variant="outline" disabled={gerandoPdf}>
                {gerandoPdf ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Relatório de Auditoria (Excel)
              </Button>
            )}
            <Button onClick={() => refetch()} variant="secondary">
              <Search className="w-4 h-4 mr-2" /> Aplicar
            </Button>
          </div>
          {gerandoPdf && (
            <div className="md:col-span-3 lg:col-span-6 space-y-2 rounded-md border bg-muted/30 p-3" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{progressoRelatorio.etapa}</span>
                <span className="font-medium tabular-nums">{progressoRelatorio.valor}%</span>
              </div>
              <Progress value={progressoRelatorio.valor} className="h-2" />
              {progressoRelatorio.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {progressoRelatorio.carregados.toLocaleString("pt-BR")} de {progressoRelatorio.total.toLocaleString("pt-BR")} alterações carregadas
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Registros {rows ? `(${rowsFiltradas.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rowsFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Nenhum registro encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>O que foi alterado</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsFiltradas.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{nomeUsuario(r.usuario_id)}</div>
                        {emailUsuario(r.usuario_id) && (
                          <div className="text-[11px] text-muted-foreground">{emailUsuario(r.usuario_id)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.tipo_item || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[220px] truncate" title={getTituloItem(r)}>
                        {getTituloItem(r)}
                      </TableCell>
                      <TableCell className="text-xs">{r.acao}</TableCell>
                      <TableCell className="text-xs max-w-[320px]">
                        {getDiff(r).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {getDiff(r).slice(0, 4).map((d) => (
                              <Badge
                                key={d.campo}
                                variant="secondary"
                                className="text-[10px]"
                                title={`${labelCampo(d.campo)}: ${formatValorAuditoria(d.campo, d.de, referenciasVisiveis)} → ${formatValorAuditoria(d.campo, d.para, referenciasVisiveis)}`}
                              >
                                {labelCampo(d.campo)}
                              </Badge>
                            ))}
                            {getDiff(r).length > 4 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{getDiff(r).length - 4}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.sucesso ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle2 className="w-4 h-4" /> Sucesso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                            <XCircle className="w-4 h-4" /> Falha
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{labelOrigem(r.origem)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do registro</DialogTitle>
          </DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 text-sm pr-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Data:</span> {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</div>
                  <div>
                    <span className="text-muted-foreground">Alterado por:</span>{" "}
                    <span className="font-medium">{nomeUsuario(selected.usuario_id)}</span>
                    {emailUsuario(selected.usuario_id) && (
                      <span className="text-muted-foreground"> ({emailUsuario(selected.usuario_id)})</span>
                    )}
                  </div>
                  <div><span className="text-muted-foreground">Tipo:</span> {selected.tipo_item || "—"}</div>
                  <div><span className="text-muted-foreground">Item:</span> {getTituloItem(selected)}</div>
                  <div><span className="text-muted-foreground">Ação:</span> {selected.acao}</div>
                  <div><span className="text-muted-foreground">Origem:</span> {labelOrigem(selected.origem)}</div>
                  <div><span className="text-muted-foreground">Resultado:</span> {selected.sucesso ? "Sucesso" : "Falha"}</div>
                  <div><span className="text-muted-foreground">Processo:</span>{" "}
                    {!selected.processo_id ? "—" : processoSelecionado ? (
                      <Link to={`/processos/${processoSelecionado.id}`} className="text-primary underline">
                        {processoSelecionado.numero || "Abrir processo"}
                      </Link>
                    ) : processoSelecionado === null ? "Processo excluído" : "Carregando..."}
                  </div>
                  <div><span className="text-muted-foreground">Coordenação:</span> {nomeCoordenacaoRegistro(selected.coordenacao_id)}</div>
                </div>
                {getDiff(selected).length > 0 && (
                  <div>
                    <div className="font-medium mb-2">O que foi alterado ({getDiff(selected).length})</div>
                    <div className="rounded border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[30%]">Campo</TableHead>
                            <TableHead>De</TableHead>
                            <TableHead>Para</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getDiff(selected).map((d) => (
                            <TableRow key={d.campo}>
                              <TableCell className="text-xs font-medium">{labelCampo(d.campo)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground line-through">{formatValorAuditoria(d.campo, d.de, referenciasSelecionado)}</TableCell>
                              <TableCell className="text-xs font-medium">{formatValorAuditoria(d.campo, d.para, referenciasSelecionado)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                {selected.erro_mensagem && (
                  <div>
                    <div className="font-medium text-red-600 mb-1">Erro</div>
                    <pre className="bg-red-50 dark:bg-red-950/20 p-3 rounded text-xs whitespace-pre-wrap">{selected.erro_mensagem}</pre>
                    {selected.erro_detalhes && (
                      <pre className="bg-muted p-3 rounded text-xs mt-2 whitespace-pre-wrap">{JSON.stringify(selected.erro_detalhes, null, 2)}</pre>
                    )}
                  </div>
                )}
                <div>
                  <div className="font-medium mb-1">Dados de entrada</div>
                  <div className="bg-muted p-3 rounded text-xs space-y-1">
                    {linhasDadosAuditoria(selected.dados_entrada, referenciasSelecionado).map((l) => (
                      <div key={l.rotulo}><span className="text-muted-foreground">{l.rotulo}:</span> <span className="font-medium">{l.valor}</span></div>
                    ))}
                  </div>
                  <details className="mt-1"><summary className="text-xs text-muted-foreground cursor-pointer">Ver dados técnicos</summary>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">{JSON.stringify(selected.dados_entrada, null, 2)}</pre></details>
                </div>
                {selected.dados_saida && (
                  <div>
                    <div className="font-medium mb-1">Dados de saída</div>
                    <div className="bg-muted p-3 rounded text-xs space-y-1">
                    {linhasDadosAuditoria(selected.dados_saida, referenciasSelecionado).map((l) => (
                      <div key={l.rotulo}><span className="text-muted-foreground">{l.rotulo}:</span> <span className="font-medium">{l.valor}</span></div>
                    ))}
                  </div>
                  <details className="mt-1"><summary className="text-xs text-muted-foreground cursor-pointer">Ver dados técnicos</summary>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">{JSON.stringify(selected.dados_saida, null, 2)}</pre></details>
                  </div>
                )}
                {selected.user_agent && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">User agent:</span> {selected.user_agent}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  );
}