import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Save, ArrowLeft, Loader2, Gavel, FolderInput, CheckCircle2, Users, ExternalLink } from "lucide-react";
import { PautaTst, PautaTstInsert } from "@/hooks/usePautasTst";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { carregarMembrosRenata, importarProcessoDaPauta } from "@/lib/pautasAcoes";

interface Props {
  dado?: PautaTst | null;
  onSave: (dado: PautaTstInsert, id?: string) => Promise<boolean>;
  onCancel: () => void;
  /** Salva um único campo (pautas existentes). Quando ausente, usa onSave completo. */
  onSaveField?: (id: string, campo: string, valor: any) => Promise<boolean>;
  subtitulo?: string;
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

type Campo = { k: keyof PautaTstInsert; l: string; area?: boolean; type?: string; span?: string };

const SECOES: { titulo: string; campos: Campo[] }[] = [
  { titulo: "Processo", campos: [
    { k: "processo_numero", l: "Nº do processo" }, { k: "dossie", l: "Dossiê" }, { k: "equipe", l: "Equipe" },
    { k: "advogado_interno", l: "Advogado interno" }, { k: "reclamante", l: "Reclamante" }, { k: "reclamada", l: "Reclamada" },
    { k: "parte_recorrente", l: "Parte recorrente" }, { k: "tipo_recurso", l: "Tipo de recurso" },
  ]},
  { titulo: "Julgamento", campos: [
    { k: "data_julgamento", l: "Data do julgamento", type: "date" }, { k: "horario", l: "Horário" },
    { k: "modalidade", l: "Modalidade" }, { k: "orgao", l: "Órgão" }, { k: "relator", l: "Relator", span: "md:col-span-2" },
    { k: "link_acesso", l: "Link de acesso", span: "md:col-span-2" },
  ]},
  { titulo: "Recurso do reclamante", campos: [
    { k: "materia_recurso_reclamante", l: "Matéria", area: true, span: "md:col-span-2" },
    { k: "aparelhamento_reclamante", l: "Aparelhamento" }, { k: "chance_exito_reclamante", l: "Chance de êxito" },
  ]},
  { titulo: "Recurso do banco", campos: [
    { k: "materia_recurso_banco", l: "Matéria", area: true, span: "md:col-span-2" },
    { k: "aparelhamento_banco", l: "Aparelhamento" }, { k: "chance_exito_banco", l: "Chance de êxito" },
  ]},
  { titulo: "Análise e decisão", campos: [
    { k: "honra", l: "Honra" }, { k: "decisao", l: "Decisão" }, { k: "sustentacao_oral", l: "Sustentação oral" },
    { k: "desistencia_recurso", l: "Desistência do recurso" }, { k: "midia_negativa", l: "Mídia negativa" },
    { k: "entrega_memoriais", l: "Entrega de memoriais" },
  ]},
  { titulo: "Providências e retorno", campos: [
    { k: "solicitacao_providencias_banco", l: "Solicitação de providências ao banco", area: true, span: "md:col-span-2" },
    { k: "solicitacao_rosa_oliveira", l: "Solicitação – Rosa Oliveira", area: true, span: "md:col-span-2" },
    { k: "comentarios_advogado", l: "Comentários do advogado interno", area: true, span: "md:col-span-2" },
    { k: "retorno_esclarecimentos", l: "Retorno / esclarecimentos", area: true, span: "md:col-span-2" },
    { k: "resultado_proxima_sessao", l: "Resultado / próxima sessão", area: true, span: "md:col-span-4" },
  ]},
];

export function PautasTstForm({ dado, onSave, onCancel, onSaveField, subtitulo }: Props) {
  const [form, setForm] = useState<PautaTstInsert>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [membros, setMembros] = useState<{ id: string; nome: string }[]>([]);
  const [resp, setResp] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);
  const existente = !!dado?.id;

  useEffect(() => {
    if (dado) {
      const { id, created_at, updated_at, processo_digits, ...rest } = dado as any;
      setForm({ ...emptyForm, ...rest });
    } else setForm(emptyForm);
  }, [dado]);

  useEffect(() => {
    carregarMembrosRenata().then(setMembros);
    if (dado?.id) {
      supabase.from("pautas_tst_responsaveis" as any).select("user_id").eq("pauta_id", dado.id)
        .then(({ data }) => setResp(((data as any[]) || []).map((r) => r.user_id)));
    }
  }, [dado?.id]);

  const set = (field: keyof PautaTstInsert, value: any) => setForm((prev) => ({ ...prev, [field]: value || null }));

  const salvarCampo = async (k: keyof PautaTstInsert) => {
    if (!existente || !dado) return;
    const atual = (form as any)[k] ?? null;
    if ((dado as any)[k] === atual) return;
    if (onSaveField) await onSaveField(dado.id, k as string, atual);
    else await onSave({ ...form }, dado.id);
    (dado as any)[k] = atual;
  };

