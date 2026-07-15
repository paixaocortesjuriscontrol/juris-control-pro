import { useEffect, useRef, useState } from "react";
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
  const lastSavedRef = useRef({
    ativo: acompanhamentoEspecial,
    freq: frequenciaDiaria || 1,
    anexos: comAnexos,
  });

  useEffect(() => {
    // Só sincroniza a partir das props quando o valor recebido diverge
    // do último valor persistido localmente. Isso evita que uma re-render
    // do pai com dados em cache (antes do refetch) reverta o switch que
    // o usuário acabou de marcar.
    if (acompanhamentoEspecial !== lastSavedRef.current.ativo) {
      setAtivo(acompanhamentoEspecial);
      lastSavedRef.current.ativo = acompanhamentoEspecial;
    }
    const nextFreq = frequenciaDiaria || 1;
    if (nextFreq !== lastSavedRef.current.freq) {
      setFreq(nextFreq);
      lastSavedRef.current.freq = nextFreq;
    }
    if (comAnexos !== lastSavedRef.current.anexos) {
      setAnexos(comAnexos);
      lastSavedRef.current.anexos = comAnexos;
    }
  }, [acompanhamentoEspecial, frequenciaDiaria, comAnexos]);

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("processos")
        .update(patch)
        .eq("id", processoId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "Sem permissão para alterar este processo (RLS). Peça a um admin/coordenador."
        );
      }
      return true;
    } catch (e: any) {
      toast({ title: "Erro", description: e.message ?? "Falha ao atualizar acompanhamento", variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setAtivo(checked);
    const ok = await save({
      acompanhamento_especial: checked,
      acompanhamento_ativado_em: checked ? new Date().toISOString() : null,
    });
    if (!ok) {
      setAtivo(!checked);
      return;
    }
    lastSavedRef.current.ativo = checked;
    toast({
      title: checked ? "Acompanhamento Especial ativado" : "Acompanhamento Especial desativado",
      description: checked
        ? "A Judit passará a verificar este processo conforme a frequência definida."
        : "Este processo não será mais monitorado com prioridade.",
    });
  };

  const handleFreq = async (val: number) => {
    const v = Math.max(1, Math.min(3, Math.floor(val) || 1));
    setFreq(v);
    const ok = await save({ acompanhamento_freq_diaria: v });
    if (ok) lastSavedRef.current.freq = v;
  };

  const handleAnexos = async (checked: boolean) => {
    setAnexos(checked);
    const ok = await save({ acompanhamento_com_anexos: checked });
    if (ok) lastSavedRef.current.anexos = checked;
    else setAnexos(!checked);
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
              max={3}
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
          <span className="italic text-[11px]">
            Execução em horário fixo BRT: 1x=10h, 2x=10h/18h, 3x=10h/14h/18h. Cada checagem consome créditos Judit.
          </span>
        </div>
      )}
    </div>
  );
}