import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface Props {
  processo: any;
}

const fields = [
  { key: "data_fatal", label: "Data Fatal", type: "date" },
  { key: "dossie_tst", label: "Dossiê", type: "text" },
  { key: "equipe_tst", label: "Equipe", type: "text" },
  { key: "decisao_tst", label: "Decisão", type: "textarea" },
  { key: "formulario_tst", label: "Formulário", type: "text" },
  { key: "providencias_tst", label: "Providências", type: "textarea" },
  { key: "deposito_judicial_tst", label: "Depósito Judicial", type: "text" },
  { key: "preparo_tst", label: "Preparo", type: "text" },
  { key: "multa_custas_tst", label: "Multa/Custas", type: "text" },
  { key: "responsavel_tst", label: "Responsável", type: "text" },
] as const;

export function PrazoSectionEditable({ processo }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (processo && !initialized) {
      const init: Record<string, string> = {};
      fields.forEach((f) => {
        init[f.key] = processo[f.key] || "";
      });
      setForm(init);
      setInitialized(true);
    }
  }, [processo, initialized]);

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const salvar = async () => {
    if (!processo?.id) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      fields.forEach((f) => {
        const val = form[f.key]?.trim() || null;
        updates[f.key] = val;
      });
      const { error } = await supabase
        .from("processos")
        .update(updates as any)
        .eq("id", processo.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["processo"] });
      queryClient.invalidateQueries({ queryKey: ["processos-tst"] });
      toast.success("Prazo atualizado com sucesso");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Prazo Fatal</h2>
        <Button size="sm" onClick={salvar} disabled={saving}>
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) =>
          f.type === "textarea" ? (
            <div key={f.key} className="md:col-span-2 space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">{f.label}</Label>
              <Textarea
                className="text-sm min-h-[60px]"
                value={form[f.key] || ""}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.label}
              />
            </div>
          ) : (
            <div key={f.key} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">{f.label}</Label>
              <Input
                className="h-8 text-sm"
                type={f.type}
                value={form[f.key] || ""}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.label}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
