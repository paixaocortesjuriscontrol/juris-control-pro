import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
// Checkbox removido — opção "Com anexos" agora vive no DistribuicaoTstDetail.
import { Save, ArrowLeft, Loader2 } from "lucide-react";
import { DistribuicaoTst, DistribuicaoTstInsert } from "@/hooks/useDistribuicoesTst";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ResponsaveisSelector } from "@/components/distribuicao-tst/ResponsaveisSelector";
import { MateriasMultiSelect } from "@/components/distribuicao-tst/MateriasMultiSelect";
import { MultiTipoRecurso } from "@/components/distribuicao-tst/MultiTipoRecurso";
import { Badge } from "@/components/ui/badge";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import {
  useTurmasTst,
  useRelatoresTst,
  classificarTurmaDB,
  classificarRelatorDB,
} from "@/hooks/useClassificacaoTst";

interface Props {
  dado?: DistribuicaoTst | null;
  onSave: (dado: DistribuicaoTstInsert, id?: string) => Promise<boolean | string>;
  onCancel: () => void;
  onJuditSync?: (newId?: string) => void;
  /** Callback disparado quando a busca Judit retorna attachments (com anexos). */
  onAnexosFound?: (atts: any[]) => void;
}

export interface DistribuicaoTstFormHandle {
  runJudit: (comAnexos: boolean) => Promise<void>;
  isBuscando: () => boolean;
  save: () => Promise<void>;
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

export const DistribuicaoTstForm = forwardRef<DistribuicaoTstFormHandle, Props>(function DistribuicaoTstForm(
  { dado, onSave, onCancel, onJuditSync, onAnexosFound }: Props,
  ref
) {
  const [form, setForm] = useState<DistribuicaoTstInsert>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [buscandoJudit, setBuscandoJudit] = useState(false);
  const { data: turmasTst = [] } = useTurmasTst();
  const { data: relatoresTst = [] } = useRelatoresTst();
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

  const handleBuscarJudit = async (comAnexosArg = false) => {
    const numeroRaw = (form.processo_numero || "").trim();
    const numero = aplicarMascaraCnj(numeroRaw);
    if (!numero) {
      toast.warning("Informe o número do processo antes de buscar na Judit");
      return;
    }
    setBuscandoJudit(true);
    try {
      const requestPayload = { numero_processo: numero, tribunal: "TST", com_anexos: comAnexosArg };
      const { data, error } = await supabase.functions.invoke("buscar-judit", {
        body: requestPayload,
      });
      // Persiste log da consulta (sucesso, erro de função ou erro retornado).
      try {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("judit_logs" as any).insert({
          processo_numero: numero,
          tribunal: "TST",
          request_payload: { ...requestPayload, numero_processo_original: numeroRaw },
          raw_response: data ?? null,
          status: error ? "erro_funcao" : (data?.error ? "erro_api" : "sucesso"),
          error_message: error?.message || data?.error || null,
          created_by: userData?.user?.id || null,
        });
      } catch (logErr) {
        console.warn("Falha ao gravar judit_logs:", logErr);
      }
      if (error) {
        toast.error("Erro ao buscar na Judit: " + (error.message || "desconhecido"));
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (comAnexosArg) {
        const atts = Array.isArray((data as any)?.attachments) ? (data as any).attachments : [];
        onAnexosFound?.(atts);
        // Persiste no Supabase (judit_anexos) para sobreviver a reload/nova busca.
        if (atts.length > 0) {
          try {
            const { data: userData } = await supabase.auth.getUser();
            const rows = atts.map((a: any) => ({
              processo_numero: numero,
              cnj: a?.cnj || numero,
              instance: a?.instance != null ? String(a.instance) : null,
              attachment_id: String(a?.step_id || a?.attachment_id || ""),
              step_id: a?.step_id ? String(a.step_id) : null,
              attachment_name: a?.attachment_name || null,
              attachment_date: a?.attachment_date || null,
              extension: a?.extension || null,
              raw_attachment: a,
              created_by: userData?.user?.id || null,
            })).filter((r: any) => r.attachment_id);
            if (rows.length > 0) {
              await supabase
                .from("judit_anexos" as any)
                .upsert(rows, { onConflict: "processo_numero,instance,attachment_id" });
            }
          } catch (e) {
            console.warn("Falha ao persistir judit_anexos:", e);
          }
        }
        if (atts.length === 0) {
          toast.warning("Judit não retornou anexos para este processo.");
        } else {
          toast.success(`Judit retornou ${atts.length} anexo(s).`);
        }
      }

      // Extrai reclamante / reclamada das partes (polo ativo / passivo, sem advogados).
      // Usa `lado_efetivo` (derivado de person_type) quando disponível; cai para `polo`
      // apenas como fallback. Isso evita misturar banco/reclamante em recursos onde
      // ambos figuram como AGRAVANTE/RECORRENTE.
      const partes = Array.isArray(data?.parties_detail) ? data.parties_detail : [];
      const roleOriginal = (tipo: string) => /RECLAMANTE|RECLAMAD|AUTOR|AUTORA|R[ÉE]U|EXECUTAD|EXEQUENTE/i.test(tipo || "");
      const nomesPorPolo = (poloUpper: string) =>
        [...new Set(
          partes
            .filter((p: any) => {
              if (p?.is_advogado) return false;
              const efetivo = (p?.lado_efetivo || "").toString().toUpperCase();
              const lado = efetivo || (p?.polo || "").toString().toUpperCase();
              return lado === poloUpper;
            })
            .sort((a: any, b: any) => Number(roleOriginal(b?.tipo_pessoa)) - Number(roleOriginal(a?.tipo_pessoa)))
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
          // Política: a Judit é fonte da verdade — sempre sobrescreve
          // qualquer valor existente quando retorna algo para o campo.
          if (hasValue(novo)) {
            next[field] = novo;
            filled.add(field);
          }
        };
        apply("dossie", data.dossie);
        apply("data_distribuicao_real", data.data_distribuicao);
        apply("data_distribuicao_planilha", data.data_distribuicao);
        apply("relator", data.relator);
        apply("turma", data.turma);
        // Classificação automática (Turma / Relator) com base no cadastro TST
        const turmaVal = next.turma;
        if (turmaVal) {
          const c = classificarTurmaDB(String(turmaVal), turmasTst);
          if (c === "POSITIVO") { next.turma_favorabilidade = "POSITIVA"; filled.add("turma_favorabilidade"); }
          else if (c === "NEGATIVO") { next.turma_favorabilidade = "NEGATIVA"; filled.add("turma_favorabilidade"); }
        }
        const relatorVal = next.relator;
        if (relatorVal) {
          const r = classificarRelatorDB(String(relatorVal), relatoresTst);
          if (r?.classificacao === "POSITIVO") { next.relator_favorabilidade = "POSITIVO"; filled.add("relator_favorabilidade"); }
          else if (r?.classificacao === "NEGATIVO") { next.relator_favorabilidade = "NEGATIVO"; filled.add("relator_favorabilidade"); }
        }
        apply("reclamante", reclamanteJudit);
        apply("reclamada", reclamadaJudit);
        apply("parte_recorrente", data.recorrente);
        // Tipo de recurso: vem direto da CLASSE da capa (ex.: "Recurso de Revista").
        // Sem heurística por movimentos. Se a Judit não trouxer, não preenche
        // nem apaga — usuário escolhe manualmente.
        apply("tipo_recurso", data.tipo_recurso);
        // Situação do processo / trânsito em julgado
        const situacao = (data.situacao_processo || "").toString();
        if (situacao) apply("situacao_processo", situacao);
        const baixado = (data.processo_baixado || "").toString().toUpperCase();
        const ehTransito = /arquivad|baixad/i.test(situacao) || baixado === "S";
        if (ehTransito && next.transito_julgado !== true) {
          next.transito_julgado = true;
          filled.add("transito_julgado");
        }
        // Pauta de julgamento — não extraímos mais automaticamente.
        // (Os campos abaixo continuam editáveis manualmente no form.)
        return next;
      })();

      setForm(nextForm);

      setJuditSessionFields(filled);

      const preenchidos = filled.size;
      if (preenchidos > 0) {
        toast.success(`Judit preencheu ${preenchidos} campo(s). Salvando automaticamente...`);
        try {
          const payload: DistribuicaoTstInsert = {
            ...nextForm,
            judit_preenchido: true,
            judit_preenchido_em: new Date().toISOString(),
          };
          if (!payload.processo_id && payload.processo_numero?.trim()) {
            const { data: proc } = await supabase
              .from("processos")
              .select("id")
              .eq("numero", payload.processo_numero.trim())
              .maybeSingle();
            if (proc) payload.processo_id = proc.id;
          }
          const result = await onSave(payload, dado?.id);
          if (result) {
            toast.success("Distribuição TST e Dados Benner sincronizados com Judit");
            // Se foi um insert novo, `result` é o id recém-criado; propaga para
            // o container habilitar as abas dependentes imediatamente.
            const newId = typeof result === "string" ? result : (dado?.id || undefined);
            onJuditSync?.(newId);
          }
        } catch (e: any) {
          console.error("Auto-save Judit falhou:", e);
        }
      } else {
        toast.info("Judit retornou dados, mas todos os campos já estavam preenchidos.");
      }
    } catch (e: any) {
      toast.error("Falha ao buscar na Judit: " + (e?.message || "erro desconhecido"));
    } finally {
      setBuscandoJudit(false);
    }
  };

  useImperativeHandle(ref, () => ({
    runJudit: (comAnexos: boolean) => handleBuscarJudit(comAnexos),
    isBuscando: () => buscandoJudit,
  }), [buscandoJudit, form, dado, juditSessionFields, turmasTst, relatoresTst]);

  const handleSave = async () => {
    if (!form.processo_numero?.trim()) {
      toast.warning("Informe o número do processo");
      return;
    }
    setSaving(true);

    // Garante sessão válida antes de tentar INSERT/UPDATE em tabelas com RLS.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      toast.error("Sua sessão expirou. Faça login novamente para salvar.");
      setSaving(false);
      return;
    }

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
          const msg = /row-level security/i.test(error.message)
            ? "Sem permissão para criar processo. Verifique se seu usuário está ativo e se a sessão não expirou."
            : error.message;
          toast.error("Erro ao criar processo: " + msg);
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
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dossiê</Label>
              <Input value={form.dossie || ""} onChange={e => set("dossie", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Equipe</Label>
              <Input value={form.equipe || ""} onChange={e => set("equipe", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reclamante</Label>
              <Textarea
                value={form.reclamante || ""}
                onChange={e => set("reclamante", e.target.value || null)}
                rows={2}
                className="min-h-[76px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label>Reclamada</Label>
              <Textarea
                value={form.reclamada || ""}
                onChange={e => set("reclamada", e.target.value || null)}
                rows={2}
                className="min-h-[76px] resize-y"
              />
            </div>
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
              <MultiTipoRecurso
                value={form.tipo_recurso_reclamante}
                onChange={(v) => set("tipo_recurso_reclamante", v)}
              />
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
              <MultiTipoRecurso
                value={form.tipo_recurso_banco}
                onChange={(v) => set("tipo_recurso_banco", v)}
              />
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
            <MateriasMultiSelect
              value={form.materias_recurso_banco || null}
              onChange={(v) => set("materias_recurso_banco", v)}
            />
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
});
