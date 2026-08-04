import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Eye, Download, X } from "lucide-react";
import { format } from "date-fns";
import {
  useAuditoriaLotesAdminTst,
  AuditoriaLoteRow,
} from "@/hooks/useAuditoriaLotesAdminTst";
import {
  TIPOS_LOTE_ADMIN_TST,
  labelTipoLoteAdminTst,
  labelStatusLoteAdminTst,
} from "@/lib/auditoriaLoteAdminTst";

const TODOS = "__todos__";

const statusVariant = (status: string) =>
  status === "concluida" ? "default" : status === "erro" ? "destructive" : "secondary";

const dataHora = (v?: string | null) =>
  v ? format(new Date(v), "dd/MM/yyyy HH:mm:ss") : "—";

const duracao = (row: AuditoriaLoteRow) => {
  if (!row.finalizado_em) return "—";
  const ms = new Date(row.finalizado_em).getTime() - new Date(row.iniciado_em).getTime();
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;
};

export default function AuditoriaLotesAdminTst() {
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [tipo, setTipo] = useState(TODOS);
  const [status, setStatus] = useState(TODOS);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditoriaLoteRow | null>(null);

  const filtros = useMemo(
    () => ({
      busca: buscaAplicada || undefined,
      tipo: tipo === TODOS ? undefined : tipo,
      status: status === TODOS ? undefined : status,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      page,
    }),
    [buscaAplicada, tipo, status, dataInicio, dataFim, page]
  );

  const { data, isLoading, isFetching, refetch } = useAuditoriaLotesAdminTst(filtros);
  const rows = data?.rows || [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  const limpar = () => {
    setBusca("");
    setBuscaAplicada("");
    setTipo(TODOS);
    setStatus(TODOS);
    setDataInicio("");
    setDataFim("");
    setPage(0);
  };

  const exportar = () => {
    const linhas = rows.flatMap((r) => {
      const base = {
        "Data/Hora": dataHora(r.created_at),
        Operação: labelTipoLoteAdminTst(r.tipo_operacao),
        Usuário: r.usuario_nome || r.usuario_email || "—",
        "E-mail": r.usuario_email || "",
        Arquivo: r.arquivo_nome || "",
        Situação: labelStatusLoteAdminTst(r.status),
        Linhas: r.total_linhas,
        Criados: r.total_criados,
        Atualizados: r.total_atualizados,
        Ignorados: r.total_ignorados,
        Erros: r.total_erros,
        Resumo: r.resumo || "",
      };
      const itens = r.itens || [];
      if (itens.length === 0) return [{ ...base, Processo: "", Dossiê: "", Ação: "", Detalhe: "" }];
      return itens.map((i) => ({
        ...base,
        Processo: i.processo || "",
        Dossiê: i.dossie || "",
        Ação: i.acao || "",
        Detalhe: i.detalhe || "",
      }));
    });
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria Lotes");
    XLSX.writeFile(wb, `auditoria-lotes-admin-tst-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`);
  };

  return (
    <MainLayout
      title="Auditoria de Importações em Lote"
      subtitle="Histórico de tudo que foi gravado em lote pelas ferramentas do Admin. TST: quem executou, quando, com qual arquivo e quais processos foram afetados."
    >
      <div className="p-4 lg:p-6 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2 space-y-1">
              <Label className="text-xs">Busca (arquivo, usuário, resumo)</Label>
              <div className="flex gap-2">
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setBuscaAplicada(busca);
                      setPage(0);
                    }
                  }}
                  placeholder="planilha.xlsx, e-mail…"
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBuscaAplicada(busca);
                    setPage(0);
                  }}
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de operação</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {TIPOS_LOTE_ADMIN_TST.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Situação</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPage(0); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPage(0); }} />
            </div>
            <div className="md:col-span-3 lg:col-span-6 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={limpar}>
                <X className="w-4 h-4 mr-1" /> Limpar
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={exportar} disabled={rows.length === 0}>
                <Download className="w-4 h-4 mr-1" /> Exportar Excel
              </Button>
              <span className="text-xs text-muted-foreground self-center ml-auto">
                {total} execuç{total === 1 ? "ão" : "ões"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="text-right">Linhas</TableHead>
                    <TableHead className="text-right">Criados</TableHead>
                    <TableHead className="text-right">Atualiz.</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin inline" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-sm text-muted-foreground">
                        Nenhuma execução em lote registrada com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <TableCell className="whitespace-nowrap text-xs">{dataHora(r.created_at)}</TableCell>
                      <TableCell className="text-xs font-medium">{labelTipoLoteAdminTst(r.tipo_operacao)}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{r.usuario_nome || "—"}</div>
                        <div className="text-muted-foreground">{r.usuario_email || ""}</div>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{r.arquivo_nome || "—"}</TableCell>
                      <TableCell className="text-right text-xs">{r.total_linhas}</TableCell>
                      <TableCell className="text-right text-xs">{r.total_criados}</TableCell>
                      <TableCell className="text-right text-xs">{r.total_atualizados}</TableCell>
                      <TableCell className="text-right text-xs">{r.total_erros}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{duracao(r)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status) as any}>{labelStatusLoteAdminTst(r.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPaginas}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selected ? labelTipoLoteAdminTst(selected.tipo_operacao) : ""}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span className="text-muted-foreground">Início:</span> {dataHora(selected.iniciado_em)}</div>
                <div><span className="text-muted-foreground">Fim:</span> {dataHora(selected.finalizado_em)}</div>
                <div><span className="text-muted-foreground">Duração:</span> {duracao(selected)}</div>
                <div><span className="text-muted-foreground">Situação:</span> {labelStatusLoteAdminTst(selected.status)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Usuário:</span> {selected.usuario_nome || "—"} {selected.usuario_email ? `(${selected.usuario_email})` : ""}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Arquivo:</span> {selected.arquivo_nome || "—"}</div>
                <div><span className="text-muted-foreground">Linhas:</span> {selected.total_linhas}</div>
                <div><span className="text-muted-foreground">Criados:</span> {selected.total_criados}</div>
                <div><span className="text-muted-foreground">Atualizados:</span> {selected.total_atualizados}</div>
                <div><span className="text-muted-foreground">Ignorados / Erros:</span> {selected.total_ignorados} / {selected.total_erros}</div>
              </div>

              {selected.resumo && (
                <p className="text-xs bg-muted/50 rounded p-2">{selected.resumo}</p>
              )}
              {selected.erro_mensagem && (
                <p className="text-xs text-destructive bg-destructive/10 rounded p-2">{selected.erro_mensagem}</p>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">
                  Processos afetados ({(selected.itens || []).length})
                </h4>
                <ScrollArea className="h-[320px] border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Processo</TableHead>
                        <TableHead>Dossiê</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Detalhe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selected.itens || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                            Nenhum item detalhado nesta execução.
                          </TableCell>
                        </TableRow>
                      )}
                      {(selected.itens || []).map((i, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-mono">{i.processo || "—"}</TableCell>
                          <TableCell className="text-xs">{i.dossie || "—"}</TableCell>
                          <TableCell className="text-xs">{i.acao || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {i.detalhe || (i.campos ? JSON.stringify(i.campos) : "—")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}