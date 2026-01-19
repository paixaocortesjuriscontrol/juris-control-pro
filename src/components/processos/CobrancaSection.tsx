import { useState } from "react";
import { DollarSign, Calendar, Save, X, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CobrancaSectionProps {
  processo: any;
  formatDate: (date: string | null | undefined) => string;
}

export function CobrancaSection({ processo, formatDate }: CobrancaSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataEncerramento, setDataEncerramento] = useState(processo.data_encerramento_cobranca || "");
  const [observacao, setObservacao] = useState(processo.observacao_cobranca || "");
  const { toast } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("processos")
        .update({
          data_encerramento_cobranca: dataEncerramento || null,
          observacao_cobranca: observacao || null,
        })
        .eq("id", processo.id);

      if (error) throw error;

      toast({
        title: "Cobrança atualizada",
        description: "Os dados de cobrança foram salvos com sucesso.",
      });
      setIsEditing(false);
      // Refresh the page to get updated data
      window.location.reload();
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Não foi possível salvar os dados de cobrança.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setDataEncerramento(processo.data_encerramento_cobranca || "");
    setObservacao(processo.observacao_cobranca || "");
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Cobrança
        </h3>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="w-3 h-3 mr-1" />
            Editar
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="py-3 px-4 bg-muted/30">
          <CardTitle className="text-sm">Dados de Cobrança do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="py-4 px-4">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="data_encerramento" className="text-xs font-medium text-muted-foreground">
                  Data de Encerramento da Cobrança
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input
                    id="data_encerramento"
                    type="date"
                    value={dataEncerramento}
                    onChange={(e) => setDataEncerramento(e.target.value)}
                    className="max-w-[200px]"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Data em que o advogado deseja encerrar a cobrança do cliente
                </p>
              </div>

              <div>
                <Label htmlFor="observacao" className="text-xs font-medium text-muted-foreground">
                  Observações
                </Label>
                <Textarea
                  id="observacao"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Adicione observações sobre a cobrança..."
                  className="mt-1 min-h-[100px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleSave} disabled={loading} size="sm">
                  <Save className="w-3 h-3 mr-1" />
                  {loading ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={loading} size="sm">
                  <X className="w-3 h-3 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Data de Encerramento da Cobrança
                </p>
                <p className="text-sm text-foreground mt-1">
                  {processo.data_encerramento_cobranca 
                    ? formatDate(processo.data_encerramento_cobranca)
                    : "Não definida"
                  }
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Observações
                </p>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                  {processo.observacao_cobranca || "Sem observações"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
