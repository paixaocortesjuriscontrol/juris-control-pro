import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useWorkflow,
  useWorkflowEtapas,
  useCreateWorkflowEtapa,
  useUpdateWorkflowEtapa,
  useDeleteWorkflowEtapa,
  useWorkflowEtapasResponsaveis,
} from "@/hooks/useWorkflows";
import { Checkbox } from "@/components/ui/checkbox";
import { useUsuariosCoordenacao } from "@/hooks/useUsuariosCoordenacao";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { WorkflowEtapa, WorkflowItemType } from "@/lib/workflowExecutor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  ArrowLeft,
  MoreVertical,
  CalendarPlus,
} from "lucide-react";

import { toast } from "sonner";

const TIPOS: { value: WorkflowItemType; label: string }[] = [
  { value: "PRAZO", label: "Prazo" },
  { value: "TAREFA", label: "Tarefa" },
  { value: "AUDIENCIA", label: "Audiência" },
  { value: "EVENTO", label: "Evento" },
  { value: "PARCELAMENTO", label: "Parcelamento" },
];

const REGRAS_RESPONSAVEL = [
  { value: "predefinido", label: "Responsáveis predefinidos" },
  { value: "iniciador", label: "Quem iniciou o fluxo" },
  { value: "etapa_anterior", label: "Responsável da etapa anterior" },
];

const CONDICOES = [
  { value: "sempre", label: "Sempre executar" },
  { value: "sucesso_anterior", label: "Apenas se etapa anterior tiver sucesso" },
];

interface WorkflowEditorProps {
  workflowId: string;
  onBack?: () => void;
}

