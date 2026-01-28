import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gavel className="w-5 h-5" />
            Pedidos Trabalhistas
            <Badge variant="secondary">{pedidos.length}</Badge>
            {totalValor > 0 && (
              <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                <DollarSign className="w-3 h-3 mr-1" />
                {formatCurrency(totalValor)}
              </Badge>
            )}
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" /> Adicionar
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
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : pedidos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum pedido cadastrado. Clique em "Adicionar" para criar.
          </div>
        ) : (
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Pedido</TableHead>
                  <TableHead className="min-w-[100px]">Valor</TableHead>
                  <TableHead className="min-w-[100px]">Lei</TableHead>
                  <TableHead className="min-w-[90px]">Data</TableHead>
                  <TableHead className="min-w-[80px]">Sentença</TableHead>
                  <TableHead className="min-w-[120px]">Juiz</TableHead>
                  <TableHead className="min-w-[80px]">Acórdão</TableHead>
                  <TableHead className="min-w-[120px]">Desemb./Turma</TableHead>
                  <TableHead className="min-w-[60px]">TST</TableHead>
                  <TableHead className="min-w-[120px]">Ministro/Turma</TableHead>
                  <TableHead className="min-w-[150px]">Observação</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((pedido) => (
                  <TableRow key={pedido.id}>
                    {editingId === pedido.id ? (
                      <>
                        <TableCell>
                          <Input
                            value={editData.pedido}
                            onChange={(e) => setEditData({ ...editData, pedido: e.target.value })}
                            className="min-w-[140px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={editData.valor_pedido ?? ""}
                            onChange={(e) => setEditData({ ...editData, valor_pedido: e.target.value ? parseFloat(e.target.value) : null })}
                            className="min-w-[90px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editData.lei}
                            onChange={(e) => setEditData({ ...editData, lei: e.target.value })}
                            className="min-w-[90px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={editData.data}
                            onChange={(e) => setEditData({ ...editData, data: e.target.value })}
                            className="min-w-[80px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={editData.sentenca}
                            onCheckedChange={(checked) => setEditData({ ...editData, sentenca: !!checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editData.juiz_sentenca}
                            onChange={(e) => setEditData({ ...editData, juiz_sentenca: e.target.value })}
                            className="min-w-[110px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={editData.acordao}
                            onCheckedChange={(checked) => setEditData({ ...editData, acordao: !!checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editData.desembargador_turma}
                            onChange={(e) => setEditData({ ...editData, desembargador_turma: e.target.value })}
                            className="min-w-[110px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={editData.tst}
                            onCheckedChange={(checked) => setEditData({ ...editData, tst: !!checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editData.ministro_turma_sessao}
                            onChange={(e) => setEditData({ ...editData, ministro_turma_sessao: e.target.value })}
                            className="min-w-[110px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editData.observacao}
                            onChange={(e) => setEditData({ ...editData, observacao: e.target.value })}
                            className="min-w-[140px]"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={saveEdit} disabled={updatePedido.isPending}>
                              <Save className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={cancelEdit}>
                              <X className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium">{pedido.pedido}</TableCell>
                        <TableCell>{formatCurrency(pedido.valor_pedido)}</TableCell>
                        <TableCell>{pedido.lei || "-"}</TableCell>
                        <TableCell>{formatDate(pedido.data)}</TableCell>
                        <TableCell>{renderBooleanBadge(pedido.sentenca, "Sim")}</TableCell>
                        <TableCell className="text-sm">{pedido.juiz_sentenca || "-"}</TableCell>
                        <TableCell>{renderBooleanBadge(pedido.acordao, "Sim")}</TableCell>
                        <TableCell className="text-sm">{pedido.desembargador_turma || "-"}</TableCell>
                        <TableCell>{renderBooleanBadge(pedido.tst, "Sim")}</TableCell>
                        <TableCell className="text-sm">{pedido.ministro_turma_sessao || "-"}</TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate" title={pedido.observacao || ""}>
                          {pedido.observacao || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => startEdit(pedido)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(pedido.id)}>
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
