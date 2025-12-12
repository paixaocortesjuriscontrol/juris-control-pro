import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useMonitoramento360, TermoMonitoramento } from "@/hooks/useMonitoramento360";
import { useAuth } from "@/contexts/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const termosPadrao = [
  { termo: 'bloqueio', categoria: 'bloqueio', prioridade: 'urgente' },
  { termo: 'penhora', categoria: 'bloqueio', prioridade: 'alta' },
  { termo: 'liminar', categoria: 'liminar', prioridade: 'urgente' },
  { termo: 'tutela', categoria: 'liminar', prioridade: 'alta' },
  { termo: 'sentença', categoria: 'sentenca', prioridade: 'alta' },
  { termo: 'julgado', categoria: 'sentenca', prioridade: 'media' },
  { termo: 'decisão', categoria: 'decisao', prioridade: 'media' },
  { termo: 'despacho', categoria: 'decisao', prioridade: 'baixa' },
  { termo: 'citação', categoria: 'citacao', prioridade: 'alta' },
  { termo: 'intimação', categoria: 'citacao', prioridade: 'media' },
];

export default function TermosConfig() {
  const { user } = useAuth();
  const { termos, criarTermo, atualizarTermo, excluirTermo, CATEGORIAS, PRIORIDADES } = useMonitoramento360();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTermo, setEditingTermo] = useState<TermoMonitoramento | null>(null);
  const [formData, setFormData] = useState({
    termo: '',
    descricao: '',
    categoria: 'geral',
    prioridade: 'media',
  });

  const resetForm = () => {
    setFormData({ termo: '', descricao: '', categoria: 'geral', prioridade: 'media' });
    setEditingTermo(null);
  };

  const handleOpenDialog = (termo?: TermoMonitoramento) => {
    if (termo) {
      setEditingTermo(termo);
      setFormData({
        termo: termo.termo,
        descricao: termo.descricao || '',
        categoria: termo.categoria,
        prioridade: termo.prioridade,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.termo.trim()) return;

    if (editingTermo) {
      await atualizarTermo.mutateAsync({
        id: editingTermo.id,
        ...formData,
      });
    } else {
      await criarTermo.mutateAsync({
        ...formData,
        ativo: true,
        criado_por: user?.id || '',
      });
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleImportarPadrao = async () => {
    for (const t of termosPadrao) {
      const existe = termos.some(termo => 
        termo.termo.toLowerCase() === t.termo.toLowerCase()
      );
      if (!existe) {
        await criarTermo.mutateAsync({
          termo: t.termo,
          descricao: null,
          categoria: t.categoria,
          prioridade: t.prioridade,
          ativo: true,
          criado_por: user?.id || '',
        });
      }
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'urgente': return 'destructive';
      case 'alta': return 'default';
      case 'media': return 'secondary';
      case 'baixa': return 'outline';
      default: return 'secondary';
    }
  };

  const getCategoriaLabel = (categoria: string) => {
    return CATEGORIAS.find(c => c.value === categoria)?.label || categoria;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Termos Estratégicos
            </CardTitle>
            <CardDescription>
              Configure os termos que serão monitorados nos andamentos processuais
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleImportarPadrao}>
              Importar Padrão
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Termo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTermo ? 'Editar Termo' : 'Novo Termo'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Termo *</Label>
                    <Input
                      value={formData.termo}
                      onChange={(e) => setFormData({ ...formData, termo: e.target.value })}
                      placeholder="Ex: bloqueio, liminar, sentença..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Descrição opcional do termo"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={formData.categoria}
                        onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Prioridade</Label>
                      <Select
                        value={formData.prioridade}
                        onValueChange={(value) => setFormData({ ...formData, prioridade: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORIDADES.map((prio) => (
                            <SelectItem key={prio.value} value={prio.value}>
                              {prio.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={!formData.termo.trim()}>
                      {editingTermo ? 'Salvar' : 'Criar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {termos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum termo configurado. Clique em "Importar Padrão" para começar.
                </TableCell>
              </TableRow>
            ) : (
              termos.map((termo) => (
                <TableRow key={termo.id}>
                  <TableCell className="font-medium">{termo.termo}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getCategoriaLabel(termo.categoria)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPrioridadeColor(termo.prioridade)}>
                      {PRIORIDADES.find(p => p.value === termo.prioridade)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={termo.ativo}
                      onCheckedChange={(checked) => 
                        atualizarTermo.mutate({ id: termo.id, ativo: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(termo)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir termo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O termo "{termo.termo}" será excluído permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => excluirTermo.mutate(termo.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
