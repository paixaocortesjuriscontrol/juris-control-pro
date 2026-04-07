import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, ArrowLeft, Loader2 } from "lucide-react";
import { PautaTst, PautaTstInsert } from "@/hooks/usePautasTst";
import { cn } from "@/lib/utils";

interface Props {
  dado?: PautaTst | null;
  onSave: (dado: PautaTstInsert, id?: string) => Promise<boolean>;
  onCancel: () => void;
}

const emptyForm: PautaTstInsert = {
  processo_id: null, processo_numero: null, aba_origem: null,
  equipe: null, advogado_interno: null, dossie: null,
  reclamante: null, reclamada: null, parte_recorrente: null,
  tipo_recurso: null, data_julgamento: null, horario: null,
  modalidade: null, link_acesso: null, orgao: null, relator: null,
  materia_recurso_reclamante: null, aparelhamento_reclamante: null,
  chance_exito_reclamante: null, materia_recurso_banco: null,
  aparelhamento_banco: null, chance_exito_banco: null,
  honra: null, decisao: null, sustentacao_oral: null,
  desistencia_recurso: null, midia_negativa: null,
  entrega_memoriais: null, solicitacao_providencias_banco: null,
  solicitacao_rosa_oliveira: null, comentarios_advogado: null,
  retorno_esclarecimentos: null, resultado_proxima_sessao: null,
};

const sectionStyle = (color: string) => cn("space-y-4 p-4 rounded-lg border-l-4", color);