  const preencherDaDistribuicao = async () => {
    const d = String(form.processo_numero || "").replace(/\D/g, "");
    if (d.length !== 20) return;
    const fmt = `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16)}`;
    const { data } = await supabase.from("dados_benner" as any).select("*").eq("processo", fmt).not("aba_origem", "is", null).limit(1);
    const b: any = (data as any[])?.[0];
    if (!b) return;
    const map: [keyof PautaTstInsert, any][] = [
      ["dossie", b.dossie], ["equipe", b.equipe], ["reclamante", b.reclamante], ["reclamada", b.reclamada],
      ["parte_recorrente", b.recorrente], ["tipo_recurso", b.tipo_recurso], ["relator", b.relator], ["orgao", b.turma],
      ["materia_recurso_reclamante", b.materias_recurso_reclamante], ["aparelhamento_reclamante", b.aparelhamento_reclamante],
      ["chance_exito_reclamante", b.chance_exito_reclamante], ["materia_recurso_banco", b.materias_recurso_banco],
      ["aparelhamento_banco", b.aparelhamento_banco], ["chance_exito_banco", b.chance_exito_banco], ["honra", b.honra],
      ["midia_negativa", b.midia_negativa],
    ];
    setForm((prev) => map.reduce((acc: any, [k, v]) => (acc[k] ? acc : { ...acc, [k]: v ?? null }), { ...prev, dados_benner_id: b.id } as any));
    toast.success("Campos em branco preenchidos com a Distribuição TST");
  };

  const toggleResp = async (uid: string) => {
    if (!dado?.id) return;
    if (resp.includes(uid)) {
      const { error } = await supabase.from("pautas_tst_responsaveis" as any).delete().eq("pauta_id", dado.id).eq("user_id", uid);
      if (error) return toast.error(error.message);
      setResp(resp.filter((x) => x !== uid));
    } else {
      const { error } = await supabase.from("pautas_tst_responsaveis" as any).insert({ pauta_id: dado.id, user_id: uid });
      if (error) return toast.error(error.message);
      setResp([...resp, uid]);
    }
  };

  const importar = async () => {
    if (!dado) return;
    setImportando(true);
    try {
      const r = await importarProcessoDaPauta(dado);
      (dado as any).processo_id = r.processoId;
      setForm((p) => ({ ...p, processo_id: r.processoId }));
      toast.success(r.novo ? (r.judit ? "Processo cadastrado e preenchido com a Judit" : "Processo cadastrado (Judit não respondeu)") : "Pauta ligada à ficha já existente");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImportando(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(form, dado?.id);
    setSaving(false);
    if (ok) onCancel();
  };

  const aAvaliar = (form as any).status_avaliacao === "a_avaliar";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <Button variant="outline" size="sm" onClick={onCancel}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
        <Gavel className="w-5 h-5 text-primary" />
        <div className="min-w-0">
          <div className="font-semibold text-foreground font-mono">{form.processo_numero || (existente ? "Pauta" : "Nova pauta")}</div>
          {subtitulo && <div className="text-xs text-muted-foreground">{subtitulo}</div>}
        </div>
        {existente && (
          <Badge variant={aAvaliar ? "destructive" : "secondary"}>{aAvaliar ? "A avaliar" : "Avaliada"}</Badge>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {existente && (
            <Button variant="outline" size="sm" onClick={async () => {
              const v = aAvaliar ? "avaliada" : "a_avaliar";
              setForm((p: any) => ({ ...p, status_avaliacao: v }));
              if (onSaveField && dado) await onSaveField(dado.id, "status_avaliacao", v);
            }}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> {aAvaliar ? "Marcar como avaliada" : "Voltar para a avaliar"}
            </Button>
          )}
          {existente && (form.processo_id ? (
            <Button variant="outline" size="sm" asChild>
              <a href={`/processos/${form.processo_id}`} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1" /> Abrir ficha</a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={importar} disabled={importando}>
              {importando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FolderInput className="w-4 h-4 mr-1" />} Importar processo
            </Button>
          ))}
        </div>
      </div>

      {existente && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Responsáveis</h3>
          <div className="flex flex-wrap items-center gap-2">
            {resp.map((id) => (
              <Badge key={id} variant="secondary">{membros.find((m) => m.id === id)?.nome || "…"}</Badge>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><Users className="w-4 h-4 mr-1" /> Selecionar responsáveis…</Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 max-h-80 overflow-auto p-2">
                {membros.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={resp.includes(m.id)} onCheckedChange={() => toggleResp(m.id)} /> {m.nome}
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {SECOES.map((s) => (
        <div key={s.titulo} className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{s.titulo}</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {s.campos.map((c) => (
              <div key={c.k as string} className={c.span}>
                <Label className="text-xs uppercase text-muted-foreground">{c.l}</Label>
                {c.area ? (
                  <Textarea rows={2} value={(form as any)[c.k] || ""} onChange={(e) => set(c.k, e.target.value)} onBlur={() => salvarCampo(c.k)} />
                ) : (
                  <Input
                    type={c.type || "text"}
                    value={(form as any)[c.k] || ""}
                    onChange={(e) => set(c.k, e.target.value)}
                    onBlur={() => { if (c.k === "processo_numero") preencherDaDistribuicao(); salvarCampo(c.k); }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {!existente && (
        <div className="sticky bottom-0 py-3 bg-background/95 backdrop-blur border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Criar pauta
          </Button>
        </div>
      )}
    </div>
  );
}
