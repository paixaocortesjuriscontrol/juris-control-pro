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

// Format number to Brazilian currency string (without R$ prefix for input)
const formatCurrencyInput = (value: number | null): string => {
  if (value === null || value === undefined) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Parse Brazilian currency string to number
const parseCurrencyInput = (value: string): number | null => {
  if (!value || value.trim() === "") return null;
  // Remove thousand separators (.) and replace decimal separator (,) with (.)
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
};

// Currency input component that allows free-form typing
const CurrencyInput = ({ 
  value, 
  onChange, 
  className = "",
  placeholder = "0,00"
}: { 
  value: number | null; 
  onChange: (value: number | null) => void;
  className?: string;
  placeholder?: string;
}) => {
  const [displayValue, setDisplayValue] = useState(formatCurrencyInput(value));
  
  // Update display when external value changes
  useEffect(() => {
    setDisplayValue(formatCurrencyInput(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow typing freely - only numbers, dots, and commas
    const inputValue = e.target.value.replace(/[^0-9.,]/g, "");
    setDisplayValue(inputValue);
  };

  const handleBlur = () => {
    const parsed = parseCurrencyInput(displayValue);
    onChange(parsed);
    // Format the display value on blur
    setDisplayValue(formatCurrencyInput(parsed));
  };

  return (
    <Input
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
};

export function PedidosEditableTable({ processoId }: PedidosEditableTableProps) {
  const { pedidos, isLoading, totalValor, addPedido, updatePedido, deletePedido } = usePedidosProcesso(processoId);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, PedidoFormData>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPedido, setNewPedido] = useState<PedidoFormData>(emptyPedido);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize edit data when opening edit dialog
  useEffect(() => {
    if (isEditDialogOpen && pedidos.length > 0) {
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
  }, [isEditDialogOpen, pedidos]);

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
      setIsEditDialogOpen(false);
      setEditData({});
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setIsEditDialogOpen(false);
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

  const formatObs = (value: string | null) => {
    const v = (value ?? "").trim();
    // Alguns dados legados podem ter sido gravados como string "false".
    if (!v || v.toLowerCase() === "false") return "-";
    return v;
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
          <Label>Valor do Pedido (R$)</Label>
          <CurrencyInput
            value={data.valor_pedido}
            onChange={(val) => setData({ ...data, valor_pedido: val })}
            className="text-right"
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

  // Editable table component for the popup
  const EditableTableContent = () => (
    <div className="overflow-x-auto max-h-[60vh]">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted border-b">
            <th className="px-2 py-2 text-left font-medium text-muted-foreground border-r">Pedido</th>
            <th className="px-2 py-2 text-right font-medium text-muted-foreground border-r w-24">Valor</th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground border-r w-20">Lei</th>
            <th className="px-2 py-2 text-center font-medium text-muted-foreground border-r w-28">Data</th>
            <th className="px-2 py-2 text-center font-medium text-muted-foreground border-r w-14">Sent.</th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground border-r w-28">Juiz</th>
            <th className="px-2 py-2 text-center font-medium text-muted-foreground border-r w-14">Acór.</th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground border-r w-28">Desemb.</th>
            <th className="px-2 py-2 text-center font-medium text-muted-foreground border-r w-12">TST</th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground border-r w-28">Ministro</th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground border-r">Obs.</th>
            <th className="px-1 py-2 text-center font-medium text-muted-foreground w-10">Del</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((pedido, idx) => (
            <tr key={pedido.id} className={`border-b hover:bg-muted/30 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
              {editData[pedido.id] ? (
                <>
                  <td className="px-1 py-0.5 border-r">
                    <Input
                      value={editData[pedido.id].pedido}
                      onChange={(e) => updateField(pedido.id, "pedido", e.target.value)}
                      className="h-7 text-xs px-1"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-r">
                    <CurrencyInput
                      value={editData[pedido.id].valor_pedido}
                      onChange={(val) => updateField(pedido.id, "valor_pedido", val)}
                      className="h-7 text-xs px-1 text-right"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-r">
                    <Input
                      value={editData[pedido.id].lei}
                      onChange={(e) => updateField(pedido.id, "lei", e.target.value)}
                      className="h-7 text-xs px-1"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-r">
                    <Input
                      type="date"
                      value={editData[pedido.id].data}
                      onChange={(e) => updateField(pedido.id, "data", e.target.value)}
                      className="h-7 text-xs px-1"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-r text-center">
                    <Checkbox
                      checked={editData[pedido.id].sentenca}
                      onCheckedChange={(checked) => updateField(pedido.id, "sentenca", !!checked)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-r">
                    <Input
                      value={editData[pedido.id].juiz_sentenca}
                      onChange={(e) => updateField(pedido.id, "juiz_sentenca", e.target.value)}
                      className="h-7 text-xs px-1"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-r text-center">
                    <Checkbox
                      checked={editData[pedido.id].acordao}
                      onCheckedChange={(checked) => updateField(pedido.id, "acordao", !!checked)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-r">
                    <Input
                      value={editData[pedido.id].desembargador_turma}
                      onChange={(e) => updateField(pedido.id, "desembargador_turma", e.target.value)}
                      className="h-7 text-xs px-1"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-r text-center">
                    <Checkbox
                      checked={editData[pedido.id].tst}
                      onCheckedChange={(checked) => updateField(pedido.id, "tst", !!checked)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-r">
                    <Input
                      value={editData[pedido.id].ministro_turma_sessao}
                      onChange={(e) => updateField(pedido.id, "ministro_turma_sessao", e.target.value)}
                      className="h-7 text-xs px-1"
                    />
                  </td>
                  <td className="px-1 py-0.5 border-r">
                    <Input
                      value={editData[pedido.id].observacao}
                      onChange={(e) => updateField(pedido.id, "observacao", e.target.value)}
                      className="h-7 text-xs px-1"
                    />
                  </td>
                  <td className="px-1 py-0.5 text-center">
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(pedido.id)} className="h-6 w-6 hover:bg-destructive/10">
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-2 py-1.5 border-r font-medium">{pedido.pedido}</td>
                  <td className="px-2 py-1.5 border-r text-right tabular-nums">{formatCurrency(pedido.valor_pedido)}</td>
                  <td className="px-2 py-1.5 border-r">{pedido.lei || "-"}</td>
                  <td className="px-2 py-1.5 border-r text-center">{formatDate(pedido.data)}</td>
                  <td className="px-2 py-1.5 border-r text-center">{pedido.sentenca ? "✓" : "-"}</td>
                  <td className="px-2 py-1.5 border-r">{pedido.juiz_sentenca || "-"}</td>
                  <td className="px-2 py-1.5 border-r text-center">{pedido.acordao ? "✓" : "-"}</td>
                  <td className="px-2 py-1.5 border-r">{pedido.desembargador_turma || "-"}</td>
                  <td className="px-2 py-1.5 border-r text-center">{pedido.tst ? "✓" : "-"}</td>
                  <td className="px-2 py-1.5 border-r">{pedido.ministro_turma_sessao || "-"}</td>
                  <td className="px-2 py-1.5 border-r">{pedido.observacao || "-"}</td>
                  <td className="px-1 py-1.5 text-center">-</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Read-only table for main view
  const ReadOnlyTable = () => (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-muted/50 border-b">
          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r whitespace-nowrap">Pedido</th>
          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground border-r w-24 whitespace-nowrap">Valor</th>
          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r w-20 whitespace-nowrap">Lei</th>
          <th className="px-2 py-1.5 text-center font-medium text-muted-foreground border-r w-20 whitespace-nowrap">Data</th>
          <th className="px-2 py-1.5 text-center font-medium text-muted-foreground border-r w-14 whitespace-nowrap">Sent.</th>
          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r w-28 whitespace-nowrap">Juiz</th>
          <th className="px-2 py-1.5 text-center font-medium text-muted-foreground border-r w-14 whitespace-nowrap">Acór.</th>
          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r w-28 whitespace-nowrap">Desemb.</th>
          <th className="px-2 py-1.5 text-center font-medium text-muted-foreground border-r w-12 whitespace-nowrap">TST</th>
          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-r w-28 whitespace-nowrap">Ministro</th>
          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Obs.</th>
        </tr>
      </thead>
      <tbody>
        {pedidos.map((pedido, idx) => (
          <tr key={pedido.id} className={`border-b hover:bg-muted/30 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
            <td className="px-2 py-1 border-r font-medium whitespace-nowrap">{pedido.pedido}</td>
            <td className="px-2 py-1 border-r text-right tabular-nums whitespace-nowrap">{formatCurrency(pedido.valor_pedido)}</td>
            <td className="px-2 py-1 border-r whitespace-nowrap">{pedido.lei || "-"}</td>
            <td className="px-2 py-1 border-r text-center whitespace-nowrap">{formatDate(pedido.data)}</td>
            <td className="px-2 py-1 border-r text-center">{pedido.sentenca ? "✓" : "-"}</td>
            <td className="px-2 py-1 border-r whitespace-nowrap">{pedido.juiz_sentenca || "-"}</td>
            <td className="px-2 py-1 border-r text-center">{pedido.acordao ? "✓" : "-"}</td>
            <td className="px-2 py-1 border-r whitespace-nowrap">{pedido.desembargador_turma || "-"}</td>
            <td className="px-2 py-1 border-r text-center">{pedido.tst ? "✓" : "-"}</td>
            <td className="px-2 py-1 border-r whitespace-nowrap">{pedido.ministro_turma_sessao || "-"}</td>
            <td className="px-2 py-1 whitespace-nowrap">{formatObs(pedido.observacao)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-0 min-w-0 w-full border rounded-md overflow-hidden">
      {/* Header fixo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-b">
        <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
          <Gavel className="w-4 h-4 shrink-0" />
          <span>Pedidos Trabalhistas</span>
          <Badge variant="secondary" className="text-xs h-5">{pedidos.length}</Badge>
          {totalValor > 0 && (
            <Badge variant="outline" className="text-xs h-5 text-primary border-primary">
              <DollarSign className="w-3 h-3 mr-1" />
              {formatCurrency(totalValor)}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {pedidos.length > 0 && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 px-3 text-xs flex-1 sm:flex-none">
                  <Pencil className="w-3 h-3 mr-1" /> Editar pedidos
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <Gavel className="w-5 h-5" />
                    Editar Pedidos Trabalhistas
                    <Badge variant="secondary">{pedidos.length} pedidos</Badge>
                    {totalValor > 0 && (
                      <Badge variant="outline" className="text-primary border-primary">
                        Total: {formatCurrency(totalValor)}
                      </Badge>
                    )}
                  </DialogTitle>
                </DialogHeader>
                <EditableTableContent />
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={cancelEdit}>
                    <X className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                  <Button onClick={saveAllChanges} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-1" /> {isSaving ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs flex-1 sm:flex-none">
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
      </div>

      {/* Área com scroll horizontal (mesma ideia do popup) */}
      <div
        className="overflow-x-auto w-full"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
      >
        <div className={pedidos.length > 0 ? "min-w-[800px]" : "min-w-0"}>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>
          ) : pedidos.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nenhum pedido cadastrado. Clique em "Adicionar" para criar.
            </div>
          ) : (
            <ReadOnlyTable />
          )}
        </div>
      </div>
    </div>
  );
}
