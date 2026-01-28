import { useState, useEffect } from "react";
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

type PedidoFormData = {
  pedido: string;
  valor_pedido: number | null;
  lei: string;
  data: string;
  sentenca: boolean;
  juiz_sentenca: string;
  acordao: boolean;
  desembargador_turma: string;
  tst: boolean;
  ministro_turma_sessao: string;
  observacao: string;
};

const emptyPedido: PedidoFormData = {
  pedido: "",
  valor_pedido: null,
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<string, PedidoFormData>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPedido, setNewPedido] = useState<PedidoFormData>(emptyPedido);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize edit data when entering edit mode
  useEffect(() => {
    if (isEditMode && pedidos.length > 0) {
      const initialData: Record<string, PedidoFormData> = {};
      pedidos.forEach((p) => {
        initialData[p.id] = {
          pedido: p.pedido,
          valor_pedido: p.valor_pedido,
          lei: p.lei || "",
          data: p.data || "",
          sentenca: p.sentenca,
          juiz_sentenca: p.juiz_sentenca || "",
          acordao: p.acordao,
          desembargador_turma: p.desembargador_turma || "",
          tst: p.tst,
          ministro_turma_sessao: p.ministro_turma_sessao || "",
          observacao: p.observacao || "",
        };
      });
      setEditData(initialData);
    }
  }, [isEditMode, pedidos]);

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

  const updateField = (id: string, field: keyof PedidoFormData, value: any) => {
    setEditData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      for (const [id, data] of Object.entries(editData)) {
        if (!data.pedido.trim()) continue;
        await updatePedido.mutateAsync({
          id,
          pedido: data.pedido,
          valor_pedido: data.valor_pedido,
          lei: data.lei || null,
          data: data.data || null,
          sentenca: data.sentenca,
          juiz_sentenca: data.juiz_sentenca || null,
          acordao: data.acordao,
          desembargador_turma: data.desembargador_turma || null,
          tst: data.tst,
          ministro_turma_sessao: data.ministro_turma_sessao || null,
          observacao: data.observacao || null,
        });
      }
      setIsEditMode(false);
      setEditData({});
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    setEditData({});
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

  const PedidoFormFields = ({
    data,
    setData,
  }: {
    data: PedidoFormData;
    setData: (data: PedidoFormData) => void;
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
            <Badge variant="outline" className="text-xs h-5 text-primary border-primary">
              <DollarSign className="w-3 h-3 mr-1" />
              {formatCurrency(totalValor)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <Button size="sm" variant="outline" onClick={cancelEdit} className="h-7 px-2 text-xs">
                <X className="w-3 h-3 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={saveAllChanges} disabled={isSaving} className="h-7 px-2 text-xs">
                <Save className="w-3 h-3 mr-1" /> {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            <>
              {pedidos.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setIsEditMode(true)} className="h-7 px-2 text-xs">
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
              )}
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
            </>
          )}
        </div>
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
                {isEditMode && <th className="px-1 py-1.5 text-center font-medium text-muted-foreground w-10">Del</th>}
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido, idx) => (
                <tr key={pedido.id} className={`border-b hover:bg-muted/30 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                  {isEditMode && editData[pedido.id] ? (
                    <>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData[pedido.id].pedido}
                          onChange={(e) => updateField(pedido.id, "pedido", e.target.value)}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          type="number"
                          step="0.01"
                          value={editData[pedido.id].valor_pedido ?? ""}
                          onChange={(e) => updateField(pedido.id, "valor_pedido", e.target.value ? parseFloat(e.target.value) : null)}
                          className="h-6 text-xs px-1 text-right"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData[pedido.id].lei}
                          onChange={(e) => updateField(pedido.id, "lei", e.target.value)}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          type="date"
                          value={editData[pedido.id].data}
                          onChange={(e) => updateField(pedido.id, "data", e.target.value)}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r text-center">
                        <Checkbox
                          checked={editData[pedido.id].sentenca}
                          onCheckedChange={(checked) => updateField(pedido.id, "sentenca", !!checked)}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData[pedido.id].juiz_sentenca}
                          onChange={(e) => updateField(pedido.id, "juiz_sentenca", e.target.value)}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r text-center">
                        <Checkbox
                          checked={editData[pedido.id].acordao}
                          onCheckedChange={(checked) => updateField(pedido.id, "acordao", !!checked)}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData[pedido.id].desembargador_turma}
                          onChange={(e) => updateField(pedido.id, "desembargador_turma", e.target.value)}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r text-center">
                        <Checkbox
                          checked={editData[pedido.id].tst}
                          onCheckedChange={(checked) => updateField(pedido.id, "tst", !!checked)}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData[pedido.id].ministro_turma_sessao}
                          onChange={(e) => updateField(pedido.id, "ministro_turma_sessao", e.target.value)}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 border-r">
                        <Input
                          value={editData[pedido.id].observacao}
                          onChange={(e) => updateField(pedido.id, "observacao", e.target.value)}
                          className="h-6 text-xs px-1"
                        />
                      </td>
                      <td className="px-1 py-0.5 text-center">
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(pedido.id)} className="h-5 w-5 hover:bg-destructive/10">
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
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
