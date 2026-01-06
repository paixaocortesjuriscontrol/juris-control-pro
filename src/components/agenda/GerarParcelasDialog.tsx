import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { Loader2, Calendar, DollarSign, Hash, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface GerarParcelasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INTERVALOS = [
  { value: "semanal", label: "Semanal (7 dias)", dias: 7 },
  { value: "quinzenal", label: "Quinzenal (15 dias)", dias: 15 },
  { value: "mensal", label: "Mensal (30 dias)", dias: 30 },
];

export function GerarParcelasDialog({ open, onOpenChange }: GerarParcelasDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    descricao: "",
    totalParcelas: 12,
    dataVencimento: format(new Date(), "yyyy-MM-dd"),
    valorPadrao: "",
    intervalo: "mensal",
  });
  
  // Valores individuais por parcela
  const [valoresIndividuais, setValoresIndividuais] = useState<string[]>([]);

  // Atualizar valores individuais quando muda total de parcelas ou valor padrão
  const atualizarValoresIndividuais = (novoPadrao?: string, novoTotal?: number) => {
    const total = novoTotal ?? formData.totalParcelas;
    const padrao = novoPadrao ?? formData.valorPadrao;
    
    setValoresIndividuais(prev => {
      const novosValores = [...prev];
      // Expandir ou reduzir array
      while (novosValores.length < total) {
        novosValores.push(padrao);
      }
      if (novosValores.length > total) {
        novosValores.length = total;
      }
      return novosValores;
    });
  };

  // Calcular preview das parcelas
  const calcularParcelas = () => {
    const parcelas: { numero: number; data: Date; valor: string }[] = [];
    const intervaloConfig = INTERVALOS.find(i => i.value === formData.intervalo);
    if (!intervaloConfig) return parcelas;

    let dataAtual = new Date(formData.dataVencimento + "T12:00:00");
    
    for (let i = 1; i <= formData.totalParcelas; i++) {
      parcelas.push({
        numero: i,
        data: new Date(dataAtual),
        valor: valoresIndividuais[i - 1] || formData.valorPadrao,
      });
      
      // Calcular próxima data
      if (formData.intervalo === "semanal") {
        dataAtual = addWeeks(dataAtual, 1);
      } else if (formData.intervalo === "quinzenal") {
        dataAtual = addDays(dataAtual, 15);
      } else {
        dataAtual = addMonths(dataAtual, 1);
      }
    }
    
    return parcelas;
  };

  const parcelasPreview = calcularParcelas();
  
  // Calcular valor total considerando valores individuais
  const valorTotal = parcelasPreview.reduce((acc, p) => {
    const valor = parseFloat((p.valor || "0").replace(",", ".")) || 0;
    return acc + valor;
  }, 0).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    if (!formData.descricao.trim()) {
      toast.error("Informe uma descrição para as parcelas");
      return;
    }

    if (formData.totalParcelas < 1 || formData.totalParcelas > 120) {
      toast.error("Número de parcelas deve ser entre 1 e 120");
      return;
    }

    setIsSubmitting(true);

    try {
      const grupoId = crypto.randomUUID();

      const eventosParaInserir = parcelasPreview.map((parcela) => {
        const valorNumerico = parcela.valor 
          ? parseFloat(parcela.valor.replace(",", ".")) 
          : null;
        
        return {
          titulo: `Parcela ${parcela.numero}/${formData.totalParcelas} - ${formData.descricao}`,
          descricao: `Parcela ${parcela.numero} de ${formData.totalParcelas}. Valor: R$ ${parcela.valor || "0,00"}`,
          tipo: "prazo_parcela",
          data_inicio: parcela.data.toISOString(),
          dia_inteiro: true,
          criado_por: user.id,
          status: "pendente",
          grupo_parcelas: grupoId,
          numero_parcela: parcela.numero,
          total_parcelas: formData.totalParcelas,
          valor_parcela: valorNumerico,
        };
      });

      const { error } = await supabase
        .from("eventos_agenda")
        .insert(eventosParaInserir);

      if (error) throw error;

      toast.success(`${formData.totalParcelas} parcelas criadas com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["eventos-stats"] });
      
      // Reset form
      setFormData({
        descricao: "",
        totalParcelas: 12,
        dataVencimento: format(new Date(), "yyyy-MM-dd"),
        valorPadrao: "",
        intervalo: "mensal",
      });
      setValoresIndividuais([]);
      
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao criar parcelas:", error);
      toast.error("Erro ao criar parcelas. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Gerar Parcelas
          </DialogTitle>
          <DialogDescription>
            Crie múltiplas parcelas automaticamente. Preencha os dados e as datas serão calculadas.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            {/* Descrição */}
            <div>
              <Label htmlFor="descricao">Descrição do Parcelamento *</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Acordo Trabalhista João Silva"
                rows={2}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Total de Parcelas */}
              <div>
                <Label htmlFor="totalParcelas" className="flex items-center gap-1.5">
                  <Hash className="w-4 h-4" />
                  Nº de Parcelas *
                </Label>
                <Input
                  id="totalParcelas"
                  type="number"
                  min={1}
                  max={120}
                  value={formData.totalParcelas}
                  onChange={(e) => {
                    const novoTotal = parseInt(e.target.value) || 1;
                    setFormData({ ...formData, totalParcelas: novoTotal });
                    atualizarValoresIndividuais(undefined, novoTotal);
                  }}
                  required
                />
              </div>

              {/* Valor Padrão */}
              <div>
                <Label htmlFor="valorPadrao" className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  Valor Padrão (R$)
                </Label>
                <Input
                  id="valorPadrao"
                  type="text"
                  value={formData.valorPadrao}
                  onChange={(e) => {
                    const novoValor = e.target.value;
                    setFormData({ ...formData, valorPadrao: novoValor });
                    atualizarValoresIndividuais(novoValor);
                  }}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Edite valores individuais no preview abaixo
                </p>
              </div>

              {/* Data da Primeira Parcela */}
              <div>
                <Label htmlFor="dataVencimento" className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  1ª Parcela (Vencimento) *
                </Label>
                <Input
                  id="dataVencimento"
                  type="date"
                  value={formData.dataVencimento}
                  onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
                  required
                />
              </div>

              {/* Intervalo */}
              <div>
                <Label htmlFor="intervalo" className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Intervalo entre Parcelas
                </Label>
                <Select
                  value={formData.intervalo}
                  onValueChange={(value) => setFormData({ ...formData, intervalo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALOS.map((intervalo) => (
                      <SelectItem key={intervalo.value} value={intervalo.value}>
                        {intervalo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Resumo */}
            <Card className="p-4 bg-muted/50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total de parcelas:</span>
                  <Badge variant="secondary" className="ml-2">{formData.totalParcelas}</Badge>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Valor total:</span>
                  <Badge variant="outline" className="ml-2">R$ {valorTotal}</Badge>
                </div>
              </div>
            </Card>

            {/* Preview das Parcelas com valores editáveis */}
            {parcelasPreview.length > 0 && (
              <div className="border rounded-lg p-4 space-y-2">
                <Label className="font-medium">Parcelas (valores editáveis)</Label>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {parcelasPreview.map((parcela) => (
                      <div
                        key={parcela.numero}
                        className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-muted/30"
                      >
                        <span className="font-medium w-24 shrink-0">
                          Parcela {parcela.numero}/{formData.totalParcelas}
                        </span>
                        <span className="text-muted-foreground w-24 shrink-0">
                          {format(parcela.data, "dd/MM/yyyy")}
                        </span>
                        <div className="flex items-center gap-1 flex-1">
                          <span className="text-muted-foreground">R$</span>
                          <Input
                            type="text"
                            value={valoresIndividuais[parcela.numero - 1] ?? formData.valorPadrao}
                            onChange={(e) => {
                              const novosValores = [...valoresIndividuais];
                              // Garantir que array tem tamanho correto
                              while (novosValores.length < formData.totalParcelas) {
                                novosValores.push(formData.valorPadrao);
                              }
                              novosValores[parcela.numero - 1] = e.target.value;
                              setValoresIndividuais(novosValores);
                            }}
                            placeholder="0,00"
                            className="h-8 w-28"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </form>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 sm:px-6 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !formData.descricao.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                Gerar {formData.totalParcelas} Parcelas
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
