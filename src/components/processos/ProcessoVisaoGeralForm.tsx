import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, Sparkles, Copy, Bell, Users, Scale, FileText, Building2, DollarSign, Activity, Paperclip } from "lucide-react";
import { SelecionarResponsaveisProcesso } from "./SelecionarResponsaveisProcesso";
import { MonitoramentoToggle } from "./MonitoramentoToggle";
import { PendenciasProcessoCard } from "./PendenciasProcessoCard";
import { DepositosRecursaisCard } from "./DepositosRecursaisCard";
import { CustasProcessuaisCard } from "./CustasProcessuaisCard";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getJuditAttachmentDedupKey } from "@/lib/juditAnexosDedup";

interface Props {
  processo: any;
  audiencias?: any[];
  intimacoes?: any[];
  tarefas?: any[];
  movimentacoes?: any[];
  onNavigate?: (section: string) => void;
}

// Lista de campos editáveis (whitelist) - todos da tabela processos
const FIELDS = [
  // Identificação
  "assunto", "tipo_processo", "classe", "natureza", "area", "fase", "status",
  // Tribunal / órgão
  "tribunal", "justica", "instancia", "esfera", "sistema",
  "orgao_julgador", "vara", "comarca", "uf", "materia",
  // Partes
  "polo_ativo", "polo_passivo", "terceiro_envolvido", "reclamante", "reclamados", "pedidos",
  // Datas
  "data_distribuicao", "data_recebimento", "data_citacao",
  // Financeiro / contingenciais
  "valor_causa", "valor_condenacao", "valor_provisionado",
  "ativo_passivo", "responsabilidade_tipo", "risco_atual", "probabilidade", "risco",
  "funcao", "advogado_externo",
  // Pastas
  "pasta_fisica", "pasta_cliente",
  // Descrição
  "descricao",
] as const;

const NUMERIC_FIELDS = new Set(["valor_causa", "valor_condenacao", "valor_provisionado"]);
const DATE_FIELDS = new Set(["data_distribuicao", "data_recebimento", "data_citacao"]);

