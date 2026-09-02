import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Trash2, ExternalLink, Search, X, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileSpreadsheet, Download, Database, ArrowLeft, FileText, CheckCircle, Send, Filter, UserPlus, LayoutGrid, Shuffle, Eye, EyeOff, SlidersHorizontal, Layers, Archive, ArrowUp, ArrowDown, ArrowUpDown, Mail, BarChart3, ChevronDown, Zap } from "lucide-react";
import { DistribuicaoTstStatsCards } from "@/components/distribuicao-tst/DistribuicaoTstStatsCards";
import { useResponsaveisCounts } from "@/hooks/useResponsaveisCounts";
import { useProfilesBasic } from "@/hooks/useDistribuicaoResponsaveis";

/** Coordenação responsável pela Distribuição TST */
export const COORDENACAO_TST_ID = "3e47fc83-3539-4fa7-9fcf-33825120e1b7";
/** Pseudo-id usado pela RPC para agrupar processos sem responsável */
const SEM_RESPONSAVEL_UUID = "00000000-0000-0000-0000-000000000000";
import { useDistribuicaoTstStats } from "@/hooks/useDistribuicaoTstStats";
import { useProntoSemPendenciaCount } from "@/hooks/useProntoSemPendenciaCount";
import { useProntoSemPendenciaPorResponsavel } from "@/hooks/useProntoSemPendenciaPorResponsavel";
import { fetchAllFilteredBennerIds, fetchProcessosComPartes, gerarRelatorioPartesPdf, buildFiltrosResumo } from "@/lib/relatorioPartesPdf";
import { gerarRelatorioExcelDistribuicaoTst } from "@/lib/relatorioExcelDistribuicaoTst";
import { TotalPorSituacaoCard } from "@/components/distribuicao-tst/TotalPorSituacaoCard";
import { Checkbox } from "@/components/ui/checkbox";
import { useDistribuicoesTst, DistribuicaoTst as DistTst, DistribuicaoTstFilters, fetchAllDistribuicaoTstIds, applyParteRecorrenteFilter } from "@/hooks/useDistribuicoesTst";
import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";
import { parseMateriasString } from "@/components/distribuicao-tst/MateriasMultiSelect";
import { isOutraMateria, normalizeMateriaNome } from "@/utils/outraMateria";
import { useMateriasPedidosOficiais } from "@/hooks/useMateriasPedidosOficiais";
import { DistribuicaoTstDetail } from "@/components/distribuicao-tst/DistribuicaoTstDetail";
// Importações (Importar Planilha / PDF Certidão / Atualizar Dossiês / Equipe / Situação Envio / Resposta Santander)
// foram movidas para Admin TST → Importações Distribuição TST.
import { CargaBennerFromDb } from "@/components/distribuicao-tst/CargaBennerFromDb";
import { DossiesNaoLocalizadosButton } from "@/components/distribuicao-tst/DossiesNaoLocalizadosButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { buildJuditPatch, persistirPartesJudit } from "@/lib/juditDistribuicaoTst";
import { useTurmasTst, useRelatoresTst } from "@/hooks/useClassificacaoTst";
import { useSituacoesEnvioCarga } from "@/hooks/useSituacoesEnvioCarga";
import {
  useProcessoTagsCatalogo,
  useTagsForDados,
} from "@/hooks/useProcessoTags";
import { ProcessoTagPicker } from "@/components/distribuicao-tst/ProcessoTagPicker";
import { BulkTagAction } from "@/components/distribuicao-tst/BulkTagAction";
import { useQuery } from "@tanstack/react-query";
import { gerarManualDistribuicaoTst } from "@/utils/gerarManualDistribuicaoTst";
import { ensureMateriasOficiais } from "@/utils/materiasOficiaisCache";
import {
  getPendencias,
  pendenciasResumo,
  COLUNAS_SELECT_PRONTO_SEM_PENDENCIA,
} from "@/utils/distribuicaoTstPendencias";
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

