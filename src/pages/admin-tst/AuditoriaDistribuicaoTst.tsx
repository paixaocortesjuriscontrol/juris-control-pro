import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, Search, Eye, Download, History, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useAuditoriaDistribuicaoTst,
  AuditoriaDistTstRow,
} from "@/hooks/useAuditoriaDistribuicaoTst";
import { useUsuariosAuditoria } from "@/hooks/useUsuariosAuditoria";
import { HistoricoDistribuicaoTstDialog } from "@/components/auditoria/HistoricoDistribuicaoTstDialog";
import {
  labelAcaoDistTst, labelCampoDistTst, labelOrigemDistTst, formatValorAuditoria,
} from "@/utils/auditoriaDistTstLabels";

const TODOS = "__todos__";

export default function AuditoriaDistribuicaoTst() {
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [usuarioId, setUsuarioId] = useState(TODOS);
  const [coordenacaoId, setCoordenacaoId] = useState(TODOS);
  const [acao, setAcao] = useState(TODOS);
  const [origem, setOrigem] = useState("");
  const [campo, setCampo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditoriaDistTstRow | null>(null);
  const [historico, setHistorico] = useState<AuditoriaDistTstRow | null>(null);

  const filtros = useMemo(
    () => ({
      busca: buscaAplicada,
      usuarioId: usuarioId === TODOS ? undefined : usuarioId,
      coordenacaoId: coordenacaoId === TODOS ? undefined : coordenacaoId,
      acao: acao === TODOS ? undefined : acao,
      origem: origem.trim() || undefined,
      campo: campo.trim() || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      page,
    }),
    [buscaAplicada, usuarioId, coordenacaoId, acao, origem, campo, dataInicio, dataFim, page]
  );

  const { data, isLoading, isFetching, refetch } = useAuditoriaDistribuicaoTst(filtros);
  const rows = data?.rows || [];
  const { nome, email } = useUsuariosAuditoria(rows.map((r) => r.usuario_id));

  const { data: coordenacoes } = useQuery({
    queryKey: ["auditoria-dist-tst-coordenacoes"],
    queryFn: async () => {
      const { data } = await supabase.from("coordenacoes").select("id, nome").order("nome");
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const { data: usuarios } = useQuery({
    queryKey: ["auditoria-dist-tst-usuarios"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, email").order("nome");
      return (data || []) as { id: string; nome: string | null; email: string | null }[];
    },
  });

  const nomeCoordenacao = (id: string | null) =>
    (id && coordenacoes?.find((c) => c.id === id)?.nome) || "—";

  const aplicar = () => {
    setBuscaAplicada(busca);
    setPage(0);
    refetch();
  };

  const limpar = () => {
    setBusca("");
    setBuscaAplicada("");
    setUsuarioId(TODOS);
    setCoordenacaoId(TODOS);
    setAcao(TODOS);
    setOrigem("");
    setCampo("");
    setDataInicio("");
    setDataFim("");
    setPage(0);
  };

  const exportar = () => {
    const linhas = rows.flatMap((r) => {
      const base = {
        "Data/Hora": format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss"),
        Usuário: nome(r.usuario_id),
        "E-mail": email(r.usuario_id),
        Processo: r.processo || "",
        Dossiê: r.dossie || "",
        Equipe: r.equipe || "",
        Coordenação: nomeCoordenacao(r.coordenacao_id),
        Ação: labelAcaoDistTst(r.acao),
        Origem: labelOrigemDistTst(r.origem),
      };
      const diffs = r.campos_alterados || [];
      if (diffs.length === 0) return [{ ...base, Campo: "", De: "", Para: "" }];
      return diffs.map((d) => ({
        ...base,
        Campo: labelCampoDistTst(d.campo),
        De: formatValorAuditoria(d.de),
        Para: formatValorAuditoria(d.para),
      }));
    });
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria TST");
    XLSX.writeFile(wb, `auditoria-distribuicao-tst-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`);
  };

  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 100;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  return (
    <MainLayout
      title="Auditoria da Distribuição TST"
      subtitle="Histórico completo de criações, alterações e exclusões dos registros da Distribuição TST."
    >
      <div className="p-4 lg:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <Label>Processo ou dossiê</Label>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && aplicar()}
                placeholder="0011151-63.2024.5.03.0017 ou 07.02.033.0004156678/24"
              />
            </div>
            <div>
              <Label>Ação</Label>
              <Select value={acao} onValueChange={(v) => { setAcao(v); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  <SelectItem value="criar">Criado</SelectItem>
                  <SelectItem value="atualizar">Alterado</SelectItem>
                  <SelectItem value="deletar">Excluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Usuário</Label>
              <Select value={usuarioId} onValueChange={(v) => { setUsuarioId(v); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {(usuarios || []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome || u.email || u.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Coordenação</Label>
              <Select value={coordenacaoId} onValueChange={(v) => { setCoordenacaoId(v); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {(coordenacoes || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campo alterado</Label>
              <Input value={campo} onChange={(e) => { setCampo(e.target.value); setPage(0); }} placeholder="ex: data_julgamento" />
            </div>
            <div>
              <Label>Origem</Label>
              <Input value={origem} onChange={(e) => { setOrigem(e.target.value); setPage(0); }} placeholder="ex: importacao" />
            </div>
            <div>
              <Label>De</Label>
              <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPage(0); }} />
            </div>
            <div>
              <Label>Até</Label>
              <Input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPage(0); }} />
            </div>
            <div className="md:col-span-3 lg:col-span-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={limpar}><X className="w-4 h-4 mr-2" /> Limpar</Button>
              <Button variant="outline" onClick={exportar} disabled={rows.length === 0}>
                <Download className="w-4 h-4 mr-2" /> Exportar Excel
              </Button>
              <Button onClick={aplicar} variant="secondary">
                <Search className="w-4 h-4 mr-2" /> Aplicar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">
              Registros {total ? `(${total})` : ""}
              {isFetching && <Loader2 className="inline w-4 h-4 ml-2 animate-spin text-muted-foreground" />}
            </CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Anterior
              </Button>
              <span className="text-muted-foreground">Página {page + 1} de {totalPaginas}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={page + 1 >= totalPaginas}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                Nenhum registro encontrado. A auditoria registra as alterações feitas a partir da sua ativação.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Processo / Dossiê</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>O que foi alterado</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="w-[110px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const diffs = r.campos_alterados || [];
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">{nome(r.usuario_id)}</div>
                            {email(r.usuario_id) && (
                              <div className="text-[11px] text-muted-foreground">{email(r.usuario_id)}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">{r.processo || "—"}</div>
                            <div className="text-[11px] text-muted-foreground">{r.dossie || "—"}</div>
                          </TableCell>
                          <TableCell className="text-xs">{r.equipe || nomeCoordenacao(r.coordenacao_id)}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline">{labelAcaoDistTst(r.acao)}</Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[340px]">
                            {diffs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {diffs.slice(0, 5).map((d) => (
                                  <Badge
                                    key={d.campo}
                                    variant="secondary"
                                    className="text-[10px]"
                                    title={`${labelCampoDistTst(d.campo)}: ${formatValorAuditoria(d.de)} → ${formatValorAuditoria(d.para)}`}
                                  >
                                    {labelCampoDistTst(d.campo)}
                                  </Badge>
                                ))}
                                {diffs.length > 5 && (
                                  <Badge variant="outline" className="text-[10px]">+{diffs.length - 5}</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{labelOrigemDistTst(r.origem)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Button size="sm" variant="ghost" title="Detalhes" onClick={() => setSelected(r)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Histórico do processo" onClick={() => setHistorico(r)}>
                              <History className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes da alteração</DialogTitle>
          </DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 text-sm pr-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Data:</span> {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</div>
                  <div>
                    <span className="text-muted-foreground">Alterado por:</span>{" "}
                    <span className="font-medium">{nome(selected.usuario_id)}</span>
                    {email(selected.usuario_id) && (
                      <span className="text-muted-foreground"> ({email(selected.usuario_id)})</span>
                    )}
                  </div>
                  <div><span className="text-muted-foreground">Processo:</span> {selected.processo || "—"}</div>
                  <div><span className="text-muted-foreground">Dossiê:</span> {selected.dossie || "—"}</div>
                  <div><span className="text-muted-foreground">Equipe:</span> {selected.equipe || "—"}</div>
                  <div><span className="text-muted-foreground">Coordenação:</span> {nomeCoordenacao(selected.coordenacao_id)}</div>
                  <div><span className="text-muted-foreground">Ação:</span> {labelAcaoDistTst(selected.acao)}</div>
                  <div><span className="text-muted-foreground">Origem:</span> {labelOrigemDistTst(selected.origem)}</div>
                </div>

                {(selected.campos_alterados || []).length > 0 && (
                  <div>
                    <div className="font-medium mb-2">
                      O que foi alterado ({(selected.campos_alterados || []).length})
                    </div>
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
                          {(selected.campos_alterados || []).map((d) => (
                            <TableRow key={d.campo}>
                              <TableCell className="text-xs font-medium">{labelCampoDistTst(d.campo)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground line-through break-words">
                                {formatValorAuditoria(d.de)}
                              </TableCell>
                              <TableCell className="text-xs font-medium break-words">
                                {formatValorAuditoria(d.para)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {selected.dados_antes && (
                  <div>
                    <div className="font-medium mb-1">Registro antes</div>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">{JSON.stringify(selected.dados_antes, null, 2)}</pre>
                  </div>
                )}
                {selected.dados_depois && (
                  <div>
                    <div className="font-medium mb-1">Registro depois</div>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">{JSON.stringify(selected.dados_depois, null, 2)}</pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <HistoricoDistribuicaoTstDialog
        open={!!historico}
        onOpenChange={(o) => !o && setHistorico(null)}
        dadosBennerId={historico?.dados_benner_id}
        processo={historico?.processo}
        dossie={historico?.dossie}
      />
    </MainLayout>
  );
}