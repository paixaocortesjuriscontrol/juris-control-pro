import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save, ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { DistribuicaoTst, DistribuicaoTstInsert } from "@/hooks/useDistribuicoesTst";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Props {
  dado?: DistribuicaoTst | null;
  onSave: (dado: DistribuicaoTstInsert, id?: string) => Promise<boolean>;
  onCancel: () => void;
}

const emptyForm: DistribuicaoTstInsert = {
  processo_id: "",
  processo_numero: "",
  aba_origem: null,
  data_distribuicao_planilha: null,
  data_distribuicao_real: null,
  coordenacao_id: null,
  responsaveis_ids: [],
  dossie: null,
  equipe: null,
  reclamante: null,
  reclamada: null,
  relator: null,
  relator_favorabilidade: null,
  turma: null,
  turma_favorabilidade: null,
  parte_recorrente: null,
  tipo_recurso_reclamante: null,
  materias_recurso_reclamante: null,
  aparelhamento_reclamante: null,
  chance_exito_reclamante: null,
  tipo_recurso_banco: null,
  materias_recurso_banco: null,
  aparelhamento_banco: null,
  chance_exito_banco: null,
  honra: null,
  tema: null,
  execucao: null,
  midia_negativa: null,
  decisao_quarteirizado: null,
  recurso_terceiros: null,
  transito_julgado: false,
  benner_atualizado: false,
  judit_preenchido: false,
  judit_preenchido_em: null,
  judit_preenchido_por: null,
};

