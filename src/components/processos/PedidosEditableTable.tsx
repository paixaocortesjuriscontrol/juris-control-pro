import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Save, X, Gavel, DollarSign } from "lucide-react";
import { usePedidosProcesso, PedidoProcesso } from "@/hooks/usePedidosProcesso";
import { format } from "date-fns";

interface PedidosEditableTableProps {
  processoId: string;
}

const emptyPedido = {
  pedido: "",
  valor_pedido: null as number | null,
  lei: "",
  data: "",
  sentenca: false,
  juiz_sentenca: "",
  acordao: false,
  desembargador_turma: "",
  tst: false,
  ministro_turma_sessao: "",
  observacao: "",
};

export function PedidosEditableTable({ processoId }: PedidosEditableTableProps) {
  const { pedidos, isLoading, totalValor, addPedido, updatePedido, deletePedido } = usePedidosProcesso(processoId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<typeof emptyPedido>(emptyPedido);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPedido, setNewPedido] = useState<typeof emptyPedido>(emptyPedido);

  const handleAdd = async () => {
    if (!newPedido.pedido.trim()) return;
    await addPedido.mutateAsync({
      processo_id: processoId,
      pedido: newPedido.pedido,
      valor_pedido: newPedido.valor_pedido,
      lei: newPedido.lei || null,
      data: newPedido.data || null,
      sentenca: newPedido.sentenca,
      juiz_sentenca: newPedido.juiz_sentenca || null,
      acordao: newPedido.acordao,
      desembargador_turma: newPedido.desembargador_turma || null,
      tst: newPedido.tst,
      ministro_turma_sessao: newPedido.ministro_turma_sessao || null,
      observacao: newPedido.observacao || null,
    });
    setNewPedido(emptyPedido);
    setIsAddDialogOpen(false);
  };

  const startEdit = (pedido: PedidoProcesso) => {
    setEditingId(pedido.id);
    setEditData({
      pedido: pedido.pedido,
      valor_pedido: pedido.valor_pedido,
      lei: pedido.lei || "",
      data: pedido.data || "",
      sentenca: pedido.sentenca,
      juiz_sentenca: pedido.juiz_sentenca || "",
      acordao: pedido.acordao,
      desembargador_turma: pedido.desembargador_turma || "",
      tst: pedido.tst,
      ministro_turma_sessao: pedido.ministro_turma_sessao || "",
      observacao: pedido.observacao || "",
    });
  };

  const saveEdit = async () => {
    if (!editingId || !editData.pedido.trim()) return;
    await updatePedido.mutateAsync({
      id: editingId,
      pedido: editData.pedido,
      valor_pedido: editData.valor_pedido,
      lei: editData.lei || null,
      data: editData.data || null,
      sentenca: editData.sentenca,
      juiz_sentenca: editData.juiz_sentenca || null,
      acordao: editData.acordao,
      desembargador_turma: editData.desembargador_turma || null,
      tst: editData.tst,
      ministro_turma_sessao: editData.ministro_turma_sessao || null,
      observacao: editData.observacao || null,
    });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(emptyPedido);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja remover este pedido?")) {
      await deletePedido.mutateAsync(id);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const renderBooleanBadge = (value: boolean, label: string) => {
    return value ? (
      <Badge variant="default" className="bg-green-600 text-xs">{label}</Badge>
    ) : (
      <Badge variant="outline" className="text-xs">Não</Badge>
    );
  };

  const PedidoFormFields = ({
    data,
    setData,
  }: {
    data: typeof emptyPedido;
    setData: (data: typeof emptyPedido) => void;
  }) => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Pedido *</Label>
          <Input
            value={data.pedido}
            onChange={(e) => setData({ ...data, pedido: e.target.value })}
            placeholder="Nome do pedido"
          />
        </div>
        <div className="space-y-2">
          <Label>Valor do Pedido</Label>
          <Input
            type="number"
            step="0.01"
            value={data.valor_pedido ?? ""}
            onChange={(e) => setData({ ...data, valor_pedido: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Lei</Label>
          <Input
            value={data.lei}
            onChange={(e) => setData({ ...data, lei: e.target.value })}
            placeholder="Ex: CLT Art. 457"
          />
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input
            type="date"
            value={data.data}
            onChange={(e) => setData({ ...data, data: e.target.value })}
          />
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">1ª Instância - Sentença</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sentenca"
              checked={data.sentenca}
              onCheckedChange={(checked) => setData({ ...data, sentenca: !!checked })}
            />
            <Label htmlFor="sentenca">Sentença favorável?</Label>
          </div>
          <div className="space-y-2">
            <Label>Nome do Juiz</Label>
            <Input
              value={data.juiz_sentenca}
              onChange={(e) => setData({ ...data, juiz_sentenca: e.target.value })}
              placeholder="Nome do juiz"
            />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">2ª Instância - Acórdão</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="acordao"
              checked={data.acordao}
              onCheckedChange={(checked) => setData({ ...data, acordao: !!checked })}
            />
            <Label htmlFor="acordao">Acórdão favorável?</Label>
          </div>
          <div className="space-y-2">
            <Label>Desembargador / Turma</Label>
            <Input
              value={data.desembargador_turma}
              onChange={(e) => setData({ ...data, desembargador_turma: e.target.value })}
              placeholder="Nome ou turma"
            />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">TST</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="tst"
              checked={data.tst}
              onCheckedChange={(checked) => setData({ ...data, tst: !!checked })}
            />
            <Label htmlFor="tst">TST favorável?</Label>
          </div>
          <div className="space-y-2">
            <Label>Ministro / Turma / Sessão</Label>
            <Input
              value={data.ministro_turma_sessao}
              onChange={(e) => setData({ ...data, ministro_turma_sessao: e.target.value })}
              placeholder="Nome, turma ou sessão"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observação</Label>
        <Textarea
          value={data.observacao}
          onChange={(e) => setData({ ...data, observacao: e.target.value })}
          placeholder="Observações adicionais..."
          rows={2}
        />
      </div>
    </div>
  );

  return (
    <div className="border rounded-md bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Gavel className="w-4 h-4" />
          Pedidos Trabalhistas
          <Badge variant="secondary" className="text-xs h-5">{pedidos.length}</Badge>
          {totalValor > 0 && (
            <Badge variant="outline" className="text-xs h-5 text-green-600 border-green-600">
              <DollarSign className="w-3 h-3 mr-1" />
              {formatCurrency(totalValor)}
            </Badge>
          )}
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Pedido</DialogTitle>
            </DialogHeader>
            <PedidoFormFields data={newPedido} setData={setNewPedido} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={!newPedido.pedido.trim() || addPedido.isPending}>
                <Save className="w-4 h-4 mr-1" /> Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Nenhum pedido cadastrado. Clique em "Adicionar" para criar.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r">Pedido</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground border-r w-24">Valor</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r w-20">Lei</th>
                <th className="px-2 py-1.5 text-center font-medium text-muted-foreground border-r w-20">Data</th>
                <th className="px-2 py-1.5 text-center font-medium text-muted-foreground border-r w-14">Sent.</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r w-28">Juiz</th>
                <th className="px-2 py-1.5 text-center font-medium text-muted-foreground border-r w-14">Acór.</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r w-28">Desemb.</th>
                <th className="px-2 py-1.5 text-center font-medium text-muted-foreground border-r w-12">TST</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r w-28">Ministro</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r">Obs.</th>
                <th className="px-1 py-1.5 text-center font-medium text-muted-foreground w-16">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido, idx) => (
                <tr key={pedido.id} className={`border-b hover:bg-muted/30 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                  {editingId === pedido.id ? (
                    <>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData.pedido}
                          onChange={(e) => setEditData({ ...editData, pedido: e.target.value })}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          type="number"
                          step="0.01"
                          value={editData.valor_pedido ?? ""}
                          onChange={(e) => setEditData({ ...editData, valor_pedido: e.target.value ? parseFloat(e.target.value) : null })}
                          className="h-6 text-xs px-1 text-right"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData.lei}
                          onChange={(e) => setEditData({ ...editData, lei: e.target.value })}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          type="date"
                          value={editData.data}
                          onChange={(e) => setEditData({ ...editData, data: e.target.value })}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r text-center">
                        <Checkbox
                          checked={editData.sentenca}
                          onCheckedChange={(checked) => setEditData({ ...editData, sentenca: !!checked })}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData.juiz_sentenca}
                          onChange={(e) => setEditData({ ...editData, juiz_sentenca: e.target.value })}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r text-center">
                        <Checkbox
                          checked={editData.acordao}
                          onCheckedChange={(checked) => setEditData({ ...editData, acordao: !!checked })}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData.desembargador_turma}
                          onChange={(e) => setEditData({ ...editData, desembargador_turma: e.target.value })}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r text-center">
                        <Checkbox
                          checked={editData.tst}
                          onCheckedChange={(checked) => setEditData({ ...editData, tst: !!checked })}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData.ministro_turma_sessao}
                          onChange={(e) => setEditData({ ...editData, ministro_turma_sessao: e.target.value })}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData.observacao}
                          onChange={(e) => setEditData({ ...editData, observacao: e.target.value })}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 text-center">
                        <div className="flex gap-0.5 justify-center">
                          <Button size="icon" variant="ghost" onClick={saveEdit} disabled={updatePedido.isPending} className="h-5 w-5">
                            <Save className="w-3 h-3 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-5 w-5">
                            <X className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-1 border-r font-medium truncate max-w-[150px]" title={pedido.pedido}>{pedido.pedido}</td>
                      <td className="px-2 py-1 border-r text-right tabular-nums">{formatCurrency(pedido.valor_pedido)}</td>
                      <td className="px-2 py-1 border-r truncate" title={pedido.lei || ""}>{pedido.lei || "-"}</td>
                      <td className="px-2 py-1 border-r text-center">{formatDate(pedido.data)}</td>
                      <td className="px-2 py-1 border-r text-center">{pedido.sentenca ? "✓" : "-"}</td>
                      <td className="px-2 py-1 border-r truncate" title={pedido.juiz_sentenca || ""}>{pedido.juiz_sentenca || "-"}</td>
                      <td className="px-2 py-1 border-r text-center">{pedido.acordao ? "✓" : "-"}</td>
                      <td className="px-2 py-1 border-r truncate" title={pedido.desembargador_turma || ""}>{pedido.desembargador_turma || "-"}</td>
                      <td className="px-2 py-1 border-r text-center">{pedido.tst ? "✓" : "-"}</td>
                      <td className="px-2 py-1 border-r truncate" title={pedido.ministro_turma_sessao || ""}>{pedido.ministro_turma_sessao || "-"}</td>
                      <td className="px-2 py-1 border-r truncate max-w-[100px]" title={pedido.observacao || ""}>{pedido.observacao || "-"}</td>
                      <td className="px-1 py-1 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(pedido)} className="h-6 w-6 hover:bg-primary/10" title="Editar">
                            <Pencil className="w-3.5 h-3.5 text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(pedido.id)} className="h-6 w-6 hover:bg-destructive/10" title="Excluir">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
