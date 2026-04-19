import { useState, useEffect, useCallback, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Trash2, ExternalLink, Search, X, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileSpreadsheet, Download, Database, ArrowLeft, FileText, CheckCircle, Send } from "lucide-react";
import { DistribuicaoTstStatsCards } from "@/components/distribuicao-tst/DistribuicaoTstStatsCards";
import { useDistribuicaoTstStats } from "@/hooks/useDistribuicaoTstStats";
import { fetchAllFilteredBennerIds, fetchProcessosComPartes, gerarRelatorioPartesPdf, buildFiltrosResumo } from "@/lib/relatorioPartesPdf";
import { Checkbox } from "@/components/ui/checkbox";
import { useDistribuicoesTst, DistribuicaoTst as DistTst, DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";
import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";
import { DistribuicaoTstImport } from "@/components/distribuicao-tst/DistribuicaoTstImport";
import { DossieUpdateImport } from "@/components/distribuicao-tst/DossieUpdateImport";
import { CargaBennerFromDb } from "@/components/distribuicao-tst/CargaBennerFromDb";
import { DadosBennerForm } from "@/components/benner/DadosBennerForm";
import { DadoBenner, DadoBennerInsert } from "@/hooks/useDadosBenner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ResponsaveisSelector } from "@/components/distribuicao-tst/ResponsaveisSelector";

const favorabilidadeColor = (val: string | null) => {
  if (!val) return "secondary";
  const l = val.toLowerCase();
  if (l.includes("positiv")) return "default";
  if (l.includes("negativ")) return "destructive";
  return "secondary";
};

const getJuditPartesResumo = (juditData: any, fallback?: string | null) => {
  const parties = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];
  const nonLawyers = parties.filter((party: any) => party?.nome && !party?.is_advogado);

  const ativos = [...new Set(nonLawyers
    .filter((party: any) => String(party?.polo || "").toUpperCase() === "ACTIVE")
    .map((party: any) => String(party.nome).trim())
    .filter(Boolean))];

  const passivos = [...new Set(nonLawyers
    .filter((party: any) => String(party?.polo || "").toUpperCase() === "PASSIVE")
    .map((party: any) => String(party.nome).trim())
    .filter(Boolean))];

  const partes: string[] = [];
  if (ativos.length > 0) partes.push(`Ativo: ${ativos.join(", ")}`);
  if (passivos.length > 0) partes.push(`Passivo: ${passivos.join(", ")}`);

  if (partes.length > 0) return partes.join("\n");

  const recorrenteRaw = String(juditData?.recorrente ?? "").trim();
  if (recorrenteRaw) return recorrenteRaw;

  return fallback || "";
};


