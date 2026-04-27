import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Search, Save, ArrowLeft, Loader2, Download, FileDown, CheckCircle2, XCircle, AlertCircle, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DadoBenner, DadoBennerInsert } from "@/hooks/useDadosBenner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  dado?: DadoBenner | null;
  initialData?: Partial<DadoBennerInsert>;
  markExistingJuditFields?: boolean;
  onSave: (dado: DadoBennerInsert, id?: string) => Promise<boolean | string>;
  onCancel: () => void;
  /**
   * Callback chamado após o botão Judit preencher e auto-salvar com sucesso.
   * Usado pelo container (DistribuicaoTstDetail) para recarregar a aba paralela
   * "Distribuição TST" — assim os dados aparecem sincronizados sem precisar
   * clicar em Salvar manualmente.
   */
  onJuditSync?: () => void;
}

type ParteJudit = {
  nome: string;
  documento: string | null;
  tipo_pessoa: string | null;
  polo: string | null;
  is_advogado: boolean;
};

const emptyForm: DadoBennerInsert = {
  user_id: null, coordenacao_id: null, status: "rascunho",
  dossie: "", processo: "", tribunal: "", tipo_recurso: "", data_distribuicao: null,
  turma: "", relator: "", analise_quarteirizado: "", risco_midia: "",
  risco_descricao: "", provas_digitais: "", tem_data_julgamento: "",
  data_julgamento: null, horario_julgamento: "", tipo_julgamento: "",
  materia_honra: "", entrega_memoriais: "", sustentacao_oral: "",
  resultado_sem_transcendencia: false, resultado_nao_conhecido: false,
  resultado_conhecido_provido: false, resultado_conhecido_nao_provido: false,
  resultado_outra: "", observacoes: "", ganhamos: false, perdemos: false,
  processo_baixado: "", recorrente: "",
  posicao_turma_favoravel: false, posicao_turma_desfavoravel: false,
  posicao_relator_favoravel: false, posicao_relator_desfavoravel: false,
  recurso_bem_aparelhado: false, recurso_mal_aparelhado: false,
  chance_exito: "",
  tipo_recurso_auto: false,
  situacao_processo: "",
  confianca_transito: null,
  data_transito_julgado: null,
  notas: "",
  // Campos espelhados da tela "Distribuição TST" — armazenados na mesma linha de dados_benner.
  // Não há UI dedicada aqui, mas precisam viajar no payload para que o Judit consiga preencher
  // "Tipo de Recurso do Reclamante" e "Tipo de Recurso do Banco" da outra tela.
  tipo_recurso_reclamante: null,
  tipo_recurso_banco: null,
  // Campos espelhados adicionais (preenchidos pela Judit, exibidos na tela Distribuição TST).
  reclamante: null,
  reclamada: null,
  data_distribuicao_real: null,
  data_distribuicao_planilha: null,
} as any;

const inferCamposJudit = (source: Partial<DadoBennerInsert>) => {
  const filled = new Set<string>();

  if (source.dossie?.trim()) filled.add("dossie");
  if (source.tipo_recurso?.trim()) filled.add("tipo_recurso");
  if (source.data_distribuicao) filled.add("data_distribuicao");
  if (source.relator?.trim()) filled.add("relator");
  if (source.turma?.trim()) filled.add("turma");
  if (source.tribunal?.trim()) filled.add("tribunal");
  if (source.recorrente?.trim()) filled.add("recorrente");
  if (source.situacao_processo?.trim()) filled.add("situacao_processo");
  if (source.tem_data_julgamento && source.tem_data_julgamento !== "N") filled.add("tem_data_julgamento");
  if (source.data_julgamento) filled.add("data_julgamento");
  if (source.horario_julgamento?.trim()) filled.add("horario_julgamento");
  if (source.tipo_julgamento?.trim()) filled.add("tipo_julgamento");
  if (source.resultado_sem_transcendencia) filled.add("resultado_sem_transcendencia");
  if (source.resultado_nao_conhecido) filled.add("resultado_nao_conhecido");
  if (source.resultado_conhecido_provido) filled.add("resultado_conhecido_provido");
  if (source.resultado_conhecido_nao_provido) filled.add("resultado_conhecido_nao_provido");
  if (source.resultado_outra?.trim()) filled.add("resultado_outra");
  if (source.processo_baixado && source.processo_baixado !== "N") filled.add("processo_baixado");

  return filled;
};

