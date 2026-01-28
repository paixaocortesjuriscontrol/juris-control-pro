import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Receipt, Plus, Trash2, Save, X, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCustasProcessuais, CustaProcessual } from "@/hooks/useDepositosCustas";

interface CustasProcessuaisCardProps {
  processoId: string;
}

export function CustasProcessuaisCard({ processoId }: CustasProcessuaisCardProps) {
  const { custas, isLoading, total, addCusta, updateCusta, deleteCusta } = useCustasProcessuais(processoId);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    data_pagamento: "",
    descricao: "",
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
    setForm({ data_pagamento: "", descricao: "", valor: "", observacoes: "" });
  };

  const handleEdit = (custa: CustaProcessual) => {
    setEditingId(custa.id);
    setIsAdding(false);
    setForm({
      data_pagamento: custa.data_pagamento || "",
      descricao: custa.descricao || "",
      valor: custa.valor?.toString() || "",
      observacoes: custa.observacoes || "",
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm({ data_pagamento: "", descricao: "", valor: "", observacoes: "" });
  };

  const handleSave = async () => {
    if (!form.data_pagamento || !form.descricao || !form.valor) return;

    if (editingId) {
      await updateCusta.mutateAsync({
        id: editingId,
        data_pagamento: form.data_pagamento,
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        observacoes: form.observacoes || null,
      });
    } else {
      await addCusta.mutateAsync({
        processo_id: processoId,
        data_pagamento: form.data_pagamento,
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        observacoes: form.observacoes || null,
      });
    }
    handleCancel();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja realmente excluir esta custa?")) {
      await deleteCusta.mutateAsync(id);
    }
  };

  return (
    <Card className="border">
      <CardHeader className="py-3 px-4 bg-blue-50 dark:bg-blue-950/30 border-b">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            Custas Processuais
          </div>
          <Badge variant="secondary" className="text-xs font-bold">
            {formatCurrency(total)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
        {/* Lista de custas */}
        {custas.map((custa) => (
          <div key={custa.id} className="text-xs p-2 bg-muted/50 rounded border-l-2 border-blue-500">
            {editingId === custa.id ? (
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
                  <Label className="text-[10px]">Descrição</Label>
                  <Input
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="Ex: Custas iniciais"
                  />
                </div>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" className="h-6 text-xs" onClick={handleSave} disabled={updateCusta.isPending}>
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
                  <div className="font-medium">{custa.descricao}</div>
                  <div className="text-muted-foreground">{formatDate(custa.data_pagamento)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-600">{formatCurrency(custa.valor)}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(custa)}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDelete(custa.id)}>
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
              <Label className="text-[10px]">Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="h-7 text-xs"
                placeholder="Ex: Custas iniciais, Taxa de recurso..."
              />
            </div>
            <div className="flex gap-1 pt-1">
              <Button size="sm" className="h-6 text-xs" onClick={handleSave} disabled={addCusta.isPending}>
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
            Adicionar Custa
          </Button>
        )}

        {/* Estado vazio */}
        {custas.length === 0 && !isAdding && (
          <div className="text-center py-3 text-muted-foreground">
            <Receipt className="w-6 h-6 mx-auto mb-1 opacity-30" />
            <p className="text-xs">Nenhuma custa registrada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
