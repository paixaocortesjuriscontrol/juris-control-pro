import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, X } from "lucide-react";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useModelosTitulo, useSaveModeloTitulo, useDeleteModeloTitulo, type TipoModelo, type ModeloTitulo } from "@/hooks/useModelosTitulo";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { useEffect } from "react";
import { PadroesModeloEditor } from "@/components/modelos/PadroesModeloEditor";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TIPOS: { value: TipoModelo; label: string }[] = [
  { value: "tarefa", label: "Tarefa" }, { value: "prazo", label: "Prazo" },
  { value: "audiencia", label: "Audiência" }, { value: "evento", label: "Evento" }, { value: "parcela", label: "Parcela" },
];

export default function ModelosTitulo() {
  const { isAdminOrCoordinator } = useUserRole();
  const { data: coords = [] } = useCoordenacoesFull();
  const { isAdmin, coordenacoes: minhas } = useCoordenacoesDoUsuario();
  const [coordId, setCoordId] = useState<string>("");
  useEffect(() => { if (!coordId && !isAdmin && minhas.length) setCoordId(minhas[0].id); }, [coordId, isAdmin, minhas]);
  const minhasIds = useMemo(() => new Set(minhas.map((c) => c.id)), [minhas]);
  const podeEditar = (cid?: string | null) => isAdminOrCoordinator && (isAdmin || (!!cid && minhasIds.has(cid)));
  const coordsEditaveis = isAdmin ? coords : coords.filter((c: any) => minhasIds.has(c.id));
  const [tipo, setTipo] = useState<string>("");
  const [editando, setEditando] = useState<Partial<ModeloTitulo> | null>(null);

  const { data: modelos = [], isLoading } = useModelosTitulo({
    coordenacao_id: coordId && coordId !== "__all__" ? coordId : undefined,
    tipo: tipo && tipo !== "__all__" ? (tipo as TipoModelo) : undefined,
  });
  const salvar = useSaveModeloTitulo();
  const remover = useDeleteModeloTitulo();
  const { data: checklists = [] } = useQuery({
    queryKey: ["checklist-modelos-ativos"],
    queryFn: async () => ((await (supabase as any).from("checklist_modelos").select("id,nome").eq("ativo", true).order("nome")).data || []),
  });

  const modelosPorTipo = useMemo(() => {
    const map = new Map<TipoModelo, ModeloTitulo[]>();
    for (const m of modelos) { if (!map.has(m.tipo)) map.set(m.tipo, []); map.get(m.tipo)!.push(m); }
    return map;
  }, [modelos]);

  function novo() {
    setEditando({ coordenacao_id: (coordId && podeEditar(coordId) ? coordId : coordsEditaveis[0]?.id), tipo: (tipo || "tarefa") as TipoModelo, nome: "", titulo: "", descricao: "", prioridade: "media", padroes: {} });
  }

  async function submit() {
    if (!editando) return;
    if (!editando.coordenacao_id || !editando.nome || !editando.titulo || !editando.tipo) return;
    await salvar.mutateAsync(editando as any);
    setEditando(null);
  }

  return (
    <MainLayout title="Modelos de tarefas">
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-semibold">Modelos de tarefas</h1>
            <p className="text-sm text-muted-foreground">Cada coordenação cria e altera os seus modelos; os de outras coordenações aparecem só para leitura.</p>
          </div>
          {isAdminOrCoordinator && (
            <Button onClick={novo} disabled={!coordsEditaveis.length}><Plus className="h-4 w-4 mr-1" /> Novo modelo</Button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={coordId} onValueChange={setCoordId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Todas as coordenações" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {coords.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {editando && (
          <Card>
            <CardHeader><CardTitle className="text-base">{editando.id ? "Editar" : "Novo"} modelo</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Coordenação</label>
                <Select value={editando.coordenacao_id ?? ""} onValueChange={(v) => setEditando((e) => ({ ...e!, coordenacao_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{coordsEditaveis.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <Select value={editando.tipo ?? "tarefa"} onValueChange={(v) => setEditando((e) => ({ ...e!, tipo: v as TipoModelo }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nome do modelo</label>
                <Input value={editando.nome ?? ""} onChange={(e) => setEditando((s) => ({ ...s!, nome: e.target.value }))} placeholder="Ex: Contrarrazões RR" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Prioridade padrão</label>
                <Select value={editando.prioridade ?? "media"} onValueChange={(v) => setEditando((s) => ({ ...s!, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Título template</label>
                <Input value={editando.titulo ?? ""} onChange={(e) => setEditando((s) => ({ ...s!, titulo: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Descrição template</label>
                <Textarea rows={3} value={editando.descricao ?? ""} onChange={(e) => setEditando((s) => ({ ...s!, descricao: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Modelo de checklist</label>
                <Select
                  value={((editando.padroes as any)?.checklist_modelo_id as string) || "__none__"}
                  onValueChange={(v) => setEditando((s) => {
                    const p = { ...((s!.padroes ?? {}) as Record<string, any>) };
                    if (v === "__none__") delete p.checklist_modelo_id; else p.checklist_modelo_id = v;
                    return { ...s!, padroes: p };
                  })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {checklists.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cor</label>
                <Input type="color" className="h-10 w-20 p-1"
                  value={((editando.padroes as any)?.cor as string) || "#64748b"}
                  onChange={(e) => setEditando((s) => ({ ...s!, padroes: { ...((s!.padroes ?? {}) as any), cor: e.target.value } }))} />
              </div>
              <div className="md:col-span-2">
                <PadroesModeloEditor
                  tipo={(editando.tipo ?? "tarefa") as TipoModelo}
                  padroes={(editando.padroes ?? {}) as Record<string, any>}
                  onChange={(p) => setEditando((s) => ({ ...s!, padroes: p }))}
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditando(null)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
                <Button onClick={submit} disabled={salvar.isPending}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && modelos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado.</p>}
          {Array.from(modelosPorTipo.entries()).map(([t, list]) => (
            <Card key={t}>
              <CardHeader className="pb-2 flex flex-row items-center gap-2">
                <CardTitle className="text-base">{TIPOS.find(x => x.value === t)?.label}</CardTitle>
                <Badge variant="secondary">{list.length}</Badge>
              </CardHeader>
              <CardContent className="grid gap-2">
                {list.map((m) => (
                  <div key={m.id} className="flex items-start justify-between border rounded p-2 gap-2"
                    style={(m.padroes as any)?.cor ? { borderLeft: `4px solid ${(m.padroes as any).cor}` } : undefined}>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {m.nome}
                        {(m.padroes as any)?.checklist_modelo_id && <Badge variant="outline" className="ml-2 text-[10px]">Checklist</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.titulo}</div>
                      {m.descricao && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.descricao}</div>}
                    </div>
                    {podeEditar(m.coordenacao_id) && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setEditando(m)}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => remover.mutate(m.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}