export function DistribuicaoTstForm({ dado, onSave, onCancel }: Props) {
  const [form, setForm] = useState<DistribuicaoTstInsert>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [dadoBennerId, setDadoBennerId] = useState<string | null>(null);

  useEffect(() => {
    if (dado) {
      const { id, created_at, updated_at, ...rest } = dado;
      setForm(rest as DistribuicaoTstInsert);
      // Check if linked dados_benner exists
      checkDadosBennerLink(dado.dossie, dado.processo_numero);
    }
  }, [dado]);

  const checkDadosBennerLink = async (dossie: string | null, processo: string) => {
    if (!dossie && !processo) return;
    const { data } = await supabase
      .from("dados_benner" as any)
      .select("id")
      .or(`dossie.eq.${dossie || ""},contrato.eq.${processo}`)
      .limit(1);
    if (data && (data as any[]).length > 0) {
      setDadoBennerId((data as any[])[0].id);
    }
  };

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.processo_numero?.trim()) {
      toast.warning("Informe o número do processo");
      return;
    }
    setSaving(true);

    // Ensure processo exists
    if (!form.processo_id) {
      const { data: proc } = await supabase
        .from("processos")
        .select("id")
        .eq("numero", form.processo_numero.trim())
        .maybeSingle();
      if (proc) {
        form.processo_id = proc.id;
      } else {
        const { data: newProc, error } = await supabase
          .from("processos")
          .insert({ numero: form.processo_numero.trim(), status: "ativo", area: "trabalhista" })
          .select("id")
          .single();
        if (error) {
          toast.error("Erro ao criar processo: " + error.message);
          setSaving(false);
          return;
        }
        form.processo_id = newProc.id;
      }
    }

    const ok = await onSave(form, dado?.id);
    setSaving(false);
    if (ok) onCancel();
  };

  const SectionHeader = ({ title, color }: { title: string; color: string }) => (
    <div className={cn("px-4 py-2 rounded-t-lg font-semibold text-sm text-white", color)}>
      {title}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="w-5 h-5" /></Button>
          <h2 className="text-xl font-bold text-foreground">{dado ? "Editar Distribuição" : "Nova Distribuição"}</h2>
        </div>
      </div>

      {/* SEÇÃO 1 - Rosa (#782170): Dados Básicos */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Dados Básicos (A-F)" color="bg-[#782170]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data da Distribuição (A)</Label>
              <Input type="date" value={form.data_distribuicao || ""} onChange={e => set("data_distribuicao", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Número do Processo (B)</Label>
              <Input value={form.processo_numero || ""} onChange={e => set("processo_numero", e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
            </div>
            <div className="space-y-2">
              <Label>Dossiê (C)</Label>
              <Input value={form.dossie || ""} onChange={e => set("dossie", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Equipe (D)</Label>
              <Input value={form.equipe || ""} onChange={e => set("equipe", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reclamante (E)</Label>
              <Input value={form.reclamante || ""} onChange={e => set("reclamante", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reclamada (F)</Label>
              <Input value={form.reclamada || ""} onChange={e => set("reclamada", e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2 - Azul (#6D9EEB): Relator e Turma */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Relator e Turma (G-K)" color="bg-[#6D9EEB]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Relator (G)</Label>
              <Input value={form.relator || ""} onChange={e => set("relator", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Relator (+ ou -) (H)</Label>
              <Select value={form.relator_favorabilidade || ""} onValueChange={v => set("relator_favorabilidade", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POSITIVO">POSITIVO</SelectItem>
                  <SelectItem value="NEGATIVO">NEGATIVO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Turma (I)</Label>
              <Input value={form.turma || ""} onChange={e => set("turma", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Turma (+ ou -) (J)</Label>
              <Select value={form.turma_favorabilidade || ""} onValueChange={v => set("turma_favorabilidade", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POSITIVA">POSITIVA</SelectItem>
                  <SelectItem value="NEGATIVA">NEGATIVA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parte Recorrente (K)</Label>
              <Input value={form.parte_recorrente || ""} onChange={e => set("parte_recorrente", e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3 - Pêssego (#F9CB9C): Recurso Reclamante */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso Reclamante (L-O)" color="bg-[#F9CB9C] !text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Recurso do Reclamante (L)</Label>
              <Input value={form.tipo_recurso_reclamante || ""} onChange={e => set("tipo_recurso_reclamante", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Aparelhamento (N)</Label>
              <Select value={form.aparelhamento_reclamante || ""} onValueChange={v => set("aparelhamento_reclamante", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEM APARELHADO">BEM APARELHADO</SelectItem>
                  <SelectItem value="MAL APARELHADO">MAL APARELHADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Matérias Recurso Reclamante (M)</Label>
            <Textarea value={form.materias_recurso_reclamante || ""} onChange={e => set("materias_recurso_reclamante", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Chance de Êxito (O)</Label>
            <Select value={form.chance_exito_reclamante || ""} onValueChange={v => set("chance_exito_reclamante", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PROVÁVEL">PROVÁVEL</SelectItem>
                <SelectItem value="POSSÍVEL">POSSÍVEL</SelectItem>
                <SelectItem value="REMOTA">REMOTA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* SEÇÃO 4 - Verde (#B6D7A8): Recurso Banco */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso Banco (P-S)" color="bg-[#B6D7A8] !text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Recurso do Banco (P)</Label>
              <Input value={form.tipo_recurso_banco || ""} onChange={e => set("tipo_recurso_banco", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Aparelhamento (R)</Label>
              <Select value={form.aparelhamento_banco || ""} onValueChange={v => set("aparelhamento_banco", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEM APARELHADO">BEM APARELHADO</SelectItem>
                  <SelectItem value="MAL APARELHADO">MAL APARELHADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Matérias Recurso do Banco (Q)</Label>
            <Textarea value={form.materias_recurso_banco || ""} onChange={e => set("materias_recurso_banco", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Chance de Êxito (S)</Label>
            <Select value={form.chance_exito_banco || ""} onValueChange={v => set("chance_exito_banco", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PROVÁVEL">PROVÁVEL</SelectItem>
                <SelectItem value="POSSÍVEL">POSSÍVEL</SelectItem>
                <SelectItem value="REMOTA">REMOTA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* SEÇÃO 5 - Azul Escuro (#1D69C8): Análise */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Análise (T-Y)" color="bg-[#1D69C8]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Honra (T)</Label>
              <Select value={form.honra || ""} onValueChange={v => set("honra", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tema (U)</Label>
              <Input value={form.tema || ""} onChange={e => set("tema", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Execução (V)</Label>
              <Select value={form.execucao || ""} onValueChange={v => set("execucao", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mídia Negativa (W)</Label>
              <Select value={form.midia_negativa || ""} onValueChange={v => set("midia_negativa", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recurso de Terceiros (Y)</Label>
              <Select value={form.recurso_terceiros || ""} onValueChange={v => set("recurso_terceiros", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Decisão - Análise do Quarteirizado (X)</Label>
            <Input value={form.decisao_quarteirizado || ""} onChange={e => set("decisao_quarteirizado", e.target.value)} />
          </div>
        </div>
      </div>

      {/* SEÇÃO 6 - Lilás (#B4A7D6): Trânsito em Julgado */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Trânsito em Julgado (Z)" color="bg-[#B4A7D6] !text-black" />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Switch checked={!!form.transito_julgado} onCheckedChange={v => set("transito_julgado", v)} />
            <Label>Trânsito em Julgado</Label>
          </div>
        </div>
      </div>

      {/* SEÇÃO 7 - Vermelho (#FF0000): Benner Atualizado */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Benner Atualizado (AA)" color="bg-[#FF0000]" />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Switch checked={!!form.benner_atualizado} onCheckedChange={v => set("benner_atualizado", v)} />
            <Label>Benner Atualizado</Label>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