export function WorkflowEditor({ workflowId, onBack }: WorkflowEditorProps) {
  const { data: workflow } = useWorkflow(workflowId);
  const { data: etapas = [] } = useWorkflowEtapas(workflowId);
  const createEtapa = useCreateWorkflowEtapa();
  const updateEtapa = useUpdateWorkflowEtapa();
  const deleteEtapa = useDeleteWorkflowEtapa();
  const { data: respMap = {} } = useWorkflowEtapasResponsaveis(workflowId);
  const { coordenacoes } = useCoordenacoesDoUsuario();
  const [coordSelecionada, setCoordSelecionada] = useState<string>("");
  const coordEfetiva = coordSelecionada || workflow?.coordenacao_id || "";
  const { data: usuarios = [] } = useUsuariosCoordenacao(coordEfetiva || undefined);


  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowEtapa | null>(null);
  const [form, setForm] = useState<any>({});

  const resetForm = () => {
    setForm({
      workflow_id: workflowId,
      titulo: "",
      tipo_item: "TAREFA" as WorkflowItemType,
      descricao: "",
      ordem: etapas.length + 1,
      tipo_prazo: "dias_corridos",
      dias_previsto: 0,
      dias_fatal: null,
      prioridade: "media",
      exibir_kanban: false,
      regra_responsavel: "predefinido",
      condicao: "sempre",
      responsavel_id: null,
      responsaveis: [] as string[],
    });
    setEditing(null);
  };

  const handleOpen = () => {
    resetForm();
    setCoordSelecionada(workflow?.coordenacao_id || "");
    setDialogOpen(true);
  };

  const handleEdit = (etapa: WorkflowEtapa) => {
    setEditing(etapa);
    setCoordSelecionada(workflow?.coordenacao_id || "");
    setForm({
      ...etapa,
      dias_fatal: etapa.dias_fatal ?? null,
      responsaveis: respMap[etapa.id] || (etapa.responsavel_id ? [etapa.responsavel_id] : []),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.titulo.trim() || !form.tipo_item) {
      toast.error("Preencha o título e tipo da etapa");
      return;
    }

    const payload = {
      ...form,
      dias_fatal: form.dias_fatal ? parseInt(form.dias_fatal) : null,
      responsaveis:
        form.regra_responsavel === "predefinido" ? (form.responsaveis || []) : [],
      responsavel_id:
        form.regra_responsavel === "predefinido"
          ? (form.responsaveis || [])[0] || null
          : null,
    };

    if (editing) {
      await updateEtapa.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createEtapa.mutateAsync(payload);
    }
    setDialogOpen(false);
    resetForm();
  };

  const moveEtapa = (etapa: WorkflowEtapa, direction: "up" | "down") => {
    const idx = etapas.findIndex((e) => e.id === etapa.id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= etapas.length) return;
    const other = etapas[newIdx];
    updateEtapa.mutate({ id: etapa.id, ordem: other.ordem });
    updateEtapa.mutate({ id: other.id, ordem: etapa.ordem });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {onBack && (
                <Button variant="outline" size="icon" onClick={onBack} title="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{workflow?.nome}</h2>
                  <Badge
                    className={
                      workflow?.ativo === false
                        ? "badge-status-closed rounded-full"
                        : "badge-status-active rounded-full"
                    }
                  >
                    {workflow?.ativo === false ? "Desabilitado" : "Habilitado"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Descrição</p>
                <p className="text-sm">{workflow?.descricao || "Não informado"}</p>
              </div>
            </div>
            <div className="flex items-start gap-8">
              <div>
                <p className="text-[11px] text-muted-foreground">Data de criação</p>
                <p className="text-sm">
                  {workflow?.created_at
                    ? new Date(workflow.created_at).toLocaleDateString("pt-BR")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Data da última atualização
                </p>
                <p className="text-sm">
                  {workflow?.updated_at || workflow?.created_at
                    ? new Date(
                        (workflow as any).updated_at || (workflow as any).created_at
                      ).toLocaleDateString("pt-BR")
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpen}>
              <Plus className="h-4 w-4 mr-2" />
              Nova etapa
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={form.titulo || ""}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex: Iniciar atendimento e juntar documentos"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de Item</Label>
                  <Select
                    value={form.tipo_item || "TAREFA"}
                    onValueChange={(v) =>
                      setForm({ ...form, tipo_item: v as WorkflowItemType })
                    }
                  >
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ordem">Ordem</Label>
                  <Input
                    id="ordem"
                    type="number"
                    min={1}
                    value={form.ordem || ""}
                    onChange={(e) =>
                      setForm({ ...form, ordem: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao || ""}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dias_previsto">Dias previsto</Label>
                  <Input
                    id="dias_previsto"
                    type="number"
                    value={form.dias_previsto ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, dias_previsto: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dias_fatal">Dias fatal (opcional)</Label>
                  <Input
                    id="dias_fatal"
                    type="number"
                    value={form.dias_fatal ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, dias_fatal: e.target.value ? parseInt(e.target.value) : null })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo_prazo">Tipo de prazo</Label>
                <Select
                  value={form.tipo_prazo || "dias_corridos"}
                  onValueChange={(v) => setForm({ ...form, tipo_prazo: v })}
                >
                  <SelectTrigger id="tipo_prazo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dias_corridos">Dias corridos</SelectItem>
                    <SelectItem value="dias_uteis">Dias úteis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select
                  value={form.prioridade || "media"}
                  onValueChange={(v) => setForm({ ...form, prioridade: v })}
                >
                  <SelectTrigger id="prioridade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="regra">Responsável</Label>
                <Select
                  value={form.regra_responsavel || "predefinido"}
                  onValueChange={(v) => setForm({ ...form, regra_responsavel: v })}
                >
                  <SelectTrigger id="regra">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGRAS_RESPONSAVEL.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.regra_responsavel === "predefinido" && (
                <div className="space-y-2">
                  {coordenacoes.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="coord-etapa">Coordenação dos responsáveis</Label>
                      <Select
                        value={coordEfetiva}
                        onValueChange={(v) => {
                          setCoordSelecionada(v);
                          setForm({ ...form, responsaveis: [] });
                        }}
                      >
                        <SelectTrigger id="coord-etapa">
                          <SelectValue placeholder="Selecione a coordenação" />
                        </SelectTrigger>
                        <SelectContent>
                          {coordenacoes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Label>Responsáveis da etapa</Label>
                  <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                    {!coordEfetiva && (
                      <p className="text-sm text-muted-foreground">
                        Selecione uma coordenação para listar os usuários.
                      </p>
                    )}
                    {!!coordEfetiva && usuarios.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhum usuário nesta coordenação.
                      </p>
                    )}
                    {usuarios.map((u) => {
                      const selecionados: string[] = form.responsaveis || [];
                      const checked = selecionados.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 text-sm cursor-pointer py-1"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setForm({
                                ...form,
                                responsaveis: v
                                  ? [...selecionados, u.id]
                                  : selecionados.filter((id) => id !== u.id),
                              })
                            }
                          />
                          <span>
                            {u.nome} {u.cargo ? `(${u.cargo})` : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pode alterar depois editando a etapa.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="condicao">Condição de execução</Label>
                <Select
                  value={form.condicao || "sempre"}
                  onValueChange={(v) => setForm({ ...form, condicao: v })}
                >
                  <SelectTrigger id="condicao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDICOES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="kanban"
                  checked={form.exibir_kanban ?? false}
                  onCheckedChange={(v) => setForm({ ...form, exibir_kanban: v })}
                />
                <Label htmlFor="kanban">Exibir no Kanban</Label>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={createEtapa.isPending || updateEtapa.isPending}
                className="w-full"
              >
                {editing ? "Salvar etapa" : "Adicionar etapa"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {etapas.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            Nenhuma etapa cadastrada. Adicione a primeira etapa para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(() => {
            const depths = new Map<string, number>();
            etapas.forEach((e, i) => {
              const dep = e.condicao !== "sempre";
              if (!dep) {
                depths.set(e.id, 0);
                return;
              }
              const parentId = (e as any).etapa_anterior_id as string | null;
              const parentDepth = parentId
                ? depths.get(parentId)
                : i > 0
                ? depths.get(etapas[i - 1].id)
                : undefined;
              depths.set(e.id, (parentDepth ?? 0) + 1);
            });
            return etapas.map((etapa, idx) => {
            const dependente = etapa.condicao !== "sempre";
            const depth = depths.get(etapa.id) ?? 0;
            return (
              <div key={etapa.id} style={{ paddingLeft: depth * 32 }}>

                <Card
                  className={
                    dependente
                      ? "border-l-4 border-l-[hsl(var(--status-pending))]"
                      : "border-l-4 border-l-primary"
                  }
                >
                  <CardContent className="p-0">
                    <div className="flex items-start justify-between gap-3 p-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="rounded-md border border-border p-1.5 text-muted-foreground">
                          <CalendarPlus className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {idx + 1}. Criar{" "}
                            {(
                              TIPOS.find((t) => t.value === etapa.tipo_item)?.label ||
                              etapa.tipo_item
                            ).toLowerCase()}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {etapa.titulo}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-6">
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">
                            Prazo previsto
                          </p>
                          <p className="text-sm">+{etapa.dias_previsto ?? 0} dias</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">Prazo fatal</p>
                          <p className="text-sm">+{etapa.dias_fatal ?? 0} dias</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(etapa)}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={idx === 0}
                              onClick={() => moveEtapa(etapa, "up")}
                            >
                              Mover para cima
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={idx === etapas.length - 1}
                              onClick={() => moveEtapa(etapa, "down")}
                            >
                              Mover para baixo
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() =>
                                deleteEtapa.mutate({ id: etapa.id, workflowId })
                              }
                            >
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="border-t border-border px-4 py-3">
                      <p className="text-[11px] text-muted-foreground">
                        Condição de início
                      </p>
                      <p className="text-sm">
                        {dependente
                          ? "Ao mudar a situação de uma etapa > Concluída com sucesso"
                          : "Ao iniciar o fluxo"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">
                          {String(etapa.tipo_prazo || "").replace("dias_", "dias ")}
                        </Badge>
                        <Badge variant="secondary">
                          {
                            REGRAS_RESPONSAVEL.find(
                              (t) => t.value === etapa.regra_responsavel
                            )?.label
                          }
                        </Badge>
                        {(respMap[etapa.id] || []).map((uid) => (
                          <Badge key={uid} variant="outline">
                            {usuarios.find((u) => u.id === uid)?.nome || "Usuário"}
                          </Badge>
                        ))}
                        {etapa.exibir_kanban && <Badge variant="outline">Kanban</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}

          <div className="flex justify-center pt-2">
            <Button
              onClick={() => {
                handleOpen();
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova etapa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