const TAG_FILTER_PENDING_ID = "00000000-0000-0000-0000-000000000000";

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
  // Lista oficial de pedidos: necessária para acusar pendência quando todas as
  // matérias selecionadas estão fora da lista.
  useEffect(() => {
    ensureMateriasOficiais().catch(() => {});
  }, []);
  const [showForm, setShowForm] = useState(false);

  const [mostrarCards, setMostrarCards] = useState(true);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [editando, setEditando] = useState<DistTst | null>(null);
  type SortKey = "data_distribuicao_planilha" | "data_distribuicao_real" | "processo_numero" | "dossie" | "responsaveis" | "benner_atualizado";
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [sortPrefLoaded, setSortPrefLoaded] = useState(false);
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

  // Carrega a preferência de ordenação salva no perfil do usuário
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("pref_ordenacao_dist_tst")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const pref: any = (data as any)?.pref_ordenacao_dist_tst;
      if (pref?.sortBy) {
        setSortBy(pref.sortBy as SortKey);
        setSortDir(pref.sortDir === "desc" ? "desc" : "asc");
      }
      setSortPrefLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Grava a preferência de ordenação escolhida
  useEffect(() => {
    if (!user?.id || !sortPrefLoaded) return;
    supabase
      .from("profiles")
      .update({ pref_ordenacao_dist_tst: sortBy ? { sortBy, sortDir } : null } as any)
      .eq("id", user.id)
      .then(() => {});
  }, [sortBy, sortDir, sortPrefLoaded, user?.id]);

  const [delegarOpen, setDelegarOpen] = useState(false);
  const [arquivarDupOpen, setArquivarDupOpen] = useState(false);
  const [arquivarDupRunning, setArquivarDupRunning] = useState(false);
  const [autoDistOpen, setAutoDistOpen] = useState(false);
  const [showCarga, setShowCarga] = useState(false);
  const [cargaDistribuicoes, setCargaDistribuicoes] = useState<any[] | null>(null);
  const [cargaIdsAllowed, setCargaIdsAllowed] = useState<string[] | null>(null);
  const [cargaLoading, setCargaLoading] = useState(false);
  
  // Loading flag para os botões "Dados Benner" da tabela (abrem o detalhe na aba Benner).
  const [loadingBenner, setLoadingBenner] = useState<string | null>(null);
  
  // Bulk Judit
  const [bulkJuditRunning, setBulkJuditRunning] = useState(false);
  // Classificação TST carregada uma única vez (usada pelo Judit em lote).
  const { data: turmasTstBulk = [] } = useTurmasTst();
  const { data: relatoresTstBulk = [] } = useRelatoresTst();
  const [bulkJuditProgress, setBulkJuditProgress] = useState({ current: 0, total: 0 });
  const bulkAbortRef = useRef(false);
  // Bulk Judit sempre roda SEM anexos. Anexos só são consultados pelo
  // formulário individual do processo/distribuição, quando o usuário marca
  // explicitamente a caixinha "Com anexos" — evita cobranças caras (R$ 3,75)
  // acidentais na tela principal.

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

  // Card "Total por Situação"
  const [totalSituacaoOpen, setTotalSituacaoOpen] = useState(false);

  // Diálogo "Relatório Dossiês não localizados" (aberto pelo menu Relatórios)
  const [dossiesOpen, setDossiesOpen] = useState(false);

  // Row selection for bulk Judit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [qtdSelecionar, setQtdSelecionar] = useState<string>("");
  const [selecionarQtdLoading, setSelecionarQtdLoading] = useState(false);
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
  const [filtroParteRecorrente, setFiltroParteRecorrente] = useState("");
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
  const [filtroAcordo, setFiltroAcordo] = useState<string>("todos");
  const [filtroDuplicado, setFiltroDuplicado] = useState<string>("todos");
  const [filtroFonteImportacao, setFiltroFonteImportacao] = useState<string>("todas");
  const [filtroProvasDigitais, setFiltroProvasDigitais] = useState<string>("todos");
  const [filtroSituacaoCarga, setFiltroSituacaoCarga] = useState<string>("todas");
  const [filtroEquipe, setFiltroEquipe] = useState<string>("todos");
  // Ativo quando o card "Pronto sem pendência" está selecionado.
  // Complementa filtroStatus="pronto_envio" restringindo aos IDs sem pendências.
  const [filtroSemPendencia, setFiltroSemPendencia] = useState<boolean>(false);
  // Inverso do "pronto sem pendência": tudo que ainda tem alguma pendência.
  const [filtroComPendencia, setFiltroComPendencia] = useState<boolean>(false);
  const { data: situacoesCarga = [] } = useSituacoesEnvioCarga();
  // ===== TAGs (admin/coord) =====
  const [filtroTagId, setFiltroTagId] = useState<string>("todas");
  const { data: tagsCatalogo = [] } = useProcessoTagsCatalogo();
  // O filtro por TAG é resolvido diretamente no banco (índice por tag_id),
  // sem trafegar milhares de ids do navegador.
  // Novo filtro: apenas processos com mais de um responsável.
  const [filtroMultiResp, setFiltroMultiResp] = useState<boolean>(false);

  // ===== Verificar Pendências =====
  // Quando ligado, exibe uma coluna extra na tabela mostrando os campos
  // obrigatórios (vide spec da advogada) ainda em aberto.
  const [mostrarPendencias, setMostrarPendencias] = useState<boolean>(false);
  const [pendenciasRelRunning, setPendenciasRelRunning] = useState(false);

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
        parteRecorrente: filtroParteRecorrente || undefined,
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
        acordo: filtroAcordo !== "todos" ? (filtroAcordo as any) : undefined,
        duplicado: filtroDuplicado !== "todos" ? (filtroDuplicado as any) : undefined,
        fonteImportacao: filtroFonteImportacao !== "todas" ? filtroFonteImportacao : undefined,
        provasDigitais: filtroProvasDigitais !== "todos" ? (filtroProvasDigitais as any) : undefined,
        situacaoEnvioCargaId: filtroSituacaoCarga !== "todas" ? filtroSituacaoCarga : undefined,
        equipe: filtroEquipe !== "todos" ? (filtroEquipe as any) : undefined,
        tagId: filtroTagId !== "todas" && filtroTagId !== "__sem__" ? filtroTagId : undefined,
      });
    }, 400);
    return () => clearTimeout(timer);
}, [filtroProcesso, filtroDossie, filtroDossieStatus, filtroProcessoStatus, filtroTurma, filtroRelator, filtroParte, filtroParteRecorrente, filtroNomeParte, filtroAba, filtroBenner, filtroJudit, filtroErroJudit, filtroSituacaoProcesso, filtroSubidaMassa, filtroMesAno, filtroDataInicio, filtroDataFim, JSON.stringify(filtroResponsavelIds), filtroSemTurma, filtroStatus, filtroEmAnalise, filtroProblemaJudit, filtroAcordo, filtroDuplicado, filtroFonteImportacao, filtroProvasDigitais, filtroSituacaoCarga, filtroEquipe, filtroTagId]);

  // IDs de processos com mais de um responsável, respeitando os demais filtros
  // (ignora filtro de responsável para que a contagem não se anule a si mesma).
  const multiRespFiltersKey = JSON.stringify({ ...debouncedFilters, responsavelIds: undefined });
  const { data: multiRespIds = [] } = useQuery({
    queryKey: ["multi-resp-ids", multiRespFiltersKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_distribuicao_tst_multi_resp_ids" as any,
        { filters: { ...debouncedFilters, responsavelIds: undefined } as any }
      );
      if (error) throw error;
      return ((data as any[]) || []).map((r: any) => r.id as string);
    },
  });

  // Para não-admins, o filtro "A fazer" sempre amarra ao usuário logado,
  // independentemente do select de responsáveis.
  const {
    count: prontoSemPendenciaCount,
    ids: prontoSemPendenciaIds,
    loading: prontoSemPendenciaLoading,
    refetch: refetchProntoSemPendencia,
  } =
    useProntoSemPendenciaCount(debouncedFilters);

  // Universo de IDs filtrados — usado apenas pelo filtro "com pendências".
  const { data: todosIdsFiltrados = [] } = useQuery({
    queryKey: ["todos-ids-filtrados", JSON.stringify(debouncedFilters)],
    enabled: filtroComPendencia,
    queryFn: () => fetchAllDistribuicaoTstIds(debouncedFilters),
  });


  const listFilters = useMemo(() => {
    let f = debouncedFilters;
    if (debouncedFilters.situacaoProcesso === "a_fazer" && !isAdmin && user?.id) {
      f = { ...f, responsavelIds: [user.id] };
    }
    if (filtroMultiResp) {
      // multiRespIds já respeita o filtro por TAG (resolvido no banco).
      f = { ...f, idsAllowed: multiRespIds.length > 0 ? multiRespIds : [TAG_FILTER_PENDING_ID] };
    }
    if (filtroSemPendencia) {
      // Restringe aos IDs "pronto para enviar" sem pendências (calculados no cliente).
      const base = f.idsAllowed && f.idsAllowed.length > 0
        ? prontoSemPendenciaIds.filter((id) => f.idsAllowed!.includes(id))
        : prontoSemPendenciaIds;
      f = { ...f, idsAllowed: base.length > 0 ? base : [TAG_FILTER_PENDING_ID] };
    }
    if (filtroComPendencia) {
      // Complemento: todos os IDs filtrados MENOS os prontos sem pendência.
      const semSet = new Set(prontoSemPendenciaIds);
      const universo = f.idsAllowed && f.idsAllowed.length > 0 ? f.idsAllowed : todosIdsFiltrados;
      const base = universo.filter((id) => !semSet.has(id));
      f = { ...f, idsAllowed: base.length > 0 ? base : [TAG_FILTER_PENDING_ID] };
    }
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debouncedFilters), isAdmin, user?.id, filtroMultiResp, JSON.stringify(multiRespIds), filtroSemPendencia, JSON.stringify(prontoSemPendenciaIds), filtroComPendencia, JSON.stringify(todosIdsFiltrados)]);

  const { dados, responsaveisMap, loading, fetchDados, saveDado, deleteDado, page, setPage, totalCount, totalPages } = useDistribuicoesTst(listFilters, stickyId);

  // "Outra Matéria" é neutra: não gera alerta, pendência nem rejeição.



  // Processos com matéria selecionada FORA da lista oficial de pedidos
  // (tabela materias_pedidos_oficiais — coluna Pedido da planilha Santander).
  const { data: materiasOficiais } = useMateriasPedidosOficiais();
  const oficiaisSet = useMemo(
    () => new Set((materiasOficiais || []).map((m) => normalizeMateriaNome(m.nome))),
    [materiasOficiais],
  );
  const processosComMateriaForaDaLista = useMemo(() => {
    if (oficiaisSet.size === 0) return [];
    const foraDaLista = (s: any) =>
      parseMateriasString(s).filter(
        (n) => !isOutraMateria(n) && !oficiaisSet.has(normalizeMateriaNome(n)),
      );
    return (dados || [])
      .map((d: any) => {
        const partes: string[] = [];
        const materias: string[] = [];
        const fRec = foraDaLista(d.materias_recurso_reclamante);
        if (fRec.length > 0) { partes.push("Reclamante"); materias.push(...fRec); }
        const fBco = foraDaLista(d.materias_recurso_banco);
        if (fBco.length > 0) { partes.push("Banco"); materias.push(...fBco); }
        const fTer = foraDaLista(d.materias_recurso_terceiro);
        if (fTer.length > 0) { partes.push("Terceiro"); materias.push(...fTer); }
        return { id: d.id, processo_numero: d.processo_numero, dossie: d.dossie, partes, materias: [...new Set(materias)] };
      })
      .filter((p) => p.partes.length > 0);
  }, [dados, oficiaisSet]);

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
  // Usa os MESMOS filtros da lista (inclui restrições por etiqueta,
  // "mais de um responsável" e "pronto sem pendência"), apenas ignorando o
  // filtro de responsável para que todos os advogados apareçam nos cards.
  const countsFilters = useMemo(
    () => ({ ...listFilters, responsavelIds: undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(listFilters)]
  );
  const { counts: responsavelCounts, refetch: refetchResponsavelCounts } = useResponsaveisCounts(countsFilters);

  // Todos os membros da coordenação TST — devem aparecer sempre nos cards,
  // mesmo com zero processos atribuídos.
  const { profiles: membrosCoordenacaoTst } = useProfilesBasic(COORDENACAO_TST_ID);
  const { map: semPendenciaPorResp } = useProntoSemPendenciaPorResponsavel(countsFilters);
  const responsavelCountsCompleto = useMemo(() => {
    const byId = new Map(responsavelCounts.map((c) => [c.id, c]));
    const extras = membrosCoordenacaoTst
      .filter((p) => !byId.has(p.id))
      .map((p) => ({ id: p.id, nome: p.nome, count: 0, pronto: 0 }));
    // Ordena pelos que têm MENOS pendências (faltam) primeiro — assim os
    // responsáveis mais adiantados aparecem à esquerda.
    return [...responsavelCounts, ...extras]
      .map((c) => ({
        ...c,
        faltam: Math.max(0, c.count - (c.pronto || 0)),
        semPendencia: semPendenciaPorResp[c.id] || 0,
      }))
      .sort((a, b) => a.faltam - b.faltam || b.count - a.count || a.nome.localeCompare(b.nome));
  }, [responsavelCounts, membrosCoordenacaoTst, semPendenciaPorResp]);


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
  const { stats, loading: statsLoading, refetch: refetchStats } = useDistribuicaoTstStats(listFilters);

  // Todos os cards (incluindo Total Geral, Prontos para Enviar e A fazer)
  // devem refletir o responsável atualmente selecionado no filtro — assim,
  // se uma advogada trocar o select para ajudar outra colega, os números
  // mudam para o contexto da pessoa escolhida. Quando nenhum responsável
  // está selecionado, mostra o total do escritório respeitando os demais
  // filtros.
  const statsWithGeral = stats;

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

  // Mês/Ano: lista fixa/global por `data_distribuicao_real` (não muda com
  // filtros). Inclui um bucket "sem-data" para registros sem data real.
  // A soma de "Todos meses" bate com o Total Geral quando não há filtros.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          "get_meses_data_distribuicao_real" as any
        );
        if (error) throw error;
        if (cancelled) return;
        const rows = ((data as any[]) || []).map((r: any) => ({
          key: r.mes_ano as string,
          count: Number(r.total) || 0,
        }));
        setMesesAnos(rows);
      } catch (e) {
        console.error("Erro ao carregar meses (data real):", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  

  const hasFilters = Boolean(
    filtroProcesso || filtroDossie || filtroTurma || filtroRelator || filtroParte || filtroParteRecorrente || filtroNomeParte || filtroDataInicio || filtroDataFim ||
    filtroAba !== "todas" || filtroBenner !== "todos" || filtroMesAno !== "todos" || filtroDossieStatus !== "todos" || filtroProcessoStatus !== "todos" ||
    filtroJudit !== "todos" || filtroErroJudit !== "todos" || filtroSituacaoProcesso !== "todos" || filtroSubidaMassa !== "todos" || filtroStatus !== "todos" ||
    filtroEmAnalise !== "todos" || filtroProblemaJudit !== "todos" || filtroAcordo !== "todos" || filtroDuplicado !== "todos" || filtroFonteImportacao !== "todas" ||
    filtroProvasDigitais !== "todos" || filtroSituacaoCarga !== "todas" || filtroEquipe !== "todos" || filtroTagId !== "todas" ||
    filtroSemPendencia || filtroComPendencia || filtroSemTurma || filtroMultiResp || filtroResponsavelIds.length > 0
  );

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
    setFiltroSubidaMassa("todos");
    setFiltroAcordo("todos");
    setFiltroSemPendencia(false);
    setFiltroComPendencia(false);
    setFiltroProcesso("");
    setFiltroDossie("");
    setFiltroTurma("");
    setFiltroRelator("");
    setFiltroParte("");
    setFiltroParteRecorrente("");
    setFiltroNomeParte("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroResponsavelIds([]);
    setFiltroSemTurma(false);
    setFiltroProblemaJudit("todos");
    setFiltroEquipe("todos");
    setFiltroMultiResp(false);
    setSelectedIds(new Set());
  };

  // Estado do card ativo (sincroniza visual + aplica filtros). Derivado dos selects.
  const activeCardKey = (() => {
    if (filtroMultiResp) return "multiResp" as const;
    if (filtroComPendencia) return "prontoComPendencia" as const;
    if (filtroSemPendencia) return "prontoSemPendencia" as const;

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
    if (filtroSituacaoProcesso === "nao_precisa_fazer" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "naoPrecisaFazer" as const;
    if (filtroSemTurma && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroSituacaoProcesso === "todos") return "semTurma" as const;
    if (filtroProblemaJudit === "sim" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroSituacaoProcesso === "todos" && !filtroSemTurma) return "problemaJudit" as const;
    if (filtroDataInicio === "" && filtroDataFim === "2025-12-31" && filtroMesAno === "todos") return "ate2025" as const;
    if (filtroDataInicio === "2026-01-01" && filtroDataFim === "" && filtroMesAno === "todos") return "de2026" as const;
    if (filtroStatus === "concluidos" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroSituacaoProcesso === "todos" && !filtroSemTurma && filtroProblemaJudit !== "sim") return "prontoEnvio" as const;
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
    // Reseta o filtro "Mais de um responsável" ao alternar cards (re-aplica se for o próprio)
    setFiltroMultiResp(false);
    // Reseta filtro de status (Pronto para Enviar) ao alternar cards
    if (key === "prontoEnvio" || isActive) setFiltroStatus("todos");
    // "Pronto sem/com pendência" reaproveitam o filtro de status = concluidos.
    if (key === "prontoSemPendencia" || key === "prontoComPendencia") setFiltroStatus("todos");
    // Sempre desliga os filtros de pendência ao alternar/limpar cards;
    // serão religados no switch abaixo se este for o card ativado.
    setFiltroSemPendencia(false);
    setFiltroComPendencia(false);

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
      case "naoPrecisaFazer": setFiltroSituacaoProcesso("nao_precisa_fazer"); break;
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
      case "prontoEnvio": setFiltroStatus("concluidos"); break;
      case "prontoSemPendencia":
        setFiltroStatus("concluidos");
        setFiltroSemPendencia(true);
        break;
      case "prontoComPendencia":
        setFiltroStatus("concluidos");
        setFiltroComPendencia(true);
        break;

      case "semResponsavel":
        setFiltroResponsavelIds(["__sem_responsavel__"]);
        break;
      case "comEquipe": setFiltroEquipe("sim"); break;
      case "semEquipe": setFiltroEquipe("nao"); break;
      case "multiResp": setFiltroMultiResp(true); break;
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

  const handleRefresh = async () => {
    setSelectedIds(new Set());
    await Promise.all([
      Promise.resolve(fetchDados()),
      Promise.resolve(fetchTabsData()),
      Promise.resolve(refetchStats()),
      Promise.resolve(refetchResponsavelCounts()),
      Promise.resolve(refetchProntoSemPendencia()),
    ]);
  };

  const handleArquivarDuplicados = async () => {
    setArquivarDupRunning(true);
    try {
      const ids = await fetchAllFilteredBennerIds(debouncedFilters);
      if (!ids || ids.length === 0) {
        toast.warning("Nenhum registro encontrado com os filtros atuais.");
        return;
      }
      const { data, error } = await supabase.rpc(
        "arquivar_duplicados_dados_benner_ids" as any,
        { _ids: ids, _motivo: "Arquivamento em lote de duplicados (filtros da tela)" } as any
      );
      if (error) { toast.error("Erro ao arquivar: " + error.message); return; }
      const r: any = Array.isArray(data) ? data[0] : data;
      const arq = r?.arquivados ?? 0;
      const grp = r?.grupos ?? 0;
      toast.success(`Arquivados ${arq} registros em ${grp} grupos de duplicados.`);
      setArquivarDupOpen(false);
      handleRefresh();
    } catch (e: any) {
      toast.error("Erro ao arquivar duplicados: " + (e?.message || e));
    } finally {
      setArquivarDupRunning(false);
    }
  };

  const [arquivarSelRunning, setArquivarSelRunning] = useState(false);
  const handleArquivarSelecionados = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) { toast.warning("Selecione registros para arquivar"); return; }
    if (!window.confirm(`Arquivar ${ids.length} registro(s) selecionado(s)? Eles sairão da lista ativa e ficarão disponíveis em "Arquivados".`)) return;
    setArquivarSelRunning(true);
    let ok = 0; let fail = 0;
    try {
      for (const id of ids) {
        const { error } = await supabase.rpc(
          "arquivar_dados_benner" as any,
          { _id: id, _motivo: "Arquivamento manual (seleção na tela)" } as any
        );
        if (error) fail++; else ok++;
      }
      if (ok) toast.success(`${ok} registro(s) arquivado(s).`);
      if (fail) toast.error(`${fail} falha(s) ao arquivar.`);
      setSelectedIds(new Set());
      handleRefresh();
    } finally {
      setArquivarSelRunning(false);
    }
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
        const { error } = await supabase
          .from("dados_benner" as any)
          .update({ status: "pronto_envio", pronto_em: nowIso, pronto_por: uid } as any)
          .in("id", batch);
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
    // IMPORTANTE: NÃO usar mais (processo, dossiê) como chave para localizar
    // a linha. A base contém duplicatas (mesmo processo, com/sem dossiê) e o
    // lookup por processo cai na linha errada silenciosamente. Sem `id`,
    // tratamos como inserção nova até a base ser higienizada.
    let rowId = id;

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
      const { blob, filename, total, semProcessoDossie } = await gerarRelatorioExcelDistribuicaoTst({
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
      if (semProcessoDossie > 0) {
        toast.warning(`${semProcessoDossie} registro(s) sem processo/dossiê incluídos — dados faltantes na base (ver coluna "Observação").`);
      }
    } catch (err: any) {
      toast.error("Erro ao gerar planilha: " + (err?.message || String(err)));
    } finally {
      setXlsxRunning(false);
    }
  };

  /**
   * Gera relatório XLSX dos campos obrigatórios em aberto, respeitando os
   * filtros aplicados (ou apenas os selecionados, se houver seleção).
   * Spec: KELLEN/2026-06 — ver `src/utils/distribuicaoTstPendencias.ts`.
   */
  const handleGerarRelatorioPendencias = async () => {
    setPendenciasRelRunning(true);
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

      // Carrega os campos obrigatórios em lotes
      const PAGE = 500;
      const linhas: any[] = [];
      const colsExtras = Array.from(
        new Set([
          "id",
          ...COLUNAS_SELECT_PRONTO_SEM_PENDENCIA,
        ]),
      );
      const selectCols = colsExtras.join(", ");
      for (let i = 0; i < ids.length; i += PAGE) {
        const batch = ids.slice(i, i + PAGE);
        const { data, error } = await supabase
          .from("dados_benner" as any)
          .select(selectCols)
          .in("id", batch);
        if (error) throw error;
        ((data as any[]) || []).forEach((r) => linhas.push(r));
      }

      // Monta planilha — uma linha por processo
      const XLSX = await import("xlsx");
      const aoa: any[][] = [];
      aoa.push(["Relatório de Pendências - Distribuição TST"]);
      aoa.push([
        "Processo",
        "Dossiê",
        "Equipe",
        "Total de Pendências",
        "Campos não preenchidos",
      ]);
      let totalComPend = 0;
      for (const r of linhas) {
        const naoPrecisaFazer =
          (r as any).processo_outro_escritorio === true ||
          (r as any).segredo_justica === true;
        if (naoPrecisaFazer) continue;
        const pend = getPendencias(r);
        if (pend.length === 0) continue;
        totalComPend++;
        aoa.push([
          r.processo || "",
          r.dossie || "",
          r.equipe || "",
          pend.length,
          pend.map((p) => p.label).join("; "),
        ]);
      }
      if (totalComPend === 0) {
        toast.success(
          `Tudo certo! Nenhuma pendência nos ${linhas.length} processo(s) verificados.`,
        );
        return;
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [
        { wch: 28 },
        { wch: 16 },
        { wch: 16 },
        { wch: 10 },
        { wch: 90 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pendências");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 16);
      a.href = url;
      a.download = `Pendencias_Distribuicao_TST_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(
        `Planilha gerada: ${totalComPend} processo(s) com pendências de ${linhas.length} verificados.`,
      );
    } catch (err: any) {
      toast.error(
        "Erro ao gerar relatório de pendências: " +
          (err?.message || String(err)),
      );
    } finally {
      setPendenciasRelRunning(false);
    }
  };

  // Gerar carga Benner respeitando os filtros aplicados na lista
  const handleGerarCarga = async () => {
    // Evita gerar a carga com o conjunto incompleto enquanto o cálculo de
    // pendências (feito no cliente) ainda está em andamento.
    if (selectedIds.size === 0 && filtroSemPendencia && prontoSemPendenciaLoading) {
      toast.info("Aguarde o cálculo de pendências terminar antes de gerar a carga.");
      return;
    }
    setCargaLoading(true);
    try {
      let ids: string[];
      if (selectedIds.size > 0) {
        ids = Array.from(selectedIds);
      } else {
        toast.info("Buscando distribuições filtradas...");
        // Usa os MESMOS filtros efetivos da listagem/cards (`listFilters`),
        // que incluem as restrições calculadas no cliente (sem pendência,
        // mais de um responsável, "A fazer" para não-admin).
        ids = await fetchAllDistribuicaoTstIds(listFilters);
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
      let allProcessos: { id: string; processo_numero: string; dossie: string | null; turma: string | null; relator: string | null; data_distribuicao: string | null; parte_recorrente: string | null }[] = [];

      // If rows are selected, use only those
      if (selectedIds.size > 0) {
        allProcessos = dados.filter(d => selectedIds.has(d.id)).map(d => ({
          id: d.id,
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
            .select("id, processo, dossie, turma, relator, data_distribuicao, recorrente")
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
          q = applyParteRecorrenteFilter(q, debouncedFilters.parteRecorrente);

          const { data, error } = await q.range(offset, offset + FETCH_SIZE - 1);
          if (error) { toast.error("Erro ao buscar processos: " + error.message); break; }
          // Mapeia para a forma esperada pelo loop abaixo
          const mapped = ((data as any[]) || []).map((d: any) => ({
            id: d.id,
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

      // Deduplica por ID. Mesmo processo pode existir mais de uma vez com
      // dossiês/origens diferentes; deduplicar por número fazia a rotina em
      // massa atualizar uma linha errada e deixar outra intacta.
      const seen = new Set<string>();
      const unique = allProcessos.filter(p => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
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
          const requestPayload = {
            numero_processo: aplicarMascaraCnj(proc.processo_numero),
            tribunal: "TST",
            com_anexos: false,
            origem: "distribuicao-tst-bulk",
          };
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

          const partiesDetail = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];

          // Bulk nunca traz anexos — anexos só via formulário individual.

          // Reclamante/Reclamada: PRIORIDADE ABSOLUTA aos campos já desambiguados
          // pelo backend (`data.reclamante`/`data.reclamada`), que cruzam com a
          // instância de origem e aplicam o override Santander.
          // ATENÇÃO: no TST as partes vêm como ACTIVE/PASSIVE = recorrente/recorrido
          // (ex.: quando o Banco recorre ele é ACTIVE, mas é RECLAMADO na origem).
          // Usar polo ACTIVE/PASSIVE aqui inverte reclamante ↔ reclamada — bug
          // relatado pela advocacia com processos vindo com Santander como
          // "Reclamante" e o cliente como "Reclamada".
          const bennerId = (proc as any).id as string | undefined;
          if (!bennerId) continue;

          // Atualiza apenas a linha selecionada. Mesmo processo pode ter mais
          // de um dossiê/origem na base; nunca atualizar por `processo` aqui.
          let updateOk = false;
          {
            // REGRA ÚNICA: o patch é construído por `buildJuditPatch`, o mesmo
            // usado pelo botão Judit do formulário (por contrato). Nada de
            // lógica paralela aqui — normalização de tipo de recurso e parte
            // recorrente, classificação de Turma/Relator, trânsito em julgado,
            // `data_distribuicao_real` (nunca `data_distribuicao`) e ausência de
            // campos de julgamento/`erro_judit` vêm todas de lá.
            const { patch: updateFields } = buildJuditPatch(
              juditData,
              turmasTstBulk,
              relatoresTstBulk,
            );

            if (Object.keys(updateFields).length > 0) {
              const { data: upd, error: updErr } = await (supabase
                .from("dados_benner" as any)
                .update(updateFields as any)
                .eq("id", bennerId)
                .select("id") as any);
              if (updErr) {
                console.warn("[bulk-judit] update error", proc.processo_numero, updErr.message);
              } else if (!upd || (upd as any[]).length === 0) {
                console.warn("[bulk-judit] update bloqueado por RLS", proc.processo_numero);
              } else {
                updateOk = true;
                successCount++;
              }
            }
          }

          // Persiste partes detalhadas (CPF/CNPJ, advogados, etc.) na aba
          // "Partes" — mesma função usada pelo botão individual.
          if (partiesDetail.length > 0) {
            try {
              await persistirPartesJudit(bennerId, juditData);
            } catch (e) {
              console.warn("[bulk-judit] Falha ao persistir partes:", e);
            }
          }

          // Vincula o registro ao processo em "Processos e Casos", com o mesmo
          // fallback via RPC usado pelo formulário (contorna RLS).
          try {
            const numeroLimpo = aplicarMascaraCnj(proc.processo_numero);
            const { data: procRow } = await supabase
              .from("processos")
              .select("id")
              .eq("numero", numeroLimpo)
              .maybeSingle();
            let processoId: string | null = procRow?.id ?? null;
            if (!processoId) {
              const { data: existingId } = await supabase.rpc(
                "find_processo_id_by_numero" as any,
                { _numero: numeroLimpo },
              );
              processoId = (existingId as string) || null;
            }
            if (processoId) {
              await supabase
                .from("dados_benner" as any)
                .update({ processo_id: processoId } as any)
                .eq("id", bennerId);
            }
          } catch (e) {
            console.warn("[bulk-judit] Falha ao vincular processo:", e);
          }

          // Marca como judit_preenchido SOMENTE quando o update foi confirmado.
          if (updateOk) {
            await supabase
              .from("dados_benner" as any)
              .update({
                judit_preenchido: true,
                judit_preenchido_em: new Date().toISOString(),
                judit_preenchido_por: bulkUserId,
              } as any)
              .eq("id", bennerId);
          }

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
      <MainLayout
        title="Distribuição TST - Carga Benner"
        subtitle="Geração de carga Benner a partir dos processos selecionados na Distribuição TST."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
              Carga Benner
              {cargaIdsAllowed && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({cargaIdsAllowed.length.toLocaleString()} registro(s) recebidos da lista)
                </span>
              )}
            </h1>
            <Button variant="outline" onClick={() => { setShowCarga(false); setCargaDistribuicoes(null); setCargaIdsAllowed(null); }}>Voltar à Lista</Button>
          </div>
          <CargaBennerFromDb 
            selectedRecordIds={selectedIds.size > 0 ? Array.from(selectedIds) : undefined}
            distribuicoes={cargaDistribuicoes || undefined}
            idsAllowed={cargaIdsAllowed || undefined}
            filters={{
            // Mesmos filtros efetivos da listagem, para manter coerência com
            // o card ativo (os IDs continuam sendo a fonte principal).
            aba_origem: listFilters.aba_origem,
            benner: listFilters.benner as any,
            processo: listFilters.processo,
            dossie: listFilters.dossie,
            turma: listFilters.turma,
            relator: listFilters.relator,
            parte: listFilters.parte,
            parteRecorrente: listFilters.parteRecorrente as any,
            nomeParte: listFilters.nomeParte,
            mesAno: listFilters.mesAno,
            dataInicio: listFilters.dataInicio,
            dataFim: listFilters.dataFim,
          }} />
        </div>
      </MainLayout>
    );
  }

  if (showForm || editando) {
    return (
      <MainLayout
        title="Distribuição TST"
        subtitle="Detalhamento do processo distribuído: dados, partes, prazos e análise com IA."
      >
        <div className="max-w-7xl mx-auto px-2">
          <DistribuicaoTstDetail
            dado={editando}
            initialTab={detailInitialTab}
            onSaveDistribuicao={async (d, id) => {
              const targetId = id || editando?.id || undefined;
              const result = await saveDado(d, targetId);
              if (result) refetchProntoSemPendencia();
              const savedId = typeof result === "string" ? result : (targetId || null);
              if (savedId) { setStickyId(savedId); setHighlightUntil(Date.now() + 8000); }
              return result;
            }}
            onSaveBenner={async (d, id) => {
              const targetId = id || editando?.id || undefined;
              const result = await handleSaveBenner(d, targetId);
              const savedId = typeof result === "string" ? result : (targetId || null);
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
              try { refetchProntoSemPendencia(); } catch {}
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
      subtitle="Gestão dos processos distribuídos no TST: filtros, cards totalizadores e ações em lote."
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
        </div>
      }
    >
      <div className="space-y-3">
        {isAdminOrCoordinator && (filtroDuplicado === "sim" || selectedIds.size > 0) && (
        <div className="flex gap-2 flex-wrap justify-end items-center">


            {isAdminOrCoordinator && filtroDuplicado === "sim" && (
              <Button
                variant="outline"
                onClick={() => setArquivarDupOpen(true)}
                disabled={arquivarDupRunning}
                title="Arquiva os duplicados respeitando os filtros atuais. Mantém o registro com mais tags (empate: mais campos preenchidos). Se outro do grupo tiver alteração mais recente, esse é mantido. Nada é apagado."
                className="border-amber-400 text-amber-700 hover:bg-amber-50"
              >
                {arquivarDupRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
                {arquivarDupRunning ? "Arquivando..." : "Arquivar duplicados"}
              </Button>
            )}
            {isAdminOrCoordinator && selectedIds.size > 0 && (
              <Button
                variant="outline"
                onClick={handleArquivarSelecionados}
                disabled={arquivarSelRunning}
                title="Arquiva apenas os registros selecionados. Eles ficam disponíveis em 'Arquivados' e podem ser restaurados."
                className="border-amber-400 text-amber-700 hover:bg-amber-50"
              >
                {arquivarSelRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
                {arquivarSelRunning ? "Arquivando..." : `Arquivar selecionados (${selectedIds.size})`}
              </Button>
            )}
        </div>
        )}


        {/* Card "Total por Situação" (respeita filtros) */}
        {totalSituacaoOpen && (
          <TotalPorSituacaoCard
            filters={debouncedFilters}
            filtrosResumo={buildFiltrosResumo(debouncedFilters, {
              responsaveisLabel: filtroResponsavelIds.length > 0 ? `${filtroResponsavelIds.length} selecionado(s)` : undefined,
            })}
            onClose={() => setTotalSituacaoOpen(false)}
          />
        )}

        {/* Stats Cards (respeitam os filtros e são clicáveis) */}
        {mostrarCards && (
          <DistribuicaoTstStatsCards
            stats={statsWithGeral}
            loading={statsLoading}
            activeKey={activeCardKey}
            onCardClick={handleCardClick}
            prontoSemPendencia={{
              count: prontoSemPendenciaCount,
              loading: prontoSemPendenciaLoading,
            }}
            prontoComPendencia={{
              count: filtroComPendencia
                ? (statsWithGeral?.prontoEnvio ?? 0)
                : Math.max(0, (statsWithGeral?.prontoEnvio ?? 0) - prontoSemPendenciaCount),
              loading: prontoSemPendenciaLoading || statsLoading,
            }}
            multiRespCard={null}

            responsavelCard={(() => {
              // Quando há exatamente UM responsável selecionado no filtro,
              // o card reflete esse responsável (útil para o admin trocar e
              // ver os totais de outra pessoa). Caso contrário, mostra o
              // usuário logado.
              const targetId = filtroResponsavelIds.length === 1
                ? filtroResponsavelIds[0]
                : user?.id;
              const alvo = targetId ? responsavelCounts.find(c => c.id === targetId) : null;
              const nome = alvo?.nome;
              return {
                atribuidos: alvo?.count ?? 0,
                prontos: alvo?.pronto ?? 0,
                nome: filtroResponsavelIds.length === 1 ? nome : undefined,
              } as any;
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
              setFiltroStatus("concluidos");
            }}
          />
        )}

        {/* Totais por responsável — visível apenas para administradores. */}
        {mostrarCards && isAdmin && responsavelCountsCompleto.length > 0 && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
              {responsavelCountsCompleto
                .filter((c) => c.count > 0 || c.pronto > 0 || c.semPendencia > 0 || c.faltam > 0)
                .map((c) => {
                const isSemResp = c.id === SEM_RESPONSAVEL_UUID;
                const filterValue = isSemResp ? "__sem_responsavel__" : c.id;
                const active = filtroResponsavelIds.includes(filterValue);
                const faltam = c.faltam;
                // Marcados como prontos (concluídos) que AINDA têm pendências.
                const comPendencia = Math.max(0, c.pronto - c.semPendencia);
                // Cada número aplica o filtro do responsável + o recorte
                // correspondente; os cards gerais recalculam automaticamente
                // porque usam os mesmos `listFilters`.
                const aplicar = (modo: "total" | "pronto" | "semPend" | "comPend") => {
                  setSelectedIds(new Set());
                  setFiltroResponsavelIds([filterValue]);
                  setFiltroStatus(modo === "pronto" || modo === "comPend" ? "concluidos" : "todos");
                  setFiltroSemPendencia(modo === "semPend");
                  setFiltroComPendencia(modo === "comPend");
                };
                const badge =
                  "rounded-sm px-1.5 py-0.5 font-bold tabular-nums transition-colors hover:ring-1 hover:ring-primary/50";
                return (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between gap-1.5 rounded-md border px-2 py-1 text-xs transition-all hover:shadow-sm ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : isSemResp
                          ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                          : "border-border bg-card text-foreground"
                    }`}
                    title={`${c.nome} — Total: ${c.count} • Pronto: ${c.pronto} • Pronto sem pendência: ${c.semPendencia} • Prontos com pendências: ${comPendencia} • Faltam: ${faltam}`}
                  >
                    <button
                      type="button"
                      className="truncate text-left hover:underline"
                      onClick={() => setFiltroResponsavelIds(active ? [] : [filterValue])}
                    >
                      {c.nome}
                    </button>
                    <span className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className={`${badge} bg-muted`}
                        title="Total (clique para filtrar)"
                        onClick={() => aplicar("total")}
                      >
                        {c.count}
                      </button>
                      <button
                        type="button"
                        className={`${badge} bg-emerald-500/15 text-emerald-700 dark:text-emerald-400`}
                        title="Pronto (finalizadas) — clique para filtrar"
                        onClick={() => aplicar("pronto")}
                      >
                        {c.pronto}
                      </button>
                      <button
                        type="button"
                        className={`${badge} bg-sky-500/15 text-sky-700 dark:text-sky-400`}
                        title="Pronto SEM pendência — clique para filtrar"
                        onClick={() => aplicar("semPend")}
                      >
                        {c.semPendencia}
                      </button>
                      <button
                        type="button"
                        className={`${badge} bg-red-500/15 text-red-700 dark:text-red-400`}
                        title="Marcados como prontos, mas COM pendências — clique para filtrar"
                        onClick={() => aplicar("comPend")}
                      >
                        {comPendencia}
                      </button>
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
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* Ações em lote — grade de 4 colunas alinhadas.
            Seleção Mês/Ano ocultada temporariamente (não utilizada). */}
        {true && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-stretch">



            {delegarButton}
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
            {bulkJuditRunning && (
              <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => { bulkAbortRef.current = true; }}>
                <X className="w-3 h-3 mr-1" /> Cancelar
              </Button>
            )}
            <Button
              variant={mostrarPendencias ? "default" : "outline"}
              size="sm"
              onClick={() => setMostrarPendencias((v) => !v)}
              title="Mostra uma coluna na lista com os campos obrigatórios ainda não preenchidos em cada processo (spec da advogada Kellen)."
              className={
                mostrarPendencias
                  ? "h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                  : "h-8 text-xs border-red-300 text-red-700 hover:bg-red-50"
              }
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              {mostrarPendencias ? "Ocultar Pendências" : "Verificar Pendências"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGerarRelatorioPendencias}
              disabled={pendenciasRelRunning}
              title="Gera um Excel listando todos os processos com campos obrigatórios em aberto, respeitando os filtros (ou apenas os selecionados)."
              className="h-8 text-xs border-red-300 text-red-700 hover:bg-red-50"
            >
              {pendenciasRelRunning ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3 h-3 mr-1" />
              )}
              {pendenciasRelRunning
                ? "Gerando..."
                : selectedIds.size > 0
                  ? `Relatório Pendências (${selectedIds.size})`
                  : "Relatório Pendências"}
            </Button>
            {/* Resposta Santander movido para Admin TST → Importações Distribuição TST */}
            {isAdminOrCoordinator && (
              <BulkTagAction
                selectedIds={Array.from(selectedIds)}
                filters={debouncedFilters}
                totalFiltered={totalCount}
              />
            )}

            {/* Acesso Rápido */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs" disabled={xlsxRunning || pdfRunning}>
                  {xlsxRunning || pdfRunning ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3 mr-1" />
                  )}
                  {xlsxRunning
                    ? (xlsxProgress.total > 0 ? `Gerando Excel ${xlsxProgress.current}/${xlsxProgress.total}` : "Gerando Excel...")
                    : pdfRunning
                      ? (pdfProgress.total > 0 ? `Gerando PDF ${pdfProgress.current}/${pdfProgress.total}` : "Gerando PDF...")
                      : selectedIds.size > 0
                        ? `Acesso Rápido (${selectedIds.size})`
                        : "Acesso Rápido"}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Acesso Rápido</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdminOrCoordinator && (
                  <>
                    <DropdownMenuItem onSelect={() => { scrollPageToTop(); setDetailInitialTab("distribuicao"); setShowForm(true); }}>
                      <Plus className="w-4 h-4 mr-2" /> Nova Distribuição
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setAutoDistOpen(true)}
                      disabled={totalCount === 0 && selectedIds.size === 0}
                    >
                      <Shuffle className="w-4 h-4 mr-2" />
                      {isAdmin && selectedIds.size > 0
                        ? `Distribuir selecionados (${selectedIds.size})`
                        : `Distribuir automaticamente${totalCount > 0 ? ` (${totalCount})` : ""}`}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isAdminOrCoordinator && (
                  <DropdownMenuItem onSelect={() => setTotalSituacaoOpen((v) => !v)}>
                    <BarChart3 className="w-4 h-4 mr-2" /> Total por Situação
                  </DropdownMenuItem>
                )}
                {isAdminOrCoordinator && (
                  <>
                    <DropdownMenuItem onSelect={() => navigate("/dados-benner")}>
                      <ExternalLink className="w-4 h-4 mr-2" /> Dados Benner
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate("/distribuicao-tst/kanban")}>
                      <LayoutGrid className="w-4 h-4 mr-2" /> Kanban Delegação
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onSelect={() => gerarManualDistribuicaoTst()}>
                  <FileText className="w-4 h-4 mr-2" /> Manual de Instruções
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">Relatórios</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => handleGerarRelatorioExcel()} disabled={xlsxRunning}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Relatório Excel
                </DropdownMenuItem>
                {isAdminOrCoordinator && (
                  <>
                    <DropdownMenuItem onSelect={() => handleGerarRelatorioPdf()} disabled={pdfRunning}>
                      <FileText className="w-4 h-4 mr-2" /> Relatório PDF Partes
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDossiesOpen(true)}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" /> Relatório Dossiês não localizados
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {isAdminOrCoordinator && (
              <>
                <DossiesNaoLocalizadosButton
                  filters={debouncedFilters}
                  selectedIds={selectedIds}
                  open={dossiesOpen}
                  onOpenChange={setDossiesOpen}
                  hideTrigger
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleGerarCarga}
                  disabled={cargaLoading || (selectedIds.size === 0 && filtroSemPendencia && prontoSemPendenciaLoading)}
                >
                  {cargaLoading || (selectedIds.size === 0 && filtroSemPendencia && prontoSemPendenciaLoading) ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileSpreadsheet className="w-3 h-3 mr-1" />}
                  {cargaLoading
                    ? "Carregando..."
                    : selectedIds.size === 0 && filtroSemPendencia && prontoSemPendenciaLoading
                    ? "Calculando pendências..."
                    : selectedIds.size > 0
                      ? `Carga Benner (${selectedIds.size})`
                      : "Gerar Carga Benner"}
                </Button>
              </>
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
              <Select value={filtroParteRecorrente || "todas"} onValueChange={(v) => setFiltroParteRecorrente(v === "todas" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Parte Recorrente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Partes Recorrentes</SelectItem>
                  <SelectItem value="Reclamante">Reclamante</SelectItem>
                  <SelectItem value="Reclamada">Reclamada</SelectItem>
                  <SelectItem value="Reclamante e Reclamada">Reclamante e Reclamada</SelectItem>
                  <SelectItem value="Terceiro">Terceiro</SelectItem>
                  <SelectItem value="Reclamante e Terceiro">Reclamante e Terceiro</SelectItem>
                  <SelectItem value="Reclamada e Terceiro">Reclamada e Terceiro</SelectItem>
                  <SelectItem value="Reclamante, Reclamada e Terceiro">Reclamante, Reclamada e Terceiro</SelectItem>
                </SelectContent>
              </Select>
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
              {/* VERMELHO — visível a todos (RLS entrega só as TAGs públicas para não-admin) */}
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
                  value={
                    filtroProblemaJudit === "sim"
                      ? "problema_judit"
                      : filtroAcordo === "sim"
                        ? "acordo"
                        : filtroStatus
                  }
                  onValueChange={(v) => {
                    if (v === "problema_judit") {
                      setFiltroProblemaJudit("sim");
                      setFiltroAcordo("todos");
                      setFiltroStatus("todos");
                    } else if (v === "acordo") {
                      setFiltroAcordo("sim");
                      setFiltroProblemaJudit("todos");
                      setFiltroStatus("todos");
                    } else {
                      setFiltroProblemaJudit("todos");
                      setFiltroAcordo("todos");
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
                    <SelectItem value="concluidos">Concluídos (pronto/planilhado/enviado)</SelectItem>
                    <SelectItem value="pronto_envio">Pronto para Enviar</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="planilhado">Planilhado</SelectItem>
                    <SelectItem value="problema_judit">Problema Judit</SelectItem>
                    <SelectItem value="acordo">Acordo</SelectItem>
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
                    <SelectItem value="cejusc">CEJUSC</SelectItem>
                    <SelectItem value="a_fazer">A fazer</SelectItem>
                    <SelectItem value="nao_precisa_fazer">Não precisa fazer</SelectItem>


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
            {totalCount > 0 && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={totalCount}
                  value={qtdSelecionar}
                  placeholder={String(totalCount)}
                  onChange={(e) => setQtdSelecionar(e.target.value)}
                  className="h-6 w-20 text-xs px-2"
                  title="Quantidade a selecionar (1 até o total filtrado)"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2"
                  disabled={selecionarQtdLoading || selectAllLoading}
                  onClick={async () => {
                    const raw = parseInt(qtdSelecionar || String(totalCount), 10);
                    const n = Math.max(1, Math.min(Number.isFinite(raw) ? raw : totalCount, totalCount));
                    setQtdSelecionar(String(n));
                    try {
                      setSelecionarQtdLoading(true);
                      const allIds = await fetchAllDistribuicaoTstIds(listFilters, { matchListOrder: true });
                      const escolhidos = allIds.slice(0, n);
                      setSelectedIds(new Set(escolhidos));
                      toast.success(`${escolhidos.length} processo(s) selecionado(s) de ${allIds.length} filtrados`);
                    } catch (e: any) {
                      toast.error("Erro ao selecionar quantidade: " + (e?.message || ""));
                    } finally {
                      setSelecionarQtdLoading(false);
                    }
                  }}
                >
                  {selecionarQtdLoading ? "Selecionando..." : "Selecionar"}
                </Button>
              </div>
            )}
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

        {/* Alerta: matérias selecionadas fora da lista oficial de pedidos */}
        {mostrarPendencias && processosComMateriaForaDaLista.length > 0 && (
          <div className="border border-red-500/40 rounded-lg p-3 bg-red-50 dark:bg-red-950/20 space-y-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              {processosComMateriaForaDaLista.length} processo(s) desta página com matéria fora da lista oficial de pedidos
            </p>
            <p className="text-xs text-red-700 dark:text-red-300/80">
              Matérias fora da lista oficial (coluna Pedido da planilha Santander) não devem ir para a Carga Benner. Ajuste para uma matéria oficial.
            </p>
            <ul className="text-xs text-red-800 dark:text-red-300 list-disc pl-4 max-h-40 overflow-auto">
              {processosComMateriaForaDaLista.map((p) => {
                const dado = dados.find((d: any) => d.id === p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (dado) {
                          setDetailInitialTab("distribuicao");
                          setEditando(dado);
                        }
                      }}
                      className="font-mono text-red-900 dark:text-red-200 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-default"
                      disabled={!dado}
                      title={dado ? "Abrir formulário de detalhe do processo" : "Registro não disponível"}
                    >
                      {formatProcessoNumero(p.processo_numero || "") || p.dossie || p.id}
                    </button>
                    <span className="opacity-70"> — {p.partes.join(", ")}: {p.materias.join("; ")}</span>
                  </li>
                );
              })}
            </ul>
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
                    disabled={selectAllLoading}
                    onCheckedChange={async (checked) => {
                      if (checked) {
                        // Seleciona TODOS os registros que batem com o filtro atual
                        // (não apenas os da página visível).
                        try {
                          setSelectAllLoading(true);
                          const allIds = await fetchAllDistribuicaoTstIds(debouncedFilters);
                          setSelectedIds(new Set(allIds));
                          if (allIds.length > dados.length) {
                            toast.success(`${allIds.length} processo(s) selecionado(s) (todos os filtrados)`);
                          }
                        } catch (e: any) {
                          toast.error("Erro ao selecionar todos: " + (e?.message || ""));
                          // Fallback: seleciona apenas a página atual
                          setSelectedIds(new Set([...selectedIds, ...dados.map(d => d.id)]));
                        } finally {
                          setSelectAllLoading(false);
                        }
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </TableHead>
                {([
                  { key: "data_distribuicao_planilha" as const, label: "Data Plan." },
                  { key: "data_distribuicao_real" as const, label: "Data Distribuição" },
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
                {mostrarPendencias && (
                  <TableHead className="min-w-[260px]">
                    <span className="inline-flex items-center gap-1 text-red-700">
                      Pendências
                    </span>
                  </TableHead>
                )}
                {isAdminOrCoordinator && <TableHead className="w-28">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={(isAdminOrCoordinator ? 9 : 8) + (mostrarPendencias ? 1 : 0)} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={(isAdminOrCoordinator ? 9 : 8) + (mostrarPendencias ? 1 : 0)} className="text-center py-8 text-muted-foreground">Nenhuma distribuição encontrada</TableCell></TableRow>
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
                const statusAtual = String((d as any).status || "");
                // Concluído = pronto, já planilhado na carga ou enviado ao Benner.
                const isPronto = ["pronto_envio", "planilhado", "enviado"].includes(statusAtual);
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
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        checked={selectedIds.has(d.id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedIds);
                          if (checked) newSet.add(d.id);
                          else newSet.delete(d.id);
                          setSelectedIds(newSet);
                        }}
                      />
                      {(() => {
                        const status = String((d as any).status || "");
                        const emAnalise = !!(d as any).em_analise;
                        const naoPrecisaFazer =
                          (d as any).transito_julgado === true ||
                          (d as any).processo_outro_escritorio === true ||
                          (d as any).segredo_justica === true;
                        let color = "";
                        let label = "";
                        if (status === "pronto_envio" || status === "planilhado" || status === "enviado") {
                          color = "bg-emerald-500";
                          label =
                            status === "planilhado"
                              ? "Concluído — pronto e já planilhado na carga"
                              : status === "enviado"
                                ? "Concluído — enviado ao Benner"
                                : "Pronto para enviar";
                        } else if (emAnalise) {
                          color = "bg-amber-400";
                          label = "Em análise";
                        } else if (naoPrecisaFazer) {
                          color = "bg-slate-400";
                          label = "Não precisa fazer";
                        } else {
                          color = "bg-red-500";
                          label = "A fazer";
                        }
                        return (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn("inline-block w-2.5 h-2.5 rounded-full ring-1 ring-black/10", color)}
                                  aria-label={label}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="text-xs">
                                {label}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                    </div>
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
                      const situacaoClass = "";
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
                              {(d as any).ic_arquivado && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-slate-500 text-slate-600 dark:text-slate-300" title="Registro arquivado">
                                  Arquivado
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
                            <div className="mt-1">
                              <ProcessoTagPicker
                                dadoId={d.id}
                                tagIds={tagsMap?.get(d.id) || []}
                                compact
                                readOnly={!isAdminOrCoordinator}
                              />
                            </div>
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
                          {(d as any).ic_arquivado && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-slate-500 text-slate-600 dark:text-slate-300" title="Registro arquivado">
                              Arquivado
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
                        <div className="mt-1">
                          <ProcessoTagPicker
                            dadoId={d.id}
                            tagIds={tagsMap?.get(d.id) || []}
                            compact
                            readOnly={!isAdminOrCoordinator}
                          />
                        </div>
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
                  {mostrarPendencias && (() => {
                    const pend = getPendencias(d);
                    const naoPrecisaFazer =
                      (d as any).processo_outro_escritorio === true ||
                      (d as any).segredo_justica === true;
                    return (
                      <TableCell className="align-middle min-w-[260px]" onClick={e => e.stopPropagation()}>
                        {naoPrecisaFazer ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-[10px]">
                            Não precisa fazer
                          </Badge>
                        ) : pend.length === 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-[10px]">
                            Sem pendências
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[420px]" title={pendenciasResumo(d)}>
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              {pend.length} pendência{pend.length > 1 ? "s" : ""}
                            </Badge>
                            {pend.slice(0, 6).map((p) => (
                              <Badge
                                key={p.key}
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 border-red-300 text-red-700"
                              >
                                {p.label}
                              </Badge>
                            ))}
                            {pend.length > 6 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-700">
                                +{pend.length - 6}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  })()}
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
        selectedIds={Array.from(selectedIds)}
        isAdmin={isAdmin}
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
      <AlertDialog open={arquivarDupOpen} onOpenChange={(o) => { if (!arquivarDupRunning) setArquivarDupOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar duplicados respeitando os filtros?</AlertDialogTitle>
            <AlertDialogDescription>
              Para cada grupo de processos duplicados, será mantido o registro com mais tags
              (empate: mais campos preenchidos). Se outro registro do mesmo grupo tiver data de
              alteração mais recente, esse será mantido no lugar. Os demais são movidos para a
              área de arquivados — nada é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={arquivarDupRunning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={arquivarDupRunning} onClick={(e) => { e.preventDefault(); handleArquivarDuplicados(); }}>
              {arquivarDupRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Arquivar duplicados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
