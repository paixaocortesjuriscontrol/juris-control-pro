import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWorkflows,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
} from "@/hooks/useWorkflows";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { IniciarWorkflowDialog } from "./IniciarWorkflowDialog";
import {
  Plus,
  Search,
  SlidersHorizontal,
  CircleDot,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fmtData = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

interface WorkflowListProps {
  onSelect?: (workflowId: string) => void;
  onIniciar?: (workflowId: string) => void;
}

export function WorkflowList({ onSelect }: WorkflowListProps) {
  const { coordenacoes, isAdmin, unicaCoordenacaoId } = useCoordenacoesDoUsuario();
  const [filtroCoordenacao, setFiltroCoordenacao] = useState<string>("todas");
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<"todos" | "ativos" | "inativos">("todos");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [iniciandoId, setIniciandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin && unicaCoordenacaoId) setFiltroCoordenacao(unicaCoordenacaoId);
  }, [isAdmin, unicaCoordenacaoId]);

  const { data: workflows = [], isLoading, refetch } = useWorkflows({
    coordenacaoId: filtroCoordenacao !== "todas" ? filtroCoordenacao : undefined,
    ativo: filtroAtivo === "todos" ? undefined : filtroAtivo === "ativos",
  });

  const { data: etapasCount = {} } = useQuery<Record<string, number>>({
    queryKey: ["workflow-etapas-count"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_etapas")
        .select("workflow_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[r.workflow_id] = (map[r.workflow_id] || 0) + 1;
      });
      return map;
    },
  });

  const createMutation = useCreateWorkflow();
  const updateMutation = useUpdateWorkflow();
  const deleteMutation = useDeleteWorkflow();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    coordenacao_id: "",
    ativo: true,
  });

  const resetForm = () => {
    setForm({
      nome: "",
      descricao: "",
      coordenacao_id:
        filtroCoordenacao !== "todas"
          ? filtroCoordenacao
          : unicaCoordenacaoId || coordenacoes?.[0]?.id || "",
      ativo: true,
    });
    setEditing(null);
  };

  const handleOpen = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (wf: any) => {
    setEditing(wf);
    setForm({
      nome: wf.nome || "",
      descricao: wf.descricao || "",
      coordenacao_id: wf.coordenacao_id || "",
      ativo: wf.ativo ?? true,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.coordenacao_id) {
      toast.error("Preencha o título e a coordenação");
      return;
    }
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, ...form });
    } else {
      await createMutation.mutateAsync(form as any);
    }
    setShowForm(false);
    resetForm();
  };

  const handleDuplicar = async (wf: any) => {
    try {
      const { data: novo, error } = await supabase
        .from("workflows")
        .insert({
          nome: `${wf.nome} (cópia)`,
          descricao: wf.descricao,
          coordenacao_id: wf.coordenacao_id,
          ativo: wf.ativo,
        })
        .select()
        .single();
      if (error) throw error;

      const { data: etapas } = await supabase
        .from("workflow_etapas")
        .select("*")
        .eq("workflow_id", wf.id)
        .order("ordem");

      if (etapas?.length) {
        const rows = etapas.map(({ id, workflow_id, created_at, updated_at, ...rest }: any) => ({
          ...rest,
          workflow_id: novo.id,
        }));
        const { error: errEtapas } = await supabase.from("workflow_etapas").insert(rows);
        if (errEtapas) throw errEtapas;
      }

      await refetch();
      toast.success("Fluxo duplicado");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao duplicar o fluxo");
    }
  };

  const listaFiltrada = useMemo(
    () =>
      workflows.filter((wf: any) => {
        if (!busca.trim()) return true;
        const t = busca.toLowerCase();
        return (
          (wf.nome || "").toLowerCase().includes(t) ||
          (wf.descricao || "").toLowerCase().includes(t)
        );
      }),
    [workflows, busca]
  );

  return (
    <div className="space-y-3">
      {/* Barra de ferramentas estilo Projuris */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleOpen}>
          <Plus className="h-4 w-4 mr-2" />
          Novo fluxo
        </Button>

        <div className="flex flex-1 min-w-[240px] items-center">
          <Input
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setBusca(buscaInput)}
            placeholder="Pesquise pelo título ou descrição"
            className="rounded-r-none"
          />
          <Button
            className="rounded-l-none"
            onClick={() => setBusca(buscaInput)}
            title="Pesquisar"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={() => setMostrarFiltros((v) => !v)}
          className="gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          <Badge variant="secondary" className="rounded-full px-1.5">
            {filtroCoordenacao !== "todas" ? 1 : 0}
          </Badge>
        </Button>

        <div className="flex items-center rounded-md border border-border overflow-hidden">
          {[
            { key: "todos", label: "Todos", Icon: CircleDot },
            { key: "ativos", label: "Habilitados", Icon: CheckCircle2 },
            { key: "inativos", label: "Desabilitados", Icon: XCircle },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltroAtivo(key as any)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm transition-colors",
                filtroAtivo === key
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {mostrarFiltros && (
        <Card>
          <CardContent className="p-4 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Coordenação</Label>
              <Select value={filtroCoordenacao} onValueChange={setFiltroCoordenacao}>
                <SelectTrigger>
                  <SelectValue placeholder="Coordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as coordenações</SelectItem>
                  {coordenacoes?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista compacta com cabeçalho único (padrão Projuris) */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <CardContent className="p-6 text-muted-foreground">
            Carregando fluxos...
          </CardContent>
        ) : listaFiltrada.length === 0 ? (
          <CardContent className="p-6 text-muted-foreground">
            Nenhum fluxo encontrado com os filtros atuais.
          </CardContent>
        ) : (
          <div className="text-sm">
            {/* Cabeçalho */}
            <div className="hidden md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_70px_110px_120px_90px_100px] items-center gap-3 px-4 py-2 bg-muted/50 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              <span>Título</span>
              <span>Descrição</span>
              <span className="text-center">Etapas</span>
              <span>Criação</span>
              <span>Atualização</span>
              <span className="text-center">Situação</span>
              <span className="text-right">Ações</span>
            </div>

            {/* Linhas */}
            <div className="divide-y divide-border">
              {listaFiltrada.map((wf: any) => (
                <div key={wf.id}>
                  <div
                    className="grid grid-cols-1 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_70px_110px_120px_90px_100px] items-center gap-x-3 gap-y-1 px-4 py-2 hover:bg-accent/40 cursor-pointer"
                    onClick={() => onSelect?.(wf.id)}
                  >
                    <div className="min-w-0">
                      <p className="md:hidden text-[10px] text-muted-foreground uppercase">Título</p>
                      <p className="text-sm font-medium text-primary line-clamp-2 break-words" title={wf.nome}>
                        {wf.nome}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="md:hidden text-[10px] text-muted-foreground uppercase">Descrição</p>
                      <p className="text-sm text-muted-foreground line-clamp-1" title={wf.descricao || ""}>
                        {wf.descricao || "Não informado"}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="md:hidden text-[10px] text-muted-foreground uppercase">Etapas</p>
                      <p className="text-sm">{etapasCount[wf.id] ?? 0}</p>
                    </div>
                    <div>
                      <p className="md:hidden text-[10px] text-muted-foreground uppercase">Criação</p>
                      <p className="text-sm">{fmtData(wf.created_at)}</p>
                    </div>
                    <div>
                      <p className="md:hidden text-[10px] text-muted-foreground uppercase">Atualização</p>
                      <p className="text-sm">{fmtData(wf.updated_at || wf.created_at)}</p>
                    </div>
                    <div className="flex justify-center">
                      <p className="md:hidden text-[10px] text-muted-foreground uppercase w-full">Situação</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[10px] px-2 py-0.5 whitespace-nowrap",
                          wf.ativo ? "badge-status-active" : "badge-status-closed"
                        )}
                      >
                        {wf.ativo ? "Habilitado" : "Desabilitado"}
                      </Badge>
                    </div>
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Iniciar fluxo"
                        onClick={() =>
                          setIniciandoId(iniciandoId === wf.id ? null : wf.id)
                        }
                      >
                        <Play className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(wf)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(wf.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            Excluir
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateMutation.mutate({ id: wf.id, ativo: !wf.ativo })
                            }
                          >
                            {wf.ativo ? "Desabilitar" : "Habilitar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicar(wf)}>
                            Duplicar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {iniciandoId === wf.id && (
                    <div className="border-t border-border bg-muted/30 p-4">
                      <IniciarWorkflowDialog
                        inline
                        workflowId={wf.id}
                        workflowName={wf.nome}
                        onDone={() => setIniciandoId(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Dialog Novo/Editar fluxo (padrão Projuris) */}
      <Dialog
        open={showForm}
        onOpenChange={(v) => {
          setShowForm(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar fluxo" : "Novo fluxo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: DEFESA + AGI"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordenacao">
                Coordenação <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.coordenacao_id}
                onValueChange={(v) => setForm({ ...form, coordenacao_id: v })}
              >
                <SelectTrigger id="coordenacao">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {coordenacoes?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="situacao">Situação</Label>
              <Select
                value={form.ativo ? "habilitado" : "desabilitado"}
                onValueChange={(v) => setForm({ ...form, ativo: v === "habilitado" })}
              >
                <SelectTrigger id="situacao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="habilitado">Habilitado</SelectItem>
                  <SelectItem value="desabilitado">Desabilitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
