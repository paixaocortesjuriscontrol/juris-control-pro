import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  processoId: string;
  acompanhamentoEspecial?: boolean;
  frequenciaDiaria?: number;
  comAnexos?: boolean;
}

export function AcompanhamentoEspecialToggle({
  processoId,
  acompanhamentoEspecial = false,
  frequenciaDiaria = 1,
  comAnexos = false,
}: Props) {
  const { toast } = useToast();
  const [ativo, setAtivo] = useState(acompanhamentoEspecial);
  const [freq, setFreq] = useState<number>(frequenciaDiaria || 1);
  const [anexos, setAnexos] = useState<boolean>(comAnexos);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAtivo(acompanhamentoEspecial);
    setFreq(frequenciaDiaria || 1);
    setAnexos(comAnexos);
  }, [acompanhamentoEspecial, frequenciaDiaria, comAnexos]);

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("processos")
        .update(patch)
        .eq("id", processoId);
      if (error) throw error;
    } catch (e: any) {
      toast({ title: "Erro", description: e.message ?? "Falha ao atualizar acompanhamento", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setAtivo(checked);
    await save({
      acompanhamento_especial: checked,
      acompanhamento_ativado_em: checked ? new Date().toISOString() : null,
    });
    toast({
      title: checked ? "Acompanhamento Especial ativado" : "Acompanhamento Especial desativado",
      description: checked
        ? "A Judit passará a verificar este processo conforme a frequência definida."
        : "Este processo não será mais monitorado com prioridade.",
    });
  };

  const handleFreq = async (val: number) => {
    const v = Math.max(1, Math.min(6, Math.floor(val) || 1));
    setFreq(v);
    await save({ acompanhamento_freq_diaria: v });
  };

  const handleAnexos = async (checked: boolean) => {
    setAnexos(checked);
    await save({ acompanhamento_com_anexos: checked });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="text-sm text-muted-foreground">Acompanhamento Especial</span>
        <Switch checked={ativo} onCheckedChange={handleToggle} disabled={saving} />
      </div>
      {ativo && (
        <div className="flex flex-wrap items-center gap-3 pl-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Label htmlFor={`freq-${processoId}`} className="text-xs">Vezes ao dia:</Label>
            <Input
              id={`freq-${processoId}`}
              type="number"
              min={1}
              max={6}
              value={freq}
              onChange={(e) => setFreq(Number(e.target.value))}
              onBlur={(e) => handleFreq(Number(e.target.value))}
              className="h-7 w-16 text-xs"
              disabled={saving}
            />
          </div>
          <div className="flex items-center gap-1">
            <span>Baixar anexos</span>
            <Switch checked={anexos} onCheckedChange={handleAnexos} disabled={saving} />
          </div>
          <span className="italic text-[11px]">Cada checagem consome créditos Judit.</span>
        </div>
      )}
    </div>
  );
}