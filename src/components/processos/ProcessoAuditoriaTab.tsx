import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck, Eye, RefreshCw, PlusCircle, Pencil, Trash2, AlertTriangle, Lock,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

interface Props {
  processoId?: string | null;
  processoNumero?: string | null;
}

type AuditRow = {
  id: string;
  created_at: string;
  usuario_id: string | null;
  acao: string;
  sucesso: boolean;
  origem: string | null;
  tipo_item: string | null;
  processo_id: string | null;
  tarefa_id: string | null;
  dados_entrada: any;
  dados_saida: any;
  campos_alterados: any;
  erro_mensagem: string | null;
};

const LABELS: Record<string, string> = {
  titulo: "Título", descricao: "Descrição", observacoes: "Observações",
  observacao: "Observação", status: "Situação", situacao: "Situação",
  prioridade: "Prioridade", data_vencimento: "Data de vencimento",
  data_fatal: "Data fatal", data_cumprimento: "Data de cumprimento",
  tratado_em: "Tratado em", responsavel_id: "Responsável",
  coordenacao_id: "Coordenação", processo_id: "Processo",
  data_inicio: "Data de início", data_fim: "Data de término",
  tipo: "Tipo", tipo_tarefa: "Tipo", local: "Local", valor: "Valor",
  numero: "Número do processo", cliente: "Cliente", comarca: "Comarca",
  vara: "Vara", objeto_acao: "Objeto da ação", pedido: "Pedido",
  data_audiencia: "Data da audiência", nome_arquivo: "Arquivo",
};
const labelCampo = (c: string) => LABELS[c] || c.replace(/_/g, " ");

const TIPO_LABEL: Record<string, string> = {
  processo: "Processo", tarefa: "Tarefa", prazo: "Prazo", evento: "Evento",
  audiencia: "Audiência", parcelamento: "Parcelamento", documento: "Documento",
};

