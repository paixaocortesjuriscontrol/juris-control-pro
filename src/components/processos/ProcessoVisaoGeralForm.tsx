import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, Sparkles, Copy, Bell, Users, Scale, FileText, Building2, DollarSign, Activity, Paperclip, Plus, Flame, ListTodo, Clock, CalendarDays, Gavel, CheckCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CriarAudienciaProcessoDialog } from "@/components/audiencias/CriarAudienciaProcessoDialog";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { PrazoDialog } from "@/components/prazos/PrazoDialog";
import { NovaTarefaDialog } from "@/components/delegacao/NovaTarefaDialog";
import { SelecionarResponsaveisProcesso } from "./SelecionarResponsaveisProcesso";
import { MonitoramentoToggle } from "./MonitoramentoToggle";
import { AcompanhamentoEspecialToggle } from "./AcompanhamentoEspecialToggle";
import { PendenciasProcessoCard } from "./PendenciasProcessoCard";
import { DepositosRecursaisCard } from "./DepositosRecursaisCard";
import { CustasProcessuaisCard } from "./CustasProcessuaisCard";
import { TestemunhasSection } from "./TestemunhasSection";
import type { NovoItemTipo } from "@/components/shared/NovoItemPanel";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getJuditAttachmentDedupKey } from "@/lib/juditAnexosDedup";
import { obterVariantesCnjBusca } from "@/utils/cnjMask";
import { CurrencyInputBRL } from "@/components/ui/currency-input-brl";

interface Props {
  processo: any;
  audiencias?: any[];
  intimacoes?: any[];
  tarefas?: any[];
  movimentacoes?: any[];
  eventosAgenda?: any[];
  onNavigate?: (section: string) => void;
  onAddItem?: (tipo: NovoItemTipo) => void;
  /**
   * Notifica o container quando o usuário digita/atualiza o número do processo
   * (usado no modo "novo processo" para sincronizar `processo.numero` no pai,
   * habilitando a aba "Análise Judit" que depende desse campo).
   */
  onNumeroChange?: (numero: string) => void;
  onJuditNovoPreenchido?: () => void;
  /**
   * Quando true, renderiza apenas o cabeçalho com a barra de ações Judit
   * (Sincronizar / Judit c/ anexos / Judit Interno / Análise Judit / Anexos
   * Judit / Salvar). Usado nas seções "analise-judit" e "anexos-judit" para
   * manter os botões sempre visíveis sem renderizar o formulário completo.
   */
  compact?: boolean;
  /**
   * Renderiza APENAS a barra de botões Judit (sem o formulário e sem o botão
   * Salvar). Útil para um toolbar global no topo da tela.
   */
  actionsOnly?: boolean;
  /**
   * Esconde os botões Judit (Sincronizar/Anexos/Interno/Análise) dentro do
   * formulário — usado quando esses botões já estão num toolbar superior.
   */
  hideJuditButtons?: boolean;
}

export type ProcessoVisaoGeralFormHandle = {
  save: (opts?: { silent?: boolean }) => Promise<void>;
  preencherFormularioJudit: (comAnexos?: boolean, presetData?: any) => Promise<void>;
};

// Lista de campos editáveis (whitelist) - todos da tabela processos
const FIELDS = [
  // Identificação
  "assunto", "tipo_processo", "classe", "natureza", "area", "fase", "status",
  // Tribunal / órgão
  "tribunal", "justica", "instancia", "esfera", "sistema",
  "orgao_julgador", "vara", "comarca", "uf", "materia",
  // Partes
  "polo_ativo", "polo_passivo", "terceiro_envolvido", "reclamante", "reclamados", "pedidos",
  // Importação Beatriz Costa
  "empresa_terceirizada", "processos_relacionados", "segredo_justica",
  // Datas
  "data_distribuicao", "data_recebimento", "data_citacao",
  // Financeiro / contingenciais
  "valor_causa", "valor_condenacao", "valor_provisionado",
  "ativo_passivo", "responsabilidade_tipo", "risco_atual", "probabilidade", "risco",
  "funcao", "advogado_externo",
  // Pastas
  "pasta_fisica", "pasta_cliente",
  // Coordenação
  "coordenacao_id",
  // Descrição
  "descricao",
  // Encerramento
  "motivo_encerramento",
  "impactante",
] as const;

const NUMERIC_FIELDS = new Set(["valor_causa", "valor_condenacao", "valor_provisionado"]);
const BOOLEAN_FIELDS = new Set(["segredo_justica"]);
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

