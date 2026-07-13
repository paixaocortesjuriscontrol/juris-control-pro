parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { useState, useEffect, useCallback, useMemo, useRef } from "react";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { MainLayout } from "@/components/layout/MainLayout";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Button } from "@/components/ui/button";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Input } from "@/components/ui/input";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Badge } from "@/components/ui/badge";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Label } from "@/components/ui/label";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Plus, Loader2, Trash2, ExternalLink, Search, X, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileSpreadsheet, Download, Database, ArrowLeft, FileText, CheckCircle, Send, Filter, UserPlus, LayoutGrid, Shuffle, Eye, EyeOff, SlidersHorizontal, Layers, Archive, ArrowUp, ArrowDown, ArrowUpDown, Mail } from "lucide-react";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { DistribuicaoTstStatsCards } from "@/components/distribuicao-tst/DistribuicaoTstStatsCards";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { useResponsaveisCounts } from "@/hooks/useResponsaveisCounts";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { useDistribuicaoTstStats } from "@/hooks/useDistribuicaoTstStats";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { useProntoSemPendenciaCount } from "@/hooks/useProntoSemPendenciaCount";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { fetchAllFilteredBennerIds, fetchProcessosComPartes, gerarRelatorioPartesPdf, buildFiltrosResumo } from "@/lib/relatorioPartesPdf";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { gerarRelatorioExcelDistribuicaoTst } from "@/lib/relatorioExcelDistribuicaoTst";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Checkbox } from "@/components/ui/checkbox";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { useDistribuicoesTst, DistribuicaoTst as DistTst, DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "@/hooks/useDistribuicoesTst";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { DistribuicaoTstDetail } from "@/components/distribuicao-tst/DistribuicaoTstDetail";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,// Importações (Importar Planilha / PDF Certidão / Atualizar Dossiês / Equipe / Situação Envio / Resposta Santander)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,// foram movidas para Admin TST → Importações Distribuição TST.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { CargaBennerFromDb } from "@/components/distribuicao-tst/CargaBennerFromDb";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { DossiesNaoLocalizadosButton } from "@/components/distribuicao-tst/DossiesNaoLocalizadosButton";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { DadosBennerForm } from "@/components/benner/DadosBennerForm";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { DadoBenner, DadoBennerInsert } from "@/hooks/useDadosBenner";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Link, useLocation, useNavigate } from "react-router-dom";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { supabase } from "@/integrations/supabase/client";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { toast } from "sonner";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Progress } from "@/components/ui/progress";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { cn, formatProcessoNumero } from "@/lib/utils";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { ResponsaveisSelector } from "@/components/distribuicao-tst/ResponsaveisSelector";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { DelegarProcessosDialog } from "@/components/distribuicao-tst/DelegarProcessosDialog";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { DistribuirAutomaticoDialog } from "@/components/distribuicao-tst/DistribuirAutomaticoDialog";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { CopyButton } from "@/components/ui/copy-button";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { getJuditAttachmentDedupKey } from "@/lib/juditAnexosDedup";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { useUserRole } from "@/hooks/useUserRole";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { useAuth } from "@/contexts/AuthContext";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { aplicarMascaraCnj } from "@/utils/cnjMask";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { useSituacoesEnvioCarga } from "@/hooks/useSituacoesEnvioCarga";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  useProcessoTagsCatalogo,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  useTagsForDados,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  fetchDadoIdsByTag,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,} from "@/hooks/useProcessoTags";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { ProcessoTagPicker } from "@/components/distribuicao-tst/ProcessoTagPicker";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { BulkTagAction } from "@/components/distribuicao-tst/BulkTagAction";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { useQuery } from "@tanstack/react-query";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import { gerarManualDistribuicaoTst } from "@/utils/gerarManualDistribuicaoTst";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  getPendencias,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  pendenciasResumo,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  COLUNAS_SELECT_PENDENCIAS,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,} from "@/utils/distribuicaoTstPendencias";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,import {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  AlertDialog,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  AlertDialogAction,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  AlertDialogCancel,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  AlertDialogContent,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  AlertDialogDescription,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  AlertDialogFooter,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  AlertDialogHeader,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  AlertDialogTitle,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,} from "@/components/ui/alert-dialog";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,const favorabilidadeColor = (val: string | null) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  if (!val) return "secondary";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const l = val.toLowerCase();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  if (l.includes("positiv")) return "default";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  if (l.includes("negativ")) return "destructive";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  return "secondary";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,};
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,const getJuditPartesResumo = (juditData: any, fallback?: string | null) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const parties = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const nonLawyers = parties.filter((party: any) => party?.nome && !party?.is_advogado);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const ativos = [...new Set(nonLawyers
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    .filter((party: any) => String(party?.polo || "").toUpperCase() === "ACTIVE")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    .map((party: any) => String(party.nome).trim())
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    .filter(Boolean))];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const passivos = [...new Set(nonLawyers
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    .filter((party: any) => String(party?.polo || "").toUpperCase() === "PASSIVE")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    .map((party: any) => String(party.nome).trim())
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    .filter(Boolean))];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const partes: string[] = [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  if (ativos.length > 0) partes.push(`Ativo: ${ativos.join(", ")}`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  if (passivos.length > 0) partes.push(`Passivo: ${passivos.join(", ")}`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  if (partes.length > 0) return partes.join("\n");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const recorrenteRaw = String(juditData?.recorrente ?? "").trim();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  if (recorrenteRaw) return recorrenteRaw;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  return fallback || "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,};
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,export default function DistribuicaoTst() {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [showForm, setShowForm] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [mostrarCards, setMostrarCards] = useState(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [mostrarFiltros, setMostrarFiltros] = useState(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [editando, setEditando] = useState<DistTst | null>(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  type SortKey = "data_distribuicao_planilha" | "data_distribuicao_real" | "processo_numero" | "dossie" | "responsaveis" | "benner_atualizado";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [sortBy, setSortBy] = useState<SortKey | null>(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleSort = (key: SortKey) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (sortBy === key) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setSortDir(sortDir === "asc" ? "desc" : "asc");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setSortBy(key);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setSortDir("asc");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const location = useLocation();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const navigate = useNavigate();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Abre detalhe automaticamente quando navegado com ?editId=...
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  useEffect(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const params = new URLSearchParams(location.search);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const editId = params.get("editId");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!editId) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    let cancelled = false;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    (async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const { data, error } = await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .select("*")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .eq("id", editId)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .maybeSingle();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (cancelled) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (error || !data) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.error("Registro não encontrado");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setEditando(data as any);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // limpa o query param para não reabrir ao voltar
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      navigate("/distribuicao-tst", { replace: true });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    })();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return () => { cancelled = true; };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }, [location.search, navigate]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Aba inicial do detalhe unificado (Distribuição vs Dados Benner).
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [detailInitialTab, setDetailInitialTab] = useState<"distribuicao" | "benner">("distribuicao");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { isAdmin, isAdminOrCoordinator } = useUserRole();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { user } = useAuth();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [delegarOpen, setDelegarOpen] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [arquivarDupOpen, setArquivarDupOpen] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [arquivarDupRunning, setArquivarDupRunning] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [autoDistOpen, setAutoDistOpen] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [showCarga, setShowCarga] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [cargaDistribuicoes, setCargaDistribuicoes] = useState<any[] | null>(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [cargaIdsAllowed, setCargaIdsAllowed] = useState<string[] | null>(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [cargaLoading, setCargaLoading] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Loading flag para os botões "Dados Benner" da tabela (abrem o detalhe na aba Benner).
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [loadingBenner, setLoadingBenner] = useState<string | null>(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Bulk Judit
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [bulkJuditRunning, setBulkJuditRunning] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [bulkJuditProgress, setBulkJuditProgress] = useState({ current: 0, total: 0 });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const bulkAbortRef = useRef(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Quando ligado, o "Preencher com Judit" em lote chama a Judit com
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // with_attachments=true (consulta cara). Default false para preservar quota.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [bulkComAnexos, setBulkComAnexos] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const scrollPageToTop = useCallback(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    document.querySelector<HTMLElement>("[data-page-scroll-container]")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }, []);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Relatório PDF de Partes
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [pdfRunning, setPdfRunning] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Relatório Excel Distribuição TST
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [xlsxRunning, setXlsxRunning] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [xlsxProgress, setXlsxProgress] = useState({ current: 0, total: 0 });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Row selection for bulk Judit
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [selectAllLoading, setSelectAllLoading] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // ID do registro recém-editado/salvo. Mantém ele visível (sticky) na lista
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // mesmo se ele não bater mais com os filtros, e destaca a linha por alguns
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // segundos para que a advogada localize o que mudou.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [stickyId, setStickyId] = useState<string | null>(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [highlightUntil, setHighlightUntil] = useState<number>(0);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  useEffect(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!stickyId) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const t = window.setTimeout(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setHighlightUntil(0);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // Mantém o sticky até a próxima ação do usuário (mudança de filtro/página),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // mas tira o destaque visual após 8s para não poluir.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }, 8000);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return () => window.clearTimeout(t);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }, [stickyId]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Filters
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroAba, setFiltroAba] = useState<string>("todas");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroBenner, setFiltroBenner] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroProcesso, setFiltroProcesso] = useState("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroDossie, setFiltroDossie] = useState("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroDossieStatus, setFiltroDossieStatus] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroProcessoStatus, setFiltroProcessoStatus] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroTurma, setFiltroTurma] = useState("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroRelator, setFiltroRelator] = useState("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroParte, setFiltroParte] = useState("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroParteRecorrente, setFiltroParteRecorrente] = useState("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroNomeParte, setFiltroNomeParte] = useState("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroDataInicio, setFiltroDataInicio] = useState("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroDataFim, setFiltroDataFim] = useState("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroMesAno, setFiltroMesAno] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroJudit, setFiltroJudit] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroErroJudit, setFiltroErroJudit] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroSituacaoProcesso, setFiltroSituacaoProcesso] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroSubidaMassa, setFiltroSubidaMassa] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroResponsavelIds, setFiltroResponsavelIds] = useState<string[]>([]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const autoSelectedRespRef = useRef(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroSemTurma, setFiltroSemTurma] = useState<boolean>(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroEmAnalise, setFiltroEmAnalise] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroProblemaJudit, setFiltroProblemaJudit] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroAcordo, setFiltroAcordo] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroDuplicado, setFiltroDuplicado] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroFonteImportacao, setFiltroFonteImportacao] = useState<string>("todas");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroProvasDigitais, setFiltroProvasDigitais] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroSituacaoCarga, setFiltroSituacaoCarga] = useState<string>("todas");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroEquipe, setFiltroEquipe] = useState<string>("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { data: situacoesCarga = [] } = useSituacoesEnvioCarga();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // ===== TAGs (admin/coord) =====
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroTagId, setFiltroTagId] = useState<string>("todas");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { data: tagsCatalogo = [] } = useProcessoTagsCatalogo();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Quando uma TAG é escolhida, busca o conjunto de ids permitidos.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { data: idsAllowedFromTag } = useQuery({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    queryKey: ["tag-filter-ids", filtroTagId],
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    enabled: filtroTagId !== "todas" && filtroTagId !== "__sem__",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    queryFn: () => fetchDadoIdsByTag(filtroTagId),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Novo filtro: apenas processos com mais de um responsável.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [filtroMultiResp, setFiltroMultiResp] = useState<boolean>(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // ===== Verificar Pendências =====
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Quando ligado, exibe uma coluna extra na tabela mostrando os campos
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // obrigatórios (vide spec da advogada) ainda em aberto.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [mostrarPendencias, setMostrarPendencias] = useState<boolean>(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [pendenciasRelRunning, setPendenciasRelRunning] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // IDs base por TAG (intersecção). undefined = sem restrição por TAG.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const idsAllowedFromTagFilter = filtroTagId === "todas" || filtroTagId === "__sem__"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    ? undefined
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    : (idsAllowedFromTag ?? []);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Debounced filters (inclui responsáveis para não perder o filtro ao alterar outros campos)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [debouncedFilters, setDebouncedFilters] = useState<DistribuicaoTstFilters>({});
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  useEffect(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const timer = setTimeout(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setDebouncedFilters({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        processo: filtroProcesso || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        dossie: filtroDossie || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        turma: filtroTurma || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        relator: filtroRelator || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        parte: filtroParte || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        nomeParte: filtroNomeParte || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        aba_origem: filtroAba !== "todas" ? filtroAba : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        benner: filtroBenner as any,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        dossieStatus: filtroDossieStatus !== "todos" ? (filtroDossieStatus as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        processoStatus: filtroProcessoStatus !== "todos" ? (filtroProcessoStatus as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        judit: filtroJudit as any,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        erroJudit: filtroErroJudit !== "todos" ? (filtroErroJudit as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        situacaoProcesso: filtroSituacaoProcesso !== "todos" ? (filtroSituacaoProcesso as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        subidaMassa: filtroSubidaMassa !== "todos" ? (filtroSubidaMassa as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        mesAno: filtroMesAno !== "todos" ? filtroMesAno : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        dataInicio: filtroDataInicio || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        dataFim: filtroDataFim || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        responsavelIds: filtroResponsavelIds.length > 0 ? filtroResponsavelIds : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        semTurma: filtroSemTurma || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        status: filtroStatus !== "todos" ? (filtroStatus as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        emAnalise: filtroEmAnalise !== "todos" ? (filtroEmAnalise as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        problemaJudit: filtroProblemaJudit !== "todos" ? (filtroProblemaJudit as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        acordo: filtroAcordo !== "todos" ? (filtroAcordo as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        duplicado: filtroDuplicado !== "todos" ? (filtroDuplicado as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        fonteImportacao: filtroFonteImportacao !== "todas" ? filtroFonteImportacao : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        provasDigitais: filtroProvasDigitais !== "todos" ? (filtroProvasDigitais as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        situacaoEnvioCargaId: filtroSituacaoCarga !== "todas" ? filtroSituacaoCarga : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        equipe: filtroEquipe !== "todos" ? (filtroEquipe as any) : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      idsAllowed: idsAllowedFromTagFilter,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }, 400);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return () => clearTimeout(timer);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,}, [filtroProcesso, filtroDossie, filtroDossieStatus, filtroProcessoStatus, filtroTurma, filtroRelator, filtroParte, filtroParteRecorrente, filtroNomeParte, filtroAba, filtroBenner, filtroJudit, filtroErroJudit, filtroSituacaoProcesso, filtroSubidaMassa, filtroMesAno, filtroDataInicio, filtroDataFim, JSON.stringify(filtroResponsavelIds), filtroSemTurma, filtroStatus, filtroEmAnalise, filtroProblemaJudit, filtroAcordo, filtroDuplicado, filtroFonteImportacao, filtroProvasDigitais, filtroSituacaoCarga, filtroEquipe, filtroTagId, JSON.stringify(idsAllowedFromTag || [])]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // IDs de processos com mais de um responsável, respeitando os demais filtros
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // (ignora filtro de responsável para que a contagem não se anule a si mesma).
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const multiRespFiltersKey = JSON.stringify({ ...debouncedFilters, responsavelIds: undefined });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { data: multiRespIds = [] } = useQuery({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    queryKey: ["multi-resp-ids", multiRespFiltersKey],
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    queryFn: async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const { data, error } = await supabase.rpc(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        "get_distribuicao_tst_multi_resp_ids" as any,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        { filters: { ...debouncedFilters, responsavelIds: undefined } as any }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (error) throw error;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      return ((data as any[]) || []).map((r: any) => r.id as string);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Para não-admins, o filtro "A fazer" sempre amarra ao usuário logado,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // independentemente do select de responsáveis.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const listFilters = useMemo(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    let f = debouncedFilters;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (debouncedFilters.situacaoProcesso === "a_fazer" && !isAdmin && user?.id) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      f = { ...f, responsavelIds: [user.id] };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroMultiResp) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // Intersecta com a lista de processos com mais de um responsável.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const tagIds = idsAllowedFromTagFilter;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const finalIds = tagIds
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ? multiRespIds.filter((id) => tagIds.includes(id))
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        : multiRespIds;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      f = { ...f, idsAllowed: finalIds.length > 0 ? finalIds : ["__none__"] };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return f;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // eslint-disable-next-line react-hooks/exhaustive-deps
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }, [JSON.stringify(debouncedFilters), isAdmin, user?.id, filtroMultiResp, JSON.stringify(multiRespIds), JSON.stringify(idsAllowedFromTagFilter || [])]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { dados, responsaveisMap, loading, fetchDados, saveDado, deleteDado, page, setPage, totalCount, totalPages } = useDistribuicoesTst(listFilters, stickyId);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const dadosOrdenados = useMemo(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!sortBy) return dados;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const dir = sortDir === "asc" ? 1 : -1;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const getVal = (d: any): any => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      switch (sortBy) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        case "data_distribuicao_planilha": return d.data_distribuicao_planilha || "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        case "data_distribuicao_real": return d.data_distribuicao_real || "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        case "processo_numero": return (d.processo_numero || "").toLowerCase();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        case "dossie": return (d.dossie || "").toLowerCase();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        case "benner_atualizado": return d.benner_atualizado ? 1 : 0;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        case "responsaveis": {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const list = responsaveisMap.get(d.id) || [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          return (list[0]?.nome || "").toLowerCase();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        default: return "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return [...dados].sort((a, b) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const av = getVal(a);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const bv = getVal(b);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (av === bv) return 0;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (av === "" || av === null || av === undefined) return 1;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (bv === "" || bv === null || bv === undefined) return -1;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      return av < bv ? -1 * dir : 1 * dir;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }, [dados, sortBy, sortDir, responsaveisMap]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Mapa { dado_id => tagIds[] } para a página visível
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const visibleDadoIds = dados.map((d) => d.id);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { data: tagsMap } = useTagsForDados(visibleDadoIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Totais por responsável (todos os registros que batem com os filtros, ignorando o filtro de responsável)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const countsFilters = { ...debouncedFilters, responsavelIds: undefined };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { counts: responsavelCounts, refetch: refetchResponsavelCounts } = useResponsaveisCounts(countsFilters);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Auto-seleciona o usuário logado como responsável ao abrir a tela
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // (apenas se ele estiver na lista de responsáveis). Roda uma única vez.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  useEffect(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (autoSelectedRespRef.current) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!user?.id) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (responsavelCounts.length === 0) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    autoSelectedRespRef.current = true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (responsavelCounts.some((c) => c.id === user.id)) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setFiltroResponsavelIds([user.id]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }, [user?.id, responsavelCounts]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Limpa o sticky se o usuário mexer em filtros, página ou recarregar.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // (Mantemos o sticky apenas para o fluxo "salvou e voltou".)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  useEffect(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setStickyId(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setHighlightUntil(0);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // eslint-disable-next-line react-hooks/exhaustive-deps
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }, [JSON.stringify(debouncedFilters), page]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { stats, loading: statsLoading, refetch: refetchStats } = useDistribuicaoTstStats(debouncedFilters);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const { count: prontoSemPendenciaCount, loading: prontoSemPendenciaLoading } =
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    useProntoSemPendenciaCount(debouncedFilters);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Todos os cards (incluindo Total Geral, Prontos para Enviar e A fazer)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // devem refletir o responsável atualmente selecionado no filtro — assim,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // se uma advogada trocar o select para ajudar outra colega, os números
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // mudam para o contexto da pessoa escolhida. Quando nenhum responsável
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // está selecionado, mostra o total do escritório respeitando os demais
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // filtros.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const statsWithGeral = stats;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Fetch distinct aba_origem and meses for tabs (lightweight queries)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [abas, setAbas] = useState<{ aba: string; count: number }[]>([]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [mesesAnos, setMesesAnos] = useState<{ key: string; count: number }[]>([]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [centralizadores, setCentralizadores] = useState<{ nome: string; count: number }[]>([]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const fetchTabsData = useCallback(async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // Lê de dados_benner (tabela única) restringindo ao escopo de distribuições (aba_origem != null)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const { data: abasData } = await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      .select("aba_origem")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      .not("aba_origem", "is", null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (abasData) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const map = new Map<string, number>();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      (abasData as any[]).forEach((d: any) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (d.aba_origem) map.set(d.aba_origem, (map.get(d.aba_origem) || 0) + 1);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setAbas([...map.entries()].map(([aba, count]) => ({ aba, count })).sort((a, b) => a.aba.localeCompare(b.aba)));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // Distinct centralizadores (paginado para evitar limite 1000)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const centMap = new Map<string, number>();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    let off = 0;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const SZ = 1000;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    while (true) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const { data: cd } = await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .select("centralizador")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .not("aba_origem", "is", null)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .range(off, off + SZ - 1);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const rows = (cd as any[]) || [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (const r of rows) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const c = (r.centralizador || "").trim();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (c) centMap.set(c, (centMap.get(c) || 0) + 1);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (rows.length < SZ) break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      off += SZ;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setCentralizadores(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      [...centMap.entries()].map(([nome, count]) => ({ nome, count })).sort((a, b) => b.count - a.count)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }, []);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  useEffect(() => { fetchTabsData(); }, [fetchTabsData]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Mês/Ano: lista fixa/global por `data_distribuicao_real` (não muda com
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // filtros). Inclui um bucket "sem-data" para registros sem data real.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // A soma de "Todos meses" bate com o Total Geral quando não há filtros.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  useEffect(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    let cancelled = false;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    (async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const { data, error } = await supabase.rpc(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          "get_meses_data_distribuicao_real" as any
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (error) throw error;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (cancelled) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const rows = ((data as any[]) || []).map((r: any) => ({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          key: r.mes_ano as string,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          count: Number(r.total) || 0,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        }));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setMesesAnos(rows);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      } catch (e) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        console.error("Erro ao carregar meses (data real):", e);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    })();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return () => { cancelled = true; };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }, []);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const hasFilters = filtroProcesso || filtroDossie || filtroTurma || filtroRelator || filtroParte || filtroNomeParte || filtroDataInicio || filtroDataFim || filtroAba !== "todas" || filtroBenner !== "todos" || filtroMesAno !== "todos" || filtroDossieStatus !== "todos" || filtroProcessoStatus !== "todos" || filtroJudit !== "todos" || filtroErroJudit !== "todos" || filtroSituacaoProcesso !== "todos" || filtroSubidaMassa !== "todos" || filtroStatus !== "todos" || filtroEmAnalise !== "todos" || filtroProblemaJudit !== "todos" || filtroAcordo !== "todos" || filtroDuplicado !== "todos" || filtroFonteImportacao !== "todas" || filtroProvasDigitais !== "todos" || filtroSituacaoCarga !== "todas" || filtroEquipe !== "todos" || filtroTagId !== "todas";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const clearFilters = () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroAba("todas");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroBenner("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroDossieStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroProcessoStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroMesAno("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroJudit("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroErroJudit("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroSituacaoProcesso("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroEmAnalise("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroDuplicado("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroFonteImportacao("todas");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroProvasDigitais("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroSituacaoCarga("todas");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroTagId("todas");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroProcesso("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroDossie("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroTurma("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroRelator("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroParte("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroNomeParte("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroDataInicio("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroDataFim("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroResponsavelIds([]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroSemTurma(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroProblemaJudit("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroEquipe("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroMultiResp(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Estado do card ativo (sincroniza visual + aplica filtros). Derivado dos selects.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const activeCardKey = (() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroMultiResp) return "multiResp" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroProcessoStatus === "valido" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "processosValidos" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroProcessoStatus === "invalido" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "processosInvalidos" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroDossieStatus === "valido" && filtroProcessoStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "dossiesValidos" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroDossieStatus === "invalido_ou_nao_preenchido" && filtroProcessoStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "dossiesInvalidos" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroJudit === "sim" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroBenner === "todos") return "juditPreenchido" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroJudit === "nao" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroBenner === "todos") return "juditNaoPreenchido" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroBenner === "sim" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos") return "bennerSim" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroBenner === "nao" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos") return "bennerNao" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroSituacaoProcesso === "ativo" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "processosAtivos" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroSituacaoProcesso === "transito" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "transitoJulgado" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroSituacaoProcesso === "a_fazer" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "aFazer" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroSituacaoProcesso === "nao_precisa_fazer" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos") return "naoPrecisaFazer" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroSemTurma && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroSituacaoProcesso === "todos") return "semTurma" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroProblemaJudit === "sim" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroSituacaoProcesso === "todos" && !filtroSemTurma) return "problemaJudit" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroDataInicio === "" && filtroDataFim === "2025-12-31" && filtroMesAno === "todos") return "ate2025" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroDataInicio === "2026-01-01" && filtroDataFim === "" && filtroMesAno === "todos") return "de2026" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroStatus === "pronto_envio" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroSituacaoProcesso === "todos" && !filtroSemTurma && filtroProblemaJudit !== "sim") return "prontoEnvio" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroEquipe === "sim") return "comEquipe" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroEquipe === "nao") return "semEquipe" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (filtroSituacaoProcesso === "todos" && filtroProcessoStatus === "todos" && filtroDossieStatus === "todos" && filtroJudit === "todos" && filtroBenner === "todos" && filtroStatus === "todos" && !filtroSemTurma && filtroProblemaJudit === "todos" && filtroEquipe === "todos" && !filtroDataInicio && !filtroDataFim) return "total" as const;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  })();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleCardClick = (key: import("@/components/distribuicao-tst/DistribuicaoTstStatsCards").StatsCardKey) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // Se já está ativo, limpa filtros desses 4 selects (volta a "Total" do escopo atual)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const isActive = activeCardKey === key;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // Reseta os 4 selects de classificação
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroProcessoStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroDossieStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroJudit("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroBenner("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroSituacaoProcesso("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroSemTurma(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroProblemaJudit("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroEquipe("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // Reseta o filtro "Mais de um responsável" ao alternar cards (re-aplica se for o próprio)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setFiltroMultiResp(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // Reseta filtro de status (Pronto para Enviar) ao alternar cards
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (key === "prontoEnvio" || isActive) setFiltroStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // "Pronto sem pendência" reaproveita o filtro de status = pronto_envio.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (key === "prontoSemPendencia") setFiltroStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // Reseta filtro "sem responsável" ao alternar cards
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (key === "semResponsavel" || isActive) setFiltroResponsavelIds([]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // Reseta filtros de data ao alternar cards
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (key === "ate2025" || key === "de2026" || isActive) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setFiltroDataInicio("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setFiltroDataFim("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setFiltroMesAno("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (isActive || key === "total") return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    switch (key) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "processosValidos": setFiltroProcessoStatus("valido"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "processosInvalidos": setFiltroProcessoStatus("invalido"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "dossiesValidos": setFiltroDossieStatus("valido"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "dossiesInvalidos": setFiltroDossieStatus("invalido_ou_nao_preenchido"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "juditPreenchido": setFiltroJudit("sim"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "juditNaoPreenchido": setFiltroJudit("nao"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "bennerSim": setFiltroBenner("sim"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "bennerNao": setFiltroBenner("nao"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "processosAtivos": setFiltroSituacaoProcesso("ativo"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "transitoJulgado": setFiltroSituacaoProcesso("transito"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "aFazer": setFiltroSituacaoProcesso("a_fazer"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "naoPrecisaFazer": setFiltroSituacaoProcesso("nao_precisa_fazer"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "semTurma": setFiltroSemTurma(true); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "problemaJudit": setFiltroProblemaJudit("sim"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "ate2025":
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setFiltroDataInicio("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setFiltroDataFim("2025-12-31");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setFiltroMesAno("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "de2026":
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setFiltroDataInicio("2026-01-01");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setFiltroDataFim("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setFiltroMesAno("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "prontoEnvio": setFiltroStatus("pronto_envio"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "prontoSemPendencia": setFiltroStatus("pronto_envio"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "semResponsavel":
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setFiltroResponsavelIds(["__sem_responsavel__"]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "comEquipe": setFiltroEquipe("sim"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "semEquipe": setFiltroEquipe("nao"); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      case "multiResp": setFiltroMultiResp(true); break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleDelete = async (id: string) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!isAdminOrCoordinator) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error("Apenas administradores ou coordenadores podem excluir processos. Fale com o coordenador ou administrador da coordenação.");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setDeleteTargetId(id);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const confirmDelete = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!deleteTargetId) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const id = deleteTargetId;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setDeleteTargetId(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    await deleteDado(id);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    fetchTabsData();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleRefresh = () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    fetchDados();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    fetchTabsData();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    refetchStats();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleArquivarDuplicados = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setArquivarDupRunning(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const ids = await fetchAllFilteredBennerIds(debouncedFilters);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (!ids || ids.length === 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.warning("Nenhum registro encontrado com os filtros atuais.");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const { data, error } = await supabase.rpc(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        "arquivar_duplicados_dados_benner_ids" as any,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        { _ids: ids, _motivo: "Arquivamento em lote de duplicados (filtros da tela)" } as any
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (error) { toast.error("Erro ao arquivar: " + error.message); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const r: any = Array.isArray(data) ? data[0] : data;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const arq = r?.arquivados ?? 0;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const grp = r?.grupos ?? 0;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.success(`Arquivados ${arq} registros em ${grp} grupos de duplicados.`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setArquivarDupOpen(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } catch (e: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error("Erro ao arquivar duplicados: " + (e?.message || e));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } finally {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setArquivarDupRunning(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const [arquivarSelRunning, setArquivarSelRunning] = useState(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleArquivarSelecionados = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const ids = Array.from(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!ids.length) { toast.warning("Selecione registros para arquivar"); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!window.confirm(`Arquivar ${ids.length} registro(s) selecionado(s)? Eles sairão da lista ativa e ficarão disponíveis em "Arquivados".`)) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setArquivarSelRunning(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    let ok = 0; let fail = 0;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (const id of ids) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const { error } = await supabase.rpc(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          "arquivar_dados_benner" as any,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          { _id: id, _motivo: "Arquivamento manual (seleção na tela)" } as any
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (error) fail++; else ok++;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (ok) toast.success(`${ok} registro(s) arquivado(s).`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (fail) toast.error(`${fail} falha(s) ao arquivar.`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } finally {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setArquivarSelRunning(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleMarcarPronto = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const ids = Array.from(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!ids.length) { toast.warning("Selecione registros para marcar como pronto"); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const BATCH = 200;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const { data: authData } = await supabase.auth.getUser();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const uid = authData?.user?.id || null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const nowIso = new Date().toISOString();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (let i = 0; i < ids.length; i += BATCH) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const batch = ids.slice(i, i + BATCH);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const { error } = await supabase.from("dados_benner" as any).update({ status: "pronto_envio" } as any).in("id", batch);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        // Se estavam Em análise, passam para Analisado e saem da lista padrão
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const { error: errAna } = await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .update({ analisado: true, analisado_em: nowIso, analisado_por: uid, em_analise: false, em_analise_por: null, em_analise_em: null } as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .in("id", batch)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .eq("em_analise", true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (errAna) { toast.error("Erro ao marcar Analisado: " + errAna.message); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.success(`${ids.length} registro(s) marcado(s) como Pronto!`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } catch (err: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error("Erro: " + (err?.message || "desconhecido"));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleMarcarEnviado = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const ids = Array.from(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!ids.length) { toast.warning("Selecione registros para marcar como enviado"); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const BATCH = 200;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (let i = 0; i < ids.length; i += BATCH) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const batch = ids.slice(i, i + BATCH);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const { error } = await supabase.from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .update({ status: "enviado", benner_atualizado: true } as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .in("id", batch);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.success(`${ids.length} registro(s) marcado(s) como Enviado!`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } catch (err: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error("Erro: " + (err?.message || "desconhecido"));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleMarcarEmAnalise = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const ids = Array.from(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!ids.length) { toast.warning("Selecione registros para marcar como Em análise"); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const { data: authData } = await supabase.auth.getUser();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const uid = authData?.user?.id || null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const BATCH = 200;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (let i = 0; i < ids.length; i += BATCH) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const batch = ids.slice(i, i + BATCH);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const { error } = await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .update({ em_analise: true, em_analise_por: uid, em_analise_em: new Date().toISOString() } as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .in("id", batch);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (error) { toast.error("Erro ao marcar Em análise: " + error.message); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.success(`${ids.length} registro(s) marcado(s) como Em análise!`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setFiltroEmAnalise("sim");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } catch (err: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error("Erro: " + (err?.message || "desconhecido"));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleFinalizarAnalise = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const ids = Array.from(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!ids.length) { toast.warning("Selecione registros para finalizar a análise"); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const BATCH = 200;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (let i = 0; i < ids.length; i += BATCH) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const batch = ids.slice(i, i + BATCH);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const { error } = await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .update({ em_analise: false, em_analise_por: null, em_analise_em: null } as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .in("id", batch);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (error) { toast.error("Erro ao finalizar análise: " + error.message); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.success(`Análise finalizada em ${ids.length} registro(s)!`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // Os registros saem do estado "Em análise"; se o filtro continuar
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // em "sim", a lista esvazia e parece que a tela se perdeu.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setFiltroEmAnalise("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } catch (err: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error("Erro: " + (err?.message || "desconhecido"));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleToggleSubidaMassaRow = async (id: string, novoValor: boolean, processoNumero?: string | null) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const { error } = await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      .update({ subida_em_massa: novoValor } as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      .eq("id", id);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (error) { toast.error("Erro ao atualizar Subida em Massa: " + error.message); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const proc = processoNumero || "processo";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    toast.success(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      novoValor
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ? `Marcado como Subida em Massa: ${proc}`
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        : `Desmarcado de Subida em Massa: ${proc}`
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Open Dados Benner form for a distribuição row
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleOpenBenner = async (dist: DistTst) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // Abre o detalhe unificado já posicionado na aba "Dados Benner".
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    scrollPageToTop();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setDetailInitialTab("benner");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setEditando(dist);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Save handler for Dados Benner form used from this page
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleSaveBenner = async (dado: DadoBennerInsert, id?: string) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // IMPORTANTE: NÃO usar mais (processo, dossiê) como chave para localizar
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // a linha. A base contém duplicatas (mesmo processo, com/sem dossiê) e o
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // lookup por processo cai na linha errada silenciosamente. Sem `id`,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // tratamos como inserção nova até a base ser higienizada.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    let rowId = id;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (rowId) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const { data: updated, error } = await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .update(dado as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .eq("id", rowId)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .select("id");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (!updated || (updated as any[]).length === 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.error("Atualização bloqueada por permissão (RLS). Verifique se você é o dono do registro ou tem perfil de admin/coordenador.");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        return false;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      rowId = (updated as any[])[0].id;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // Garante user_id no insert para satisfazer RLS (user_id = auth.uid())
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const { data: authData } = await supabase.auth.getUser();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const insertPayload = { ...(dado as any), user_id: (dado as any).user_id || authData?.user?.id || null };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const { data: inserted, error } = await (supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .insert(insertPayload)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .select("id")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .single() as any);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if ((inserted as any)?.id) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        return (inserted as any).id as string;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return rowId || true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Gerar relatório PDF de partes (respeita filtros e seleção)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleGerarRelatorioPdf = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setPdfRunning(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setPdfProgress({ current: 0, total: 0 });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      let ids: string[];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (selectedIds.size > 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ids = Array.from(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.info("Buscando processos filtrados...");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ids = await fetchAllFilteredBennerIds(debouncedFilters);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (ids.length === 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.info("Nenhum processo para gerar relatório.");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setPdfRunning(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (ids.length > 1500) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const ok = window.confirm(`O relatório terá ${ids.length} processos e pode demorar e gerar um arquivo grande. Continuar?`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (!ok) { setPdfRunning(false); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.info(`Carregando dados de ${ids.length} processo(s)...`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const processos = await fetchProcessosComPartes(ids, (c, t) => setPdfProgress({ current: c, total: t }));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const filtrosResumo = buildFiltrosResumo(debouncedFilters, {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        responsaveisLabel: filtroResponsavelIds.length > 0 ? `${filtroResponsavelIds.length} selecionado(s)` : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const blob = gerarRelatorioPartesPdf(processos, filtrosResumo);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const url = URL.createObjectURL(blob);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const a = document.createElement("a");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      a.href = url;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      a.download = `relatorio-partes-tst-${ts}.pdf`;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      document.body.appendChild(a);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      a.click();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      document.body.removeChild(a);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      URL.revokeObjectURL(url);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.success(`Relatório gerado com ${processos.length} processo(s).`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } catch (err: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error("Erro ao gerar relatório: " + (err?.message || String(err)));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } finally {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setPdfRunning(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Gerar relatório Excel da Distribuição TST (respeita filtros e seleção)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleGerarRelatorioExcel = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setXlsxRunning(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setXlsxProgress({ current: 0, total: 0 });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.info(selectedIds.size > 0 ? `Gerando planilha de ${selectedIds.size} processo(s)...` : "Buscando processos filtrados...");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const { blob, filename, total } = await gerarRelatorioExcelDistribuicaoTst({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        filters: debouncedFilters,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        selectedIds,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        onProgress: (c, t) => setXlsxProgress({ current: c, total: t }),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (total === 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.info("Nenhum processo para gerar a planilha.");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const url = URL.createObjectURL(blob);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const a = document.createElement("a");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      a.href = url;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      a.download = filename;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      document.body.appendChild(a);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      a.click();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      document.body.removeChild(a);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      URL.revokeObjectURL(url);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.success(`Planilha gerada com ${total} processo(s).`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } catch (err: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error("Erro ao gerar planilha: " + (err?.message || String(err)));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } finally {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setXlsxRunning(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  /**
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,   * Gera relatório XLSX dos campos obrigatórios em aberto, respeitando os
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,   * filtros aplicados (ou apenas os selecionados, se houver seleção).
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,   * Spec: KELLEN/2026-06 — ver `src/utils/distribuicaoTstPendencias.ts`.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,   */
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleGerarRelatorioPendencias = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setPendenciasRelRunning(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      let ids: string[];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (selectedIds.size > 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ids = Array.from(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.info("Buscando distribuições filtradas...");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ids = await fetchAllDistribuicaoTstIds(debouncedFilters);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (ids.length === 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.info("Nenhuma distribuição encontrada com os filtros atuais.");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // Carrega os campos obrigatórios em lotes
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const PAGE = 500;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const linhas: any[] = [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const colsExtras = Array.from(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        new Set([
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          "id",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          ...COLUNAS_SELECT_PENDENCIAS,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ]),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const selectCols = colsExtras.join(", ");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (let i = 0; i < ids.length; i += PAGE) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const batch = ids.slice(i, i + PAGE);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const { data, error } = await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .select(selectCols)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          .in("id", batch);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (error) throw error;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ((data as any[]) || []).forEach((r) => linhas.push(r));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // Monta planilha — uma linha por processo
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const XLSX = await import("xlsx");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const aoa: any[][] = [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      aoa.push(["Relatório de Pendências - Distribuição TST"]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      aoa.push([
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        "Processo",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        "Dossiê",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        "Equipe",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        "Total de Pendências",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        "Campos não preenchidos",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      ]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      let totalComPend = 0;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (const r of linhas) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const naoPrecisaFazer =
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          (r as any).processo_outro_escritorio === true ||
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          (r as any).segredo_justica === true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (naoPrecisaFazer) continue;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const pend = getPendencias(r);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (pend.length === 0) continue;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        totalComPend++;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        aoa.push([
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          r.processo || "",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          r.dossie || "",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          r.equipe || "",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          pend.length,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          pend.map((p) => p.label).join("; "),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (totalComPend === 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.success(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          `Tudo certo! Nenhuma pendência nos ${linhas.length} processo(s) verificados.`,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const ws = XLSX.utils.aoa_to_sheet(aoa);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      ws["!cols"] = [
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        { wch: 28 },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        { wch: 16 },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        { wch: 16 },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        { wch: 10 },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        { wch: 90 },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      ];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const wb = XLSX.utils.book_new();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      XLSX.utils.book_append_sheet(wb, ws, "Pendências");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const blob = new Blob([buf], {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const url = URL.createObjectURL(blob);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const a = document.createElement("a");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const ts = new Date()
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .toISOString()
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .replace(/[:.]/g, "-")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        .slice(0, 16);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      a.href = url;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      a.download = `Pendencias_Distribuicao_TST_${ts}.xlsx`;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      document.body.appendChild(a);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      a.click();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      document.body.removeChild(a);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      URL.revokeObjectURL(url);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.success(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        `Planilha gerada: ${totalComPend} processo(s) com pendências de ${linhas.length} verificados.`,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } catch (err: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        "Erro ao gerar relatório de pendências: " +
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          (err?.message || String(err)),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } finally {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setPendenciasRelRunning(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Gerar carga Benner respeitando os filtros aplicados na lista
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleGerarCarga = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setCargaLoading(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      let ids: string[];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (selectedIds.size > 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ids = Array.from(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.info("Buscando distribuições filtradas...");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        ids = await fetchAllDistribuicaoTstIds(debouncedFilters);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (ids.length === 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.info("Nenhuma distribuição encontrada com os filtros atuais.");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // Abre o modal imediatamente passando apenas os IDs. O carregamento dos
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // dados completos acontece dentro do modal com barra de progresso,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // evitando que o botão fique preso em "Carregando..." sem feedback.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setCargaDistribuicoes(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setCargaIdsAllowed(ids);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setShowCarga(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } catch (err: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error("Erro ao carregar dados para carga: " + (err?.message || String(err)));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } finally {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setCargaLoading(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const handleBulkJudit = async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    bulkAbortRef.current = false;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setBulkJuditRunning(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      let allProcessos: { id: string; processo_numero: string; dossie: string | null; turma: string | null; relator: string | null; data_distribuicao: string | null; parte_recorrente: string | null }[] = [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // If rows are selected, use only those
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (selectedIds.size > 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        allProcessos = dados.filter(d => selectedIds.has(d.id)).map(d => ({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          id: d.id,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          processo_numero: d.processo_numero,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          dossie: d.dossie,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          turma: d.turma,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          relator: d.relator,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          data_distribuicao: d.data_distribuicao_real || d.data_distribuicao_planilha,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          parte_recorrente: d.parte_recorrente,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        }));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        // Fetch all from current filtered view
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        let offset = 0;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const FETCH_SIZE = 1000;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        while (true) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          let q = supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            .select("id, processo, dossie, turma, relator, data_distribuicao, recorrente")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            .not("aba_origem", "is", null)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            .order("created_at", { ascending: false });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (debouncedFilters.aba_origem && debouncedFilters.aba_origem !== "todas") q = q.eq("aba_origem", debouncedFilters.aba_origem);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (debouncedFilters.benner === "sim") q = q.eq("benner_atualizado", true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          else if (debouncedFilters.benner === "nao") q = q.or("benner_atualizado.is.null,benner_atualizado.eq.false");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (debouncedFilters.processo) q = q.ilike("processo", `%${debouncedFilters.processo}%`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (debouncedFilters.dossie) q = q.ilike("dossie", `%${debouncedFilters.dossie}%`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (debouncedFilters.turma) q = q.ilike("turma", `%${debouncedFilters.turma}%`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (debouncedFilters.relator) q = q.ilike("relator", `%${debouncedFilters.relator}%`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (debouncedFilters.parte) q = q.ilike("recorrente", `%${debouncedFilters.parte}%`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const { data, error } = await q.range(offset, offset + FETCH_SIZE - 1);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (error) { toast.error("Erro ao buscar processos: " + error.message); break; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Mapeia para a forma esperada pelo loop abaixo
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const mapped = ((data as any[]) || []).map((d: any) => ({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            id: d.id,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            processo_numero: d.processo,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            dossie: d.dossie,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            turma: d.turma,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            relator: d.relator,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            data_distribuicao: d.data_distribuicao,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            parte_recorrente: d.recorrente,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          }));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          allProcessos = allProcessos.concat(mapped);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (!data || data.length < FETCH_SIZE) break;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          offset += FETCH_SIZE;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // Deduplica por ID. Mesmo processo pode existir mais de uma vez com
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // dossiês/origens diferentes; deduplicar por número fazia a rotina em
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // massa atualizar uma linha errada e deixar outra intacta.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const seen = new Set<string>();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const unique = allProcessos.filter(p => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (!p.id || seen.has(p.id)) return false;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        seen.add(p.id);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        return true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (unique.length === 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        toast.info("Nenhum processo encontrado");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setBulkJuditRunning(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      setBulkJuditProgress({ current: 0, total: unique.length });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      let successCount = 0;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      // Cache do user id para gravar judit_logs (mesma lógica do botão individual)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const { data: bulkAuthData } = await supabase.auth.getUser();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const bulkUserId = bulkAuthData?.user?.id || null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (let i = 0; i < unique.length; i++) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        if (bulkAbortRef.current) { toast.info("Operação cancelada"); break; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        const proc = unique[i];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        setBulkJuditProgress({ current: i + 1, total: unique.length });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const requestPayload = { numero_processo: aplicarMascaraCnj(proc.processo_numero), tribunal: "TST", com_anexos: bulkComAnexos };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const { data: juditData, error: juditError } = await supabase.functions.invoke("buscar-judit", {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            body: requestPayload,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Persiste log da consulta (sucesso, erro de função ou erro retornado),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // exatamente como o botão Judit individual faz.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            await supabase.from("judit_logs" as any).insert({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              processo_numero: proc.processo_numero,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              tribunal: "TST",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              request_payload: requestPayload,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              raw_response: juditData ?? null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              status: juditError ? "erro_funcao" : (juditData?.error ? "erro_api" : "sucesso"),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              error_message: juditError?.message || juditData?.error || null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              created_by: bulkUserId,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          } catch (logErr) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            console.warn("[bulk-judit] Falha ao gravar judit_logs:", logErr);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (juditError || juditData?.error) continue;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const recorrenteJudit = getJuditPartesResumo(juditData, proc.parte_recorrente);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const partiesDetail = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Quando a busca em lote foi solicitada COM ANEXOS, persiste a lista
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // em judit_anexos exatamente como o botão individual do formulário.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (bulkComAnexos) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            const atts = Array.isArray((juditData as any)?.attachments) ? (juditData as any).attachments : [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (atts.length > 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const numeroMasc = aplicarMascaraCnj(proc.processo_numero);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const rowsRaw = atts.map((a: any) => ({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  processo_numero: proc.processo_numero,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  cnj: a?.cnj || numeroMasc,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  instance: a?.instance != null ? String(a.instance) : null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  attachment_id: String(a?.step_id || a?.attachment_id || ""),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  step_id: a?.step_id ? String(a.step_id) : null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  attachment_name: a?.attachment_name || null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  attachment_date: a?.attachment_date || null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  extension: a?.extension || null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  status: a?.status || "done",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  corrupted: a?.corrupted ?? false,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  raw_attachment: a,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  created_by: bulkUserId,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                })).filter((r: any) => r.attachment_id);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const seen = new Set<string>();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const rows = rowsRaw.filter((r: any) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  const key = getJuditAttachmentDedupKey(r);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  if (seen.has(key)) return false;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  seen.add(key);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  return true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                });
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                if (rows.length > 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    .from("judit_anexos" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    .delete()
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    .eq("processo_numero", proc.processo_numero);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    .from("judit_anexos" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    .insert(rows);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              } catch (e) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                console.warn("[bulk-judit] Falha ao persistir judit_anexos:", e);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Mesma extração do formulário individual: nomes por polo (sem advogados)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const nomesPorPolo = (poloUpper: string) =>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            [...new Set(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              partiesDetail
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .filter((p: any) => (p?.polo || "").toString().toUpperCase() === poloUpper && !p?.is_advogado)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .map((p: any) => String(p?.nome || "").trim())
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .filter(Boolean)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            )].join(" / ");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const reclamanteJudit = nomesPorPolo("ACTIVE");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const reclamadaJudit = nomesPorPolo("PASSIVE");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Trânsito em julgado: situação contém "trânsito" OU processo_baixado === "S"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const situacaoStr = (juditData.situacao_processo || "").toString();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const baixadoStr = (juditData.processo_baixado || "").toString().toUpperCase();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const ehTransito = /tr[âa]nsito/i.test(situacaoStr) || baixadoStr === "S";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Atualiza apenas a linha selecionada. Mesmo processo pode ter mais
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // de um dossiê/origem na base; nunca atualizar por `processo` aqui.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const tribunaisAceitos = ["TST", "STF", "STJ"];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const tribunalMapeado = tribunaisAceitos.includes(juditData.tribunal) ? juditData.tribunal : null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Helper: turma é uma das 8 turmas oficiais do TST?
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const isTurmaOficialTst = (t: string | null | undefined): boolean => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (!t) return false;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            const norm = String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            return /^[1-8][ªa]?\s*turma$/.test(norm);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const turmaFinal = juditData.turma || proc.turma || "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const erroJuditFlag = !isTurmaOficialTst(turmaFinal);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const bennerId = (proc as any).id as string | undefined;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (!bennerId) continue;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            // Mesma regra do formulário individual: a Judit é fonte da verdade.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            // Para os campos de Tipo de Recurso a Judit é fonte ÚNICA — quando
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            // ela não confirma um recurso, o valor antigo (possivelmente errado)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            // é APAGADO (gravado como NULL). Para os demais campos, sobrescreve
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            // apenas quando a Judit retornou um valor.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            const updateFields: any = {};
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            // Tipos de recurso: sempre sobrescreve (inclui null para apagar).
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            updateFields.tipo_recurso = juditData.tipo_recurso ?? null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            updateFields.tipo_recurso_reclamante = juditData.tipo_recurso_reclamante ?? null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            updateFields.tipo_recurso_banco = juditData.tipo_recurso_banco ?? null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.relator) updateFields.relator = juditData.relator;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.turma) updateFields.turma = juditData.turma;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (tribunalMapeado) updateFields.tribunal = tribunalMapeado;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (recorrenteJudit) updateFields.recorrente = recorrenteJudit;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (reclamanteJudit) updateFields.reclamante = reclamanteJudit;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (reclamadaJudit) updateFields.reclamada = reclamadaJudit;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.situacao_processo) updateFields.situacao_processo = juditData.situacao_processo;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (ehTransito) updateFields.transito_julgado = true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.data_distribuicao) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              updateFields.data_distribuicao_real = juditData.data_distribuicao;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              updateFields.data_distribuicao = juditData.data_distribuicao;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.tem_data_julgamento) updateFields.tem_data_julgamento = juditData.tem_data_julgamento;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.data_julgamento) updateFields.data_julgamento = juditData.data_julgamento;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.horario_julgamento) updateFields.horario_julgamento = juditData.horario_julgamento;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.tipo_julgamento) updateFields.tipo_julgamento = juditData.tipo_julgamento;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.resultado_sem_transcendencia) updateFields.resultado_sem_transcendencia = true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.resultado_nao_conhecido) updateFields.resultado_nao_conhecido = true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.resultado_conhecido_provido) updateFields.resultado_conhecido_provido = true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.resultado_conhecido_nao_provido) updateFields.resultado_conhecido_nao_provido = true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.resultado_outra) updateFields.resultado_outra = juditData.resultado_outra;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (juditData.processo_baixado) updateFields.processo_baixado = juditData.processo_baixado;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            // Sempre reavalia o flag erro_judit com a turma final (mesmo que turma não tenha mudado)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            updateFields.erro_judit = erroJuditFlag;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            if (Object.keys(updateFields).length > 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const { data: upd, error: updErr } = await (supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .update(updateFields as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .eq("id", bennerId)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .select("id") as any);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              if (updErr) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                console.warn("[bulk-judit] update error", proc.processo_numero, updErr.message);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              } else if (!upd || (upd as any[]).length === 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                console.warn("[bulk-judit] update bloqueado por RLS", proc.processo_numero);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                successCount++;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Persiste partes detalhadas (CPF/CNPJ, advogados, etc.) na aba "Partes"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          if (bennerId && partiesDetail.length > 0) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              .from("partes_processo_benner")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              .delete()
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              .eq("dados_benner_id", bennerId)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              .eq("origem", "judit");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            const partesRows = partiesDetail.map((p: any) => ({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              dados_benner_id: bennerId,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              nome: p.nome || "Sem nome",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              documento: p.documento || null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              tipo_pessoa: p.tipo_pessoa || null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              polo: p.polo || null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              is_advogado: !!p.is_advogado,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              origem: "judit",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            }));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            await supabase.from("partes_processo_benner").insert(partesRows);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Marca o registro em dados_benner como judit_preenchido
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          const { data: authData2 } = await supabase.auth.getUser();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            .update({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              judit_preenchido: true,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              judit_preenchido_em: new Date().toISOString(),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              judit_preenchido_por: authData2?.user?.id || null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            } as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            .eq("id", bennerId);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Throttle to avoid rate limits
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          await new Promise(r => setTimeout(r, 800));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        } catch {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          // Continue on error
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.success(`Judit: ${successCount} de ${unique.length} processo(s) atualizados no Dados Benner`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } catch (err: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      toast.error("Erro no preenchimento em massa: " + (err?.message || "Erro desconhecido"));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    setBulkJuditRunning(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    // Recarrega a lista e os stats para refletir judit_preenchido / dados atualizados
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try { await fetchDados(); } catch {}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try { refetchStats(); } catch {}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const formatDate = (d: string | null) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (!d) return "—";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  // Pagination helpers
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const getVisiblePages = () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const pages: number[] = [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    const maxVisible = 7;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    if (totalPages <= maxVisible) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (let i = 1; i <= totalPages; i++) pages.push(i);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      pages.push(1);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const start = Math.max(2, page - 2);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      const end = Math.min(totalPages - 1, page + 2);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (start > 2) pages.push(-1);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      for (let i = start; i <= end; i++) pages.push(i);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      if (end < totalPages - 1) pages.push(-2);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      pages.push(totalPages);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return pages;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  };
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  if (showCarga) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      <MainLayout title="Distribuição TST - Carga Benner">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        <div className="space-y-4">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <div className="flex items-center justify-between">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <FileSpreadsheet className="w-6 h-6 text-primary" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              Carga Benner
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </h1>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <Button variant="outline" onClick={() => { setShowCarga(false); setCargaDistribuicoes(null); setCargaIdsAllowed(null); }}>Voltar à Lista</Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <CargaBennerFromDb 
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            selectedRecordIds={selectedIds.size > 0 ? Array.from(selectedIds) : undefined}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            distribuicoes={cargaDistribuicoes || undefined}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            idsAllowed={cargaIdsAllowed || undefined}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            filters={{
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            aba_origem: filtroAba !== "todas" ? filtroAba : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            benner: filtroBenner as any,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            processo: filtroProcesso || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            dossie: filtroDossie || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            turma: filtroTurma || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            relator: filtroRelator || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            parte: filtroParte || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            nomeParte: filtroNomeParte || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            mesAno: filtroMesAno !== "todos" ? filtroMesAno : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            dataInicio: filtroDataInicio || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            dataFim: filtroDataFim || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          }} />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      </MainLayout>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  if (showForm || editando) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      <MainLayout title="Distribuição TST">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        <div className="max-w-7xl mx-auto px-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <DistribuicaoTstDetail
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            dado={editando}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            initialTab={detailInitialTab}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            onSaveDistribuicao={async (d, id) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const targetId = id || editando?.id || undefined;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const result = await saveDado(d, targetId);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const savedId = typeof result === "string" ? result : (targetId || null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              if (savedId) { setStickyId(savedId); setHighlightUntil(Date.now() + 8000); }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              return result;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            onSaveBenner={async (d, id) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const targetId = id || editando?.id || undefined;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const result = await handleSaveBenner(d, targetId);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const savedId = typeof result === "string" ? result : (targetId || null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              if (savedId) { setStickyId(savedId); setHighlightUntil(Date.now() + 8000); }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              return result;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            onAfterJuditSync={async (newId?: string) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // Após o auto-save do botão Judit, recarrega o registro atual
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // do banco e atualiza `editando` para que `judit_preenchido=true`
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // e os campos preenchidos fiquem destacados em verde mesmo
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // após sair e voltar.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // Se for um registro recém-criado (Novo registro + Judit), usa o
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // `newId` retornado pelo auto-save para popular `editando` e
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // habilitar as abas dependentes (Log Judit, Análise, Benner).
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const id = editando?.id || newId;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              if (!id) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const { data } = await supabase
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .from("dados_benner" as any)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .select("*")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .eq("id", id)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                .maybeSingle();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              if (data) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const b: any = data;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const relatorFav = b.posicao_relator_favoravel ? "POSITIVO" : b.posicao_relator_desfavoravel ? "NEGATIVO" : null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const turmaFav = b.posicao_turma_favoravel ? "POSITIVA" : b.posicao_turma_desfavoravel ? "NEGATIVA" : null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                setEditando({
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  ...((editando as any) || {}),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  ...b,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  id,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  processo_numero: b.processo || editando?.processo_numero || "",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  parte_recorrente: b.recorrente ?? null,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  relator_favorabilidade: relatorFav,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  turma_favorabilidade: turmaFav,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  judit_preenchido: !!b.judit_preenchido,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                } as any);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              if (id) { setStickyId(id); setHighlightUntil(Date.now() + 8000); }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            onClose={() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setShowForm(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setEditando(null);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setDetailInitialTab("distribuicao");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              try { fetchDados(); } catch {}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              try { refetchStats(); } catch {}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              try { refetchResponsavelCounts(); } catch {}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      </MainLayout>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const mesesLabels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  const delegarButton = isAdminOrCoordinator ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      className="h-8 text-xs"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      onClick={() => setDelegarOpen(true)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      disabled={selectedIds.size === 0}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      <UserPlus className="w-3 h-3 mr-1" /> Delegar{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  ) : null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    <MainLayout
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      title="Distribuição TST"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      headerActions={
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        <div className="flex items-center gap-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            variant="ghost"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            size="icon"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            onClick={() => setMostrarCards(v => !v)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            className="text-muted-foreground hover:text-foreground"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            title={mostrarCards ? "Ocultar cards totalizadores" : "Mostrar cards totalizadores"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            aria-label={mostrarCards ? "Ocultar cards totalizadores" : "Mostrar cards totalizadores"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {mostrarCards ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            variant="ghost"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            size="icon"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            onClick={() => setMostrarFiltros(v => !v)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            className="text-muted-foreground hover:text-foreground"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            title={mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            aria-label={mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {mostrarFiltros ? <SlidersHorizontal className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4 opacity-50" />}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            onClick={() => gerarManualDistribuicaoTst()}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            className="bg-blue-600 hover:bg-blue-700 text-white"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            title="Baixa o manual completo em PDF: cards, filtros, botões, importações, Judit, Kanban e dicas."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <FileText className="w-4 h-4 mr-2" /> M. Instruções
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            onClick={handleGerarRelatorioExcel}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            disabled={xlsxRunning}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            title="Gera uma planilha Excel obedecendo os filtros: Processo, Dossiê, Equipe, Data da Distribuição, Responsável, Situação do Processo, Status do Envio, Em Análise e Situação Carga Santander."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {xlsxRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {xlsxRunning
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              ? (xlsxProgress.total > 0 ? `Gerando Excel ${xlsxProgress.current}/${xlsxProgress.total}` : "Gerando Excel...")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              : selectedIds.size > 0
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                ? `Relatório Excel (${selectedIds.size})`
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                : "Relatório Excel"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      <div className="space-y-4">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        <div className="flex gap-2 flex-wrap justify-end items-center">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          {isAdminOrCoordinator && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                onClick={handleGerarRelatorioPdf}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                disabled={pdfRunning}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                title="Gera um PDF profissional listando as partes (polo ativo/passivo) de cada processo, respeitando os filtros aplicados."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                {pdfRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                {pdfRunning
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  ? (pdfProgress.total > 0 ? `Gerando PDF ${pdfProgress.current}/${pdfProgress.total}` : "Gerando PDF...")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  : selectedIds.size > 0
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    ? `Relatório PDF Partes (${selectedIds.size})`
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    : "Relatório PDF Partes"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {/* Botões de importação movidos para Admin TST → Importações Distribuição TST */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Link to="/dados-benner">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Button variant="outline">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <ExternalLink className="w-4 h-4 mr-2" /> Dados Benner
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Link>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Link to="/distribuicao-tst/kanban">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Button variant="outline">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <LayoutGrid className="w-4 h-4 mr-2" /> Kanban Delegação
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Link>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {isAdmin && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Link to="/distribuicao-tst/arquivados">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <Button variant="outline">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <Archive className="w-4 h-4 mr-2" /> Arquivados
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Link>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {isAdminOrCoordinator && filtroDuplicado === "sim" && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  onClick={() => setArquivarDupOpen(true)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  disabled={arquivarDupRunning}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  title="Arquiva os duplicados respeitando os filtros atuais. Mantém o registro com mais tags (empate: mais campos preenchidos). Se outro do grupo tiver alteração mais recente, esse é mantido. Nada é apagado."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  className="border-amber-400 text-amber-700 hover:bg-amber-50"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  {arquivarDupRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  {arquivarDupRunning ? "Arquivando..." : "Arquivar duplicados"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {isAdminOrCoordinator && selectedIds.size > 0 && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  onClick={handleArquivarSelecionados}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  disabled={arquivarSelRunning}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  title="Arquiva apenas os registros selecionados. Eles ficam disponíveis em 'Arquivados' e podem ser restaurados."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  className="border-amber-400 text-amber-700 hover:bg-amber-50"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  {arquivarSelRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  {arquivarSelRunning ? "Arquivando..." : `Arquivar selecionados (${selectedIds.size})`}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <DossiesNaoLocalizadosButton filters={debouncedFilters} selectedIds={selectedIds} />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Button variant="secondary" onClick={handleGerarCarga} disabled={cargaLoading}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                {cargaLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                {cargaLoading
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  ? "Carregando..."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  : selectedIds.size > 0
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    ? `Carga Benner (${selectedIds.size})`
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    : "Gerar Carga Benner"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {/* Stats Cards (respeitam os filtros e são clicáveis) */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {mostrarCards && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <DistribuicaoTstStatsCards
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            stats={statsWithGeral}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            loading={statsLoading}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            activeKey={activeCardKey}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            onCardClick={handleCardClick}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            prontoSemPendencia={{
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              count: prontoSemPendenciaCount,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              loading: prontoSemPendenciaLoading,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            multiRespCard={isAdmin ? {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              count: multiRespIds.length,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              active: filtroMultiResp,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              onClick: () => handleCardClick("multiResp"),
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            } : null}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            responsavelCard={(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // Quando há exatamente UM responsável selecionado no filtro,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // o card reflete esse responsável (útil para o admin trocar e
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // ver os totais de outra pessoa). Caso contrário, mostra o
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // usuário logado.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const targetId = filtroResponsavelIds.length === 1
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                ? filtroResponsavelIds[0]
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                : user?.id;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const alvo = targetId ? responsavelCounts.find(c => c.id === targetId) : null;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const nome = alvo?.nome;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              return {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                atribuidos: alvo?.count ?? 0,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                prontos: alvo?.pronto ?? 0,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                nome: filtroResponsavelIds.length === 1 ? nome : undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              } as any;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            })()}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            onResponsavelClick={() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              if (!user?.id) return;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // Reseta filtros conflitantes
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroProcessoStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroDossieStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroJudit("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroBenner("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroSituacaoProcesso("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroSemTurma(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroProblemaJudit("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroEquipe("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroDataInicio("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroDataFim("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroMesAno("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              // Filtra por meu usuário + apenas Prontos
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroResponsavelIds([user.id]);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              setFiltroStatus("pronto_envio");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {/* Totais por responsável — visível apenas para administradores. */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {mostrarCards && isAdmin && responsavelCounts.filter(c => c.count > 0).length > 0 && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <div className="flex flex-wrap gap-1.5">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <span className="text-[11px] font-medium text-muted-foreground self-center mr-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              Por responsável:
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {responsavelCounts.filter(c => c.count > 0).map((c) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const isSemResp = c.id === "00000000-0000-0000-0000-000000000000";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const filterValue = isSemResp ? "__sem_responsavel__" : c.id;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const active = filtroResponsavelIds.includes(filterValue);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              const faltam = Math.max(0, c.count - (c.pronto || 0));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  key={c.id}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  type="button"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  onClick={() => setFiltroResponsavelIds(active ? [] : [filterValue])}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all hover:shadow-sm ${
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    active
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      ? "border-primary bg-primary/10 text-primary"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      : isSemResp
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        : "border-border bg-card text-foreground hover:bg-muted"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  }`}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  title={`${c.nome} — Total: ${c.count} • Pronto: ${c.pronto} • Faltam: ${faltam}`}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <span className="truncate max-w-[160px]">{c.nome}</span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <span
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    className="rounded-sm bg-muted px-1.5 py-0.5 font-bold tabular-nums"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    title="Total"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    {c.count}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <span
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    className="rounded-sm bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 font-bold tabular-nums"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    title="Pronto (finalizadas)"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    {c.pronto}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <span
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    className={`rounded-sm px-1.5 py-0.5 font-bold tabular-nums ${
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      faltam > 0
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        : "bg-muted text-muted-foreground"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    }`}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    title="Faltam"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    {faltam}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            })}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {/* Mês/Ano dropdown — apenas admin/coordenador */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {mesesAnos.length > 0 && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <div className="flex items-center gap-2 flex-wrap">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {isAdminOrCoordinator && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-xs font-bold text-muted-foreground">Mês/Ano:</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  value={filtroMesAno}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  onValueChange={(val) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    setFiltroMesAno(val);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    if (val === "todos" || val === "sem-data") {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroDataInicio("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroDataFim("");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const [y, m] = val.split("-").map(Number);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const last = new Date(y, m, 0).getDate();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroDataInicio(`${val}-01`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroDataFim(`${val}-${String(last).padStart(2, "0")}`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs w-64">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Selecione o mês/ano" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      Todos meses ({mesesAnos.reduce((s, m) => s + m.count, 0)})
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    </SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    {mesesAnos.map(({ key, count }) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      if (key === "sem-data") {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <SelectItem key={key} value={key}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            Sem data ({count})
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          </SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const [y, m] = key.split("-");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const label = `${mesesLabels[parseInt(m) - 1]}/${y}`;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        <SelectItem key={key} value={key}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {label} ({count})
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        </SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    })}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <div className="h-6 w-px bg-border mx-1" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {delegarButton}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {isAdminOrCoordinator && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                className="h-8 text-xs"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                onClick={() => { scrollPageToTop(); setDetailInitialTab("distribuicao"); setShowForm(true); }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Plus className="w-3 h-3 mr-1" /> Nova Distribuição
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {isAdminOrCoordinator && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                onClick={() => setAutoDistOpen(true)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                disabled={totalCount === 0}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                title="Divide automaticamente todos os processos do filtro atual entre os advogados selecionados (round-robin)."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Shuffle className="w-3 h-3 mr-1" /> Distribuir automaticamente
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                {totalCount > 0 ? ` (${totalCount})` : ""}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {isAdminOrCoordinator && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  onClick={async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    const ids = Array.from(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    if (!ids.length) { toast.warning("Selecione registros primeiro"); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    const BATCH = 200;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    for (let i = 0; i < ids.length; i += BATCH) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const batch = ids.slice(i, i + BATCH);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const { error } = await supabase.from("dados_benner" as any).update({ subida_em_massa: true } as any).in("id", batch);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      if (error) { toast.error("Erro: " + error.message); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    toast.success(`${ids.length} marcado(s) como Subida em Massa`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  disabled={selectedIds.size === 0}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  title="Marca os processos selecionados como Subida em Massa"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <Layers className="w-3 h-3 mr-1" /> Marcar Subida em Massa
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  onClick={async () => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    const ids = Array.from(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    if (!ids.length) { toast.warning("Selecione registros primeiro"); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    const BATCH = 200;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    for (let i = 0; i < ids.length; i += BATCH) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const batch = ids.slice(i, i + BATCH);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const { error } = await supabase.from("dados_benner" as any).update({ subida_em_massa: false } as any).in("id", batch);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      if (error) { toast.error("Erro: " + error.message); return; }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    toast.success(`${ids.length} desmarcado(s) de Subida em Massa`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    handleRefresh();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  disabled={selectedIds.size === 0}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  className="h-8 text-xs border-purple-500 text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/30"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  title="Remove a marca Subida em Massa dos processos selecionados"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <X className="w-3 h-3 mr-1" /> Desmarcar Subida em Massa
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              onClick={handleBulkJudit}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              disabled={bulkJuditRunning}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {bulkJuditRunning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {bulkJuditRunning
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                ? `Judit ${bulkJuditProgress.current}/${bulkJuditProgress.total}`
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                : selectedIds.size > 0
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  ? `Preencher c/ Judit (${selectedIds.size})`
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  : "Preencher com Judit"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {isAdmin && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <label
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none px-1"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                title="Inclui a lista de anexos do processo (consulta Judit mais cara)."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Checkbox
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  checked={bulkComAnexos}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  onCheckedChange={(v) => setBulkComAnexos(v === true)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  disabled={bulkJuditRunning}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                Com anexos
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {bulkJuditRunning && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => { bulkAbortRef.current = true; }}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <X className="w-3 h-3 mr-1" /> Cancelar
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleMarcarPronto} disabled={selectedIds.size === 0}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <CheckCircle className="w-3 h-3 mr-1" /> Marcar como Pronto{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleMarcarEnviado} disabled={selectedIds.size === 0}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Send className="w-3 h-3 mr-1" /> Marcar como Enviado{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              className="h-8 text-xs border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              onClick={handleMarcarEmAnalise}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              disabled={selectedIds.size === 0}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              title="Trava esses registros como 'Em análise' — eles ficam estáveis na lista até você finalizar"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Filter className="w-3 h-3 mr-1" /> Marcar Em Análise{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              className="h-8 text-xs"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              onClick={handleFinalizarAnalise}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              disabled={selectedIds.size === 0}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              title="Remove a marca 'Em análise' dos registros selecionados"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <CheckCircle2 className="w-3 h-3 mr-1" /> Finalizar Análise{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              variant={mostrarPendencias ? "default" : "outline"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              onClick={() => setMostrarPendencias((v) => !v)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              title="Mostra uma coluna na lista com os campos obrigatórios ainda não preenchidos em cada processo (spec da advogada Kellen)."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              className={
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                mostrarPendencias
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  ? "h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  : "h-8 text-xs border-red-300 text-red-700 hover:bg-red-50"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <CheckCircle className="w-3 h-3 mr-1" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {mostrarPendencias ? "Ocultar Pendências" : "Verificar Pendências"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              onClick={handleGerarRelatorioPendencias}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              disabled={pendenciasRelRunning}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              title="Gera um Excel listando todos os processos com campos obrigatórios em aberto, respeitando os filtros (ou apenas os selecionados)."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              className="h-8 text-xs border-red-300 text-red-700 hover:bg-red-50"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {pendenciasRelRunning ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              ) : (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <FileSpreadsheet className="w-3 h-3 mr-1" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {pendenciasRelRunning
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                ? "Gerando..."
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                : selectedIds.size > 0
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  ? `Relatório Pendências (${selectedIds.size})`
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  : "Relatório Pendências"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {/* Resposta Santander movido para Admin TST → Importações Distribuição TST */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {isAdminOrCoordinator && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <BulkTagAction
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                selectedIds={Array.from(selectedIds)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                filters={debouncedFilters}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                totalFiltered={totalCount}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {/* Filters */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {mostrarFiltros && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <div className="flex flex-wrap items-end gap-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <div className="space-y-1 flex-1 min-w-[220px] max-w-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Label className="text-[10px] font-semibold text-muted-foreground">Responsáveis</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <ResponsaveisSelector
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                selectedIds={filtroResponsavelIds}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                onChange={setFiltroResponsavelIds}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                placeholder="Todos os responsáveis"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                coordenacaoId="3e47fc83-3539-4fa7-9fcf-33825120e1b7"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                includeUnassignedOption
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <div className="space-y-0.5">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Label className="text-[10px] font-semibold text-muted-foreground">Data inicial</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className="h-8 text-xs w-[140px]" title="Data início" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <div className="space-y-0.5">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Label className="text-[10px] font-semibold text-muted-foreground">Data final</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className="h-8 text-xs w-[140px]" title="Data fim" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <div className="ml-auto">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {hasFilters && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  variant="destructive"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  onClick={clearFilters}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  className="h-8 shadow-md hover:shadow-lg transition-all font-semibold"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <X className="w-4 h-4 mr-1" /> Limpar Filtros
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          {/* Busca por texto livre */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <div className="space-y-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="relative">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Input placeholder="Buscar por Processo" value={filtroProcesso} onChange={e => setFiltroProcesso(formatProcessoNumero(e.target.value) === "-" ? e.target.value : formatProcessoNumero(e.target.value))} className="h-8 text-xs pl-7" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="relative">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Input placeholder="Buscar por Dossiê" value={filtroDossie} onChange={e => setFiltroDossie(formatProcessoNumero(e.target.value) === "-" ? e.target.value : formatProcessoNumero(e.target.value))} className="h-8 text-xs pl-7" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="relative">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Input placeholder="Buscar por Parte Recorrente" value={filtroParte} onChange={e => setFiltroParte(e.target.value)} className="h-8 text-xs pl-7" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Select value={filtroParteRecorrente || "todas"} onValueChange={(v) => setFiltroParteRecorrente(v === "todas" ? "" : v)}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectValue placeholder="Parte Recorrente" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectItem value="todas">Todas as Partes Recorrentes</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectItem value="Reclamante">Reclamante</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectItem value="Reclamado">Reclamado</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectItem value="Reclamante e Reclamado">Reclamante e Reclamado</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectItem value="Terceiro">Terceiro</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectItem value="Reclamante e Terceiro">Reclamante e Terceiro</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectItem value="Reclamado e Terceiro">Reclamado e Terceiro</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectItem value="Reclamante, Reclamado e Terceiro">Reclamante, Reclamado e Terceiro</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="relative">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Input placeholder="Buscar por Nome da Parte (Reclamante/Reclamada)" value={filtroNomeParte} onChange={e => setFiltroNomeParte(e.target.value)} className="h-8 text-xs pl-7" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          {/* Filtros por categoria (listas) */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <div className="space-y-2 pt-2 border-t border-border/50">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Filter className="w-3 h-3" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              Filtros por categoria (selecione uma opção)
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {/* VERDE */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-green-600">Benner</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroBenner} onValueChange={setFiltroBenner}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Benner" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todos</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="sim">Sim</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="nao">Não</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-green-600">Judit</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroJudit} onValueChange={setFiltroJudit}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Judit" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todos</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="sim">Preenchido com Judit</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="nao">Não preenchido com Judit</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {/* VERMELHO — apenas admin/coordenador */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {isAdminOrCoordinator && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <Label className="text-[10px] font-semibold text-red-600">TAGs</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <Select value={filtroTagId} onValueChange={setFiltroTagId}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <SelectValue placeholder="TAGs" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <SelectItem value="todas">Todas</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      {tagsCatalogo.map((t) => (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        <SelectItem key={t.id} value={t.id}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <span className="inline-flex items-center gap-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <span
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              className="inline-block w-2 h-2 rounded-full"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              style={{ backgroundColor: t.cor }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            {t.nome}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          </span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        </SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      ))}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {/* LARANJA */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-orange-600">Em análise</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroEmAnalise} onValueChange={setFiltroEmAnalise}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Em análise" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todos</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="sim">Apenas Em análise</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="nao">Não em análise</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="analisado">Analisado</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-blue-600">Provas Digitais</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroProvasDigitais} onValueChange={setFiltroProvasDigitais}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Provas Digitais" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todas</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="sim">Com Provas Digitais (S)</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="nao">Sem Provas Digitais (N)</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="nao_selecionado">Não selecionado</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-blue-600">Status envio</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  value={
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    filtroProblemaJudit === "sim"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      ? "problema_judit"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      : filtroAcordo === "sim"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        ? "acordo"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        : filtroStatus
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  onValueChange={(v) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    if (v === "problema_judit") {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroProblemaJudit("sim");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroAcordo("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    } else if (v === "acordo") {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroAcordo("sim");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroProblemaJudit("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroStatus("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroProblemaJudit("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroAcordo("todos");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      setFiltroStatus(v);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Status envio" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todos</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="rascunho">Rascunho</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="pronto_envio">Pronto para Enviar</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="enviado">Enviado</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="planilhado">Planilhado</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="problema_judit">Problema Judit</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="acordo">Acordo</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {/* AZUL */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-blue-600">Equipe</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Equipe" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todos</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="sim">Sim</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="nao">Não</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {/* SEM COR */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-muted-foreground">Aba origem</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroAba} onValueChange={setFiltroAba}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Aba origem" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todas">Todas</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    {abas.map(({ aba, count }) => (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <SelectItem key={aba} value={aba}>{aba} ({count})</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    ))}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-muted-foreground">Dossiê</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroDossieStatus} onValueChange={setFiltroDossieStatus}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Dossiê" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todos</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="preenchido">Preenchido</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="nao_preenchido">Não Preenchido</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="valido">Preenchido Válido</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="invalido">Preenchido Inválido</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-muted-foreground">Processo</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroProcessoStatus} onValueChange={setFiltroProcessoStatus}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Processo" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todos</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="valido">Válido (CNJ)</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="invalido">Inválido</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-muted-foreground">Duplicados</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroDuplicado} onValueChange={setFiltroDuplicado}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Duplicados" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todos</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="sim">Apenas duplicados</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="nao">Apenas não duplicados</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-muted-foreground">Origem importação</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroFonteImportacao} onValueChange={setFiltroFonteImportacao}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Origem importação" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todas">Todas</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="Resposta Santander">Resposta Santander</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="Certidão TST">Certidão TST (PDF)</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="Planilha Distribuição">Planilha Distribuição</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-muted-foreground">Situação processo</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroSituacaoProcesso} onValueChange={setFiltroSituacaoProcesso}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Situação" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todas</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="ativo">Ativo</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="transito">Trânsito em Julgado</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="outros">Outros</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="outro_escritorio">Processo outro escritório</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="segredo_justica">Segredo de Justiça</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="a_fazer">A fazer</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <div className="space-y-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Label className="text-[10px] font-semibold text-muted-foreground">Subida em massa</Label>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <Select value={filtroSubidaMassa} onValueChange={setFiltroSubidaMassa}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectTrigger className="h-8 text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectValue placeholder="Subida em massa" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="todos">Todos</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="sim">Sim</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <SelectItem value="nao">Não</SelectItem>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </SelectContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </Select>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <div className="flex items-center gap-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <p className="text-xs text-muted-foreground">{totalCount} registros encontrados</p>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            {selectedIds.size > 0 && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => setSelectedIds(new Set())}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                {selectedIds.size} selecionado(s) — limpar
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {/* Bulk Judit progress */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {bulkJuditRunning && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <div className="border border-emerald-500/30 rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/20 space-y-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <div className="flex items-center justify-between text-sm">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <span className="font-medium text-emerald-700 dark:text-emerald-400">Preenchendo com Judit...</span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <span className="text-xs text-muted-foreground">{bulkJuditProgress.current}/{bulkJuditProgress.total}</span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <Progress value={bulkJuditProgress.total > 0 ? (bulkJuditProgress.current / bulkJuditProgress.total) * 100 : 0} className="h-2" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {/* Table container */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        <div className="border rounded-lg overflow-x-auto">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <Table>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <TableHeader>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <TableRow>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <TableHead className="w-10">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <Checkbox 
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    checked={dados.length > 0 && dados.every(d => selectedIds.has(d.id))}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    disabled={selectAllLoading}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    onCheckedChange={async (checked) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      if (checked) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        // Seleciona TODOS os registros que batem com o filtro atual
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        // (não apenas os da página visível).
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        try {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          setSelectAllLoading(true);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          const allIds = await fetchAllDistribuicaoTstIds(debouncedFilters);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          setSelectedIds(new Set(allIds));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          if (allIds.length > dados.length) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            toast.success(`${allIds.length} processo(s) selecionado(s) (todos os filtrados)`);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        } catch (e: any) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          toast.error("Erro ao selecionar todos: " + (e?.message || ""));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          // Fallback: seleciona apenas a página atual
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          setSelectedIds(new Set([...selectedIds, ...dados.map(d => d.id)]));
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        } finally {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          setSelectAllLoading(false);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        setSelectedIds(new Set());
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </TableHead>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                {([
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  { key: "data_distribuicao_planilha" as const, label: "Data Plan." },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  { key: "data_distribuicao_real" as const, label: "Data Real" },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  { key: "processo_numero" as const, label: "Processo" },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  { key: "dossie" as const, label: "Dossiê" },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  { key: "responsaveis" as const, label: "Responsáveis" },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  { key: "benner_atualizado" as const, label: "Benner" },
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                ]).map((h) => (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <TableHead key={h.key}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      type="button"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      onClick={() => handleSort(h.key)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      {h.label}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      {sortBy === h.key ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      ) : (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        <ArrowUpDown className="w-3 h-3 opacity-40" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    </button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </TableHead>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                ))}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                {mostrarPendencias && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <TableHead className="min-w-[260px]">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <span className="inline-flex items-center gap-1 text-red-700">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      Pendências
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    </span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </TableHead>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                {isAdminOrCoordinator && <TableHead className="w-28">Ações</TableHead>}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </TableRow>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </TableHeader>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <TableBody>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {loading ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <TableRow><TableCell colSpan={(isAdminOrCoordinator ? 9 : 8) + (mostrarPendencias ? 1 : 0)} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              ) : dados.length === 0 ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <TableRow><TableCell colSpan={(isAdminOrCoordinator ? 9 : 8) + (mostrarPendencias ? 1 : 0)} className="text-center py-8 text-muted-foreground">Nenhuma distribuição encontrada</TableCell></TableRow>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              ) : dadosOrdenados.map(d => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const isPresidencia = (d.turma || "").toLowerCase().includes("presid");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const relatorClass = isPresidencia
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  ? ""
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  : d.relator_favorabilidade?.toLowerCase().includes("positiv")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    ? "text-emerald-600 dark:text-emerald-400 font-semibold"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    : d.relator_favorabilidade?.toLowerCase().includes("negativ")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      ? "text-destructive font-semibold"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      : "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const turmaClass = isPresidencia
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  ? ""
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  : d.turma_favorabilidade?.toLowerCase().includes("positiv")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    ? "text-emerald-600 dark:text-emerald-400 font-semibold"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    : d.turma_favorabilidade?.toLowerCase().includes("negativ")
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      ? "text-destructive font-semibold"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      : "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const responsaveis = responsaveisMap.get(d.id) || [];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const isPronto = ((d as any).status || "") === "pronto_envio";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const hasProvasDigitais = String((d as any).provas_digitais || "").trim().toLowerCase() === "s";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const isSubidaMassa = !!(d as any).subida_em_massa || /subida\s+em\s+massa/i.test(d.relator || "");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const isOutroEscritorio = (d as any).processo_outro_escritorio === true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const isSegredo = (d as any).segredo_justica === true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const isProblemaJudit = (d as any).problema_judit === true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const isRecursoTerceiro = (d as any).recurso_terceiro === true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const isCejusc = (d as any).cejusc === true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                const relatorDisplay = (d.relator || "").replace(/subida\s+em\s+massa.*$/i, "").trim().replace(/[-–—:]\s*$/, "").trim();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <TableRow
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  key={d.id}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  className={cn(
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    "cursor-pointer hover:bg-muted/50 align-middle",
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    (d as any).em_analise && "bg-amber-50/60 dark:bg-amber-950/20 border-l-2 border-l-amber-500"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  onClick={() => { scrollPageToTop(); setDetailInitialTab("distribuicao"); setEditando(d); }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <TableCell className="align-middle" onClick={e => e.stopPropagation()}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <div className="flex items-center gap-1.5">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <Checkbox
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        checked={selectedIds.has(d.id)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        onCheckedChange={(checked) => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          const newSet = new Set(selectedIds);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          if (checked) newSet.add(d.id);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          else newSet.delete(d.id);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          setSelectedIds(newSet);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      {(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        const status = String((d as any).status || "");
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        const emAnalise = !!(d as any).em_analise;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        const naoPrecisaFazer =
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          (d as any).transito_julgado === true ||
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          (d as any).processo_outro_escritorio === true ||
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          (d as any).segredo_justica === true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        let color = "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        let label = "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        if (status === "pronto_envio") {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          color = "bg-emerald-500";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          label = "Pronto para enviar";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        } else if (emAnalise) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          color = "bg-amber-400";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          label = "Em análise";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        } else if (naoPrecisaFazer) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          color = "bg-slate-400";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          label = "Não precisa fazer";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        } else {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          color = "bg-red-500";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          label = "A fazer";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <TooltipProvider delayDuration={100}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Tooltip>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              <TooltipTrigger asChild>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <span
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  className={cn("inline-block w-2.5 h-2.5 rounded-full ring-1 ring-black/10", color)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  aria-label={label}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              </TooltipTrigger>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              <TooltipContent side="right" className="text-xs">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                {label}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              </TooltipContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Tooltip>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          </TooltipProvider>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      })()}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </TableCell>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <TableCell className="text-xs whitespace-nowrap align-middle">{formatDate(d.data_distribuicao_planilha || d.data_distribuicao_real)}</TableCell>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <TableCell className="text-xs whitespace-nowrap align-middle">{formatDate(d.data_distribuicao_real)}</TableCell>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <TableCell className="text-xs align-middle">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    {(() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const raw = d.processo_numero || "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const cnjMatch = raw.match(/^(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})(.*)$/);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const situacao = (d.situacao_processo || "").toLowerCase();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                       const isTransito = (d as any).transito_julgado === true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const isAtivo = situacao.trim() === "ativo";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      const situacaoClass = "";
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      if (cnjMatch) {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        const numero = cnjMatch[1];
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        const resto = cnjMatch[2].trim();
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <div className="space-y-0.5">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <div className={cn("whitespace-nowrap inline-flex items-center gap-1", situacaoClass)}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              <span>{numero}</span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              <CopyButton value={numero} label="Processo" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {(d as any).em_analise && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500 text-amber-700 dark:text-amber-400">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Em análise
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {(d as any).ic_duplicado && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4" title="Processo duplicado (mais de uma linha com o mesmo número)">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Dup.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {(d as any).ic_arquivado && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-slate-500 text-slate-600 dark:text-slate-300" title="Registro arquivado">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Arquivado
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {isPronto && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge className="text-[10px] px-1 py-0 h-4 bg-emerald-600 hover:bg-emerald-600 text-white" title="Pronto para enviar">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Pronto
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {hasProvasDigitais && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge className="text-[10px] px-1 py-0 h-4 bg-blue-600 hover:bg-blue-600 text-white" title="Possui provas digitais">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Provas Digitais
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {isTransito && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge className="text-[10px] px-1 py-0 h-4 bg-orange-500 hover:bg-orange-500 text-white" title="Trânsito em Julgado">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Trans. Julgado
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {isSubidaMassa && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge className="text-[10px] px-1 py-0 h-4 bg-purple-600 hover:bg-purple-600 text-white" title="Relator marcado como Subida em Massa">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Subida em Massa
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {isOutroEscritorio && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge className="text-[10px] px-1 py-0 h-4 bg-violet-600 hover:bg-violet-600 text-white" title="Processo de outro escritório">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Outro escritório
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {isSegredo && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge className="text-[10px] px-1 py-0 h-4 bg-rose-600 hover:bg-rose-600 text-white" title="Segredo de Justiça">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Segredo de Justiça
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {isProblemaJudit && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-500 hover:bg-amber-500 text-white" title="Problema Judit">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Problema Judit
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {isRecursoTerceiro && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge className="text-[10px] px-1 py-0 h-4 bg-indigo-600 hover:bg-indigo-600 text-white" title="Recurso de terceiro">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  Recurso de terceiro
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {isCejusc && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <Badge className="text-[10px] px-1 py-0 h-4 bg-teal-600 hover:bg-teal-600 text-white" title="CEJUSC">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  CEJUSC
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            {isAdminOrCoordinator && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              <div className="mt-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                <ProcessoTagPicker
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  dadoId={d.id}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  tagIds={tagsMap?.get(d.id) || []}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                  compact
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            {resto && <div className="text-xs text-muted-foreground italic">{resto}</div>}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      }
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        <div className="space-y-0.5">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        <div className={cn("break-words inline-flex items-center gap-1", situacaoClass)}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <span>{raw}</span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {raw && <CopyButton value={raw} label="Processo" />}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {(d as any).em_analise && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500 text-amber-700 dark:text-amber-400">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Em análise
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {(d as any).ic_duplicado && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4" title="Processo duplicado (mais de uma linha com o mesmo número)">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Dup.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {(d as any).ic_arquivado && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-slate-500 text-slate-600 dark:text-slate-300" title="Registro arquivado">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Arquivado
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {isPronto && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge className="text-[10px] px-1 py-0 h-4 bg-emerald-600 hover:bg-emerald-600 text-white" title="Pronto para enviar">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Pronto
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {hasProvasDigitais && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge className="text-[10px] px-1 py-0 h-4 bg-blue-600 hover:bg-blue-600 text-white" title="Possui provas digitais">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Provas Digitais
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {isTransito && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge className="text-[10px] px-1 py-0 h-4 bg-orange-500 hover:bg-orange-500 text-white" title="Trânsito em Julgado">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Trans. Julgado
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {isSubidaMassa && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge className="text-[10px] px-1 py-0 h-4 bg-purple-600 hover:bg-purple-600 text-white" title="Relator marcado como Subida em Massa">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Subida em Massa
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {isOutroEscritorio && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge className="text-[10px] px-1 py-0 h-4 bg-violet-600 hover:bg-violet-600 text-white" title="Processo de outro escritório">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Outro escritório
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {isSegredo && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge className="text-[10px] px-1 py-0 h-4 bg-rose-600 hover:bg-rose-600 text-white" title="Segredo de Justiça">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Segredo de Justiça
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {isProblemaJudit && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-500 hover:bg-amber-500 text-white" title="Problema Judit">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Problema Judit
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {isRecursoTerceiro && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge className="text-[10px] px-1 py-0 h-4 bg-indigo-600 hover:bg-indigo-600 text-white" title="Recurso de terceiro">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              Recurso de terceiro
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {isCejusc && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge className="text-[10px] px-1 py-0 h-4 bg-teal-600 hover:bg-teal-600 text-white" title="CEJUSC">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              CEJUSC
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        {isAdminOrCoordinator && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <div className="mt-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <ProcessoTagPicker
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              dadoId={d.id}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              tagIds={tagsMap?.get(d.id) || []}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              compact
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    })()}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </TableCell>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <TableCell className="text-xs whitespace-nowrap align-middle" onClick={e => e.stopPropagation()}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    {d.dossie ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <span className="inline-flex items-center gap-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        <button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          type="button"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          className="text-primary hover:underline disabled:opacity-50"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          onClick={() => handleOpenBenner(d)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          disabled={loadingBenner === d.id}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          title="Abrir Dados Benner"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          {d.dossie}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        </button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        <CopyButton value={d.dossie} label="Dossiê" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      </span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    ) : (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        type="button"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        className="text-orange-500 hover:underline italic disabled:opacity-50"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        onClick={() => handleOpenBenner(d)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        disabled={loadingBenner === d.id}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        title="Abrir Dados Benner"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        Não localizado
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      </button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </TableCell>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <TableCell className="text-xs align-middle">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    {responsaveis.length > 0 ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <div className="flex flex-wrap gap-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        {responsaveis.map(r => (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <Badge key={r.id} variant="secondary" className="text-xs px-1.5 py-0 font-normal">{r.nome}</Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        ))}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    ) : "—"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </TableCell>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <TableCell className="align-middle">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    {d.benner_atualizado ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    ) : (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <XCircle className="w-4 h-4 text-muted-foreground/40" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </TableCell>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  {mostrarPendencias && (() => {
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    const pend = getPendencias(d);
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    const naoPrecisaFazer =
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      (d as any).processo_outro_escritorio === true ||
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      (d as any).segredo_justica === true;
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    return (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <TableCell className="align-middle min-w-[260px]" onClick={e => e.stopPropagation()}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        {naoPrecisaFazer ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-[10px]">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            Não precisa fazer
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        ) : pend.length === 0 ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-[10px]">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            Sem pendências
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        ) : (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <div className="flex flex-wrap gap-1 max-w-[420px]" title={pendenciasResumo(d)}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              {pend.length} pendência{pend.length > 1 ? "s" : ""}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            {pend.slice(0, 6).map((p) => (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              <Badge
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                key={p.key}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                className="text-[10px] px-1.5 py-0 border-red-300 text-red-700"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                {p.label}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            ))}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            {pend.length > 6 && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-700">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                                +{pend.length - 6}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                              </Badge>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                            )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      </TableCell>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  })()}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  {isAdminOrCoordinator && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    <TableCell onClick={e => e.stopPropagation()}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      <div className="flex gap-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          variant="ghost"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          size="icon"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          onClick={() => handleToggleSubidaMassaRow(d.id, !isSubidaMassa, d.processo_numero)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          title={isSubidaMassa ? "Desmarcar Subida em Massa" : "Marcar Subida em Massa"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <Layers className={`w-4 h-4 ${isSubidaMassa ? "text-purple-600" : "text-muted-foreground/60"}`} />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)} title="Arquivar (não exclui)">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                          <Trash2 className="w-4 h-4 text-amber-600" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                        </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                      </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    </TableCell>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                </TableRow>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              })}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </TableBody>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </Table>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {/* Pagination */}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        {totalPages > 1 && (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <div className="flex items-center justify-between pt-2">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <p className="text-xs text-muted-foreground">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              Página {page} de {totalPages} · {totalCount} registros
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </p>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <div className="flex items-center gap-1">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                className="h-8"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                disabled={page <= 1}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                onClick={() => setPage(page - 1)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <ChevronLeft className="w-4 h-4" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {getVisiblePages().map((p, i) =>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                p < 0 ? (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <span key={`e${i}`} className="px-1 text-muted-foreground text-xs">…</span>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                ) : (
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    key={p}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    variant={p === page ? "default" : "outline"}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    className="h-8 w-8 p-0 text-xs"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    onClick={() => setPage(p)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                    {p}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                  </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                )
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              <Button
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                variant="outline"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                size="sm"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                className="h-8"
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                disabled={page >= totalPages}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                onClick={() => setPage(page + 1)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              >
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,                <ChevronRight className="w-4 h-4" />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              </Button>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        )}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      </div>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      <DelegarProcessosDialog
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        open={delegarOpen}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        onOpenChange={setDelegarOpen}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        selectedIds={Array.from(selectedIds)}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        onSuccess={async () => { setSelectedIds(new Set()); await Promise.resolve(handleRefresh()); }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      <DistribuirAutomaticoDialog
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        open={autoDistOpen}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        onOpenChange={setAutoDistOpen}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        filters={debouncedFilters}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        totalCount={totalCount}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        onSuccess={async () => { setSelectedIds(new Set()); await Promise.resolve(handleRefresh()); }}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      />
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => { if (!o) setDeleteTargetId(null); }}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        <AlertDialogContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <AlertDialogHeader>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <AlertDialogTitle>Arquivar distribuição?</AlertDialogTitle>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <AlertDialogDescription>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              O registro será movido para a área de arquivados e deixará de aparecer aqui.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              Apenas administradores poderão consultar ou restaurar registros arquivados.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </AlertDialogDescription>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </AlertDialogHeader>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <AlertDialogFooter>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <AlertDialogCancel>Cancelar</AlertDialogCancel>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <AlertDialogAction onClick={confirmDelete} className="bg-amber-600 text-white hover:bg-amber-700">
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              Arquivar
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </AlertDialogAction>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </AlertDialogFooter>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        </AlertDialogContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      </AlertDialog>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      <AlertDialog open={arquivarDupOpen} onOpenChange={(o) => { if (!arquivarDupRunning) setArquivarDupOpen(o); }}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        <AlertDialogContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <AlertDialogHeader>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <AlertDialogTitle>Arquivar duplicados respeitando os filtros?</AlertDialogTitle>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <AlertDialogDescription>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              Para cada grupo de processos duplicados, será mantido o registro com mais tags
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              (empate: mais campos preenchidos). Se outro registro do mesmo grupo tiver data de
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              alteração mais recente, esse será mantido no lugar. Os demais são movidos para a
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              área de arquivados — nada é apagado.
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </AlertDialogDescription>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </AlertDialogHeader>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          <AlertDialogFooter>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <AlertDialogCancel disabled={arquivarDupRunning}>Cancelar</AlertDialogCancel>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            <AlertDialogAction disabled={arquivarDupRunning} onClick={(e) => { e.preventDefault(); handleArquivarDuplicados(); }}>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              {arquivarDupRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,              Arquivar duplicados
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,            </AlertDialogAction>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,          </AlertDialogFooter>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,        </AlertDialogContent>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,      </AlertDialog>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,    </MainLayout>
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,  );
parte: filtroParte || undefined,
        parteRecorrente: filtroParteRecorrente || undefined,}
