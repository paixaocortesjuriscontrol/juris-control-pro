import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface AtribuirCoordenacaoLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProcessos: string[];
  onSuccess: () => void;
}

export function AtribuirCoordenacaoLoteDialog({
  open,
  onOpenChange,
  selectedProcessos,
  onSuccess,
}: AtribuirCoordenacaoLoteDialogProps) {
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { data: coordenacoes } = useCoordenacoes();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!coordenacaoId) {
      toast.error("Selecione uma coordenação");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("processos")
        .update({ coordenacao_id: coordenacaoId })
        .in("id", selectedProcessos);

      if (error) throw error;

      toast.success(`${selectedProcessos.length} processo(s) atribuído(s) à coordenação`);
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-dashboard"] });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao atribuir processos: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir Coordenação em Lote</DialogTitle>
          <DialogDescription>
            {selectedProcessos.length} processo(s) selecionado(s) serão atribuídos à coordenação escolhida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="coordenacao">Coordenação</Label>
            <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a coordenação" />
              </SelectTrigger>
              <SelectContent>
                {coordenacoes?.map((coord) => (
                  <SelectItem key={coord.id} value={coord.id}>
                    {coord.nome} ({coord.area})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !coordenacaoId}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
