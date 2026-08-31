import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Download, Mail, Upload, Ban, CheckCircle2, FileSpreadsheet, Loader2, Settings, ArrowLeft, Trash2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  useRemessasBenner,
  useRemessaItens,
  baixarArquivoRemessa,
  useEnviarRemessaEmail,
  useMarcarRemessaEnviada,
  useCancelarRemessa,
  useConciliarRetorno,
  useAlterarStatusRemessa,
  useExcluirRemessa,
  type RemessaBenner,
} from "@/hooks/useRemessasBenner";
import {
  useConfiguracaoCargaBenner,
  aplicarPlaceholders,
} from "@/hooks/useConfiguracoesCargaBenner";
import { useUserRole } from "@/hooks/useUserRole";
import { ProcessoTagPicker } from "@/components/distribuicao-tst/ProcessoTagPicker";
import { useTagsForRemessas, useTagsForDados } from "@/hooks/useProcessoTags";

import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";

const STATUS_COLORS: Record<string, string> = {
  gerada: "bg-slate-200 text-slate-800",
  enviada: "bg-blue-200 text-blue-900",
  retornada: "bg-amber-200 text-amber-900",
  conciliada: "bg-green-200 text-green-900",
  cancelada: "bg-red-200 text-red-900",
};

export default function RemessasBenner() {
  const { data: remessas = [], isLoading } = useRemessasBenner();
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [selected, setSelected] = useState<RemessaBenner | null>(null);
  const { isAdmin, isAdminOrCoordinator } = useUserRole();
  const navigate = useNavigate();
  const alterarStatus = useAlterarStatusRemessa();
  const excluir = useExcluirRemessa();

  const filtered = useMemo(() => {
    if (filterStatus === "todos") return remessas;
    return remessas.filter((r) => r.status === filterStatus);
  }, [remessas, filterStatus]);

  // TAGs (mesmo catálogo da Distribuição TST) aplicadas a cada remessa.
  const remessaIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const { data: tagsMap } = useTagsForRemessas(remessaIds);


  return (
    <MainLayout
      title="Remessas Benner"
      subtitle="Controle das remessas enviadas ao Benner: geração, envio, retorno e conciliação."
    >
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Remessas Carga Benner</h1>
            <p className="text-sm text-muted-foreground">Histórico de envios e conciliação com o Santander</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="gerada">Gerada</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="retornada">Retornada</SelectItem>
              <SelectItem value="conciliada">Conciliada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild variant="outline" size="sm">
            <Link to="/remessas-benner/configuracoes">
              <Settings className="w-4 h-4 mr-1" /> Configurações
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin inline mr-2" />Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-50" />
              Nenhuma remessa encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Geração</TableHead>
                  <TableHead>Envio</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Aceitos</TableHead>
                  <TableHead className="text-right">Rejeitados</TableHead>
                  <TableHead className="text-right">Pendentes</TableHead>
                  <TableHead>TAGs</TableHead>
                  <TableHead>Arquivo</TableHead>

                  {isAdminOrCoordinator && <TableHead className="w-12 text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                    <TableCell className="font-mono font-semibold">{r.numero_sequencial}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(r.data_geracao), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{r.data_envio ? format(new Date(r.data_envio), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{r.quantidade_itens}</TableCell>
                    <TableCell className="text-right font-mono text-green-700">{r.quantidade_aceitos}</TableCell>
                    <TableCell className="text-right font-mono text-red-700">{r.quantidade_rejeitados}</TableCell>
                    <TableCell className="text-right font-mono text-amber-700">{r.quantidade_pendentes}</TableCell>
                    <TableCell className="max-w-[220px]" onClick={(e) => e.stopPropagation()}>
                      <ProcessoTagPicker
                        entidade="remessa"
                        dadoId={r.id}
                        tagIds={tagsMap?.get(r.id) || []}
                        readOnly={!isAdminOrCoordinator}
                        compact
                      />
                    </TableCell>
                    <TableCell className="text-xs max-w-[220px]" onClick={(e) => e.stopPropagation()}>

                      {r.arquivo_path ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-primary hover:underline truncate max-w-full"
                          title={`Baixar ${r.arquivo_nome || "planilha de carga"}`}
                          onClick={() => baixarArquivoRemessa(r.arquivo_path!, r.arquivo_nome || `remessa-${r.numero_sequencial}.xlsx`)}
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{r.arquivo_nome || "Baixar planilha"}</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {isAdminOrCoordinator && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {r.arquivo_path && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => baixarArquivoRemessa(r.arquivo_path!, r.arquivo_nome || `remessa-${r.numero_sequencial}.xlsx`)}
                                >
                                  <Download className="w-4 h-4 mr-2" /> Baixar planilha de carga
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuLabel>Alterar status</DropdownMenuLabel>

                            {(["gerada","enviada","retornada","conciliada","cancelada"] as const)
                              .filter((s) => s !== r.status)
                              .map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  onClick={() => alterarStatus.mutate({ remessaId: r.id, status: s })}
                                >
                                  <Badge className={STATUS_COLORS[s] + " mr-2"}>{s}</Badge>
                                </DropdownMenuItem>
                              ))}
                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => {
                                    if (confirm(`Excluir definitivamente a remessa ${r.numero_sequencial}? Esta ação não pode ser desfeita.`)) {
                                      excluir.mutate(r);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Excluir remessa
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <RemessaDetailDrawer remessa={selected} onClose={() => setSelected(null)} />
      )}
    </div>
    </MainLayout>
  );
}

function RemessaDetailDrawer({ remessa, onClose }: { remessa: RemessaBenner; onClose: () => void }) {
  const { data: itens = [] } = useRemessaItens(remessa.id);
  const { isAdminOrCoordinator } = useUserRole();
  const podeEditarTags = isAdminOrCoordinator;

  const dadoIds = useMemo(
    () => itens.map((i) => i.dado_benner_id).filter(Boolean) as string[],
    [itens],
  );
  const { data: tagsItensMap } = useTagsForDados(dadoIds);

  const marcarEnviada = useMarcarRemessaEnviada();
  const cancelar = useCancelarRemessa();
  const conciliar = useConciliarRetorno();
  const [emailOpen, setEmailOpen] = useState(false);
  const [retornoOpen, setRetornoOpen] = useState(false);

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono">{remessa.numero_sequencial}</span>
            <Badge className={STATUS_COLORS[remessa.status]}>{remessa.status}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Geração" value={format(new Date(remessa.data_geracao), "dd/MM/yyyy HH:mm")} />
            <Info label="Envio" value={remessa.data_envio ? format(new Date(remessa.data_envio), "dd/MM/yyyy HH:mm") : "—"} />
            <Info label="Conciliação" value={remessa.data_conciliacao ? format(new Date(remessa.data_conciliacao), "dd/MM/yyyy HH:mm") : "—"} />
            <Info label="Itens" value={String(remessa.quantidade_itens)} />
            <Info label="Aceitos" value={String(remessa.quantidade_aceitos)} />
            <Info label="Rejeitados" value={String(remessa.quantidade_rejeitados)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {remessa.arquivo_path && (
              <Button size="sm" variant="outline" onClick={() => baixarArquivoRemessa(remessa.arquivo_path!, remessa.arquivo_nome || "remessa.xlsx")}>
                <Download className="w-4 h-4 mr-1" /> Baixar planilha
              </Button>
            )}
            {(remessa.status === "gerada" || remessa.status === "enviada") && (
              <Button size="sm" onClick={() => setEmailOpen(true)}>
                <Mail className="w-4 h-4 mr-1" /> Enviar por e-mail
              </Button>
            )}
            {remessa.status === "gerada" && (
              <Button size="sm" variant="outline" onClick={() => marcarEnviada.mutate(remessa.id)}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar como enviada
              </Button>
            )}
            {(remessa.status === "enviada" || remessa.status === "retornada") && (
              <Button size="sm" variant="outline" onClick={() => setRetornoOpen(true)}>
                <Upload className="w-4 h-4 mr-1" /> Importar retorno
              </Button>
            )}
            {remessa.status !== "cancelada" && remessa.status !== "conciliada" && (
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => {
                if (confirm("Cancelar esta remessa?")) cancelar.mutate(remessa.id);
              }}>
                <Ban className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            )}
          </div>

          {remessa.email_destinatarios && remessa.email_destinatarios.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Último envio</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                <div><strong>Para:</strong> {remessa.email_destinatarios.join(", ")}</div>
                {remessa.email_cc && remessa.email_cc.length > 0 && <div><strong>CC:</strong> {remessa.email_cc.join(", ")}</div>}
                {remessa.email_assunto && <div><strong>Assunto:</strong> {remessa.email_assunto}</div>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Dossiês ({itens.length})</CardTitle></CardHeader>
            <CardContent className="p-0 max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dossiê</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead>TAGs</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.slice(0, 500).map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-mono text-xs">{it.dossie}</TableCell>
                      <TableCell className="font-mono text-xs">{it.processo}</TableCell>
                      <TableCell>
                        {it.dado_benner_id ? (
                          <ProcessoTagPicker
                            dadoId={it.dado_benner_id}
                            tagIds={tagsItensMap?.get(it.dado_benner_id) || []}
                            readOnly={!podeEditarTags}
                            compact
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          it.status_retorno === "aceito" ? "border-green-600 text-green-700" :
                          it.status_retorno === "rejeitado" ? "border-red-600 text-red-700" :
                          "border-amber-600 text-amber-700"
                        }>{it.status_retorno}</Badge>

                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {itens.length > 500 && (
                <p className="text-xs text-muted-foreground p-2 text-center">Mostrando 500 de {itens.length}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {emailOpen && (
          <EnviarEmailDialog
            remessa={remessa}
            onClose={() => setEmailOpen(false)}
          />
        )}

        {retornoOpen && (
          <ImportarRetornoDialog
            remessaId={remessa.id}
            onClose={() => setRetornoOpen(false)}
            onConciliar={(updates) =>
              conciliar.mutateAsync({ remessaId: remessa.id, atualizacoes: updates }).then(() => setRetornoOpen(false))
            }
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function EnviarEmailDialog({ remessa, onClose }: { remessa: RemessaBenner; onClose: () => void }) {
  const enviar = useEnviarRemessaEmail();
  const { data: cfg } = useConfiguracaoCargaBenner();
  const vars = { numero: remessa.numero_sequencial, quantidade: remessa.quantidade_itens };
  const [de, setDe] = useState<string>(
    (cfg as any)?.email_remetente_padrao || "Carga Benner <remessa_benner@juriscontrol.adv.br>"
  );
  const [para, setPara] = useState(
    (remessa.email_destinatarios && remessa.email_destinatarios.length > 0
      ? remessa.email_destinatarios
      : cfg?.email_padrao_para || []
    ).join(", ")
  );
  const [cc, setCc] = useState(
    (remessa.email_cc && remessa.email_cc.length > 0
      ? remessa.email_cc
      : cfg?.email_padrao_cc || []
    ).join(", ")
  );
  const [assunto, setAssunto] = useState(
    remessa.email_assunto ||
      aplicarPlaceholders(cfg?.email_assunto_padrao || `Carga Benner - Remessa {numero}`, vars)
  );
  const [corpo, setCorpo] = useState(
    remessa.email_corpo ||
      aplicarPlaceholders(
        cfg?.email_corpo_padrao ||
          `Prezados,\n\nSegue em anexo a remessa {numero} com {quantidade} dossiê(s).\n\nAtenciosamente.`,
        vars
      )
  );

  // Reaproveita defaults se a configuração carregar depois da abertura
  // (apenas quando o usuário ainda não digitou nada)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (!cfg) return;
    if (!para && cfg.email_padrao_para?.length) setPara(cfg.email_padrao_para.join(", "));
    if (!cc && cfg.email_padrao_cc?.length) setCc(cfg.email_padrao_cc.join(", "));
    if (!de && (cfg as any).email_remetente_padrao) setDe((cfg as any).email_remetente_padrao);
  }, [cfg]);

  const onSubmit = async () => {
    const paraArr = para.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const ccArr = cc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (paraArr.length === 0) return toast.error("Informe ao menos um destinatário");
    await enviar.mutateAsync({ remessaId: remessa.id, para: paraArr, cc: ccArr, assunto, corpo, de: de.trim() || undefined });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar remessa {remessa.numero_sequencial}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">De (remetente)</label>
            <Input
              value={de}
              onChange={(e) => setDe(e.target.value)}
              placeholder='Ex.: "Carga Benner <noreply@seudominio.com>" ou onboarding@resend.dev'
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use um e-mail de um domínio verificado no Resend. Sem domínio verificado, use <code>onboarding@resend.dev</code> e envie apenas para o e-mail cadastrado na conta Resend.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Para</label>
            <Input value={para} onChange={(e) => setPara(e.target.value)} placeholder="separar por vírgula" />
          </div>
          <div>
            <label className="text-sm font-medium">CC</label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="opcional" />
          </div>
          <div>
            <label className="text-sm font-medium">Assunto</label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Corpo</label>
            <Textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={8} />
          </div>
          <p className="text-xs text-muted-foreground">A planilha será anexada automaticamente.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={enviar.isPending}>
            {enviar.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportarRetornoDialog({
  remessaId,
  onClose,
  onConciliar,
}: {
  remessaId: string;
  onClose: () => void;
  onConciliar: (updates: { dossie: string; status: "aceito" | "rejeitado"; motivo?: string }[]) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleProcess = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    setProcessing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      const updates = rows
        .map((r) => {
          const dossie = String(r["Dossiê"] || r["Dossie"] || r["dossie"] || r["DOSSIE"] || "").trim();
          const statusRaw = String(r["Status"] || r["status"] || r["Resultado"] || "").toLowerCase();
          const motivo = String(r["Motivo"] || r["motivo"] || r["Observação"] || "").trim();
          let status: "aceito" | "rejeitado" | null = null;
          if (statusRaw.includes("aceit") || statusRaw === "ok" || statusRaw.includes("sucesso")) status = "aceito";
          else if (statusRaw.includes("rejeit") || statusRaw.includes("erro") || statusRaw.includes("falh")) status = "rejeitado";
          if (!dossie || !status) return null;
          return { dossie, status, motivo: motivo || undefined };
        })
        .filter(Boolean) as { dossie: string; status: "aceito" | "rejeitado"; motivo?: string }[];

      if (updates.length === 0) {
        toast.error("Nenhuma linha válida encontrada. Esperado: colunas 'Dossiê' e 'Status'.");
        setProcessing(false);
        return;
      }

      await onConciliar(updates);
    } catch (err: any) {
      toast.error("Erro ao processar: " + (err?.message || String(err)));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar retorno do Santander</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Envie a planilha de retorno do banco. Devem existir as colunas <strong>Dossiê</strong> e <strong>Status</strong>
            (aceito / rejeitado). Coluna <strong>Motivo</strong> é opcional.
          </p>
          <Input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleProcess} disabled={!file || processing}>
            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
            Conciliar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}