export default function DistribuicaoTst() {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<DistTst | null>(null);
  const [showCarga, setShowCarga] = useState(false);
  
  // Dados Benner form from distribuição
  const [showBennerForm, setShowBennerForm] = useState(false);
  const [bennerDado, setBennerDado] = useState<DadoBenner | null>(null);
  const [bennerPreFill, setBennerPreFill] = useState<Partial<DadoBennerInsert> | null>(null);
  const [markBennerCamposJudit, setMarkBennerCamposJudit] = useState(false);
  const [loadingBenner, setLoadingBenner] = useState<string | null>(null);
  
  // Bulk Judit
  const [bulkJuditRunning, setBulkJuditRunning] = useState(false);
  const [bulkJuditProgress, setBulkJuditProgress] = useState({ current: 0, total: 0 });
  const bulkAbortRef = useRef(false);

  // Relatório PDF de Partes
  const [pdfRunning, setPdfRunning] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });

  // Row selection for bulk Judit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [filtroAba, setFiltroAba] = useState<string>("todas");
  const [filtroBenner, setFiltroBenner] = useState<string>("todos");
  const [filtroProcesso, setFiltroProcesso] = useState("");
  const [filtroDossie, setFiltroDossie] = useState("");
  const [filtroDossieStatus, setFiltroDossieStatus] = useState<string>("todos");
  const [filtroProcessoStatus, setFiltroProcessoStatus] = useState<string>("todos");
  const [filtroTurma, setFiltroTurma] = useState("");
  const [filtroRelator, setFiltroRelator] = useState("");
  const [filtroParte, setFiltroParte] = useState("");
  const [filtroNomeParte, setFiltroNomeParte] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroMesAno, setFiltroMesAno] = useState<string>("todos");
  const [filtroJudit, setFiltroJudit] = useState<string>("todos");

  const [filtroResponsavelIds, setFiltroResponsavelIds] = useState<string[]>([]);

  // Debounced filters (inclui responsáveis para não perder o filtro ao alterar outros campos)
  const [debouncedFilters, setDebouncedFilters] = useState<DistribuicaoTstFilters>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters({
        processo: filtroProcesso || undefined,
        dossie: filtroDossie || undefined,
        turma: filtroTurma || undefined,
        relator: filtroRelator || undefined,
        parte: filtroParte || undefined,
        nomeParte: filtroNomeParte || undefined,
        aba_origem: filtroAba !== "todas" ? filtroAba : undefined,
        benner: filtroBenner as any,
        dossieStatus: filtroDossieStatus !== "todos" ? (filtroDossieStatus as any) : undefined,
        processoStatus: filtroProcessoStatus !== "todos" ? (filtroProcessoStatus as any) : undefined,
        judit: filtroJudit as any,
        mesAno: filtroMesAno !== "todos" ? filtroMesAno : undefined,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
        responsavelIds: filtroResponsavelIds.length > 0 ? filtroResponsavelIds : undefined,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [filtroProcesso, filtroDossie, filtroDossieStatus, filtroProcessoStatus, filtroTurma, filtroRelator, filtroParte, filtroNomeParte, filtroAba, filtroBenner, filtroJudit, filtroMesAno, filtroDataInicio, filtroDataFim, JSON.stringify(filtroResponsavelIds)]);

  const { dados, responsaveisMap, loading, fetchDados, saveDado, deleteDado, page, setPage, totalCount, totalPages } = useDistribuicoesTst(debouncedFilters);
  const { stats, loading: statsLoading, refetch: refetchStats } = useDistribuicaoTstStats(debouncedFilters);

  // Fetch distinct aba_origem and meses for tabs (lightweight queries)
  const [abas, setAbas] = useState<{ aba: string; count: number }[]>([]);
  const [mesesAnos, setMesesAnos] = useState<{ key: string; count: number }[]>([]);

  const fetchTabsData = useCallback(async () => {
    // Lê de dados_benner (tabela única) restringindo ao escopo de distribuições (aba_origem != null)
    const { data: abasData } = await supabase
      .from("dados_benner" as any)
      .select("aba_origem")
      .not("aba_origem", "is", null);

    if (abasData) {
      const map = new Map<string, number>();
      (abasData as any[]).forEach((d: any) => {
        if (d.aba_origem) map.set(d.aba_origem, (map.get(d.aba_origem) || 0) + 1);
      });
      setAbas([...map.entries()].map(([aba, count]) => ({ aba, count })).sort((a, b) => a.aba.localeCompare(b.aba)));
    }

    const { data: mesesData } = await supabase
      .from("dados_benner" as any)
      .select("data_distribuicao")
      .not("aba_origem", "is", null)
      .not("data_distribuicao", "is", null);

    if (mesesData) {
      const map = new Map<string, number>();
      (mesesData as any[]).forEach((d: any) => {
        if (d.data_distribuicao) {
          const key = d.data_distribuicao.slice(0, 7);
          if (key.length === 7) map.set(key, (map.get(key) || 0) + 1);
        }
      });
      setMesesAnos([...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.key.localeCompare(a.key)));
    }
  }, []);

  useEffect(() => { fetchTabsData(); }, [fetchTabsData]);

  

  const hasFilters = filtroProcesso || filtroDossie || filtroTurma || filtroRelator || filtroParte || filtroNomeParte || filtroDataInicio || filtroDataFim || filtroAba !== "todas" || filtroBenner !== "todos" || filtroMesAno !== "todos" || filtroDossieStatus !== "todos" || filtroProcessoStatus !== "todos" || filtroJudit !== "todos";

  const clearFilters = () => {
    setFiltroAba("todas");
    setFiltroBenner("todos");
    setFiltroDossieStatus("todos");
    setFiltroProcessoStatus("todos");
    setFiltroMesAno("todos");
    setFiltroJudit("todos");
    setFiltroProcesso("");
    setFiltroDossie("");
    setFiltroTurma("");
    setFiltroRelator("");
    setFiltroParte("");
    setFiltroNomeParte("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroResponsavelIds([]);
    setSelectedIds(new Set());
  };

  // Estado do card ativo (sincroniza visual + aplica filtros). Derivado dos selects.
  const activeCardKey = (() => {
    if (filtroProcessoStatus === "valido" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "processosValidos" as const;
    if (filtroProcessoStatus === "invalido" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "processosInvalidos" as const;
    if (filtroDossieStatus === "valido" && filtroProcessoStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "dossiesValidos" as const;
    if (filtroDossieStatus === "invalido" && filtroProcessoStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "dossiesInvalidos" as const;
    if (filtroDossieStatus === "nao_preenchido" && filtroProcessoStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "dossiesNaoPreenchidos" as const;
    if (filtroJudit === "sim" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroBenner === "todos") return "juditPreenchido" as const;
    if (filtroJudit === "nao" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroBenner === "todos") return "juditNaoPreenchido" as const;
    if (filtroBenner === "sim" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos") return "bennerSim" as const;
    if (filtroBenner === "nao" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos") return "bennerNao" as const;
    if (filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "total" as const;
    return null;
  })();

  const handleCardClick = (key: import("@/components/distribuicao-tst/DistribuicaoTstStatsCards").StatsCardKey) => {
    // Se já está ativo, limpa filtros desses 4 selects (volta a "Total" do escopo atual)
    const isActive = activeCardKey === key;
    // Reseta os 4 selects de classificação
    setFiltroProcessoStatus("todos");
    setFiltroDossieStatus("todos");
    setFiltroJudit("todos");
    setFiltroBenner("todos");
    setSelectedIds(new Set());
    if (isActive || key === "total") return;
    switch (key) {
      case "processosValidos": setFiltroProcessoStatus("valido"); break;
      case "processosInvalidos": setFiltroProcessoStatus("invalido"); break;
      case "dossiesValidos": setFiltroDossieStatus("valido"); break;
      case "dossiesInvalidos": setFiltroDossieStatus("invalido"); break;
      case "dossiesNaoPreenchidos": setFiltroDossieStatus("nao_preenchido"); break;
      case "juditPreenchido": setFiltroJudit("sim"); break;
      case "juditNaoPreenchido": setFiltroJudit("nao"); break;
      case "bennerSim": setFiltroBenner("sim"); break;
      case "bennerNao": setFiltroBenner("nao"); break;
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Excluir esta distribuição?")) {
      await deleteDado(id);
      fetchTabsData();
    }
  };

  const handleRefresh = () => {
    setSelectedIds(new Set());
    fetchDados();
    fetchTabsData();
    refetchStats();
  };

  const handleMarcarPronto = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) { toast.warning("Selecione registros para marcar como pronto"); return; }
    const BATCH = 200;
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const { error } = await supabase.from("dados_benner" as any).update({ status: "pronto_envio" } as any).in("id", batch);
        if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      }
      toast.success(`${ids.length} registro(s) marcado(s) como Pronto!`);
      setSelectedIds(new Set());
      handleRefresh();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    }
  };

  const handleMarcarEnviado = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) { toast.warning("Selecione registros para marcar como enviado"); return; }
    const BATCH = 200;
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const { error } = await supabase.from("dados_benner" as any)
          .update({ status: "enviado", benner_atualizado: true } as any)
          .in("id", batch);
        if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      }
      toast.success(`${ids.length} registro(s) marcado(s) como Enviado!`);
      setSelectedIds(new Set());
      handleRefresh();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    }
  };

  // Open Dados Benner form for a distribuição row
  const handleOpenBenner = async (dist: DistTst) => {
    setLoadingBenner(dist.id);
    try {
      setMarkBennerCamposJudit(!!dist.judit_preenchido);

      // Look up existing dados_benner by processo number
      const { data: existing } = await supabase
        .from("dados_benner" as any)
        .select("*")
        .eq("processo", dist.processo_numero)
        .limit(1);

      if (existing && (existing as any[]).length > 0) {
        setBennerDado((existing as any[])[0] as DadoBenner);
        setBennerPreFill(null);
      } else {
        // Pre-fill from distribuição data
        setBennerDado(null);
        setBennerPreFill({
          processo: dist.processo_numero,
          dossie: dist.dossie || "",
          turma: dist.turma || "",
          relator: dist.relator || "",
          data_distribuicao: dist.data_distribuicao_real || dist.data_distribuicao_planilha || null,
          recorrente: dist.parte_recorrente || "",
          status: "rascunho",
        });
      }
      setShowBennerForm(true);
    } catch (err) {
      setMarkBennerCamposJudit(false);
      toast.error("Erro ao buscar dados Benner");
    }
    setLoadingBenner(null);
  };

  // Save handler for Dados Benner form used from this page
  const handleSaveBenner = async (dado: DadoBennerInsert, id?: string) => {
    if (id) {
      const { error } = await supabase.from("dados_benner" as any).update(dado as any).eq("id", id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
    } else {
      const { error } = await supabase.from("dados_benner" as any).insert(dado as any);
      if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
    }
    toast.success(id ? "Registro atualizado!" : "Registro salvo!");
    return true;
  };

  // Gerar relatório PDF de partes (respeita filtros e seleção)
  const handleGerarRelatorioPdf = async () => {
    setPdfRunning(true);
    setPdfProgress({ current: 0, total: 0 });
    try {
      let ids: string[];
      if (selectedIds.size > 0) {
        ids = Array.from(selectedIds);
      } else {
        toast.info("Buscando processos filtrados...");
        ids = await fetchAllFilteredBennerIds(debouncedFilters);
      }
      if (ids.length === 0) {
        toast.info("Nenhum processo para gerar relatório.");
        setPdfRunning(false);
        return;
      }
      if (ids.length > 1500) {
        const ok = window.confirm(`O relatório terá ${ids.length} processos e pode demorar e gerar um arquivo grande. Continuar?`);
        if (!ok) { setPdfRunning(false); return; }
      }
      toast.info(`Carregando dados de ${ids.length} processo(s)...`);
      const processos = await fetchProcessosComPartes(ids, (c, t) => setPdfProgress({ current: c, total: t }));
      const filtrosResumo = buildFiltrosResumo(debouncedFilters, {
        responsaveisLabel: filtroResponsavelIds.length > 0 ? `${filtroResponsavelIds.length} selecionado(s)` : undefined,
      });
      const blob = gerarRelatorioPartesPdf(processos, filtrosResumo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `relatorio-partes-tst-${ts}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Relatório gerado com ${processos.length} processo(s).`);
    } catch (err: any) {
      toast.error("Erro ao gerar relatório: " + (err?.message || String(err)));
    } finally {
      setPdfRunning(false);
    }
  };

  const handleBulkJudit = async () => {
    bulkAbortRef.current = false;
    setBulkJuditRunning(true);

    try {
      let allProcessos: { processo_numero: string; dossie: string | null; turma: string | null; relator: string | null; data_distribuicao: string | null; parte_recorrente: string | null }[] = [];

      // If rows are selected, use only those
      if (selectedIds.size > 0) {
        allProcessos = dados.filter(d => selectedIds.has(d.id)).map(d => ({
          processo_numero: d.processo_numero,
          dossie: d.dossie,
          turma: d.turma,
          relator: d.relator,
          data_distribuicao: d.data_distribuicao_real || d.data_distribuicao_planilha,
          parte_recorrente: d.parte_recorrente,
        }));
      } else {
        // Fetch all from current filtered view
        let offset = 0;
        const FETCH_SIZE = 1000;
        while (true) {
          let q = supabase
            .from("dados_benner" as any)
            .select("processo, dossie, turma, relator, data_distribuicao, recorrente")
            .not("aba_origem", "is", null)
            .order("created_at", { ascending: false });
          
          if (debouncedFilters.aba_origem && debouncedFilters.aba_origem !== "todas") q = q.eq("aba_origem", debouncedFilters.aba_origem);
          if (debouncedFilters.benner === "sim") q = q.eq("benner_atualizado", true);
          else if (debouncedFilters.benner === "nao") q = q.or("benner_atualizado.is.null,benner_atualizado.eq.false");
          if (debouncedFilters.processo) q = q.ilike("processo", `%${debouncedFilters.processo}%`);
          if (debouncedFilters.dossie) q = q.ilike("dossie", `%${debouncedFilters.dossie}%`);
          if (debouncedFilters.turma) q = q.ilike("turma", `%${debouncedFilters.turma}%`);
          if (debouncedFilters.relator) q = q.ilike("relator", `%${debouncedFilters.relator}%`);
          if (debouncedFilters.parte) q = q.ilike("recorrente", `%${debouncedFilters.parte}%`);

          const { data, error } = await q.range(offset, offset + FETCH_SIZE - 1);
          if (error) { toast.error("Erro ao buscar processos: " + error.message); break; }
          // Mapeia para a forma esperada pelo loop abaixo
          const mapped = ((data as any[]) || []).map((d: any) => ({
            processo_numero: d.processo,
            dossie: d.dossie,
            turma: d.turma,
            relator: d.relator,
            data_distribuicao: d.data_distribuicao,
            parte_recorrente: d.recorrente,
          }));
          allProcessos = allProcessos.concat(mapped);
          if (!data || data.length < FETCH_SIZE) break;
          offset += FETCH_SIZE;
        }
      }

      // Deduplicate by processo_numero
      const seen = new Set<string>();
      const unique = allProcessos.filter(p => {
        if (!p.processo_numero || seen.has(p.processo_numero)) return false;
        seen.add(p.processo_numero);
        return true;
      });

      if (unique.length === 0) {
        toast.info("Nenhum processo encontrado");
        setBulkJuditRunning(false);
        return;
      }

      setBulkJuditProgress({ current: 0, total: unique.length });
      let successCount = 0;

      for (let i = 0; i < unique.length; i++) {
        if (bulkAbortRef.current) { toast.info("Operação cancelada"); break; }

        const proc = unique[i];
        setBulkJuditProgress({ current: i + 1, total: unique.length });

        try {
          const { data: juditData, error: juditError } = await supabase.functions.invoke("buscar-judit", {
            body: { numero_processo: proc.processo_numero, tribunal: "TST" },
          });

          if (juditError || juditData?.error) continue;

          const recorrenteJudit = getJuditPartesResumo(juditData, proc.parte_recorrente);
          const partiesDetail = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];

          // Build dados_benner record
          const tribunaisAceitos = ["TST", "STF", "STJ"];
          const tribunalMapeado = tribunaisAceitos.includes(juditData.tribunal) ? juditData.tribunal : null;

          const dadoToSave: any = {
            processo: proc.processo_numero,
            dossie: juditData.dossie || proc.dossie || "",
            turma: juditData.turma || proc.turma || "",
            relator: juditData.relator || proc.relator || "",
            data_distribuicao_real: juditData.data_distribuicao || proc.data_distribuicao || null,
            recorrente: recorrenteJudit,
            tribunal: tribunalMapeado || "TST",
            tipo_recurso: juditData.tipo_recurso || null,
            situacao_processo: juditData.situacao_processo || null,
            tem_data_julgamento: juditData.tem_data_julgamento || null,
            data_julgamento: juditData.data_julgamento || null,
            horario_julgamento: juditData.horario_julgamento || null,
            tipo_julgamento: juditData.tipo_julgamento || null,
            resultado_sem_transcendencia: juditData.resultado_sem_transcendencia || false,
            resultado_nao_conhecido: juditData.resultado_nao_conhecido || false,
            resultado_conhecido_provido: juditData.resultado_conhecido_provido || false,
            resultado_conhecido_nao_provido: juditData.resultado_conhecido_nao_provido || false,
            resultado_outra: juditData.resultado_outra || null,
            processo_baixado: juditData.processo_baixado || null,
            status: "rascunho",
          };

          // Upsert: check if exists
          const { data: existingBenner } = await supabase
            .from("dados_benner" as any)
            .select("id")
            .eq("processo", proc.processo_numero)
            .limit(1);

          let bennerId: string | null = null;

          if (existingBenner && (existingBenner as any[]).length > 0) {
            bennerId = (existingBenner as any[])[0].id;
            // Update only non-null judit fields
            const updateFields: any = {};
            if (juditData.tipo_recurso) updateFields.tipo_recurso = juditData.tipo_recurso;
            if (juditData.relator) updateFields.relator = juditData.relator;
            if (juditData.turma) updateFields.turma = juditData.turma;
            if (tribunalMapeado) updateFields.tribunal = tribunalMapeado;
            if (recorrenteJudit) updateFields.recorrente = recorrenteJudit;
            if (juditData.situacao_processo) updateFields.situacao_processo = juditData.situacao_processo;
            if (juditData.data_distribuicao) updateFields.data_distribuicao_real = juditData.data_distribuicao;
            if (juditData.tem_data_julgamento) updateFields.tem_data_julgamento = juditData.tem_data_julgamento;
            if (juditData.data_julgamento) updateFields.data_julgamento = juditData.data_julgamento;
            if (juditData.horario_julgamento) updateFields.horario_julgamento = juditData.horario_julgamento;
            if (juditData.tipo_julgamento) updateFields.tipo_julgamento = juditData.tipo_julgamento;
            if (juditData.resultado_sem_transcendencia) updateFields.resultado_sem_transcendencia = true;
            if (juditData.resultado_nao_conhecido) updateFields.resultado_nao_conhecido = true;
            if (juditData.resultado_conhecido_provido) updateFields.resultado_conhecido_provido = true;
            if (juditData.resultado_conhecido_nao_provido) updateFields.resultado_conhecido_nao_provido = true;
            if (juditData.resultado_outra) updateFields.resultado_outra = juditData.resultado_outra;
            if (juditData.processo_baixado) updateFields.processo_baixado = juditData.processo_baixado;

            if (Object.keys(updateFields).length > 0) {
              await supabase.from("dados_benner" as any).update(updateFields as any).eq("processo", proc.processo_numero);
              successCount++;
            }
          } else {
            // Get user id
            const { data: authData } = await supabase.auth.getUser();
            dadoToSave.user_id = authData?.user?.id || null;
            const { data: inserted } = await supabase
              .from("dados_benner" as any)
              .insert(dadoToSave)
              .select("id")
              .single();
            bennerId = (inserted as any)?.id || null;
            successCount++;
          }

          // Persiste partes detalhadas (CPF/CNPJ, advogados, etc.) na aba "Partes"
          if (bennerId && partiesDetail.length > 0) {
            await supabase
              .from("partes_processo_benner")
              .delete()
              .eq("dados_benner_id", bennerId)
              .eq("origem", "judit");

            const partesRows = partiesDetail.map((p: any) => ({
              dados_benner_id: bennerId,
              nome: p.nome || "Sem nome",
              documento: p.documento || null,
              tipo_pessoa: p.tipo_pessoa || null,
              polo: p.polo || null,
              is_advogado: !!p.is_advogado,
              origem: "judit",
            }));
            await supabase.from("partes_processo_benner").insert(partesRows);
          }

          // Marca o registro em dados_benner como judit_preenchido
          const { data: authData2 } = await supabase.auth.getUser();
          await supabase
            .from("dados_benner" as any)
            .update({
              judit_preenchido: true,
              judit_preenchido_em: new Date().toISOString(),
              judit_preenchido_por: authData2?.user?.id || null,
            } as any)
            .eq("processo", proc.processo_numero);

          // Throttle to avoid rate limits
          await new Promise(r => setTimeout(r, 800));
        } catch {
          // Continue on error
        }
      }

      toast.success(`Judit: ${successCount} de ${unique.length} processo(s) atualizados no Dados Benner`);
    } catch (err: any) {
      toast.error("Erro no preenchimento em massa: " + (err?.message || "Erro desconhecido"));
    }
    setBulkJuditRunning(false);
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
  };

  // Pagination helpers
  const getVisiblePages = () => {
    const pages: number[] = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, page - 2);
      const end = Math.min(totalPages - 1, page + 2);
      if (start > 2) pages.push(-1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push(-2);
      pages.push(totalPages);
    }
    return pages;
  };

  if (showBennerForm) {
    return (
      <MainLayout title="Distribuição TST - Dados Benner">
        <div className="max-w-4xl mx-auto space-y-4">
          <Button variant="ghost" size="sm" onClick={() => { setShowBennerForm(false); setBennerDado(null); setBennerPreFill(null); setMarkBennerCamposJudit(false); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para Distribuição TST
          </Button>
          <DadosBennerForm
            dado={bennerDado}
            initialData={bennerPreFill || undefined}
            markExistingJuditFields={markBennerCamposJudit}
            onSave={handleSaveBenner}
            onCancel={() => { setShowBennerForm(false); setBennerDado(null); setBennerPreFill(null); setMarkBennerCamposJudit(false); }}
          />
        </div>
      </MainLayout>
    );
  }

  if (showCarga) {
    return (
      <MainLayout title="Distribuição TST - Carga Benner">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
              Carga Benner (Dados do Supabase)
            </h1>
            <Button variant="outline" onClick={() => setShowCarga(false)}>Voltar à Lista</Button>
          </div>
          <CargaBennerFromDb 
            selectedProcessNumbers={selectedIds.size > 0 ? dados.filter(d => selectedIds.has(d.id)).map(d => d.processo_numero) : undefined}
            filters={{
            aba_origem: filtroAba !== "todas" ? filtroAba : undefined,
            benner: filtroBenner as any,
            processo: filtroProcesso || undefined,
            dossie: filtroDossie || undefined,
            turma: filtroTurma || undefined,
            relator: filtroRelator || undefined,
            parte: filtroParte || undefined,
            nomeParte: filtroNomeParte || undefined,
            mesAno: filtroMesAno !== "todos" ? filtroMesAno : undefined,
            dataInicio: filtroDataInicio || undefined,
            dataFim: filtroDataFim || undefined,
          }} />
        </div>
      </MainLayout>
    );
  }

  if (showForm || editando) {
    return (
      <MainLayout title="Distribuição TST">
        <div className="max-w-4xl mx-auto">
          <DistribuicaoTstForm
            dado={editando}
            onSave={saveDado}
            onCancel={() => { setShowForm(false); setEditando(null); }}
          />
        </div>
      </MainLayout>
    );
  }

  const mesesLabels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <MainLayout title="Distribuição TST">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Distribuição TST</h1>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="default" 
              onClick={handleBulkJudit} 
              disabled={bulkJuditRunning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {bulkJuditRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {bulkJuditRunning 
                ? `Judit ${bulkJuditProgress.current}/${bulkJuditProgress.total}` 
                : selectedIds.size > 0 
                  ? `Preencher Selecionados (${selectedIds.size}) com Judit`
                  : "Preencher com Judit"}
            </Button>
            {bulkJuditRunning && (
              <Button variant="destructive" size="sm" onClick={() => { bulkAbortRef.current = true; }}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleGerarRelatorioPdf}
              disabled={pdfRunning}
              title="Gera um PDF profissional listando as partes (polo ativo/passivo) de cada processo, respeitando os filtros aplicados."
            >
              {pdfRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              {pdfRunning
                ? (pdfProgress.total > 0 ? `Gerando PDF ${pdfProgress.current}/${pdfProgress.total}` : "Gerando PDF...")
                : selectedIds.size > 0
                  ? `Relatório PDF Partes (${selectedIds.size})`
                  : "Relatório PDF Partes"}
            </Button>
            <Button variant="secondary" onClick={() => setShowCarga(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> 
              {selectedIds.size > 0 ? `Carga Benner (${selectedIds.size})` : "Gerar Carga Benner"}
            </Button>
            <Button variant="outline" onClick={handleMarcarPronto} disabled={selectedIds.size === 0}>
              <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Pronto{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <Button variant="outline" onClick={handleMarcarEnviado} disabled={selectedIds.size === 0}>
              <Send className="w-4 h-4 mr-2" /> Marcar como Enviado{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <DistribuicaoTstImport onImported={handleRefresh} />
            <DossieUpdateImport onUpdated={handleRefresh} />
            <Button
              variant="destructive"
              onClick={async () => {
                const confirmacao = window.prompt(
                  'ATENÇÃO: Isto vai APAGAR TODOS os registros de Distribuição TST (dados_benner da Coordenação Dra. Renata).\n\nDigite APAGAR para confirmar:'
                );
                if (confirmacao !== 'APAGAR') {
                  toast.info('Operação cancelada.');
                  return;
                }
                try {
                  const { error, count } = await supabase
                    .from('dados_benner')
                    .delete({ count: 'exact' })
                    .eq('coordenacao_id', '3e47fc83-3539-4fa7-9fcf-33825120e1b7');
                  if (error) throw error;
                  toast.success(`${count ?? 0} registros apagados.`);
                  handleRefresh();
                } catch (err: any) {
                  toast.error('Erro ao apagar: ' + (err?.message || String(err)));
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Apagar Todos
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nova Distribuição
            </Button>
            <Link to="/dados-benner">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" /> Dados Benner
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards (respeitam os filtros e são clicáveis) */}
        <DistribuicaoTstStatsCards stats={stats} loading={statsLoading} activeKey={activeCardKey} onCardClick={handleCardClick} />

        {/* Mês/Ano tabs */}
        {mesesAnos.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={filtroMesAno === "todos" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroMesAno("todos")}
              className="text-xs h-7"
            >
              Todos meses ({mesesAnos.reduce((s, m) => s + m.count, 0)})
            </Button>
            {mesesAnos.map(({ key, count }) => {
              const [y, m] = key.split("-");
              const label = `${mesesLabels[parseInt(m) - 1]}/${y}`;
              return (
                <Button
                  key={key}
                  variant={filtroMesAno === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltroMesAno(key)}
                  className="text-xs h-7"
                >
                  {label} ({count})
                </Button>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Search className="w-4 h-4" /> Filtros
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-3 h-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <Input placeholder="Processo" value={filtroProcesso} onChange={e => setFiltroProcesso(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Dossiê" value={filtroDossie} onChange={e => setFiltroDossie(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Turma" value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Relator" value={filtroRelator} onChange={e => setFiltroRelator(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Parte Recorrente" value={filtroParte} onChange={e => setFiltroParte(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Nome da Parte (Reclamante/Reclamada)" value={filtroNomeParte} onChange={e => setFiltroNomeParte(e.target.value)} className="h-8 text-xs" />
            <Input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className="h-8 text-xs" title="Data início" />
            <Input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className="h-8 text-xs" title="Data fim" />
            <Select value={filtroAba} onValueChange={setFiltroAba}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Aba origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Aba: Todas</SelectItem>
                {abas.map(({ aba, count }) => (
                  <SelectItem key={aba} value={aba}>{aba} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroBenner} onValueChange={setFiltroBenner}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Benner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Benner: Todos</SelectItem>
                <SelectItem value="sim">Benner: Sim</SelectItem>
                <SelectItem value="nao">Benner: Não</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroDossieStatus} onValueChange={setFiltroDossieStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Dossiê" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Dossiê: Todos</SelectItem>
                <SelectItem value="preenchido">Preenchido</SelectItem>
                <SelectItem value="nao_preenchido">Não Preenchido</SelectItem>
                <SelectItem value="valido">Preenchido Válido</SelectItem>
                <SelectItem value="invalido">Preenchido Inválido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroProcessoStatus} onValueChange={setFiltroProcessoStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Processo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Processo: Todos</SelectItem>
                <SelectItem value="valido">Processo Válido (CNJ)</SelectItem>
                <SelectItem value="invalido">Processo Inválido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroJudit} onValueChange={setFiltroJudit}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Judit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Judit: Todos</SelectItem>
                <SelectItem value="sim">Preenchido com Judit</SelectItem>
                <SelectItem value="nao">Não preenchido com Judit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Filtrar por Responsáveis</Label>
            <ResponsaveisSelector
              selectedIds={filtroResponsavelIds}
              onChange={setFiltroResponsavelIds}
              placeholder="Todos os responsáveis"
              coordenacaoId="3e47fc83-3539-4fa7-9fcf-33825120e1b7"
              includeUnassignedOption
            />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{totalCount} registros encontrados</p>
            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => setSelectedIds(new Set())}>
                {selectedIds.size} selecionado(s) — limpar
              </Button>
            )}
          </div>
        </div>

        {/* Bulk Judit progress */}
        {bulkJuditRunning && (
          <div className="border border-emerald-500/30 rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/20 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Preenchendo com Judit...</span>
              <span className="text-xs text-muted-foreground">{bulkJuditProgress.current}/{bulkJuditProgress.total}</span>
            </div>
            <Progress value={bulkJuditProgress.total > 0 ? (bulkJuditProgress.current / bulkJuditProgress.total) * 100 : 0} className="h-2" />
          </div>
        )}

        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox 
                    checked={dados.length > 0 && dados.every(d => selectedIds.has(d.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set([...selectedIds, ...dados.map(d => d.id)]));
                      } else {
                        const newSet = new Set(selectedIds);
                        dados.forEach(d => newSet.delete(d.id));
                        setSelectedIds(newSet);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Data Plan.</TableHead>
                <TableHead>Data Real</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Dossiê</TableHead>
                <TableHead>Relator</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Responsáveis</TableHead>
                <TableHead>Tipo de Recurso</TableHead>
                <TableHead>Parte Recorrente</TableHead>
                <TableHead>Benner</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhuma distribuição encontrada</TableCell></TableRow>
              ) : dados.map(d => {
                const relatorClass = d.relator_favorabilidade?.toLowerCase().includes("positiv")
                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                  : d.relator_favorabilidade?.toLowerCase().includes("negativ")
                    ? "text-destructive font-semibold"
                    : "";
                const turmaClass = d.turma_favorabilidade?.toLowerCase().includes("positiv")
                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                  : d.turma_favorabilidade?.toLowerCase().includes("negativ")
                    ? "text-destructive font-semibold"
                    : "";
                const responsaveis = responsaveisMap.get(d.id) || [];
                return (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditando(d)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(d.id)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedIds);
                        if (checked) newSet.add(d.id);
                        else newSet.delete(d.id);
                        setSelectedIds(newSet);
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(d.data_distribuicao_planilha)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(d.data_distribuicao_real)}</TableCell>
                  <TableCell className="text-xs align-top">
                    {(() => {
                      const raw = d.processo_numero || "";
                      const cnjMatch = raw.match(/^(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})(.*)$/);
                      if (cnjMatch) {
                        const numero = cnjMatch[1];
                        const resto = cnjMatch[2].trim();
                        return (
                          <div className="space-y-0.5">
                            <div className="whitespace-nowrap font-mono">{numero}</div>
                            {resto && <div className="text-[10px] text-muted-foreground italic">{resto}</div>}
                          </div>
                        );
                      }
                      // Processo inválido: não quebra o número, mas permite quebra do comentário
                      return <div className="break-words">{raw}</div>;
                    })()}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    {d.dossie ? (
                      <button
                        type="button"
                        className="text-primary hover:underline disabled:opacity-50"
                        onClick={() => handleOpenBenner(d)}
                        disabled={loadingBenner === d.id}
                        title="Abrir Dados Benner"
                      >
                        {d.dossie}
                      </button>
                    ) : "—"}
                  </TableCell>
                  <TableCell className={cn("text-xs", relatorClass)}>{d.relator || "—"}</TableCell>
                  <TableCell className={cn("text-xs", turmaClass)}>{d.turma || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {responsaveis.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {responsaveis.map(r => (
                          <Badge key={r.id} variant="secondary" className="text-[10px] px-1.5 py-0">{r.nome}</Badge>
                        ))}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{d.tipo_recurso || "—"}</TableCell>
                  <TableCell className="text-xs align-top max-w-xs">
                    {d.parte_recorrente ? (
                      <div className="whitespace-pre-line break-words leading-snug">{d.parte_recorrente}</div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {d.benner_atualizado ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleOpenBenner(d)}
                        disabled={loadingBenner === d.id}
                        title="Abrir Dados Benner"
                      >
                        {loadingBenner === d.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Database className="w-4 h-4 text-primary" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages} · {totalCount} registros
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {getVisiblePages().map((p, i) =>
                p < 0 ? (
                  <span key={`e${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