export const ProcessoVisaoGeralForm = forwardRef<ProcessoVisaoGeralFormHandle, Props>(function ProcessoVisaoGeralForm({
  processo,
  audiencias = [],
  intimacoes = [],
  tarefas = [],
  movimentacoes = [],
  eventosAgenda = [],
  onNavigate,
  onAddItem,
  compact = false,
  actionsOnly = false,
  hideJuditButtons = false,
  onNumeroChange,
  onJuditNovoPreenchido,
}, ref) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Modo criação: quando o processo ainda não tem id, `handleSave` faz INSERT
  // e redireciona para a URL do novo processo.
  const isNovo = !processo?.id;
  const [form, setForm] = useState<Record<string, any>>({});
  const [responsaveis, setResponsaveis] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingAnexos, setSyncingAnexos] = useState(false);
  const [syncingInterno, setSyncingInterno] = useState(false);
  const [comAnexosJudit, setComAnexosJudit] = useState(false);
  const [juditNovoCardVisible, setJuditNovoCardVisible] = useState(false);
  const [criarAudienciaOpen, setCriarAudienciaOpen] = useState(false);
  const [novaTarefaOpen, setNovaTarefaOpen] = useState(false);
  const [novoEventoOpen, setNovoEventoOpen] = useState(false);
  const [novoPrazoOpen, setNovoPrazoOpen] = useState(false);
  const { user } = useAuth();
  const { isAdmin: isUserAdmin, isAdminOrCoordinator: podeUsarAnexosJudit } = useUserRole();
  const { data: membrosCoordenacoes = [] } = useQuery({
    queryKey: ["membros-coordenacoes-processo-adicionar", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id);
      if (error) throw error;
      return (data || []).map((m: any) => m.coordenacao_id as string);
    },
    enabled: !!user?.id && !isUserAdmin,
  });
  const { data: coordenacoesTarefa = [] } = useQuery({
    queryKey: ["coordenacoes-processo-adicionar", isUserAdmin, membrosCoordenacoes],
    queryFn: async () => {
      let query = supabase.from("coordenacoes").select("id, nome, area").order("nome");
      if (!isUserAdmin && membrosCoordenacoes.length > 0) {
        query = query.in("id", membrosCoordenacoes);
      } else if (!isUserAdmin && membrosCoordenacoes.length === 0) {
        return [] as any[];
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isUserAdmin || membrosCoordenacoes.length > 0,
  });
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
    if (!processo?.id && !isNovo) return;
    const next: Record<string, any> = {};
    next.numero = (processo as any)?.numero ?? "";
    for (const f of FIELDS) {
      next[f] = BOOLEAN_FIELDS.has(f)
        ? Boolean((processo as any)?.[f])
        : ((processo as any)?.[f] ?? "");
    }
    setForm(next);
    // Recupera campos preenchidos pela Judit em sessões anteriores para
    // manter o destaque verde mesmo após sair e voltar.
    const persisted = (processo as any)?.judit_campos;
    if (Array.isArray(persisted)) {
      setJuditSessionFields(new Set(persisted.filter((s: any) => typeof s === "string")));
    } else {
      setJuditSessionFields(new Set());
    }
  }, [processo?.id, processo?.updated_at, isNovo]);

  const update = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const getNumeroProcessoAtual = () => {
    const numeroRaw = String(form.numero || processo?.numero || "").trim();
    const cnjMatch = numeroRaw.match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/);
    return cnjMatch ? cnjMatch[0] : numeroRaw;
  };

  const handleSave = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (form.status === "encerrado" && !String(form.motivo_encerramento || "").trim()) {
      if (!silent) toast.error("Informe o motivo do encerramento antes de salvar.");
      return;
    }
    // Validação mínima para criação
    if (isNovo) {
      const numeroRaw = String(form.numero || "").trim();
      if (!numeroRaw || numeroRaw.replace(/\D/g, "").length < 5) {
        if (!silent) toast.error("Informe o número do processo antes de salvar.");
        return;
      }
      if (!String(form.area || "").trim()) {
        if (!silent) toast.error("Selecione a área do processo antes de salvar.");
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      for (const f of FIELDS) {
        const v = form[f];
        if (BOOLEAN_FIELDS.has(f)) {
          payload[f] = Boolean(v);
        } else if (NUMERIC_FIELDS.has(f)) {
          payload[f] = v === "" || v == null ? null : Number(v);
        } else {
          payload[f] = v === "" || v == null ? null : v;
        }
      }

      if (isNovo) {
        // Modo criação: INSERT e redireciona para a página do novo processo.
        payload.numero = String(form.numero || "").trim();
        // Remove chaves nulas para permitir que os DEFAULTs do banco
        // preencham colunas NOT NULL (impactante, status, acompanhamento_*,
        // monitorar_andamentos, judit_campos, etc.).
        for (const k of Object.keys(payload)) {
          if (payload[k] === null || payload[k] === undefined) delete payload[k];
        }
        const { data: novo, error: errInsert } = await supabase
          .from("processos")
          .insert(payload as any)
          .select("id")
          .single();
        if (errInsert) throw errInsert;

        if (responsaveis.length > 0 && novo?.id) {
          const inserts = responsaveis.map((r: any) => ({
            processo_id: novo.id,
            usuario_id: r.usuario_id,
            coordenacao_id: r.coordenacao_id || null,
            papel: r.papel || "responsavel",
            ativo: true,
          }));
          await supabase
            .from("processos_responsaveis")
            .insert(inserts as any);
        }

        await queryClient.invalidateQueries({ queryKey: ["processos"] });
        if (!silent) toast.success("Processo criado com sucesso!");
        navigate(`/processos/${novo.id}`, { replace: true });
        return;
      }

      const { data: updated, error } = await supabase
        .from("processos")
        .update(payload as any)
        .eq("id", processo.id)
        .select("id");
      if (error) throw error;
      // Se nenhuma linha voltou, o banco recusou a gravação (permissão) —
      // não podemos exibir "salvo com sucesso" nesse caso.
      if (!updated || updated.length === 0) {
        throw new Error("Nenhuma alteração foi gravada (sem permissão para editar este processo).");
      }

      {
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
        if (inserts.length > 0) {
          const { error: errResp } = await supabase
            .from("processos_responsaveis")
            .upsert(inserts as any, { onConflict: "processo_id,usuario_id" });
          if (errResp) throw errResp;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["processo"] });
      await queryClient.invalidateQueries({ queryKey: ["processos-responsaveis"] });
      if (!silent) toast.success("Processo atualizado com sucesso!");
    } catch (err: any) {
      if (!silent) toast.error("Erro ao salvar: " + err.message);
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
  const handleSyncJudit = async (comAnexos: boolean = false, forceRefresh: boolean = false) => {
    const numeroLimpo = getNumeroProcessoAtual();
    if (!numeroLimpo) {
      toast.warning("Processo sem número CNJ cadastrado.");
      return;
    }
    // Extrai o CNJ "limpo" do campo numero — alguns processos têm texto
    // extra (ex.: "0010996-92.2021.5.15.0094 (transitou em julgado...)") que,
    // se enviado bruto, quebra o cache de anexos (a chave processo_numero
    // fica diferente da chave usada pela aba "Anexos Judit").
    if (comAnexos) setSyncingAnexos(true); else setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-judit", {
        body: {
          numero_processo: numeroLimpo,
          tribunal: "TST",
          com_anexos: comAnexos,
          force_refresh: forceRefresh || comAnexos,
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
   * Consulta Judit apenas para alimentar a aba "Análise Judit" (e opcionalmente
   * a aba "Anexos"). NÃO altera o formulário nem grava em `processos` /
   * `processos_partes`. O preenchimento do formulário só acontece quando o
   * usuário clicar em "Preencher formulário" dentro da Análise Judit.
   */
  const handleFetchJuditOnly = async (comAnexos: boolean = false, forceRefresh: boolean = false) => {
    const numeroLimpo = getNumeroProcessoAtual();
    if (!numeroLimpo) {
      toast.warning("Processo sem número CNJ cadastrado.");
      return;
    }
    if (comAnexos) setSyncingAnexos(true); else setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-judit", {
        body: {
          numero_processo: numeroLimpo,
          tribunal: "TST",
          com_anexos: comAnexos,
          force_refresh: forceRefresh || comAnexos,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      const veioDoCache = (data as any)?._judit_meta?.respondido_do_cache === true;
      if (veioDoCache) {
        toast.success("Judit (cache) — atualizando em segundo plano");
      }

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;

      // Logs (alimenta a aba Análise Judit). No modo "novo processo" ainda
      // não existe processo.id — nesse caso pulamos consultas_judit (que
      // exige processo_id) e alimentamos apenas judit_logs (chaveado por
      // processo_numero).
      if (processo?.id) {
        await supabase.from("consultas_judit").insert({
          processo_id: processo.id,
          requisitada_em: new Date().toISOString(),
          status_http: 200,
          payload_resposta: data,
          erro: null,
        });
      }
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

      // Persiste anexos quando solicitado
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

      if (processo?.id) {
        await queryClient.invalidateQueries({ queryKey: ["consultas_judit", processo.id] });
      }
      await queryClient.invalidateQueries({ queryKey: ["judit_logs", numeroLimpo] });
      toast.success("Consulta Judit concluída. Veja a aba Análise Judit.");
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
  const handleSyncJuditInterno = async (
    comAnexos: boolean = false,
    forceRefresh: boolean = false,
    presetData: any = null,
    noNetwork: boolean = false,
  ) => {
    const numeroLimpo = getNumeroProcessoAtual();
    if (!numeroLimpo) {
      toast.warning("Processo sem número CNJ cadastrado.");
      return false;
    }
    // No fluxo "Preencher formulário" (noNetwork) não existe consulta à Judit —
    // portanto não ativamos os estados que exibem a barra de progresso, para
    // não dar a impressão de uma segunda consulta.
    if (!noNetwork) {
      if (comAnexos) setSyncingAnexos(true); else setSyncingInterno(true);
    }
    try {
      // Reaproveita a última resposta Judit gravada em judit_logs para este CNJ,
      // evitando pagar uma nova consulta quando já existe resultado recente.
      // Só busca de novo se `forceRefresh` estiver marcado OU se o usuário pediu
      // com anexos e a última consulta não tinha anexos.
      let data: any = null;
      let fromCache = false;
      // 1) Se veio payload pré-carregado (ex.: da aba Análise Judit), usa direto — SEM chamar Judit.
      if (presetData && typeof presetData === "object") {
        data = presetData;
        fromCache = true;
        toast.info("Reaproveitando consulta Judit já exibida (sem nova cobrança).");
      }
      if (!data && !forceRefresh) {
        try {
          const { data: cachedRows } = await supabase
            .from("judit_logs" as any)
            .select("raw_response, request_payload, created_at")
            .in("processo_numero", obterVariantesCnjBusca(numeroLimpo))
            .order("created_at", { ascending: false })
            .limit(10);
          // Pega o log mais recente que realmente tenha payload. Se algum
          // deles trouxer anexos e o usuário pediu com anexos, prioriza esse.
          const comPayload = ((cachedRows as any[]) || []).filter((l) => l?.raw_response);
          const comAtts = comPayload.find(
            (l) => Array.isArray(l.raw_response?.attachments) && l.raw_response.attachments.length > 0,
          );
          const raw: any = (comAnexos && comAtts ? comAtts : comPayload[0])?.raw_response;
          const hadAtts = Array.isArray(raw?.attachments) && raw.attachments.length > 0;
          if (raw && (!comAnexos || hadAtts)) {
            data = raw;
            fromCache = true;
            toast.info("Reaproveitando última consulta Judit (sem nova cobrança).");
          } else if (raw && comAnexos && !hadAtts) {
            // Só falta anexos — reusa o payload para preencher e evita chamada nova.
            data = raw;
            fromCache = true;
            toast.info("Reaproveitando consulta Judit (sem anexos) — sem nova cobrança.");
          }
        } catch (e) {
          console.warn("[preencher] cache-lookup falhou:", (e as Error)?.message);
        }
      }
      // 3) Último recurso sem custo: payload gravado em consultas_judit.
      if (!data && !forceRefresh && processo?.id) {
        try {
          const { data: consulta } = await supabase
            .from("consultas_judit")
            .select("payload_resposta, requisitada_em")
            .eq("processo_id", processo.id)
            .order("requisitada_em", { ascending: false })
            .limit(1)
            .maybeSingle();
          const payload: any = (consulta as any)?.payload_resposta;
          if (payload) {
            data = payload;
            fromCache = true;
            toast.info("Reaproveitando consulta Judit registrada (sem nova cobrança).");
          }
        } catch (e) {
          console.warn("[preencher] consultas_judit lookup falhou:", (e as Error)?.message);
        }
      }
      if (!data) {
        // Fluxo "Preencher formulário": nunca dispara uma nova consulta paga.
        if (noNetwork) {
          toast.error(
            "Nenhuma consulta Judit disponível para reaproveitar. Clique no botão Judit para fazer uma consulta.",
          );
          return false;
        }
        const resp = await supabase.functions.invoke("judit-processo-interno", {
          body: { numero_processo: numeroLimpo, force_refresh: true, with_attachments: comAnexos },
        });
        if (resp.error) throw resp.error;
        if ((resp.data as any)?.error) { toast.error((resp.data as any).error); return false; }
        data = resp.data;
      }

      const next: Record<string, any> = { ...form };
      const filled = new Set<string>(juditSessionFields);
      const apply = (field: string, value: any) => {
        if (value !== null && value !== undefined && String(value).trim() !== "") {
          next[field] = value;
          filled.add(field);
        }
      };
      apply("numero", numeroLimpo);
      for (const f of FIELDS) apply(f, (data as any)[f]);

      // ---- Aliases / campos derivados da Judit -------------------------------
      // Preenchem apenas quando o advogado ainda não digitou nada no campo.
      const applyIfEmpty = (field: string, value: any) => {
        const atual = next[field];
        const vazio = atual === null || atual === undefined || String(atual).trim() === "";
        if (vazio) apply(field, value);
      };
      const d: any = data || {};
      const partesJudit = Array.isArray(d.parties_detail) ? d.parties_detail : [];
      const nomesPorTipo = (re: RegExp) =>
        [...new Set(
          partesJudit
            .filter((p: any) => !p?.is_advogado && re.test(String(p?.tipo_pessoa || "")))
            .map((p: any) => String(p?.nome || "").trim())
            .filter(Boolean),
        )].join(" / ");
      const reclamanteJ =
        (d.reclamante && String(d.reclamante).trim()) ||
        nomesPorTipo(/RECLAMANTE|AUTOR|EXEQUENTE|REQUERENTE/i) ||
        "";
      const reclamadaJ =
        (d.reclamada && String(d.reclamada).trim()) ||
        (d.reclamados && String(d.reclamados).trim()) ||
        nomesPorTipo(/RECLAMAD|R[ÉE]U|EXECUTAD|REQUERID/i) ||
        "";
      applyIfEmpty("reclamante", reclamanteJ);
      applyIfEmpty("reclamados", reclamadaJ);
      applyIfEmpty("polo_ativo", reclamanteJ);
      applyIfEmpty("polo_passivo", reclamadaJ);
      applyIfEmpty("tribunal", d.tribunal || d.tribunal_acronimo);
      applyIfEmpty("classe", d.classe_capa || d.classe);
      applyIfEmpty("orgao_julgador", d.orgao_julgador);
      applyIfEmpty("assunto", d.assunto);
      applyIfEmpty("comarca", d.comarca);
      applyIfEmpty("vara", d.vara);
      applyIfEmpty("uf", d.uf);
      applyIfEmpty("instancia", d.instancia);
      applyIfEmpty("data_distribuicao", d.data_distribuicao || d.distribution_date);
      applyIfEmpty("valor_causa", d.valor_causa);
      applyIfEmpty("fase", d.fase || d.situacao_processo);
      applyIfEmpty("status", d.status_processo);
      // Quando a Judit retornou tribunal, marcamos o processo como Judicial.
      if (data?.tribunal || data?.tribunal_acronimo) {
        apply("tipo_processo", "judicial");
      }
      setForm(next);
      setJuditSessionFields(filled);
      if (isNovo) onNumeroChange?.(String(next.numero || numeroLimpo));

      if (isNovo) {
        if (!fromCache) {
          try {
            const { data: userData } = await supabase.auth.getUser();
            await supabase.from("judit_logs" as any).insert({
              processo_numero: numeroLimpo,
              tribunal: data?.tribunal || null,
              request_payload: { numero_processo: numeroLimpo, fonte: "judit-processo-interno", with_attachments: comAnexos },
              raw_response: data,
              status: "sucesso",
              error_message: null,
              created_by: userData?.user?.id || null,
          });
            await queryClient.invalidateQueries({ queryKey: ["judit_logs", numeroLimpo] });
          } catch (_) { /* noop */ }
        }
        const preenchidos = filled.size;
        toast.success(`Judit recuperada e formulário preenchido — ${preenchidos} campo(s).`);
        return true;
      }

      // Persiste
      const updatePayload: Record<string, any> = {};
      for (const f of FIELDS) {
        const v = next[f];
        if (NUMERIC_FIELDS.has(f)) updatePayload[f] = v === "" || v == null ? null : Number(v);
        else updatePayload[f] = v === "" || v == null ? null : v;
      }
      (updatePayload as any).judit_campos = Array.from(filled);
      await supabase.from("processos").update(updatePayload as any).eq("id", processo.id);

      // Log (só quando fizemos uma nova chamada paga)
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      if (!fromCache) {
        try {
          await supabase.from("judit_logs" as any).insert({
            processo_numero: numeroLimpo,
            tribunal: data?.tribunal || null,
            request_payload: { numero_processo: numeroLimpo, fonte: "judit-processo-interno", with_attachments: comAnexos },
            raw_response: data,
            status: "sucesso",
            error_message: null,
            created_by: uid,
        });
        } catch (_) { /* noop */ }
      }

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

      // Persiste anexos quando solicitado (mesma lógica do "Judit c/ anexos" anterior)
      if (comAnexos) {
        const atts = Array.isArray((data as any)?.attachments) ? (data as any).attachments : [];
        if (atts.length > 0) {
          try {
            const rowsRaw = atts.map((a: any) => ({
              processo_numero: numeroLimpo,
              cnj: a?.cnj || numeroLimpo,
              instance: a?.instance != null ? String(a.instance) : null,
              attachment_id: String(a?.attachment_id || a?.step_id || ""),
              step_id: a?.step_id ? String(a.step_id) : null,
              attachment_name: a?.attachment_name || null,
              attachment_date: a?.attachment_date || null,
              extension: a?.extension || null,
              status: a?.status || "done",
              corrupted: a?.corrupted ?? false,
              raw_attachment: a?.raw || a,
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
      await queryClient.invalidateQueries({ queryKey: ["processo", processo.id] });
      const preenchidos = filled.size;
      toast.success(`${comAnexos ? "Judit c/ anexos" : "Judit"} sincronizada — ${preenchidos} campo(s) do processo preenchido(s).`);
      return true;
    } catch (e: any) {
      toast.error(`Erro Judit ${comAnexos ? "c/ anexos" : "Interno"}: ` + (e?.message || "desconhecido"));
      return false;
    } finally {
      if (!noNetwork) {
        if (comAnexos) setSyncingAnexos(false); else setSyncingInterno(false);
      }
    }
  };

  const handleJuditButtonClick = async () => {
    if (isNovo) {
      const ok = await handleSyncJuditInterno(comAnexosJudit, true);
      if (ok) {
        setJuditNovoCardVisible(true);
        onJuditNovoPreenchido?.();
      }
      return;
    }

    await handleFetchJuditOnly(comAnexosJudit);
    onNavigate?.("analise-judit");
  };

  const copy = (t: string) => navigator.clipboard.writeText(t);

  const inputCls = "h-9 text-sm";
  // Classe verde aplicada a inputs cujo campo foi preenchido pela Judit na sessão.
  const jcls = (field: string) =>
    juditSessionFields.has(field) && form[field] !== "" && form[field] != null
      ? "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
      : "";
  const isAdmin = useMemo(() => processo?.tipo_processo === "administrativo", [processo?.tipo_processo]);

  useImperativeHandle(ref, () => ({
    save: handleSave,
    preencherFormularioJudit: async (comAnexos = false, presetData: any = null) => {
      // noNetwork = true → só reaproveita o payload já exibido / o último log.
      await handleSyncJuditInterno(comAnexos, false, presetData, true);
    },
  }), [handleSave, handleSyncJuditInterno, form, responsaveis, processo?.id]);

  // Modo "actionsOnly": renderiza apenas a barra de botões Judit (sem Save)
  if (actionsOnly) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={handleJuditButtonClick}
          disabled={juditBusy || saving}
          className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {juditBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {juditBusy
            ? (juditElapsed < 3 ? "Consultando Judit…" : `Aguardando… ${juditElapsed}s`)
            : "Judit"}
        </Button>
        {podeUsarAnexosJudit && (
<label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none px-1" title="Inclui a lista de anexos do processo (consulta Judit mais cara).">
          <Checkbox
            checked={comAnexosJudit}
            onCheckedChange={(v) => setComAnexosJudit(v === true)}
            disabled={juditBusy || saving}
          />
          Com anexos
        </label>
)}
        {onNavigate && (
          <Button size="sm" variant="outline" onClick={() => onNavigate("anexos-judit")} className="gap-1">
            <Paperclip className="w-4 h-4 text-emerald-600" />
            Anexos Judit
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg md:text-xl font-semibold text-foreground leading-tight">
                    {(form.polo_ativo || form.reclamante || "—")} <span className="text-muted-foreground font-normal">X</span> {(form.polo_passivo || form.reclamados || "—")}
                  </h1>
                  {form.impactante && (
                    <Badge className="bg-red-600 hover:bg-red-700 text-white gap-1 border-0">
                      <Flame className="w-3 h-3" /> Impactante
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                {processo?.numero && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-foreground/70">Processo:</span>
                    <span className="font-mono underline-offset-2 underline text-foreground">{processo.numero}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copy(processo.numero)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                {(processo?.cliente?.nome || processo?.nome_cliente_envolvido) && (
                  <div><span className="font-medium text-foreground/70">Cliente:</span> <span className="text-foreground">{processo.cliente?.nome || processo.nome_cliente_envolvido}</span></div>
                )}
                {form.status && (
                  <div><span className="font-medium text-foreground/70">Status:</span> <span className="text-foreground capitalize">{String(form.status).replace(/_/g, " ")}</span></div>
                )}
                {processo?.advogado_responsavel?.nome && (
                  <div><span className="font-medium text-foreground/70">Responsável:</span> <span className="text-foreground">{processo.advogado_responsavel.nome}</span></div>
                )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant={form.impactante ? "default" : "outline"}
                  onClick={() => update("impactante", !form.impactante)}
                  className={cn(
                    "gap-1",
                    form.impactante
                      ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                      : "text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  )}
                  title={form.impactante ? "Remover marcação Impactante" : "Marcar como Impactante"}
                >
                  <Flame className="w-4 h-4" />
                  {form.impactante ? "Impactante" : "Impactante"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1">
                      <Plus className="w-4 h-4" /> Adicionar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onAddItem ? onAddItem("tarefa") : setNovaTarefaOpen(true)}>
                      <ListTodo className="w-4 h-4 mr-2" /> Tarefa
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onAddItem ? onAddItem("prazo") : setNovoPrazoOpen(true)}>
                      <Clock className="w-4 h-4 mr-2" /> Prazo
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onAddItem ? onAddItem("evento") : setNovoEventoOpen(true)}>
                      <CalendarDays className="w-4 h-4 mr-2" /> Evento
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onAddItem ? onAddItem("audiencia") : setCriarAudienciaOpen(true)}>
                      <Gavel className="w-4 h-4 mr-2" /> Audiência
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  size="sm"
                  onClick={handleJuditButtonClick}
                  disabled={juditBusy || saving}
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  title={isNovo ? "Consultar Judit e preencher o formulário" : "Consultar Judit (sem alterar o formulário)"}
                >
                  {juditBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {juditBusy
                    ? (juditElapsed < 3 ? "Judit…" : `${juditElapsed}s`)
                    : "Judit"}
                </Button>
                {podeUsarAnexosJudit && (
<label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none" title="Inclui a lista de anexos do processo (consulta Judit mais cara).">
                  <Checkbox
                    checked={comAnexosJudit}
                    onCheckedChange={(v) => setComAnexosJudit(v === true)}
                    disabled={juditBusy || saving}
                  />
                  Com anexos
                </label>
)}
                <Button size="sm" onClick={() => handleSave()} disabled={saving || juditBusy}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4 md:p-6 space-y-6">
          {/* Cabeçalho do form — apenas botões de ação */}
          {!hideJuditButtons && (
          <div className="flex items-center justify-end gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={handleJuditButtonClick}
                disabled={juditBusy || saving}
                className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {juditBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {juditBusy
                  ? (juditElapsed < 3 ? "Consultando Judit…" : `Aguardando crawler… ${juditElapsed}s`)
                  : "Judit"}
              </Button>
              {podeUsarAnexosJudit && (
<label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none px-1" title="Inclui a lista de anexos do processo (consulta Judit mais cara).">
                <Checkbox
                  checked={comAnexosJudit}
                  onCheckedChange={(v) => setComAnexosJudit(v === true)}
                  disabled={juditBusy || saving}
                />
                Com anexos
              </label>
)}
              {onNavigate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate("anexos-judit")}
                  className="gap-1"
                >
                  <Paperclip className="w-4 h-4 text-emerald-600" />
                  Anexos Judit
                </Button>
              )}
          </div>
          )}

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

          {isNovo && juditNovoCardVisible && !juditBusy && (
            <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Informações Judit recuperadas e formulário preenchido.</p>
                  <p className="text-sm">Clique no menu esquerdo em <strong>Análise Judit</strong> para ver todas as informações recuperadas da consulta.</p>
                </div>
              </div>
            </div>
          )}

          {compact && (
            <div className="text-xs text-muted-foreground">
              Use os botões acima para sincronizar/atualizar os dados Judit. Para editar campos do processo, volte para a aba "Resumo".
            </div>
          )}

          {!compact && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUNA PRINCIPAL */}
            <div className="lg:col-span-2 space-y-6">
              {/* Identificação */}
              <section>
                <SectionHeader icon={FileText} title="Identificação" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {isNovo && (
                    <FormField label="Número do Processo *" className="md:col-span-2">
                      <Input
                        className={inputCls}
                        placeholder="0000000-00.0000.0.00.0000"
                        value={form.numero || ""}
                        onChange={(e) => {
                          update("numero", e.target.value);
                          onNumeroChange?.(e.target.value);
                        }}
                        onBlur={(e) => onNumeroChange?.(e.target.value)}
                      />
                    </FormField>
                  )}
                  <FormField label="Objeto da ação (assunto)" className="md:col-span-2">
                    <Textarea
                      rows={3}
                      className={cn("text-sm min-h-[72px] resize-y overflow-hidden", jcls("assunto"))}
                      value={form.assunto || ""}
                      onChange={(e) => {
                        update("assunto", e.target.value);
                        const el = e.currentTarget;
                        el.style.height = "auto";
                        el.style.height = el.scrollHeight + "px";
                      }}
                      ref={(el) => {
                        if (el) {
                          el.style.height = "auto";
                          el.style.height = el.scrollHeight + "px";
                        }
                      }}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = "auto";
                        el.style.height = el.scrollHeight + "px";
                      }}
                    />
                  </FormField>
                  <FormField label="Tipo de Processo">
                    <Select value={form.tipo_processo || "judicial"} onValueChange={(v) => update("tipo_processo", v)}>
                      <SelectTrigger className={cn(inputCls, jcls("tipo_processo"))}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="judicial">Judicial</SelectItem>
                        <SelectItem value="administrativo">Administrativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Situação">
                    <Select value={form.status || "ativo"} onValueChange={(v) => update("status", v)}>
                      <SelectTrigger className={cn(inputCls, jcls("status"))}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="arquivado_parcialmente">Arquivado Parcialmente</SelectItem>
                        <SelectItem value="arquivado_definitivamente">Arquivado Definitivamente</SelectItem>
                        <SelectItem value="suspenso">Suspenso</SelectItem>
                        <SelectItem value="encerrado">Encerrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  {form.status === "encerrado" && (
                    <FormField label="Encerrado em (data e hora)">
                      <Input
                        readOnly
                        className={cn(inputCls, "bg-muted/40")}
                        value={(() => {
                          const dh = (processo as any)?.data_hora_encerramento;
                          const d = (processo as any)?.data_encerramento;
                          if (dh) {
                            return new Date(dh).toLocaleString("pt-BR", {
                                day: "2-digit", month: "2-digit", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              });
                          }
                          if (d) return new Date(String(d) + "T00:00:00").toLocaleDateString("pt-BR");
                          return "—";
                        })()}
                      />
                    </FormField>
                  )}
                  {form.status === "encerrado" && (
                    <FormField label="Motivo do Encerramento *" className="md:col-span-2">
                      <Textarea
                        rows={2}
                        required
                        placeholder="Descreva o motivo do encerramento (obrigatório)"
                        className={cn(
                          "text-sm min-h-[60px]",
                          !String(form.motivo_encerramento || "").trim() && "border-destructive focus-visible:ring-destructive"
                        )}
                        value={form.motivo_encerramento || ""}
                        onChange={(e) => update("motivo_encerramento", e.target.value)}
                      />
                    </FormField>
                  )}
                  <FormField label="Classe CNJ">
                    <Input className={cn(inputCls, jcls("classe"))} value={form.classe || ""} onChange={(e) => update("classe", e.target.value)} />
                  </FormField>
                  <FormField label="Natureza">
                    <Input className={cn(inputCls, jcls("natureza"))} value={form.natureza || ""} onChange={(e) => update("natureza", e.target.value)} />
                  </FormField>
                  <FormField label="Área">
                    <Input className={cn(inputCls, jcls("area"))} value={form.area || ""} onChange={(e) => update("area", e.target.value)} />
                  </FormField>
                  <FormField label="Coordenação Responsável">
                    <Select
                      value={form.coordenacao_id || "__none__"}
                      onValueChange={(v) => update("coordenacao_id", v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger className={cn(inputCls, jcls("coordenacao_id"))}>
                        <SelectValue placeholder="Selecione a coordenação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        {(coordenacoesTarefa as any[]).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Fase Processual">
                    {(() => {
                      const FASES = ["Conhecimento", "Instrutória", "Recursal", "Execução"];
                      const isPreset = FASES.includes(form.fase || "");
                      const isOutros = !!form.fase && !isPreset;
                      const selectValue = isPreset ? form.fase : (isOutros ? "__outros__" : "");
                      return (
                        <div className="space-y-1.5">
                          <Select
                            value={selectValue}
                            onValueChange={(v) => {
                              if (v === "__outros__") update("fase", form.fase && !isPreset ? form.fase : " ");
                              else update("fase", v);
                            }}
                          >
                            <SelectTrigger className={cn(inputCls, jcls("fase"))}><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {FASES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                              <SelectItem value="__outros__">+ Outros</SelectItem>
                            </SelectContent>
                          </Select>
                          {(selectValue === "__outros__" || isOutros) && (
                            <Input
                              className={cn(inputCls, jcls("fase"))}
                              placeholder="Digite a fase"
                              value={isPreset ? "" : (form.fase || "").trim()}
                              onChange={(e) => update("fase", e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })()}
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
                    <Input className={cn(inputCls, jcls("justica"))} value={form.justica || ""} onChange={(e) => update("justica", e.target.value)} />
                  </FormField>
                  <FormField label="Instância">
                    <Select value={form.instancia || ""} onValueChange={(v) => update("instancia", v)}>
                      <SelectTrigger className={cn(inputCls, jcls("instancia"))}><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1ª Instância">1ª Instância</SelectItem>
                        <SelectItem value="2ª Instância">2ª Instância</SelectItem>
                        <SelectItem value="STJ">STJ</SelectItem>
                        <SelectItem value="TST">TST</SelectItem>
                        <SelectItem value="STF">STF</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <Textarea
                      rows={2}
                      className={cn("text-sm min-h-[50px] resize-y overflow-hidden", jcls("terceiro_envolvido"))}
                      value={form.terceiro_envolvido || ""}
                      onChange={(e) => update("terceiro_envolvido", e.target.value)}
                      ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                      onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                    />
                  </FormField>
                  <FormField label="Pedidos" className="md:col-span-2">
                    <Textarea
                      rows={3}
                      className={cn("text-sm min-h-[60px] resize-y overflow-hidden", jcls("pedidos"))}
                      value={form.pedidos || ""}
                      onChange={(e) => update("pedidos", e.target.value)}
                      ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                      onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                    />
                  </FormField>
                  <FormField label="Responsáveis" className="md:col-span-2">
                    <SelecionarResponsaveisProcesso
                      processoId={processo.id}
                      value={responsaveis}
                      onChange={setResponsaveis}
                    />
                  </FormField>
                  <FormField label="Empresa Terceirizada">
                    <Input className={cn(inputCls, jcls("empresa_terceirizada"))} value={form.empresa_terceirizada || ""} onChange={(e) => update("empresa_terceirizada", e.target.value)} />
                  </FormField>
                  <FormField label="Segredo de Justiça">
                    <div className="flex items-center gap-2 h-9">
                      <Checkbox
                        checked={!!form.segredo_justica}
                        onCheckedChange={(c) => update("segredo_justica", c === true)}
                      />
                      <span className="text-sm text-muted-foreground">Processo em segredo de justiça</span>
                    </div>
                  </FormField>
                  <FormField label="Processos Relacionados" className="md:col-span-2">
                    <Textarea
                      rows={2}
                      className={cn("text-sm min-h-[50px] resize-y overflow-hidden", jcls("processos_relacionados"))}
                      value={form.processos_relacionados || ""}
                      onChange={(e) => update("processos_relacionados", e.target.value)}
                      ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                      onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                    />
                  </FormField>
                </div>
              </section>

              {/* Testemunhas */}
              {!isNovo && processo?.id && (
                <section>
                  <TestemunhasSection processoId={processo.id} />
                </section>
              )}

              {/* Datas */}
              <section>
                <SectionHeader icon={Activity} title="Datas Processuais" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="Distribuição">
                    <Input type="date" className={cn(inputCls, jcls("data_distribuicao"))} value={form.data_distribuicao || ""} onChange={(e) => update("data_distribuicao", e.target.value)} />
                  </FormField>
                  <FormField label="Recebimento">
                    <Input type="date" className={cn(inputCls, jcls("data_recebimento"))} value={form.data_recebimento || ""} onChange={(e) => update("data_recebimento", e.target.value)} />
                  </FormField>
                  <FormField label="Citação">
                    <Input type="date" className={cn(inputCls, jcls("data_citacao"))} value={form.data_citacao || ""} onChange={(e) => update("data_citacao", e.target.value)} />
                  </FormField>
                </div>
              </section>

              {/* Financeiro */}
              <section>
                <SectionHeader icon={DollarSign} title="Financeiro e Contingenciamento" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="Valor da Causa">
                    <CurrencyInputBRL className={cn(inputCls, jcls("valor_causa"))} value={form.valor_causa ?? ""} onChange={(v) => update("valor_causa", v)} />
                  </FormField>
                  <FormField label="Valor da Condenação">
                    <CurrencyInputBRL className={inputCls} value={form.valor_condenacao ?? ""} onChange={(v) => update("valor_condenacao", v)} />
                  </FormField>
                  <FormField label="Valor Provisionado">
                    <CurrencyInputBRL className={inputCls} value={form.valor_provisionado ?? ""} onChange={(v) => update("valor_provisionado", v)} />
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
              {isNovo ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Salve o processo para habilitar Pendências, Depósitos Recursais e Custas Processuais.
                </div>
              ) : (
                <>
                  <PendenciasProcessoCard
                    audiencias={audiencias}
                    intimacoes={intimacoes}
                    tarefas={tarefas}
                    movimentacoes={movimentacoes}
                    eventosAgenda={eventosAgenda}
                    processoId={processo?.id}
                    processoNumero={processo?.numero}
                    onNavigate={onNavigate}
                  />
                  <DepositosRecursaisCard processoId={processo.id} />
                  <CustasProcessuaisCard processoId={processo.id} />
                </>
              )}

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
          )}
        </CardContent>
      </Card>
      {!compact && (
        <div className="flex flex-wrap items-center gap-6 px-4 py-3 border-t text-sm">
          <div className="w-full">
            <AcompanhamentoEspecialToggle
              processoId={processo.id}
              acompanhamentoEspecial={!!(processo as any).acompanhamento_especial}
              frequenciaDiaria={(processo as any).acompanhamento_freq_diaria ?? 1}
              comAnexos={!!(processo as any).acompanhamento_com_anexos}
            />
          </div>
        </div>
      )}
      {!onAddItem && processo?.id && processo?.numero && (
        <CriarAudienciaProcessoDialog
          open={criarAudienciaOpen}
          onOpenChange={setCriarAudienciaOpen}
          processoId={processo.id}
          processoNumero={processo.numero}
        />
      )}
      {!onAddItem && processo?.id && (
        <>
          <EventoDialog
            open={novoEventoOpen}
            onOpenChange={setNovoEventoOpen}
            evento={null}
            defaultProcessoId={processo.id}
          />
          <PrazoDialog
            open={novoPrazoOpen}
            onOpenChange={setNovoPrazoOpen}
            prazo={null}
            defaultProcessoId={processo.id}
          />
          <NovaTarefaDialog
            open={novaTarefaOpen}
            onOpenChange={setNovaTarefaOpen}
            coordenacoes={coordenacoesTarefa as any}
            processoPreSelecionado={{ id: processo.id, numero: processo.numero }}
          />
        </>
      )}
    </div>
  );
});