export function DadosBennerForm({ dado, initialData, markExistingJuditFields = false, onSave, onCancel, onJuditSync }: Props) {
  const [form, setForm] = useState<DadoBennerInsert>({ ...emptyForm });
  const [prontoEnviar, setProntoEnviar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [buscandoJudit, setBuscandoJudit] = useState(false);
  const [modoTeste, setModoTeste] = useState(false);
  const [testandoPje, setTestandoPje] = useState(false);
  const [baixandoAutos, setBaixandoAutos] = useState(false);
  const [autosJobId, setAutosJobId] = useState<string | null>(null);
  const [autosProgress, setAutosProgress] = useState<{
    status: string;
    etapa: string;
    documentos_total: number;
    documentos_baixados: number;
    documentos_existentes: number;
    documentos_erro: number;
    mensagem?: string;
    erro?: string;
  } | null>(null);
  const autosPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resultadosBusca, setResultadosBusca] = useState<any[]>([]);
  const [camposJudit, setCamposJudit] = useState<Set<string>>(new Set());
  const [partesJudit, setPartesJudit] = useState<ParteJudit[]>([]);

  const carregarPartesPersistidas = useCallback(async (dadosBennerId?: string | null) => {
    if (!dadosBennerId) {
      setPartesJudit([]);
      return;
    }

    const { data, error } = await supabase
      .from("partes_processo_benner")
      .select("nome, documento, tipo_pessoa, polo, is_advogado")
      .eq("dados_benner_id", dadosBennerId)
      .eq("origem", "judit")
      .order("is_advogado", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      console.warn("Erro ao carregar partes já salvas do registro:", error);
      setPartesJudit([]);
      return;
    }

    setPartesJudit(((data as ParteJudit[] | null) || []).map((parte) => ({
      nome: parte.nome || "Sem nome",
      documento: parte.documento || null,
      tipo_pessoa: parte.tipo_pessoa || null,
      polo: parte.polo || null,
      is_advogado: Boolean(parte.is_advogado),
    })));
  }, []);

  useEffect(() => {
    if (dado) {
      const { id, created_at, updated_at, ...rest } = dado;
      setForm(rest as DadoBennerInsert);
      setProntoEnviar(dado.status === "pronto_envio");
      setCamposJudit(markExistingJuditFields ? inferCamposJudit(rest as Partial<DadoBennerInsert>) : new Set());
      void carregarPartesPersistidas(dado.id);
    } else if (initialData) {
      const nextForm = { ...emptyForm, ...initialData };
      setForm(nextForm);
      setCamposJudit(markExistingJuditFields ? inferCamposJudit(nextForm) : new Set());
      setPartesJudit([]);
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) setForm(f => ({ ...f, user_id: data.user!.id }));
      });
    } else {
      setCamposJudit(new Set());
      setPartesJudit([]);
      // Set user_id
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) setForm(f => ({ ...f, user_id: data.user!.id }));
      });
    }
  }, [dado, markExistingJuditFields, JSON.stringify(initialData), carregarPartesPersistidas]);

  // Poll progress for autos download job
  const startPolling = useCallback((jobId: string) => {
    if (autosPollingRef.current) clearInterval(autosPollingRef.current);
    autosPollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("baixar_autos_jobs")
        .select("status, etapa, documentos_total, documentos_baixados, documentos_existentes, documentos_erro, mensagem, erro")
        .eq("id", jobId)
        .single();
      if (data) {
        setAutosProgress(data as any);
        if (["concluido", "erro", "timeout"].includes(data.status)) {
          if (autosPollingRef.current) clearInterval(autosPollingRef.current);
          autosPollingRef.current = null;
          setBaixandoAutos(false);
        }
      }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (autosPollingRef.current) clearInterval(autosPollingRef.current);
    };
  }, []);

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const handleBuscarProcesso = async () => {
    if (!form.processo?.trim()) { toast.warning("Digite o número do processo"); return; }
    setBuscando(true);

    // Busca na tabela unificada dados_benner (fonte única — inclui dados de distribuição)
    const { data: dadosBenner } = await supabase
      .from("dados_benner" as any)
      .select("dossie, processo, turma, relator, tribunal, coordenacao_id, equipe, aba_origem")
      .ilike("processo" as any, `%${form.processo}%`)
      .limit(10);
    
    // Busca na tabela processos
    const { data: processos } = await supabase
      .from("processos")
      .select("id, numero, dossie_tst, turma_tst, relator_tst, coordenacao_id")
      .or(`numero.ilike.%${form.processo}%,dossie_tst.ilike.%${form.processo}%`)
      .limit(5);
    
    setBuscando(false);
    
    const resultados: any[] = [];
    if (dadosBenner && (dadosBenner as any[]).length > 0) {
      (dadosBenner as any[]).forEach((d: any) => {
        resultados.push({ tipo: "benner", processo: d.processo, dossie: d.dossie, turma: d.turma, relator: d.relator, tribunal: d.tribunal, coordenacao_id: d.coordenacao_id });
      });
    }
    if (processos && processos.length > 0) {
      processos.forEach((p: any) => {
        resultados.push({ tipo: "processo", id: p.id, numero: p.numero, dossie: p.dossie_tst, turma: p.turma_tst, relator: p.relator_tst, coordenacao_id: p.coordenacao_id });
      });
    }
    
    if (!resultados.length) { toast.info("Nenhum registro encontrado para este número de processo"); return; }
    setResultadosBusca(resultados);
  };

  const selecionarResultado = (res: any) => {
    setForm(f => ({
      ...f,
      dossie: res.dossie || f.dossie,
      turma: res.turma || f.turma,
      relator: res.relator || f.relator,
      coordenacao_id: res.coordenacao_id || f.coordenacao_id,
      tribunal: res.tribunal || f.tribunal,
    }));
    setResultadosBusca([]);
    toast.success("Dados preenchidos automaticamente!");
  };

  const executarAnaliseTransito = useCallback(async (processoNumero: string, filled: Set<string>) => {
    try {
      const { data: processoDb } = await supabase
        .from("processos")
        .select("id")
        .eq("numero", processoNumero)
        .maybeSingle();

      if (!processoDb?.id) return;

      const { data: orqData, error: orqError } = await supabase.functions.invoke(
        "orquestrador-transito",
        { body: { processo_id: processoDb.id } }
      );

      if (!orqError && orqData?.success) {
        const statusMap: Record<string, string> = {
          transitado_confirmado: "Trânsito em Julgado",
          transitado_provavel: "Trânsito em Julgado",
          em_curso: "Ativo",
        };

        const situacaoOrq = statusMap[orqData.status_transito] || null;
        if (situacaoOrq) {
          setForm(f => ({
            ...f,
            situacao_processo: situacaoOrq,
            confianca_transito: orqData.status_transito === "transitado_confirmado"
              ? 95
              : orqData.status_transito === "transitado_provavel"
                ? 70
                : null,
            data_transito_julgado: orqData.data_transito_estimada || f.data_transito_julgado,
            notas: orqData.justificativa
              ? `[Orquestrador] ${orqData.justificativa}${f.notas ? '\n' + f.notas : ''}`
              : f.notas,
          }));
          filled.add("situacao_processo");
          if (orqData.data_transito_estimada) filled.add("data_transito_julgado");
          if (orqData.status_transito !== "em_curso") filled.add("confianca_transito");
          setCamposJudit(new Set(filled));
        }

        const transitoMsg = orqData.status_transito === "transitado_confirmado"
          ? "✅ Trânsito CONFIRMADO"
          : orqData.status_transito === "transitado_provavel"
            ? "⚠️ Trânsito PROVÁVEL (decurso de prazo)"
            : "📋 Processo em curso";
        toast.success(`${transitoMsg} | ${orqData.classificadas || 0} movimentações classificadas`);
      } else if (orqError) {
        console.warn("Orquestrador erro (não-fatal):", orqError);
        toast.warning("Dados Judit preenchidos, mas análise de trânsito falhou");
      }
    } catch (error) {
      console.warn("Falha ao executar análise de trânsito em segundo plano:", error);
    }
  }, []);

  const handleBuscarJudit = async () => {
    if (!form.processo?.trim()) {
      toast.warning("Digite o número do processo primeiro");
      return;
    }

    const processoNumero = form.processo.trim();
    setBuscandoJudit(true);
    setModoTeste(false);

    try {
      // Respeita o tribunal informado no formulário; se vazio, usa TST como padrão
      // (o módulo Dados Benner é voltado para processos no TST).
      const tribunalHint = (form.tribunal && String(form.tribunal).trim()) || "TST";
      const { data, error } = await supabase.functions.invoke("buscar-judit", {
        body: { numero_processo: processoNumero, tribunal: tribunalHint },
      });

      if (error) {
        console.error("Erro Judit:", error);
        toast.error("Erro ao buscar na Judit: " + (error.message || "Erro desconhecido"));
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const tribunalMapeado = typeof data.tribunal === "string" && data.tribunal.trim()
        ? data.tribunal.trim().toUpperCase()
        : null;
      const situacaoMapeada = data.situacao_processo || null;

      const partesAtivas = Array.isArray(data.parties_detail)
        ? [...new Set(
            data.parties_detail
              .filter((p: any) => (p?.polo || "").toString().toUpperCase() === "ACTIVE" && !p?.is_advogado)
              .map((p: any) => String(p?.nome || "").trim())
              .filter(Boolean)
          )].join(" / ")
        : "";
      const partesPassivas = Array.isArray(data.parties_detail)
        ? [...new Set(
            data.parties_detail
              .filter((p: any) => (p?.polo || "").toString().toUpperCase() === "PASSIVE" && !p?.is_advogado)
              .map((p: any) => String(p?.nome || "").trim())
              .filter(Boolean)
          )].join(" / ")
        : "";
      const nextForm = {
        ...form,
        dossie: data.dossie || form.dossie,
        // Tipo de Recurso (C): formato "Reclamante - Reclamada".
        // Sobrescreve apenas se a Judit retornou algo (preserva valor manual existente).
        tipo_recurso: data.tipo_recurso || form.tipo_recurso,
        // Tipos por parte espelhados na tela Distribuição TST.
        // Só preenche se ainda estiverem vazios (não sobrescreve o que o usuário já tem).
        tipo_recurso_reclamante: data.tipo_recurso_reclamante || (form as any).tipo_recurso_reclamante || null,
        tipo_recurso_banco: data.tipo_recurso_banco || (form as any).tipo_recurso_banco || null,
        data_distribuicao: data.data_distribuicao || form.data_distribuicao,
        // Espelho para a tela "Distribuição TST".
        // data_distribuicao_real é a coluna dedicada à data vinda da Judit/manual,
        // distinta de data_distribuicao_planilha (que vem da planilha importada).
        data_distribuicao_real: data.data_distribuicao || (form as any).data_distribuicao_real || null,
        // Reclamante / Reclamada extraídos das partes (polo ativo / passivo, ignorando advogados).
        // Só preenche se estiverem vazios para preservar o que o usuário já digitou na outra tela.
        reclamante: partesAtivas || (form as any).reclamante || null,
        reclamada: partesPassivas || (form as any).reclamada || null,
        relator: data.relator || form.relator,
        turma: data.turma || form.turma,
        tribunal: tribunalMapeado || form.tribunal,
        recorrente: data.recorrente || form.recorrente,
        situacao_processo: situacaoMapeada || form.situacao_processo,
        tem_data_julgamento: data.tem_data_julgamento || form.tem_data_julgamento,
        data_julgamento: data.data_julgamento || form.data_julgamento,
        horario_julgamento: data.horario_julgamento || form.horario_julgamento,
        tipo_julgamento: data.tipo_julgamento || form.tipo_julgamento,
        resultado_sem_transcendencia: data.resultado_sem_transcendencia || form.resultado_sem_transcendencia,
        resultado_nao_conhecido: data.resultado_nao_conhecido || form.resultado_nao_conhecido,
        resultado_conhecido_provido: data.resultado_conhecido_provido || form.resultado_conhecido_provido,
        resultado_conhecido_nao_provido: data.resultado_conhecido_nao_provido || form.resultado_conhecido_nao_provido,
        resultado_outra: data.resultado_outra || form.resultado_outra,
        processo_baixado: data.processo_baixado || form.processo_baixado,
      } as DadoBennerInsert;

      setForm(nextForm);

      const filled = new Set<string>();
      if (data.dossie) filled.add("dossie");
      if (data.tipo_recurso) filled.add("tipo_recurso");
      if (data.tipo_recurso_reclamante) filled.add("tipo_recurso_reclamante");
      if (data.tipo_recurso_banco) filled.add("tipo_recurso_banco");
      if (data.data_distribuicao) filled.add("data_distribuicao");
      if (data.relator) filled.add("relator");
      if (data.turma) filled.add("turma");
      if (tribunalMapeado) filled.add("tribunal");
      if (data.recorrente) filled.add("recorrente");
      if (situacaoMapeada) filled.add("situacao_processo");
      if (data.tem_data_julgamento && data.tem_data_julgamento !== "N") filled.add("tem_data_julgamento");
      if (data.data_julgamento) filled.add("data_julgamento");
      if (data.horario_julgamento) filled.add("horario_julgamento");
      if (data.tipo_julgamento) filled.add("tipo_julgamento");
      if (data.resultado_sem_transcendencia) filled.add("resultado_sem_transcendencia");
      if (data.resultado_nao_conhecido) filled.add("resultado_nao_conhecido");
      if (data.resultado_conhecido_provido) filled.add("resultado_conhecido_provido");
      if (data.resultado_conhecido_nao_provido) filled.add("resultado_conhecido_nao_provido");
      if (data.resultado_outra) filled.add("resultado_outra");
      if (data.processo_baixado && data.processo_baixado !== "N") filled.add("processo_baixado");

      setCamposJudit(new Set(filled));

      // Capture parties_detail for display
      if (Array.isArray(data.parties_detail) && data.parties_detail.length > 0) {
        setPartesJudit(data.parties_detail);
      }

      const camposPreenchidos = [
        data.tipo_recurso && "Tipo Recurso",
        data.data_distribuicao && "Data Distribuição",
        data.relator && "Relator",
        data.turma && "Turma",
        tribunalMapeado && "Tribunal",
        data.recorrente && "Recorrente",
        situacaoMapeada && "Situação",
        data.data_julgamento && "Data Julgamento",
        data.horario_julgamento && "Horário",
        data.tipo_julgamento && "Tipo Julgamento",
        data.resultado_sem_transcendencia && "Sem Transcendência",
        data.resultado_nao_conhecido && "Não Conhecido",
        data.resultado_conhecido_provido && "Conhecido/Provido",
        data.resultado_conhecido_nao_provido && "Conhecido/Não Provido",
        data.processo_baixado === "S" && "Processo Baixado",
      ].filter(Boolean);

      if (camposPreenchidos.length > 0) {
        toast.success(`Judit: ${camposPreenchidos.length} campo(s) preenchidos — salvando automaticamente...`);
        // Auto-salva no banco para sincronizar com a aba "Distribuição TST".
        setForm(currentForm => {
          void (async () => {
            try {
              const payload = { ...currentForm, status: dado?.status === "planilhado" || dado?.status === "enviado" ? dado.status : (currentForm.status || "rascunho") } as DadoBennerInsert;
              const result = await onSave(payload, dado?.id);
              if (result) {
                toast.success("Dados Benner e Distribuição TST sincronizados com Judit");
                onJuditSync?.();
              }
            } catch (e: any) {
              console.error("Auto-save Judit falhou:", e);
            }
          })();
          return currentForm;
        });
      } else {
        toast.info("Judit: processo encontrado, mas sem dados adicionais para preencher");
      }

      setBuscandoJudit(false);
      void executarAnaliseTransito(processoNumero, filled);
      return;
    } catch (err: any) {
      console.error("Erro ao buscar Judit:", err);
      toast.error("Erro de conexão com a Judit");
    }

    setBuscandoJudit(false);
  };

  const handleTestarPje = async () => {
    if (!form.processo?.trim()) {
      toast.warning("Digite o número do processo primeiro");
      return;
    }

    const processoNumero = form.processo.trim();
    setTestandoPje(true);
    setModoTeste(true);

    try {
      const { data, error } = await supabase.functions.invoke("testar-pje-buscar-processo", {
        body: { numero_processo: processoNumero },
      });

      if (error) {
        console.error("Erro PJE:", error);
        toast.error("Erro ao consultar PJE: " + (error.message || "Erro desconhecido"));
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const tribunaisAceitos = ["TST", "STF", "STJ"];
      const tribunalMapeado = tribunaisAceitos.includes(data.tribunal) ? data.tribunal : null;

      setForm(f => ({
        ...f,
        data_distribuicao: data.data_distribuicao || f.data_distribuicao,
        relator: data.relator || f.relator,
        turma: data.turma || f.turma,
        tribunal: tribunalMapeado || f.tribunal,
      }));

      const filled = new Set<string>();
      if (data.data_distribuicao) filled.add("data_distribuicao");
      if (data.relator) filled.add("relator");
      if (data.turma) filled.add("turma");
      if (tribunalMapeado) filled.add("tribunal");

      setCamposJudit(new Set(filled));

      if (Array.isArray(data.parties_detail) && data.parties_detail.length > 0) {
        setPartesJudit(data.parties_detail);
      }

      const camposPreenchidos = [
        data.data_distribuicao && "Data Distribuição",
        data.relator && "Relator",
        data.turma && "Turma",
        tribunalMapeado && "Tribunal",
      ].filter(Boolean);

      if (camposPreenchidos.length > 0) {
        toast.success(`PJE: ${camposPreenchidos.length} campo(s) preenchidos via MNI — ${camposPreenchidos.join(", ")}`);
      } else {
        toast.info("PJE: processo encontrado, mas sem dados extraídos");
      }
    } catch (err: any) {
      console.error("Erro ao testar PJE:", err);
      toast.error("Erro de conexão com o PJE");
    } finally {
      setTestandoPje(false);
    }
  };

  const handleBaixarAutos = async () => {
    if (!form.processo?.trim()) {
      toast.warning("Digite o número do processo primeiro");
      return;
    }

    if (!dado?.id) {
      return;
    }

    setBaixandoAutos(true);
    setAutosProgress({ status: "iniciado", etapa: "Verificando autos já disponíveis...", documentos_total: 0, documentos_baixados: 0, documentos_existentes: 0, documentos_erro: 0 });
    setAutosJobId(null);

    try {
      const [activeJobResult, existingDocsResult] = await Promise.all([
        supabase
          .from("baixar_autos_jobs")
          .select("id, status, etapa, documentos_total, documentos_baixados, documentos_existentes, documentos_erro, mensagem, erro")
          .eq("processo_id", dado.id)
          .in("status", ["iniciado", "crawler", "baixando"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("processos_documentos_download")
          .select("id")
          .eq("processo_id", dado.id)
          .eq("status_download", "concluido"),
      ]);

      if (activeJobResult.data) {
        setAutosJobId(activeJobResult.data.id);
        setAutosProgress({
          status: activeJobResult.data.status,
          etapa: activeJobResult.data.etapa,
          documentos_total: activeJobResult.data.documentos_total || 0,
          documentos_baixados: activeJobResult.data.documentos_baixados || 0,
          documentos_existentes: activeJobResult.data.documentos_existentes || 0,
          documentos_erro: activeJobResult.data.documentos_erro || 0,
          mensagem: activeJobResult.data.mensagem || undefined,
          erro: activeJobResult.data.erro || undefined,
        });
        startPolling(activeJobResult.data.id);
        return;
      }

      const existingDocs = existingDocsResult.data || [];
      if (existingDocs.length > 0) {
        setBaixandoAutos(false);
        setAutosProgress({
          status: "concluido",
          etapa: `${existingDocs.length} documento(s) já disponíveis`,
          documentos_total: existingDocs.length,
          documentos_baixados: 0,
          documentos_existentes: existingDocs.length,
          documentos_erro: 0,
          mensagem: "Nenhuma nova busca foi realizada.",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("baixar-autos-judit", {
        body: { processo_id: dado.id, processo_numero: form.processo.trim() },
      });

      if (data?.job_id) {
        setAutosJobId(data.job_id);
        startPolling(data.job_id);
      } else {
        // No job_id returned - show result directly
        setBaixandoAutos(false);
        if (error || data?.error) {
          setAutosProgress({ status: "erro", etapa: "Erro", documentos_total: 0, documentos_baixados: 0, documentos_existentes: 0, documentos_erro: 0, erro: error?.message || data?.error });
        } else {
          setAutosProgress({
            status: "concluido",
            etapa: data?.mensagem || "Concluído",
            documentos_total: data?.documentos_total || 0,
            documentos_baixados: data?.documentos_baixados || 0,
            documentos_existentes: data?.documentos_existentes || 0,
            documentos_erro: data?.documentos_erro || 0,
            mensagem: data?.mensagem,
          });
        }
      }
    } catch (err: any) {
      console.error("Erro ao baixar autos:", err);
      setBaixandoAutos(false);
      setAutosProgress({ status: "erro", etapa: "Erro de conexão", documentos_total: 0, documentos_baixados: 0, documentos_existentes: 0, documentos_erro: 0, erro: "Erro de conexão ao baixar autos" });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const statusFinal = prontoEnviar ? "pronto_envio" : "rascunho";
    const toSave = { ...form, status: dado?.status === "planilhado" || dado?.status === "enviado" ? dado.status : statusFinal };
    const result = await onSave(toSave, dado?.id);
    
    // Persist parties if we have them and got a valid ID back
    if (result && partesJudit.length > 0) {
      const recordId = typeof result === "string" ? result : dado?.id;
      if (recordId) {
        // Remove old judit parties then insert new
        await supabase
          .from("partes_processo_benner")
          .delete()
          .eq("dados_benner_id", recordId)
          .eq("origem", "judit");
        
        const rows = partesJudit.map(p => ({
          dados_benner_id: recordId,
          nome: p.nome || "Sem nome",
          documento: p.documento || null,
          tipo_pessoa: p.tipo_pessoa || null,
          polo: p.polo || null,
          is_advogado: p.is_advogado || false,
          origem: "judit",
        }));
        
        await supabase.from("partes_processo_benner").insert(rows);
      }
    }
    
    setSaving(false);
    if (result) onCancel();
  };

  const SectionHeader = ({ title, color }: { title: string; color: string }) => (
    <div className={cn("px-4 py-2 rounded-t-lg font-semibold text-sm", color)}>
      {title}
    </div>
  );

  // Highlight wrapper for fields filled by Judit
  const juditHighlight = (field: string) =>
    camposJudit.has(field)
      ? (modoTeste
          ? "ring-2 ring-rose-500 bg-rose-50 dark:bg-rose-950/30 rounded-md transition-all duration-500"
          : "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 rounded-md transition-all duration-500")
      : "";

  // Highlight for fields filled by DataJud (tipo_recurso_auto)
  const datajudHighlight = (field: string) => {
    if (field === "tipo_recurso" && form.tipo_recurso_auto && !camposJudit.has(field)) {
      return "ring-2 ring-sky-500 bg-sky-50 dark:bg-sky-950/30 rounded-md transition-all duration-500";
    }
    return "";
  };

  // Combined highlight: Judit takes priority, then DataJud
  const fieldHighlight = (field: string) => juditHighlight(field) || datajudHighlight(field);

  const JuditLabel = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-1.5">
      {children}
      {camposJudit.has(field) && (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1 py-0 h-4 font-normal",
            modoTeste
              ? "border-rose-500 text-rose-600 dark:text-rose-400"
              : "border-emerald-500 text-emerald-600 dark:text-emerald-400"
          )}
        >
          {modoTeste ? "Teste" : "Judit"}
        </Badge>
      )}
      {field === "tipo_recurso" && form.tipo_recurso_auto && !camposJudit.has(field) && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-sky-500 text-sky-600 dark:text-sky-400 font-normal">
          DataJud
        </Badge>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="w-5 h-5" /></Button>
        <h2 className="text-xl font-bold text-foreground">{dado ? "Editar Registro" : "Novo Registro"}</h2>
      </div>

      {/* SEÇÃO RECURSO - Azul */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso (Colunas A-Q)" color="bg-blue-600 text-white" />
        <div className="p-4 space-y-4">
          {/* Número do Processo + Buscar */}
          <div className="space-y-2">
            <Label>Número do Processo</Label>
            <div className="flex gap-2">
              <Input value={form.processo || ""} onChange={e => set("processo", e.target.value)} placeholder="Número do processo" className="flex-1" />
              <Button variant="outline" onClick={handleBuscarProcesso} disabled={buscando}>
                {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </Button>
              <Button 
                variant="default" 
                onClick={handleBuscarJudit}
                disabled={buscandoJudit || !form.processo?.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {buscandoJudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Judit
              </Button>
              <Button
                variant="default"
                onClick={handleTestarPje}
                disabled={testandoPje || !form.processo?.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white"
                title="Consulta o PJE via MNI usando a credencial de teste do Cofre (Paixão Cortes - TST)"
              >
                {testandoPje ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Testar
              </Button>
              <Button 
                variant="default" 
                onClick={handleBaixarAutos} 
                disabled={baixandoAutos || !form.processo?.trim() || !dado?.id}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                title="Baixar documentos do processo via Judit"
              >
                {baixandoAutos ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Autos
              </Button>
            </div>
            {/* Progress de download de autos */}
            {autosProgress && (
              <div className="border border-border rounded-md p-3 space-y-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  {autosProgress.status === "concluido" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : autosProgress.status === "erro" || autosProgress.status === "timeout" ? (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  )}
                  <span className="text-sm font-medium text-foreground">{autosProgress.etapa}</span>
                </div>
                {autosProgress.documentos_total > 0 && (
                  <>
                    <Progress
                      value={((autosProgress.documentos_baixados + autosProgress.documentos_existentes + autosProgress.documentos_erro) / autosProgress.documentos_total) * 100}
                      className="h-2"
                    />
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{autosProgress.documentos_baixados} baixado(s)</span>
                      {autosProgress.documentos_existentes > 0 && <span>{autosProgress.documentos_existentes} já existente(s)</span>}
                      {autosProgress.documentos_erro > 0 && <span className="text-destructive">{autosProgress.documentos_erro} erro(s)</span>}
                      <span className="ml-auto">{autosProgress.documentos_baixados + autosProgress.documentos_existentes + autosProgress.documentos_erro}/{autosProgress.documentos_total}</span>
                    </div>
                  </>
                )}
                {autosProgress.erro && (
                  <p className="text-xs text-destructive">{autosProgress.erro}</p>
                )}
                {autosProgress.status === "concluido" && (
                  <button onClick={() => setAutosProgress(null)} className="text-xs text-muted-foreground hover:text-foreground underline">
                    Fechar
                  </button>
                )}
              </div>
            )}
            {resultadosBusca.length > 0 && (
              <div className="border border-border rounded-md p-2 space-y-1 bg-muted/50">
                <p className="text-xs text-muted-foreground font-medium">Resultados encontrados:</p>
                {resultadosBusca.map((r, i) => (
                  <button key={i} onClick={() => selecionarResultado(r)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-accent text-sm">
                    {r.tipo === "distribuicao" ? (
                      <>
                        <span className="font-medium">{r.processo}</span>
                        {r.dossie && <span className="text-muted-foreground"> - Dossiê: {r.dossie}</span>}
                        <Badge variant="outline" className="ml-2 text-xs">Distribuição TST</Badge>
                      </>
                    ) : r.tipo === "benner" ? (
                      <>
                        <span className="font-medium">Processo: {r.processo}</span>
                        {r.dossie && <span className="text-muted-foreground"> - Dossiê: {r.dossie}</span>}
                        <Badge variant="outline" className="ml-2 text-xs">Dados Benner</Badge>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{r.numero}</span>
                        {r.dossie && <span className="text-muted-foreground"> - Dossiê: {r.dossie}</span>}
                        <Badge variant="outline" className="ml-2 text-xs">Processos</Badge>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dossiê */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dossiê (A)</Label>
              <Input value={form.dossie || ""} onChange={e => set("dossie", e.target.value)} placeholder="Número do dossiê" />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("situacao_processo"))}>
              <JuditLabel field="situacao_processo"><Label>Situação do Processo</Label></JuditLabel>
              <Select value={form.situacao_processo || ""} onValueChange={v => set("situacao_processo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a situação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Trânsito em Julgado">Trânsito em Julgado</SelectItem>
                  <SelectItem value="Arquivado">Arquivado</SelectItem>
                  <SelectItem value="Suspenso">Suspenso</SelectItem>
                  <SelectItem value="Baixado">Baixado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("tribunal"))}>
              <JuditLabel field="tribunal"><Label>Tribunal (B)</Label></JuditLabel>
              <Select value={form.tribunal || ""} onValueChange={v => set("tribunal", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TST">TST</SelectItem>
                  <SelectItem value="STF">STF</SelectItem>
                  <SelectItem value="STJ">STJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Tipo Recurso (C) */}
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("tipo_recurso"))}>
              <JuditLabel field="tipo_recurso"><Label>Tipo de Recurso (C)</Label></JuditLabel>
              <Input value={form.tipo_recurso || ""} onChange={e => set("tipo_recurso", e.target.value)} />
            </div>
            {/* Data Distribuição (D) */}
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("data_distribuicao"))}>
              <JuditLabel field="data_distribuicao"><Label>Data Distribuição (D)</Label></JuditLabel>
              <Input type="date" value={form.data_distribuicao || ""} onChange={e => set("data_distribuicao", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("turma"))}>
              <JuditLabel field="turma"><Label>Turma (E)</Label></JuditLabel>
              <Input value={form.turma || ""} onChange={e => set("turma", e.target.value)} />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("relator"))}>
              <JuditLabel field="relator"><Label>Relator (F)</Label></JuditLabel>
              <Input value={form.relator || ""} onChange={e => set("relator", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Análise Quarteirizado (G)</Label>
            <Textarea
              value={form.analise_quarteirizado || ""}
              onChange={e => set("analise_quarteirizado", e.target.value)}
              rows={5}
              className="min-h-[120px] resize-y"
              placeholder="Descreva a análise do quarteirizado (pode conter várias linhas)..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Risco Mídia Negativa (H)</Label>
              <Select value={form.risco_midia || ""} onValueChange={v => set("risco_midia", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Risco (I)</Label>
              <Input value={form.risco_descricao || ""} onChange={e => set("risco_descricao", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Provas Digitais (J)</Label>
              <Select value={form.provas_digitais || ""} onValueChange={v => set("provas_digitais", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("tem_data_julgamento"))}>
              <JuditLabel field="tem_data_julgamento"><Label>Data Julgamento? (K)</Label></JuditLabel>
              <Select value={form.tem_data_julgamento || ""} onValueChange={v => set("tem_data_julgamento", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("data_julgamento"))}>
              <JuditLabel field="data_julgamento"><Label>Data Julgamento (L)</Label></JuditLabel>
              <Input type="date" value={form.data_julgamento || ""} onChange={e => set("data_julgamento", e.target.value)} />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("horario_julgamento"))}>
              <JuditLabel field="horario_julgamento"><Label>Horário (M)</Label></JuditLabel>
              <Input type="time" value={form.horario_julgamento || ""} onChange={e => set("horario_julgamento", e.target.value)} />
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("tipo_julgamento"))}>
              <JuditLabel field="tipo_julgamento"><Label>Tipo Julgamento (N)</Label></JuditLabel>
              <Select value={form.tipo_julgamento || ""} onValueChange={v => set("tipo_julgamento", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                  <SelectItem value="Telepresencial">Telepresencial</SelectItem>
                  <SelectItem value="Híbrido">Híbrido</SelectItem>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Matéria de Honra (O)</Label>
              <Select value={form.materia_honra || ""} onValueChange={v => set("materia_honra", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entrega Memoriais (P)</Label>
              <Select value={form.entrega_memoriais || ""} onValueChange={v => set("entrega_memoriais", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sustentação Oral (Q)</Label>
              <Select value={form.sustentacao_oral || ""} onValueChange={v => set("sustentacao_oral", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                  <SelectItem value="Não cabe">Não cabe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO RESULTADO - Verde */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Resultado (Colunas R-W)" color="bg-green-600 text-white" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              ["resultado_sem_transcendencia", "Sem Transcendência (R)"],
              ["resultado_nao_conhecido", "Não Conhecido (S)"],
              ["resultado_conhecido_provido", "Conhecido e Provido (T)"],
              ["resultado_conhecido_nao_provido", "Conhecido e Não Provido (U)"],
            ] as const).map(([field, label]) => (
              <div key={field} className={cn("flex items-center gap-2 p-2 -m-2 rounded-md", fieldHighlight(field))}>
                <Checkbox checked={!!form[field]} onCheckedChange={v => set(field, !!v)} id={field} />
                <JuditLabel field={field}><Label htmlFor={field} className="text-sm cursor-pointer">{label}</Label></JuditLabel>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Outra (V)</Label>
            <Input value={form.resultado_outra || ""} onChange={e => set("resultado_outra", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observações (W)</Label>
            <Textarea value={form.observacoes || ""} onChange={e => set("observacoes", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notas || ""} onChange={e => set("notas", e.target.value)} rows={3} placeholder="Anotações livres sobre este registro..." />
          </div>
        </div>
      </div>

      {/* SEÇÃO RESUMO - Amarelo */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Resumo (Colunas X-AA)" color="bg-yellow-500 text-black" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.ganhamos} onCheckedChange={v => set("ganhamos", !!v)} id="ganhamos" />
              <Label htmlFor="ganhamos" className="cursor-pointer">Ganhamos (X)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.perdemos} onCheckedChange={v => set("perdemos", !!v)} id="perdemos" />
              <Label htmlFor="perdemos" className="cursor-pointer">Perdemos (Y)</Label>
            </div>
            <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("processo_baixado"))}>
              <JuditLabel field="processo_baixado"><Label>Processo Baixado (Z)</Label></JuditLabel>
              <Select value={form.processo_baixado || ""} onValueChange={v => set("processo_baixado", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="N">N</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={cn("space-y-2 p-2 -m-2", fieldHighlight("recorrente"))}>
            <JuditLabel field="recorrente"><Label>Recorrente (AA)</Label></JuditLabel>
            <Textarea
              value={form.recorrente || ""}
              onChange={e => set("recorrente", e.target.value)}
              rows={4}
              className="font-mono text-xs whitespace-pre-wrap"
              placeholder="Ativo: ...&#10;Passivo: ..."
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO POSICIONAMENTO TURMA - Laranja */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Posicionamento Turma (AB-AC)" color="bg-orange-500 text-white" />
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.posicao_turma_favoravel} onCheckedChange={v => set("posicao_turma_favoravel", !!v)} id="ptf" />
              <Label htmlFor="ptf" className="cursor-pointer">Favorável (AB)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.posicao_turma_desfavoravel} onCheckedChange={v => set("posicao_turma_desfavoravel", !!v)} id="ptd" />
              <Label htmlFor="ptd" className="cursor-pointer">Desfavorável (AC)</Label>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO POSICIONAMENTO RELATOR - Rosa */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Posicionamento Relator (AD-AE)" color="bg-pink-500 text-white" />
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.posicao_relator_favoravel} onCheckedChange={v => set("posicao_relator_favoravel", !!v)} id="prf" />
              <Label htmlFor="prf" className="cursor-pointer">Favorável (AD)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.posicao_relator_desfavoravel} onCheckedChange={v => set("posicao_relator_desfavoravel", !!v)} id="prd" />
              <Label htmlFor="prd" className="cursor-pointer">Desfavorável (AE)</Label>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO RECURSO/CHANCE - Roxo */}
      <div className="border border-border rounded-lg overflow-hidden">
        <SectionHeader title="Recurso / Chance de Êxito (AF-AH)" color="bg-purple-600 text-white" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.recurso_bem_aparelhado} onCheckedChange={v => set("recurso_bem_aparelhado", !!v)} id="rba" />
              <Label htmlFor="rba" className="cursor-pointer">Bem Aparelhado (AF)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.recurso_mal_aparelhado} onCheckedChange={v => set("recurso_mal_aparelhado", !!v)} id="rma" />
              <Label htmlFor="rma" className="cursor-pointer">Mal Aparelhado (AG)</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Chance de Êxito (AH)</Label>
            <Select value={form.chance_exito || ""} onValueChange={v => set("chance_exito", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Possível">Possível</SelectItem>
                <SelectItem value="Provável">Provável</SelectItem>
                <SelectItem value="Remota">Remota</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* SEÇÃO PARTES - Teal */}
      {partesJudit.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <SectionHeader title={`Partes do Processo (${partesJudit.length})`} color="bg-teal-600 text-white" />
          <div className="p-4">
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Polo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partesJudit.map((p, i) => (
                    <TableRow
                      key={i}
                      className={cn(
                        p.is_advogado && "text-muted-foreground",
                        "bg-emerald-50/50 dark:bg-emerald-950/20"
                      )}
                    >
                      <TableCell className="text-xs">
                        {p.polo === "Active" ? "Ativo" : p.polo === "Passive" ? "Passivo" : p.polo || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{p.tipo_pessoa || "—"}</TableCell>
                      <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {p.documento
                          ? p.documento.length === 11
                            ? p.documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                            : p.documento.length === 14
                              ? p.documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
                              : p.documento
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Users className="w-3 h-3" /> Dados importados da Judit. Serão salvos na aba "Partes" ao gravar o registro.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <Switch checked={prontoEnviar} onCheckedChange={setProntoEnviar}
            disabled={dado?.status === "planilhado" || dado?.status === "enviado"} />
          <Label className="text-sm font-medium">Pronto para Enviar</Label>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
