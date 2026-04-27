import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save, ArrowLeft, Loader2, Search } from "lucide-react";
import { DistribuicaoTst, DistribuicaoTstInsert } from "@/hooks/useDistribuicoesTst";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ResponsaveisSelector } from "@/components/distribuicao-tst/ResponsaveisSelector";
import { MateriasMultiSelect } from "@/components/distribuicao-tst/MateriasMultiSelect";
import { Badge } from "@/components/ui/badge";

interface Props {
  dado?: DistribuicaoTst | null;
  onSave: (dado: DistribuicaoTstInsert, id?: string) => Promise<boolean>;
  onCancel: () => void;
  /**
   * Callback chamado após o botão Judit preencher e auto-salvar com sucesso.
   * Usado pelo container (DistribuicaoTstDetail) para recarregar a aba paralela
   * "Dados Benner" — assim os dados aparecem sincronizados sem precisar
   * clicar em Salvar manualmente.
   */
  onJuditSync?: () => void;
}

const RENATA_COORDENACAO_ID = "3e47fc83-3539-4fa7-9fcf-33825120e1b7";

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
  observacao_advogado: null,
};

export function DistribuicaoTstForm({ dado, onSave, onCancel, onJuditSync }: Props) {
  const [form, setForm] = useState<DistribuicaoTstInsert>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [buscandoJudit, setBuscandoJudit] = useState(false);
  // Marca dinamicamente, durante a sessão, os campos preenchidos por esta busca Judit.
  const [juditSessionFields, setJuditSessionFields] = useState<Set<string>>(new Set());

  // Destaque verde "Judit" quando o registro foi preenchido pela Judit e o campo tem valor.
  const isJuditFilled = (value: any) =>
    (!!dado?.judit_preenchido || juditSessionFields.size > 0) && !!(value && String(value).trim());
  const juditClass = (value: any) =>
    isJuditFilled(value)
      ? "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 rounded-md transition-all"
      : "";
  const JuditBadge = ({ show }: { show: boolean }) =>
    show ? (
      <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 h-4 font-normal border-emerald-500 text-emerald-600 dark:text-emerald-400">
        Judit
      </Badge>
    ) : null;

  useEffect(() => {
    const loadResponsaveis = async (id: string) => {
      const { data } = await supabase
        .from("dados_benner_responsaveis" as any)
        .select("usuario_id")
        .eq("dados_benner_id", id);
      const ids = ((data as any[]) || []).map(r => r.usuario_id);
      setForm(f => ({ ...f, responsaveis_ids: ids }));
    };

    if (dado) {
      const { id, created_at, updated_at, ...rest } = dado;
      setForm({ ...emptyForm, ...rest, responsaveis_ids: [] } as DistribuicaoTstInsert);
      loadResponsaveis(dado.id);
    } else {
      setForm({ ...emptyForm });
    }
  }, [dado]);

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const handleBuscarJudit = async () => {
    const numero = (form.processo_numero || "").trim();
    if (!numero) {
      toast.warning("Informe o número do processo antes de buscar na Judit");
      return;
    }
    setBuscandoJudit(true);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-judit", {
        body: { numero_processo: numero, tribunal: "TST" },
      });
      if (error) {
        toast.error("Erro ao buscar na Judit: " + (error.message || "desconhecido"));
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Extrai reclamante / reclamada das partes (polo ativo / passivo, sem advogados).
      const partes = Array.isArray(data?.parties_detail) ? data.parties_detail : [];
      const nomesPorPolo = (poloUpper: string) =>
        [...new Set(
          partes
            .filter((p: any) => (p?.polo || "").toString().toUpperCase() === poloUpper && !p?.is_advogado)
            .map((p: any) => String(p?.nome || "").trim())
            .filter(Boolean)
        )].join(" / ");
      const reclamanteJudit = nomesPorPolo("ACTIVE");
      const reclamadaJudit = nomesPorPolo("PASSIVE");

      const filled = new Set<string>(juditSessionFields);
      const hasValue = (value: any) => value !== null && value !== undefined && String(value).trim() !== "";
      const nextForm: DistribuicaoTstInsert = (() => {
        const next: any = { ...form };
        const apply = (field: string, novo: any) => {
          if (hasValue(novo) && next[field] !== novo) {
            next[field] = novo;
            filled.add(field);
          }
        };
        apply("dossie", data.dossie);
        apply("data_distribuicao_real", data.data_distribuicao);
        apply("data_distribuicao_planilha", data.data_distribuicao);
        apply("relator", data.relator);
        apply("turma", data.turma);
        apply("reclamante", reclamanteJudit);
        apply("reclamada", reclamadaJudit);
        apply("parte_recorrente", data.recorrente);
        apply("tipo_recurso_reclamante", data.tipo_recurso_reclamante);
        apply("tipo_recurso_banco", data.tipo_recurso_banco);
        // Campo combinado vai direto para a coluna `tipo_recurso` em dados_benner
        // (passado adiante via distribuicaoToBenner — chave extra no payload).
        apply("tipo_recurso", data.tipo_recurso);
        // Situação do processo / trânsito em julgado
        const situacao = (data.situacao_processo || "").toString();
        if (situacao) apply("situacao_processo", situacao);
        const baixado = (data.processo_baixado || "").toString().toUpperCase();
        const ehTransito = /tr[âa]nsito/i.test(situacao) || baixado === "S";
        if (ehTransito && next.transito_julgado !== true) {
          next.transito_julgado = true;
          filled.add("transito_julgado");
        }
        return next;
      })();

      setForm(nextForm);

      setJuditSessionFields(filled);

      const preenchidos = filled.size;
      if (preenchidos > 0) {
        toast.success(`Judit preencheu ${preenchidos} campo(s). Salvando automaticamente...`);
        // Auto-salva no banco e dispara recarga da aba Dados Benner.
        // Lê o estado mais recente do form via setForm callback.
        setForm(currentForm => {
          void (async () => {
            try {
              const payload: DistribuicaoTstInsert = {
                ...currentForm,
                judit_preenchido: true,
                judit_preenchido_em: new Date().toISOString(),
              };
              // Garante processo_id antes de salvar (mesma lógica de handleSave).
              if (!payload.processo_id && payload.processo_numero?.trim()) {
                const { data: proc } = await supabase
                  .from("processos")
                  .select("id")
                  .eq("numero", payload.processo_numero.trim())
                  .maybeSingle();
                if (proc) payload.processo_id = proc.id;
              }
              if (payload.processo_id) {
                const ok = await onSave(payload, dado?.id);
                if (ok) {
                  toast.success("Distribuição TST e Dados Benner sincronizados com Judit");
                  onJuditSync?.();
                }
              }
            } catch (e: any) {
              console.error("Auto-save Judit falhou:", e);
            }
          })();
          return currentForm;
        });
      } else {
        toast.info("Judit retornou dados, mas todos os campos já estavam preenchidos.");
      }
    } catch (e: any) {
      toast.error("Falha ao buscar na Judit: " + (e?.message || "erro desconhecido"));
    } finally {
      setBuscandoJudit(false);
    }
  };

  const handleSave = async () => {
    if (!form.processo_numero?.trim()) {
      toast.warning("Informe o número do processo");
      return;
    }
    setSaving(true);

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

    // Se a sessão Judit preencheu campos, marca o registro como preenchido pela Judit.
    const payload: DistribuicaoTstInsert = juditSessionFields.size > 0
      ? {
          ...form,
          judit_preenchido: true,
          judit_preenchido_em: new Date().toISOString(),
        }
      : form;
    const ok = await onSave(payload, dado?.id);
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleBuscarJudit}
            disabled={buscandoJudit || !form.processo_numero?.trim()}
            className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            {buscandoJudit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Judit
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* SEÇÃO 1 - Rosa: Dados Básicos */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Dados Básicos" color="bg-[#782170]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data Distribuição Planilha</Label>
              <Input type="date" value={form.data_distribuicao_planilha || ""} onChange={e => set("data_distribuicao_planilha", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Data Distribuição Real</Label>
              <Input type="date" value={form.data_distribuicao_real || ""} onChange={e => set("data_distribuicao_real", e.target.value || null)} />
              <p className="text-[10px] text-muted-foreground">Preenchida via Judit ou manualmente</p>
            </div>
            <div className="space-y-2">
              <Label>Número do Processo</Label>
              <Input value={form.processo_numero || ""} onChange={e => set("processo_numero", e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Dossiê</Label>
              <Input value={form.dossie || ""} onChange={e => set("dossie", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Equipe</Label>
              <Input value={form.equipe || ""} onChange={e => set("equipe", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reclamante</Label>
              <Input value={form.reclamante || ""} onChange={e => set("reclamante", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reclamada</Label>
            <Input value={form.reclamada || ""} onChange={e => set("reclamada", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Responsáveis</Label>
            <ResponsaveisSelector
              selectedIds={form.responsaveis_ids || []}
              onChange={(ids) => set("responsaveis_ids", ids)}
              placeholder="Selecionar um ou mais responsáveis..."
              coordenacaoId="3e47fc83-3539-4fa7-9fcf-33825120e1b7"
            />
          </div>
          <div className="space-y-2">
            <Label>Observação Advogado</Label>
            <Textarea
              value={form.observacao_advogado || ""}
              onChange={e => set("observacao_advogado", e.target.value || null)}
              placeholder="Anotações livres do advogado responsável..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO 2 - Azul: Relator e Turma */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Relator e Turma" color="bg-[#6D9EEB]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Relator</Label>
              <Input value={form.relator || ""} onChange={e => set("relator", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Relator (+ ou -)</Label>
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
              <Label>Turma</Label>
              <Input value={form.turma || ""} onChange={e => set("turma", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Turma (+ ou -)</Label>
              <Select value={form.turma_favorabilidade || ""} onValueChange={v => set("turma_favorabilidade", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POSITIVA">POSITIVA</SelectItem>
                  <SelectItem value="NEGATIVA">NEGATIVA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parte Recorrente</Label>
              <Input value={form.parte_recorrente || ""} onChange={e => set("parte_recorrente", e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3 - Recurso Reclamante */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso Reclamante" color="bg-[#F9CB9C] !text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", juditClass(form.tipo_recurso_reclamante))}>
              <Label className="flex items-center">
                Tipo de Recurso do Reclamante
                <JuditBadge show={isJuditFilled(form.tipo_recurso_reclamante)} />
              </Label>
              <Input value={form.tipo_recurso_reclamante || ""} onChange={e => set("tipo_recurso_reclamante", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Aparelhamento</Label>
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
            <Label>Matérias Recurso Reclamante</Label>
            <MateriasMultiSelect
              value={form.materias_recurso_reclamante || null}
              onChange={(v) => set("materias_recurso_reclamante", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Chance de Êxito</Label>
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

      {/* SEÇÃO 4 - Recurso Banco */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso Banco" color="bg-[#B6D7A8] !text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", juditClass(form.tipo_recurso_banco))}>
              <Label className="flex items-center">
                Tipo de Recurso do Banco
                <JuditBadge show={isJuditFilled(form.tipo_recurso_banco)} />
              </Label>
              <Input value={form.tipo_recurso_banco || ""} onChange={e => set("tipo_recurso_banco", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Aparelhamento</Label>
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
            <Label>Matérias Recurso do Banco</Label>
            <Textarea value={form.materias_recurso_banco || ""} onChange={e => set("materias_recurso_banco", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Chance de Êxito</Label>
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

      {/* SEÇÃO 5 - Análise */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Análise" color="bg-[#1D69C8]" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Honra</Label>
              <Select value={form.honra || ""} onValueChange={v => set("honra", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tema</Label>
              <Input value={form.tema || ""} onChange={e => set("tema", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Execução</Label>
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
              <Label>Mídia Negativa</Label>
              <Select value={form.midia_negativa || ""} onValueChange={v => set("midia_negativa", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIM">SIM</SelectItem>
                  <SelectItem value="NÃO">NÃO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recurso de Terceiros</Label>
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
            <Label>Decisão - Análise do Quarteirizado</Label>
            <Input value={form.decisao_quarteirizado || ""} onChange={e => set("decisao_quarteirizado", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Trânsito em Julgado */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Trânsito em Julgado" color="bg-[#B4A7D6] !text-black" />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Switch checked={!!form.transito_julgado} onCheckedChange={v => set("transito_julgado", v)} />
            <Label>Trânsito em Julgado</Label>
          </div>
        </div>
      </div>

      {/* Benner */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Benner Atualizado" color="bg-[#FF0000]" />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Switch checked={!!form.benner_atualizado} onCheckedChange={v => set("benner_atualizado", v)} />
            <Label>Benner Atualizado</Label>
          </div>
        </div>
      </div>

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