function FormField({
  label,
  children,
  className,
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1 pb-2 mb-3 border-b">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

export function ProcessoVisaoGeralForm({
  processo,
  audiencias = [],
  intimacoes = [],
  tarefas = [],
  movimentacoes = [],
  onNavigate,
}: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const [responsaveis, setResponsaveis] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingAnexos, setSyncingAnexos] = useState(false);
  const [syncingInterno, setSyncingInterno] = useState(false);
  // Campos preenchidos pela Judit nesta sessão (para destacar em verde)
  const [juditSessionFields, setJuditSessionFields] = useState<Set<string>>(new Set());
  // Contador ao vivo (segundos decorridos) durante a busca Judit — mesma
  // experiência da tela de Distribuição TST: o usuário vê que algo está
  // acontecendo e não pensa que travou.
  const [juditElapsed, setJuditElapsed] = useState(0);
  const juditBusy = syncing || syncingAnexos || syncingInterno;
  useEffect(() => {
    if (!juditBusy) { setJuditElapsed(0); return; }
    const start = Date.now();
    const id = window.setInterval(() => setJuditElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [juditBusy]);
  // Progresso "suave" 0→95% enquanto aguardamos a Judit (a API não devolve
  // progresso real). Vai para 100% quando termina.
  const juditProgress = juditBusy
    ? Math.min(95, Math.round((1 - Math.exp(-juditElapsed / 12)) * 100))
    : 0;

  // Inicializa form quando processo carregar/trocar
  useEffect(() => {
    if (!processo?.id) return;
    const next: Record<string, any> = {};
    for (const f of FIELDS) next[f] = (processo as any)[f] ?? "";
    setForm(next);
    // Recupera campos preenchidos pela Judit em sessões anteriores para
    // manter o destaque verde mesmo após sair e voltar.
    const persisted = (processo as any)?.judit_campos;
    if (Array.isArray(persisted)) {
      setJuditSessionFields(new Set(persisted.filter((s: any) => typeof s === "string")));
    } else {
      setJuditSessionFields(new Set());
    }
  }, [processo?.id, processo?.updated_at]);

  const update = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!processo?.id) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      for (const f of FIELDS) {
        const v = form[f];
        if (NUMERIC_FIELDS.has(f)) {
          payload[f] = v === "" || v == null ? null : Number(v);
        } else {
          payload[f] = v === "" || v == null ? null : v;
        }
      }
      const { error } = await supabase
        .from("processos")
        .update(payload as any)
        .eq("id", processo.id);
      if (error) throw error;

      if (responsaveis.length > 0) {
        await supabase
          .from("processos_responsaveis")
          .update({ ativo: false } as any)
          .eq("processo_id", processo.id);
        const inserts = responsaveis.map((r: any) => ({
          processo_id: processo.id,
          usuario_id: r.usuario_id,
          coordenacao_id: r.coordenacao_id || null,
          papel: r.papel || "responsavel",
          ativo: true,
        }));
        const { error: errResp } = await supabase
          .from("processos_responsaveis")
          .upsert(inserts as any, { onConflict: "processo_id,usuario_id" });
        if (errResp) throw errResp;
      }

      await queryClient.invalidateQueries({ queryKey: ["processo"] });
      await queryClient.invalidateQueries({ queryKey: ["processos-responsaveis"] });
      toast.success("Processo atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Sincronização com Judit — equivalente ao botão da Distribuição TST.
   * Busca dados da Judit, atualiza o processo (capa + partes/advogados) e
   * grava log em consultas_judit. Em seguida, recarrega o form.
   * Quando `comAnexos = true`, também persiste os anexos em `judit_anexos`
   * para que a aba "Anexos Judit" exiba a lista com o botão de IA.
   */
  const handleSyncJudit = async (comAnexos: boolean = false) => {
    if (!processo?.numero) {
      toast.warning("Processo sem número CNJ cadastrado.");
      return;
    }
    // Extrai o CNJ "limpo" do campo numero — alguns processos têm texto
    // extra (ex.: "0010996-92.2021.5.15.0094 (transitou em julgado...)") que,
    // se enviado bruto, quebra o cache de anexos (a chave processo_numero
    // fica diferente da chave usada pela aba "Anexos Judit").
    const cnjMatch = String(processo.numero).match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/);
    const numeroLimpo = cnjMatch ? cnjMatch[0] : String(processo.numero).trim();
    if (comAnexos) setSyncingAnexos(true); else setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-judit", {
        body: {
          numero_processo: numeroLimpo,
          tribunal: "TST",
          com_anexos: comAnexos,
          force_refresh: true,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Extrai reclamante/reclamada das partes (mesma lógica da Distribuição TST)
      const partes = Array.isArray(data?.parties_detail) ? data.parties_detail : [];
      const nomesPorTipo = (re: RegExp) =>
        [...new Set(
          partes
            .filter((p: any) => !p?.is_advogado && re.test(String(p?.tipo_pessoa || "")))
            .map((p: any) => String(p?.nome || "").trim())
            .filter(Boolean)
        )].join(" / ");
      const reclamante =
        (data?.reclamante && String(data.reclamante).trim()) ||
        nomesPorTipo(/RECLAMANTE|AUTOR|EXEQUENTE|REQUERENTE/i) ||
        "";
      const reclamada =
        (data?.reclamada && String(data.reclamada).trim()) ||
        nomesPorTipo(/RECLAMAD|R[ÉE]U|EXECUTAD|REQUERID/i) ||
        "";

      // Monta atualização do processo — só sobrescreve quando Judit traz valor
      const next: Record<string, any> = { ...form };
      const filled = new Set<string>(juditSessionFields);
      const apply = (field: string, value: any) => {
        if (value !== null && value !== undefined && String(value).trim() !== "") {
          next[field] = value;
          filled.add(field);
        }
      };
      apply("tribunal", data.tribunal || data.tribunal_acronimo);
      apply("orgao_julgador", data.orgao_julgador);
      apply("classe", data.classe_capa || data.classe);
      apply("assunto", data.assunto);
      apply("comarca", data.comarca);
      // Vara só é preenchida se a Judit trouxer um valor próprio para `vara`;
      // não duplicamos o conteúdo do órgão julgador no campo Vara/Câmara.
      apply("vara", data.vara);
      apply("uf", data.uf);
      apply("instancia", data.instancia);
      apply("data_distribuicao", data.data_distribuicao);
      apply("valor_causa", data.valor_causa);
      apply("polo_ativo", reclamante);
      apply("polo_passivo", reclamada);
      apply("reclamante", reclamante);
      apply("reclamados", reclamada);
      apply("fase", data.situacao_processo);

      setForm(next);
      setJuditSessionFields(filled);

      // Persiste no banco
      const updatePayload: Record<string, any> = {};
      for (const f of FIELDS) {
        const v = next[f];
        if (NUMERIC_FIELDS.has(f)) updatePayload[f] = v === "" || v == null ? null : Number(v);
        else updatePayload[f] = v === "" || v == null ? null : v;
      }
      // Persiste a lista de campos preenchidos pela Judit para preservar
      // o destaque verde após reload.
      (updatePayload as any).judit_campos = Array.from(filled);
      await supabase.from("processos").update(updatePayload as any).eq("id", processo.id);

      // Atualiza partes vindas da Judit em processos_partes
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      await supabase
        .from("processos_partes" as any)
        .delete()
        .eq("processo_id", processo.id)
        .eq("fonte", "judit");
      if (partes.length > 0) {
        const rows = partes
          .map((p: any) => ({
            processo_id: processo.id,
            nome: String(p?.nome || "").trim(),
            documento: p?.documento || null,
            tipo_pessoa: p?.tipo_pessoa || null,
            polo: p?.polo || null,
            lado_efetivo: p?.lado_efetivo || null,
            is_advogado: !!p?.is_advogado,
            fonte: "judit",
            raw: p,
            created_by: uid,
          }))
          .filter((r: any) => r.nome);
        if (rows.length > 0) {
          await supabase.from("processos_partes" as any).insert(rows);
        }
      }

      // Log
      await supabase.from("consultas_judit").insert({
        processo_id: processo.id,
        requisitada_em: new Date().toISOString(),
        status_http: 200,
        payload_resposta: data,
        erro: null,
      });
      try {
        await supabase.from("judit_logs" as any).insert({
          processo_numero: numeroLimpo,
          tribunal: "TST",
          request_payload: { numero_processo: numeroLimpo, tribunal: "TST", com_anexos: comAnexos, force_refresh: true },
          raw_response: data,
          status: "sucesso",
          error_message: null,
          created_by: uid,
        });
      } catch (_) { /* noop */ }

      // Persiste anexos (mesma lógica da Distribuição TST) para alimentar a aba Anexos Judit
      if (comAnexos) {
        const atts = Array.isArray((data as any)?.attachments) ? (data as any).attachments : [];
        if (atts.length > 0) {
          try {
            const rowsRaw = atts.map((a: any) => ({
              processo_numero: numeroLimpo,
              cnj: a?.cnj || numeroLimpo,
              instance: a?.instance != null ? String(a.instance) : null,
              attachment_id: String(a?.step_id || a?.attachment_id || ""),
              step_id: a?.step_id ? String(a.step_id) : null,
              attachment_name: a?.attachment_name || null,
              attachment_date: a?.attachment_date || null,
              extension: a?.extension || null,
              status: a?.status || "done",
              corrupted: a?.corrupted ?? false,
              raw_attachment: a,
              created_by: uid,
            })).filter((r: any) => r.attachment_id);
            const seen = new Set<string>();
            const rows = rowsRaw.filter((r: any) => {
              const key = getJuditAttachmentDedupKey(r);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            if (rows.length > 0) {
              await supabase.from("judit_anexos" as any).delete().eq("processo_numero", numeroLimpo);
              await supabase.from("judit_anexos" as any).insert(rows);
              await queryClient.invalidateQueries({ queryKey: ["judit_anexos", processo.numero] });
              await queryClient.invalidateQueries({ queryKey: ["judit_anexos", numeroLimpo] });
            }
            toast.success(`Judit retornou ${atts.length} anexo(s).`);
          } catch (e) {
            console.warn("Falha ao persistir judit_anexos:", e);
          }
        } else {
          toast.warning("Judit não retornou anexos nesta consulta.");
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["processo"] });
      await queryClient.invalidateQueries({ queryKey: ["processos_partes", processo.id] });
      await queryClient.invalidateQueries({ queryKey: ["consultas_judit", processo.id] });
      toast.success(`Judit sincronizada — ${partes.length} parte(s) atualizada(s).`);
    } catch (e: any) {
      toast.error("Erro Judit: " + (e?.message || "desconhecido"));
    } finally {
      if (comAnexos) setSyncingAnexos(false); else setSyncing(false);
    }
  };

  /**
   * Sincronização INDEPENDENTE para Processo Interno — chama a edge function
   * `judit-processo-interno` (separada da buscar-judit usada pela Dados Benner).
   * Preenche o máximo de atributos do formulário (todos os FIELDS quando a
   * Judit traz valor).
   */
  const handleSyncJuditInterno = async () => {
    if (!processo?.numero) {
      toast.warning("Processo sem número CNJ cadastrado.");
      return;
    }
    const cnjMatch = String(processo.numero).match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/);
    const numeroLimpo = cnjMatch ? cnjMatch[0] : String(processo.numero).trim();
    setSyncingInterno(true);
    try {
      const { data, error } = await supabase.functions.invoke("judit-processo-interno", {
        body: { numero_processo: numeroLimpo, force_refresh: true },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      const next: Record<string, any> = { ...form };
      const filled = new Set<string>(juditSessionFields);
      const apply = (field: string, value: any) => {
        if (value !== null && value !== undefined && String(value).trim() !== "") {
          next[field] = value;
          filled.add(field);
        }
      };
      for (const f of FIELDS) apply(f, (data as any)[f]);
      setForm(next);
      setJuditSessionFields(filled);

      // Persiste
      const updatePayload: Record<string, any> = {};
      for (const f of FIELDS) {
        const v = next[f];
        if (NUMERIC_FIELDS.has(f)) updatePayload[f] = v === "" || v == null ? null : Number(v);
        else updatePayload[f] = v === "" || v == null ? null : v;
      }
      (updatePayload as any).judit_campos = Array.from(filled);
      await supabase.from("processos").update(updatePayload as any).eq("id", processo.id);

      // Log
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      try {
        await supabase.from("judit_logs" as any).insert({
          processo_numero: numeroLimpo,
          tribunal: data?.tribunal || null,
          request_payload: { numero_processo: numeroLimpo, fonte: "judit-processo-interno" },
          raw_response: data,
          status: "sucesso",
          error_message: null,
          created_by: uid,
        });
      } catch (_) { /* noop */ }

      // Partes
      const partes = Array.isArray((data as any)?.parties_detail) ? (data as any).parties_detail : [];
      await supabase.from("processos_partes" as any).delete().eq("processo_id", processo.id).eq("fonte", "judit");
      if (partes.length > 0) {
        const rows = partes.map((p: any) => ({
          processo_id: processo.id,
          nome: String(p?.nome || "").trim(),
          documento: p?.documento || null,
          tipo_pessoa: p?.tipo_pessoa || null,
          polo: p?.polo || null,
          lado_efetivo: p?.lado_efetivo || null,
          is_advogado: !!p?.is_advogado,
          fonte: "judit",
          raw: p,
          created_by: uid,
        })).filter((r: any) => r.nome);
        if (rows.length > 0) {
          await supabase.from("processos_partes" as any).insert(rows);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["processo"] });
      await queryClient.invalidateQueries({ queryKey: ["processos_partes", processo.id] });
      const preenchidos = Object.keys(data || {}).filter((k) => (FIELDS as readonly string[]).includes(k) && (data as any)[k] != null && String((data as any)[k]).trim() !== "").length;
      toast.success(`Judit (Interno) sincronizada — ${preenchidos} campo(s) preenchido(s).`);
    } catch (e: any) {
      toast.error("Erro Judit Interno: " + (e?.message || "desconhecido"));
    } finally {
      setSyncingInterno(false);
    }
  };

  const copy = (t: string) => navigator.clipboard.writeText(t);

  const inputCls = "h-9 text-sm";
  // Classe verde aplicada a inputs cujo campo foi preenchido pela Judit na sessão.
  const jcls = (field: string) =>
    juditSessionFields.has(field) && form[field] !== "" && form[field] != null
      ? "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
      : "";
  const isAdmin = useMemo(() => processo?.tipo_processo === "administrativo", [processo?.tipo_processo]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 md:p-6 space-y-6">
          {/* Cabeçalho do form */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Visão Geral do Processo</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-mono text-muted-foreground">{processo?.numero}</span>
                {processo?.numero && (
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copy(processo.numero)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSyncJudit(false)}
                disabled={syncing || syncingAnexos || saving}
                className="gap-1"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-600" />}
                {syncing
                  ? (juditElapsed < 3 ? "Consultando Judit…" : `Aguardando crawler… ${juditElapsed}s`)
                  : "Sincronizar Judit"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSyncJudit(true)}
                disabled={syncing || syncingAnexos || saving}
                className="gap-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              >
                {syncingAnexos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {syncingAnexos
                  ? (juditElapsed < 3 ? "Buscando anexos…" : `Aguardando crawler… ${juditElapsed}s`)
                  : "Judit c/ anexos"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncJuditInterno}
                disabled={juditBusy || saving}
                className="gap-1 border-indigo-500 text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                title="Preenche o máximo de campos do formulário usando uma chamada Judit independente"
              >
                {syncingInterno ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {syncingInterno
                  ? (juditElapsed < 3 ? "Consultando…" : `Aguardando… ${juditElapsed}s`)
                  : "Judit (Interno)"}
              </Button>
              {(juditSessionFields.size > 0 || (Array.isArray((processo as any)?.judit_campos) && (processo as any).judit_campos.length > 0)) && onNavigate && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("analise-judit")}
                    className="gap-1"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Análise Judit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("anexos-judit")}
                    className="gap-1"
                  >
                    <Paperclip className="w-4 h-4 text-emerald-600" />
                    Anexos Judit
                  </Button>
                </>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving || syncing || syncingAnexos}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Salvar alterações
              </Button>
            </div>
          </div>

          {juditBusy && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900 px-3 py-2">
              <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {syncingAnexos ? "Consultando Judit (com anexos)…" : "Consultando Judit…"}
                </span>
                <span className="font-mono">{juditElapsed}s · {juditProgress}%</span>
              </div>
              <Progress value={juditProgress} className="h-2" />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUNA PRINCIPAL */}
            <div className="lg:col-span-2 space-y-6">
              {/* Identificação */}
              <section>
                <SectionHeader icon={FileText} title="Identificação" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="Assunto" className="md:col-span-2">
                    <Input className={cn(inputCls, jcls("assunto"))} value={form.assunto || ""} onChange={(e) => update("assunto", e.target.value)} />
                  </FormField>
                  <FormField label="Tipo de Processo">
                    <Select value={form.tipo_processo || "judicial"} onValueChange={(v) => update("tipo_processo", v)}>
                      <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="judicial">Judicial</SelectItem>
                        <SelectItem value="administrativo">Administrativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Situação">
                    <Select value={form.status || "ativo"} onValueChange={(v) => update("status", v)}>
                      <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="arquivado_parcialmente">Arquivado Parcialmente</SelectItem>
                        <SelectItem value="arquivado_definitivamente">Arquivado Definitivamente</SelectItem>
                        <SelectItem value="suspenso">Suspenso</SelectItem>
                        <SelectItem value="encerrado">Encerrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Classe CNJ">
                    <Input className={cn(inputCls, jcls("classe"))} value={form.classe || ""} onChange={(e) => update("classe", e.target.value)} />
                  </FormField>
                  <FormField label="Natureza">
                    <Input className={inputCls} value={form.natureza || ""} onChange={(e) => update("natureza", e.target.value)} />
                  </FormField>
                  <FormField label="Área">
                    <Input className={inputCls} value={form.area || ""} onChange={(e) => update("area", e.target.value)} />
                  </FormField>
                  <FormField label="Fase Processual">
                    <Input className={cn(inputCls, jcls("fase"))} value={form.fase || ""} onChange={(e) => update("fase", e.target.value)} />
                  </FormField>
                </div>
              </section>

              {/* Tribunal / Órgão */}
              <section>
                <SectionHeader icon={Scale} title="Tribunal e Órgão Julgador" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="Tribunal">
                    <Input className={cn(inputCls, jcls("tribunal"))} value={form.tribunal || ""} onChange={(e) => update("tribunal", e.target.value)} />
                  </FormField>
                  <FormField label="Justiça">
                    <Input className={inputCls} value={form.justica || ""} onChange={(e) => update("justica", e.target.value)} />
                  </FormField>
                  <FormField label="Instância">
                    <Input className={cn(inputCls, jcls("instancia"))} value={form.instancia || ""} onChange={(e) => update("instancia", e.target.value)} />
                  </FormField>
                  <FormField label="Esfera">
                    <Input className={inputCls} value={form.esfera || ""} onChange={(e) => update("esfera", e.target.value)} />
                  </FormField>
                  <FormField label="Sistema">
                    <Input className={inputCls} value={form.sistema || ""} onChange={(e) => update("sistema", e.target.value)} />
                  </FormField>
                  <FormField label="Matéria">
                    <Input className={inputCls} value={form.materia || ""} onChange={(e) => update("materia", e.target.value)} />
                  </FormField>
                  <FormField label="Órgão Julgador" className="md:col-span-2">
                    <Input className={cn(inputCls, jcls("orgao_julgador"))} value={form.orgao_julgador || ""} onChange={(e) => update("orgao_julgador", e.target.value)} />
                  </FormField>
                  <FormField label="Vara / Câmara">
                    <Input className={cn(inputCls, jcls("vara"))} value={form.vara || ""} onChange={(e) => update("vara", e.target.value)} />
                  </FormField>
                  <FormField label="Comarca">
                    <Input className={cn(inputCls, jcls("comarca"))} value={form.comarca || ""} onChange={(e) => update("comarca", e.target.value)} />
                  </FormField>
                  <FormField label="UF">
                    <Input className={cn(inputCls, jcls("uf"))} value={form.uf || ""} onChange={(e) => update("uf", e.target.value)} />
                  </FormField>
                </div>
              </section>

              {/* Partes / Envolvidos */}
              <section>
                <SectionHeader icon={Users} title="Partes e Envolvidos" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="Polo Ativo (Reclamante / Autor)">
                    <Textarea className={cn("text-sm min-h-[60px]", jcls("polo_ativo"))} value={form.polo_ativo || ""} onChange={(e) => update("polo_ativo", e.target.value)} />
                  </FormField>
                  <FormField label="Polo Passivo (Reclamado / Réu)">
                    <Textarea className={cn("text-sm min-h-[60px]", jcls("polo_passivo"))} value={form.polo_passivo || ""} onChange={(e) => update("polo_passivo", e.target.value)} />
                  </FormField>
                  <FormField label="Reclamante (Judit)">
                    <Input className={cn(inputCls, jcls("reclamante"))} value={form.reclamante || ""} onChange={(e) => update("reclamante", e.target.value)} />
                  </FormField>
                  <FormField label="Reclamados (Judit)">
                    <Input className={cn(inputCls, jcls("reclamados"))} value={form.reclamados || ""} onChange={(e) => update("reclamados", e.target.value)} />
                  </FormField>
                  <FormField label="Terceiros Envolvidos" className="md:col-span-2">
                    <Textarea className="text-sm min-h-[50px]" value={form.terceiro_envolvido || ""} onChange={(e) => update("terceiro_envolvido", e.target.value)} />
                  </FormField>
                  <FormField label="Pedidos" className="md:col-span-2">
                    <Textarea className="text-sm min-h-[60px]" value={form.pedidos || ""} onChange={(e) => update("pedidos", e.target.value)} />
                  </FormField>
                  <FormField label="Responsáveis Internos" className="md:col-span-2">
                    <SelecionarResponsaveisProcesso
                      processoId={processo.id}
                      value={responsaveis}
                      onChange={setResponsaveis}
                    />
                  </FormField>
                </div>
              </section>

              {/* Datas */}
              <section>
                <SectionHeader icon={Activity} title="Datas Processuais" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="Distribuição">
                    <Input type="date" className={cn(inputCls, jcls("data_distribuicao"))} value={form.data_distribuicao || ""} onChange={(e) => update("data_distribuicao", e.target.value)} />
                  </FormField>
                  <FormField label="Recebimento">
                    <Input type="date" className={inputCls} value={form.data_recebimento || ""} onChange={(e) => update("data_recebimento", e.target.value)} />
                  </FormField>
                  <FormField label="Citação">
                    <Input type="date" className={inputCls} value={form.data_citacao || ""} onChange={(e) => update("data_citacao", e.target.value)} />
                  </FormField>
                </div>
              </section>

              {/* Financeiro */}
              <section>
                <SectionHeader icon={DollarSign} title="Financeiro e Contingenciamento" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="Valor da Causa">
                    <Input type="number" step="0.01" className={cn(inputCls, jcls("valor_causa"))} value={form.valor_causa ?? ""} onChange={(e) => update("valor_causa", e.target.value)} />
                  </FormField>
                  <FormField label="Valor da Condenação">
                    <Input type="number" step="0.01" className={inputCls} value={form.valor_condenacao ?? ""} onChange={(e) => update("valor_condenacao", e.target.value)} />
                  </FormField>
                  <FormField label="Valor Provisionado">
                    <Input type="number" step="0.01" className={inputCls} value={form.valor_provisionado ?? ""} onChange={(e) => update("valor_provisionado", e.target.value)} />
                  </FormField>
                  <FormField label="Posição do Cliente">
                    <Input className={inputCls} value={form.ativo_passivo || ""} onChange={(e) => update("ativo_passivo", e.target.value)} />
                  </FormField>
                  <FormField label="Tipo de Responsabilidade">
                    <Input className={inputCls} value={form.responsabilidade_tipo || ""} onChange={(e) => update("responsabilidade_tipo", e.target.value)} />
                  </FormField>
                  <FormField label="Risco Atual">
                    <Input className={inputCls} value={form.risco_atual || ""} onChange={(e) => update("risco_atual", e.target.value)} />
                  </FormField>
                  <FormField label="Probabilidade">
                    <Input className={inputCls} value={form.probabilidade || ""} onChange={(e) => update("probabilidade", e.target.value)} />
                  </FormField>
                  <FormField label="Risco">
                    <Input className={inputCls} value={form.risco || ""} onChange={(e) => update("risco", e.target.value)} />
                  </FormField>
                  <FormField label="Função / Cargo">
                    <Input className={inputCls} value={form.funcao || ""} onChange={(e) => update("funcao", e.target.value)} />
                  </FormField>
                  <FormField label="Advogado Externo" className="md:col-span-2">
                    <Input className={inputCls} value={form.advogado_externo || ""} onChange={(e) => update("advogado_externo", e.target.value)} />
                  </FormField>
                </div>
              </section>

              {/* Pastas e descrição */}
              <section>
                <SectionHeader icon={Building2} title="Pastas e Descrição" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="Pasta Física">
                    <Input className={inputCls} value={form.pasta_fisica || ""} onChange={(e) => update("pasta_fisica", e.target.value)} />
                  </FormField>
                  <FormField label="Pasta do Cliente">
                    <Input className={inputCls} value={form.pasta_cliente || ""} onChange={(e) => update("pasta_cliente", e.target.value)} />
                  </FormField>
                  <FormField label="Descrição" className="md:col-span-2">
                    <Textarea className="text-sm min-h-[80px]" value={form.descricao || ""} onChange={(e) => update("descricao", e.target.value)} />
                  </FormField>
                </div>
              </section>

              {(processo as any)?.judit_ia_observacoes && (
                <section>
                  <SectionHeader icon={Sparkles} title="Observações da IA (Anexos Judit)" />
                  <Textarea
                    className="text-sm min-h-[120px] font-mono bg-emerald-50/40 dark:bg-emerald-950/20"
                    value={(processo as any).judit_ia_observacoes || ""}
                    readOnly
                  />
                </section>
              )}
            </div>

            {/* COLUNA LATERAL — cards de status / pendências */}
            <div className="space-y-4">
              <section>
                <SectionHeader icon={Bell} title="Monitoramento" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                    <span className="text-xs font-medium">Andamentos</span>
                    <MonitoramentoToggle processoId={processo.id} campo="monitorar_andamentos" valorInicial={!!processo.monitorar_andamentos} />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                    <span className="text-xs font-medium">DJEN</span>
                    <MonitoramentoToggle processoId={processo.id} campo="monitorar_djen" valorInicial={!!processo.monitorar_djen} />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                    <span className="text-xs font-medium">Prioridade DJEN</span>
                    <MonitoramentoToggle processoId={processo.id} campo="prioridade_djen" valorInicial={!!(processo as any).prioridade_djen} />
                  </div>
                </div>
              </section>

              <PendenciasProcessoCard
                audiencias={audiencias}
                intimacoes={intimacoes}
                tarefas={tarefas}
                movimentacoes={movimentacoes}
              />
              <DepositosRecursaisCard processoId={processo.id} />
              <CustasProcessuaisCard processoId={processo.id} />

              {/* Metadados sistema */}
              <div className="text-[11px] text-muted-foreground space-y-0.5 pt-2 border-t">
                {processo.created_at && (
                  <div>Criado: {new Date(processo.created_at).toLocaleString("pt-BR")}</div>
                )}
                {processo.updated_at && (
                  <div>Atualizado: {new Date(processo.updated_at).toLocaleString("pt-BR")}</div>
                )}
                {processo.coordenacao?.nome && (
                  <div>Coordenação: <span className="text-foreground font-medium">{processo.coordenacao.nome}</span></div>
                )}
                {(processo.cliente?.nome || processo.nome_cliente_envolvido) && (
                  <div>Cliente: <span className="text-foreground font-medium">{processo.cliente?.nome || processo.nome_cliente_envolvido}</span></div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}