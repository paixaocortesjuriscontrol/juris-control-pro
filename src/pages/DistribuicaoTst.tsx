import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Trash2, ExternalLink, Search, X, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileSpreadsheet, Download, Database, ArrowLeft, FileText, CheckCircle, Send, Filter, UserPlus, LayoutGrid, Shuffle, Eye, EyeOff, SlidersHorizontal, Layers, Archive, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { DistribuicaoTstStatsCards } from "@/components/distribuicao-tst/DistribuicaoTstStatsCards";
import { useResponsaveisCounts } from "@/hooks/useResponsaveisCounts";
import { useDistribuicaoTstStats } from "@/hooks/useDistribuicaoTstStats";
import { fetchAllFilteredBennerIds, fetchProcessosComPartes, gerarRelatorioPartesPdf, buildFiltrosResumo } from "@/lib/relatorioPartesPdf";
import { gerarRelatorioExcelDistribuicaoTst } from "@/lib/relatorioExcelDistribuicaoTst";
import { Checkbox } from "@/components/ui/checkbox";
import { useDistribuicoesTst, DistribuicaoTst as DistTst, DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "@/hooks/useDistribuicoesTst";
import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";
import { DistribuicaoTstDetail } from "@/components/distribuicao-tst/DistribuicaoTstDetail";
import { DistribuicaoTstImport } from "@/components/distribuicao-tst/DistribuicaoTstImport";
import { CertidaoPdfImport } from "@/components/distribuicao-tst/CertidaoPdfImport";
import { DossieUpdateImport } from "@/components/distribuicao-tst/DossieUpdateImport";
import { EquipeUpdateImport } from "@/components/distribuicao-tst/EquipeUpdateImport";
import { SituacaoEnvioUpdateImport } from "@/components/distribuicao-tst/SituacaoEnvioUpdateImport";
import { BennerSimImport } from "@/components/distribuicao-tst/BennerSimImport";
import { RespostaSantanderImport } from "@/components/distribuicao-tst/RespostaSantanderImport";
import { CargaBennerFromDb } from "@/components/distribuicao-tst/CargaBennerFromDb";
import { DossiesNaoLocalizadosButton } from "@/components/distribuicao-tst/DossiesNaoLocalizadosButton";
import { DadosBennerForm } from "@/components/benner/DadosBennerForm";
import { DadoBenner, DadoBennerInsert } from "@/hooks/useDadosBenner";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn, formatProcessoNumero } from "@/lib/utils";
import { ResponsaveisSelector } from "@/components/distribuicao-tst/ResponsaveisSelector";
import { DelegarProcessosDialog } from "@/components/distribuicao-tst/DelegarProcessosDialog";
import { DistribuirAutomaticoDialog } from "@/components/distribuicao-tst/DistribuirAutomaticoDialog";
import { CopyButton } from "@/components/ui/copy-button";
import { getJuditAttachmentDedupKey } from "@/lib/juditAnexosDedup";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { useSituacoesEnvioCarga } from "@/hooks/useSituacoesEnvioCarga";
import {
  useProcessoTagsCatalogo,
  useTagsForDados,
  fetchDadoIdsByTag,
} from "@/hooks/useProcessoTags";
import { ProcessoTagPicker } from "@/components/distribuicao-tst/ProcessoTagPicker";
import { BulkTagAction } from "@/components/distribuicao-tst/BulkTagAction";
import { useQuery } from "@tanstack/react-query";
import { gerarManualDistribuicaoTst } from "@/utils/gerarManualDistribuicaoTst";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [mostrarCards, setMostrarCards] = useState(true);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [editando, setEditando] = useState<DistTst | null>(null);
  type SortKey = "data_distribuicao_planilha" | "data_distribuicao_real" | "processo_numero" | "dossie" | "responsaveis" | "benner_atualizado";
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };
  const location = useLocation();
  const navigate = useNavigate();

  // Abre detalhe automaticamente quando navegado com ?editId=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = params.get("editId");
    if (!editId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("dados_benner" as any)
        .select("*")
        .eq("id", editId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Registro não encontrado");
      } else {
        setEditando(data as any);
      }
      // limpa o query param para não reabrir ao voltar
      navigate("/distribuicao-tst", { replace: true });
    })();
    return () => { cancelled = true; };
  }, [location.search, navigate]);
  // Aba inicial do detalhe unificado (Distribuição vs Dados Benner).
  const [detailInitialTab, setDetailInitialTab] = useState<"distribuicao" | "benner">("distribuicao");
  const { isAdmin, isAdminOrCoordinator } = useUserRole();
  const { user } = useAuth();
  const [delegarOpen, setDelegarOpen] = useState(false);
  const [autoDistOpen, setAutoDistOpen] = useState(false);
  const [showCarga, setShowCarga] = useState(false);
  const [cargaDistribuicoes, setCargaDistribuicoes] = useState<any[] | null>(null);
  const [cargaIdsAllowed, setCargaIdsAllowed] = useState<string[] | null>(null);
  const [cargaLoading, setCargaLoading] = useState(false);
  
  // Loading flag para os botões "Dados Benner" da tabela (abrem o detalhe na aba Benner).
  const [loadingBenner, setLoadingBenner] = useState<string | null>(null);
  
  // Bulk Judit
  const [bulkJuditRunning, setBulkJuditRunning] = useState(false);
  const [bulkJuditProgress, setBulkJuditProgress] = useState({ current: 0, total: 0 });
  const bulkAbortRef = useRef(false);
  // Quando ligado, o "Preencher com Judit" em lote chama a Judit com
  // with_attachments=true (consulta cara). Default false para preservar quota.
  const [bulkComAnexos, setBulkComAnexos] = useState(false);

  const scrollPageToTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.querySelector<HTMLElement>("[data-page-scroll-container]")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // Relatório PDF de Partes
  const [pdfRunning, setPdfRunning] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });

  // Relatório Excel Distribuição TST
  const [xlsxRunning, setXlsxRunning] = useState(false);
  const [xlsxProgress, setXlsxProgress] = useState({ current: 0, total: 0 });

  // Row selection for bulk Judit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // ID do registro recém-editado/salvo. Mantém ele visível (sticky) na lista
  // mesmo se ele não bater mais com os filtros, e destaca a linha por alguns
  // segundos para que a advogada localize o que mudou.
  const [stickyId, setStickyId] = useState<string | null>(null);
  const [highlightUntil, setHighlightUntil] = useState<number>(0);
  useEffect(() => {
    if (!stickyId) return;
    const t = window.setTimeout(() => {
      setHighlightUntil(0);
      // Mantém o sticky até a próxima ação do usuário (mudança de filtro/página),
      // mas tira o destaque visual após 8s para não poluir.
    }, 8000);
    return () => window.clearTimeout(t);
  }, [stickyId]);

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
  const [filtroErroJudit, setFiltroErroJudit] = useState<string>("todos");
  const [filtroSituacaoProcesso, setFiltroSituacaoProcesso] = useState<string>("todos");
  const [filtroSubidaMassa, setFiltroSubidaMassa] = useState<string>("todos");

  const [filtroResponsavelIds, setFiltroResponsavelIds] = useState<string[]>([]);
  const autoSelectedRespRef = useRef(false);
  const [filtroSemTurma, setFiltroSemTurma] = useState<boolean>(false);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroEmAnalise, setFiltroEmAnalise] = useState<string>("todos");
  const [filtroProblemaJudit, setFiltroProblemaJudit] = useState<string>("todos");
  const [filtroDuplicado, setFiltroDuplicado] = useState<string>("todos");
  const [filtroFonteImportacao, setFiltroFonteImportacao] = useState<string>("todas");
  const [filtroProvasDigitais, setFiltroProvasDigitais] = useState<string>("todos");
  const [filtroSituacaoCarga, setFiltroSituacaoCarga] = useState<string>("todas");
  const [filtroEquipe, setFiltroEquipe] = useState<string>("todos");
  const { data: situacoesCarga = [] } = useSituacoesEnvioCarga();
  // ===== TAGs (admin/coord) =====
  const [filtroTagId, setFiltroTagId] = useState<string>("todas");
  const { data: tagsCatalogo = [] } = useProcessoTagsCatalogo();
  // Quando uma TAG é escolhida, busca o conjunto de ids permitidos.
  const { data: idsAllowedFromTag } = useQuery({
    queryKey: ["tag-filter-ids", filtroTagId],
    enabled: filtroTagId !== "todas" && filtroTagId !== "__sem__",
    queryFn: () => fetchDadoIdsByTag(filtroTagId),
  });
  const idsAllowedForFilters = filtroTagId === "todas"
    ? undefined
    : filtroTagId === "__sem__"
      ? undefined // tratado abaixo
      : (idsAllowedFromTag ?? []);

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
        erroJudit: filtroErroJudit !== "todos" ? (filtroErroJudit as any) : undefined,
        situacaoProcesso: filtroSituacaoProcesso !== "todos" ? (filtroSituacaoProcesso as any) : undefined,
        subidaMassa: filtroSubidaMassa !== "todos" ? (filtroSubidaMassa as any) : undefined,
        mesAno: filtroMesAno !== "todos" ? filtroMesAno : undefined,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
        responsavelIds: filtroResponsavelIds.length > 0 ? filtroResponsavelIds : undefined,
        semTurma: filtroSemTurma || undefined,
        status: filtroStatus !== "todos" ? (filtroStatus as any) : undefined,
        emAnalise: filtroEmAnalise !== "todos" ? (filtroEmAnalise as any) : undefined,
        problemaJudit: filtroProblemaJudit !== "todos" ? (filtroProblemaJudit as any) : undefined,
        duplicado: filtroDuplicado !== "todos" ? (filtroDuplicado as any) : undefined,
        fonteImportacao: filtroFonteImportacao !== "todas" ? filtroFonteImportacao : undefined,
        provasDigitais: filtroProvasDigitais !== "todos" ? (filtroProvasDigitais as any) : undefined,
        situacaoEnvioCargaId: filtroSituacaoCarga !== "todas" ? filtroSituacaoCarga : undefined,
        equipe: filtroEquipe !== "todos" ? (filtroEquipe as any) : undefined,
      idsAllowed: idsAllowedForFilters,
      });
    }, 400);
    return () => clearTimeout(timer);
}, [filtroProcesso, filtroDossie, filtroDossieStatus, filtroProcessoStatus, filtroTurma, filtroRelator, filtroParte, filtroNomeParte, filtroAba, filtroBenner, filtroJudit, filtroErroJudit, filtroSituacaoProcesso, filtroSubidaMassa, filtroMesAno, filtroDataInicio, filtroDataFim, JSON.stringify(filtroResponsavelIds), filtroSemTurma, filtroStatus, filtroEmAnalise, filtroProblemaJudit, filtroDuplicado, filtroFonteImportacao, filtroProvasDigitais, filtroSituacaoCarga, filtroEquipe, filtroTagId, JSON.stringify(idsAllowedFromTag || [])]);

  // Para não-admins, o filtro "A fazer" sempre amarra ao usuário logado,
  // independentemente do select de responsáveis.
  const listFilters = useMemo(() => {
    if (debouncedFilters.situacaoProcesso === "a_fazer" && !isAdmin && user?.id) {
      return { ...debouncedFilters, responsavelIds: [user.id] };
    }
    return debouncedFilters;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debouncedFilters), isAdmin, user?.id]);

  const { dados, responsaveisMap, loading, fetchDados, saveDado, deleteDado, page, setPage, totalCount, totalPages } = useDistribuicoesTst(listFilters, stickyId);

  const dadosOrdenados = useMemo(() => {
    if (!sortBy) return dados;
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = (d: any): any => {
      switch (sortBy) {
        case "data_distribuicao_planilha": return d.data_distribuicao_planilha || "";
        case "data_distribuicao_real": return d.data_distribuicao_real || "";
        case "processo_numero": return (d.processo_numero || "").toLowerCase();
        case "dossie": return (d.dossie || "").toLowerCase();
        case "benner_atualizado": return d.benner_atualizado ? 1 : 0;
        case "responsaveis": {
          const list = responsaveisMap.get(d.id) || [];
          return (list[0]?.nome || "").toLowerCase();
        }
        default: return "";
      }
    };
    return [...dados].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av === bv) return 0;
      if (av === "" || av === null || av === undefined) return 1;
      if (bv === "" || bv === null || bv === undefined) return -1;
      return av < bv ? -1 * dir : 1 * dir;
    });
  }, [dados, sortBy, sortDir, responsaveisMap]);

  // Mapa { dado_id => tagIds[] } para a página visível
  const visibleDadoIds = dados.map((d) => d.id);
  const { data: tagsMap } = useTagsForDados(visibleDadoIds);

  // Totais por responsável (todos os registros que batem com os filtros, ignorando o filtro de responsável)
  const countsFilters = { ...debouncedFilters, responsavelIds: undefined };
  const { counts: responsavelCounts, refetch: refetchResponsavelCounts } = useResponsaveisCounts(countsFilters);

  // Auto-seleciona o usuário logado como responsável ao abrir a tela
  // (apenas se ele estiver na lista de responsáveis). Roda uma única vez.
  useEffect(() => {
    if (autoSelectedRespRef.current) return;
    if (!user?.id) return;
    if (responsavelCounts.length === 0) return;
    autoSelectedRespRef.current = true;
    if (responsavelCounts.some((c) => c.id === user.id)) {
      setFiltroResponsavelIds([user.id]);
    }
  }, [user?.id, responsavelCounts]);

  // Limpa o sticky se o usuário mexer em filtros, página ou recarregar.
  // (Mantemos o sticky apenas para o fluxo "salvou e voltou".)
  useEffect(() => {
    setStickyId(null);
    setHighlightUntil(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debouncedFilters), page]);
  const { stats, loading: statsLoading, refetch: refetchStats } = useDistribuicaoTstStats(debouncedFilters);

  // Card "A fazer": sempre conta com base no usuário logado para não-admins.
  // Para admins, respeita o filtro de responsável atual.
  const aFazerFilters = useMemo(() => {
    if (isAdmin || !user?.id) return debouncedFilters;
    return { ...debouncedFilters, responsavelIds: [user.id] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debouncedFilters), isAdmin, user?.id]);
  const { stats: statsAFazer } = useDistribuicaoTstStats(aFazerFilters);

  // Total Geral e Prontos para Enviar (geral): ignoram o filtro de responsável
  // (mostram sempre o total do escritório para os demais filtros selecionados).
  const { stats: statsGeral } = useDistribuicaoTstStats(countsFilters);
  const statsWithGeral = {
    ...stats,
    total: statsGeral.total,
    prontoEnvio: statsGeral.prontoEnvio,
    aFazer: statsAFazer.aFazer,
  };

  // Fetch distinct aba_origem and meses for tabs (lightweight queries)
  const [abas, setAbas] = useState<{ aba: string; count: number }[]>([]);
  const [mesesAnos, setMesesAnos] = useState<{ key: string; count: number }[]>([]);
  const [centralizadores, setCentralizadores] = useState<{ nome: string; count: number }[]>([]);

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

    // Distinct centralizadores (paginado para evitar limite 1000)
    const centMap = new Map<string, number>();
    let off = 0;
    const SZ = 1000;
    while (true) {
      const { data: cd } = await supabase
        .from("dados_benner" as any)
        .select("centralizador")
        .not("aba_origem", "is", null)
        .range(off, off + SZ - 1);
      const rows = (cd as any[]) || [];
      for (const r of rows) {
        const c = (r.centralizador || "").trim();
        if (c) centMap.set(c, (centMap.get(c) || 0) + 1);
      }
      if (rows.length < SZ) break;
      off += SZ;
    }
    setCentralizadores(
      [...centMap.entries()].map(([nome, count]) => ({ nome, count })).sort((a, b) => b.count - a.count)
    );
  }, []);

  useEffect(() => { fetchTabsData(); }, [fetchTabsData]);

  

  const hasFilters = filtroProcesso || filtroDossie || filtroTurma || filtroRelator || filtroParte || filtroNomeParte || filtroDataInicio || filtroDataFim || filtroAba !== "todas" || filtroBenner !== "todos" || filtroMesAno !== "todos" || filtroDossieStatus !== "todos" || filtroProcessoStatus !== "todos" || filtroJudit !== "todos" || filtroErroJudit !== "todos" || filtroSituacaoProcesso !== "todos" || filtroSubidaMassa !== "todos" || filtroStatus !== "todos" || filtroEmAnalise !== "todos" || filtroDuplicado !== "todos" || filtroFonteImportacao !== "todas" || filtroProvasDigitais !== "todos" || filtroSituacaoCarga !== "todas" || filtroEquipe !== "todos" || filtroTagId !== "todas";

  const clearFilters = () => {
    setFiltroAba("todas");
    setFiltroBenner("todos");
    setFiltroDossieStatus("todos");
    setFiltroProcessoStatus("todos");
    setFiltroMesAno("todos");
    setFiltroJudit("todos");
    setFiltroErroJudit("todos");
    setFiltroSituacaoProcesso("todos");
    setFiltroStatus("todos");
    setFiltroEmAnalise("todos");
    setFiltroDuplicado("todos");
    setFiltroFonteImportacao("todas");
    setFiltroProvasDigitais("todos");
    setFiltroSituacaoCarga("todas");
    setFiltroTagId("todas");
    setFiltroProcesso("");
    setFiltroDossie("");
    setFiltroTurma("");
    setFiltroRelator("");
    setFiltroParte("");
    setFiltroNomeParte("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroResponsavelIds([]);
    setFiltroSemTurma(false);
    setFiltroProblemaJudit("todos");
    setFiltroEquipe("todos");
    setSelectedIds(new Set());
  };

  // Estado do card ativo (sincroniza visual + aplica filtros). Derivado dos selects.
  const activeCardKey = (() => {
    if (filtroProcessoStatus === "valido" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "processosValidos" as const;
    if (filtroProcessoStatus === "invalido" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "processosInvalidos" as const;
    if (filtroDossieStatus === "valido" && filtroProcessoStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "dossiesValidos" as const;
    if (filtroDossieStatus === "invalido_ou_nao_preenchido" && filtroProcessoStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "dossiesInvalidos" as const;
    if (filtroJudit === "sim" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroBenner === "todos") return "juditPreenchido" as const;
    if (filtroJudit === "nao" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroBenner === "todos") return "juditNaoPreenchido" as const;
    if (filtroBenner === "sim" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos") return "bennerSim" as const;
    if (filtroBenner === "nao" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos") return "bennerNao" as const;
    if (filtroSituacaoProcesso === "ativo" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "processosAtivos" as const;
    if (filtroSituacaoProcesso === "transito" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "transitoJulgado" as const;
    if (filtroSituacaoProcesso === "a_fazer" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "aFazer" as const;
    if (filtroSemTurma && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroSituacaoProcesso === "todos") return "semTurma" as const;
    if (filtroProblemaJudit === "sim" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroSituacaoProcesso === "todos" && !filtroSemTurma) return "problemaJudit" as const;
    if (filtroDataInicio === "" && filtroDataFim === "2025-12-31" && filtroMesAno === "todos") return "ate2025" as const;
    if (filtroDataInicio === "2026-01-01" && filtroDataFim === "" && filtroMesAno === "todos") return "de2026" as const;
    if (filtroStatus === "pronto_envio" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroSituacaoProcesso === "todos" && !filtroSemTurma && filtroProblemaJudit !== "sim") return "prontoEnvio" as const;
    if (filtroEquipe === "sim") return "comEquipe" as const;
    if (filtroEquipe === "nao") return "semEquipe" as const;
    if (filtroSituacaoProcesso === "todos" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroStatus === "todos" && !filtroSemTurma && filtroProblemaJudit === "todos" && filtroEquipe === "todos" && !filtroDataInicio && !filtroDataFim) return "total" as const;
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
    setFiltroSituacaoProcesso("todos");
    setFiltroSemTurma(false);
    setFiltroProblemaJudit("todos");
    setFiltroEquipe("todos");
    // Reseta filtro de status (Pronto para Enviar) ao alternar cards
    if (key === "prontoEnvio" || isActive) setFiltroStatus("todos");
    // Reseta filtro "sem responsável" ao alternar cards
    if (key === "semResponsavel" || isActive) setFiltroResponsavelIds([]);
    setSelectedIds(new Set());
    // Reseta filtros de data ao alternar cards
    if (key === "ate2025" || key === "de2026" || isActive) {
      setFiltroDataInicio("");
      setFiltroDataFim("");
      setFiltroMesAno("todos");
    }
    if (isActive || key === "total") return;
    switch (key) {
      case "processosValidos": setFiltroProcessoStatus("valido"); break;
      case "processosInvalidos": setFiltroProcessoStatus("invalido"); break;
      case "dossiesValidos": setFiltroDossieStatus("valido"); break;
      case "dossiesInvalidos": setFiltroDossieStatus("invalido_ou_nao_preenchido"); break;
      case "juditPreenchido": setFiltroJudit("sim"); break;
      case "juditNaoPreenchido": setFiltroJudit("nao"); break;
      case "bennerSim": setFiltroBenner("sim"); break;
      case "bennerNao": setFiltroBenner("nao"); break;
      case "processosAtivos": setFiltroSituacaoProcesso("ativo"); break;
      case "transitoJulgado": setFiltroSituacaoProcesso("transito"); break;
      case "aFazer": setFiltroSituacaoProcesso("a_fazer"); break;
      case "semTurma": setFiltroSemTurma(true); break;
      case "problemaJudit": setFiltroProblemaJudit("sim"); break;
      case "ate2025":
        setFiltroDataInicio("");
        setFiltroDataFim("2025-12-31");
        setFiltroMesAno("todos");
        break;
      case "de2026":
        setFiltroDataInicio("2026-01-01");
        setFiltroDataFim("");
        setFiltroMesAno("todos");
        break;
      case "prontoEnvio": setFiltroStatus("pronto_envio"); break;
      case "semResponsavel":
        setFiltroResponsavelIds(["__sem_responsavel__"]);
        break;
      case "comEquipe": setFiltroEquipe("sim"); break;
      case "semEquipe": setFiltroEquipe("nao"); break;
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdminOrCoordinator) {
      toast.error("Apenas administradores ou coordenadores podem excluir processos. Fale com o coordenador ou administrador da coordenação.");
      return;
    }
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    await deleteDado(id);
    fetchTabsData();
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
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id || null;
      const nowIso = new Date().toISOString();
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const { error } = await supabase.from("dados_benner" as any).update({ status: "pronto_envio" } as any).in("id", batch);
        if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
        // Se estavam Em análise, passam para Analisado e saem da lista padrão
        const { error: errAna } = await supabase
          .from("dados_benner" as any)
          .update({ analisado: true, analisado_em: nowIso, analisado_por: uid, em_analise: false, em_analise_por: null, em_analise_em: null } as any)
          .in("id", batch)
          .eq("em_analise", true);
        if (errAna) { toast.error("Erro ao marcar Analisado: " + errAna.message); return; }
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

  const handleMarcarEmAnalise = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) { toast.warning("Selecione registros para marcar como Em análise"); return; }
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id || null;
    const BATCH = 200;
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const { error } = await supabase
          .from("dados_benner" as any)
          .update({ em_analise: true, em_analise_por: uid, em_analise_em: new Date().toISOString() } as any)
          .in("id", batch);
        if (error) { toast.error("Erro ao marcar Em análise: " + error.message); return; }
      }
      toast.success(`${ids.length} registro(s) marcado(s) como Em análise!`);
      setSelectedIds(new Set());
      setFiltroEmAnalise("sim");
      handleRefresh();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    }
  };

  const handleFinalizarAnalise = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) { toast.warning("Selecione registros para finalizar a análise"); return; }
    const BATCH = 200;
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const { error } = await supabase
          .from("dados_benner" as any)
          .update({ em_analise: false, em_analise_por: null, em_analise_em: null } as any)
          .in("id", batch);
        if (error) { toast.error("Erro ao finalizar análise: " + error.message); return; }
      }
      toast.success(`Análise finalizada em ${ids.length} registro(s)!`);
      setSelectedIds(new Set());
      // Os registros saem do estado "Em análise"; se o filtro continuar
      // em "sim", a lista esvazia e parece que a tela se perdeu.
      setFiltroEmAnalise("todos");
      handleRefresh();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    }
  };

  const handleToggleSubidaMassaRow = async (id: string, novoValor: boolean, processoNumero?: string | null) => {
    const { error } = await supabase
      .from("dados_benner" as any)
      .update({ subida_em_massa: novoValor } as any)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar Subida em Massa: " + error.message); return; }
    const proc = processoNumero || "processo";
    toast.success(
      novoValor
        ? `Marcado como Subida em Massa: ${proc}`
        : `Desmarcado de Subida em Massa: ${proc}`
    );
    handleRefresh();
  };

  // Open Dados Benner form for a distribuição row
  const handleOpenBenner = async (dist: DistTst) => {
    // Abre o detalhe unificado já posicionado na aba "Dados Benner".
    scrollPageToTop();
    setDetailInitialTab("benner");
    setEditando(dist);
  };

  // Save handler for Dados Benner form used from this page
  const handleSaveBenner = async (dado: DadoBennerInsert, id?: string) => {
    let rowId = id;
    if (!rowId) {
      const processo = String((dado as any).processo || "").trim();
      const dossie = String((dado as any).dossie || "").trim();
      if (processo) {
        let query: any = supabase.from("dados_benner" as any).select("id").eq("processo", processo);
        query = dossie ? query.eq("dossie", dossie) : query.or("dossie.is.null,dossie.eq.");
        const { data: existing } = await query
          .order("benner_atualizado", { ascending: false, nullsFirst: false })
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(1);
        rowId = (existing as any[])?.[0]?.id;
      }
    }

    if (rowId) {
      const { data: updated, error } = await supabase
        .from("dados_benner" as any)
        .update(dado as any)
        .eq("id", rowId)
        .select("id");
      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
      if (!updated || (updated as any[]).length === 0) {
        toast.error("Atualização bloqueada por permissão (RLS). Verifique se você é o dono do registro ou tem perfil de admin/coordenador.");
        return false;
      }
      rowId = (updated as any[])[0].id;
    } else {
      // Garante user_id no insert para satisfazer RLS (user_id = auth.uid())
      const { data: authData } = await supabase.auth.getUser();
      const insertPayload = { ...(dado as any), user_id: (dado as any).user_id || authData?.user?.id || null };
      const { data: inserted, error } = await (supabase
        .from("dados_benner" as any)
        .insert(insertPayload)
        .select("id")
        .single() as any);
      if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
      if ((inserted as any)?.id) {
        handleRefresh();
        return (inserted as any).id as string;
      }
    }
    handleRefresh();
    return rowId || true;
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

  // Gerar relatório Excel da Distribuição TST (respeita filtros e seleção)
  const handleGerarRelatorioExcel = async () => {
    setXlsxRunning(true);
    setXlsxProgress({ current: 0, total: 0 });
    try {
      toast.info(selectedIds.size > 0 ? `Gerando planilha de ${selectedIds.size} processo(s)...` : "Buscando processos filtrados...");
      const { blob, filename, total } = await gerarRelatorioExcelDistribuicaoTst({
        filters: debouncedFilters,
        selectedIds,
        onProgress: (c, t) => setXlsxProgress({ current: c, total: t }),
      });
      if (total === 0) {
        toast.info("Nenhum processo para gerar a planilha.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Planilha gerada com ${total} processo(s).`);
    } catch (err: any) {
      toast.error("Erro ao gerar planilha: " + (err?.message || String(err)));
    } finally {
      setXlsxRunning(false);
    }
  };

  // Gerar carga Benner respeitando os filtros aplicados na lista
  const handleGerarCarga = async () => {
    setCargaLoading(true);
    try {
      let ids: string[];
      if (selectedIds.size > 0) {
        ids = Array.from(selectedIds);
      } else {
        toast.info("Buscando distribuições filtradas...");
        ids = await fetchAllDistribuicaoTstIds(debouncedFilters);
      }
      if (ids.length === 0) {
        toast.info("Nenhuma distribuição encontrada com os filtros atuais.");
        return;
      }
      // Abre o modal imediatamente passando apenas os IDs. O carregamento dos
      // dados completos acontece dentro do modal com barra de progresso,
      // evitando que o botão fique preso em "Carregando..." sem feedback.
      setCargaDistribuicoes(null);
      setCargaIdsAllowed(ids);
      setShowCarga(true);
    } catch (err: any) {
      toast.error("Erro ao carregar dados para carga: " + (err?.message || String(err)));
    } finally {
      setCargaLoading(false);
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

      // Cache do user id para gravar judit_logs (mesma lógica do botão individual)
      const { data: bulkAuthData } = await supabase.auth.getUser();
      const bulkUserId = bulkAuthData?.user?.id || null;

      for (let i = 0; i < unique.length; i++) {
        if (bulkAbortRef.current) { toast.info("Operação cancelada"); break; }

        const proc = unique[i];
        setBulkJuditProgress({ current: i + 1, total: unique.length });

        try {
          const requestPayload = { numero_processo: aplicarMascaraCnj(proc.processo_numero), tribunal: "TST", com_anexos: bulkComAnexos };
          const { data: juditData, error: juditError } = await supabase.functions.invoke("buscar-judit", {
            body: requestPayload,
          });

          // Persiste log da consulta (sucesso, erro de função ou erro retornado),
          // exatamente como o botão Judit individual faz.
          try {
            await supabase.from("judit_logs" as any).insert({
              processo_numero: proc.processo_numero,
              tribunal: "TST",
              request_payload: requestPayload,
              raw_response: juditData ?? null,
              status: juditError ? "erro_funcao" : (juditData?.error ? "erro_api" : "sucesso"),
              error_message: juditError?.message || juditData?.error || null,
              created_by: bulkUserId,
            });
          } catch (logErr) {
            console.warn("[bulk-judit] Falha ao gravar judit_logs:", logErr);
          }

          if (juditError || juditData?.error) continue;

          const recorrenteJudit = getJuditPartesResumo(juditData, proc.parte_recorrente);
          const partiesDetail = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];

          // Quando a busca em lote foi solicitada COM ANEXOS, persiste a lista
          // em judit_anexos exatamente como o botão individual do formulário.
          if (bulkComAnexos) {
            const atts = Array.isArray((juditData as any)?.attachments) ? (juditData as any).attachments : [];
            if (atts.length > 0) {
              try {
                const numeroMasc = aplicarMascaraCnj(proc.processo_numero);
                const rowsRaw = atts.map((a: any) => ({
                  processo_numero: proc.processo_numero,
                  cnj: a?.cnj || numeroMasc,
                  instance: a?.instance != null ? String(a.instance) : null,
                  attachment_id: String(a?.step_id || a?.attachment_id || ""),
                  step_id: a?.step_id ? String(a.step_id) : null,
                  attachment_name: a?.attachment_name || null,
                  attachment_date: a?.attachment_date || null,
                  extension: a?.extension || null,
                  status: a?.status || "done",
                  corrupted: a?.corrupted ?? false,
                  raw_attachment: a,
                  created_by: bulkUserId,
                })).filter((r: any) => r.attachment_id);
                const seen = new Set<string>();
                const rows = rowsRaw.filter((r: any) => {
                  const key = getJuditAttachmentDedupKey(r);
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
                if (rows.length > 0) {
                  await supabase
                    .from("judit_anexos" as any)
                    .delete()
                    .eq("processo_numero", proc.processo_numero);
                  await supabase
                    .from("judit_anexos" as any)
                    .insert(rows);
                }
              } catch (e) {
                console.warn("[bulk-judit] Falha ao persistir judit_anexos:", e);
              }
            }
          }

          // Mesma extração do formulário individual: nomes por polo (sem advogados)
          const nomesPorPolo = (poloUpper: string) =>
            [...new Set(
              partiesDetail
                .filter((p: any) => (p?.polo || "").toString().toUpperCase() === poloUpper && !p?.is_advogado)
                .map((p: any) => String(p?.nome || "").trim())
                .filter(Boolean)
            )].join(" / ");
          const reclamanteJudit = nomesPorPolo("ACTIVE");
          const reclamadaJudit = nomesPorPolo("PASSIVE");

          // Trânsito em julgado: situação contém "trânsito" OU processo_baixado === "S"
          const situacaoStr = (juditData.situacao_processo || "").toString();
          const baixadoStr = (juditData.processo_baixado || "").toString().toUpperCase();
          const ehTransito = /tr[âa]nsito/i.test(situacaoStr) || baixadoStr === "S";

          // Build dados_benner record
          const tribunaisAceitos = ["TST", "STF", "STJ"];
          const tribunalMapeado = tribunaisAceitos.includes(juditData.tribunal) ? juditData.tribunal : null;

          // Helper: turma é uma das 8 turmas oficiais do TST?
          const isTurmaOficialTst = (t: string | null | undefined): boolean => {
            if (!t) return false;
            const norm = String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
            return /^[1-8][ªa]?\s*turma$/.test(norm);
          };
          const turmaFinal = juditData.turma || proc.turma || "";
          const erroJuditFlag = !isTurmaOficialTst(turmaFinal);

          const dadoToSave: any = {
            processo: proc.processo_numero,
            dossie: juditData.dossie || proc.dossie || "",
            turma: turmaFinal,
            relator: juditData.relator || proc.relator || "",
            data_distribuicao_real: juditData.data_distribuicao || proc.data_distribuicao || null,
            data_distribuicao: juditData.data_distribuicao || proc.data_distribuicao || null,
            recorrente: recorrenteJudit,
            reclamante: reclamanteJudit || null,
            reclamada: reclamadaJudit || null,
            tribunal: tribunalMapeado || "TST",
            tipo_recurso: juditData.tipo_recurso || null,
            tipo_recurso_reclamante: juditData.tipo_recurso_reclamante || null,
            tipo_recurso_banco: juditData.tipo_recurso_banco || null,
            situacao_processo: juditData.situacao_processo || null,
            transito_julgado: ehTransito || null,
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
            erro_judit: erroJuditFlag,
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
            // Mesma regra do formulário individual: a Judit é fonte da verdade.
            // Para os campos de Tipo de Recurso a Judit é fonte ÚNICA — quando
            // ela não confirma um recurso, o valor antigo (possivelmente errado)
            // é APAGADO (gravado como NULL). Para os demais campos, sobrescreve
            // apenas quando a Judit retornou um valor.
            const updateFields: any = {};
            // Tipos de recurso: sempre sobrescreve (inclui null para apagar).
            updateFields.tipo_recurso = juditData.tipo_recurso ?? null;
            updateFields.tipo_recurso_reclamante = juditData.tipo_recurso_reclamante ?? null;
            updateFields.tipo_recurso_banco = juditData.tipo_recurso_banco ?? null;
            if (juditData.relator) updateFields.relator = juditData.relator;
            if (juditData.turma) updateFields.turma = juditData.turma;
            if (tribunalMapeado) updateFields.tribunal = tribunalMapeado;
            if (recorrenteJudit) updateFields.recorrente = recorrenteJudit;
            if (reclamanteJudit) updateFields.reclamante = reclamanteJudit;
            if (reclamadaJudit) updateFields.reclamada = reclamadaJudit;
            if (juditData.situacao_processo) updateFields.situacao_processo = juditData.situacao_processo;
            if (ehTransito) updateFields.transito_julgado = true;
            if (juditData.data_distribuicao) {
              updateFields.data_distribuicao_real = juditData.data_distribuicao;
              updateFields.data_distribuicao = juditData.data_distribuicao;
            }
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
            // Sempre reavalia o flag erro_judit com a turma final (mesmo que turma não tenha mudado)
            updateFields.erro_judit = erroJuditFlag;

            if (Object.keys(updateFields).length > 0) {
              const { data: upd, error: updErr } = await (supabase
                .from("dados_benner" as any)
                .update(updateFields as any)
                .eq("processo", proc.processo_numero)
                .select("id") as any);
              if (updErr) {
                console.warn("[bulk-judit] update error", proc.processo_numero, updErr.message);
              } else if (!upd || (upd as any[]).length === 0) {
                console.warn("[bulk-judit] update bloqueado por RLS", proc.processo_numero);
              } else {
                successCount++;
              }
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
    // Recarrega a lista e os stats para refletir judit_preenchido / dados atualizados
    try { await fetchDados(); } catch {}
    try { refetchStats(); } catch {}
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

  if (showCarga) {
    return (
      <MainLayout title="Distribuição TST - Carga Benner">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
              Carga Benner
            </h1>
            <Button variant="outline" onClick={() => { setShowCarga(false); setCargaDistribuicoes(null); setCargaIdsAllowed(null); }}>Voltar à Lista</Button>
          </div>
          <CargaBennerFromDb 
            selectedProcessNumbers={selectedIds.size > 0 ? dados.filter(d => selectedIds.has(d.id)).map(d => d.processo_numero) : undefined}
            distribuicoes={cargaDistribuicoes || undefined}
            idsAllowed={cargaIdsAllowed || undefined}
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
        <div className="max-w-7xl mx-auto px-2">
          <DistribuicaoTstDetail
            dado={editando}
            initialTab={detailInitialTab}
            onSaveDistribuicao={async (d, id) => {
              const result = await saveDado(d, id);
              const savedId = typeof result === "string" ? result : (id || null);
              if (savedId) { setStickyId(savedId); setHighlightUntil(Date.now() + 8000); }
              return result;
            }}
            onSaveBenner={async (d, id) => {
              const result = await handleSaveBenner(d, id);
              const savedId = typeof result === "string" ? result : (id || null);
              if (savedId) { setStickyId(savedId); setHighlightUntil(Date.now() + 8000); }
              return result;
            }}
            onAfterJuditSync={async (newId?: string) => {
              // Após o auto-save do botão Judit, recarrega o registro atual
              // do banco e atualiza `editando` para que `judit_preenchido=true`
              // e os campos preenchidos fiquem destacados em verde mesmo
              // após sair e voltar.
              // Se for um registro recém-criado (Novo registro + Judit), usa o
              // `newId` retornado pelo auto-save para popular `editando` e
              // habilitar as abas dependentes (Log Judit, Análise, Benner).
              const id = editando?.id || newId;
              if (!id) return;
              const { data } = await supabase
                .from("dados_benner" as any)
                .select("*")
                .eq("id", id)
                .maybeSingle();
              if (data) {
                const b: any = data;
                const relatorFav = b.posicao_relator_favoravel ? "POSITIVO" : b.posicao_relator_desfavoravel ? "NEGATIVO" : null;
                const turmaFav = b.posicao_turma_favoravel ? "POSITIVA" : b.posicao_turma_desfavoravel ? "NEGATIVA" : null;
                setEditando({
                  ...((editando as any) || {}),
                  ...b,
                  id,
                  processo_numero: b.processo || editando?.processo_numero || "",
                  parte_recorrente: b.recorrente ?? null,
                  relator_favorabilidade: relatorFav,
                  turma_favorabilidade: turmaFav,
                  judit_preenchido: !!b.judit_preenchido,
                } as any);
              }
              if (id) { setStickyId(id); setHighlightUntil(Date.now() + 8000); }
              handleRefresh();
            }}
            onClose={() => {
              setShowForm(false);
              setEditando(null);
              setDetailInitialTab("distribuicao");
              try { fetchDados(); } catch {}
              try { refetchStats(); } catch {}
              try { refetchResponsavelCounts(); } catch {}
            }}
          />
        </div>
      </MainLayout>
    );
  }

  const mesesLabels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const delegarButton = isAdminOrCoordinator ? (
    <Button
      size="sm"
      className="h-8 text-xs"
      onClick={() => setDelegarOpen(true)}
      disabled={selectedIds.size === 0}
    >
      <UserPlus className="w-3 h-3 mr-1" /> Delegar{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
    </Button>
  ) : null;

  return (
    <MainLayout
      title="Distribuição TST"
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMostrarCards(v => !v)}
            className="text-muted-foreground hover:text-foreground"
            title={mostrarCards ? "Ocultar cards totalizadores" : "Mostrar cards totalizadores"}
            aria-label={mostrarCards ? "Ocultar cards totalizadores" : "Mostrar cards totalizadores"}
          >
            {mostrarCards ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMostrarFiltros(v => !v)}
            className="text-muted-foreground hover:text-foreground"
            title={mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
            aria-label={mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
          >
            {mostrarFiltros ? <SlidersHorizontal className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4 opacity-50" />}
          </Button>
          <Button
            onClick={() => gerarManualDistribuicaoTst()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            title="Baixa o manual completo em PDF: cards, filtros, botões, importações, Judit, Kanban e dicas."
          >
            <FileText className="w-4 h-4 mr-2" /> M. Instruções
          </Button>
          <Button
            variant="outline"
            onClick={handleGerarRelatorioExcel}
            disabled={xlsxRunning}
            title="Gera uma planilha Excel obedecendo os filtros: Processo, Dossiê, Equipe, Data da Distribuição, Responsável, Situação do Processo, Status do Envio, Em Análise e Situação Carga Santander."
          >
            {xlsxRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            {xlsxRunning
              ? (xlsxProgress.total > 0 ? `Gerando Excel ${xlsxProgress.current}/${xlsxProgress.total}` : "Gerando Excel...")
              : selectedIds.size > 0
                ? `Relatório Excel (${selectedIds.size})`
                : "Relatório Excel"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap justify-end items-center">
          {isAdminOrCoordinator && (
            <>
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
              <CertidaoPdfImport onImported={handleRefresh} />
              <DistribuicaoTstImport onImported={handleRefresh} />
              <DossieUpdateImport onUpdated={handleRefresh} />
              <EquipeUpdateImport onUpdated={handleRefresh} />
              {isAdmin && <SituacaoEnvioUpdateImport onUpdated={handleRefresh} />}
              <Link to="/dados-benner">
                <Button variant="outline">
                  <ExternalLink className="w-4 h-4 mr-2" /> Dados Benner
                </Button>
              </Link>
              <Link to="/distribuicao-tst/kanban">
                <Button variant="outline">
                  <LayoutGrid className="w-4 h-4 mr-2" /> Kanban Delegação
                </Button>
              </Link>
              {isAdmin && (
                <Link to="/distribuicao-tst/arquivados">
                  <Button variant="outline">
                    <Archive className="w-4 h-4 mr-2" /> Arquivados
                  </Button>
                </Link>
              )}
              <BennerSimImport onUpdated={handleRefresh} />
              <DossiesNaoLocalizadosButton filters={debouncedFilters} selectedIds={selectedIds} />
              <Button variant="secondary" onClick={handleGerarCarga} disabled={cargaLoading}>
                {cargaLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                {cargaLoading
                  ? "Carregando..."
                  : selectedIds.size > 0
                    ? `Carga Benner (${selectedIds.size})`
                    : "Gerar Carga Benner"}
              </Button>
            </>
          )}
        </div>

        {/* Stats Cards (respeitam os filtros e são clicáveis) */}
        {mostrarCards && (
          <DistribuicaoTstStatsCards
            stats={statsWithGeral}
            loading={statsLoading}
            activeKey={activeCardKey}
            onCardClick={handleCardClick}
            responsavelCard={(() => {
              const me = user?.id ? responsavelCounts.find(c => c.id === user.id) : null;
              return { atribuidos: me?.count ?? 0, prontos: me?.pronto ?? 0 };
            })()}
            onResponsavelClick={() => {
              if (!user?.id) return;
              // Reseta filtros conflitantes
              setFiltroProcessoStatus("todos");
              setFiltroDossieStatus("todos");
              setFiltroJudit("todos");
              setFiltroBenner("todos");
              setFiltroSituacaoProcesso("todos");
              setFiltroSemTurma(false);
              setFiltroProblemaJudit("todos");
              setFiltroEquipe("todos");
              setFiltroDataInicio("");
              setFiltroDataFim("");
              setFiltroMesAno("todos");
              setSelectedIds(new Set());
              // Filtra por meu usuário + apenas Prontos
              setFiltroResponsavelIds([user.id]);
              setFiltroStatus("pronto_envio");
            }}
          />
        )}

        {/* Totais por responsável — visível apenas para administradores. */}
        {mostrarCards && isAdmin && responsavelCounts.filter(c => c.count > 0).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground self-center mr-1">
              Por responsável:
            </span>
            {responsavelCounts.filter(c => c.count > 0).map((c) => {
              const active = filtroResponsavelIds.includes(c.id);
              const faltam = Math.max(0, c.count - (c.pronto || 0));
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFiltroResponsavelIds(active ? [] : [c.id])}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all hover:shadow-sm ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                  title={`${c.nome} — Total: ${c.count} • Pronto: ${c.pronto} • Faltam: ${faltam}`}
                >
                  <span className="truncate max-w-[160px]">{c.nome}</span>
                  <span
                    className="rounded-sm bg-muted px-1.5 py-0.5 font-bold tabular-nums"
                    title="Total"
                  >
                    {c.count}
                  </span>
                  <span
                    className="rounded-sm bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 font-bold tabular-nums"
                    title="Pronto (finalizadas)"
                  >
                    {c.pronto}
                  </span>
                  <span
                    className={`rounded-sm px-1.5 py-0.5 font-bold tabular-nums ${
                      faltam > 0
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                    title="Faltam"
                  >
                    {faltam}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Mês/Ano dropdown — apenas admin/coordenador */}
        {mesesAnos.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {isAdminOrCoordinator && (
              <>
                <Label className="text-xs font-bold text-muted-foreground">Mês/Ano:</Label>
                <Select value={filtroMesAno} onValueChange={setFiltroMesAno}>
                  <SelectTrigger className="h-8 text-xs w-64">
                    <SelectValue placeholder="Selecione o mês/ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">
                      Todos meses ({mesesAnos.reduce((s, m) => s + m.count, 0)})
                    </SelectItem>
                    {mesesAnos.map(({ key, count }) => {
                      const [y, m] = key.split("-");
                      const label = `${mesesLabels[parseInt(m) - 1]}/${y}`;
                      return (
                        <SelectItem key={key} value={key}>
                          {label} ({count})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <div className="h-6 w-px bg-border mx-1" />
              </>
            )}

            {delegarButton}
            {isAdminOrCoordinator && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => { scrollPageToTop(); setDetailInitialTab("distribuicao"); setShowForm(true); }}
              >
                <Plus className="w-3 h-3 mr-1" /> Nova Distribuição
              </Button>
            )}
            {isAdminOrCoordinator && (
              <Button
                size="sm"
                onClick={() => setAutoDistOpen(true)}
                disabled={totalCount === 0}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                title="Divide automaticamente todos os processos do filtro atual entre os advogados selecionados (round-robin)."
              >
                <Shuffle className="w-3 h-3 mr-1" /> Distribuir automaticamente
                {totalCount > 0 ? ` (${totalCount})` : ""}
              </Button>
            )}
            {isAdminOrCoordinator && (
              <>
                <Button
                  size="sm"
                  onClick={async () => {
                    const ids = Array.from(selectedIds);
                    if (!ids.length) { toast.warning("Selecione registros primeiro"); return; }
                    const BATCH = 200;
                    for (let i = 0; i < ids.length; i += BATCH) {
                      const batch = ids.slice(i, i + BATCH);
                      const { error } = await supabase.from("dados_benner" as any).update({ subida_em_massa: true } as any).in("id", batch);
                      if (error) { toast.error("Erro: " + error.message); return; }
                    }
                    toast.success(`${ids.length} marcado(s) como Subida em Massa`);
                    setSelectedIds(new Set());
                    handleRefresh();
                  }}
                  disabled={selectedIds.size === 0}
                  className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                  title="Marca os processos selecionados como Subida em Massa"
                >
                  <Layers className="w-3 h-3 mr-1" /> Marcar Subida em Massa
                  {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ids = Array.from(selectedIds);
                    if (!ids.length) { toast.warning("Selecione registros primeiro"); return; }
                    const BATCH = 200;
                    for (let i = 0; i < ids.length; i += BATCH) {
                      const batch = ids.slice(i, i + BATCH);
                      const { error } = await supabase.from("dados_benner" as any).update({ subida_em_massa: false } as any).in("id", batch);
                      if (error) { toast.error("Erro: " + error.message); return; }
                    }
                    toast.success(`${ids.length} desmarcado(s) de Subida em Massa`);
                    setSelectedIds(new Set());
                    handleRefresh();
                  }}
                  disabled={selectedIds.size === 0}
                  className="h-8 text-xs border-purple-500 text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/30"
                  title="Remove a marca Subida em Massa dos processos selecionados"
                >
                  <X className="w-3 h-3 mr-1" /> Desmarcar Subida em Massa
                  {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={handleBulkJudit}
              disabled={bulkJuditRunning}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {bulkJuditRunning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
              {bulkJuditRunning
                ? `Judit ${bulkJuditProgress.current}/${bulkJuditProgress.total}`
                : selectedIds.size > 0
                  ? `Preencher c/ Judit (${selectedIds.size})`
                  : "Preencher com Judit"}
            </Button>
            <label
              className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none px-1"
              title="Inclui a lista de anexos do processo (consulta Judit mais cara)."
            >
              <Checkbox
                checked={bulkComAnexos}
                onCheckedChange={(v) => setBulkComAnexos(v === true)}
                disabled={bulkJuditRunning}
              />
              Com anexos
            </label>
            {bulkJuditRunning && (
              <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => { bulkAbortRef.current = true; }}>
                <X className="w-3 h-3 mr-1" /> Cancelar
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleMarcarPronto} disabled={selectedIds.size === 0}>
              <CheckCircle className="w-3 h-3 mr-1" /> Marcar como Pronto{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleMarcarEnviado} disabled={selectedIds.size === 0}>
              <Send className="w-3 h-3 mr-1" /> Marcar como Enviado{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
              onClick={handleMarcarEmAnalise}
              disabled={selectedIds.size === 0}
              title="Trava esses registros como 'Em análise' — eles ficam estáveis na lista até você finalizar"
            >
              <Filter className="w-3 h-3 mr-1" /> Marcar Em Análise{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleFinalizarAnalise}
              disabled={selectedIds.size === 0}
              title="Remove a marca 'Em análise' dos registros selecionados"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Finalizar Análise{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            {isAdmin && <RespostaSantanderImport onUpdated={handleRefresh} />}
            {isAdminOrCoordinator && (
              <BulkTagAction
                selectedIds={Array.from(selectedIds)}
                filters={debouncedFilters}
                totalFiltered={totalCount}
              />
            )}
          </div>
        )}

        {/* Filters */}
        {mostrarFiltros && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1 flex-1 min-w-[220px] max-w-xs">
              <Label className="text-[10px] font-semibold text-muted-foreground">Responsáveis</Label>
              <ResponsaveisSelector
                selectedIds={filtroResponsavelIds}
                onChange={setFiltroResponsavelIds}
                placeholder="Todos os responsáveis"
                coordenacaoId="3e47fc83-3539-4fa7-9fcf-33825120e1b7"
                includeUnassignedOption
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] font-semibold text-muted-foreground">Data inicial</Label>
              <Input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className="h-8 text-xs w-[140px]" title="Data início" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] font-semibold text-muted-foreground">Data final</Label>
              <Input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className="h-8 text-xs w-[140px]" title="Data fim" />
            </div>
            <div className="ml-auto">
              {hasFilters && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 shadow-md hover:shadow-lg transition-all font-semibold"
                >
                  <X className="w-4 h-4 mr-1" /> Limpar Filtros
                </Button>
              )}
            </div>
          </div>
          {/* Busca por texto livre */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input placeholder="Buscar por Processo" value={filtroProcesso} onChange={e => setFiltroProcesso(formatProcessoNumero(e.target.value) === "-" ? e.target.value : formatProcessoNumero(e.target.value))} className="h-8 text-xs pl-7" />
              </div>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input placeholder="Buscar por Dossiê" value={filtroDossie} onChange={e => setFiltroDossie(formatProcessoNumero(e.target.value) === "-" ? e.target.value : formatProcessoNumero(e.target.value))} className="h-8 text-xs pl-7" />
              </div>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input placeholder="Buscar por Parte Recorrente" value={filtroParte} onChange={e => setFiltroParte(e.target.value)} className="h-8 text-xs pl-7" />
              </div>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input placeholder="Buscar por Nome da Parte (Reclamante/Reclamada)" value={filtroNomeParte} onChange={e => setFiltroNomeParte(e.target.value)} className="h-8 text-xs pl-7" />
              </div>
            </div>
          </div>

          {/* Filtros por categoria (listas) */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Filter className="w-3 h-3" />
              Filtros por categoria (selecione uma opção)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {/* VERDE */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-green-600">Benner</Label>
                <Select value={filtroBenner} onValueChange={setFiltroBenner}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Benner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-green-600">Judit</Label>
                <Select value={filtroJudit} onValueChange={setFiltroJudit}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Judit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sim">Preenchido com Judit</SelectItem>
                    <SelectItem value="nao">Não preenchido com Judit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* VERMELHO — apenas admin/coordenador */}
              {isAdminOrCoordinator && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-red-600">TAGs</Label>
                  <Select value={filtroTagId} onValueChange={setFiltroTagId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="TAGs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {tagsCatalogo.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: t.cor }}
                            />
                            {t.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* LARANJA */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-orange-600">Em análise</Label>
                <Select value={filtroEmAnalise} onValueChange={setFiltroEmAnalise}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Em análise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sim">Apenas Em análise</SelectItem>
                    <SelectItem value="nao">Não em análise</SelectItem>
                    <SelectItem value="analisado">Analisado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-blue-600">Provas Digitais</Label>
                <Select value={filtroProvasDigitais} onValueChange={setFiltroProvasDigitais}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Provas Digitais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="sim">Com Provas Digitais (S)</SelectItem>
                    <SelectItem value="nao">Sem Provas Digitais (N)</SelectItem>
                    <SelectItem value="nao_selecionado">Não selecionado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-blue-600">Status envio</Label>
                <Select
                  value={filtroProblemaJudit === "sim" ? "problema_judit" : filtroStatus}
                  onValueChange={(v) => {
                    if (v === "problema_judit") {
                      setFiltroProblemaJudit("sim");
                      setFiltroStatus("todos");
                    } else {
                      setFiltroProblemaJudit("todos");
                      setFiltroStatus(v);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Status envio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="pronto_envio">Pronto para Enviar</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="planilhado">Planilhado</SelectItem>
                    <SelectItem value="problema_judit">Problema Judit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* AZUL */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-blue-600">Equipe</Label>
                <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* SEM COR */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground">Aba origem</Label>
                <Select value={filtroAba} onValueChange={setFiltroAba}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Aba origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {abas.map(({ aba, count }) => (
                      <SelectItem key={aba} value={aba}>{aba} ({count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground">Dossiê</Label>
                <Select value={filtroDossieStatus} onValueChange={setFiltroDossieStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Dossiê" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="preenchido">Preenchido</SelectItem>
                    <SelectItem value="nao_preenchido">Não Preenchido</SelectItem>
                    <SelectItem value="valido">Preenchido Válido</SelectItem>
                    <SelectItem value="invalido">Preenchido Inválido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground">Processo</Label>
                <Select value={filtroProcessoStatus} onValueChange={setFiltroProcessoStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Processo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="valido">Válido (CNJ)</SelectItem>
                    <SelectItem value="invalido">Inválido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground">Duplicados</Label>
                <Select value={filtroDuplicado} onValueChange={setFiltroDuplicado}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Duplicados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sim">Apenas duplicados</SelectItem>
                    <SelectItem value="nao">Apenas não duplicados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground">Origem importação</Label>
                <Select value={filtroFonteImportacao} onValueChange={setFiltroFonteImportacao}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Origem importação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="Resposta Santander">Resposta Santander</SelectItem>
                    <SelectItem value="Certidão TST">Certidão TST (PDF)</SelectItem>
                    <SelectItem value="Planilha Distribuição">Planilha Distribuição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground">Situação processo</Label>
                <Select value={filtroSituacaoProcesso} onValueChange={setFiltroSituacaoProcesso}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="transito">Trânsito em Julgado</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                    <SelectItem value="outro_escritorio">Processo outro escritório</SelectItem>
                    <SelectItem value="segredo_justica">Segredo de Justiça</SelectItem>
                    <SelectItem value="a_fazer">A fazer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground">Subida em massa</Label>
                <Select value={filtroSubidaMassa} onValueChange={setFiltroSubidaMassa}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Subida em massa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
        )}

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

        {/* Table container */}
        <div className="border rounded-lg overflow-x-auto">
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
                {([
                  { key: "data_distribuicao_planilha" as const, label: "Data Plan." },
                  { key: "data_distribuicao_real" as const, label: "Data Real" },
                  { key: "processo_numero" as const, label: "Processo" },
                  { key: "dossie" as const, label: "Dossiê" },
                  { key: "responsaveis" as const, label: "Responsáveis" },
                  { key: "benner_atualizado" as const, label: "Benner" },
                ]).map((h) => (
                  <TableHead key={h.key}>
                    <button
                      type="button"
                      onClick={() => handleSort(h.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {h.label}
                      {sortBy === h.key ? (
                        sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                ))}
                {isAdminOrCoordinator && <TableHead className="w-28">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={isAdminOrCoordinator ? 9 : 8} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={isAdminOrCoordinator ? 9 : 8} className="text-center py-8 text-muted-foreground">Nenhuma distribuição encontrada</TableCell></TableRow>
              ) : dadosOrdenados.map(d => {
                const isPresidencia = (d.turma || "").toLowerCase().includes("presid");
                const relatorClass = isPresidencia
                  ? ""
                  : d.relator_favorabilidade?.toLowerCase().includes("positiv")
                    ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                    : d.relator_favorabilidade?.toLowerCase().includes("negativ")
                      ? "text-destructive font-semibold"
                      : "";
                const turmaClass = isPresidencia
                  ? ""
                  : d.turma_favorabilidade?.toLowerCase().includes("positiv")
                    ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                    : d.turma_favorabilidade?.toLowerCase().includes("negativ")
                      ? "text-destructive font-semibold"
                      : "";
                const responsaveis = responsaveisMap.get(d.id) || [];
                const isPronto = ((d as any).status || "") === "pronto_envio";
                const hasProvasDigitais = String((d as any).provas_digitais || "").trim().toLowerCase() === "s";
                const isSubidaMassa = !!(d as any).subida_em_massa || /subida\s+em\s+massa/i.test(d.relator || "");
                const isOutroEscritorio = (d as any).processo_outro_escritorio === true;
                const isSegredo = (d as any).segredo_justica === true;
                const isProblemaJudit = (d as any).problema_judit === true;
                const isRecursoTerceiro = (d as any).recurso_terceiro === true;
                const isCejusc = (d as any).cejusc === true;
                const relatorDisplay = (d.relator || "").replace(/subida\s+em\s+massa.*$/i, "").trim().replace(/[-–—:]\s*$/, "").trim();
                return (
                <TableRow
                  key={d.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 align-middle",
                    (d as any).em_analise && "bg-amber-50/60 dark:bg-amber-950/20 border-l-2 border-l-amber-500"
                  )}
                  onClick={() => { scrollPageToTop(); setDetailInitialTab("distribuicao"); setEditando(d); }}
                >
                  <TableCell className="align-middle" onClick={e => e.stopPropagation()}>
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
                  <TableCell className="text-xs whitespace-nowrap align-middle">{formatDate(d.data_distribuicao_planilha || d.data_distribuicao_real)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap align-middle">{formatDate(d.data_distribuicao_real)}</TableCell>
                  <TableCell className="text-xs align-middle">
                    {(() => {
                      const raw = d.processo_numero || "";
                      const cnjMatch = raw.match(/^(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})(.*)$/);
                      const situacao = (d.situacao_processo || "").toLowerCase();
                       const isTransito = (d as any).transito_julgado === true;
                      const isAtivo = situacao.trim() === "ativo";
                      const situacaoClass = isTransito
                        ? "text-destructive font-semibold"
                        : isAtivo
                        ? "text-blue-600 dark:text-blue-400 font-semibold"
                        : "";
                      if (cnjMatch) {
                        const numero = cnjMatch[1];
                        const resto = cnjMatch[2].trim();
                        return (
                          <div className="space-y-0.5">
                            <div className={cn("whitespace-nowrap inline-flex items-center gap-1", situacaoClass)}>
                              <span>{numero}</span>
                              <CopyButton value={numero} label="Processo" />
                              {(d as any).em_analise && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500 text-amber-700 dark:text-amber-400">
                                  Em análise
                                </Badge>
                              )}
                              {(d as any).ic_duplicado && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4" title="Processo duplicado (mais de uma linha com o mesmo número)">
                                  Dup.
                                </Badge>
                              )}
                              {isPronto && (
                                <Badge className="text-[10px] px-1 py-0 h-4 bg-emerald-600 hover:bg-emerald-600 text-white" title="Pronto para enviar">
                                  Pronto
                                </Badge>
                              )}
                              {hasProvasDigitais && (
                                <Badge className="text-[10px] px-1 py-0 h-4 bg-blue-600 hover:bg-blue-600 text-white" title="Possui provas digitais">
                                  Provas Digitais
                                </Badge>
                              )}
                              {isTransito && (
                                <Badge className="text-[10px] px-1 py-0 h-4 bg-orange-500 hover:bg-orange-500 text-white" title="Trânsito em Julgado">
                                  Trans. Julgado
                                </Badge>
                              )}
                              {isSubidaMassa && (
                                <Badge className="text-[10px] px-1 py-0 h-4 bg-purple-600 hover:bg-purple-600 text-white" title="Relator marcado como Subida em Massa">
                                  Subida em Massa
                                </Badge>
                              )}
                              {isOutroEscritorio && (
                                <Badge className="text-[10px] px-1 py-0 h-4 bg-violet-600 hover:bg-violet-600 text-white" title="Processo de outro escritório">
                                  Outro escritório
                                </Badge>
                              )}
                              {isSegredo && (
                                <Badge className="text-[10px] px-1 py-0 h-4 bg-rose-600 hover:bg-rose-600 text-white" title="Segredo de Justiça">
                                  Segredo de Justiça
                                </Badge>
                              )}
                              {isProblemaJudit && (
                                <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-500 hover:bg-amber-500 text-white" title="Problema Judit">
                                  Problema Judit
                                </Badge>
                              )}
                              {isRecursoTerceiro && (
                                <Badge className="text-[10px] px-1 py-0 h-4 bg-indigo-600 hover:bg-indigo-600 text-white" title="Recurso de terceiro">
                                  Recurso de terceiro
                                </Badge>
                              )}
                              {isCejusc && (
                                <Badge className="text-[10px] px-1 py-0 h-4 bg-teal-600 hover:bg-teal-600 text-white" title="CEJUSC">
                                  CEJUSC
                                </Badge>
                              )}
                            </div>
                            {isAdminOrCoordinator && (
                              <div className="mt-1">
                                <ProcessoTagPicker
                                  dadoId={d.id}
                                  tagIds={tagsMap?.get(d.id) || []}
                                  compact
                                />
                              </div>
                            )}
                            {resto && <div className="text-xs text-muted-foreground italic">{resto}</div>}
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-0.5">
                        <div className={cn("break-words inline-flex items-center gap-1", situacaoClass)}>
                          <span>{raw}</span>
                          {raw && <CopyButton value={raw} label="Processo" />}
                          {(d as any).em_analise && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500 text-amber-700 dark:text-amber-400">
                              Em análise
                            </Badge>
                          )}
                          {(d as any).ic_duplicado && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4" title="Processo duplicado (mais de uma linha com o mesmo número)">
                              Dup.
                            </Badge>
                          )}
                          {isPronto && (
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-emerald-600 hover:bg-emerald-600 text-white" title="Pronto para enviar">
                              Pronto
                            </Badge>
                          )}
                          {hasProvasDigitais && (
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-blue-600 hover:bg-blue-600 text-white" title="Possui provas digitais">
                              Provas Digitais
                            </Badge>
                          )}
                          {isTransito && (
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-orange-500 hover:bg-orange-500 text-white" title="Trânsito em Julgado">
                              Trans. Julgado
                            </Badge>
                          )}
                          {isSubidaMassa && (
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-purple-600 hover:bg-purple-600 text-white" title="Relator marcado como Subida em Massa">
                              Subida em Massa
                            </Badge>
                          )}
                          {isOutroEscritorio && (
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-violet-600 hover:bg-violet-600 text-white" title="Processo de outro escritório">
                              Outro escritório
                            </Badge>
                          )}
                          {isSegredo && (
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-rose-600 hover:bg-rose-600 text-white" title="Segredo de Justiça">
                              Segredo de Justiça
                            </Badge>
                          )}
                          {isProblemaJudit && (
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-500 hover:bg-amber-500 text-white" title="Problema Judit">
                              Problema Judit
                            </Badge>
                          )}
                          {isRecursoTerceiro && (
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-indigo-600 hover:bg-indigo-600 text-white" title="Recurso de terceiro">
                              Recurso de terceiro
                            </Badge>
                          )}
                          {isCejusc && (
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-teal-600 hover:bg-teal-600 text-white" title="CEJUSC">
                              CEJUSC
                            </Badge>
                          )}
                        </div>
                        {isAdminOrCoordinator && (
                          <div className="mt-1">
                            <ProcessoTagPicker
                              dadoId={d.id}
                              tagIds={tagsMap?.get(d.id) || []}
                              compact
                            />
                          </div>
                        )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap align-middle" onClick={e => e.stopPropagation()}>
                    {d.dossie ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="text-primary hover:underline disabled:opacity-50"
                          onClick={() => handleOpenBenner(d)}
                          disabled={loadingBenner === d.id}
                          title="Abrir Dados Benner"
                        >
                          {d.dossie}
                        </button>
                        <CopyButton value={d.dossie} label="Dossiê" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-orange-500 hover:underline italic disabled:opacity-50"
                        onClick={() => handleOpenBenner(d)}
                        disabled={loadingBenner === d.id}
                        title="Abrir Dados Benner"
                      >
                        Não localizado
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-xs align-middle">
                    {responsaveis.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {responsaveis.map(r => (
                          <Badge key={r.id} variant="secondary" className="text-xs px-1.5 py-0 font-normal">{r.nome}</Badge>
                        ))}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="align-middle">
                    {d.benner_atualizado ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </TableCell>
                  {isAdminOrCoordinator && (
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleSubidaMassaRow(d.id, !isSubidaMassa, d.processo_numero)}
                          title={isSubidaMassa ? "Desmarcar Subida em Massa" : "Marcar Subida em Massa"}
                        >
                          <Layers className={`w-4 h-4 ${isSubidaMassa ? "text-purple-600" : "text-muted-foreground/60"}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)} title="Arquivar (não exclui)">
                          <Trash2 className="w-4 h-4 text-amber-600" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
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
      <DelegarProcessosDialog
        open={delegarOpen}
        onOpenChange={setDelegarOpen}
        selectedIds={Array.from(selectedIds)}
        onSuccess={async () => { setSelectedIds(new Set()); await Promise.resolve(handleRefresh()); }}
      />
      <DistribuirAutomaticoDialog
        open={autoDistOpen}
        onOpenChange={setAutoDistOpen}
        filters={debouncedFilters}
        totalCount={totalCount}
        onSuccess={async () => { setSelectedIds(new Set()); await Promise.resolve(handleRefresh()); }}
      />
      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => { if (!o) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar distribuição?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro será movido para a área de arquivados e deixará de aparecer aqui.
              Apenas administradores poderão consultar ou restaurar registros arquivados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-amber-600 text-white hover:bg-amber-700">
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
