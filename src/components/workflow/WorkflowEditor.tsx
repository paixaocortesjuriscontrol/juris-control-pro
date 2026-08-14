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
} from "@/hooks/useWorkflows";
import { WorkflowEtapa, WorkflowItemType } from "@/lib/workflowExecutor";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { toast } from "sonner";

const TIPOS: { value: WorkflowItemType; label: string }[] = [
  { value: "PRAZO", label: "Prazo" },
  { value: "TAREFA", label: "Tarefa" },
  { value: "AUDIENCIA", label: "Audiência" },
  { value: "EVENTO", label: "Evento" },
  { value: "PARCELAMENTO", label: "Parcelamento" },
];

const REGRAS_RESPONSAVEL = [
  { value: "predefinido", label: "Responsável predefinido" },
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
      responsavel_id: "",
    });
    setEditing(null);
  };

  const handleOpen = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (etapa: WorkflowEtapa) => {
    setEditing(etapa);
    setForm({
      ...etapa,
      dias_fatal: etapa.dias_fatal ?? null,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Voltar
            </Button>
          )}
          <div>
            <h2 className="text-lg font-semibold">{workflow?.nome}</h2>
            <p className="text-sm text-muted-foreground">
              {workflow?.descricao || "Configure as etapas do fluxo"}
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpen}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Etapa
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
                  <Label htmlFor="resp_id">ID do responsável predefinido</Label>
                  <Input
                    id="resp_id"
                    value={form.responsavel_id || ""}
                    onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}
                    placeholder="UUID do usuário"
                  />
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
          {etapas.map((etapa, idx) => (
            <Card key={etapa.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {idx + 1}.
                        </span>
                        <CardTitle className="text-base">{etapa.titulo}</CardTitle>
                        <Badge variant="outline">
                          {TIPOS.find((t) => t.value === etapa.tipo_item)?.label ||
                            etapa.tipo_item}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveEtapa(etapa, "up")}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveEtapa(etapa, "down")}
                          disabled={idx === etapas.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(etapa)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            deleteEtapa.mutate({ id: etapa.id, workflowId })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {etapa.descricao || "Sem descrição"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">
                        +{etapa.dias_previsto} dia(s) {etapa.tipo_prazo.replace("dias_", "")}
                      </Badge>
                      {etapa.dias_fatal && (
                        <Badge variant="secondary">Fatal: {etapa.dias_fatal} dias</Badge>
                      )}
                      <Badge variant="secondary">
                        {REGRAS_RESPONSAVEL.find((t) => t.value === etapa.regra_responsavel)?.label}
                      </Badge>
                      {etapa.condicao !== "sempre" && (
                        <Badge variant="secondary">
                          {CONDICOES.find((t) => t.value === etapa.condicao)?.label}
                        </Badge>
                      )}
                      {etapa.exibir_kanban && <Badge variant="outline">Kanban</Badge>}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
