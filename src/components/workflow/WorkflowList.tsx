import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, ChevronRight, X, Play } from "lucide-react";
import { toast } from "sonner";

interface WorkflowListProps {
  onSelect?: (workflowId: string) => void;
  onIniciar?: (workflowId: string) => void;
}

export function WorkflowList({ onSelect }: WorkflowListProps) {
  const { coordenacoes, isAdmin, unicaCoordenacaoId } = useCoordenacoesDoUsuario();
  const [filtroCoordenacao, setFiltroCoordenacao] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<string>("ativos");
  const [iniciandoId, setIniciandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin && unicaCoordenacaoId) setFiltroCoordenacao(unicaCoordenacaoId);
  }, [isAdmin, unicaCoordenacaoId]);

  const { data: workflows = [], isLoading } = useWorkflows({
    coordenacaoId: filtroCoordenacao !== "todas" ? filtroCoordenacao : undefined,
    ativo: filtroAtivo === "todos" ? undefined : filtroAtivo === "ativos",
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
      toast.error("Preencha o nome e a coordenação");
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

  const listaFiltrada = workflows.filter((wf: any) => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return (
      (wf.nome || "").toLowerCase().includes(t) ||
      (wf.descricao || "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Fluxos de Trabalho</h2>
        <Button onClick={handleOpen} disabled={showForm && !editing}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Workflow
        </Button>
      </div>

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
          <div className="space-y-1.5">
            <Label>Situação</Label>
            <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
              <SelectTrigger>
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativos">Somente ativos</SelectItem>
                <SelectItem value="inativos">Somente inativos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Buscar</Label>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou descrição do fluxo"
            />
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {editing ? "Editar workflow" : "Novo workflow"}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="coordenacao">Coordenação</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Resumo do objetivo do fluxo"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="ativo"
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
              <Label htmlFor="ativo">Ativo</Label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? "Salvar alterações" : "Criar workflow"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-6">Carregando workflows...</CardContent>
        </Card>
      ) : listaFiltrada.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            Nenhum workflow encontrado com os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {listaFiltrada.map((wf: any) => (
            <Card key={wf.id} className="transition-colors">
              <CardHeader
                className="pb-2 cursor-pointer hover:bg-accent/40"
                onClick={() => onSelect?.(wf.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{wf.nome}</CardTitle>
                    {!wf.ativo && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIniciandoId(iniciandoId === wf.id ? null : wf.id);
                      }}
                      title="Iniciar fluxo"
                    >
                      <Play className="h-4 w-4 text-primary" />
                    </Button>
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
                  <Badge variant="outline">
                    {wf.coordenacao?.nome || "Coordenação"}
                  </Badge>
                  <ChevronRight className="h-3 w-3" />
                  <span>Clique no título para configurar etapas</span>
                </div>
                {iniciandoId === wf.id && (
                  <div className="mt-4 rounded-md border p-3">
                    <IniciarWorkflowDialog
                      inline
                      workflowId={wf.id}
                      workflowName={wf.nome}
                      onDone={() => setIniciandoId(null)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
