import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, X, FileText, Search } from "lucide-react";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import {
  useTesesJuridicas,
  useSaveTeseJuridica,
  useDeleteTeseJuridica,
  type TipoPeca,
  type AreaTese,
  type TeseJuridica,
  type TeseInsert,
} from "@/hooks/useTesesJuridicas";
import { useUserRole } from "@/hooks/useUserRole";
import { ImportarPecasTeses } from "@/components/teses/ImportarPecasTeses";

const TIPOS_PECA: { value: TipoPeca; label: string }[] = [
  { value: "contestacao", label: "Contestação" },
  { value: "recurso_ordinario", label: "Recurso Ordinário" },
  { value: "contrarrazoes", label: "Contrarrazões" },
  { value: "peticao_inicial", label: "Petição Inicial" },
  { value: "memoriais", label: "Memoriais" },
  { value: "outros", label: "Outros" },
];

const AREAS: { value: AreaTese; label: string }[] = [
  { value: "trabalhista", label: "Trabalhista" },
  { value: "civil", label: "Civil" },
  { value: "empresarial", label: "Empresarial" },
  { value: "direito_privado", label: "Direito Privado" },
];

function tagsParaTexto(tags: string[] | null): string {
  return (tags ?? []).join(", ");
}

function textoParaTags(texto: string): string[] {
  return texto
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function BancoTeses() {
  const { isAdminOrCoordinator } = useUserRole();
  const { data: coords = [] } = useCoordenacoesFull();
  const [coordId, setCoordId] = useState<string>("");
  const [tipoPeca, setTipoPeca] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Partial<TeseJuridica> | null>(null);

  const { data: teses = [], isLoading } = useTesesJuridicas({
    coordenacao_id: coordId && coordId !== "__all__" ? coordId : undefined,
    tipo_peca: tipoPeca && tipoPeca !== "__all__" ? (tipoPeca as TipoPeca) : undefined,
    area: area && area !== "__all__" ? (area as AreaTese) : undefined,
  });

  const salvar = useSaveTeseJuridica();
  const remover = useDeleteTeseJuridica();

  const tesesFiltradas = teses.filter((t) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      t.titulo.toLowerCase().includes(q) ||
      (t.materia ?? "").toLowerCase().includes(q) ||
      (t.assunto_cnj ?? "").toLowerCase().includes(q) ||
      (t.fundamentos ?? "").toLowerCase().includes(q) ||
      (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
    );
  });

  function novaTese() {
    setEditando({
      coordenacao_id: coordId !== "__all__" ? coordId || coords[0]?.id : coords[0]?.id,
      tipo_peca: (tipoPeca || "contestacao") as TipoPeca,
      area: (area || "trabalhista") as AreaTese,
      titulo: "",
      materia: "",
      assunto_cnj: "",
      fundamentos: "",
      tipo_recurso: "",
      tags: [],
      ativo: true,
    });
  }

  async function submit() {
    if (!editando) return;
    if (!editando.titulo?.trim()) return;
    await salvar.mutateAsync(editando as TeseInsert & { id?: string });
    setEditando(null);
  }

  return (
    <MainLayout title="Banco de Teses" subtitle="Teses jurídicas curadas para geração de peças com IA">
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-semibold">Banco de Teses</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre argumentos, fundamentos e estratégias validadas para alimentar a geração de peças com IA.
            </p>
          </div>
          {isAdminOrCoordinator && (
            <div className="flex gap-2">
              <ImportarPecasTeses coords={coords} coordPadrao={coordId && coordId !== "__all__" ? coordId : undefined} />
              <Button onClick={novaTese} disabled={!coords.length}>
                <Plus className="h-4 w-4 mr-1" /> Nova tese
              </Button>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={coordId} onValueChange={setCoordId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Todas as coordenações" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {coords.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipoPeca} onValueChange={setTipoPeca}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo de peça" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os tipos</SelectItem>
              {TIPOS_PECA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Área" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {AREAS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, matéria, tags..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Editor inline */}
        {editando && (
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                {editando.id ? "Editar tese" : "Nova tese"}
                <Button variant="ghost" size="sm" onClick={() => setEditando(null)}><X className="h-4 w-4" /></Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Título *</label>
                  <Input
                    value={editando.titulo ?? ""}
                    onChange={(e) => setEditando({ ...editando, titulo: e.target.value })}
                    placeholder="Ex: Argumento de prescrição quinquenal"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Coordenação</label>
                  <Select
                    value={(editando.coordenacao_id ?? "") || "__none__"}
                    onValueChange={(v) => setEditando({ ...editando, coordenacao_id: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Sem coordenação" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem coordenação</SelectItem>
                      {coords.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Tipo de peça</label>
                  <Select
                    value={(editando.tipo_peca ?? "contestacao") as string}
                    onValueChange={(v) => setEditando({ ...editando, tipo_peca: v as TipoPeca })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_PECA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Área</label>
                  <Select
                    value={(editando.area ?? "trabalhista") as string}
                    onValueChange={(v) => setEditando({ ...editando, area: v as AreaTese })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AREAS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Tipo de recurso</label>
                  <Input
                    value={editando.tipo_recurso ?? ""}
                    onChange={(e) => setEditando({ ...editando, tipo_recurso: e.target.value || null })}
                    placeholder="Ex: ED, RO, Ag..."
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Matéria</label>
                  <Input
                    value={editando.materia ?? ""}
                    onChange={(e) => setEditando({ ...editando, materia: e.target.value })}
                    placeholder="Ex: Horas extras, Verbas rescisórias..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Assunto CNJ</label>
                  <Input
                    value={editando.assunto_cnj ?? ""}
                    onChange={(e) => setEditando({ ...editando, assunto_cnj: e.target.value })}
                    placeholder="Ex: Doença ocupacional"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tags (separadas por vírgula)</label>
                <Input
                  value={tagsParaTexto(editando.tags ?? null)}
                  onChange={(e) => setEditando({ ...editando, tags: textoParaTags(e.target.value) })}
                  placeholder="Ex: prescrição, quinquenal, verbas"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fundamentos jurídicos *</label>
                <Textarea
                  value={editando.fundamentos ?? ""}
                  onChange={(e) => setEditando({ ...editando, fundamentos: e.target.value })}
                  placeholder="Argumentos, jurisprudência, fundamentos da tese..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editando.ativo ?? true}
                    onCheckedChange={(v) => setEditando({ ...editando, ativo: v })}
                  />
                  <label className="text-sm">Ativa</label>
                </div>
                <Button onClick={submit} disabled={!editando.titulo?.trim()}>
                  <Save className="h-4 w-4 mr-1" /> Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de teses */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : tesesFiltradas.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {teses.length === 0
                ? "Nenhuma tese cadastrada. Clique em \"Nova tese\" para começar."
                : "Nenhuma tese encontrada com os filtros aplicados."}
            </p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {tesesFiltradas.map((t) => {
              const coord = coords.find((c: any) => c.id === t.coordenacao_id);
              return (
                <Card key={t.id} className={!t.ativo ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{t.titulo}</CardTitle>
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {TIPOS_PECA.find((tp) => tp.value === t.tipo_peca)?.label ?? t.tipo_peca}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {AREAS.find((a) => a.value === t.area)?.label ?? t.area}
                          </Badge>
                          {t.tipo_recurso && <Badge variant="outline" className="text-xs">{t.tipo_recurso}</Badge>}
                          {coord && <Badge variant="outline" className="text-xs">{coord.nome}</Badge>}
                          {!t.ativo && <Badge variant="destructive" className="text-xs">Inativa</Badge>}
                        </div>
                      </div>
                      {isAdminOrCoordinator && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditando({ ...t, tags: t.tags ?? [] })}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { if (confirm("Excluir esta tese?")) remover.mutate(t.id); }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(t.materia || t.assunto_cnj) && (
                      <div className="text-xs text-muted-foreground">
                        {t.materia && <span>Matéria: {t.materia}</span>}
                        {t.materia && t.assunto_cnj && <span> · </span>}
                        {t.assunto_cnj && <span>Assunto: {t.assunto_cnj}</span>}
                      </div>
                    )}
                    {(t.tags ?? []).length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {(t.tags ?? []).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs font-normal">{tag}</Badge>
                        ))}
                      </div>
                    )}
                    {t.fundamentos && (
                      <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.fundamentos}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
