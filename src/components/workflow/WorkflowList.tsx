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
import { Switch } from "@/components/ui/switch";
import {
  useWorkflows,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
} from "@/hooks/useWorkflows";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { IniciarWorkflowDialog } from "./IniciarWorkflowDialog";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface WorkflowListProps {
  onSelect?: (workflowId: string) => void;
  onIniciar?: (workflowId: string) => void;
}

export function WorkflowList({ onSelect, onIniciar }: WorkflowListProps) {
  const { coordenacoes } = useCoordenacoesDoUsuario();
  const { data: workflows = [], isLoading } = useWorkflows();
  const createMutation = useCreateWorkflow();
  const updateMutation = useUpdateWorkflow();
  const deleteMutation = useDeleteWorkflow();

  const [openDialog, setOpenDialog] = useState(false);
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
      coordenacao_id: coordenacoes?.[0]?.id || "",
      ativo: true,
    });
    setEditing(null);
  };

  const handleOpen = () => {
    resetForm();
    setOpenDialog(true);
  };

  const handleEdit = (wf: any) => {
    setEditing(wf);
    setForm({
      nome: wf.nome || "",
      descricao: wf.descricao || "",
      coordenacao_id: wf.coordenacao_id || "",
      ativo: wf.ativo ?? true,
    });
    setOpenDialog(true);
  };

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.coordenacao_id) {
      toast.error("Preencha o nome e a coordenação");
      return;
    }
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, ...form });
    } else {
      await createMutation.mutateAsync(form as any);
    }
    setOpenDialog(false);
    resetForm();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">Carregando workflows...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fluxos de Trabalho</h2>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpen}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar Workflow" : "Novo Workflow"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Fluxo Atendimento Banco"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) =>
                    setForm({ ...form, descricao: e.target.value })
                  }
                  placeholder="Resumo do objetivo do fluxo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coordenacao">Coordenação</Label>
                <select
                  id="coordenacao"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.coordenacao_id}
                  onChange={(e) =>
                    setForm({ ...form, coordenacao_id: e.target.value })
                  }
                >
                  <option value="">Selecione...</option>
                  {coordenacoes?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="ativo"
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full"
              >
                {editing ? "Salvar alterações" : "Criar workflow"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            Nenhum workflow cadastrado. Clique em "Novo Workflow" para criar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {workflows.map((wf) => (
            <Card
              key={wf.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onSelect?.(wf.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{wf.nome}</CardTitle>
                    {!wf.ativo && (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <IniciarWorkflowDialog
                      workflowId={wf.id}
                      workflowName={wf.nome}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                          title="Iniciar fluxo"
                        >
                          <span className="text-primary text-xs font-bold">▶</span>
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(wf);
                      }}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(wf.id);
                      }}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {wf.descricao || "Sem descrição"}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{wf.coordenacao?.nome || "Coordenação"}</Badge>
                  <ChevronRight className="h-3 w-3" />
                  <span>Clique para configurar etapas</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
