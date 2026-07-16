import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  usePromptsIaTst,
  useCreatePromptIaTst,
  useUpdatePromptIaTst,
  useDeletePromptIaTst,
  MODELOS_GEMINI,
  type PromptIaTst,
} from "@/hooks/usePromptsIaTst";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Página "Prompt IA TST" — CRUD inline (sem botão Editar) de prompts
 * personalizados que serão usados na aba "Analisar com IA" da tela
 * Distribuição TST.
 */
export default function PromptIaTstPage() {
  const { data: prompts = [], isLoading } = usePromptsIaTst();
  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const createMut = useCreatePromptIaTst();
  const updateMut = useUpdatePromptIaTst();
  const deleteMut = useDeletePromptIaTst();

  const [showNovo, setShowNovo] = useState(false);
  const coordenacoesDisponiveis = useMemo(
    () => (coordenacoes as any[]).map((c) => ({ id: c.id, nome: c.nome })),
    [coordenacoes],
  );

  return (
    <MainLayout
      title="Prompt IA TST"
      subtitle="Prompts personalizados usados na análise com IA da Distribuição TST."
    >
    <div className="container mx-auto p-4 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" /> Prompt IA TST
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre prompts personalizados que aparecerão na aba <strong>Analisar com IA</strong> da Distribuição TST.
          </p>
        </div>
        <Button onClick={() => setShowNovo((v) => !v)}>
          <Plus className="w-4 h-4 mr-2" /> {showNovo ? "Cancelar" : "Novo prompt"}
        </Button>
      </div>

      {showNovo && (
        <NovoPromptCard
          coordenacoes={coordenacoesDisponiveis}
          onCancel={() => setShowNovo(false)}
          onCreated={() => setShowNovo(false)}
          create={createMut.mutateAsync}
          loading={createMut.isPending}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando…
        </div>
      ) : prompts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum prompt cadastrado ainda. Clique em <strong>Novo prompt</strong> para criar o primeiro.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {prompts.map((p) => (
            <PromptRow
              key={p.id}
              prompt={p}
              coordenacoes={coordenacoesDisponiveis}
              onUpdate={(patch) => updateMut.mutateAsync({ id: p.id, patch })}
              onDelete={() => deleteMut.mutateAsync(p.id)}
              updating={updateMut.isPending}
              deleting={deleteMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
    </MainLayout>
  );
}

function NovoPromptCard({
  coordenacoes,
  onCancel,
  onCreated,
  create,
  loading,
}: {
  coordenacoes: { id: string; nome: string }[];
  onCancel: () => void;
  onCreated: () => void;
  create: (input: any) => Promise<any>;
  loading: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [prompt, setPrompt] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modelo, setModelo] = useState(MODELOS_GEMINI[0].value);
  const [coordId, setCoordId] = useState<string>(coordenacoes[0]?.id || "");
  const [ativo, setAtivo] = useState(true);

  const salvar = async () => {
    if (!titulo.trim() || !prompt.trim() || !coordId) {
      toast.error("Preencha título, prompt e coordenação.");
      return;
    }
    try {
      await create({
        coordenacao_id: coordId,
        titulo: titulo.trim(),
        prompt: prompt.trim(),
        descricao: descricao.trim() || null,
        modelo,
        ativo,
      });
      toast.success("Prompt criado.");
      onCreated();
    } catch (e: any) {
      toast.error("Erro ao criar: " + (e?.message || "desconhecido"));
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Novo prompt</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Análise de Recurso de Revista — Bancário"
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label>Coordenação</Label>
            <Select value={coordId} onValueChange={setCoordId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {coordenacoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Texto do prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Explique à IA o que extrair dos anexos e em quais campos do formulário preencher…"
            rows={8}
          />
        </div>
        <div className="space-y-1">
          <Label>Descrição / observações (opcional)</Label>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Quando usar este prompt…"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div className="space-y-1">
            <Label>Modelo Gemini</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELOS_GEMINI.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>Ativo</Label>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button onClick={salvar} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar prompt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PromptRow({
  prompt,
  coordenacoes,
  onUpdate,
  onDelete,
  updating,
  deleting,
}: {
  prompt: PromptIaTst;
  coordenacoes: { id: string; nome: string }[];
  onUpdate: (patch: any) => Promise<any>;
  onDelete: () => Promise<any>;
  updating: boolean;
  deleting: boolean;
}) {
  const [titulo, setTitulo] = useState(prompt.titulo);
  const [texto, setTexto] = useState(prompt.prompt);
  const [descricao, setDescricao] = useState(prompt.descricao || "");
  const [modelo, setModelo] = useState(prompt.modelo);
  const [coordId, setCoordId] = useState(prompt.coordenacao_id);
  const [ativo, setAtivo] = useState(prompt.ativo);

  const dirty =
    titulo !== prompt.titulo ||
    texto !== prompt.prompt ||
    (descricao || "") !== (prompt.descricao || "") ||
    modelo !== prompt.modelo ||
    coordId !== prompt.coordenacao_id ||
    ativo !== prompt.ativo;

  const salvar = async () => {
    if (!titulo.trim() || !texto.trim()) {
      toast.error("Título e texto do prompt são obrigatórios.");
      return;
    }
    try {
      await onUpdate({
        titulo: titulo.trim(),
        prompt: texto.trim(),
        descricao: descricao.trim() || null,
        modelo,
        coordenacao_id: coordId,
        ativo,
      });
      toast.success("Prompt atualizado.");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || "desconhecido"));
    }
  };

  const coordNome = coordenacoes.find((c) => c.id === prompt.coordenacao_id)?.nome || "—";
  const dt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[260px] space-y-2">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="text-base font-medium"
              maxLength={200}
            />
            <div className="text-xs text-muted-foreground">
              Coordenação: <strong>{coordNome}</strong> · Criado em {dt(prompt.created_at)} · Alterado em {dt(prompt.updated_at)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Ativo</Label>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-rose-600" disabled={deleting}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir prompt?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{prompt.titulo}" será removido permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await onDelete();
                        toast.success("Prompt excluído.");
                      } catch (e: any) {
                        toast.error("Erro: " + (e?.message || "desconhecido"));
                      }
                    }}
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1 md:col-span-1">
            <Label className="text-xs">Coordenação</Label>
            <Select value={coordId} onValueChange={setCoordId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {coordenacoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Modelo Gemini</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELOS_GEMINI.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Texto do prompt</Label>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Descrição / observações</Label>
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
        </div>

        <div className="flex justify-end">
          <Button onClick={salvar} disabled={!dirty || updating}>
            {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}