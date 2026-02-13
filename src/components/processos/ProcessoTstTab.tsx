import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, Gavel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ProcessoTstTabProps {
  processo: any;
}

export function ProcessoTstTab({ processo }: ProcessoTstTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    dossie_tst: "",
    equipe_tst: "",
    relator_tst: "",
    relator_favorabilidade: "",
    turma_tst: "",
    turma_favorabilidade: "",
    parte_recorrente_tst: "",
    tipo_recurso_reclamante: "",
    materias_recurso_reclamante: "",
    aparelhamento_reclamante: "",
    chance_exito_reclamante: "",
    tipo_recurso_banco: "",
    materias_recurso_banco: "",
    aparelhamento_banco: "",
    chance_exito_banco: "",
    honra_tst: "",
    tema_tst: "",
    execucao_tst: "",
    midia_negativa_tst: "",
    decisao_quarteirizado: "",
    recurso_terceiros_tst: "",
    benner_atualizado: false,
  });

  useEffect(() => {
    if (processo) {
      setForm({
        dossie_tst: processo.dossie_tst || "",
        equipe_tst: processo.equipe_tst || "",
        relator_tst: processo.relator_tst || "",
        relator_favorabilidade: processo.relator_favorabilidade || "",
        turma_tst: processo.turma_tst || "",
        turma_favorabilidade: processo.turma_favorabilidade || "",
        parte_recorrente_tst: processo.parte_recorrente_tst || "",
        tipo_recurso_reclamante: processo.tipo_recurso_reclamante || "",
        materias_recurso_reclamante: processo.materias_recurso_reclamante || "",
        aparelhamento_reclamante: processo.aparelhamento_reclamante || "",
        chance_exito_reclamante: processo.chance_exito_reclamante || "",
        tipo_recurso_banco: processo.tipo_recurso_banco || "",
        materias_recurso_banco: processo.materias_recurso_banco || "",
        aparelhamento_banco: processo.aparelhamento_banco || "",
        chance_exito_banco: processo.chance_exito_banco || "",
        honra_tst: processo.honra_tst || "",
        tema_tst: processo.tema_tst || "",
        execucao_tst: processo.execucao_tst || "",
        midia_negativa_tst: processo.midia_negativa_tst || "",
        decisao_quarteirizado: processo.decisao_quarteirizado || "",
        recurso_terceiros_tst: processo.recurso_terceiros_tst || "",
        benner_atualizado: processo.benner_atualizado || false,
      });
    }
  }, [processo]);

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      const textFields = [
        "dossie_tst", "equipe_tst", "relator_tst", "relator_favorabilidade",
        "turma_tst", "turma_favorabilidade", "parte_recorrente_tst",
        "tipo_recurso_reclamante", "materias_recurso_reclamante", "aparelhamento_reclamante",
        "chance_exito_reclamante", "tipo_recurso_banco", "materias_recurso_banco",
        "aparelhamento_banco", "chance_exito_banco", "honra_tst", "tema_tst",
        "execucao_tst", "midia_negativa_tst", "decisao_quarteirizado", "recurso_terceiros_tst",
      ];

      textFields.forEach(field => {
        const newVal = form[field as keyof typeof form] || null;
        const oldVal = processo[field] || null;
        if (newVal !== oldVal) updates[field] = newVal === "" ? null : newVal;
      });

      if (form.benner_atualizado !== (processo.benner_atualizado || false)) {
        updates.benner_atualizado = form.benner_atualizado;
      }

      if (Object.keys(updates).length === 0) {
        toast({ title: "Nenhuma alteração detectada" });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("processos")
        .update(updates as any)
        .eq("id", processo.id);

      if (error) throw error;

      toast({ title: "Dados TST salvos com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["processo", processo.id] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const InputField = ({ label, field, textarea }: { label: string; field: string; textarea?: boolean }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {textarea ? (
        <Textarea
          value={form[field as keyof typeof form] as string}
          onChange={e => handleChange(field, e.target.value)}
          className="min-h-[60px]"
        />
      ) : (
        <Input
          value={form[field as keyof typeof form] as string}
          onChange={e => handleChange(field, e.target.value)}
        />
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gavel className="w-5 h-5" />
            Dados TST
          </CardTitle>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dados Básicos */}
        <div>
          <h4 className="text-sm font-semibold mb-3 text-foreground">Dados Básicos</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="Dossiê" field="dossie_tst" />
            <InputField label="Equipe" field="equipe_tst" />
            <InputField label="Relator" field="relator_tst" />
            <InputField label="Relator (+ ou -)" field="relator_favorabilidade" />
            <InputField label="Turma" field="turma_tst" />
            <InputField label="Turma (+ ou -)" field="turma_favorabilidade" />
            <InputField label="Parte Recorrente" field="parte_recorrente_tst" />
          </div>
        </div>

        {/* Recurso do Reclamante */}
        <div>
          <h4 className="text-sm font-semibold mb-3 text-foreground">Recurso do Reclamante</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Tipo de Recurso" field="tipo_recurso_reclamante" />
            <InputField label="Matérias" field="materias_recurso_reclamante" textarea />
            <InputField label="Aparelhamento" field="aparelhamento_reclamante" />
            <InputField label="Chance de Êxito" field="chance_exito_reclamante" />
          </div>
        </div>

        {/* Recurso do Banco */}
        <div>
          <h4 className="text-sm font-semibold mb-3 text-foreground">Recurso do Banco</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Tipo de Recurso" field="tipo_recurso_banco" />
            <InputField label="Matérias" field="materias_recurso_banco" textarea />
            <InputField label="Aparelhamento" field="aparelhamento_banco" />
            <InputField label="Chance de Êxito" field="chance_exito_banco" />
          </div>
        </div>

        {/* Análise e Status */}
        <div>
          <h4 className="text-sm font-semibold mb-3 text-foreground">Análise e Status</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="Honra" field="honra_tst" />
            <InputField label="Tema" field="tema_tst" />
            <InputField label="Execução" field="execucao_tst" />
            <InputField label="Mídia Negativa" field="midia_negativa_tst" />
            <InputField label="Decisão (Quarteirizado)" field="decisao_quarteirizado" textarea />
            <InputField label="Recurso de Terceiros" field="recurso_terceiros_tst" />
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-xs font-medium text-muted-foreground">Benner Atualizado?</Label>
              <Switch
                checked={form.benner_atualizado}
                onCheckedChange={v => handleChange("benner_atualizado", v)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
