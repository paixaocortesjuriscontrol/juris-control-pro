import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { mascararCnjDigitacao, obterVariantesCnjBusca } from "@/utils/cnjMask";

/** Registro é um "caso" (sem número judicial) e pode virar processo. */
export function ehCasoSemProcesso(p: { area?: string | null; numero?: string | null; tipo_processo?: string | null }): boolean {
  const area = String(p.area || "").trim().toLowerCase();
  const numero = String(p.numero || "").trim();
  return area === "caso" || p.tipo_processo === "caso" || /^(SEM-NUMERO|CASO)-/i.test(numero) || numero === "";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  processoId: string;
  areaAtual?: string | null;
  onConvertido: (dados: { numero: string; area: string; tipo_processo: string }) => void;
}

export function ConverterCasoProcessoDialog({ open, onOpenChange, processoId, areaAtual, onConvertido }: Props) {
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState("");
  const areaInicial = ["civil", "trabalhista", "empresarial"].includes(String(areaAtual || "").toLowerCase())
    ? String(areaAtual).toLowerCase() : "";
  const [area, setArea] = useState(areaInicial);
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    const n = numero.trim();
    const digitos = n.replace(/\D/g, "");
    if (digitos.length !== 20) { toast.error("Informe o número completo do processo (CNJ com 20 dígitos)."); return; }
    if (!area) { toast.error("Escolha a área do processo."); return; }
    setSalvando(true);
    try {
      const { data: existentes, error: errBusca } = await supabase
        .from("processos").select("id, numero").in("numero", obterVariantesCnjBusca(n)).neq("id", processoId).limit(1);
      if (errBusca) throw errBusca;
      if (existentes && existentes.length > 0) {
        toast.error(`Já existe um processo cadastrado com o número ${existentes[0].numero}.`);
        return;
      }
      const { data: upd, error } = await supabase
        .from("processos")
        .update({ numero: n, area, tipo_processo: "judicial" } as any)
        .eq("id", processoId)
        .select("id");
      if (error) throw error;
      if (!upd || upd.length === 0) throw new Error("Sem permissão para alterar este caso.");
      await queryClient.invalidateQueries({ queryKey: ["processo"] });
      await queryClient.invalidateQueries({ queryKey: ["processos"] });
      onConvertido({ numero: n, area, tipo_processo: "judicial" });
      toast.success("Caso transformado em processo judicial.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível transformar o caso.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transformar caso em processo judicial</DialogTitle>
          <DialogDescription>
            Partes, tarefas, prazos, documentos e histórico continuam ligados ao mesmo cadastro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Número do processo (CNJ)</Label>
            <Input
              placeholder="0000000-00.0000.0.00.0000"
              value={numero}
              maxLength={25}
              onChange={(e) => setNumero(mascararCnjDigitacao(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Área</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="civil">Cível</SelectItem>
                <SelectItem value="trabalhista">Trabalhista</SelectItem>
                <SelectItem value="empresarial">Empresarial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Transformar em processo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
