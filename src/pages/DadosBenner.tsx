import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FileSpreadsheet, Send, RefreshCw, Loader2, Trash2, CheckCircle, ExternalLink, AlertTriangle, Search, Scale, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DadosBennerImport } from "@/components/benner/DadosBennerImport";
import { useDadosBenner, DadoBenner, DadosBennerFilters } from "@/hooks/useDadosBenner";
import { DadosBennerForm } from "@/components/benner/DadosBennerForm";
import { DadosBennerDetail } from "@/components/benner/DadosBennerDetail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { gerarPlanilhaBenner, ResultadoGeracaoBenner, ExportModeBenner } from "@/utils/gerarPlanilhaBenner";
import { gerarPdfBenner } from "@/utils/gerarPdfBenner";

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  pronto_envio: "Pronto p/ Enviar",
  planilhado: "Planilhado",
  enviado: "Enviado",
};

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  pronto_envio: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  planilhado: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  enviado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

interface TransitoResult {
  numero: string;
  situacao: string;
  confianca: number;
  data_transito: string | null;
  reconciliacao: string | null;
  erro: string | null;
}

interface TipoRecursoResult {
  numero: string;
  tipo_recurso: string | null;
  fonte: string | null;
  erro: string | null;
}

export default function DadosBenner() {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [filterRelator, setFilterRelator] = useState("");
  const [filterDossie, setFilterDossie] = useState("");
  const [filterProcesso, setFilterProcesso] = useState("");
  const [filterTurma, setFilterTurma] = useState("");
  const [filterTipoRecurso, setFilterTipoRecurso] = useState("");
  const [filterTemPauta, setFilterTemPauta] = useState(false);
  const [filterTemDistribuicao, setFilterTemDistribuicao] = useState(false);
  const [filterSituacao, setFilterSituacao] = useState("todos");
  const [appliedFilters, setAppliedFilters] = useState<DadosBennerFilters>({ status: "todos" });
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<DadoBenner | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [gerando, setGerando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoGeracaoBenner | null>(null);
  const [exportMode, setExportMode] = useState<ExportModeBenner>("full");

  const { dados, loading, saveDado, deleteDado, updateStatus, fetchDados, page, setPage, totalPages, totalCount, fetchAllIds, fetchAllData } = useDadosBenner(appliedFilters);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const applyFilters = () => {
    setAppliedFilters({
      status: statusFilter,
      relator: filterRelator.trim() || undefined,
      dossie: filterDossie.trim() || undefined,
      processo: filterProcesso.trim() || undefined,
      turma: filterTurma.trim() || undefined,
      tipo_recurso: filterTipoRecurso.trim() || undefined,
      tem_pauta: filterTemPauta || undefined,
      tem_distribuicao: filterTemDistribuicao || undefined,
      situacao_processo: filterSituacao !== "todos" ? filterSituacao : undefined,
    });
  };

  const clearFilters = () => {
    setStatusFilter("todos");
    setFilterRelator("");
    setFilterDossie("");
    setFilterProcesso("");
    setFilterTurma("");
    setFilterTipoRecurso("");
    setFilterTemPauta(false);
    setFilterTemDistribuicao(false);
    setFilterSituacao("todos");
    setAppliedFilters({ status: "todos" });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const [loadingSelectAll, setLoadingSelectAll] = useState(false);

  const toggleAll = async () => {
    if (selectedIds.size === totalCount && totalCount > 0) {
      setSelectedIds(new Set());
    } else {
      setLoadingSelectAll(true);
      try {
        const allIds = await fetchAllIds();
        setSelectedIds(new Set(allIds));
      } finally {
        setLoadingSelectAll(false);
      }
    }
  };

  const handleGerarComResultado = async (registros: DadoBenner[], atualizarStatus?: string, mode?: ExportModeBenner) => {
    setGerando(true);
    setUltimoResultado(null);
    try {
      const resultado = await gerarPlanilhaBenner(registros, mode || exportMode);
      setUltimoResultado(resultado);
      if (atualizarStatus && resultado.totalValidos > 0) {
        const idsValidos = registros.filter(d => !resultado.rejeitados.some(r => r.id === d.id)).map(d => d.id);
        if (idsValidos.length) await updateStatus(idsValidos, atualizarStatus);
      }
      if (resultado.totalRejeitados > 0) {
        toast.warning(`${resultado.totalRejeitados} registro(s) rejeitado(s) por dossiê inválido`);
      }
      if (resultado.totalValidos > 0) {
        toast.success(`Planilha gerada com ${resultado.totalValidos} registros válidos!`);
      } else {
        toast.error("Nenhum registro válido para gerar planilha. Todos possuem dossiê inválido.");
      }
    } finally {
      setGerando(false);
    }
  };

  const handleGerarPlanilhaFiltrada = async (mode?: ExportModeBenner) => {
    setGerando(true);
    try {
      const allData = await fetchAllData();
      if (!allData.length) {
        toast.warning("Nenhum registro encontrado com os filtros aplicados");
        setGerando(false);
        return;
      }
      await handleGerarComResultado(allData, undefined, mode);
    } catch (err: any) {
      toast.error("Erro ao gerar planilha: " + (err?.message || "Erro desconhecido"));
      setGerando(false);
    }
  };

  const handleGerarPlanilha = async () => {
    const prontos = dados.filter(d => d.status === "pronto_envio");
    if (!prontos.length) { toast.warning("Nenhum registro pronto para enviar"); return; }
    await handleGerarComResultado(prontos, "planilhado");
  };

  const handleRegerarPlanilhados = async () => {
    let filtrados = dados.filter(d => d.status === "planilhado");
    if (periodoInicio) filtrados = filtrados.filter(d => d.created_at >= periodoInicio);
    if (periodoFim) filtrados = filtrados.filter(d => d.created_at <= periodoFim + "T23:59:59");
    if (!filtrados.length) { toast.warning("Nenhum registro planilhado no período"); return; }
    await handleGerarComResultado(filtrados);
  };

  const handleRegerarProntos = async () => {
    const prontos = dados.filter(d => d.status === "pronto_envio");
    if (!prontos.length) { toast.warning("Nenhum registro pronto para enviar"); return; }
    await handleGerarComResultado(prontos);
  };

  const handleGerarPdf = async () => {
    setGerandoPdf(true);
    try {
      const allData = await fetchAllData();
      if (!allData.length) {
        toast.warning("Nenhum registro encontrado para gerar PDF");
        return;
      }
      const filtroLabel = appliedFilters.situacao_processo || "Todos";
      gerarPdfBenner(allData, filtroLabel);
      toast.success(`PDF gerado com ${allData.length} registro(s)`);
    } catch (err: any) {
      toast.error("Erro ao gerar PDF: " + (err?.message || "Erro desconhecido"));
    } finally {
      setGerandoPdf(false);
    }
  };

  const handleMarcarPronto = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) { toast.warning("Selecione registros para marcar como pronto"); return; }
    await updateStatus(ids, "pronto_envio");
    setSelectedIds(new Set());
  };

  const handleMarcarEnviado = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) { toast.warning("Selecione registros para marcar como enviado"); return; }
    await updateStatus(ids, "enviado");
    setSelectedIds(new Set());
  };

  const handleDelete = async (id: string) => {
    if (confirm("Excluir este registro?")) {
      await deleteDado(id);
    }
  };

  const [verificandoTransito, setVerificandoTransito] = useState(false);
  const [transitoResults, setTransitoResults] = useState<TransitoResult[]>([]);
  const [showTransitoDialog, setShowTransitoDialog] = useState(false);
  const [transitoProgressText, setTransitoProgressText] = useState("");
  const [transitoProgressPct, setTransitoProgressPct] = useState(0);
  const cancelTransitoRef = useRef(false);

  // Tipo Recurso states
  const [verificandoTipoRecurso, setVerificandoTipoRecurso] = useState(false);
  const [tipoRecursoResults, setTipoRecursoResults] = useState<TipoRecursoResult[]>([]);
  const [showTipoRecursoDialog, setShowTipoRecursoDialog] = useState(false);
  const [tipoRecursoProgressText, setTipoRecursoProgressText] = useState("");
  const [tipoRecursoProgressPct, setTipoRecursoProgressPct] = useState(0);
  const cancelTipoRecursoRef = useRef(false);

  const handleVerificarTransito = async () => {
    setVerificandoTransito(true);
    setTransitoResults([]);
    setShowTransitoDialog(true);
    setTransitoProgressText("Buscando todos os registros filtrados...");
    setTransitoProgressPct(0);
    cancelTransitoRef.current = false;

    try {
      const currentSelected = new Set(selectedIdsRef.current);
      const useSelected = currentSelected.size > 0;
      let allRecords: { id: string; processo: string }[] = [];

      if (useSelected) {
        const selectedArr = Array.from(currentSelected);
        for (let i = 0; i < selectedArr.length; i += 200) {
          const batch = selectedArr.slice(i, i + 200);
          const { data } = await supabase
            .from("dados_benner" as any)
            .select("id, processo")
            .in("id", batch);
          if (data) allRecords.push(...(data as any[]));
        }
      } else {
        let offset = 0;
        while (true) {
          let query = supabase.from("dados_benner" as any).select("id, processo").order("created_at", { ascending: false });
          if (appliedFilters.status && appliedFilters.status !== "todos") query = query.eq("status", appliedFilters.status);
          if (appliedFilters.relator) query = query.ilike("relator", `%${appliedFilters.relator}%`);
          if (appliedFilters.dossie) query = query.ilike("dossie", `%${appliedFilters.dossie}%`);
          if (appliedFilters.processo) query = query.ilike("processo", `%${appliedFilters.processo}%`);
          if (appliedFilters.turma) query = query.ilike("turma", `%${appliedFilters.turma}%`);
          if (appliedFilters.tipo_recurso) query = query.ilike("tipo_recurso", `%${appliedFilters.tipo_recurso}%`);
          const { data, error } = await query.range(offset, offset + 999);
          if (error || !data?.length) break;
          allRecords.push(...(data as any[]));
          if (data.length < 1000) break;
          offset += 1000;
        }
      }

      const validRecords = allRecords.filter(r => {
        const num = (r.processo || "").replace(/[^0-9]/g, "");
        return num.length >= 10;
      });

      if (!validRecords.length) {
        toast.warning("Nenhum registro com número de processo válido encontrado");
        setShowTransitoDialog(false);
        setVerificandoTransito(false);
        return;
      }

      setTransitoProgressText(`0 de ${validRecords.length} verificados...`);

      // Process with controlled parallelism of 2
      const CONCURRENCY = 2;
      const allResults: TransitoResult[] = [];
      let completed = 0;

      const statusMap: Record<string, string> = {
        transitado: "Trânsito em Julgado",
        transitado_execucao: "Trânsito em Julgado (Execução)",
        ativo: "Ativo",
        inconclusivo: "Inconclusivo",
      };

      const situacaoMap: Record<string, string> = {
        transitado: "Trânsito em Julgado",
        transitado_execucao: "Trânsito em Julgado (Execução)",
        ativo: "Ativo",
        inconclusivo: "Inconclusivo",
      };

      const processRecord = async (record: { id: string; processo: string }) => {
        if (cancelTransitoRef.current) return;

        try {
          const { data, error } = await supabase.functions.invoke("check-transito", {
            body: { numeroProcesso: record.processo },
          });

          if (error) {
            allResults.push({
              numero: record.processo, situacao: "Erro", confianca: 0,
              data_transito: null, reconciliacao: null, erro: error.message,
            });
          } else {
            const situacao = situacaoMap[data?.status] || data?.status || "Erro";
            const result: TransitoResult = {
              numero: record.processo,
              situacao,
              confianca: data?.confianca ?? 0,
              data_transito: data?.dataTransito ? new Date(data.dataTransito).toLocaleDateString("pt-BR") : null,
              reconciliacao: data?.detalhes?.reconciliacao || null,
              erro: null,
            };
            allResults.push(result);

            // Update dados_benner.situacao_processo + confianca + data_transito
            const dbSituacao = statusMap[data?.status] || null;
            if (dbSituacao) {
              const updatePayload: any = {
                situacao_processo: dbSituacao,
                confianca_transito: data?.confianca ?? null,
                data_transito_julgado: data?.dataTransito ? new Date(data.dataTransito).toISOString().split("T")[0] : null,
                notas: data?.nota || null,
              };
              await supabase.from("dados_benner" as any)
                .update(updatePayload)
                .eq("id", record.id);
            }
          }
        } catch (err: any) {
          allResults.push({
            numero: record.processo, situacao: "Erro", confianca: 0,
            data_transito: null, reconciliacao: null, erro: err?.message || "Erro",
          });
        }

        completed++;
        setTransitoResults([...allResults]);
        const pct = Math.round((completed / validRecords.length) * 100);
        setTransitoProgressPct(pct);
        setTransitoProgressText(`${completed} de ${validRecords.length} verificados...`);
      };

      // Execute with parallelism of CONCURRENCY
      for (let i = 0; i < validRecords.length; i += CONCURRENCY) {
        if (cancelTransitoRef.current) {
          toast.info(`Verificação cancelada. ${allResults.length} processo(s) já verificados.`);
          break;
        }
        const batch = validRecords.slice(i, i + CONCURRENCY);
        await Promise.allSettled(batch.map(processRecord));
      }

      if (!cancelTransitoRef.current) {
        const transitos = allResults.filter(r => r.situacao.startsWith("Trânsito")).length;
        const ativos = allResults.filter(r => r.situacao === "Ativo").length;
        const inconclusivos = allResults.filter(r => r.situacao === "Inconclusivo").length;
        const erros = allResults.filter(r => r.situacao === "Erro").length;
        toast.success(`Verificação concluída: ${transitos} trânsito(s), ${ativos} ativo(s), ${inconclusivos} inconclusivo(s), ${erros} erro(s)`);
      }

      setTransitoProgressText("");
      fetchDados();
    } catch (err: any) {
      toast.error("Erro ao verificar: " + (err?.message || "Erro desconhecido"));
      setShowTransitoDialog(false);
    } finally {
      setVerificandoTransito(false);
    }
  };

  const handleAtualizarTipoRecurso = async () => {
    setVerificandoTipoRecurso(true);
    setTipoRecursoResults([]);
    setShowTipoRecursoDialog(true);
    setTipoRecursoProgressText("Buscando registros sem tipo de recurso...");
    setTipoRecursoProgressPct(0);
    cancelTipoRecursoRef.current = false;

    try {
      let allRecords: { id: string; processo: string }[] = [];
      let offset = 0;
      while (true) {
        let query = supabase.from("dados_benner" as any)
          .select("id, processo")
          .or("tipo_recurso.is.null,tipo_recurso.eq.")
          .order("created_at", { ascending: false });
        if (appliedFilters.status && appliedFilters.status !== "todos") query = query.eq("status", appliedFilters.status);
        if (appliedFilters.relator) query = query.ilike("relator", `%${appliedFilters.relator}%`);
        if (appliedFilters.dossie) query = query.ilike("dossie", `%${appliedFilters.dossie}%`);
        if (appliedFilters.processo) query = query.ilike("processo", `%${appliedFilters.processo}%`);
        if (appliedFilters.turma) query = query.ilike("turma", `%${appliedFilters.turma}%`);
        if (appliedFilters.tipo_recurso) query = query.ilike("tipo_recurso", `%${appliedFilters.tipo_recurso}%`);
        const { data, error } = await query.range(offset, offset + 999);
        if (error || !data?.length) break;
        allRecords.push(...(data as any[]));
        if (data.length < 1000) break;
        offset += 1000;
      }

      const validRecords = allRecords.filter(r => {
        const num = (r.processo || "").replace(/[^0-9]/g, "");
        return num.length >= 10;
      });

      if (!validRecords.length) {
        toast.warning("Nenhum registro sem tipo de recurso com número de processo válido");
        setShowTipoRecursoDialog(false);
        setVerificandoTipoRecurso(false);
        return;
      }

      setTipoRecursoProgressText(`0 de ${validRecords.length} verificados...`);

      const BATCH_SIZE = 5;
      const allResults: TipoRecursoResult[] = [];

      for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
        if (cancelTipoRecursoRef.current) {
          toast.info(`Busca cancelada. ${allResults.length} processo(s) já verificados.`);
          break;
        }

        const batch = validRecords.slice(i, i + BATCH_SIZE);
        const processos = batch.map(r => r.processo!);
        const idsBenner = batch.map(r => r.id);

        try {
          const { data, error } = await supabase.functions.invoke("atualizar-tipo-recurso-datajud", {
            body: { processos, ids_benner: idsBenner },
          });

          if (error) {
            batch.forEach(b => allResults.push({
              numero: b.processo!, tipo_recurso: null, fonte: null, erro: error.message,
            }));
          } else {
            const resultados: TipoRecursoResult[] = data?.resultados || [];
            allResults.push(...resultados);
          }
        } catch (err: any) {
          batch.forEach(b => allResults.push({
            numero: b.processo!, tipo_recurso: null, fonte: null, erro: err?.message || "Erro",
          }));
        }

        setTipoRecursoResults([...allResults]);
        const processed = Math.min(i + BATCH_SIZE, validRecords.length);
        const pct = Math.round((processed / validRecords.length) * 100);
        setTipoRecursoProgressPct(pct);
        setTipoRecursoProgressText(`${processed} de ${validRecords.length} verificados...`);
      }

      if (!cancelTipoRecursoRef.current) {
        const encontrados = allResults.filter(r => r.tipo_recurso).length;
        const erros = allResults.filter(r => !r.tipo_recurso).length;
        toast.success(`Concluído: ${encontrados} tipo(s) encontrado(s), ${erros} sem resultado`);
      }

      setTipoRecursoProgressText("");
      fetchDados();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Erro desconhecido"));
      setShowTipoRecursoDialog(false);
    } finally {
      setVerificandoTipoRecurso(false);
    }
  };

  if (editando) {
    return (
      <MainLayout title="Dados Benner">
        <div className="max-w-5xl mx-auto">
          <DadosBennerDetail
            dado={editando}
            onSave={saveDado}
            onCancel={() => setEditando(null)}
          />
        </div>
      </MainLayout>
    );
  }

  if (showForm) {
    return (
      <MainLayout title="Dados Benner">
        <div className="max-w-4xl mx-auto">
          <DadosBennerForm
            dado={null}
            onSave={saveDado}
            onCancel={() => setShowForm(false)}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dados Benner">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Dados Benner</h1>
          <div className="flex gap-2">
            <DadosBennerImport onImported={fetchDados} />
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Cadastro
            </Button>
            <Link to="/distribuicao-tst">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" /> Distribuição TST
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setAppliedFilters(prev => ({ ...prev, status: v })); }}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="pronto_envio">Pronto p/ Enviar</SelectItem>
                <SelectItem value="planilhado">Planilhado</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Situação</Label>
            <Select value={filterSituacao} onValueChange={(v) => { setFilterSituacao(v); setAppliedFilters(prev => ({ ...prev, situacao_processo: v !== "todos" ? v : undefined })); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Trânsito em Julgado">Trânsito em Julgado</SelectItem>
                <SelectItem value="Inconclusivo">Inconclusivo</SelectItem>
                <SelectItem value="Erro">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dossiê</Label>
            <Input placeholder="Buscar dossiê..." value={filterDossie} onChange={e => setFilterDossie(e.target.value)} className="w-[140px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nº Processo</Label>
            <Input placeholder="Buscar processo..." value={filterProcesso} onChange={e => setFilterProcesso(e.target.value)} className="w-[140px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Relator</Label>
            <Input placeholder="Buscar relator..." value={filterRelator} onChange={e => setFilterRelator(e.target.value)} className="w-[140px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Turma</Label>
            <Input placeholder="Buscar turma..." value={filterTurma} onChange={e => setFilterTurma(e.target.value)} className="w-[120px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo Recurso</Label>
            <Input placeholder="Buscar tipo..." value={filterTipoRecurso} onChange={e => setFilterTipoRecurso(e.target.value)} className="w-[140px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Checkbox id="filter-pauta" checked={filterTemPauta} onCheckedChange={(v) => setFilterTemPauta(!!v)} />
            <Label htmlFor="filter-pauta" className="text-xs cursor-pointer">Tem Pauta</Label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Checkbox id="filter-dist" checked={filterTemDistribuicao} onCheckedChange={(v) => setFilterTemDistribuicao(!!v)} />
            <Label htmlFor="filter-dist" className="text-xs cursor-pointer">Tem Distribuição</Label>
          </div>
          <Button variant="outline" size="sm" onClick={applyFilters}>
            <Search className="w-4 h-4 mr-1" /> Filtrar
          </Button>
          {(filterRelator || filterDossie || filterProcesso || filterTurma || filterTipoRecurso || filterTemPauta || filterTemDistribuicao || filterSituacao !== "todos") && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
          )}
        </div>

        {/* Ações */}
        {selectedIds.size > 0 && (
          <p className="text-sm text-muted-foreground">{selectedIds.size} registro(s) selecionado(s) de {totalCount}</p>
        )}
        <div className="flex flex-wrap gap-3 items-end">
          <Button variant="outline" onClick={handleGerarPlanilha} disabled={gerando}>
            {gerando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Gerar Planilha (Prontos)
          </Button>

          <Button onClick={() => handleGerarPlanilhaFiltrada("full")} disabled={gerando}>
            {gerando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Completa (A-AH)
          </Button>

          <Button variant="outline" onClick={() => handleGerarPlanilhaFiltrada("aq")} disabled={gerando}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Até Recurso (A-Q)
          </Button>

          <Button variant="outline" onClick={() => handleGerarPlanilhaFiltrada("ag")} disabled={gerando}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Até Análise (A-G)
          </Button>

          <Button variant="secondary" onClick={() => handleGerarPlanilhaFiltrada("conferencia")} disabled={gerando}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Conferência
          </Button>

          <Button variant="outline" onClick={handleMarcarPronto} disabled={selectedIds.size === 0}>
            <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Pronto
          </Button>

          <Button variant="outline" onClick={handleMarcarEnviado} disabled={selectedIds.size === 0}>
            <Send className="w-4 h-4 mr-2" /> Marcar como Enviado
          </Button>

          <Button
            variant="outline"
            onClick={handleVerificarTransito}
            disabled={verificandoTransito}
          >
            {verificandoTransito ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Scale className="w-4 h-4 mr-2" />}
            Verificar Trânsito {selectedIds.size > 0 ? `(${selectedIds.size})` : "(Todos)"}
          </Button>

          <Button
            variant="outline"
            onClick={handleAtualizarTipoRecurso}
            disabled={verificandoTipoRecurso}
          >
            {verificandoTipoRecurso ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            Atualizar Tipo Recurso
          </Button>

          <Button variant="outline" onClick={handleGerarPdf} disabled={gerandoPdf}>
            {gerandoPdf ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
            Gerar PDF
          </Button>

          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className="w-[150px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className="w-[150px]" />
            </div>
            <Button variant="outline" size="sm" onClick={handleRegerarPlanilhados}>
              <RefreshCw className="w-4 h-4 mr-1" /> Regerar Planilhados
            </Button>
            <Button variant="outline" size="sm" onClick={handleRegerarProntos}>
              <RefreshCw className="w-4 h-4 mr-1" /> Regerar Prontos
            </Button>
          </div>
        </div>

        {/* Resultado da última geração */}
        {ultimoResultado && ultimoResultado.totalRejeitados > 0 && (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>{ultimoResultado.totalValidos}</strong> registro(s) exportado(s) com sucesso.{" "}
              <strong>{ultimoResultado.totalRejeitados}</strong> registro(s) rejeitado(s) por dossiê inválido/não localizado 
              — arquivo de rejeições baixado separadamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabela */}
        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={totalCount > 0 && selectedIds.size === totalCount} onCheckedChange={toggleAll} disabled={loadingSelectAll} />
                </TableHead>
                <TableHead>Dossiê</TableHead>
                <TableHead>Nº Processo</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead>Tipo Recurso</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Relator</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead>Data Trânsito</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={15} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
              ) : dados.map(d => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditando(d)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{d.dossie || "-"}</TableCell>
                  <TableCell>{d.processo || "-"}</TableCell>
                  <TableCell>{d.tribunal || "-"}</TableCell>
                  <TableCell className={`text-xs ${(d as any).tipo_recurso_auto ? "bg-yellow-100 dark:bg-yellow-900/30" : ""}`}>{d.tipo_recurso || "-"}</TableCell>
                  <TableCell>{d.turma || "-"}</TableCell>
                  <TableCell>{d.relator || "-"}</TableCell>
                  <TableCell>
                    {(d as any).situacao_processo ? (
                      <Badge variant={(d as any).situacao_processo?.includes("Trânsito") ? "destructive" : "outline"} className="text-xs">
                        {(d as any).situacao_processo}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(d as any).confianca_transito != null ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className={`text-xs ${(d as any).confianca_transito >= 90 ? "border-green-500 text-green-700" : (d as any).confianca_transito >= 70 ? "border-yellow-500 text-yellow-700" : "border-orange-500 text-orange-700"}`}>
                            {(d as any).confianca_transito}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          <p className="font-medium mb-1">Fonte: DataJud/CNJ</p>
                          {(d as any).confianca_transito >= 90
                            ? "Alta confiança (código CNJ 848). Pode não ser visível no PJE público."
                            : (d as any).confianca_transito >= 70
                            ? "Confiança moderada. Confirmação manual recomendada."
                            : "Baixa confiança. Confirmação manual fortemente recomendada."}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {(d as any).data_transito_julgado
                      ? new Date((d as any).data_transito_julgado + "T12:00:00").toLocaleDateString("pt-BR")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={(d as any).notas || ""}>
                    {(d as any).notas || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[d.status] || ""}>{statusLabels[d.status] || d.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(d.created_at), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              {totalCount} registro(s) — Página {page + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Próxima <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Dialog Transito em Julgado */}
        <Dialog open={showTransitoDialog} onOpenChange={setShowTransitoDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Verificação de Trânsito em Julgado
              </DialogTitle>
            </DialogHeader>

            {(verificandoTransito || transitoProgressText) && (
              <div className="space-y-3 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">{transitoProgressText}</span>
                  </div>
                  {verificandoTransito && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { cancelTransitoRef.current = true; }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                <Progress value={transitoProgressPct} className="h-2" />
              </div>
            )}

            {transitoResults.length > 0 && (
              <div className="space-y-4">
                <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground">
                  <strong>Fonte:</strong> API Pública DataJud/CNJ — Os dados refletem registros internos dos tribunais e podem incluir eventos administrativos não visíveis na consulta pública do PJE. Em caso de divergência, recomenda-se confirmação manual via PJE ou certidão.
                </div>

                <div className="flex gap-4 text-sm">
                  <Badge variant="destructive">
                    {transitoResults.filter(r => r.situacao.startsWith("Trânsito")).length} Trânsito em Julgado
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                    {transitoResults.filter(r => r.situacao === "Ativo").length} Ativo(s)
                  </Badge>
                  <Badge variant="secondary">
                    {transitoResults.filter(r => r.situacao === "Inconclusivo").length} Inconclusivo(s)
                  </Badge>
                  <Badge variant="secondary">
                    {transitoResults.filter(r => r.situacao === "Erro").length} Erro(s)
                  </Badge>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Processo</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Confiança</TableHead>
                      <TableHead>Data Trânsito</TableHead>
                      <TableHead>Reconciliação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transitoResults.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{r.numero}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.situacao.startsWith("Trânsito") ? "destructive" :
                              r.situacao === "Ativo" ? "outline" :
                              r.situacao === "Inconclusivo" ? "secondary" : "secondary"
                            }
                            className={r.situacao === "Ativo" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" : ""}
                          >
                            {r.situacao}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.confianca > 0 && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className={`text-xs ${r.confianca >= 90 ? "border-green-500 text-green-700" : r.confianca >= 70 ? "border-yellow-500 text-yellow-700" : "border-orange-500 text-orange-700"}`}>
                                  {r.confianca}%
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                {r.confianca >= 90
                                  ? "Alta confiança — Código CNJ 848 detectado. Pode não ser visível no PJE público."
                                  : r.confianca >= 70
                                  ? "Confiança moderada — Confirmação manual recomendada via PJE ou certidão."
                                  : "Baixa confiança — Detecção por análise textual. Confirmação manual fortemente recomendada."}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>{r.data_transito || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.reconciliacao || r.erro || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog Tipo Recurso */}
        <Dialog open={showTipoRecursoDialog} onOpenChange={setShowTipoRecursoDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Atualizar Tipo de Recurso via DataJud
              </DialogTitle>
            </DialogHeader>

            {(verificandoTipoRecurso || tipoRecursoProgressText) && (
              <div className="space-y-3 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">{tipoRecursoProgressText}</span>
                  </div>
                  {verificandoTipoRecurso && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { cancelTipoRecursoRef.current = true; }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                <Progress value={tipoRecursoProgressPct} className="h-2" />
              </div>
            )}

            {tipoRecursoResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    {tipoRecursoResults.filter(r => r.tipo_recurso).length} Encontrado(s)
                  </Badge>
                  <Badge variant="secondary">
                    {tipoRecursoResults.filter(r => !r.tipo_recurso).length} Não encontrado(s)
                  </Badge>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Processo</TableHead>
                      <TableHead>Tipo Recurso</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tipoRecursoResults.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{r.numero}</TableCell>
                        <TableCell className={r.tipo_recurso ? "bg-yellow-100 dark:bg-yellow-900/30 font-medium" : ""}>
                          {r.tipo_recurso || "-"}
                        </TableCell>
                        <TableCell className="text-xs">{r.fonte || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.erro || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
