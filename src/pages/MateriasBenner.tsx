import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Search, Save, Pencil } from "lucide-react";
import {
  useMateriasBenner,
  MateriaBenner,
  MateriaBennerInsert,
} from "@/hooks/useMateriasBenner";

const empty: MateriaBennerInsert = {
  nome: "",
  descricao: "",
  ativo: true,
  tipo: "Dicionário Banco",
};

export default function MateriasBennerPage() {
  const { dados, loading, saveDado, deleteDado } = useMateriasBenner();
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<MateriaBenner | null>(null);
  const [form, setForm] = useState<MateriaBennerInsert>({ ...empty });
  const [saving, setSaving] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return dados.filter((m) => {
      if (filtroTipo !== "todos" && (m.tipo || "Dicionário Banco") !== filtroTipo) return false;
      if (!q) return true;
      return (
        m.nome.toLowerCase().includes(q) ||
        (m.descricao || "").toLowerCase().includes(q)
      );
    });
  }, [dados, busca, filtroTipo]);

  const openNew = () => {
    setEditando(null);
    setForm({ ...empty });
    setOpen(true);
  };

  const openEdit = (m: MateriaBenner) => {
    setEditando(m);
    setForm({
      nome: m.nome,
      descricao: m.descricao || "",
      ativo: m.ativo,
      tipo: m.tipo || "Dicionário Banco",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveDado(form, editando?.id);
    setSaving(false);
    if (ok) setOpen(false);
  };

  const handleDelete = async (m: MateriaBenner) => {
    if (confirm(`Excluir a matéria "${m.nome}"?`)) {
      await deleteDado(m.id);
    }
  };

  return (
    <MainLayout title="Matérias Benner">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Matérias Benner
            </h1>
            <p className="text-sm text-muted-foreground">
              Catálogo de matérias usadas no campo "Matérias Recurso Reclamante"
              da Distribuição TST.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Nova Matéria
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou descrição..."
              className="pl-9"
            />
          </div>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="Dicionário Banco">Dicionário Banco</SelectItem>
              <SelectItem value="Advogado">Advogado</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filtrados.length} de {dados.length}
          </span>
        </div>

        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-40">Tipo</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-28 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-10 text-muted-foreground"
                  >
                    Nenhuma matéria encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((m) => (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openEdit(m)}
                  >
                    <TableCell className="font-medium align-top">
                      {m.nome}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground align-top whitespace-pre-wrap">
                      {m.descricao || "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant={
                          (m.tipo || "Dicionário Banco") === "Advogado"
                            ? "default"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {m.tipo || "Dicionário Banco"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center align-top">
                      {m.ativo ? (
                        <Badge variant="outline" className="text-xs">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Inativa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-center align-top"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(m)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(m)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar Matéria" : "Nova Matéria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nome: e.target.value }))
                }
                placeholder="Nome da matéria"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.tipo || "Dicionário Banco"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, tipo: v as MateriaBennerInsert["tipo"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dicionário Banco">Dicionário Banco</SelectItem>
                  <SelectItem value="Advogado">Advogado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descricao: e.target.value }))
                }
                rows={6}
                placeholder="Descrição da matéria"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={!!form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
              />
              <Label>Matéria ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}