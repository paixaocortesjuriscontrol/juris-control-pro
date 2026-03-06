import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { useAudienciasDetectadas, NovaAudiencia } from "@/hooks/useAudienciasDetectadas";
import { SelecionarAdvogadosAudiencia } from "./SelecionarAdvogadosAudiencia";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CriarAudienciaProcessoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoNumero: string;
  processoId: string;
}

const initialFormData: Omit<NovaAudiencia, "advogados_ids" | "processo_numero"> = {
  data_audiencia: "",
  hora: "",
  hora_local: "",
  hora_brasilia: "",
  tipo_audiencia: "",
  vara_camara: "",
  comarca: "",
  polo_ativo: "",
  cliente: "",
  terceirizado: "",
  resumo_objeto: "",
  funcao: "",
  preposto: "",
  testemunhas: "",
  advogado: "",
  observacoes: "",
  status: "pendente",
};

export function CriarAudienciaProcessoDialog({
  open,
  onOpenChange,
  processoNumero,
  processoId,
}: CriarAudienciaProcessoDialogProps) {
  const { user } = useAuth();
  const { criarAudiencia } = useAudienciasDetectadas();
  const [formData, setFormData] = useState(initialFormData);
  const [advogadosSelecionados, setAdvogadosSelecionados] = useState<string[]>([]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.data_audiencia) return;

    await criarAudiencia.mutateAsync({
      ...formData,
      processo_numero: processoNumero,
      advogados_ids: advogadosSelecionados,
    });

    setFormData(initialFormData);
    setAdvogadosSelecionados([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Nova Audiência</DialogTitle>
          <DialogDescription>
            Processo: {processoNumero}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Data e Tipo */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cad-data">Data da Audiência *</Label>
                <Input
                  id="cad-data"
                  type="date"
                  value={formData.data_audiencia}
                  onChange={(e) => handleChange("data_audiencia", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cad-tipo">Tipo de Audiência</Label>
                <Input
                  id="cad-tipo"
                  placeholder="Ex: Inicial, Instrução..."
                  value={formData.tipo_audiencia}
                  onChange={(e) => handleChange("tipo_audiencia", e.target.value)}
                />
              </div>
            </div>

            {/* Horários */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cad-hora">Hora</Label>
                <Input
                  id="cad-hora"
                  placeholder="14:00"
                  value={formData.hora}
                  onChange={(e) => handleChange("hora", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cad-hora-local">Hora Local</Label>
                <Input
                  id="cad-hora-local"
                  placeholder="14:00"
                  value={formData.hora_local}
                  onChange={(e) => handleChange("hora_local", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cad-hora-bsb">Hora Brasília</Label>
                <Input
                  id="cad-hora-bsb"
                  placeholder="15:00"
                  value={formData.hora_brasilia}
                  onChange={(e) => handleChange("hora_brasilia", e.target.value)}
                />
              </div>
            </div>

            {/* Vara e Comarca */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cad-vara">VT / Câmara</Label>
                <Input
                  id="cad-vara"
                  placeholder="Ex: 22ª VT"
                  value={formData.vara_camara}
                  onChange={(e) => handleChange("vara_camara", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cad-comarca">Comarca</Label>
                <Input
                  id="cad-comarca"
                  placeholder="Ex: Brasília"
                  value={formData.comarca}
                  onChange={(e) => handleChange("comarca", e.target.value)}
                />
              </div>
            </div>

            {/* Partes */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cad-polo">Polo Ativo (Reclamante)</Label>
                <Input
                  id="cad-polo"
                  placeholder="Nome do reclamante"
                  value={formData.polo_ativo}
                  onChange={(e) => handleChange("polo_ativo", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cad-cliente">Cliente (Reclamado)</Label>
                <Input
                  id="cad-cliente"
                  placeholder="Nome do cliente"
                  value={formData.cliente}
                  onChange={(e) => handleChange("cliente", e.target.value)}
                />
              </div>
            </div>

            {/* Preposto / Testemunhas */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cad-preposto">Preposto</Label>
                <Input
                  id="cad-preposto"
                  placeholder="Nome e contato do preposto"
                  value={formData.preposto}
                  onChange={(e) => handleChange("preposto", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cad-testemunhas">Testemunhas</Label>
                <Input
                  id="cad-testemunhas"
                  placeholder="Nomes das testemunhas"
                  value={formData.testemunhas}
                  onChange={(e) => handleChange("testemunhas", e.target.value)}
                />
              </div>
            </div>

            {/* Advogados */}
            <SelecionarAdvogadosAudiencia
              selectedAdvogados={advogadosSelecionados}
              onSelectionChange={setAdvogadosSelecionados}
            />

            {/* Status e Observações */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cad-status">Status</Label>
                <Select
                  value={formData.status || "pendente"}
                  onValueChange={(v) => handleChange("status", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">⏳ Pendente</SelectItem>
                    <SelectItem value="confirmado">✅ Confirmado</SelectItem>
                    <SelectItem value="reagendado">🔄 Reagendado</SelectItem>
                    <SelectItem value="tratado">✔️ Tratado</SelectItem>
                    <SelectItem value="cancelado">❌ Cancelado</SelectItem>
                    <SelectItem value="ignorado">🚫 Ignorado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cad-obs">Observações</Label>
                <Textarea
                  id="cad-obs"
                  placeholder="Observações adicionais..."
                  value={formData.observacoes}
                  onChange={(e) => handleChange("observacoes", e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criarAudiencia.isPending}>
                {criarAudiencia.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar Audiência
                  </>
                )}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