const ACAO_META: Record<string, { label: string; icon: any; className: string }> = {
  criar: { label: "Criação", icon: PlusCircle, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  atualizar: { label: "Alteração", icon: Pencil, className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  deletar: { label: "Exclusão", icon: Trash2, className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};
const acaoMeta = (a: string) =>
  ACAO_META[a] || { label: a?.replace(/_/g, " ") || "—", icon: AlertTriangle, className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" };

const formatValor = (v: any): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (m) return m[4] ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : `${m[3]}/${m[2]}/${m[1]}`;
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
};

const formatDataHora = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

const getDiff = (r: AuditRow): { campo: string; de: any; para: any }[] =>
  Array.isArray(r.campos_alterados) ? r.campos_alterados : [];

const tituloItem = (r: AuditRow): string => {
  const f = r.dados_saida || r.dados_entrada || {};
  return f?.titulo || f?.descricao || f?.nome_arquivo || f?.nome || f?.numero || "—";
};

const resumoAlteracao = (r: AuditRow): string => {
  if (r.acao === "atualizar") {
    const d = getDiff(r);
    if (d.length === 0) return "Alteração registrada";
    const nomes = d.slice(0, 3).map((x) => labelCampo(x.campo));
    return `${nomes.join(", ")}${d.length > 3 ? ` +${d.length - 3}` : ""}`;
  }
  if (r.acao === "criar") return "Registro criado";
  if (r.acao === "deletar") return "Registro excluído";
  return r.erro_mensagem || "—";
};

export function ProcessoAuditoriaTab({ processoId, processoNumero }: Props) {
  const { role, loading: loadingRole } = useUserRole();
  const podeVer = ["admin", "coordenador", "assistente_coordenador"].includes(role || "");

  const [tipo, setTipo] = useState("todos");
  const [acao, setAcao] = useState("todos");
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  // IDs de itens vinculados ao processo (tarefas/prazos, eventos, audiências, documentos)
  const { data: vinculados } = useQuery({
    queryKey: ["auditoria-processo-vinculados", processoId],
    enabled: !!processoId && podeVer,
    queryFn: async () => {
      const ids: string[] = [];
      const [tarefas, eventos, audiencias, docs] = await Promise.all([
        supabase.from("tarefas").select("id").eq("processo_id", processoId!).limit(1000),
        supabase.from("evento_processos").select("evento_id").eq("processo_id", processoId!).limit(1000),
        supabase.from("audiencias_detectadas").select("id").eq("processo_id", processoId!).limit(1000),
        supabase.from("documentos").select("id").eq("processo_id", processoId!).limit(1000),
      ]);
      (tarefas.data || []).forEach((t: any) => ids.push(t.id));
      (eventos.data || []).forEach((e: any) => e.evento_id && ids.push(e.evento_id));
      (audiencias.data || []).forEach((a: any) => ids.push(a.id));
      (docs.data || []).forEach((d: any) => ids.push(d.id));
      return Array.from(new Set(ids));
    },
  });

  const { data: rows, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["auditoria-processo", processoId, (vinculados || []).length],
    enabled: !!processoId && podeVer && vinculados !== undefined,
    queryFn: async () => {
      const acc = new Map<string, AuditRow>();
      const push = (list: any[]) => (list || []).forEach((r) => acc.set(r.id, r as AuditRow));

      const porProcesso = await supabase
        .from("auditoria_tarefas")
        .select("*")
        .eq("processo_id", processoId!)
        .order("created_at", { ascending: false })
        .limit(500);
      push(porProcesso.data || []);

      const ids = vinculados || [];
      for (let i = 0; i < ids.length; i += 150) {
        const lote = ids.slice(i, i + 150);
        const { data } = await supabase
          .from("auditoria_tarefas")
          .select("*")
          .in("tarefa_id", lote)
          .order("created_at", { ascending: false })
          .limit(500);
        push(data || []);
      }

      return Array.from(acc.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set((rows || []).map((r) => r.usuario_id).filter(Boolean) as string[])),
    [rows]
  );
  const { data: profiles } = useQuery({
    queryKey: ["auditoria-processo-profiles", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, email").in("id", userIds);
      const map: Record<string, { nome: string; email: string }> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = { nome: p.nome || p.email || "Usuário", email: p.email || "" };
      });
      return map;
    },
  });

  const nomeUsuario = (id: string | null) =>
    id ? profiles?.[id]?.nome || "Usuário do sistema" : "Sistema (automático)";
  const emailUsuario = (id: string | null) => (id ? profiles?.[id]?.email || "" : "");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (tipo !== "todos" && (r.tipo_item || "") !== tipo) return false;
      if (acao !== "todos" && r.acao !== acao) return false;
      if (!termo) return true;
      return `${nomeUsuario(r.usuario_id)} ${emailUsuario(r.usuario_id)} ${tituloItem(r)} ${resumoAlteracao(r)}`
        .toLowerCase()
        .includes(termo);
    });
  }, [rows, tipo, acao, busca, profiles]);

  if (loadingRole) return <Skeleton className="h-40 w-full" />;

  if (!podeVer) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">Acesso restrito</p>
          <p className="text-xs text-muted-foreground">
            A auditoria do processo está disponível apenas para coordenadores e administradores.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Auditoria do processo
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Todas as ações registradas no processo{processoNumero ? ` ${processoNumero}` : ""} e nos itens
                vinculados (tarefas, prazos, eventos, audiências e documentos), com autor, e-mail e data/hora.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={cn("w-4 h-4 mr-2", isRefetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Tipo de item</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(TIPO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ação</Label>
            <Select value={acao} onValueChange={setAcao}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="criar">Criação</SelectItem>
                <SelectItem value="atualizar">Alteração</SelectItem>
                <SelectItem value="deletar">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Buscar</Label>
            <Input
              className="h-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="usuário, e-mail, título…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum registro de auditoria para este processo.
            </div>
          ) : (
            <ScrollArea className="max-h-[620px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Data/hora</TableHead>
                    <TableHead className="w-[110px]">Ação</TableHead>
                    <TableHead className="w-[110px]">Item</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>O que mudou</TableHead>
                    <TableHead className="w-[220px]">Usuário</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((r) => {
                    const meta = acaoMeta(r.acao);
                    const Icon = meta.icon;
                    return (
                      <TableRow key={r.id} className={cn(!r.sucesso && "bg-red-50/50 dark:bg-red-950/20")}>
                        <TableCell className="text-xs whitespace-nowrap">{formatDataHora(r.created_at)}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs gap-1", meta.className)}>
                            <Icon className="w-3 h-3" />{meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{TIPO_LABEL[r.tipo_item || ""] || r.tipo_item || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[240px] truncate" title={tituloItem(r)}>
                          {tituloItem(r)}
                        </TableCell>
                        <TableCell className="text-xs max-w-[260px] truncate" title={resumoAlteracao(r)}>
                          {resumoAlteracao(r)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">{nomeUsuario(r.usuario_id)}</div>
                          <div className="text-muted-foreground">{emailUsuario(r.usuario_id) || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(r)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Detalhes da ação</DialogTitle>
          </DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[70vh] pr-3">
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Usuário</p>
                    <p className="font-medium">{nomeUsuario(selected.usuario_id)}</p>
                    <p className="text-xs text-muted-foreground">{emailUsuario(selected.usuario_id) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data/hora (BRT)</p>
                    <p className="font-medium">{formatDataHora(selected.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ação</p>
                    <p className="font-medium">{acaoMeta(selected.acao).label}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo de item</p>
                    <p className="font-medium">{TIPO_LABEL[selected.tipo_item || ""] || selected.tipo_item || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Origem</p>
                    <p className="font-medium break-all">{selected.origem || "—"}</p>
                  </div>
                </div>

                {selected.erro_mensagem && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                    <p className="font-medium mb-1">Erro</p>
                    <p>{selected.erro_mensagem}</p>
                  </div>
                )}

                {getDiff(selected).length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2">Campos alterados</p>
                    <div className="rounded-md border divide-y">
                      {getDiff(selected).map((d, i) => (
                        <div key={i} className="p-2 grid grid-cols-3 gap-2 text-xs">
                          <span className="font-medium capitalize">{labelCampo(d.campo)}</span>
                          <span className="text-muted-foreground line-through break-words">{formatValor(d.de)}</span>
                          <span className="break-words">{formatValor(d.para)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.acao !== "atualizar" && (
                  <div>
                    <p className="text-xs font-medium mb-2">
                      {selected.acao === "deletar" ? "Dados excluídos" : "Dados registrados"}
                    </p>
                    <div className="rounded-md border divide-y">
                      {Object.entries((selected.dados_saida || selected.dados_entrada || {}) as Record<string, any>)
                        .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
                        .slice(0, 40)
                        .map(([k, v]) => (
                          <div key={k} className="p-2 grid grid-cols-2 gap-2 text-xs">
                            <span className="font-medium capitalize">{labelCampo(k)}</span>
                            <span className="break-words">{formatValor(v)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
