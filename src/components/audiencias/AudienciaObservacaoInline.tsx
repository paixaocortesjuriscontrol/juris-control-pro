import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface AudienciaObservacaoInlineProps {
  audienciaId: string;
  initialValue: string | null;
  invalidateKey: unknown[];
}

/**
 * Campo de observação editável inline para uma audiência.
 * Salva diretamente em audiencias_detectadas.observacoes com debounce manual (botão Salvar).
 */
export function AudienciaObservacaoInline({
  audienciaId,
  initialValue,
  invalidateKey,
}: AudienciaObservacaoInlineProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<string>(initialValue ?? "");
  const [savedValue, setSavedValue] = useState<string>(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setValue(initialValue ?? "");
    setSavedValue(initialValue ?? "");
  }, [initialValue, audienciaId]);

  const dirty = value !== savedValue;

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("audiencias_detectadas")
        .update({ observacoes: value || null, updated_at: new Date().toISOString() })
        .eq("id", audienciaId);
      if (error) throw error;
      setSavedValue(value);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1500);
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar observação",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Observação do advogado
        </label>
        {justSaved && !dirty && (
          <span className="text-[11px] text-emerald-600 flex items-center gap-1">
            <Check className="h-3 w-3" /> Salvo
          </span>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Anote aqui informações sobre esta audiência (preposto, testemunhas, providências, etc.)"
        className="min-h-[110px] text-sm resize-y"
        onBlur={handleSave}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1" /> Salvar observação
            </>
          )}
        </Button>
      </div>
    </div>
  );
}