export function PautasTstForm({ dado, onSave, onCancel }: Props) {
  const [form, setForm] = useState<PautaTstInsert>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dado) {
      const { id, created_at, updated_at, ...rest } = dado;
      setForm(rest);
    }
  }, [dado]);

  const set = (field: keyof PautaTstInsert, value: any) => setForm(prev => ({ ...prev, [field]: value || null }));

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(form, dado?.id);
    setSaving(false);
    if (ok) onCancel();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
        <h2 className="text-xl font-bold text-foreground">{dado ? "Editar Pauta" : "Nova Pauta"}</h2>
      </div>

      {/* Dados Básicos - Rosa */}
      <div className={sectionStyle("border-l-pink-600 bg-pink-50/30")}>
        <h3 className="font-semibold text-pink-700">Dados Básicos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Equipe</Label><Input value={form.equipe || ""} onChange={e => set("equipe", e.target.value)} /></div>
          <div><Label>Advogado Interno</Label><Input value={form.advogado_interno || ""} onChange={e => set("advogado_interno", e.target.value)} /></div>
          <div><Label>Dossiê</Label><Input value={form.dossie || ""} onChange={e => set("dossie", e.target.value)} /></div>
          <div><Label>Nº Processo</Label><Input value={form.processo_numero || ""} onChange={e => set("processo_numero", e.target.value)} /></div>
          <div><Label>Reclamante</Label><Input value={form.reclamante || ""} onChange={e => set("reclamante", e.target.value)} /></div>
          <div><Label>Reclamada</Label><Input value={form.reclamada || ""} onChange={e => set("reclamada", e.target.value)} /></div>
          <div><Label>Parte Recorrente</Label><Input value={form.parte_recorrente || ""} onChange={e => set("parte_recorrente", e.target.value)} /></div>
          <div><Label>Tipo de Recurso</Label><Input value={form.tipo_recurso || ""} onChange={e => set("tipo_recurso", e.target.value)} /></div>
        </div>
      </div>

      {/* Julgamento - Azul */}
      <div className={sectionStyle("border-l-blue-500 bg-blue-50/30")}>
        <h3 className="font-semibold text-blue-700">Julgamento</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Data do Julgamento</Label><Input type="date" value={form.data_julgamento || ""} onChange={e => set("data_julgamento", e.target.value)} /></div>
          <div><Label>Horário</Label><Input value={form.horario || ""} onChange={e => set("horario", e.target.value)} /></div>
          <div><Label>Modalidade</Label><Input value={form.modalidade || ""} onChange={e => set("modalidade", e.target.value)} placeholder="Virtual / Telepresencial / Híbrido" /></div>
          <div><Label>Link de Acesso</Label><Input value={form.link_acesso || ""} onChange={e => set("link_acesso", e.target.value)} /></div>
          <div><Label>Órgão</Label><Input value={form.orgao || ""} onChange={e => set("orgao", e.target.value)} /></div>
          <div><Label>Relator</Label><Input value={form.relator || ""} onChange={e => set("relator", e.target.value)} /></div>
        </div>
      </div>

      {/* Recurso Reclamante - Laranja */}
      <div className={sectionStyle("border-l-orange-400 bg-orange-50/30")}>
        <h3 className="font-semibold text-orange-700">Recurso do Reclamante</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3"><Label>Matéria</Label><Textarea value={form.materia_recurso_reclamante || ""} onChange={e => set("materia_recurso_reclamante", e.target.value)} rows={2} /></div>
          <div><Label>Aparelhamento</Label><Input value={form.aparelhamento_reclamante || ""} onChange={e => set("aparelhamento_reclamante", e.target.value)} /></div>
          <div><Label>Chance de Êxito</Label><Input value={form.chance_exito_reclamante || ""} onChange={e => set("chance_exito_reclamante", e.target.value)} /></div>
        </div>
      </div>

      {/* Recurso Banco - Verde */}
      <div className={sectionStyle("border-l-green-500 bg-green-50/30")}>
        <h3 className="font-semibold text-green-700">Recurso do Banco</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3"><Label>Matéria</Label><Textarea value={form.materia_recurso_banco || ""} onChange={e => set("materia_recurso_banco", e.target.value)} rows={2} /></div>
          <div><Label>Aparelhamento</Label><Input value={form.aparelhamento_banco || ""} onChange={e => set("aparelhamento_banco", e.target.value)} /></div>
          <div><Label>Chance de Êxito</Label><Input value={form.chance_exito_banco || ""} onChange={e => set("chance_exito_banco", e.target.value)} /></div>
        </div>
      </div>

      {/* Análise / Decisão - Azul Escuro */}
      <div className={sectionStyle("border-l-indigo-600 bg-indigo-50/30")}>
        <h3 className="font-semibold text-indigo-700">Análise e Decisão</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Honra</Label><Input value={form.honra || ""} onChange={e => set("honra", e.target.value)} /></div>
          <div><Label>Decisão</Label><Input value={form.decisao || ""} onChange={e => set("decisao", e.target.value)} /></div>
          <div><Label>Sustentação Oral</Label><Input value={form.sustentacao_oral || ""} onChange={e => set("sustentacao_oral", e.target.value)} /></div>
          <div><Label>Desistência do Recurso</Label><Input value={form.desistencia_recurso || ""} onChange={e => set("desistencia_recurso", e.target.value)} /></div>
          <div><Label>Mídia Negativa</Label><Input value={form.midia_negativa || ""} onChange={e => set("midia_negativa", e.target.value)} /></div>
          <div><Label>Entrega de Memoriais</Label><Input value={form.entrega_memoriais || ""} onChange={e => set("entrega_memoriais", e.target.value)} /></div>
        </div>
      </div>

      {/* Solicitações - Lilás */}
      <div className={sectionStyle("border-l-purple-400 bg-purple-50/30")}>
        <h3 className="font-semibold text-purple-700">Solicitações e Comentários</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Solicitação Providências Banco</Label><Textarea value={form.solicitacao_providencias_banco || ""} onChange={e => set("solicitacao_providencias_banco", e.target.value)} rows={2} /></div>
          <div><Label>Solicitação - Rosa Oliveira</Label><Textarea value={form.solicitacao_rosa_oliveira || ""} onChange={e => set("solicitacao_rosa_oliveira", e.target.value)} rows={2} /></div>
          <div><Label>Comentários Advogado Interno</Label><Textarea value={form.comentarios_advogado || ""} onChange={e => set("comentarios_advogado", e.target.value)} rows={2} /></div>
          <div><Label>Retorno / Esclarecimentos</Label><Textarea value={form.retorno_esclarecimentos || ""} onChange={e => set("retorno_esclarecimentos", e.target.value)} rows={2} /></div>
        </div>
      </div>

      {/* Resultado - Vermelho */}
      <div className={sectionStyle("border-l-red-500 bg-red-50/30")}>
        <h3 className="font-semibold text-red-700">Resultado</h3>
        <div><Label>Resultado / Próxima Sessão</Label><Textarea value={form.resultado_proxima_sessao || ""} onChange={e => set("resultado_proxima_sessao", e.target.value)} rows={3} /></div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
