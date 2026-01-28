import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Banknote, Plus, Trash2, Save, X, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDepositosRecursais, DepositoRecursal } from "@/hooks/useDepositosCustas";

interface DepositosRecursaisCardProps {
  processoId: string;
}

export function DepositosRecursaisCard({ processoId }: DepositosRecursaisCardProps) {
  const { depositos, isLoading, total, addDeposito, updateDeposito, deleteDeposito } = useDepositosRecursais(processoId);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    data_pagamento: "",
    titulo: "",
    valor: "",
    observacoes: "",
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setForm({ data_pagamento: "", titulo: "", valor: "", observacoes: "" });
  };

  const handleEdit = (deposito: DepositoRecursal) => {
    setEditingId(deposito.id);
    setIsAdding(false);
    setForm({
      data_pagamento: deposito.data_pagamento || "",
      titulo: deposito.titulo || "",
      valor: deposito.valor?.toString() || "",
      observacoes: deposito.observacoes || "",
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm({ data_pagamento: "", titulo: "", valor: "", observacoes: "" });
  };

  const handleSave = async () => {
    if (!form.data_pagamento || !form.titulo || !form.valor) return;

    if (editingId) {
      await updateDeposito.mutateAsync({
        id: editingId,
        data_pagamento: form.data_pagamento,
        titulo: form.titulo,
        valor: parseFloat(form.valor),
        observacoes: form.observacoes || null,
      });
    } else {
      await addDeposito.mutateAsync({
        processo_id: processoId,
        data_pagamento: form.data_pagamento,
        titulo: form.titulo,
        valor: parseFloat(form.valor),
        observacoes: form.observacoes || null,
      });
    }
    handleCancel();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja realmente excluir este depósito?")) {
      await deleteDeposito.mutateAsync(id);
    }
  };

  return (
    <Card className="border">
      <CardHeader className="py-3 px-4 bg-emerald-50 dark:bg-emerald-950/30 border-b">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-600" />
            Depósitos Recursais
          </div>
          <Badge variant="secondary" className="text-xs font-bold">
            {formatCurrency(total)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
        {/* Lista de depósitos */}
        {depositos.map((dep) => (
          <div key={dep.id} className="text-xs p-2 bg-muted/50 rounded border-l-2 border-emerald-500">
            {editingId === dep.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Data</Label>
                    <Input
                      type="date"
                      value={form.data_pagamento}
                      onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Valor</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.valor}
                      onChange={(e) => setForm({ ...form, valor: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Título</Label>
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="Ex: Depósito Recurso Ordinário"
                  />
                </div>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" className="h-6 text-xs" onClick={handleSave} disabled={updateDeposito.isPending}>
                    <Save className="w-3 h-3 mr-1" />
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleCancel}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">{dep.titulo}</div>
                  <div className="text-muted-foreground">{formatDate(dep.data_pagamento)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-600">{formatCurrency(dep.valor)}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(dep)}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDelete(dep.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Formulário para adicionar */}
        {isAdding && (
          <div className="p-2 border rounded bg-muted/30 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Data Pagamento</Label>
                <Input
                  type="date"
                  value={form.data_pagamento}
                  onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="h-7 text-xs"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Título (a que título)</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className="h-7 text-xs"
                placeholder="Ex: Depósito Recurso Ordinário"
              />
            </div>
            <div className="flex gap-1 pt-1">
              <Button size="sm" className="h-6 text-xs" onClick={handleSave} disabled={addDeposito.isPending}>
                <Save className="w-3 h-3 mr-1" />
                Salvar
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleCancel}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Botão adicionar */}
        {!isAdding && !editingId && (
          <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={handleAdd}>
            <Plus className="w-3 h-3 mr-1" />
            Adicionar Depósito
          </Button>
        )}

        {/* Estado vazio */}
        {depositos.length === 0 && !isAdding && (
          <div className="text-center py-3 text-muted-foreground">
            <Banknote className="w-6 h-6 mx-auto mb-1 opacity-30" />
            <p className="text-xs">Nenhum depósito registrado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
