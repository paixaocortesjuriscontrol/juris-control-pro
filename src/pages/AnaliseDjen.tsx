import { useState, useEffect, useMemo } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType, Tab, TabStopType, TabStopPosition, PageBreak, ExternalHyperlink } from "docx";
import {
  FileText,
  CalendarClock,
  Database,
  Filter,
  Eye,
  Sparkles,
  CheckCircle,
  Loader2,
  Search,
  Calendar,
  Building2,
  Gavel,
  FileSearch,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ChevronsUpDown,
  ListChecks,
  Download,
  FileDown,
  CheckCheck,
  FolderPlus,
  Save,
  Trash2,
  Copy,
  Maximize2,
  Minimize2,
  Layers,
  Zap,
  Plus,
  ClipboardList,
  CalendarPlus,
  Clock,
  Trash,
  Undo2,
  RotateCcw,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatProcessoNumero } from "@/lib/utils";
import { formatConteudoParaExibicao, conteudoDisplayClasses, formatDateOnly, formatDateOnlyFull, stripHtmlAndDecodeEntities, decodeHtmlEntities } from "@/utils/formatConteudo";
import { conteudoContemFraseExata } from "@/utils/djenTermoMatch";
import { MonitoramentoTermoBadge } from "@/components/djen/MonitoramentoTermoBadge";

import { usePublicacoesDjenUnificadas, PublicacaoUnificada, FiltroLeituraDjen } from "@/hooks/usePublicacoesDjenUnificadas";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { NovaTarefaPublicacaoDialog } from "@/components/djen/NovaTarefaPublicacaoDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { PrazoDialog } from "@/components/prazos/PrazoDialog";
import { PublicacaoSidePanel } from "@/components/shared/PublicacaoSidePanel";
import { ItensCriadosPublicacaoCard, type ItemCriado } from "@/components/shared/ItensCriadosPublicacaoCard";
import { EtiquetaPicker } from "@/components/etiquetas/EtiquetaPicker";
import { EdicaoItemPublicacaoInline } from "@/components/shared/EdicaoItemPublicacaoInline";
import { useItensExistentesPublicacao } from "@/hooks/useItensExistentesPublicacao";
import { ensureProcessoFromPublicacao, salvarPublicacaoNoProcesso } from "@/lib/ensureProcessoFromPublicacao";
import { NovaAudienciaPublicacaoDialog } from "@/components/djen/NovaAudienciaPublicacaoDialog";
import { CadastroAudienciaForm } from "@/components/audiencias/CadastroAudienciaForm";
import { DjenExecutionBanner } from "@/components/djen/DjenExecutionBanner";
import { PublicacaoConteudoDjen, getPartesEAdvogadosParaExibicao } from "@/components/djen/PublicacaoConteudoDjen";
import { ComentariosPublicacaoDjen } from "@/components/djen/ComentariosPublicacaoDjen";
import { ExecucoesDoDiaLocalCard } from "@/components/djen/ExecucoesDoDiaLocalCard";
import { ExecucoesDoDiaAdminCard } from "@/components/djen/ExecucoesDoDiaAdminCard";
import { jsPDF } from "jspdf";
import { dedupePublicacoesDjen, stripDestinatarios } from "@/utils/djenDedup";
import { PreagendarIaDialog } from "@/components/analise-djen/PreagendarIaDialog";

type TipoOrigemPublicacao = 'termo' | 'processo' | 'descartada' | 'datajud';
type TipoFiltroOrigem = 'todos' | 'normal' | 'termo' | 'parte' | 'processo' | 'descartada' | 'datajud' | 'djet-pautas' | 'kurier' | 'stf';
type FiltroDiaDjen = 'hoje' | 'todos';

// Encurta nomes de turma/órgão como "5ª Turma do Tribunal Superior do Trabalho" → "5ª Turma".
// Mantém o valor original quando não casar com o padrão "Nª Turma" / "N Turma".
const shortenTurma = (value: string | null | undefined): string => {
  if (!value) return "";
  const m = value.match(/^\s*(\d+)\s*[ºªoa]?\s*Turma\b/i);
  return m ? `${m[1]}ª Turma` : value;
};

const dateLocalToUTCRange = (dateStr: string, isEnd: boolean): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isEnd) {
    const nextDay = addDays(new Date(year, month - 1, day), 1);
    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T02:59:59.999Z`;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T03:00:00Z`;
};

const getHojeBrtISO = (): string => {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const AnaliseDjen = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routerLocation = useLocation();
  const [importingProcessoId, setImportingProcessoId] = useState<string | null>(null);
  // Mapa local: publicação recém-importada -> processo criado. Serve para trocar
  // o botão "Importar" por "Salvar" e mostrar "Ver processo" sem recarregar a lista.
  const [importedProcessos, setImportedProcessos] = useState<Record<string, string>>({});
  const [savingProcessoId, setSavingProcessoId] = useState<string | null>(null);

  // Buscar as coordenações do usuário logado (IDs e primeira para pré-seleção)
  const { data: userCoordenacaoData, isLoading: loadingUserCoord } = useQuery({
    queryKey: ['user-coordenacoes-ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return { ids: [] as string[], first: "" };
      const { data, error } = await supabase
        .from('membros_coordenacao')
        .select('coordenacao_id')
        .eq('usuario_id', user.id);

      if (error) throw error;

      const ids = (data || []).map((r: any) => r.coordenacao_id).filter(Boolean) as string[];
      return { ids, first: ids[0] || "" };
    },
    enabled: !!user?.id,
  });

  const userCoordenacaoIds = userCoordenacaoData?.ids ?? [];
  const userCoordenacao = userCoordenacaoData?.first ?? null;

  // Filtros - inicializar com coordenação do usuário
  const [coordenacaoId, setCoordenacaoId] = useState<string | null>(null); // null = ainda não inicializado
  const [preagendarIaOpen, setPreagendarIaOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [dataDisponibilizacao, setDataDisponibilizacao] = useState<string>("");
  const [dataPublicacao, setDataPublicacao] = useState<string>("");
  const [termoBusca, setTermoBusca] = useState<string>("");
  const [monitoramentoId, setMonitoramentoId] = useState<string>("");
  const [tribunalFiltro, setTribunalFiltro] = useState<string>("");
  const [filtroDia, setFiltroDia] = useState<FiltroDiaDjen>('hoje');
  const [readStatus, setReadStatus] = useState<FiltroLeituraDjen>('nao_lidas');
  const [tipoOrigem, setTipoOrigem] = useState<TipoFiltroOrigem>('todos');
  // Execução do dia selecionada no card "Execuções do dia" (DJEN Local).
  // Quando setada, filtra a listagem por novasIds (as publicações vistas pela 1ª vez nesta execução).
  const [execucaoFocada, setExecucaoFocada] = useState<import("@/hooks/useExecucoesDoDiaLocal").ExecucaoLocalDoDia | null>(null);
  // Publicações tratadas nesta sessão (marcadas como lidas ao salvar um item).
  // Mantidas na lista para que a publicação não "suma" logo após o advogado
  // criar um prazo/tarefa/audiência a partir dela.
  const [pubsTratadasSessao, setPubsTratadasSessao] = useState<Record<string, any>>({});
  // Toggle para ocultar visualmente publicações duplicadas (mesmo processo +
  // mesmo conteúdo dentro da mesma coordenação). Não altera o banco; apenas
  // filtra a lista renderizada. Preferência persistida em localStorage.
  // Default false: mostra todas por padrão; o advogado clica para ocultar.
  const [ocultarDuplicadas, setOcultarDuplicadas] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('analise-djen:ocultar-duplicadas-v2');
    return stored === null ? false : stored === '1';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('analise-djen:ocultar-duplicadas-v2', ocultarDuplicadas ? '1' : '0');
  }, [ocultarDuplicadas]);
  // Paginação client-side somente para a aba Descartadas (auditoria),
  // que pode trazer milhares de linhas com HTML completo e travar o render.
  const PAGE_SIZE_DESCARTADAS = 500;
  const [descartadasPage, setDescartadasPage] = useState(1);
  const apenasHoje = filtroDia === 'hoje';
  const apenasNaoLidas = readStatus === 'nao_lidas';
  // Carrega a primeira página rapidamente. Não buscar milhares de publicações
  // completas antes de renderizar — os totalizadores contam, a lista pagina.
  const INITIAL_LIST_LIMIT = 500;
  const LOAD_MORE_INCREMENT = 500;
  const [listLimit, setListLimit] = useState(INITIAL_LIST_LIMIT);

  // Paginação apenas de APRESENTAÇÃO (client-side): renderizar 12k+ cards
  // trava a tela. O backend continua trazendo tudo (para totalizadores e
  // exportações), mas a lista mostra `displayLimit` registros por vez,
  // crescendo de 1000 em 1000 via botão "Carregar mais 1000".
  const DISPLAY_PAGE_SIZE = 1000;
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_PAGE_SIZE);

  // Debounce inputs digitáveis para evitar disparar 3+ queries pesadas
  // a cada tecla (termo de busca + data digitada manualmente).
  const termoBuscaDebounced = useDebouncedValue(termoBusca, 350);
  const dataInicioDebounced = useDebouncedValue(dataInicio, 250);
  const dataFimDebounced = useDebouncedValue(dataFim, 250);
  const dataDisponibilizacaoDebounced = useDebouncedValue(dataDisponibilizacao, 250);
  const dataPublicacaoDebounced = useDebouncedValue(dataPublicacao, 250);
  const filtroDataDisponibilizacaoAtivo = !!dataDisponibilizacaoDebounced;
  const filtroDataPublicacaoAtivo = !!dataPublicacaoDebounced;
  const filtroQualquerDataAtivo = !!dataInicioDebounced || !!dataFimDebounced || filtroDataDisponibilizacaoAtivo || filtroDataPublicacaoAtivo;
  const apenasHojeEfetivo = apenasHoje && !filtroDataDisponibilizacaoAtivo && !filtroDataPublicacaoAtivo;

  // Quando carregar a coordenação do usuário, definir como padrão
  useEffect(() => {
    if (!loadingUserCoord && coordenacaoId === null) {
      setCoordenacaoId(userCoordenacao || "");
    }
  }, [userCoordenacao, loadingUserCoord, coordenacaoId]);

  // Limpar termo ao trocar coordenação
  useEffect(() => {
    setMonitoramentoId("");
    setTribunalFiltro("");
  }, [coordenacaoId]);
  
  // States
  const [selectedIds, setSelectedIds] = useState<Map<string, TipoOrigemPublicacao>>(
    new Map<string, TipoOrigemPublicacao>()
  );
  const [viewDialogOpen, setViewDialogOpen] = useState(false); // kept for potential future use
  const [criarTarefaDialogOpen, setCriarTarefaDialogOpen] = useState(false);
  const [novoEventoOpen, setNovoEventoOpen] = useState(false);
  const [novoPrazoOpen, setNovoPrazoOpen] = useState(false);
  const [novaAudienciaOpen, setNovaAudienciaOpen] = useState(false);
  const [adicionarProcessoId, setAdicionarProcessoId] = useState<string | undefined>(undefined);
  const [adicionarProcessoNumero, setAdicionarProcessoNumero] = useState<string | undefined>(undefined);
  // Itens (prazo/evento/tarefa/audiência) criados nesta sessão a partir da
  // publicação atualmente selecionada. Alimenta o card verde "Itens criados
  // a partir desta publicação" exibido acima do split view.
  const [itensCriadosSessao, setItensCriadosSessao] = useState<ItemCriado[]>([]);
  // Item do card verde aberto para edição inline.
  const [itemEmEdicao, setItemEmEdicao] = useState<{ tipo: ItemCriado["tipo"]; id: string } | null>(null);

  // ---------------------------------------------------------------------------
  // Pilha de ações da sessão para o botão "Desfazer último".
  // Cobre marcação de leitura, descarte em lote e criação de item a partir da
  // publicação. A pilha é apenas em memória (vale para a sessão da tela).
  // ---------------------------------------------------------------------------
  type AcaoSessao =
    | { tipo: "leitura"; label: string; alvos: { id: string; tabela: string }[] }
    | { tipo: "descarte"; label: string; ids: string[] }
    | { tipo: "item"; label: string; itemTipo: ItemCriado["tipo"]; id: string };
  const [acoesSessao, setAcoesSessao] = useState<(AcaoSessao & { at: number })[]>([]);
  const [desfazendoAcao, setDesfazendoAcao] = useState(false);
  const registrarAcaoSessao = (a: AcaoSessao) =>
    setAcoesSessao((prev) => [...prev, { ...a, at: Date.now() }]);

  // Resolve o processo existente na base via número da publicação para pré-preencher os formulários
  const resolverProcessoDaPublicacao = async (pub: PublicacaoUnificada) => {
    setAdicionarProcessoId(undefined);
    setAdicionarProcessoNumero(pub.processo_numero ?? undefined);
    if (!user?.id) return;
    try {
      const resolved = await ensureProcessoFromPublicacao(pub, user.id, userCoordenacao);
      if (resolved) {
        setAdicionarProcessoId(resolved.id);
        setAdicionarProcessoNumero(resolved.numero);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["processos"] }),
          queryClient.invalidateQueries({ queryKey: ["processos-paginados"] }),
          queryClient.invalidateQueries({ queryKey: ["publicacoes-djen-processo"] }),
          queryClient.invalidateQueries({ queryKey: ["pastas"] }),
        ]);
      }
    } catch (err) {
      console.warn("Falha ao resolver/criar processo a partir da publicação", err);
    }
  };
  const [selectedPublicacao, setSelectedPublicacao] = useState<PublicacaoUnificada | null>(null);
  const [expandedCoordenacoes, setExpandedCoordenacoes] = useState<Set<string>>(new Set(['all']));
  const [expandedPublicacoes, setExpandedPublicacoes] = useState<Set<string>>(new Set());
  const [expandirGeralAtivo, setExpandirGeralAtivo] = useState(false);
  const [gerandoDocsTST, setGerandoDocsTST] = useState(false);

  // ===== Foco vindo da tela "Errata DJEN" =====
  // Quando o usuário clica em "Gerar resumos das exclusivas" na Errata DJEN,
  // armazenamos { coordenacaoId, ids, rotulo } em sessionStorage e navegamos
  // para cá. Aqui aplicamos um whitelist client-side sobre `mergedPublicacoes`.
  const [focusFromErrata, setFocusFromErrata] = useState<{ ids: Set<string>; rotulo: string } | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("errata-djen:focus");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { coordenacaoId?: string; ids?: string[]; rotulo?: string };
      sessionStorage.removeItem("errata-djen:focus");
      if (parsed?.coordenacaoId) {
        setCoordenacaoId(parsed.coordenacaoId);
      }
      if (Array.isArray(parsed?.ids) && parsed.ids.length > 0) {
        setFocusFromErrata({ ids: new Set(parsed.ids), rotulo: parsed.rotulo || "Errata DJEN" });
        // Abre janela ampla para que o whitelist case mesmo com publicações antigas.
        setFiltroDia('todos');
        setReadStatus('todas');
        setTipoOrigem('todos');
      }
    } catch (e) {
      console.warn("Falha ao ler focus da Errata DJEN:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Foco vindo da Busca Global (?processo=...&pubId=...) =====
  // Abre a Análise DJEN já filtrada pelo número do processo da publicação
  // clicada, com janela ampla (todos os dias / lidas e não lidas).
  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search);
    const processoParam = params.get("processo");
    const pubIdParam = params.get("pubId");
    if (!processoParam && !pubIdParam) return;
    if (processoParam) setTermoBusca(processoParam);
    setFiltroDia("todos");
    setReadStatus("todas");
    setTipoOrigem("todos");
    setCoordenacaoId("");
    if (pubIdParam) {
      setExpandedPublicacoes(new Set([pubIdParam]));
    }
  }, [routerLocation.search]);

  useEffect(() => {
    setListLimit(INITIAL_LIST_LIMIT);
    setDisplayLimit(DISPLAY_PAGE_SIZE);
    setSelectedIds(new Map<string, TipoOrigemPublicacao>());
    setExpandedPublicacoes(new Set());
    setExpandirGeralAtivo(false);
  }, [coordenacaoId, filtroDia, readStatus, tipoOrigem, monitoramentoId, tribunalFiltro, termoBuscaDebounced, dataInicioDebounced, dataFimDebounced, dataDisponibilizacaoDebounced]);

  // Determinar o filtro efetivo de coordenação
  const coordenacaoFiltroEfetivo = coordenacaoId === null 
    ? undefined
    : coordenacaoId === "" 
      ? undefined
      : coordenacaoId;

  // Estado do descarte em lote de duplicadas (botão vermelho)
  const [descartandoDuplicadas, setDescartandoDuplicadas] = useState(false);
  const [desfazendoLote, setDesfazendoLote] = useState<string | null>(null);
  // Intervalo opcional para o botão "Descartar duplicadas".
  // Se vazio, o descarte segue os filtros de data visíveis na tela antes de cair para hoje.
  const [descarteDataInicio, setDescarteDataInicio] = useState<string>("");
  const [descarteDataFim, setDescarteDataFim] = useState<string>("");

  const desfazerDescarteLote = async (loteId: string) => {
    if (!loteId) return;
    try {
      setDesfazendoLote(loteId);
      const { data, error } = await (supabase as any).rpc('desfazer_descarte_lote', {
        p_lote_id: loteId,
      });
      if (error) throw error;
      const total = (data?.total ?? 0) as number;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] }),
        queryClient.invalidateQueries({ queryKey: ['descartadas-dedup'] }),
        queryClient.invalidateQueries({ queryKey: ['descartadas-count'] }),
        queryClient.invalidateQueries({ queryKey: ['descartadas-lotes-recentes'] }),
      ]);
      toast.success(`Descarte desfeito: ${total} publicação(ões) restaurada(s)`);
    } catch (e: any) {
      toast.error(`Erro ao desfazer: ${e?.message || e}`);
    } finally {
      setDesfazendoLote(null);
    }
  };

  const { data: lotesRecentes = [] } = useQuery({
    queryKey: ['descartadas-lotes-recentes', coordenacaoFiltroEfetivo],
    queryFn: async () => {
      if (!coordenacaoFiltroEfetivo) return [] as Array<{ lote_id: string; total: number; nome: string; created_at: string }>;
      const { data, error } = await (supabase as any)
        .from('publicacoes_djen_descartadas')
        .select('lote_descarte_id, descartado_por_nome, created_at')
        .eq('coordenacao_id', coordenacaoFiltroEfetivo)
        .eq('motivo_descarte', 'duplicada_lote')
        .not('lote_descarte_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) { console.warn('Erro lotes recentes:', error); return []; }
      const map = new Map<string, { lote_id: string; total: number; nome: string; created_at: string }>();
      for (const r of (data || [])) {
        const id = r.lote_descarte_id as string;
        const prev = map.get(id);
        if (prev) { prev.total += 1; }
        else map.set(id, { lote_id: id, total: 1, nome: r.descartado_por_nome || 'Usuário', created_at: r.created_at });
      }
      return Array.from(map.values())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5);
    },
    enabled: !!coordenacaoFiltroEfetivo,
    staleTime: 15_000,
  });

  const descartarDuplicadasCoordenacao = async () => {
    const coordId = coordenacaoFiltroEfetivo;
    if (!coordId) {
      toast.error('Selecione uma coordenação específica antes de descartar duplicadas.');
      return;
    }
    if (!isAdmin && !userCoordenacaoIds.includes(coordId)) {
      toast.error('Você só pode descartar duplicadas das coordenações às quais pertence.');
      return;
    }
    // Define o intervalo efetivo: campo próprio > filtros da tela > hoje.
    const hojeISO = getHojeBrtISO();
    const dataTela = dataDisponibilizacaoDebounced || dataPublicacaoDebounced;
    const inicioEfetivo = descarteDataInicio || descarteDataFim || dataTela || dataInicioDebounced || dataFimDebounced || hojeISO;
    const fimEfetivo = descarteDataFim || descarteDataInicio || dataTela || dataFimDebounced || dataInicioDebounced || hojeISO;
    const origemIntervalo = (descarteDataInicio || descarteDataFim)
      ? 'intervalo informado no bloco de descarte'
      : dataDisponibilizacaoDebounced
        ? 'filtro Data de Disponibilização da tela'
        : dataPublicacaoDebounced
          ? 'filtro Data de Publicação da tela'
          : (dataInicioDebounced || dataFimDebounced)
            ? 'filtro Data Início/Fim (captura) da tela'
            : 'dia de hoje';
    const labelIntervalo = inicioEfetivo === fimEfetivo
      ? format(parseISO(inicioEfetivo), 'dd/MM/yyyy')
      : `${format(parseISO(inicioEfetivo), 'dd/MM/yyyy')} a ${format(parseISO(fimEfetivo), 'dd/MM/yyyy')}`;
    const confirma = window.confirm(
      `Descartar publicações duplicadas (mesmo processo + dia + conteúdo) desta coordenação no intervalo ${labelIntervalo}?\n\n` +
      `Origem do intervalo: ${origemIntervalo}.\n\n` +
      'A publicação mais antiga de cada grupo é mantida. Você poderá DESFAZER pelo botão "Desfazer último descarte".'
    );
    if (!confirma) return;
    try {
      setDescartandoDuplicadas(true);
      const { data, error } = await (supabase as any).rpc('descartar_duplicadas_coordenacao', {
        p_coordenacao_id: coordId,
        p_data_disp_inicio: inicioEfetivo,
        p_data_disp_fim: fimEfetivo,
      });
      if (error) throw error;
      const total = (data?.total ?? 0) as number;
      const loteId = data?.lote_id as string | undefined;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] }),
        queryClient.invalidateQueries({ queryKey: ['descartadas-dedup'] }),
        queryClient.invalidateQueries({ queryKey: ['descartadas-count'] }),
        queryClient.invalidateQueries({ queryKey: ['descartadas-lotes-recentes'] }),
      ]);
      if (total === 0) {
        toast.info('Nenhuma duplicada encontrada nesta coordenação.');
      } else {
        toast.success(`${total} duplicada(s) descartada(s) por ${data?.descartado_por_nome || 'você'}`, {
          duration: 15000,
          action: loteId ? { label: 'Desfazer', onClick: () => desfazerDescarteLote(loteId) } : undefined,
        });
      }
    } catch (e: any) {
      toast.error(`Erro ao descartar duplicadas: ${e?.message || e}`);
    } finally {
      setDescartandoDuplicadas(false);
    }
  };
  
  const { data: coordenacoes } = useCoordenacoes();

  // Filtrar coordenações para o combo: admin vê todas, usuário comum só as suas
  const coordenacoesDoCombo = useMemo(() => {
    if (!coordenacoes) return [];
    if (isAdmin) return coordenacoes;
    if (userCoordenacaoIds.length === 0) return coordenacoes; // sem vínculo: mostra todas
    return coordenacoes.filter((c: any) => userCoordenacaoIds.includes(c.id));
  }, [coordenacoes, isAdmin, userCoordenacaoIds]);

  const { 
    publicacoes, 
    estatisticas, 
    isLoading: isLoadingPublicacoes, 
    isFetching: isFetchingPublicacoes,
    loadingStats,
    marcarComoLida,
    descartarManualmente,
    totalHoje,
    naoLidasHoje,
    totalDescartadasHoje,
    totalTermosHoje,
    totalProcessosHoje,
    totalUnicasHoje,
    naoLidasUnicasHoje,
  } = usePublicacoesDjenUnificadas({
    coordenacaoId: coordenacaoFiltroEfetivo,
    // Data Disponibilização filtra por data_disponibilizacao no banco; não pode virar filtro de created_at/captura.
    dataInicio: apenasHojeEfetivo ? undefined : (dataInicioDebounced || undefined),
    dataFim: apenasHojeEfetivo ? undefined : (dataFimDebounced || undefined),
    dataDisponibilizacao: dataDisponibilizacaoDebounced || undefined,
    termoBusca: termoBuscaDebounced || undefined,
    monitoramentoId: monitoramentoId || undefined,
    tribunal: tribunalFiltro || undefined,
    // Quando o usuário clica em "Mostrar somente únicas", aplica DISTINCT ON
    // por (coordenação, conteúdo) no servidor. Default false: traz tudo.
    dedupServidor: ocultarDuplicadas,
    apenasNaoLidas,
    readStatus,
    apenasHoje: apenasHojeEfetivo,
    // 'todos' e 'normal' passam undefined para buscar termos e processos.
    // Kurier é filtrado no banco para não depender das primeiras 500 publicações gerais.
    // 'stf' também passa undefined: filtramos client-side por tribunal=STF
    // sobre as publicações DJEN já carregadas.
    tipoOrigem: (tipoOrigem === 'todos' || tipoOrigem === 'normal' || tipoOrigem === 'datajud' || tipoOrigem === 'stf') ? undefined : tipoOrigem as any,
    // Descartadas SÓ aparecem quando o filtro "Tipo de origem" está em
    // "descartada" (aba dedicada com RPC própria). Em qualquer outra aba,
    // mesmo buscando por número de processo, não misturamos descartadas
    // com a listagem principal.
    incluirDescartadas: false,
    page: 1,
    // PERFORMANCE: lista paginada; totalizadores ficam separados dos cards.
    pageSize: listLimit,
    desabilitarLista: tipoOrigem === 'datajud' || tipoOrigem === 'descartada',
    desabilitarStats: tipoOrigem === 'datajud' || tipoOrigem === 'descartada' || tipoOrigem === 'djet-pautas',
  });

  // === Login Kurier por publicação ===
  // O `kurier_login` é gravado na tabela `publicacoes_djen` no momento da captura,
  // mas a RPC unificada (get_djen_publicacoes_unificadas) não devolve essa coluna.
  // Buscamos lateralmente apenas os IDs das publicações Kurier visíveis para exibir
  // o login responsável pela captura no badge "Captura:".
  const kurierIdsVisiveis = useMemo(() => {
    const ids = new Set<string>();
    for (const p of publicacoes) {
      if ((p.fonte || '').toLowerCase() === 'kurier') ids.add(p.id);
    }
    return Array.from(ids);
  }, [publicacoes]);

  const { data: kurierLoginsMap = {} } = useQuery({
    queryKey: ['kurier-logins-por-pub', kurierIdsVisiveis],
    enabled: kurierIdsVisiveis.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const out: Record<string, string> = {};
      // chunk para evitar URLs longos
      const chunkSize = 200;
      for (let i = 0; i < kurierIdsVisiveis.length; i += chunkSize) {
        const slice = kurierIdsVisiveis.slice(i, i + chunkSize);
        const { data } = await (supabase as any)
          .from('publicacoes_djen')
          .select('id, kurier_login')
          .in('id', slice);
        (data || []).forEach((r: any) => { if (r.kurier_login) out[r.id] = r.kurier_login; });
      }
      return out;
    },
  });

  // Contagem server-side de publicações Kurier respeitando os principais filtros.
  // Sem isso, o card "Kurier" ficava travado no total que existia dentro das primeiras
  // 500 publicações carregadas pela RPC unificada quando a aba atual não era "kurier".
  const { data: totalKurierServer = 0 } = useQuery({
    queryKey: [
      'analise-djen-kurier-count',
      coordenacaoFiltroEfetivo,
      apenasHojeEfetivo,
      dataInicioDebounced,
      dataFimDebounced,
      dataDisponibilizacaoDebounced,
      dataPublicacaoDebounced,
      tribunalFiltro,
      readStatus,
      termoBuscaDebounced,
      monitoramentoId,
    ],
    staleTime: 30_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from('publicacoes_djen')
        .select('id', { count: 'exact', head: true })
        .eq('fonte', 'kurier');
      if (coordenacaoFiltroEfetivo) q = q.eq('coordenacao_id', coordenacaoFiltroEfetivo);
      if (readStatus === 'nao_lidas') q = q.eq('lida', false);
      else if (readStatus === 'lidas') q = q.eq('lida', true);
      if (tribunalFiltro) q = q.eq('tribunal', tribunalFiltro);
      if (monitoramentoId) q = q.eq('monitoramento_id', monitoramentoId);
      if (termoBuscaDebounced) {
        const digits = termoBuscaDebounced.replace(/\D/g, '');
        if (digits.length >= 6) {
          q = q.or(`numero_processo.ilike.%${digits}%,conteudo.ilike.%${termoBuscaDebounced}%`);
        } else {
          q = q.ilike('conteudo', `%${termoBuscaDebounced}%`);
        }
      }
      if (apenasHojeEfetivo) {
        const hojeBrt = getHojeBrtISO();
        q = q.gte('created_at', dateLocalToUTCRange(hojeBrt, false))
             .lte('created_at', dateLocalToUTCRange(hojeBrt, true));
      } else {
        if (dataInicioDebounced) q = q.gte('created_at', dateLocalToUTCRange(dataInicioDebounced, false));
        if (dataFimDebounced) q = q.lte('created_at', dateLocalToUTCRange(dataFimDebounced, true));
      }
      if (dataDisponibilizacaoDebounced) {
        q = q.gte('data_disponibilizacao', dateLocalToUTCRange(dataDisponibilizacaoDebounced, false))
             .lte('data_disponibilizacao', dateLocalToUTCRange(dataDisponibilizacaoDebounced, true));
      }
      if (dataPublicacaoDebounced) {
        q = q.gte('data_publicacao', dateLocalToUTCRange(dataPublicacaoDebounced, false))
             .lte('data_publicacao', dateLocalToUTCRange(dataPublicacaoDebounced, true));
      }
      const { count, error } = await q;
      if (error) return 0;
      return count ?? 0;
    },
  });

  // ===== DataJud (CNJ) query =====
  const { data: datajudResults = [], isLoading: isLoadingDatajud } = useQuery({
    queryKey: ['datajud-movimentacoes', coordenacaoFiltroEfetivo, apenasHoje, dataInicioDebounced, dataFimDebounced, termoBuscaDebounced, monitoramentoId, readStatus],
    queryFn: async () => {
      let query = supabase
        .from('movimentacoes_datajud')
        .select(`
          id, monitoramento_id, coordenacao_id, numero_processo, tribunal,
          orgao_julgador, tipo_movimentacao, data_movimentacao, complemento,
          classe_processual, assuntos, lida, created_at
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (coordenacaoFiltroEfetivo) {
        query = query.eq('coordenacao_id', coordenacaoFiltroEfetivo);
      }
      if (readStatus === 'nao_lidas') {
        query = query.eq('lida', false);
      } else if (readStatus === 'lidas') {
        query = query.eq('lida', true);
      }
      if (monitoramentoId) {
        query = query.eq('monitoramento_id', monitoramentoId);
      }
      if (apenasHoje) {
        const hojeBrt = getHojeBrtISO();
        query = query
          .gte('created_at', dateLocalToUTCRange(hojeBrt, false))
          .lte('created_at', dateLocalToUTCRange(hojeBrt, true));
      } else {
        if (dataInicioDebounced) query = query.gte('created_at', dateLocalToUTCRange(dataInicioDebounced, false));
        if (dataFimDebounced) query = query.lte('created_at', dateLocalToUTCRange(dataFimDebounced, true));
      }
      if (termoBuscaDebounced) {
        const digits = termoBuscaDebounced.replace(/\D/g, '');
        if (digits.length >= 5) {
          query = query.ilike('numero_processo', `%${digits}%`);
        } else {
          query = query.or(`tipo_movimentacao.ilike.%${termoBuscaDebounced}%,complemento.ilike.%${termoBuscaDebounced}%,assuntos.ilike.%${termoBuscaDebounced}%`);
        }
      }

      const { data, error } = await query;
      if (error) { console.warn('Erro DataJud:', error); return []; }
      return (data || []) as any[];
    },
    enabled: tipoOrigem === 'datajud',
    staleTime: 30_000,
  });

  // Count DataJud for stats using the same filters as the list
  const { data: datajudStats = { total: 0, naoLidas: 0 }, isLoading: isLoadingDatajudStats } = useQuery({
    queryKey: ['datajud-count-hoje', coordenacaoFiltroEfetivo, apenasHoje, dataInicioDebounced, dataFimDebounced, termoBuscaDebounced, monitoramentoId, readStatus, tipoOrigem],
    queryFn: async () => {
      if (tipoOrigem !== 'datajud') {
        return { total: 0, naoLidas: 0 };
      }
      const applyFilters = (onlyUnread: boolean) => {
        const hojeBrt = getHojeBrtISO();
        let query = supabase
          .from('movimentacoes_datajud')
          .select('id', { count: 'exact', head: true });
        if (apenasHoje) {
          query = query
            .gte('created_at', dateLocalToUTCRange(hojeBrt, false))
            .lte('created_at', dateLocalToUTCRange(hojeBrt, true));
        } else {
          if (dataInicioDebounced) query = query.gte('created_at', dateLocalToUTCRange(dataInicioDebounced, false));
          if (dataFimDebounced) query = query.lte('created_at', dateLocalToUTCRange(dataFimDebounced, true));
        }
        if (coordenacaoFiltroEfetivo) query = query.eq('coordenacao_id', coordenacaoFiltroEfetivo);
        if (onlyUnread) query = query.eq('lida', false);
        if (monitoramentoId) query = query.eq('monitoramento_id', monitoramentoId);
        if (termoBuscaDebounced) {
          const digits = termoBuscaDebounced.replace(/\D/g, '');
          if (digits.length >= 5) {
            query = query.ilike('numero_processo', `%${digits}%`);
          } else {
            query = query.or(`tipo_movimentacao.ilike.%${termoBuscaDebounced}%,complemento.ilike.%${termoBuscaDebounced}%,assuntos.ilike.%${termoBuscaDebounced}%`);
          }
        }
        return query;
      };

      if (readStatus === 'nao_lidas') {
        const { count } = await applyFilters(true);
        const total = count || 0;
        return { total, naoLidas: total };
      }

      if (readStatus === 'lidas') {
        const [{ count: totalCount }, { count: unreadCount }] = await Promise.all([applyFilters(false), applyFilters(true)]);
        return { total: Math.max(0, (totalCount || 0) - (unreadCount || 0)), naoLidas: 0 };
      }

      const [{ count: totalCount }, { count: unreadCount }] = await Promise.all([applyFilters(false), applyFilters(true)]);
      return { total: totalCount || 0, naoLidas: unreadCount || 0 };
    },
    staleTime: 30_000,
  });
  const totalDatajudHoje = tipoOrigem === 'datajud' ? datajudStats.total : 0;
  const naoLidasDatajudHoje = tipoOrigem === 'datajud' ? datajudStats.naoLidas : 0;

  const { data: pautasDejtStats = { total: 0 }, isLoading: isLoadingPautasDejtStats } = useQuery({
    queryKey: ['pautas-dejt-stats-header', user?.id, coordenacaoFiltroEfetivo, JSON.stringify(userCoordenacaoIds), isAdmin, apenasHoje, dataInicioDebounced, dataFimDebounced, dataDisponibilizacaoDebounced, termoBuscaDebounced, monitoramentoId, readStatus, tipoOrigem],
    queryFn: async () => {
      if (!user?.id) return { total: 0 };

      const hojeBrt = getHojeBrtISO();
      // Para DEJT Pautas, o dia exibido na análise é a data legal de publicação.
      // Ex.: caderno disponibilizado em 03/07/2026 publica legalmente em 06/07/2026.
      const diaPauta = dataPublicacaoDebounced || dataDisponibilizacaoDebounced || (apenasHoje ? hojeBrt : null);
      const dataInicioFiltro = !diaPauta && dataInicioDebounced
        ? dateLocalToUTCRange(dataInicioDebounced, false)
        : null;
      const dataFimFiltro = !diaPauta && dataFimDebounced
        ? dateLocalToUTCRange(dataFimDebounced, true)
        : null;

      let query = (supabase.from('publicacoes_djen') as any)
        .select(`
          id, id_djen, dedup_key, dedup_conteudo_key, monitoramento_id, processo_numero, conteudo, data_publicacao,
          data_disponibilizacao, fonte, tribunal, lida, created_at, orgao, tipo_comunicacao,
          meio, advogados_json, partes_json, polo_ativo, polo_passivo,
          monitoramento:monitoramentos_djen!inner(
            id, tipo, termo_busca, descricao, oab, uf, coordenacao_id,
            coordenacao:coordenacoes(id, nome)
          )
        `)
        .eq('tipo_publicacao', 'pauta')
        .eq('status', 'encontrada')
        .order('created_at', { ascending: false });

      if (diaPauta) {
        query = query
          .gte('data_publicacao', `${diaPauta}T00:00:00Z`)
          .lte('data_publicacao', `${diaPauta}T23:59:59.999Z`);
      } else {
        if (dataInicioFiltro) query = query.gte('created_at', dataInicioFiltro);
        if (dataFimFiltro) query = query.lte('created_at', dataFimFiltro);
      }
      if (coordenacaoFiltroEfetivo) query = query.eq('monitoramento.coordenacao_id', coordenacaoFiltroEfetivo);
      if (!isAdmin && !coordenacaoFiltroEfetivo && userCoordenacaoIds.length > 0) {
        query = query.in('monitoramento.coordenacao_id', userCoordenacaoIds);
      }
      if (monitoramentoId) query = query.eq('monitoramento_id', monitoramentoId);

      const { data, error } = await query.limit(10000);
      if (error) throw error;

      let rows = (data || []) as any[];
      if (diaPauta) {
        rows = rows.filter((pub) => pub.data_publicacao?.slice(0, 10) === diaPauta);
      }
      if (termoBuscaDebounced) {
        const termoLower = termoBuscaDebounced.toLowerCase();
        const termoDigits = termoLower.replace(/\D/g, '');
        rows = rows.filter((pub) => {
          const matchConteudo = conteudoContemFraseExata(pub.conteudo, termoBuscaDebounced);
          const matchProcesso = pub.processo_numero?.toLowerCase().includes(termoLower);
          const matchTermoMonitor = pub.monitoramento?.termo_busca?.toLowerCase().includes(termoLower);
          const matchProcessoDigits = termoDigits.length >= 5 && pub.processo_numero
            ? (() => { const digits = pub.processo_numero.replace(/\D/g, ''); return digits.includes(termoDigits) || termoDigits.includes(digits); })()
            : false;
          return matchConteudo || matchProcesso || matchTermoMonitor || matchProcessoDigits;
        });
      }

      const mapped = rows.map((pub: any): PublicacaoUnificada => ({
        id: pub.id,
        id_djen: pub.id_djen ?? null,
        dedup_key: pub.dedup_key ?? null,
        dedup_conteudo_key: pub.dedup_conteudo_key ?? null,
        tipo_origem: 'termo',
        processo_id: null,
        processo_numero: pub.processo_numero,
        conteudo: pub.conteudo,
        data_publicacao: pub.data_publicacao,
        data_disponibilizacao: pub.data_disponibilizacao,
        fonte: pub.fonte,
        lida: false,
        created_at: pub.created_at,
        monitoramento_id: pub.monitoramento_id,
        monitoramento_termo: pub.monitoramento?.termo_busca,
        monitoramento_descricao: pub.monitoramento?.descricao,
        monitoramento_tipo: pub.monitoramento?.tipo,
        monitoramento_oab: pub.monitoramento?.oab,
        monitoramento_uf: pub.monitoramento?.uf,
        coordenacao_id: pub.monitoramento?.coordenacao_id,
        coordenacao_nome: pub.monitoramento?.coordenacao?.nome,
        polo_ativo: pub.polo_ativo || null,
        polo_passivo: pub.polo_passivo || null,
        tribunal: pub.tribunal ?? null,
        orgao: pub.orgao || null,
        tipo_comunicacao: pub.tipo_comunicacao || null,
        meio: pub.meio || null,
        advogados_json: Array.isArray(pub.advogados_json) ? pub.advogados_json : null,
        partes_json: Array.isArray(pub.partes_json) ? pub.partes_json : null,
      }));

      const deduped = dedupePublicacoesDjen(mapped);
      const ids = deduped.map((pub) => pub.id);
      const readSet = new Set<string>();
      if (ids.length > 0) {
        const { data: leituras } = await (supabase as any).rpc('get_leituras_publicacoes', { p_ids: ids });
        (leituras || []).forEach((l: any) => {
          if (l.usuario_id === user.id) readSet.add(l.publicacao_id);
        });
      }

      const total = readStatus === 'nao_lidas'
        ? deduped.filter((pub) => !readSet.has(pub.id)).length
        : readStatus === 'lidas'
          ? deduped.filter((pub) => readSet.has(pub.id)).length
          : deduped.length;

      return { total };
    },
    // Sempre habilitado para manter o badge "Pautas DEJT" visível,
    // respeitando coordenação selecionada (ou todas as do usuário) e filtros.
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // ===== Descartadas (RPC deduplicada com paginação no servidor) =====
  // Substitui a antiga query que trazia 10.000 linhas e depois filtrava no
  // cliente: agora a RPC `get_djen_descartadas_dedup` aplica filtros,
  // deduplica via window function e devolve apenas a página solicitada,
  // junto com o total deduplicado (via COUNT() OVER()).
  const descartadasDedupEnabled = !!user?.id && tipoOrigem === 'descartada';
  const { data: descartadasDedupData, isLoading: isLoadingDescartadasDedup, isFetching: isFetchingDescartadasDedup } = useQuery({
    queryKey: [
      'descartadas-dedup',
      user?.id,
      coordenacaoFiltroEfetivo,
      apenasHoje,
      dataInicioDebounced,
      dataFimDebounced,
      dataDisponibilizacaoDebounced,
      termoBuscaDebounced,
      monitoramentoId,
      readStatus,
      descartadasPage,
      PAGE_SIZE_DESCARTADAS,
    ],
    queryFn: async () => {
      if (!user?.id) return { rows: [] as PublicacaoUnificada[], total: 0 };

      const hojeBrt = getHojeBrtISO();
      const dataInicioFiltro = apenasHoje
        ? dateLocalToUTCRange(hojeBrt, false)
        : dataInicioDebounced
          ? dateLocalToUTCRange(dataInicioDebounced, false)
          : null;
      const dataFimFiltro = apenasHoje
        ? dateLocalToUTCRange(hojeBrt, true)
        : dataFimDebounced
          ? dateLocalToUTCRange(dataFimDebounced, true)
          : null;
      const dataDispInicio = dataDisponibilizacaoDebounced
        ? `${dataDisponibilizacaoDebounced}T00:00:00Z`
        : null;
      const dataDispFim = dataDisponibilizacaoDebounced
        ? `${dataDisponibilizacaoDebounced}T23:59:59.999Z`
        : null;

      const { data, error } = await (supabase as any).rpc('get_djen_descartadas_dedup', {
        p_coordenacao_id: coordenacaoFiltroEfetivo ?? null,
        p_inicio: dataInicioFiltro,
        p_fim: dataFimFiltro,
        p_data_disponibilizacao_inicio: dataDispInicio,
        p_data_disponibilizacao_fim: dataDispFim,
        p_apenas_hoje: apenasHoje,
        p_search_query: termoBuscaDebounced || null,
        p_limit: PAGE_SIZE_DESCARTADAS,
        p_offset: (descartadasPage - 1) * PAGE_SIZE_DESCARTADAS,
        p_monitoramento_id: monitoramentoId || null,
        p_read_status: readStatus,
      });

      if (error) {
        console.warn('Erro ao buscar descartadas deduplicadas:', error);
        return { rows: [] as PublicacaoUnificada[], total: 0 };
      }

      const rawRows: any[] = (data || []) as any[];
      const total = rawRows.length > 0 ? Number(rawRows[0].total_count || 0) : 0;
      const rows: PublicacaoUnificada[] = rawRows.map((r: any) => ({
        id: r.id,
        tipo_origem: 'descartada',
        processo_id: null,
        processo_numero: r.processo_numero,
        conteudo: r.conteudo,
        data_publicacao: r.data_publicacao,
        data_disponibilizacao: r.data_disponibilizacao,
        fonte: r.fonte,
        lida: !!r.lida,
        created_at: r.created_at,
        monitoramento_id: r.monitoramento_id,
        monitoramento_termo: r.monitoramento_termo,
        monitoramento_descricao: r.monitoramento_descricao,
        monitoramento_tipo: r.monitoramento_tipo,
        monitoramento_oab: r.monitoramento_oab,
        monitoramento_uf: r.monitoramento_uf,
        coordenacao_id: r.coordenacao_id,
        coordenacao_nome: r.coordenacao_nome,
        polo_ativo: null,
        polo_passivo: null,
        tribunal: r.tribunal,
        orgao: r.orgao || null,
        tipo_comunicacao: r.tipo_comunicacao || null,
        meio: r.meio || null,
        advogados_json: Array.isArray(r.advogados_json) ? r.advogados_json : null,
        partes_json: Array.isArray(r.partes_json) ? r.partes_json : null,
        motivo_descarte: r.motivo_descarte,
        descartado_por: r.descartado_por ?? null,
        descartado_por_nome: r.descartado_por_nome ?? null,
        lido_por: Array.isArray(r.lido_por)
          ? r.lido_por.map((x: any) => ({ nome: String(x?.nome ?? 'Desconhecido'), lida_em: String(x?.lida_em ?? '') }))
          : [],
      }));
      return { rows, total };
    },
    enabled: descartadasDedupEnabled,
    staleTime: 30_000,
  });

  const descartadasStats = { total: descartadasDedupData?.total ?? 0 };
  const isLoadingDescartadasStats = isLoadingDescartadasDedup;

  const isLoadingStatsCards = loadingStats || isLoadingDatajudStats || isLoadingPautasDejtStats || isLoadingDescartadasStats;
  const totalPautasDejt = pautasDejtStats.total;
  const periodoLabel = apenasHoje ? 'Hoje' : 'no Período';

  // Map DataJud results to PublicacaoUnificada format
  const datajudAsPublicacoes: PublicacaoUnificada[] = useMemo(() => {
    // Deduplicar por processo + tipo_movimentacao + data para evitar entradas repetidas
    const seen = new Set<string>();
    return datajudResults.filter((mov: any) => {
      const key = `${mov.numero_processo}|${mov.tipo_movimentacao}|${mov.data_movimentacao}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((mov: any) => ({
      id: mov.id,
      tipo_origem: 'datajud' as const,
      processo_id: null,
      processo_numero: mov.numero_processo,
      conteudo: [
        mov.tipo_movimentacao && `<strong>Movimentação:</strong> ${mov.tipo_movimentacao}`,
        mov.complemento && `<strong>Complemento:</strong> ${mov.complemento}`,
        mov.classe_processual && `<strong>Classe:</strong> ${mov.classe_processual}`,
        mov.assuntos && `<strong>Assuntos:</strong> ${mov.assuntos}`,
        mov.orgao_julgador && `<strong>Órgão:</strong> ${mov.orgao_julgador}`,
      ].filter(Boolean).join('<br/>'),
      data_publicacao: mov.data_movimentacao,
      data_disponibilizacao: null,
      fonte: 'DataJud (CNJ)',
      lida: mov.lida ?? false,
      created_at: mov.created_at,
      monitoramento_id: mov.monitoramento_id,
      monitoramento_termo: null,
      monitoramento_descricao: null,
      monitoramento_tipo: null,
      monitoramento_oab: null,
      monitoramento_uf: null,
      coordenacao_id: mov.coordenacao_id,
      coordenacao_nome: coordenacoes?.find((c: any) => c.id === mov.coordenacao_id)?.nome || null,
      polo_ativo: null,
      polo_passivo: null,
      tribunal: mov.tribunal,
    }));
  }, [datajudResults, coordenacoes]);

  // Filtro de coordenações do usuário para quando "Todas" está selecionado por não-admin
  // Se não-admin e "Todas" selecionado, restringir publicações às suas coordenações
  const deveRestringirPorCoordenacao = !isAdmin && coordenacaoId === "" && userCoordenacaoIds.length > 0;

  const filtrarPorCoordenacaoUsuario = (pubs: PublicacaoUnificada[]) => {
    if (!deveRestringirPorCoordenacao) return pubs;
    return pubs.filter(p => p.coordenacao_id && userCoordenacaoIds.includes(p.coordenacao_id));
  };

  // Merge publications based on filter
  const mergedPublicacoes = useMemo(() => {
    let result: PublicacaoUnificada[];
    if (tipoOrigem === 'datajud') result = datajudAsPublicacoes;
    else if (tipoOrigem === 'descartada') result = descartadasDedupData?.rows ?? [];
    else result = publicacoes;
    result = filtrarPorCoordenacaoUsuario(result);
    if (focusFromErrata) {
      result = result.filter(p => focusFromErrata.ids.has(p.id));
    }
    if (dataPublicacaoDebounced) {
      result = result.filter((p: any) => (p.data_publicacao || '').slice(0, 10) === dataPublicacaoDebounced);
    }
    return result;
  }, [tipoOrigem, publicacoes, datajudAsPublicacoes, descartadasDedupData, deveRestringirPorCoordenacao, userCoordenacaoIds, focusFromErrata, dataPublicacaoDebounced]);

  // Loading considera tanto o carregamento inicial da coordenação quanto das publicações
  // Também considera `isFetching` para evitar mostrar "Nenhuma publicação encontrada"
  // enquanto a query ainda está buscando dados (ex.: 7k+ linhas do dia demoram).
  const isLoading = loadingUserCoord || coordenacaoId === null
    || (tipoOrigem === 'descartada'
        ? (isLoadingDescartadasDedup || isFetchingDescartadasDedup)
        : (isLoadingPublicacoes || isFetchingPublicacoes))
    || (tipoOrigem === 'datajud' && isLoadingDatajud);


  // Buscar termos (monitoramentos) da coordenação selecionada (ordem alfabética)
  const { data: monitoramentos = [] } = useQuery({
    queryKey: ['monitoramentos-djen-coord', coordenacaoFiltroEfetivo],
    queryFn: async () => {
      if (!coordenacaoFiltroEfetivo) return [];
      const { data, error } = await supabase
        .from('monitoramentos_djen')
        .select('id, termo_busca, descricao, tipo, oab, uf, tribunais')
        .eq('coordenacao_id', coordenacaoFiltroEfetivo)
        .eq('ativo', true)
        .eq('arquivado', false);
      if (error) throw error;
      const list = (data || []) as { id: string; termo_busca: string; descricao?: string; tipo?: string; oab?: string; uf?: string; tribunais?: string[] | null }[];
      const getLabel = (m: typeof list[0]) =>
        m.descricao || m.termo_busca || `${m.tipo || 'Termo'} ${m.oab || ''} ${m.uf || ''}`.trim() || m.id.slice(0, 8);
      return list.sort((a, b) => getLabel(a).localeCompare(getLabel(b), 'pt-BR', { sensitivity: 'base' }));
    },
    enabled: !!coordenacaoFiltroEfetivo,
  });

  // Lista de tribunais configurados nos termos da coordenação selecionada
  // (união dos arrays `tribunais` de cada monitoramento ativo).
  const tribunaisDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (monitoramentos as any[]).forEach((m) => {
      const tribs = Array.isArray(m.tribunais) ? m.tribunais : [];
      tribs.forEach((t: string) => {
        const v = (t || "").toString().trim().toUpperCase();
        if (v) set.add(v);
      });
    });
    return Array.from(set).sort((a, b) => {
      if (a === 'TST') return -1;
      if (b === 'TST') return 1;
      if (a === 'STF') return -1;
      if (b === 'STF') return 1;
      const prefixA = a.replace(/\d+/, '');
      const prefixB = b.replace(/\d+/, '');
      const numA = a.match(/\d+/)?.[0];
      const numB = b.match(/\d+/)?.[0];
      if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
      if (numA && numB) return Number(numA) - Number(numB);
      return a.localeCompare(b);
    });
  }, [monitoramentos]);

  const toggleSelect = (id: string, tipo: TipoOrigemPublicacao) => {
    const newSelected = new Map<string, TipoOrigemPublicacao>(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.set(id, tipo);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === allPublicacoes.length) {
      setSelectedIds(new Map<string, TipoOrigemPublicacao>());
    } else {
      const newMap = new Map<string, TipoOrigemPublicacao>();
      allPublicacoes.forEach(p => newMap.set(p.id, p.tipo_origem as TipoOrigemPublicacao));
      setSelectedIds(newMap);
    }
  };

  const toggleCoordenacao = (coordId: string) => {
    const newExpanded = new Set(expandedCoordenacoes);
    if (newExpanded.has(coordId)) {
      newExpanded.delete(coordId);
    } else {
      newExpanded.add(coordId);
    }
    setExpandedCoordenacoes(newExpanded);
  };

  const handleView = (pub: PublicacaoUnificada) => {
    toggleExpandPublicacao(pub.id);
  };

  const handleCriarTarefa = async (pub: PublicacaoUnificada) => {
    // Não marca como lida automaticamente — use o botão "Salvar e ler" no formulário.
    await handleAdicionarClick(pub);
    setCriarTarefaDialogOpen(true);
  };

  const handleAdicionarClick = async (pub: PublicacaoUnificada) => {
    // Sempre que o usuário adiciona qualquer item a partir de uma publicação,
    // primeiro garante o processo e salva a publicação clicada na aba Pub. DJEN.
    // Não marca como lida automaticamente — só no botão "Salvar e ler".
    setSelectedPublicacao(pub);
    await resolverProcessoDaPublicacao(pub);
  };


  // Função para vincular publicação a processo existente
  const handleSalvarPublicacao = async (pub: PublicacaoUnificada) => {
    if (!pub.processo_numero || !user?.id) {
      toast.error("Número do processo não encontrado");
      return;
    }

    // O hook já preenche processo_id quando o processo existe
    const processoId = pub.processo_id;
    if (!processoId) {
      toast.error("Processo não está cadastrado. Use Importar para criar.");
      return;
    }

    setSavingProcessoId(pub.id);

    try {
      // Vincula a publicação completa à aba "Pub. DJEN" do processo (sem duplicar
      // como movimentação e sem marcar como lida — a lista permanece intacta).
      await salvarPublicacaoNoProcesso(pub, processoId);

      // Invalida apenas a query da aba "Pub. DJEN" do processo alvo,
      // sem tocar na listagem da Análise DJEN (a tela deve ficar parada).
      queryClient.invalidateQueries({ queryKey: ["publicacoes-djen-processo", processoId] });

      toast.success("Publicação salva no processo!", {
        action: {
          label: "Ver processo",
          onClick: () => navigate(`/processos/${processoId}`),
        },
      });
    } catch (error: any) {
      console.error("Erro ao salvar publicação:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSavingProcessoId(null);
    }
  };

  // Função para importar processo não cadastrado
  const handleImportarProcesso = async (pub: PublicacaoUnificada) => {
    if (!pub.processo_numero || !user?.id) {
      toast.error("Número do processo não encontrado");
      return;
    }

    // Se já existe processo detectado pelo hook, não deve importar
    if (pub.processo_id) {
      toast.error("Processo já existe na base. Use o botão Salvar para vincular a publicação.");
      return;
    }

    // Verificar no banco (fallback de segurança)
    const { data: processoExistente } = await supabase
      .from('processos')
      .select('id')
      .eq('numero', pub.processo_numero)
      .maybeSingle();

    if (processoExistente) {
      toast.error("Processo já existe na base. Use o botão Salvar para vincular a publicação.");
      return;
    }

    setImportingProcessoId(pub.id);

    try {
      // Nome da pasta inclui o número do processo para evitar duplicatas (pastas.nome é UNIQUE)
      const poloAtivo = pub.polo_ativo || "Autor não identificado";
      const poloPassivo = pub.polo_passivo || "Réu não identificado";
      const nomePasta = `${poloPassivo} x ${poloAtivo} - ${pub.processo_numero}`.substring(0, 200);

      // 1. Usar pasta existente se houver, senão criar
      const { data: pastaExistente } = await supabase
        .from('pastas')
        .select('id')
        .eq('nome', nomePasta)
        .maybeSingle();

      let pastaId: string;

      if (pastaExistente) {
        pastaId = pastaExistente.id;
      } else {
        const { data: pasta, error: pastaError } = await supabase
          .from('pastas')
          .insert({
            nome: nomePasta,
            descricao: `Processo importado do DJEN - ${pub.processo_numero}`,
            criado_por: user.id,
          })
          .select()
          .single();

        if (pastaError) throw pastaError;
        pastaId = pasta.id;
      }

      // 2. Criar o processo vinculado à pasta
      const { data: processo, error: processoError } = await supabase
        .from('processos')
        .insert({
          numero: pub.processo_numero,
          area: 'civil',
          status: 'ativo',
          tribunal: pub.tribunal || pub.fonte || 'Não identificado',
          polo_ativo: pub.polo_ativo || 'A identificar',
          polo_passivo: pub.polo_passivo || 'A identificar',
          assunto: stripHtmlAndDecodeEntities(pub.conteudo).substring(0, 500) || 'Processo importado do DJEN',
          pasta_id: pastaId,
          coordenacao_id: pub.coordenacao_id || userCoordenacao || null,
          monitorar_andamentos: true,
        })
        .select()
        .single();

      if (processoError) throw processoError;

      // 3. Adicionar o usuário como responsável
      await supabase
        .from('processos_responsaveis')
        .insert({
          processo_id: processo.id,
          usuario_id: user.id,
        });

      // 4. Adicionar a publicação como primeira movimentação
      await supabase
        .from('movimentacoes')
        .insert({
          processo_id: processo.id,
          descricao: `Publicação DJEN: ${stripHtmlAndDecodeEntities(pub.conteudo).substring(0, 1000) || 'Importado do DJEN'}`,
          tipo: 'publicacao',
          fonte: 'DJEN',
          data_movimentacao: pub.data_publicacao || new Date().toISOString(),
        });

      // 5. Marcar a publicação como lida
      await supabase
        .from('publicacoes_djen')
        .update({ lida: true })
        .eq('id', pub.id);

      toast.success("Processo e pasta criados com sucesso!", {
        action: {
          label: "Ver processo",
          onClick: () => navigate(`/processos/${processo.id}`),
        },
      });
      // Registra localmente para trocar o botão para "Salvar" e exibir "Ver processo"
      setImportedProcessos((prev) => ({ ...prev, [pub.id]: processo.id }));
    } catch (error: any) {
      console.error("Erro ao importar processo:", error);
      toast.error(`Erro ao importar: ${error.message}`);
    } finally {
      setImportingProcessoId(null);
    }
  };

  const toggleExpandPublicacao = (id: string) => {
    const newExpanded = new Set(expandedPublicacoes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedPublicacoes(newExpanded);
  };

  // ===== PDF: dados do lado esquerdo SOMENTE do banco (gravados na captura) =====
  const pdfListFromPolo = (pub: typeof allPublicacoes[0]): string[] => {
    const out: string[] = [];
    const add = (raw: string) => {
      const s = raw.trim();
      if (!s || s.length > 200) return;
      if (out.some(x => x.toUpperCase() === s.toUpperCase())) return;
      out.push(s);
    };
    if (pub.polo_ativo) pub.polo_ativo.split(/[;,]/).map(p => p.trim()).filter(Boolean).forEach(add);
    if (pub.polo_passivo) pub.polo_passivo.split(/[;,]/).map(p => p.trim()).filter(Boolean).forEach(add);
    return out;
  };

  /** Desenha um ícone de pessoa (estilo Lucide User) no PDF — cabeça + busto/ombros */
  const drawPersonIcon = (doc: jsPDF, x: number, y: number, color: 'green' | 'red' | 'black') => {
    const colors: Record<string, [number, number, number]> = {
      green: [22, 163, 74],   // green-600 (mesmo da tela)
      red: [239, 68, 68],     // red-500 (mesmo da tela)
      black: [100, 116, 139], // slate-500 (mesmo da tela)
    };
    const [r, g, b] = colors[color];
    doc.setDrawColor(r, g, b);
    doc.setFillColor(r, g, b);
    doc.setLineWidth(0.25);
    
    // Centro do ícone
    const cx = x + 1.5;
    const cy = y - 1.2;
    
    // Cabeça (círculo preenchido — igual ao Lucide User)
    doc.circle(cx, cy - 1.6, 0.9, 'FD');
    
    // Busto/ombros (arco — path simulando o torso do Lucide User)
    // Lucide User: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    // Simulamos com linhas curvas: um arco de ombros
    const shoulderY = cy + 0.1;
    const bodyBottom = cy + 1.8;
    const halfW = 1.6;
    
    // Lado esquerdo do busto (curva)
    doc.line(cx - halfW, bodyBottom, cx - halfW, shoulderY + 0.8);
    // Arco esquerdo do ombro
    doc.line(cx - halfW, shoulderY + 0.8, cx - halfW + 0.4, shoulderY + 0.2);
    doc.line(cx - halfW + 0.4, shoulderY + 0.2, cx - 0.3, shoulderY);
    // Arco direito do ombro  
    doc.line(cx + 0.3, shoulderY, cx + halfW - 0.4, shoulderY + 0.2);
    doc.line(cx + halfW - 0.4, shoulderY + 0.2, cx + halfW, shoulderY + 0.8);
    // Lado direito do busto
    doc.line(cx + halfW, shoulderY + 0.8, cx + halfW, bodyBottom);
    
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(0, 0, 0);
  };

  /** Retorna a cor do ícone baseado no prefixo de polo */
  const getParteIconColor = (parte: string): 'green' | 'red' | 'black' => {
    if (/^\[(Reclamante|Autor|Requerente|Exequente|Impetrante|Agravante)\]/i.test(parte)) return 'green';
    if (/^\[(Reclamado|Réu|Requerido|Executado|Impetrado|Agravado)\]/i.test(parte)) return 'red';
    return 'black';
  };

  /** Remove prefixo de polo para exibição */
  const cleanParteName = (parte: string): string => {
    return parte.replace(/^\[(Reclamante|Reclamado|Autor|Réu|Requerente|Requerido|Exequente|Executado|Impetrante|Impetrado|Agravante|Agravado)\]\s*/i, '');
  };

  /** Desenha o cabeçalho profissional do PDF: faixa azul, logo da balança e "Sistema Juris Control". */
  const drawPdfHeader = (doc: jsPDF, pageW: number, subtitle: string) => {
    const headerH = 28;
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, pageW, headerH, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.4);
    const cx = 14;
    const cy = 14;
    const s = 0.9;
    doc.line(cx, cy + 4 * s, cx, cy - 8 * s);
    doc.line(cx - 6 * s, cy - 8 * s, cx + 6 * s, cy - 8 * s);
    doc.line(cx - 6 * s, cy - 8 * s, cx - 7 * s, cy - 4 * s);
    doc.line(cx - 7 * s, cy - 4 * s, cx - 2, cy - 4 * s);
    doc.line(cx - 2, cy - 4 * s, cx - 6 * s, cy - 8 * s);
    doc.line(cx + 6 * s, cy - 8 * s, cx + 7 * s, cy - 4 * s);
    doc.line(cx + 7 * s, cy - 4 * s, cx + 2, cy - 4 * s);
    doc.line(cx + 2, cy - 4 * s, cx + 6 * s, cy - 8 * s);
    doc.line(cx - 3 * s, cy + 4 * s, cx + 3 * s, cy + 4 * s);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Sistema Juris Control", 26, 11);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 26, 17);
    doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 26, 23);
    doc.setTextColor(0, 0, 0);
  };

  // ===== PDF "Gerar PDF" - layout duas colunas (metadados esquerda, conteúdo direita) =====
  const handleGerarPdf = async () => {
    const allPublicacoes = getPubsParaGerar();
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    try {
      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const mL = 15;
      const mR = 15;
      const maxW = pageW - mL - mR;
      let y = 34;
      const checkPage = (need: number) => { if (y + need > 280) { doc.addPage(); y = 15; } };

      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      drawPdfHeader(doc, pageW, `Gestão Jurídica e Publicações ${origemLabel}`);

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`PUBLICAÇÕES ${origemLabel} (${allPublicacoes.length})`, mL, y);
      y += 10;

      const colLeftW = 60;
      const colGap = 4;
      const colRightX = mL + colLeftW + colGap;
      const colRightW = maxW - colLeftW - colGap;

      allPublicacoes.forEach((pub, idx) => {
        if (idx > 0) {
          checkPage(12);
          y += 3;
          doc.setDrawColor(30, 58, 95);
          doc.setLineWidth(0.5);
          doc.line(mL, y, pageW - mR, y);
          y += 8;
        }

        // Title bar
        checkPage(50);
        doc.setFillColor(235, 242, 255);
        doc.rect(mL, y - 4, maxW, 10, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 95);
        doc.text(`Processo ${formatProcessoNumero(pub.processo_numero)}`, mL + 2, y + 2);
        y += 12;
        doc.setTextColor(0, 0, 0);

        const yStart = y;

        // LEFT: Metadata
        doc.setFontSize(8);
        let yLeft = yStart;
        const printMeta = (label: string, value: string) => {
          doc.setFont("helvetica", "bold");
          doc.text(`${label}:`, mL, yLeft); yLeft += 3.5;
          doc.setFont("helvetica", "normal");
          const vl = doc.splitTextToSize(value, colLeftW);
          vl.forEach((l: string) => { doc.text(l, mL, yLeft); yLeft += 3.5; });
          yLeft += 1.5;
        };

        if (pub.tribunal) printMeta("Órgão", pub.tribunal);
        if (pub.orgao && pub.orgao !== pub.tribunal) printMeta("Turma", shortenTurma(pub.orgao));
        if (pub.data_disponibilizacao) printMeta("Data de disponibilização", formatDateOnlyFull(pub.data_disponibilizacao));
        printMeta("Tipo de comunicação", "Intimação");
        if (pub.fonte) printMeta("Fonte", pub.fonte);

        const { partes, advogados } = getPartesEAdvogadosParaExibicao(
          pub.partes_json, pub.advogados_json, pub.conteudo, pub.polo_ativo, pub.polo_passivo
        );
        if (partes.length > 0) {
          yLeft += 2;
          doc.setFont("helvetica", "bold");
          doc.text("Parte(s)", mL, yLeft); yLeft += 4;
          doc.setFont("helvetica", "normal");
          partes.forEach(p => {
            const iconColor = getParteIconColor(p);
            const nome = cleanParteName(p);
            drawPersonIcon(doc, mL + 1, yLeft, iconColor);
            const ls = doc.splitTextToSize(nome, colLeftW - 6);
            ls.forEach((l: string) => { doc.text(l, mL + 6, yLeft); yLeft += 3.5; });
          });
        }

        if (advogados.length > 0) {
          yLeft += 2;
          doc.setFont("helvetica", "bold");
          doc.text("Advogado(s)", mL, yLeft); yLeft += 4;
          doc.setFont("helvetica", "normal");
          advogados.forEach(a => {
            drawPersonIcon(doc, mL + 1, yLeft, 'black');
            const ls = doc.splitTextToSize(a, colLeftW - 6);
            ls.forEach((l: string) => { doc.text(l, mL + 6, yLeft); yLeft += 3.5; });
          });
        }

        // RIGHT: Content
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const rawContent = stripHtmlAndDecodeEntities(pub.conteudo) || "Sem conteúdo";
        const contentLines: string[] = doc.splitTextToSize(rawContent, colRightW);
        let yRight = yStart;
        contentLines.forEach((line: string) => {
          if (yRight + 3.5 > 280) { doc.addPage(); yRight = 15; }
          doc.text(line, colRightX, yRight);
          yRight += 3.5;
        });

        y = Math.max(yLeft, yRight) + 6;

        // Comentários da coordenação
        const coms = comentariosMap.get(pub.id);
        if (coms && coms.length > 0) {
          checkPage(10);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 58, 95);
          doc.text(`Comentários da coordenação (${coms.length})`, mL, y);
          y += 5;
          doc.setTextColor(0, 0, 0);
          coms.forEach((c) => {
            const dataFmt = (() => { try { return format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return ""; } })();
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            checkPage(5);
            doc.text(`${c.autor} (${dataFmt})`, mL + 2, y);
            y += 4;
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(c.comentario, maxW - 4);
            lines.forEach((l: string) => { checkPage(4); doc.text(l, mL + 4, y); y += 4; });
            y += 1;
          });
          y += 4;
        }
      });

      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
        doc.text(`Juris Control – Página ${i}/${total}`, pageW / 2, 292, { align: "center" });
      }
      doc.save(`publicacoes_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (err: any) {
      toast.error(`Erro ao gerar PDF: ${err.message}`);
    }
  };

  // ===== PDF "Gerar PDF Resumo" - formato DOC do advogado (estilo Comunica PJE) =====

  // Detecta se a publicação é uma Pauta de Julgamento (sessão virtual/presencial).
  const isPautaDeJulgamento = (conteudo?: string | null): boolean => {
    if (!conteudo) return false;
    const txt = decodeHtmlEntities(String(conteudo).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

    // 1) Exclusão prioritária: acórdão / decisão monocrática.
    //    Acórdãos do TST frequentemente citam "publicação de nova pauta de
    //    julgamento (RITST, art. 122)" dentro do dispositivo — não é pauta.
    const ehAcordaoOuDecisao =
      /A\s*C\s*Ó\s*R\s*D\s*Ã\s*O/i.test(txt) ||
      /\bACORDAM\s+os\s+Ministros/i.test(txt) ||
      /\bACORDAM\s+as?\s+(Turma|Desembargadora|Desembargadores)/i.test(txt) ||
      /\bISTO\s+POSTO\b/i.test(txt) ||
      /Embargos\s+de\s+declara[çc][ãa]o\s+acolhidos/i.test(txt) ||
      /\bDECIS[ÃA]O\s+MONOCR[ÁA]TICA\b/i.test(txt) ||
      (/\bRelator[:(]/i.test(txt) && /\bV\s*O\s*T\s*O\b/i.test(txt));
    if (ehAcordaoOuDecisao) return false;

    // 2) Confirmação positiva — exige marcador estrutural, não basta a frase
    //    "Pauta de Julgamento" aparecer em qualquer ponto do texto.
    const cabecalho = txt.slice(0, 500);
    const temCabecalhoPauta =
      /(^|\s)PAUTA\s+DE\s+JULGAMENTO/i.test(cabecalho) ||
      /Aditamento\s+[àa]\s+Pauta/i.test(cabecalho);
    const temSessao =
      /\bSess[aã]o\s+(Ordin[áa]ria|Extraordin[áa]ria|Virtual|Presencial)/i.test(txt) &&
      /\bsess[aã]o\s+(virtual|presencial)/i.test(txt);
    const temCejusc = /\bCEJUSC\b/i.test(txt);

    return temCabecalhoPauta || temSessao || temCejusc;
  };

  // Para pautas, retorna apenas o cabeçalho da sessão e o bloco do processo atual.
  // Evita trazer a pauta completa ou repetir as linhas iniciais no resumo.
  const extractTrechoPauta = (conteudo?: string | null, processo?: string | null): string => {
    if (!conteudo || !isPautaDeJulgamento(conteudo)) return "";
    const linhas = decodeHtmlEntities(String(conteudo)
      .replace(/<br\s*\/?>(?=)/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r\n?/g, "\n"))
      .split("\n")
      .map(l => l.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean);

    // CEJUSC: devolve a publicação na íntegra (texto limpo), sem segmentar por processo.
    const txtPlano = linhas.join(" ");
    if (/\bCEJUSC\b/i.test(txtPlano)) {
      return linhas.join("\n").trim();
    }

    const limparLinha = (l: string) => !/^C[oó]digo para aferir autenticidade/i.test(l)
      && !/^Data da Disponibiliza[cç][aã]o:/i.test(l)
      && !/^\d+\/\d+\s+Tribunal Regional do Trabalho/i.test(l);
    const cnjRe = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}|\b\d{20}\b/;
    const digitsProc = String(processo || "").replace(/\D/g, "");
    const isProcessStart = (linha: string) => /^Processo\s+N[ºo]/i.test(linha) || cnjRe.test(linha);
    const firstProcessIdx = linhas.findIndex(isProcessStart);

    let headerLines = (firstProcessIdx > 0 ? linhas.slice(0, firstProcessIdx) : linhas.slice(0, 12)).filter(limparLinha);
    const obsIdx = headerLines.findIndex(l => /^OBS\.:/i.test(l) || /^As inscri[cç][oõ]es/i.test(l) || /^Para os processos/i.test(l));
    if (obsIdx > -1) headerLines = headerLines.slice(0, obsIdx);
    const header = headerLines.join("\n").trim();

    let start = -1;
    if (digitsProc.length >= 15) {
      start = linhas.findIndex(l => l.replace(/\D/g, "").includes(digitsProc));
    }
    if (start < 0) start = firstProcessIdx;
    if (start > 0 && /^Processo\s+N[ºo]/i.test(linhas[start - 1]) && !cnjRe.test(linhas[start - 1])) start--;

    let bloco = "";
    if (start >= 0) {
      let end = linhas.length;
      for (let i = start + 1; i < linhas.length; i++) {
        const lineDigits = linhas[i].replace(/\D/g, "");
        const sameProcess = digitsProc.length >= 15 && lineDigits.includes(digitsProc);
        if (/^Processo\s+N[ºo]/i.test(linhas[i]) || (cnjRe.test(linhas[i]) && !sameProcess)) {
          end = i;
          break;
        }
      }
      bloco = linhas.slice(start, end).filter(limparLinha).join("\n").trim();
    }

    // Garantia: pautas NUNCA devem cair no resumo "trecho final" (que pega o final do texto inteiro).
    // Se não conseguimos isolar o bloco do processo, devolve o cabeçalho + os primeiros
    // ~1500 chars limpos da pauta como amostra mínima (em vez de devolver vazio
    // e permitir que o fallback dump a publicação inteira).
    if (!bloco) {
      bloco = linhas.filter(limparLinha).slice(0, 40).join("\n").trim().slice(0, 1500);
    }

    return [header, bloco].filter(Boolean).join("\n\n").trim();
  };

  const resumirTrechoPauta = (trecho?: string | null): string => {
    if (!trecho) return "";
    const linhas = String(trecho).split(/\n+/).map(l => l.trim()).filter(Boolean);
    const get = (re: RegExp) => linhas.find(l => re.test(l)) || "";
    const all = linhas.join(" ").replace(/\s+/g, " ").trim();
    const pick = (label: string, stops: string[]) => {
      const stopRe = [...stops, "OBS\\.", "\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}", "$"].join("|");
      return (all.match(new RegExp(`${label}\\s*:?\\s*(.*?)(?=${stopRe})`, "i"))?.[1] || "").trim();
    };
    const titulo = get(/Pauta\s+de\s+Julgamento/i) || "Pauta de julgamento";
    const cnj = get(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}|\b\d{20}\b/);
    const relatorIdx = linhas.findIndex(l => /^Relator\b/i.test(l));
    const relator = relatorIdx >= 0
      ? [linhas[relatorIdx].replace(/^Relator\s*/i, ""), linhas[relatorIdx + 1] && !/^(Revisor|AGRAVANTE|AGRAVADO|RECORRENTE|RECORRIDO|RECLAMANTE|RECLAMADO|ADVOGADO|Intimado)/i.test(linhas[relatorIdx + 1]) ? linhas[relatorIdx + 1] : ""].filter(Boolean).join(" ").trim()
      : "";
    const partes = linhas.filter(l => /^(AGRAVANTE|AGRAVADO|RECORRENTE|RECORRIDO|RECLAMANTE|RECLAMADO)\b/i.test(l));
    const advogados = linhas.filter(l => /^ADVOGADO\b/i.test(l)).map(l => l.replace(/^ADVOGADO\s*/i, "").trim());
    const intimadosIdx = linhas.findIndex(l => /^Intimado\(s\)\/Citado\(s\)/i.test(l));
    const intimados = intimadosIdx >= 0 ? linhas.slice(intimadosIdx + 1).filter(l => /^-\s*/.test(l)).map(l => l.replace(/^-\s*/, "")).join("; ") : "";
    const saida = [`Resumo: ${titulo}.`];
    const inicio = pick("Data e hora de início da sessão Virtual", ["Data e hora de encerramento da sessão Virtual", "Data da sessão PRESENCIAL"]);
    const fim = pick("Data e hora de encerramento da sessão Virtual", ["Data da sessão PRESENCIAL"]);
    const presencial = pick("Data da sessão PRESENCIAL", []);
    if (inicio) saida.push(`Início da sessão virtual: ${inicio}.`);
    if (fim) saida.push(`Encerramento da sessão virtual: ${fim}.`);
    if (presencial) saida.push(`Sessão presencial: ${presencial}.`);
    if (cnj) saida.push(`Processo em pauta: ${cnj}.`);
    if (relator) saida.push(`Relator(a): ${relator}.`);
    if (partes.length) saida.push(`Partes: ${partes.join("; ")}.`);
    if (advogados.length) saida.push(`Advogados: ${advogados.join("; ")}.`);
    if (intimados) saida.push(`Intimado(s)/Citado(s): ${intimados}.`);
    // Sempre anexa o bloco original da pauta (cabeçalho da sessão + bloco do
    // processo). Em formatos como "Aditamento à Pauta" do TST as pautas não
    // trazem rótulos como "Data e hora de início...", e o resumo estruturado
    // ficaria reduzido a 1-2 linhas, descartando relator/partes/advogados em
    // texto livre. Mantemos o conteúdo bruto abaixo do resumo para não
    // perder nada que estiver no bloco.
    const trechoBruto = String(trecho).trim();
    if (trechoBruto) {
      saida.push("");
      saida.push("Detalhes da pauta:");
      saida.push(trechoBruto);
    }
    return saida.join("\n");
  };

  // Extrai o trecho final ORIGINAL da publicação contendo o dispositivo/acórdão,
  // assinatura do relator e intimados. Mesma lógica usada pelo edge function
  // `resumir-publicacoes` (lê do final para o começo, preserva quebras de linha).
  const extractTrechoFinal = (conteudo?: string | null): string => {
    if (!conteudo) return "";
    const pauta = extractTrechoPauta(conteudo);
    if (pauta) return pauta;
    return extractTrechoFinalCore(conteudo);
  };

  // Núcleo da extração do trecho final (assinatura + intimados),
  // SEM detecção de pauta — usado isoladamente e combinado com cabeçalho de pauta.
  const extractTrechoFinalCore = (conteudo?: string | null): string => {
    if (!conteudo) return "";
    // 1) Normaliza HTML/whitespace e devolve a lista de parágrafos.
    const semHtml = decodeHtmlEntities(String(conteudo)
      .replace(/<br\s*\/?>(?=)/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r\n?/g, "\n"));
    const normalizadoBruto = semHtml
      .split("\n")
      .map((l) => l.replace(/[ \t]+/g, " ").trim())
      .join("\n");
    // 1.a) Remove cabeçalho de metadados que vem prefixado em algumas publicações
    // (Órgão / Data de disponibilização / Tipo de comunicação / Meio / Processo / Parte(s) ... )
    // para evitar duplicação com o cabeçalho do PDF.
    const normalizado = (() => {
      const linhas = normalizadoBruto.split("\n");
      const reLabel = /^(Órg[aã]o|Data de disponibiliza[cç][aã]o|Tipo de comunica[cç][aã]o|Meio|Processo|Parte\(s\)|Intimad[oa]\(s\)|Citad[oa]\(s\))\s*:/i;
      let i = 0;
      let viuLabel = false;
      // Pula linhas iniciais que sejam labels OU continuações curtas (nomes de partes
      // sem rótulo logo após "Parte(s):"). Para na primeira linha "substantiva"
      // (parágrafo longo) ou em marcadores típicos do corpo.
      const reCorpo = /^(PODER\s+JUDICI[ÁA]RIO|TRIBUNAL|JUSTI[ÇC]A|AC[ÓO]RD[ÃA]O|DESPACHO|DECIS[ÃA]O|RELAT[ÓO]RIO|VOTO|EMENTA|INTIMA[ÇC][ÃA]O|Em cumprimento|Ante o exposto|Vistos)/i;
      while (i < linhas.length) {
        const l = linhas[i];
        if (!l) { i++; continue; }
        if (reCorpo.test(l)) break;
        if (reLabel.test(l)) { viuLabel = true; i++; continue; }
        // Nome solto curto (provável continuação de Parte(s)/Intimados): pula.
        if (viuLabel && l.length < 120 && /^[-•\s]*[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]/.test(l)) { i++; continue; }
        break;
      }
      if (i === 0 || !viuLabel) return normalizadoBruto;
      const restante = linhas.slice(i).join("\n").replace(/^\s+/, "");
      // Se sobrou muito pouco, mantém o original para não perder conteúdo.
      return restante.length >= 80 ? restante : normalizadoBruto;
    })();
    let paragrafos = normalizado.split(/\n\s*\n+/).map((b) => b.trim()).filter((b) => b.length > 0);
    if (paragrafos.length <= 1) {
      paragrafos = normalizado.split(/\n+/).map((b) => b.trim()).filter((b) => b.length > 0);
    }
    if (paragrafos.length === 0) return "";

    // 1.b) FALLBACK p/ parágrafo único gigante: corte por marcadores inline.
    // Muitas publicações DJEN vêm como uma só linha com tudo concatenado.
    if (paragrafos.length <= 2 && normalizado.length > 1500) {
      const corte = recortarPorMarcadoresInline(normalizado);
      if (corte) return corte;
    }

    // 2) Detecta assinatura do relator (parágrafo curto com termos típicos).
    const ehAssinaturaRelator = (p: string): boolean => {
      if (!p || p.length > 220) return false;
      return /\b(Relator|Relatora|Ministro|Ministra|Desembargador|Desembargadora|Juiz|Juíza|Ju[ií]z[ao] do Trabalho|Presidente)\b/i.test(p);
    };

    let idxAssinatura = -1;
    for (let i = paragrafos.length - 1; i >= Math.max(0, paragrafos.length - 5); i--) {
      if (ehAssinaturaRelator(paragrafos[i])) { idxAssinatura = i; break; }
    }
    const assinatura = idxAssinatura >= 0 ? paragrafos[idxAssinatura] : "";
    const limiteFim = idxAssinatura >= 0 ? idxAssinatura : paragrafos.length;

    // 3) Procura marcador de ACÓRDÃO.
    const reAcordaoLinha = /^\s*(A\s*C\s*Ó\s*R\s*D\s*Ã\s*O|AC[ÓO]RD[ÃA]O)\s*$/i;
    const reAcordaoInicio = /^(A\s*C\s*Ó\s*R\s*D\s*Ã\s*O|AC[ÓO]RD[ÃA]O)\b/i;
    let idxAcordao = -1;
    for (let i = 0; i < limiteFim; i++) {
      if (reAcordaoLinha.test(paragrafos[i]) || reAcordaoLinha.test((paragrafos[i].split("\n")[0] || ""))) {
        idxAcordao = i; break;
      }
    }
    if (idxAcordao < 0) {
      for (let i = 0; i < limiteFim; i++) {
        if (reAcordaoInicio.test(paragrafos[i])) { idxAcordao = i; break; }
      }
    }

    const reFimEmenta = /^(\s*)(Vistos,?\s+relatados|V\s*O\s*T\s*O\b|RELAT[ÓO]RIO\b)/i;

    let selecionados: string[] = [];
    if (idxAcordao >= 0) {
      let idxFim = limiteFim;
      for (let i = idxAcordao + 1; i < limiteFim; i++) {
        if (reFimEmenta.test(paragrafos[i])) { idxFim = i; break; }
      }
      selecionados = paragrafos.slice(idxAcordao, idxFim);
    } else {
      selecionados = paragrafos.slice(0, limiteFim);
    }

    // 4) Salvaguarda: garantir ao menos 2 parágrafos substantivos.
    const substantivos = selecionados.filter((p) => p.length >= 30 && !ehAssinaturaRelator(p));
    if (substantivos.length < 2) {
      const candidatos = paragrafos.slice(0, limiteFim).filter((p) => p.length >= 30 && !ehAssinaturaRelator(p));
      selecionados = candidatos.slice(-2);
    }

    // 4.b) Trecho muito curto (< 300 chars sem assinatura): inclui parágrafos
    // anteriores até alcançar o mínimo ou esgotar o texto.
    const tamanhoSemAssinatura = () => selecionados.filter(p => !ehAssinaturaRelator(p)).join("\n\n").length;
    while (tamanhoSemAssinatura() < 300 && selecionados.length > 0) {
      const primeiro = selecionados[0];
      const idxPrimeiro = paragrafos.indexOf(primeiro);
      if (idxPrimeiro <= 0) break;
      const anterior = paragrafos[idxPrimeiro - 1];
      if (!anterior || ehAssinaturaRelator(anterior)) break;
      selecionados = [anterior, ...selecionados];
    }

    if (assinatura) selecionados = [...selecionados, assinatura];
    return selecionados.join("\n\n").trim();
  };

  // Recorta o texto a partir do ÚLTIMO marcador de dispositivo/intimação encontrado.
  // Útil quando a publicação inteira veio como um único parágrafo concatenado.
  const recortarPorMarcadoresInline = (texto: string): string => {
    if (!texto) return "";
    const marcadores: RegExp[] = [
      /A\s*C\s*Ó\s*R\s*D\s*Ã\s*O\b/gi,
      /D\s*E\s*S\s*P\s*A\s*C\s*H\s*O\b/gi,
      /D\s*E\s*C\s*I\s*S\s*Ã\s*O\b/gi,
      /\bISTO\s+POSTO\s+ACORDAM\b/gi,
      /\bACORDAM\s+os\s+Ministros\b/gi,
      /\bINTIMAÇÃO\b/gi,
      /\bEm\s+cumprimento\s+ao\s+(art\.|disposto)/gi,
      /\bFica(?:m)?\s+(?:V\.?\s*Sa\.?\s+)?intimad[oa]s?/gi,
      /\bAnte\s+o\s+exposto\b/gi,
      /\bIsso\s+posto\b/gi,
    ];
    let melhorIdx = -1;
    for (const re of marcadores) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(texto)) !== null) {
        // Exige pelo menos 150 chars de conteúdo após o marcador
        if (texto.length - m.index >= 150 && m.index > melhorIdx) melhorIdx = m.index;
      }
    }
    if (melhorIdx < 0) {
      // sem marcador: pega os últimos ~2000 chars
      melhorIdx = Math.max(0, texto.length - 2000);
      const nl = texto.indexOf("\n", melhorIdx);
      if (nl > -1 && nl - melhorIdx < 300) melhorIdx = nl + 1;
    }
    return texto.slice(melhorIdx).trim();
  };


  const [gerandoResumoSemIA, setGerandoResumoSemIA] = useState(false);
  const [gerandoDocResumoSemIA, setGerandoDocResumoSemIA] = useState(false);
  const [gerandoDocResumoIntimacao, setGerandoDocResumoIntimacao] = useState(false);
  const [gerandoResumoSemRepeticao, setGerandoResumoSemRepeticao] = useState(false);
  const [gerandoDocResumoSemRepeticao, setGerandoDocResumoSemRepeticao] = useState(false);

  // ===== Extrator "Resumo sem IA" =====
  // - Pauta de Julgamento: retorna o conteúdo na íntegra (apenas limpa HTML).
  // - Demais publicações: lê do fim para o começo, separa o bloco final
  //   (assinatura do relator + intimados/citados) — que é SEMPRE preservado
  //   e exibido — e devolve os ÚLTIMOS 2 parágrafos substantivos antes desse
  //   bloco. Se a soma desses 2 parágrafos tiver < 300 caracteres, inclui o
  //   3º parágrafo anterior.
  const extractResumoSemIA = (pub: any): string => {
    const conteudo = String(pub?.conteudo || "");
    if (!conteudo) return "";

    const limparHtml = (s: string) => s
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*p\s*>/gi, "\n\n")
      .replace(/<\/\s*div\s*>/gi, "\n\n")
      .replace(/<\/\s*li\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r\n?/g, "\n")
      .split("\n").map(l => l.replace(/[ \t]+/g, " ").trim()).join("\n")
      .replace(/\n{3,}/g, "\n\n").trim();
    const limparHtmlDecoded = (s: string) => decodeHtmlEntities(limparHtml(s));

    // Pauta: íntegra
    if (isPautaDeJulgamento(conteudo)) {
      return limparHtmlDecoded(conteudo);
    }

    const normalizado = limparHtmlDecoded(conteudo);

    // ===== INDEXAÇÃO =====
    // 1) Quebra inicial por blocos
    let paragrafos = normalizado.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
    if (paragrafos.length <= 1) {
      paragrafos = normalizado.split(/\n+/).map(p => p.trim()).filter(Boolean);
    }

    // 2) Marcadores estruturais comuns em decisões/despachos — força quebra antes deles
    const marcadores = /(?=(?:^|\s)(?:VISTOS|Vistos|Trata-se|Cuida-se|RELAT[ÓO]RIO|Relat[óo]rio|FUNDAMENTA[ÇC][ÃA]O|Fundamenta[çc][ãa]o|DECIS[ÃA]O|Decis[ãa]o|DISPOSITIVO|Dispositivo|Decido|DECIDO|Posto isso|Ante o exposto|Diante do exposto|Isso posto|Isto posto|Por tais raz[õo]es|Em face do exposto|Pelo exposto|Defiro|Indefiro|Conhe[çc]o|N[ãa]o conhe[çc]o|D[ÊE]-SE|Intime-se|Cite-se|Publique-se|Notifique-se|Cumpra-se|Encaminhe-se|Arquive-se|Conclus[ãa]o|Senten[çc]a|Ac[óo]rd[ãa]o)\b)/g;
    const reindexar = (lista: string[]): string[] => {
      const out: string[] = [];
      for (const p of lista) {
        if (p.length < 400) { out.push(p); continue; }
        const partes = p.split(marcadores).map(x => x.trim()).filter(Boolean);
        if (partes.length > 1) out.push(...partes);
        else out.push(p);
      }
      return out;
    };
    paragrafos = reindexar(paragrafos);

    // 3) Se ainda houver parágrafos muito longos (>800 chars), quebra por sentenças
    //    agrupando sentenças em blocos ~3-4 frases para virar "parágrafos lógicos".
    const splitSentencas = (texto: string): string[] => {
      const frases = texto
        .split(/(?<=[\.\?!])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“(\[])/g)
        .map(s => s.trim()).filter(Boolean);
      if (frases.length <= 1) return [texto];
      const blocos: string[] = [];
      const tamanhoAlvo = 350;
      let buf = "";
      for (const f of frases) {
        if (!buf) { buf = f; continue; }
        if ((buf + " " + f).length > tamanhoAlvo) { blocos.push(buf); buf = f; }
        else buf = buf + " " + f;
      }
      if (buf) blocos.push(buf);
      return blocos;
    };
    const finos: string[] = [];
    for (const p of paragrafos) {
      if (p.length > 800) finos.push(...splitSentencas(p));
      else finos.push(p);
    }
    paragrafos = finos.map(p => p.trim()).filter(Boolean);

    if (paragrafos.length === 0) return "";

    const ehAssinaturaForte = (p: string) => !!p && p.length <= 240
      && /\b(Relator|Relatora|Ministro|Ministra|Desembargador|Desembargadora|Juiz|Juíza|Ju[ií]z[ao] do Trabalho|Presidente|Secret[áa]ri[ao])\b/i.test(p);
    // "Fraco": linhas típicas do bloco de assinatura — só contam quando já vimos uma assinatura forte logo depois.
    const ehAssinaturaFraco = (p: string) => {
      if (!p || p.length > 200) return false;
      if (/^Bras[íi]lia\s*,?\s*\d/i.test(p)) return true; // "Brasília, 7 de maio de 2026."
      if (/Firmado por assinatura digital/i.test(p)) return true;
      if (/MP\s*2\.?200-?2\s*\/\s*2001/i.test(p)) return true;
      // Linha em CAIXA-ALTA (nome do assinante)
      if (p.length <= 120 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ \-\.&'/()]+$/.test(p)) return true;
      return false;
    };
    const ehAssinatura = (p: string) => ehAssinaturaForte(p) || ehAssinaturaFraco(p);
    const ehHeaderIntimados = (p: string) => /Intimad[oa]\(s\)\s*\/\s*Citad[oa]\(s\)/i.test(p)
      || /^Intimad[oa]s?\s*[:\-]/i.test(p)
      || /^Citad[oa]s?\s*[:\-]/i.test(p);
    const ehItemLista = (p: string) => /^[-•]\s*\S/.test(p)
      || (p.length < 200 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 \-\.&'/()]*$/.test(p));

    // Caminha do fim para o começo, separando o bloco final (assinatura + intimados).
    const trailing: string[] = [];
    let i = paragrafos.length - 1;
    let viuIntim = false;
    let viuAssin = false;
    while (i >= 0) {
      const p = paragrafos[i];
      if (ehAssinaturaForte(p)) { trailing.unshift(p); viuAssin = true; i--; continue; }
      if (ehAssinaturaFraco(p)) { trailing.unshift(p); i--; continue; }
      if (ehHeaderIntimados(p)) { trailing.unshift(p); viuIntim = true; i--; continue; }
      if (viuIntim && ehItemLista(p)) { trailing.unshift(p); i--; continue; }
      if (!viuAssin && !viuIntim && trailing.length === 0 && ehItemLista(p) && p.length < 120) {
        // Itens curtos no fim (lista de intimados sem header explícito)
        trailing.unshift(p); i--; continue;
      }
      break;
    }

    const principais = paragrafos.slice(0, i + 1);
    if (principais.length === 0) {
      // Sem parágrafos "substantivos" — devolve só o bloco final preservado
      return trailing.join("\n\n").trim();
    }

    // Garante mínimo de caracteres reais no resumo (excluindo assinatura/intimados).
    // Vai expandindo o número de parágrafos até atingir 300 chars (ou esgotar).
    let n = Math.min(2, principais.length);
    let ultimos = principais.slice(-n);
    while (ultimos.join("\n\n").length < 300 && n < principais.length) {
      n++;
      ultimos = principais.slice(-n);
    }
    // Se mesmo somando todos os principais ficou muito curto (<150) e ainda há
    // texto, devolve tudo que sobrou — evita resumos com 2 frases triviais.
    if (ultimos.join("\n\n").length < 150 && principais.length > 0) {
      ultimos = principais.slice();
    }

    // Regra ACORDAM: se algum dos parágrafos selecionados contiver "ACORDAM",
    // incluir mais um parágrafo anterior (geralmente é o "ISTO POSTO/ANTE O EXPOSTO"
    // que precede o dispositivo do acórdão).
    if (/\bACORDAM\b/i.test(ultimos.join("\n")) && ultimos.length < principais.length) {
      n = Math.min(n + 1, principais.length);
      ultimos = principais.slice(-n);
    }

    // Regra EDITAL: em publicações que começam com um EDITAL (ex.: "EDITAL DE
    // CANCELAMENTO", "EDITAL DE INTIMAÇÃO", "EDITAL DE PAUTA"), a informação
    // essencial está no INÍCIO do texto. Nesses casos, preserva o começo
    // original junto com o trecho final.
    const inicioTexto = normalizado.slice(0, 300);
    const ehEdital = /EDITAL\s+DE\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(inicioTexto) || /^\s*EDITAL\b/i.test(inicioTexto);
    if (ehEdital) {
      const cabecalho: string[] = [];
      for (const p of principais) {
        if (ultimos.includes(p)) break;
        cabecalho.push(p);
        if (cabecalho.join("\n\n").length >= 1200) break;
      }
      if (cabecalho.length > 0) {
        return [...cabecalho, ...ultimos.filter(p => !cabecalho.includes(p)), ...trailing].join("\n\n").trim();
      }
    }

    return [...ultimos, ...trailing].join("\n\n").trim();
  };

  // allExpanded computed below after allPublicacoes is defined

  const toggleExpandAll = () => {
    const isAllExpanded = allPublicacoes.length > 0 && expandedPublicacoes.size >= allPublicacoes.length;
    if (isAllExpanded) {
      setExpandedPublicacoes(new Set());
      setExpandirGeralAtivo(false);
    } else {
      setExpandedPublicacoes(new Set(allPublicacoes.map(p => p.id)));
    }
  };

  const toggleExpandirGeral = () => {
    if (expandirGeralAtivo) {
      setExpandirGeralAtivo(false);
      setExpandedPublicacoes(new Set());
    } else {
      setExpandirGeralAtivo(true);
      setExpandedPublicacoes(new Set(allPublicacoes.map(p => p.id)));
    }
  };

  /** Remove caracteres de controle ilegais em XML (causa erro no Word) */
  const sanitizeForXml = (text: string | null | undefined): string => {
    if (!text) return "";
    // Remove caracteres de controle XML ilegais (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F exceto tab/newline/cr)
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  };

  const docFont = "Calibri";
  const docFontSize = 22; // 11pt
  const darkBlue = "1E3A5F";
  const mediumBlue = "2B5A8C";
  const lightGray = "F2F2F2";
  const borderGray = "CCCCCC";

  /** Cria cabeçalho profissional do DOCX (mesmo estilo do PDF: faixa azul-escuro) */
  const buildDocHeader = (subtitle: string, total: number): Paragraph[] => {
    return [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 0, line: 300 },
        shading: { type: ShadingType.SOLID, color: darkBlue, fill: darkBlue },
        children: [
          new TextRun({ text: "  ⚖  ", font: "Segoe UI Emoji", size: 32, color: "FFFFFF" }),
          new TextRun({ text: "Sistema Juris Control", bold: true, size: 32, color: "FFFFFF", font: docFont }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 0, line: 276 },
        shading: { type: ShadingType.SOLID, color: darkBlue, fill: darkBlue },
        children: [
          new TextRun({ text: `      ${subtitle}`, size: 20, color: "FFFFFF", font: docFont }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 80, line: 276 },
        shading: { type: ShadingType.SOLID, color: darkBlue, fill: darkBlue },
        children: [
          new TextRun({ text: `      Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}  •  Total: ${total}`, size: 18, color: "B0C4DE", font: docFont, italics: true }),
        ],
      }),
      new Paragraph({ text: "", spacing: { after: 300 } }),
    ];
  };

  /** Cria bloco de metadados estilizado para cada publicação */
  const buildPubMetadata = (pub: any, idx: number, orgaoExtra?: string | null): Paragraph[] => {
    const paragraphs: Paragraph[] = [];

    paragraphs.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 360, after: 120 },
      shading: { type: ShadingType.SOLID, color: mediumBlue, fill: mediumBlue },
      children: [
        new TextRun({ text: `  ${idx + 1}. `, bold: true, size: 24, color: "FFFFFF", font: docFont }),
        new TextRun({ text: `PROCESSO ${formatProcessoNumero(pub.processo_numero)}`, bold: true, size: 24, color: "FFFFFF", font: docFont }),
      ],
    }));

    const metaItems: TextRun[] = [];
    const turmaRaw = orgaoExtra || (pub.orgao && pub.orgao !== pub.tribunal ? pub.orgao : null);
    const turma = turmaRaw ? shortenTurma(turmaRaw) : null;
    const orgaoLabel = pub.tribunal || pub.orgao;
    if (orgaoLabel) {
      metaItems.push(new TextRun({ text: "Órgão: ", bold: true, size: docFontSize, font: docFont, color: "333333" }));
      metaItems.push(new TextRun({ text: sanitizeForXml(orgaoLabel) + "   ", size: docFontSize, font: docFont, color: "555555" }));
    }
    if (turma) {
      metaItems.push(new TextRun({ text: "Turma: ", bold: true, size: docFontSize, font: docFont, color: "333333" }));
      metaItems.push(new TextRun({ text: sanitizeForXml(turma) + "   ", size: docFontSize, font: docFont, color: "555555" }));
    }
    if (pub.data_disponibilizacao) {
      metaItems.push(new TextRun({ text: "Data: ", bold: true, size: docFontSize, font: docFont, color: "333333" }));
      metaItems.push(new TextRun({ text: formatDateOnlyFull(pub.data_disponibilizacao) + "   ", size: docFontSize, font: docFont, color: "555555" }));
    }
    metaItems.push(new TextRun({ text: "Tipo: ", bold: true, size: docFontSize, font: docFont, color: "333333" }));
    metaItems.push(new TextRun({ text: sanitizeForXml(pub.tipo_comunicacao) || "Intimação", size: docFontSize, font: docFont, color: "555555" }));

    if (metaItems.length > 0) {
      paragraphs.push(new Paragraph({
        spacing: { after: 80 },
        shading: { type: ShadingType.SOLID, color: lightGray, fill: lightGray },
        children: [new TextRun({ text: "  ", size: docFontSize }), ...metaItems],
      }));
    }

    return paragraphs;
  };

  /** Cria seção de partes e advogados */
  const buildPartesAdvogados = (pub: any): Paragraph[] => {
    const paragraphs: Paragraph[] = [];
    const { partes, advogados } = getPartesEAdvogadosParaExibicao(pub.partes_json, pub.advogados_json, pub.conteudo, pub.polo_ativo, pub.polo_passivo);

    if (partes.length > 0) {
      paragraphs.push(new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [new TextRun({ text: "PARTES", bold: true, size: 20, font: docFont, color: mediumBlue })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: borderGray } },
      }));
      partes.forEach(p => {
        const color = getParteIconColor(p);
        const colorHex = color === "green" ? "16A34A" : color === "red" ? "DC2626" : "334155";
        paragraphs.push(new Paragraph({
          spacing: { after: 40 },
          indent: { left: 360 },
          children: [
            new TextRun({ text: "●  ", color: colorHex, bold: true, size: docFontSize, font: docFont }),
            new TextRun({ text: sanitizeForXml(cleanParteName(p)), size: docFontSize, font: docFont }),
          ],
        }));
      });
    }

    if (advogados.length > 0) {
      paragraphs.push(new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [new TextRun({ text: "ADVOGADOS", bold: true, size: 20, font: docFont, color: mediumBlue })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: borderGray } },
      }));
      advogados.forEach(a => {
        paragraphs.push(new Paragraph({
          spacing: { after: 40 },
          indent: { left: 360 },
          children: [
            new TextRun({ text: "●  ", color: "334155", bold: true, size: docFontSize, font: docFont }),
            new TextRun({ text: sanitizeForXml(a), size: docFontSize, font: docFont }),
          ],
        }));
      });
    }

    return paragraphs;
  };

  /** Formata conteúdo em parágrafos separados por quebras de linha */
  const buildConteudoParagraphs = (rawHtml: string, label: string): Paragraph[] => {
    const paragraphs: Paragraph[] = [];

    if (label) {
      paragraphs.push(new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: label, bold: true, size: 20, font: docFont, color: mediumBlue })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: borderGray } },
      }));
    }

    const cleanText = sanitizeForXml(formatConteudoParaExibicao(rawHtml, true));
    const lines = cleanText.split(/\n+/).filter(l => l.trim());

    lines.forEach(line => {
      paragraphs.push(new Paragraph({
        spacing: { after: 80, line: 276 },
        indent: { left: 180 },
        children: [new TextRun({ text: line.trim(), size: docFontSize, font: docFont, color: "333333" })],
      }));
    });

    paragraphs.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    return paragraphs;
  };

  /** Bloco de comentários da coordenação (DOCX) */
  const buildComentariosParagraphs = (
    comentarios: Array<{ autor: string; comentario: string; created_at: string }> | undefined
  ): Paragraph[] => {
    if (!comentarios || comentarios.length === 0) return [];
    const paragraphs: Paragraph[] = [];
    paragraphs.push(new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: `COMENTÁRIOS DA COORDENAÇÃO (${comentarios.length})`, bold: true, size: 20, font: docFont, color: mediumBlue })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: borderGray } },
    }));
    comentarios.forEach((c) => {
      const dataFmt = (() => {
        try { return format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return ""; }
      })();
      paragraphs.push(new Paragraph({
        spacing: { before: 80, after: 20 },
        indent: { left: 180 },
        children: [
          new TextRun({ text: `${sanitizeForXml(c.autor)} `, bold: true, size: docFontSize, font: docFont, color: "1E3A5F" }),
          new TextRun({ text: `(${dataFmt})`, size: 18, font: docFont, color: "888888", italics: true }),
        ],
      }));
      const linhas = sanitizeForXml(c.comentario).split(/\n+/).filter(l => l.trim());
      linhas.forEach((line) => {
        paragraphs.push(new Paragraph({
          spacing: { after: 40, line: 276 },
          indent: { left: 360 },
          children: [new TextRun({ text: line.trim(), size: docFontSize, font: docFont, color: "333333" })],
        }));
      });
    });
    paragraphs.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    return paragraphs;
  };

  // ===== "Gerar Doc" - DOCX (plain text sem IA) =====
  const handleGerarDoc = async () => {
    const allPublicacoes = getPubsParaGerar();
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    try {
      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      const children: Paragraph[] = [...buildDocHeader(`Relatório de Publicações ${origemLabel}`, allPublicacoes.length)];

      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));
      allPublicacoes.forEach((pub, idx) => {
        children.push(...buildPubMetadata(pub, idx));
        children.push(...buildPartesAdvogados(pub));
        children.push(...buildConteudoParagraphs(pub.conteudo || "Sem conteúdo", "CONTEÚDO INTEGRAL"));
        children.push(...buildComentariosParagraphs(comentariosMap.get(pub.id)));
      });

      const doc = new Document({
        styles: {
          default: {
            document: {
              run: { font: docFont, size: docFontSize },
            },
          },
        },
        sections: [{
          properties: {
            page: {
              margin: { top: 720, bottom: 720, left: 1080, right: 1080 },
            },
          },
          children,
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `publicacoes_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Documento Word gerado com sucesso!");
    } catch (err: any) {
      toast.error(`Erro ao gerar documento: ${err.message}`);
    }
  };

  // ===== "Gerar PDF Resumo sem IA" — pauta na íntegra; demais: últimos 2 (ou 3) parágrafos + assinatura/intimados =====
  const handleGerarPdfResumoSemIA = async () => {
    const allPublicacoes = getPubsParaGerar();
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    setGerandoResumoSemIA(true);
    const toastId = toast.loading("Gerando PDF Resumo sem IA...");
    try {
      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const mL = 15;
      const mR = 15;
      const maxW = pageW - mL - mR;
      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      drawPdfHeader(doc, pageW, `Resumo sem IA de Publicações ${origemLabel}`);
      let y = 34;
      const checkPage = (need: number) => { if (y + need > 280) { doc.addPage(); y = 20; } };

      const dataDisp = allPublicacoes[0]?.data_disponibilizacao;
      if (dataDisp) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(`Data de disponibilização: ${formatDateOnlyFull(dataDisp)}`, mL, y);
        y += 10;
      }

      allPublicacoes.forEach((pub, idx) => {
        if (idx > 0) {
          checkPage(14);
          y += 4;
          doc.setDrawColor(30, 58, 95);
          doc.setLineWidth(0.8);
          doc.line(mL, y, pageW - mR, y);
          y += 10;
        }

        checkPage(60);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(`COMUNICAÇÃO PJE #${formatProcessoNumero(pub.processo_numero)}`, mL, y);
        y += 8;

        doc.setFontSize(10);
        const labelW = 52;
        const tableX = mL;
        const tableW = pageW - mR - mL;
        const rowH = 6;
        const addRow = (label: string, value: string) => {
          doc.setFont("helvetica", "bold");
          doc.text(label, tableX, y);
          doc.setFont("helvetica", "normal");
          const valLines = doc.splitTextToSize(value, tableW - labelW - 4);
          valLines.forEach((l: string, i: number) => {
            doc.text(l, tableX + labelW, y + i * 5);
          });
          y += Math.max(rowH, valLines.length * 5);
        };

        addRow("Processo", formatProcessoNumero(pub.processo_numero) || "—");
        addRow("Órgão", pub.tribunal || pub.orgao || "—");
        if (pub.orgao && pub.orgao !== pub.tribunal) addRow("Turma", shortenTurma(pub.orgao));
        addRow("Data de disponibilização", pub.data_disponibilizacao ? formatDateOnlyFull(pub.data_disponibilizacao) : "—");
        addRow("Tipo de Comunicação", pub.tipo_comunicacao || "Intimação");

        const { partes, advogados } = getPartesEAdvogadosParaExibicao(
          pub.partes_json, pub.advogados_json, pub.conteudo, pub.polo_ativo, pub.polo_passivo
        );

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Parte(s):", mL, y);
        y += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        if (partes.length > 0) {
          checkPage(10 + partes.length * 5);
          partes.forEach(p => {
            checkPage(5);
            const iconColor = getParteIconColor(p);
            const nome = cleanParteName(p);
            drawPersonIcon(doc, mL, y, iconColor);
            const linhas = doc.splitTextToSize(nome, maxW - 8);
            linhas.forEach((l: string) => { doc.text(l, mL + 6, y); y += 5; });
          });
        } else {
          doc.text("—", mL, y); y += 5;
        }
        y += 2;

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Advogado(s):", mL, y);
        y += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        if (advogados.length > 0) {
          checkPage(10 + advogados.length * 5);
          advogados.forEach(a => {
            checkPage(5);
            drawPersonIcon(doc, mL, y, 'black');
            const linhas = doc.splitTextToSize(a, maxW - 8);
            linhas.forEach((l: string) => { doc.text(l, mL + 6, y); y += 5; });
          });
        } else {
          doc.text("—", mL, y); y += 5;
        }
        y += 2;

        const ehPauta = isPautaDeJulgamento(pub.conteudo);
        const trecho = extractResumoSemIA(pub);
        if (trecho) {
          y += 4;
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          const ehCejusc = /\bCEJUSC\b/i.test(String(pub.conteudo || "").replace(/<[^>]+>/g, " "));
          if (ehCejusc) {
            // CEJUSC: sem cabeçalho, apenas a publicação na íntegra
            y -= 4;
          } else {
            doc.text(
              ehPauta
                ? "Pauta de julgamento (íntegra):"
                : "Resumo (últimos parágrafos + assinatura/intimados):",
              mL,
              y,
            );
            y += 6;
          }
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          const paragrafos = trecho.split(/\n+/).map((p) => p.trim()).filter(Boolean);
          paragrafos.forEach((bloco) => {
            doc.splitTextToSize(bloco, maxW).forEach((line: string) => {
              checkPage(5);
              doc.text(line, mL, y);
              y += 5;
            });
            y += 2;
          });
          y += 2;
        }

        const coms = comentariosMap.get(pub.id);
        if (coms && coms.length > 0) {
          y += 2;
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 58, 95);
          checkPage(8);
          doc.text(`Comentários da coordenação (${coms.length}):`, mL, y);
          y += 6;
          doc.setTextColor(0, 0, 0);
          coms.forEach((c) => {
            const dataFmt = (() => { try { return format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return ""; } })();
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            checkPage(5);
            doc.text(`${c.autor} (${dataFmt})`, mL, y);
            y += 5;
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(c.comentario, maxW - 4);
            lines.forEach((l: string) => { checkPage(5); doc.text(l, mL + 4, y); y += 5; });
            y += 2;
          });
        }

        y += 6;
      });

      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
        doc.text(`Juris Control – Página ${i}/${total}`, pageW / 2, 292, { align: "center" });
      }

      doc.save(`resumo_sem_ia_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`);
      toast.success("PDF Resumo sem IA gerado!", { id: toastId });
    } catch (error: any) {
      console.error("Erro ao gerar PDF Resumo sem IA:", error);
      toast.error(`Erro ao gerar PDF Resumo sem IA: ${error?.message || ""}`, { id: toastId });
    } finally {
      setGerandoResumoSemIA(false);
    }
  };

  // ===== Dedup: remove publicações com mesmo processo + conteúdo idêntico
  // (ignorando o bloco final "Destinatário(s): ..."). Mantém a de maior
  // conteúdo, preservando a ordem original.
  const dedupPubsPorProcessoSemDestinatarios = <T extends { processo_numero?: string | null; conteudo?: string | null }>(
    pubs: T[]
  ): T[] => {
    const normalize = (s: string) =>
      stripDestinatarios(s)
        .replace(/<[^>]*>/g, " ")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const bestIdxByKey = new Map<string, number>();
    const keep = new Array<boolean>(pubs.length).fill(false);
    pubs.forEach((p, i) => {
      const digits = String(p.processo_numero || "").replace(/\D/g, "");
      if (!digits) { keep[i] = true; return; }
      const norm = normalize(String(p.conteudo || ""));
      // Usa um prefixo do conteúdo normalizado para tolerar pequenas
      // variações no final (nomes adicionais, ordem de advogados, etc.)
      const head = norm.slice(0, 400);
      const key = `${digits}|${head}`;
      const prev = bestIdxByKey.get(key);
      if (prev === undefined) {
        bestIdxByKey.set(key, i);
      } else {
        const prevLen = (pubs[prev].conteudo || "").length;
        const curLen = (p.conteudo || "").length;
        if (curLen > prevLen) bestIdxByKey.set(key, i);
      }
    });
    bestIdxByKey.forEach((i) => { keep[i] = true; });
    return pubs.filter((_, i) => keep[i]);
  };

  // ===== "Resumo PDF sem repetição" — mesmo fluxo do "Resumo sem IA",
  // mas descartando publicações duplicadas para o mesmo processo
  // (que diferem só no bloco "Destinatário(s): ..."). =====
  const handleGerarPdfResumoSemRepeticao = async () => {
    const rawPubs = getPubsParaGerar();
    if (rawPubs.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    const allPublicacoes = dedupPubsPorProcessoSemDestinatarios(rawPubs);
    const removidas = rawPubs.length - allPublicacoes.length;
    setGerandoResumoSemRepeticao(true);
    const toastId = toast.loading(
      removidas > 0
        ? `Gerando PDF Resumo sem repetição (${removidas} duplicada(s) ignorada(s))...`
        : "Gerando PDF Resumo sem repetição..."
    );
    try {
      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const mL = 15;
      const mR = 15;
      const maxW = pageW - mL - mR;
      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      drawPdfHeader(doc, pageW, `Resumo (sem repetição) de Publicações ${origemLabel}`);
      let y = 34;
      const checkPage = (need: number) => { if (y + need > 280) { doc.addPage(); y = 20; } };

      const dataDisp = allPublicacoes[0]?.data_disponibilizacao;
      if (dataDisp) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(`Data de disponibilização: ${formatDateOnlyFull(dataDisp)}`, mL, y);
        y += 10;
      }

      allPublicacoes.forEach((pub, idx) => {
        if (idx > 0) {
          checkPage(14);
          y += 4;
          doc.setDrawColor(30, 58, 95);
          doc.setLineWidth(0.8);
          doc.line(mL, y, pageW - mR, y);
          y += 10;
        }

        checkPage(60);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(`COMUNICAÇÃO PJE #${formatProcessoNumero(pub.processo_numero)}`, mL, y);
        y += 8;

        doc.setFontSize(10);
        const labelW = 52;
        const tableX = mL;
        const tableW = pageW - mR - mL;
        const rowH = 6;
        const addRow = (label: string, value: string) => {
          doc.setFont("helvetica", "bold");
          doc.text(label, tableX, y);
          doc.setFont("helvetica", "normal");
          const valLines = doc.splitTextToSize(value, tableW - labelW - 4);
          valLines.forEach((l: string, i: number) => {
            doc.text(l, tableX + labelW, y + i * 5);
          });
          y += Math.max(rowH, valLines.length * 5);
        };

        addRow("Processo", formatProcessoNumero(pub.processo_numero) || "—");
        addRow("Órgão", pub.tribunal || pub.orgao || "—");
        if (pub.orgao && pub.orgao !== pub.tribunal) addRow("Turma", shortenTurma(pub.orgao));
        addRow("Data de disponibilização", pub.data_disponibilizacao ? formatDateOnlyFull(pub.data_disponibilizacao) : "—");
        addRow("Tipo de Comunicação", pub.tipo_comunicacao || "Intimação");

        const { partes, advogados } = getPartesEAdvogadosParaExibicao(
          pub.partes_json, pub.advogados_json, pub.conteudo, pub.polo_ativo, pub.polo_passivo
        );

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Parte(s):", mL, y);
        y += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        if (partes.length > 0) {
          checkPage(10 + partes.length * 5);
          partes.forEach(p => {
            checkPage(5);
            const iconColor = getParteIconColor(p);
            const nome = cleanParteName(p);
            drawPersonIcon(doc, mL, y, iconColor);
            const linhas = doc.splitTextToSize(nome, maxW - 8);
            linhas.forEach((l: string) => { doc.text(l, mL + 6, y); y += 5; });
          });
        } else {
          doc.text("—", mL, y); y += 5;
        }
        y += 2;

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Advogado(s):", mL, y);
        y += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        if (advogados.length > 0) {
          checkPage(10 + advogados.length * 5);
          advogados.forEach(a => {
            checkPage(5);
            drawPersonIcon(doc, mL, y, 'black');
            const linhas = doc.splitTextToSize(a, maxW - 8);
            linhas.forEach((l: string) => { doc.text(l, mL + 6, y); y += 5; });
          });
        } else {
          doc.text("—", mL, y); y += 5;
        }
        y += 2;

        const ehPauta = isPautaDeJulgamento(pub.conteudo);
        const trecho = extractResumoSemIA(pub);
        if (trecho) {
          y += 4;
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          const ehCejusc = /\bCEJUSC\b/i.test(String(pub.conteudo || "").replace(/<[^>]+>/g, " "));
          if (ehCejusc) {
            y -= 4;
          } else {
            doc.text(
              ehPauta
                ? "Pauta de julgamento (íntegra):"
                : "Resumo (últimos parágrafos + assinatura/intimados):",
              mL,
              y,
            );
            y += 6;
          }
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          const paragrafos = trecho.split(/\n+/).map((p) => p.trim()).filter(Boolean);
          paragrafos.forEach((bloco) => {
            doc.splitTextToSize(bloco, maxW).forEach((line: string) => {
              checkPage(5);
              doc.text(line, mL, y);
              y += 5;
            });
            y += 2;
          });
          y += 2;
        }

        const coms = comentariosMap.get(pub.id);
        if (coms && coms.length > 0) {
          y += 2;
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 58, 95);
          checkPage(8);
          doc.text(`Comentários da coordenação (${coms.length}):`, mL, y);
          y += 6;
          doc.setTextColor(0, 0, 0);
          coms.forEach((c) => {
            const dataFmt = (() => { try { return format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return ""; } })();
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            checkPage(5);
            doc.text(`${c.autor} (${dataFmt})`, mL, y);
            y += 5;
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(c.comentario, maxW - 4);
            lines.forEach((l: string) => { checkPage(5); doc.text(l, mL + 4, y); y += 5; });
            y += 2;
          });
        }

        y += 6;
      });

      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
        doc.text(`Juris Control – Página ${i}/${total}`, pageW / 2, 292, { align: "center" });
      }

      doc.save(`resumo_sem_repeticao_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`);
      toast.success(
        removidas > 0
          ? `PDF Resumo sem repetição gerado! (${removidas} duplicada(s) ignorada(s))`
          : "PDF Resumo sem repetição gerado!",
        { id: toastId }
      );
    } catch (error: any) {
      console.error("Erro ao gerar PDF Resumo sem repetição:", error);
      toast.error(`Erro ao gerar PDF Resumo sem repetição: ${error?.message || ""}`, { id: toastId });
    } finally {
      setGerandoResumoSemRepeticao(false);
    }
  };

  // ===== "Gerar Doc Resumo sem IA" =====
  const handleGerarDocResumoSemIA = async () => {
    const allPublicacoes = getPubsParaGerar();
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    setGerandoDocResumoSemIA(true);
    const toastId = toast.loading("Gerando Doc Resumo sem IA...");
    try {
      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      const children: Paragraph[] = [...buildDocHeader(`Resumo sem IA de Publicações ${origemLabel}`, allPublicacoes.length)];
      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));

      allPublicacoes.forEach((pub, idx) => {
        children.push(...buildPubMetadata(pub, idx));
        children.push(...buildPartesAdvogados(pub));
        const ehPauta = isPautaDeJulgamento(pub.conteudo);
        const trecho = extractResumoSemIA(pub);
        const ehCejusc = /\bCEJUSC\b/i.test(String(pub.conteudo || "").replace(/<[^>]+>/g, " "));
        children.push(...buildConteudoParagraphs(
          trecho || "Sem conteúdo disponível",
          ehCejusc
            ? ""
            : ehPauta
              ? "PAUTA DE JULGAMENTO (ÍNTEGRA)"
              : "RESUMO (ÚLTIMOS PARÁGRAFOS + ASSINATURA/INTIMADOS)"
        ));
        children.push(...buildComentariosParagraphs(comentariosMap.get(pub.id)));
      });

      const doc = new Document({
        styles: { default: { document: { run: { font: docFont, size: docFontSize } } } },
        sections: [{
          properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } },
          children,
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumo_sem_ia_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Doc Resumo sem IA gerado!", { id: toastId });
    } catch (err: any) {
      console.error("Erro ao gerar Doc Resumo sem IA:", err);
      toast.error(`Erro ao gerar Doc Resumo sem IA: ${err?.message || ""}`, { id: toastId });
    } finally {
      setGerandoDocResumoSemIA(false);
    }
  };

  // ===== "Gerar Doc Resumo sem repetição" — mesmo fluxo do Doc Resumo sem IA,
  // ===== "Doc Resumo Intimação" — mesma lógica do Doc Resumo, excluindo as
  // publicações classificadas como Lista de Distribuição (mesma regra do Docs TST).
  const handleGerarDocResumoIntimacao = async () => {
    const rawPubs = getPubsParaGerar();
    if (rawPubs.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    const ehListaDistribuicao = (pub: any) => {
      const tipoCom = (pub?.tipo_comunicacao || "").toString().toLowerCase();
      if (tipoCom.includes("lista de distribui")) return true;
      const texto = stripHtmlAndDecodeEntities(pub?.conteudo)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return texto.includes("lista de distribuicao");
    };
    const allPublicacoes = rawPubs.filter((p) => !ehListaDistribuicao(p));
    const removidas = rawPubs.length - allPublicacoes.length;
    if (allPublicacoes.length === 0) {
      toast.error("Todas as publicações são Lista de Distribuição — nada a exportar");
      return;
    }
    setGerandoDocResumoIntimacao(true);
    const toastId = toast.loading(
      removidas > 0
        ? `Gerando Doc Resumo Intimação (${removidas} lista(s) de distribuição excluída(s))...`
        : "Gerando Doc Resumo Intimação..."
    );
    try {
      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      const children: Paragraph[] = [...buildDocHeader(`Resumo de Intimações ${origemLabel} (sem Lista de Distribuição)`, allPublicacoes.length)];
      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));

      allPublicacoes.forEach((pub, idx) => {
        children.push(...buildPubMetadata(pub, idx));
        children.push(...buildPartesAdvogados(pub));
        const ehPauta = isPautaDeJulgamento(pub.conteudo);
        const trecho = extractResumoSemIA(pub);
        const ehCejusc = /\bCEJUSC\b/i.test(String(pub.conteudo || "").replace(/<[^>]+>/g, " "));
        children.push(...buildConteudoParagraphs(
          trecho || "Sem conteúdo disponível",
          ehCejusc
            ? ""
            : ehPauta
              ? "PAUTA DE JULGAMENTO (ÍNTEGRA)"
              : "RESUMO (ÚLTIMOS PARÁGRAFOS + ASSINATURA/INTIMADOS)"
        ));
        children.push(...buildComentariosParagraphs(comentariosMap.get(pub.id)));
      });

      const doc = new Document({
        styles: { default: { document: { run: { font: docFont, size: docFontSize } } } },
        sections: [{
          properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } },
          children,
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumo_intimacao_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        removidas > 0
          ? `Doc Resumo Intimação gerado! (${removidas} lista(s) de distribuição excluída(s))`
          : "Doc Resumo Intimação gerado!",
        { id: toastId }
      );
    } catch (err: any) {
      console.error("Erro ao gerar Doc Resumo Intimação:", err);
      toast.error(`Erro ao gerar Doc Resumo Intimação: ${err?.message || ""}`, { id: toastId });
    } finally {
      setGerandoDocResumoIntimacao(false);
    }
  };

  // mas descartando publicações duplicadas para o mesmo processo (varia só o intimado).
  const handleGerarDocResumoSemRepeticao = async () => {
    const rawPubs = getPubsParaGerar();
    if (rawPubs.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    const allPublicacoes = dedupPubsPorProcessoSemDestinatarios(rawPubs);
    const removidas = rawPubs.length - allPublicacoes.length;
    setGerandoDocResumoSemRepeticao(true);
    const toastId = toast.loading(
      removidas > 0
        ? `Gerando Doc Resumo sem repetição (${removidas} duplicada(s) ignorada(s))...`
        : "Gerando Doc Resumo sem repetição..."
    );
    try {
      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      const children: Paragraph[] = [...buildDocHeader(`Resumo (sem repetição) de Publicações ${origemLabel}`, allPublicacoes.length)];
      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));

      allPublicacoes.forEach((pub, idx) => {
        children.push(...buildPubMetadata(pub, idx));
        children.push(...buildPartesAdvogados(pub));
        const ehPauta = isPautaDeJulgamento(pub.conteudo);
        const trecho = extractResumoSemIA(pub);
        const ehCejusc = /\bCEJUSC\b/i.test(String(pub.conteudo || "").replace(/<[^>]+>/g, " "));
        children.push(...buildConteudoParagraphs(
          trecho || "Sem conteúdo disponível",
          ehCejusc
            ? ""
            : ehPauta
              ? "PAUTA DE JULGAMENTO (ÍNTEGRA)"
              : "RESUMO (ÚLTIMOS PARÁGRAFOS + ASSINATURA/INTIMADOS)"
        ));
        children.push(...buildComentariosParagraphs(comentariosMap.get(pub.id)));
      });

      const doc = new Document({
        styles: { default: { document: { run: { font: docFont, size: docFontSize } } } },
        sections: [{
          properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } },
          children,
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumo_sem_repeticao_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        removidas > 0
          ? `Doc Resumo sem repetição gerado! (${removidas} duplicada(s) ignorada(s))`
          : "Doc Resumo sem repetição gerado!",
        { id: toastId }
      );
    } catch (err: any) {
      console.error("Erro ao gerar Doc Resumo sem repetição:", err);
      toast.error(`Erro ao gerar Doc Resumo sem repetição: ${err?.message || ""}`, { id: toastId });
    } finally {
      setGerandoDocResumoSemRepeticao(false);
    }
  };

  // ===== "Gerar Docs TST" - Classifica publicações por palavras-chave (sem IA) e gera até 5 documentos Word
  //  (TEMAS_IRR, PAUTA, CEJUSC, DISTRIBUIÇÕES, PRAZOS).
  //  Regras (case-insensitive, primeira que casar vence):
  //   1. TEMAS_IRR  → ('sobrestamento'|'sobrestar') E ('tema XX'|'tema vinculante'|'IncJulgRREmbRep')
  //   2. PAUTA      → 'pauta de julgamento'
  //   3. CEJUSC     → 'plataforma zoom'
  //   4. DISTRIBUIÇÕES → 'lista de distribuição'
  //   5. PRAZOS (default) → últimas 20 linhas do conteúdo
  // =====
  const handleGerarDocsTST = async () => {
    const allPublicacoes = getPubsParaGerar();
    if (allPublicacoes.length === 0) { toast.error("Nenhuma publicação para classificar"); return; }
    setGerandoDocsTST(true);
    const toastId = toast.loading(`Classificando ${allPublicacoes.length} publicações...`);
    try {
      type Categoria = "TEMAS_IRR" | "PAUTA" | "CEJUSC" | "DISTRIBUICOES" | "INTIMACOES" | "PRAZOS";
      type ClassInfo = { id: string; categoria: Categoria; tema_irr?: string };
      type PubComClass = { pub: typeof allPublicacoes[0]; class_info: ClassInfo };
      const classificarLocal = (pub: typeof allPublicacoes[0]): ClassInfo => {
        const texto = stripHtmlAndDecodeEntities(pub.conteudo);
        const lower = texto.toLowerCase();
        const tipoCom = (pub.tipo_comunicacao || "").toLowerCase();
        const orgaoTxt = (pub.orgao || "").toString();
        // 1. TEMAS_IRR — sobrestamento/suspensão + sinal de Tema/IRR
        const textoSemAcento = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // Restringe a análise à parte dispositiva quando houver, para evitar
        // falsos positivos com narrativa histórica de sobrestamentos passados.
        const dispMarkerRe = /\b(isto\s+posto|acordam\s+os\s+ministros|pelo\s+exposto|pelas\s+razoes\s+expostas|diante\s+do\s+exposto|posto\s+isso|por\s+tais\s+fundamentos|ante\s+o\s+exposto|ex\s+positis|nego\s+seguimento|nego\s+provimento|denego\s+seguimento|dou\s+provimento)\b/gi;
        let dispositivo = textoSemAcento;
        const allMarkers = [...textoSemAcento.matchAll(dispMarkerRe)];
        if (allMarkers.length > 0) {
          const last = allMarkers[allMarkers.length - 1];
          dispositivo = textoSemAcento.slice(last.index ?? 0);
        }
        // Sobrestamento processual real: verbo/substantivo de sobrestar, OU
        // "suspensão/suspendo" qualificado pelo objeto processual (feito,
        // processo, autos, recurso, tramitação). Evita falsos positivos
        // com "exigibilidade suspensa" (honorários sucumbenciais) etc.
        const sobrestaRe = /\b(sobrestam(?:ento|entos)?|sobrestar|sobrestad[oa]s?|sobresta)\b/i;
        const suspensaoProcRe = /\bsuspens(?:ao|o|a)\s+(?:d[oa]s?\s+)?(?:feito|processo|autos|recurso|tramita[cç][aã]o|presente\s+feito)\b/i;
        const suspendoProcRe = /\bsuspend[oae][mr]?\s+(?:o\s+|a\s+)?(?:feito|processo|recurso|tramita[cç][aã]o|presente\s+feito|presente\s+processo)\b/i;
        const condA = sobrestaRe.test(dispositivo) || suspensaoProcRe.test(dispositivo) || suspendoProcRe.test(dispositivo);
        if (condA) {
          const mTema = dispositivo.match(/\btema\s+(?:vinculante\s+)?(?:n[º°o]?\s*)?(\d{1,4})\b/i);
          const temVinculante = /\btema\s+vinculante\b/i.test(dispositivo);
          const temIncJulg = /IncJulgRREmbRep/i.test(allMarkers.length > 0 ? texto.slice(allMarkers[allMarkers.length - 1].index ?? 0) : texto);
          if (mTema || temVinculante || temIncJulg) {
            const temaLabel = mTema ? `Tema ${mTema[1]}` : (temVinculante ? "Tema vinculante" : "IncJulgRREmbRep");
            return { id: pub.id, categoria: "TEMAS_IRR", tema_irr: temaLabel };
          }
        }
        // CEJUSC — basta encontrar "CEJUSC" + "plataforma ZOOM" no órgão OU no texto da publicação
        const temCejusc = /\bCEJUSC\b/i.test(orgaoTxt) || /\bCEJUSC\b/i.test(texto);
        if (temCejusc && /plataforma\s+zoom/i.test(texto)) {
          return { id: pub.id, categoria: "CEJUSC" };
        }
        // b. Lista de distribuição (pelo tipo de comunicação)
        if (tipoCom.includes("lista de distribui")) {
          return { id: pub.id, categoria: "DISTRIBUICOES" };
        }
        // a. Pauta de Julgamento (frase exata, e não pode ser CEJUSC)
        const ehCejusc = /\bcejusc\b/i.test(texto);
        // Acórdãos do TST às vezes carregam o cabeçalho "PAUTA DE JULGAMENTO
        // (ÍNTEGRA)" no início do próprio acórdão. Para não classificar esses
        // acórdãos como PAUTA, exige-se ausência de marcadores típicos de
        // acórdão (ACORDAM, "A C Ó R D Ã O" espaçado, EMENTA, VOTO).
        const textoSemAcentoFull = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const ehAcordao =
          /\bACORDAM\b/i.test(textoSemAcentoFull) ||
          /A\s*C\s*O\s*R\s*D\s*A\s*O/i.test(textoSemAcentoFull) ||
          /\bEMENTA\b/i.test(textoSemAcentoFull) ||
          /\bV\s*O\s*T\s*O\b/i.test(textoSemAcentoFull);
        if (!ehCejusc && !ehAcordao && lower.includes("pauta de julgamento")) {
          return { id: pub.id, categoria: "PAUTA" };
        }
        // d. Intimações (pelo tipo de comunicação)
        if (tipoCom.includes("intima")) {
          return { id: pub.id, categoria: "INTIMACOES" };
        }
        // c. Prazos gerais (default)
        return { id: pub.id, categoria: "PRAZOS" };
      };
      const pubsTemasIrr: PubComClass[] = [];
      const pubsPauta: PubComClass[] = [];
      const pubsCejusc: PubComClass[] = [];
      const pubsDistribuicoes: PubComClass[] = [];
      const pubsIntimacoes: PubComClass[] = [];
      const pubsPrazos: PubComClass[] = [];
      allPublicacoes.forEach(pub => {
        const ci = classificarLocal(pub);
        const item = { pub, class_info: ci };
        switch (ci.categoria) {
          case "TEMAS_IRR": pubsTemasIrr.push(item); break;
          case "PAUTA": pubsPauta.push(item); break;
          case "CEJUSC": pubsCejusc.push(item); break;
          case "DISTRIBUICOES": pubsDistribuicoes.push(item); break;
          case "INTIMACOES": pubsIntimacoes.push(item); break;
          default: pubsPrazos.push(item);
        }
      });
      toast.loading(`Gerando documentos... (Temas IRR: ${pubsTemasIrr.length}, Pauta: ${pubsPauta.length}, CEJUSC: ${pubsCejusc.length}, Distrib: ${pubsDistribuicoes.length}, Intimações: ${pubsIntimacoes.length}, Prazos: ${pubsPrazos.length})`, { id: toastId });
      const dataStr = format(new Date(), "dd.MM.yy");
      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));
      const buildTSTDocChildren = (pubs: PubComClass[], titulo: string, modo: "integral" | "resumo"): Paragraph[] => {
        const ch: Paragraph[] = [...buildDocHeader(titulo, pubs.length)];
        pubs.forEach((item, idx) => {
          const { pub, class_info: ci } = item;
          const procNumMasked = pub.processo_numero ? formatProcessoNumero(pub.processo_numero) : "N/A";
          ch.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: idx > 0 ? 360 : 120, after: 120 }, shading: { type: ShadingType.SOLID, color: mediumBlue, fill: mediumBlue }, children: [new TextRun({ text: `  COMUNICAÇÃO PJE #${sanitizeForXml(procNumMasked)}`, bold: true, size: 24, color: "FFFFFF", font: docFont })] }));
          const ml = [["Processo", sanitizeForXml(procNumMasked)], ["Órgão", sanitizeForXml(pub.orgao || pub.tribunal || "N/A")], ["Data de disponibilização", pub.data_disponibilizacao ? formatDateOnlyFull(pub.data_disponibilizacao) : "N/A"], ["Tipo de Comunicação", sanitizeForXml(pub.tipo_comunicacao || "Intimação")], ["Meio", "Diário de Justiça Eletrônico Nacional"]];
          ml.forEach(([l, v]) => { ch.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${l}: `, bold: true, size: docFontSize, font: docFont, color: "333333" }), new TextRun({ text: v as string, size: docFontSize, font: docFont, color: "555555" })] })); });
          if (pub.processo_numero) {
            const procNum = pub.processo_numero.replace(/\D/g, '');
            const dataDisp = pub.data_disponibilizacao ? pub.data_disponibilizacao.slice(0, 10) : '';
            const pjeUrl = dataDisp
              ? `https://comunica.pje.jus.br/consulta?siglaTribunal=TST&dataDisponibilizacaoInicio=${dataDisp}&dataDisponibilizacaoFim=${dataDisp}&numeroProcesso=${procNum}`
              : `https://comunica.pje.jus.br/consulta?siglaTribunal=TST&numeroProcesso=${procNum}`;
            ch.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Inteiro teor: ", bold: true, size: docFontSize, font: docFont, color: "333333" }), new ExternalHyperlink({ children: [new TextRun({ text: "Clique aqui", size: docFontSize, font: docFont, color: "1155CC", underline: { type: "single" } })], link: pjeUrl })] }));
          }
          if (ci.tema_irr) ch.push(new Paragraph({ spacing: { before: 80, after: 80 }, shading: { type: ShadingType.SOLID, color: "FFF3CD", fill: "FFF3CD" }, children: [new TextRun({ text: `  Tema IRR: ${sanitizeForXml(ci.tema_irr)}`, bold: true, size: docFontSize, font: docFont, color: "856404" })] }));
          ch.push(...buildPartesAdvogados(pub));
          if (modo === "integral") {
            ch.push(...buildConteudoParagraphs(pub.conteudo || "Sem conteúdo", "Conteúdo Integral"));
          } else {
            const trecho = extractResumoSemIA(pub);
            ch.push(...buildConteudoParagraphs(trecho || "Sem conteúdo disponível", "RESUMO (ÚLTIMOS PARÁGRAFOS + ASSINATURA/INTIMADOS)"));
          }
          ch.push(...buildComentariosParagraphs(comentariosMap.get(pub.id)));
        });
        return ch;
      };
      const mkDoc = (ch: Paragraph[]) => new Document({ styles: { default: { document: { run: { font: docFont, size: docFontSize } } } }, sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } }, children: ch }] });
      const dl = async (d: Document, fn: string) => { const b = await Packer.toBlob(d); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = fn; a.click(); URL.revokeObjectURL(u); };
      let dg = 0;
      if (pubsTemasIrr.length > 0) { await dl(mkDoc(buildTSTDocChildren(pubsTemasIrr, `Temas IRR - ${dataStr}`, "integral")), `JURISCONTROL_TEMAS_IRR_${dataStr}.docx`); dg++; }
      if (pubsPauta.length > 0) { await dl(mkDoc(buildTSTDocChildren(pubsPauta, `Pauta de Julgamento - ${dataStr}`, "integral")), `JURISCONTROL_PAUTA_${dataStr}.docx`); dg++; }
      if (pubsCejusc.length > 0) { await dl(mkDoc(buildTSTDocChildren(pubsCejusc, `CEJUSC - ${dataStr}`, "integral")), `JURISCONTROL_CEJUSC_${dataStr}.docx`); dg++; }
      if (pubsDistribuicoes.length > 0) { await dl(mkDoc(buildTSTDocChildren(pubsDistribuicoes, `Lista de Distribuição - ${dataStr}`, "resumo")), `JURISCONTROL_DISTRIBUICOES_${dataStr}.docx`); dg++; }
      if (pubsIntimacoes.length > 0) { await dl(mkDoc(buildTSTDocChildren(pubsIntimacoes, `Intimações - ${dataStr}`, "integral")), `JURISCONTROL_INTIMACOES_${dataStr}.docx`); dg++; }
      if (pubsPrazos.length > 0) { await dl(mkDoc(buildTSTDocChildren(pubsPrazos, `Prazos Gerais - ${dataStr}`, "resumo")), `JURISCONTROL_PRAZOS_${dataStr}.docx`); dg++; }
      toast.success(`${dg} documento(s) gerado(s)! (Temas IRR: ${pubsTemasIrr.length}, Pauta: ${pubsPauta.length}, CEJUSC: ${pubsCejusc.length}, Distrib: ${pubsDistribuicoes.length}, Intimações: ${pubsIntimacoes.length}, Prazos: ${pubsPrazos.length})`, { id: toastId });
    } catch (error) {
      console.error("Erro ao gerar Docs TST:", error);
      toast.error(`Erro ao gerar Docs TST: ${error instanceof Error ? error.message : "Erro desconhecido"}`, { id: toastId });
    } finally { setGerandoDocsTST(false); }
  };

  const handleMarcarLidas = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma publicação");
      return;
    }
    const items = Array.from(selectedIds.entries()).map(([id, tipo]) => ({ id, tipo_origem: tipo }));
    await marcarComoLida.mutateAsync(items);
    registrarAcaoSessao({
      tipo: "leitura",
      label: `Marcar ${items.length} publicação(ões) como lida(s)`,
      alvos: items.map((i) => ({ id: i.id, tabela: String(i.tipo_origem) })),
    });
    setSelectedIds(new Map<string, TipoOrigemPublicacao>());
  };

  // Descarta as publicações selecionadas, mas antes analisa se elas realmente
  // são duplicadas entre si (mesma coordenação + mesmo id_djen, ou fallback por
  // dedup_key/dedup_conteudo_key). Mantém a mais antiga de cada grupo e propõe
  // descartar somente as demais. Se houver itens únicos (sem par entre os
  // selecionados), pede confirmação extra antes de descartá-los.
  const [descartandoSelecionadas, setDescartandoSelecionadas] = useState(false);
  const [descartandoDupSelecionadas, setDescartandoDupSelecionadas] = useState(false);
  // Invalida as listas afetadas por descarte UMA única vez, ao final de uma ação em lote.
  const invalidarListasDescarte = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] }),
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats-header'] }),
      queryClient.invalidateQueries({ queryKey: ['descartadas-count'] }),
      queryClient.invalidateQueries({ queryKey: ['descartadas-dedup'] }),
      queryClient.invalidateQueries({ queryKey: ['descartadas-lotes-recentes'] }),
    ]);
  };
  const handleDescartarSelecionadas = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma publicação");
      return;
    }
    const selecionadas = allPublicacoes.filter(p => selectedIds.has(p.id));
    // Não é possível descartar publicações que já estão descartadas.
    const jaDescartadas = selecionadas.filter(p => p.tipo_origem === 'descartada');
    if (jaDescartadas.length > 0) {
      toast.error(`${jaDescartadas.length} publicação(ões) selecionada(s) já estão descartadas.`);
      return;
    }
    if (selecionadas.some(p => p.tipo_origem !== 'termo' && p.tipo_origem !== 'processo')) {
      toast.error('Só é possível descartar publicações de termo ou processo.');
      return;
    }

    // Descarte em lote direto: descarta EXATAMENTE o que está selecionado.
    // (A análise de duplicidade fica no botão "Descartar duplicadas".)
    const paraDescartar = selecionadas;
    const confirmar = window.confirm(
      `Descartar ${paraDescartar.length} publicação(ões) selecionada(s)?\n\n` +
      `Elas saem da lista de encontradas e passam para "Descartadas" ` +
      `(é possível desfazer pela aba de descartadas).`
    );
    if (!confirmar) return;

    setDescartandoSelecionadas(true);
    try {
      let sucesso = 0;
      const falhas: { id: string; processo: string | null; erro: string }[] = [];
      const descartadosOk: string[] = [];
      for (const p of paraDescartar) {
        try {
          await descartarManualmente.mutateAsync({
            id: p.id,
            tipo_origem: p.tipo_origem as 'termo' | 'processo',
            silent: true,
          });
          sucesso += 1;
          descartadosOk.push(p.id);
        } catch (e: any) {
          falhas.push({ id: p.id, processo: p.processo_numero ?? null, erro: e?.message || String(e) });
        }
      }
      await invalidarListasDescarte();
      if (descartadosOk.length > 0) {
        registrarAcaoSessao({
          tipo: "descarte",
          label: `Descartar ${descartadosOk.length} publicação(ões)`,
          ids: descartadosOk,
        });
      }
      if (falhas.length > 0) {
        console.error('[descartar-selecionadas] falhas:', falhas);
        toast.error(
          `${sucesso} descartada(s). ${falhas.length} falha(s): ` +
          falhas.slice(0, 3).map(f => f.processo || f.id).join(', ') +
          (falhas.length > 3 ? '…' : '')
        );
      } else {
        toast.success(`${sucesso} publicação(ões) descartada(s).`);
      }
      setSelectedIds(new Map<string, TipoOrigemPublicacao>());
    } finally {
      setDescartandoSelecionadas(false);
    }
  };

  // Reverte a última ação registrada na sessão (leitura, descarte ou item criado).
  const tabelaPubDe = (t: string) =>
    t === "processo"
      ? "publicacoes_djen_processos"
      : t === "descartada"
        ? "publicacoes_djen_descartadas"
        : "publicacoes_djen";
  const desfazerUltimaAcaoSessao = async () => {
    const acao = acoesSessao[acoesSessao.length - 1];
    if (!acao) return;
    const descricao =
      acao.tipo === "leitura"
        ? `${acao.label} — as publicações voltam para "Não lidas".`
        : acao.tipo === "descarte"
          ? `${acao.label} — as publicações voltam para a lista ativa.`
          : `${acao.label} — o item criado será EXCLUÍDO.`;
    if (!window.confirm(`Desfazer a última ação?\n\n${descricao}`)) return;
    setDesfazendoAcao(true);
    try {
      if (acao.tipo === "leitura") {
        const porTabela = new Map<string, string[]>();
        for (const a of acao.alvos) {
          const tb = tabelaPubDe(a.tabela);
          porTabela.set(tb, [...(porTabela.get(tb) || []), a.id]);
        }
        for (const [tb, ids] of porTabela) {
          const { error } = await (supabase as any).from(tb).update({ lida: false }).in("id", ids);
          if (error) throw error;
        }
        if (user?.id) {
          for (const a of acao.alvos) {
            await (supabase as any)
              .from("publicacoes_djen_leituras")
              .delete()
              .eq("publicacao_id", a.id)
              .eq("usuario_id", user.id);
          }
        }
        setPubsTratadasSessao((prev) => {
          const next = { ...prev };
          for (const a of acao.alvos) delete next[a.id];
          return next;
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["publicacoes-unificadas"] }),
          queryClient.invalidateQueries({ queryKey: ["publicacoes-unificadas-stats-header"] }),
          queryClient.invalidateQueries({ queryKey: ["publicacoes-djen-processo"] }),
        ]);
      } else if (acao.tipo === "descarte") {
        for (const id of acao.ids) {
          const { error } = await (supabase as any).rpc("desfazer_descarte_individual", { p_id: id });
          if (error) throw error;
        }
        await invalidarListasDescarte();
      } else {
        const tabela =
          acao.itemTipo === "evento"
            ? "eventos_agenda"
            : acao.itemTipo === "audiencia"
              ? "audiencias_detectadas"
              : "tarefas";
        const { error } = await (supabase as any).from(tabela).delete().eq("id", acao.id);
        if (error) throw error;
        setItensCriadosSessao((prev) => prev.filter((i) => i.id !== acao.id));
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["itens-existentes-publicacao"] }),
          queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] }),
          queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
          queryClient.invalidateQueries({ queryKey: ["audiencias-detectadas"] }),
        ]);
      }
      setAcoesSessao((prev) => prev.slice(0, -1));
      toast.success("Ação desfeita.");
    } catch (e: any) {
      console.error("[desfazer-ultimo]", e);
      toast.error(`Não foi possível desfazer: ${e?.message || e}`);
    } finally {
      setDesfazendoAcao(false);
    }
  };

  // Descarta apenas duplicadas dentro das selecionadas, mantendo 1 por grupo.
  // Ignora selecionadas que não têm par duplicado (não pergunta para forçar descarte).
  const handleDescartarDuplicadasSelecionadas = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos duas publicações");
      return;
    }
    const selecionadas = allPublicacoes.filter(p => selectedIds.has(p.id));
    const jaDescartadas = selecionadas.filter(p => p.tipo_origem === 'descartada');
    if (jaDescartadas.length > 0) {
      toast.error(`${jaDescartadas.length} publicação(ões) já estão descartadas.`);
      return;
    }
    if (selecionadas.some(p => p.tipo_origem !== 'termo' && p.tipo_origem !== 'processo')) {
      toast.error('Só é possível descartar publicações de termo ou processo.');
      return;
    }

    // Agrupamento por chave de duplicidade (coordenacao + id_djen; fallback dedup_key/dedup_conteudo_key).
    const keyOf = (p: PublicacaoUnificada): string => {
      const coord = p.coordenacao_id ?? 'sem_coord';
      const idDjen = String(p.id_djen ?? '').trim();
      if (idDjen) return `${coord}|id_djen|${idDjen}`;
      const dk = String(p.dedup_key ?? '').trim();
      if (dk) return `${coord}|dedup_key|${dk}`;
      const dck = String(p.dedup_conteudo_key ?? '').trim();
      if (dck) return `${coord}|dedup_conteudo_key|${dck}`;
      return `${coord}|unica|${p.id}`;
    };

    const grupos = new Map<string, PublicacaoUnificada[]>();
    for (const p of selecionadas) {
      const k = keyOf(p);
      const arr = grupos.get(k) ?? [];
      arr.push(p);
      grupos.set(k, arr);
    }

    const paraDescartar: PublicacaoUnificada[] = [];
    let mantidas = 0;
    let semPar = 0;
    for (const [, arr] of grupos) {
      if (arr.length < 2) { semPar += arr.length; continue; }
      const ordenadas = [...arr].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });
      mantidas += 1;
      paraDescartar.push(...ordenadas.slice(1));
    }

    if (paraDescartar.length === 0) {
      toast.error(
        `Nenhuma duplicada encontrada entre as ${selecionadas.length} selecionada(s). ` +
        `Selecione publicações com mesma coordenação e mesmo id_djen (ou dedup_key).`
      );
      return;
    }

    const confirmar = window.confirm(
      `Serão descartadas ${paraDescartar.length} duplicada(s), ` +
      `mantendo ${mantidas} publicação(ões) — a mais antiga de cada grupo. ` +
      (semPar > 0 ? `${semPar} selecionada(s) sem par NÃO serão descartadas. ` : '') +
      `Confirmar?`
    );
    if (!confirmar) return;

    setDescartandoDupSelecionadas(true);
    try {
      let sucesso = 0;
      const falhas: { id: string; processo: string | null; erro: string }[] = [];
      for (const p of paraDescartar) {
        try {
          await descartarManualmente.mutateAsync({
            id: p.id,
            tipo_origem: p.tipo_origem as 'termo' | 'processo',
            silent: true,
          });
          sucesso += 1;
        } catch (e: any) {
          falhas.push({ id: p.id, processo: p.processo_numero ?? null, erro: e?.message || String(e) });
        }
      }
      await invalidarListasDescarte();
      if (falhas.length > 0) {
        console.error('[descartar-duplicadas-selecionadas] falhas:', falhas);
        toast.error(
          `${sucesso} descartada(s). ${falhas.length} falha(s): ` +
          falhas.slice(0, 3).map(f => f.processo || f.id).join(', ') +
          (falhas.length > 3 ? '…' : '')
        );
      } else {
        toast.success(`${paraDescartar.length} duplicada(s) descartada(s). ${mantidas} mantida(s).`);
      }
      setSelectedIds(new Map<string, TipoOrigemPublicacao>());
    } finally {
      setDescartandoDupSelecionadas(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(parseISO(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(parseISO(dateString), "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const getMonitoramentoBadgeLabel = (pub: PublicacaoUnificada) => {
    if (!pub.monitoramento_termo) return null;
    if (pub.monitoramento_termo === '__CAPTURA_TOTAL_KURIER__') return 'Captura total Kurier';
    return `${(pub.monitoramento_tipo || 'TERMO').toUpperCase()} + ${pub.monitoramento_termo}`;
  };

  // Use merged data for all rendering (shadow the hook's publicacoes)
  // Filtro client-side por data de disponibilização.
  const allPublicacoes = useMemo(() => {
    let result = mergedPublicacoes;
    // Reinjeta as publicações tratadas nesta sessão (que o filtro "não lidas"
    // removeria do resultado do servidor logo após salvar um item).
    const tratadas = Object.values(pubsTratadasSessao) as any[];
    if (tratadas.length > 0) {
      const presentes = new Set(result.map((p: any) => p.id));
      const faltantes = tratadas.filter((p) => p && !presentes.has(p.id));
      if (faltantes.length > 0) result = [...faltantes, ...result];
    }
    if (tipoOrigem === 'kurier') {
      result = result.filter(pub => (pub.fonte || '').toLowerCase() === 'kurier');
    }
    if (tipoOrigem === 'stf') {
      result = result.filter(pub => {
        const t = (pub.tribunal || pub.fonte || '').toString().toUpperCase();
        return /(?:^|[^A-Z0-9])STF(?:[^A-Z0-9]|$)/.test(t);
      });
    }
    if (dataDisponibilizacao) {
      result = result.filter(pub => {
        const dataFiltro = tipoOrigem === 'djet-pautas' ? pub.data_publicacao : pub.data_disponibilizacao;
        if (!dataFiltro) return false;
        const pubDate = dataFiltro.slice(0, 10);
        return pubDate === dataDisponibilizacao;
      });
    }
    if (tribunalFiltro) {
      const alvo = tribunalFiltro.toUpperCase();
      result = result.filter(pub => {
        const t = (pub.tribunal || pub.fonte || "").toString().toUpperCase();
        if (!t) return false;
        // Match exato por sigla (TRT10 não casa com TRT1)
        const re = new RegExp(`(?:^|[^A-Z0-9])${alvo}(?:[^A-Z0-9]|$)`);
        return re.test(t);
      });
    }
    if (execucaoFocada && execucaoFocada.novasIds.length > 0) {
      const novasSet = new Set(execucaoFocada.novasIds);
      result = result.filter(pub => novasSet.has(pub.id));
    }
    if (ocultarDuplicadas) {
      result = dedupePublicacoesDjen(result);
    }
    return result;
  }, [mergedPublicacoes, dataDisponibilizacao, tribunalFiltro, ocultarDuplicadas, tipoOrigem, execucaoFocada, pubsTratadasSessao]);

  // Quantas publicações foram ocultadas pela deduplicação (para o badge).
  const totalDuplicadasOcultas = useMemo(() => {
    if (!ocultarDuplicadas) return 0;
    let base = mergedPublicacoes;
    if (dataDisponibilizacao) {
      base = base.filter(pub => {
        const dataFiltro = tipoOrigem === 'djet-pautas' ? pub.data_publicacao : pub.data_disponibilizacao;
        if (!dataFiltro) return false;
        return dataFiltro.slice(0, 10) === dataDisponibilizacao;
      });
    }
    if (tribunalFiltro) {
      const alvo = tribunalFiltro.toUpperCase();
      base = base.filter(pub => {
        const t = (pub.tribunal || pub.fonte || "").toString().toUpperCase();
        if (!t) return false;
        const re = new RegExp(`(?:^|[^A-Z0-9])${alvo}(?:[^A-Z0-9]|$)`);
        return re.test(t);
      });
    }
    return Math.max(0, base.length - allPublicacoes.length);
  }, [ocultarDuplicadas, mergedPublicacoes, dataDisponibilizacao, tribunalFiltro, tipoOrigem, allPublicacoes.length]);

  // Total de publicações ÚNICAS (após deduplicação por processo + data + conteúdo
  // ignorando intimados — mesma regra do botão "Resumo sem repetição"). Vem do
  // servidor (RPC get_djen_stats_per_user → total_unicas) e respeita
  // data_disponibilizacao + tribunal + termo + monitoramento. Evita reprocessar
  // milhares de linhas no navegador a cada keystroke.
  const totalUnicasFiltrado = tipoOrigem === 'datajud'
    ? totalDatajudHoje
    : tipoOrigem === 'descartada'
      ? (descartadasStats?.total ?? totalDescartadasHoje)
      : (totalUnicasHoje ?? totalHoje);

  // Paginação server-side da aba "Descartadas": cada página carrega 500 itens
  // do banco. Total vem do COUNT exato (descartadasStats.total).
  const descartadasTotalServidor = tipoOrigem === 'descartada' ? (descartadasStats?.total ?? 0) : 0;
  const descartadasTotalPages = tipoOrigem === 'descartada'
    ? Math.max(1, Math.ceil(descartadasTotalServidor / PAGE_SIZE_DESCARTADAS))
    : 1;
  useEffect(() => {
    if (descartadasPage > descartadasTotalPages) setDescartadasPage(1);
  }, [descartadasTotalPages, descartadasPage]);
  useEffect(() => {
    setDescartadasPage(1);
  }, [tipoOrigem, coordenacaoFiltroEfetivo, termoBuscaDebounced, dataInicioDebounced, dataFimDebounced, dataDisponibilizacaoDebounced, tribunalFiltro, monitoramentoId]);
  // Na aba descartada a paginação é server-side, então allPublicacoes já
  // contém apenas a página atual.
  const publicacoesParaListagem = allPublicacoes;

  // Set de IDs visíveis para a paginação CLIENT-SIDE de apresentação:
  // limita o número de cards renderizados sem afetar agrupamentos,
  // contadores ou exportações. Para descartadas (paginação server) o
  // limite não se aplica (renderiza tudo da página atual).
  const visibleIdsSet = useMemo<Set<string> | null>(() => {
    if (tipoOrigem === 'descartada') return null;
    if (displayLimit >= allPublicacoes.length) return null;
    const s = new Set<string>();
    for (let i = 0; i < displayLimit && i < allPublicacoes.length; i++) {
      s.add(allPublicacoes[i].id);
    }
    return s;
  }, [allPublicacoes, displayLimit, tipoOrigem]);
  const totalRenderizadoNaTela = visibleIdsSet
    ? Math.min(displayLimit, allPublicacoes.length)
    : allPublicacoes.length;

  // Agrupar publicações por coordenação
  const publicacoesPorCoordenacao = publicacoesParaListagem.reduce((acc, pub) => {
    const coordId = pub.coordenacao_id || 'sem-coordenacao';
    if (!acc[coordId]) {
      acc[coordId] = {
        coordenacao_id: coordId,
        coordenacao_nome: pub.coordenacao_nome || 'Sem Coordenação',
        publicacoes: []
      };
    }
    acc[coordId].publicacoes.push(pub);
    return acc;
  }, {} as Record<string, { coordenacao_id: string; coordenacao_nome: string; publicacoes: PublicacaoUnificada[] }>);

  const coordenacoesOrdenadas = Object.values(publicacoesPorCoordenacao).sort((a, b) => 
    b.publicacoes.length - a.publicacoes.length
  );

  const getGrupoContadores = (grupo: { coordenacao_id: string; publicacoes: PublicacaoUnificada[] }) => {
    return {
      total: grupo.publicacoes.length,
      termos: grupo.publicacoes.filter(p => p.tipo_origem === 'termo').length,
      processos: grupo.publicacoes.filter(p => p.tipo_origem === 'processo').length,
      naoLidas: grupo.publicacoes.filter(p => !p.lida).length,
    };
  };
  const totalListaVisivel = allPublicacoes.length;
  const totalNaoLidasVisivel = allPublicacoes.filter(p => !p.lida).length;
  const totalTermosVisivel = allPublicacoes.filter(p => p.tipo_origem === 'termo').length;
  const totalProcessosVisivel = allPublicacoes.filter(p => p.tipo_origem === 'processo').length;
  const totalDescartadasVisivel = allPublicacoes.filter(p => p.tipo_origem === 'descartada').length;
  const totalDatajudVisivel = allPublicacoes.filter(p => p.tipo_origem === 'datajud').length;
  const totalKurierVisivel = useMemo(() => {
    // Quando a aba Kurier está ativa, o total do servidor já corresponde exatamente
    // ao filtro. Caso contrário, usamos a contagem paralela do banco para não ficar
    // limitado às primeiras 500 publicações da RPC unificada.
    if (tipoOrigem === 'kurier') return totalHoje;
    return totalKurierServer || mergedPublicacoes.filter(p => (p.fonte || '').toLowerCase() === 'kurier').length;
  }, [tipoOrigem, totalHoje, totalKurierServer, mergedPublicacoes]);
  // PERFORMANCE/CORREÇÃO: o backend agora aplica os filtros de data de
  // disponibilização e tribunal nas RPCs de contagem (get_djen_stats_per_user).
  // Portanto sempre usamos os totais do servidor — eles já consideram esses
  // filtros e a deduplicação por coordenação + id_djen. Antes, quando esses
  // filtros estavam ativos, a tela trocava para "contadores da lista" e
  // contava apenas as publicações da página atual, gerando totalizadores
  // incoerentes (especialmente o "Total no período").
  // Quando o filtro client-side `data_publicacao` está ativo, os totais do
  // servidor (que não conhecem esse filtro) ficam incoerentes com a lista.
  // Nesse caso, os cards passam a contar a partir de allPublicacoes,
  // que já reflete o filtro aplicado.
  const usarContadoresDaLista = !!dataPublicacaoDebounced;
  const totalGeralFiltrado = usarContadoresDaLista
    ? totalListaVisivel
    : tipoOrigem === 'datajud'
      ? totalDatajudHoje
      : tipoOrigem === 'descartada'
        ? (descartadasStats?.total ?? 0)
        : totalHoje;
  const naoLidasTotalFiltrado = usarContadoresDaLista
    ? totalNaoLidasVisivel
    : tipoOrigem === 'datajud'
      ? naoLidasDatajudHoje
      : tipoOrigem === 'descartada'
        ? 0
        : naoLidasHoje;
  const totalTermosFiltrado = usarContadoresDaLista
    ? totalTermosVisivel
    : tipoOrigem !== 'datajud' && tipoOrigem !== 'descartada' ? totalTermosHoje : 0;
  const totalProcessosFiltrado = usarContadoresDaLista
    ? totalProcessosVisivel
    : tipoOrigem !== 'datajud' && tipoOrigem !== 'descartada' ? totalProcessosHoje : 0;
  const totalDescartadasFiltrado = usarContadoresDaLista
    ? totalDescartadasVisivel
    : tipoOrigem === 'datajud'
      ? 0
      // Quando o card Descartadas está selecionado, usa a query detalhada
      // (respeita termoBusca/dataDisponibilizacao); caso contrário, usa o
      // COUNT leve (totalDescartadasHoje) para o card sempre mostrar o total.
      : tipoOrigem === 'descartada' ? descartadasStats.total : totalDescartadasHoje;
  const totalFiltradoGeral = totalGeralFiltrado;
  const totalExibidoNaPagina = allPublicacoes.length;
  const temMaisResultados = totalFiltradoGeral > totalExibidoNaPagina;

  // Se houver seleção, gera apenas as selecionadas; senão, todas (já filtradas).
  const getPubsParaGerar = () => {
    if (selectedIds.size === 0) return allPublicacoes;
    return allPublicacoes.filter(p => selectedIds.has(p.id));
  };

  /**
   * Busca todos os comentários (e nomes dos autores) das publicações informadas.
   * Retorna Map<publicacao_id, Array<{ autor, comentario, created_at }>>
   */
  const fetchComentariosMap = async (
    pubIds: string[]
  ): Promise<Map<string, Array<{ autor: string; comentario: string; created_at: string }>>> => {
    const out = new Map<string, Array<{ autor: string; comentario: string; created_at: string }>>();
    if (pubIds.length === 0) return out;
    try {
      const { data: coms, error } = await supabase
        .from("comentarios_publicacoes_djen")
        .select("publicacao_id, user_id, comentario, created_at")
        .in("publicacao_id", pubIds)
        .order("created_at", { ascending: true });
      if (error || !coms || coms.length === 0) return out;

      const userIds = Array.from(new Set(coms.map((c: any) => c.user_id)));
      const nomeMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles_basic")
          .select("id, nome")
          .in("id", userIds);
        (profs || []).forEach((p: any) => nomeMap.set(p.id, p.nome || "Usuário"));
      }

      coms.forEach((c: any) => {
        const arr = out.get(c.publicacao_id) || [];
        arr.push({
          autor: nomeMap.get(c.user_id) || "Usuário",
          comentario: c.comentario,
          created_at: c.created_at,
        });
        out.set(c.publicacao_id, arr);
      });
    } catch (e) {
      console.error("Erro ao buscar comentários para exportação:", e);
    }
    return out;
  };

  return (
    <MainLayout title="Análise DJEN" subtitle="Publicações do dia para análise do advogado">
      <div className="space-y-6">
        {/* Formulário inline de Adicionar (esconde a lista quando aberto) */}
        {(() => {
          const inlineFormAberto = criarTarefaDialogOpen || novoEventoOpen || novoPrazoOpen || novaAudienciaOpen;
          // Wrapper continua aberto se houver publicação selecionada + form ativo
          // OU se já houver itens criados nesta sessão (mesmo após fechar o
          // form individual — usuário pode escolher outro tipo pelo dropdown
          // "Adicionar").
          // eslint-disable-next-line react-hooks/rules-of-hooks
          const { data: itensExistentesPub = [] } = useItensExistentesPublicacao(selectedPublicacao);
          // Card verde combina os itens já existentes (persistidos) com os
          // criados nesta sessão. Deduplica por id (sessão prevalece para
          // preservar o "flash" recém-adicionado).
          const itensDoCard: ItemCriado[] = (() => {
            const map = new Map<string, ItemCriado>();
            for (const it of itensExistentesPub) map.set(it.id, it);
            for (const it of itensCriadosSessao) map.set(it.id, it);
            return Array.from(map.values());
          })();
          const wrapperAberto =
            inlineFormAberto || !!itemEmEdicao || (!!selectedPublicacao && itensCriadosSessao.length > 0);
          const fecharTudo = () => {
            setCriarTarefaDialogOpen(false);
            setNovoEventoOpen(false);
            setNovoPrazoOpen(false);
            setNovaAudienciaOpen(false);
            setItemEmEdicao(null);
            setItensCriadosSessao([]);
          };
          const trocarTipo = (tipo: "tarefa" | "evento" | "prazo" | "audiencia") => {
            setItemEmEdicao(null);
            setCriarTarefaDialogOpen(tipo === "tarefa");
            setNovoEventoOpen(tipo === "evento");
            setNovoPrazoOpen(tipo === "prazo");
            setNovaAudienciaOpen(tipo === "audiencia");
          };
          const abrirEdicaoItem = (item: ItemCriado) => {
            setCriarTarefaDialogOpen(false);
            setNovoEventoOpen(false);
            setNovoPrazoOpen(false);
            setNovaAudienciaOpen(false);
            setItemEmEdicao({ tipo: item.tipo, id: item.id });
          };
          const fecharEdicaoItem = async () => {
            setItemEmEdicao(null);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["itens-existentes-publicacao"] }),
              queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] }),
              queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
            ]);
          };
          const registrarItemCriado = (tipo: ItemCriado["tipo"]) =>
            (info: { id: string; titulo: string }) => {
              setItensCriadosSessao((prev) => [
                ...prev,
                { id: info.id, titulo: info.titulo, tipo, createdAt: Date.now() },
              ]);
              registrarAcaoSessao({
                tipo: "item",
                label: `Criar ${tipo} "${info.titulo}"`,
                itemTipo: tipo,
                id: info.id,
              });
            };
          const markPubComoLida = async () => {
            if (!selectedPublicacao) return;
            // Mantém a publicação visível na lista mesmo com o filtro "não lidas"
            setPubsTratadasSessao((prev) => ({
              ...prev,
              [selectedPublicacao.id]: { ...selectedPublicacao, lida: true },
            }));
            try {
              // Marca como lida a publicação clicada E todas as irmãs do mesmo
              // grupo deduplicado (mesmo id_djen / processo+dia+conteúdo) na
              // coordenação — sem isso a publicação reaparece em "Não lidas".
              const origem = selectedPublicacao.tipo_origem;
              const args: any = {
                p_ids_termos: origem === "termo" ? [selectedPublicacao.id] : null,
                p_ids_processos: origem === "processo" ? [selectedPublicacao.id] : null,
                p_ids_descartadas: origem === "descartada" ? [selectedPublicacao.id] : null,
              };
              let relacionadas: { publicacao_id: string; tabela_origem: string }[] = [];
              if (origem === "termo" || origem === "processo" || origem === "descartada") {
                const { data: rel, error: relErr } = await (supabase as any).rpc(
                  "get_publicacoes_relacionadas_por_dedup",
                  args,
                );
                if (relErr) console.error("[salvar-e-ler] dedup:", relErr);
                relacionadas = (rel as any[]) || [];
              }
              if (relacionadas.length === 0) {
                relacionadas = [{ publicacao_id: selectedPublicacao.id, tabela_origem: origem === "processo" ? "processo" : origem === "descartada" ? "descartada" : "termo" }];
              }

              const tabelaDe = (t: string) =>
                t === "processo"
                  ? "publicacoes_djen_processos"
                  : t === "descartada"
                    ? "publicacoes_djen_descartadas"
                    : "publicacoes_djen";
              const porTabela = new Map<string, string[]>();
              for (const r of relacionadas) {
                const tb = tabelaDe(r.tabela_origem);
                porTabela.set(tb, [...(porTabela.get(tb) || []), r.publicacao_id]);
              }
              for (const [tb, ids] of porTabela) {
                const { error: upErr } = await (supabase as any)
                  .from(tb)
                  .update({ lida: true })
                  .in("id", ids);
                if (upErr) {
                  console.error("[salvar-e-ler] update lida:", upErr);
                  toast.error("Não foi possível marcar como lida: " + upErr.message);
                }
              }

              if (user?.id && selectedPublicacao.tipo_origem !== "datajud") {
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("nome")
                  .eq("id", user.id)
                  .maybeSingle();
                const leituras = relacionadas.map((r) => ({
                  publicacao_id: r.publicacao_id,
                  tabela_origem: r.tabela_origem,
                  usuario_id: user.id,
                  usuario_nome: profile?.nome || user.email || "Desconhecido",
                }));
                const { error: leiErr } = await (supabase as any)
                  .from("publicacoes_djen_leituras")
                  .upsert(leituras, { onConflict: "publicacao_id,tabela_origem,usuario_id" });
                if (leiErr) console.error("[salvar-e-ler] leituras:", leiErr);
              }

              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["publicacoes-unificadas"] }),
                queryClient.invalidateQueries({ queryKey: ["publicacoes-unificadas-stats-header"] }),
                queryClient.invalidateQueries({ queryKey: ["publicacoes-djen-processo"] }),
              ]);
              registrarAcaoSessao({
                tipo: "leitura",
                label: `Marcar ${relacionadas.length} publicação(ões) como lida(s)`,
                alvos: relacionadas.map((r) => ({ id: r.publicacao_id, tabela: r.tabela_origem })),
              });
            } catch (err) {
              console.error("Erro ao marcar publicação como lida (Salvar e ler):", err);
            }
          };
          // Botão dropdown "Adicionar" reutilizado no cabeçalho do wrapper para
          // permitir alternar o tipo do item sem precisar voltar à lista.
          const AdicionarTipoDropdown = (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="default">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setTimeout(() => trocarTipo("tarefa"), 0)}>
                  <ClipboardList className="w-4 h-4 mr-2" /> Tarefa
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTimeout(() => trocarTipo("evento"), 0)}>
                  <CalendarPlus className="w-4 h-4 mr-2" /> Evento
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTimeout(() => trocarTipo("prazo"), 0)}>
                  <Clock className="w-4 h-4 mr-2" /> Prazo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTimeout(() => trocarTipo("audiencia"), 0)}>
                  <Gavel className="w-4 h-4 mr-2" /> Audiência
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
          return wrapperAberto ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Criando item a partir da publicação selecionada
                </div>
                <Button size="sm" variant="outline" onClick={fecharTudo}>
                  ← Voltar para a lista
                </Button>
              </div>
              <ItensCriadosPublicacaoCard itens={itensDoCard} onSelecionarItem={abrirEdicaoItem} />
              {/* Barra "+ Adicionar" acima do formulário, sempre visível quando o
                  wrapper está aberto — permite alternar o tipo sem fechar. */}
              <div className="flex items-center justify-end">
                {AdicionarTipoDropdown}
              </div>
              {itemEmEdicao && (
                <EdicaoItemPublicacaoInline
                  tipo={itemEmEdicao.tipo}
                  id={itemEmEdicao.id}
                  onClose={() => { void fecharEdicaoItem(); }}
                />
              )}
              {!inlineFormAberto && !itemEmEdicao && (
                <div className="rounded-md border bg-background p-6 text-sm text-muted-foreground text-center">
                  Selecione um tipo em <strong>Adicionar</strong> para cadastrar outro item para esta publicação, ou clique em <strong>Voltar para a lista</strong>.
                </div>
              )}
              {criarTarefaDialogOpen && (
                <NovaTarefaPublicacaoDialog
                  inline
                  open={criarTarefaDialogOpen}
                  onOpenChange={setCriarTarefaDialogOpen}
                  publicacao={selectedPublicacao}
                  defaultProcessoId={adicionarProcessoId}
                  onMarkAsRead={markPubComoLida}
                  tertiarySave={{ label: "Salvar e fechar", onAfterSuccess: fecharTudo }}
                  onAfterCreate={registrarItemCriado("tarefa")}
                />
              )}
              {novoEventoOpen && (
                <div className="rounded-md border bg-background overflow-hidden flex flex-col lg:flex-row min-h-[70vh] max-h-[calc(100vh-12rem)]">
                  <PublicacaoSidePanel publicacao={selectedPublicacao} />
                  <div className="flex flex-col min-h-0 w-full lg:w-[640px] bg-background">
                    <EventoDialog
                      inline
                      open={novoEventoOpen}
                      onOpenChange={setNovoEventoOpen}
                      evento={null}
                      defaultProcessoId={adicionarProcessoId}
                      publicacao={selectedPublicacao}
                      hidePublicacaoCollapsible
                      secondarySave={{ label: "Salvar e ler", onAfterSuccess: markPubComoLida }}
                      tertiarySave={{ label: "Salvar e fechar", onAfterSuccess: fecharTudo }}
                      onAfterCreate={registrarItemCriado("evento")}
                    />
                  </div>
                </div>
              )}
              {novoPrazoOpen && (
                <div className="rounded-md border bg-background overflow-hidden flex flex-col lg:flex-row min-h-[70vh] max-h-[calc(100vh-12rem)]">
                  <PublicacaoSidePanel publicacao={selectedPublicacao} />
                  <div className="flex flex-col min-h-0 w-full lg:w-[640px] bg-background">
                    <PrazoDialog
                      inline
                      open={novoPrazoOpen}
                      onOpenChange={setNovoPrazoOpen}
                      prazo={null}
                      defaultProcessoId={adicionarProcessoId}
                      publicacao={selectedPublicacao}
                      hidePublicacaoCollapsible
                      secondarySave={{ label: "Salvar e ler", onAfterSuccess: markPubComoLida }}
                      tertiarySave={{ label: "Salvar e fechar", onAfterSuccess: fecharTudo }}
                      onAfterCreate={registrarItemCriado("prazo")}
                    />
                  </div>
                </div>
              )}
              {novaAudienciaOpen && (
                <NovaAudienciaPublicacaoDialog
                  inline
                  open={novaAudienciaOpen}
                  onOpenChange={setNovaAudienciaOpen}
                  publicacao={selectedPublicacao}
                  defaultProcessoNumero={adicionarProcessoNumero}
                  defaultProcessoId={adicionarProcessoId}
                  onMarkAsRead={markPubComoLida}
                  tertiarySave={{ label: "Salvar e fechar", onAfterSuccess: fecharTudo }}
                  onAfterCreate={registrarItemCriado("audiencia")}
                />
              )}
            </div>
          ) : null;
        })()}

        <div className={cn("space-y-6", (criarTarefaDialogOpen || novoEventoOpen || novoPrazoOpen || novaAudienciaOpen || !!itemEmEdicao || (!!selectedPublicacao && itensCriadosSessao.length > 0)) && "hidden")}>
        {/* Banners de execução DJEN */}
        <DjenExecutionBanner />

        {focusFromErrata && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2">
            <div className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>
                Foco da <strong>Errata DJEN</strong>: exibindo apenas {focusFromErrata.ids.size} publicação(ões) exclusivas de <strong>{focusFromErrata.rotulo}</strong>.
                Use os botões de "Gerar PDF/DOC Resumo" para resumir somente este lote.
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setFocusFromErrata(null)}>
              Limpar foco
            </Button>
          </div>
        )}

        {/* Stats Cards - Mobile optimized */}
        <div className="grid grid-cols-2 md:grid-cols-8 gap-2 md:gap-4">
          <Card
            className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => { setTipoOrigem('todos'); setReadStatus('todas'); setOcultarDuplicadas(false); }}
          >
            <CardContent className="p-3 md:pt-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 truncate">Total {periodoLabel}</p>
                  <p className="text-xl md:text-3xl font-bold text-blue-700 dark:text-blue-300">
                    {isLoadingStatsCards ? <Loader2 className="w-5 h-5 animate-spin" /> : totalGeralFiltrado}
                  </p>
                </div>
                <FileText className="w-6 h-6 md:w-10 md:h-10 text-blue-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => { setTipoOrigem('todos'); setReadStatus('nao_lidas'); }}
          >
            <CardContent className="p-3 md:pt-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-amber-600 dark:text-amber-400 truncate">Não Lidas</p>
                  <p className="text-xl md:text-3xl font-bold text-amber-700 dark:text-amber-300">
                    {isLoadingStatsCards ? <Loader2 className="w-5 h-5 animate-spin" /> : naoLidasTotalFiltrado}
                  </p>
                </div>
                <Eye className="w-6 h-6 md:w-10 md:h-10 text-amber-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => { setTipoOrigem('termo'); setReadStatus('todas'); }}
          >
            <CardContent className="p-3 md:pt-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-purple-600 dark:text-purple-400 truncate">Por Termos</p>
                  <p className="text-xl md:text-3xl font-bold text-purple-700 dark:text-purple-300">
                    {isLoadingStatsCards ? <Loader2 className="w-5 h-5 animate-spin" /> : totalTermosFiltrado}
                  </p>
                </div>
                <FileSearch className="w-6 h-6 md:w-10 md:h-10 text-purple-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => { setTipoOrigem('processo'); setReadStatus('todas'); }}
          >
            <CardContent className="p-3 md:pt-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-emerald-600 dark:text-emerald-400 truncate">Por Processos</p>
                  <p className="text-xl md:text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                    {isLoadingStatsCards ? <Loader2 className="w-5 h-5 animate-spin" /> : totalProcessosFiltrado}
                  </p>
                </div>
                <Gavel className="w-6 h-6 md:w-10 md:h-10 text-emerald-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/50 dark:to-rose-900/30 border-rose-200 dark:border-rose-800 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setTipoOrigem('descartada')}
          >
            <CardContent className="p-3 md:pt-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-rose-600 dark:text-rose-400 truncate">Descartadas</p>
                  <p className="text-xl md:text-3xl font-bold text-rose-700 dark:text-rose-300">
                    {isLoadingStatsCards ? <Loader2 className="w-5 h-5 animate-spin" /> : totalDescartadasFiltrado}
                  </p>
                </div>
                <Trash2 className="w-6 h-6 md:w-10 md:h-10 text-rose-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/30 border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => { setTipoOrigem('todos'); setOcultarDuplicadas(true); }}
          >
            <CardContent className="p-3 md:pt-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300 truncate">Publicações Únicas</p>
                  <p className="text-xl md:text-3xl font-bold text-slate-700 dark:text-slate-200">
                    {isLoadingStatsCards ? <Loader2 className="w-5 h-5 animate-spin" /> : totalUnicasFiltrado}
                  </p>
                </div>
                <Copy className="w-6 h-6 md:w-10 md:h-10 text-slate-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/30 border-indigo-200 dark:border-indigo-800 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setTipoOrigem('djet-pautas')}
          >
            <CardContent className="p-3 md:pt-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">Pautas DEJT</p>
                  <p className="text-xl md:text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                    {isLoadingStatsCards ? <Loader2 className="w-5 h-5 animate-spin" /> : totalPautasDejt}
                  </p>
                </div>
                <CalendarClock className="w-6 h-6 md:w-10 md:h-10 text-indigo-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setTipoOrigem('kurier')}
          >
            <CardContent className="p-3 md:pt-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-orange-600 dark:text-orange-400 truncate">Kurier</p>
                  <p className="text-xl md:text-3xl font-bold text-orange-700 dark:text-orange-300">
                    {isLoadingStatsCards ? <Loader2 className="w-5 h-5 animate-spin" /> : totalKurierVisivel}
                  </p>
                </div>
                <Zap className="w-6 h-6 md:w-10 md:h-10 text-orange-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros - Mobile optimized */}
        <Card>
          <CardHeader className="pb-2 md:pb-4 px-3 md:px-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Filter className="w-4 h-4 md:w-5 md:h-5" />
                Filtros
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setTipoOrigem('todos');
                  setMonitoramentoId("");
                  setTermoBusca("");
                  setTribunalFiltro("");
                  setDataDisponibilizacao("");
                  setDataPublicacao("");
                  setDataInicio("");
                  setDataFim("");
                  setFiltroDia('hoje');
                  setReadStatus('nao_lidas');
                  setOcultarDuplicadas(false);
                  setExecucaoFocada(null);
                }}
                title="Restaura todos os filtros aos padrões (mantém a coordenação selecionada)."
              >
                <RotateCcw className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                Limpar filtros
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Coordenação</Label>
                <select
                  className="w-full h-9 md:h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={coordenacaoId === null ? "__loading__" : (coordenacaoId || "__all__")}
                  onChange={(e) => setCoordenacaoId(e.target.value === "__all__" ? "" : e.target.value)}
                  disabled={coordenacaoId === null}
                >
                  {coordenacaoId === null && <option value="__loading__">Carregando...</option>}
                  {/* "Todas" só aparece se o usuário tem acesso a mais de 1 coordenação */}
                  {coordenacoesDoCombo.length > 1 && (
                    <option value="__all__">Todas as Coordenações</option>
                  )}
                  {coordenacoesDoCombo?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.id === userCoordenacao ? "(Minha)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Tipo de Origem</Label>
                <select
                  className="w-full h-9 md:h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={tipoOrigem}
                  onChange={(e) => setTipoOrigem(e.target.value as any)}
                >
                  <option value="todos">Todas (todas as origens)</option>
                  <option value="termo">Por Termos/OAB</option>
                  <option value="parte">Por Parte</option>
                  <option value="processo">Por Processos</option>
                  <option value="kurier">Kurier</option>
                  <option value="stf">STF</option>
                  <option value="datajud">DataJud (CNJ)</option>
                  <option value="djet-pautas">DEJT Pautas</option>
                  <option value="descartada">Descartadas (auditoria)</option>
                </select>
              </div>

              {coordenacaoFiltroEfetivo && tipoOrigem !== 'processo' && tipoOrigem !== 'descartada' && (
                <div className="space-y-1.5">
                  <Label className="text-xs md:text-sm">Termo</Label>
                  <select
                    className="w-full h-9 md:h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={monitoramentoId}
                    onChange={(e) => setMonitoramentoId(e.target.value)}
                  >
                    <option value="">Todos os termos</option>
                    {monitoramentos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.descricao || m.termo_busca || `${m.tipo || 'Termo'} ${m.oab || ''} ${m.uf || ''}`.trim() || m.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs md:text-sm">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Termo, processo ou palavra no conteúdo..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    className="pl-9 h-9 md:h-10 text-sm"
                    title="Busca em número do processo, termo monitorado e conteúdo da publicação."
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mt-3 md:mt-4">
              {coordenacaoFiltroEfetivo && tribunaisDisponiveis.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs md:text-sm">Tribunal</Label>
                  <select
                    className="w-full h-9 md:h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={tribunalFiltro}
                    onChange={(e) => setTribunalFiltro(e.target.value)}
                  >
                    <option value="">Todos os tribunais</option>
                    {tribunaisDisponiveis.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Data Disponibilização</Label>
                <Input
                  type="date"
                  value={dataDisponibilizacao}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDataDisponibilizacao(val);
                    if (val && val !== getHojeBrtISO()) {
                      setFiltroDia('todos');
                    }
                  }}
                  className="h-9 md:h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm" title="Data de publicação da comunicação (data_publicacao)">Data de Publicação</Label>
                <Input
                  type="date"
                  value={dataPublicacao}
                  onChange={(e) => setDataPublicacao(e.target.value)}
                  className="h-9 md:h-10 text-sm"
                />
              </div>

              {/* Filtros de data SEMPRE visíveis; só entram na busca se preenchidos. */}
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm" title="Data em que a publicação foi capturada no sistema">Data Início (captura)</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-9 md:h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm" title="Data em que a publicação foi capturada no sistema">Data Fim (captura)</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-9 md:h-10 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4 mt-3 md:mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Período</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={filtroDia === 'hoje' ? 'default' : 'outline'} onClick={() => setFiltroDia('hoje')}>
                    Somente Hoje
                  </Button>
                  <Button type="button" size="sm" variant={filtroDia === 'todos' ? 'default' : 'outline'} onClick={() => setFiltroDia('todos')}>
                    Todos os dias
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Leitura</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={readStatus === 'lidas' ? 'default' : 'outline'} onClick={() => setReadStatus('lidas')} disabled={tipoOrigem === 'descartada'}>
                    Lidas
                  </Button>
                  <Button type="button" size="sm" variant={readStatus === 'nao_lidas' ? 'default' : 'outline'} onClick={() => setReadStatus('nao_lidas')} disabled={tipoOrigem === 'descartada'}>
                    Não Lidas
                  </Button>
                  <Button type="button" size="sm" variant={readStatus === 'todas' ? 'default' : 'outline'} onClick={() => setReadStatus('todas')} disabled={tipoOrigem === 'descartada'}>
                    Todas
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Publicações</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={ocultarDuplicadas ? 'default' : 'outline'}
                    onClick={() => setOcultarDuplicadas(v => !v)}
                    title="Por padrão mostra TODAS as publicações. Clique para mostrar somente uma publicação por processo+conteúdo (na mesma coordenação). Não altera o banco."
                  >
                    <Layers className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                    {ocultarDuplicadas ? 'Mostrar todas' : 'Mostrar somente únicas'}
                    {ocultarDuplicadas && totalDuplicadasOcultas > 0 && (
                      <span className="ml-2 rounded-full bg-background/30 px-2 py-0.5 text-[10px] font-semibold">
                        {totalDuplicadasOcultas} ocultas
                      </span>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={descartarDuplicadasCoordenacao}
                    disabled={
                      descartandoDuplicadas ||
                      !coordenacaoFiltroEfetivo ||
                      (!isAdmin && !userCoordenacaoIds.includes(coordenacaoFiltroEfetivo))
                    }
                    title={
                      !coordenacaoFiltroEfetivo
                        ? 'Selecione uma coordenação específica para habilitar o descarte.'
                        : (!isAdmin && !userCoordenacaoIds.includes(coordenacaoFiltroEfetivo))
                          ? 'Você não pertence a esta coordenação. Apenas administradores podem descartar de qualquer coordenação.'
                          : 'Descarta em lote as publicações duplicadas (mesmo processo + dia + conteúdo) da coordenação. Se o intervalo estiver vazio, usa os filtros de data da tela antes de cair para hoje. Mantém a mais antiga de cada grupo. Pode ser desfeito.'
                    }
                  >
                    {descartandoDuplicadas ? (
                      <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
                    ) : (
                      <Trash className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                    )}
                    Descartar duplicadas da coordenação
                  </Button>
                  <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap">Intervalo descarte:</span>
                    <input
                      type="date"
                      value={descarteDataInicio}
                      onChange={(e) => setDescarteDataInicio(e.target.value)}
                      className="h-7 rounded border border-input bg-background px-1 text-xs"
                      title="Data inicial. Se vazio, usa os filtros de data da tela antes de cair para hoje."
                    />
                    <span className="text-muted-foreground">a</span>
                    <input
                      type="date"
                      value={descarteDataFim}
                      onChange={(e) => setDescarteDataFim(e.target.value)}
                      className="h-7 rounded border border-input bg-background px-1 text-xs"
                      title="Data final. Se vazio, usa os filtros de data da tela antes de cair para hoje."
                    />
                    {(descarteDataInicio || descarteDataFim) && (
                      <button
                        type="button"
                        onClick={() => { setDescarteDataInicio(""); setDescarteDataFim(""); }}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        title="Limpar intervalo (volta a usar os filtros de data da tela)"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {lotesRecentes.length > 0 && tipoOrigem === 'descartada' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => desfazerDescarteLote(lotesRecentes[0].lote_id)}
                      disabled={!!desfazendoLote}
                      title={`Desfazer descarte de ${lotesRecentes[0].total} publicação(ões) por ${lotesRecentes[0].nome} em ${format(parseISO(lotesRecentes[0].created_at), "dd/MM HH:mm", { locale: ptBR })}`}
                    >
                      {desfazendoLote ? (
                        <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
                      ) : (
                        <Undo2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                      )}
                      Desfazer último ({lotesRecentes[0].total}) — {lotesRecentes[0].nome}
                    </Button>
                  )}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Diferenças entre execuções locais do dia (Termos/Kurier/Processos) */}
        <ExecucoesDoDiaLocalCard
          coordenacaoId={coordenacaoFiltroEfetivo || null}
          dataDisponibilizacao={dataDisponibilizacaoDebounced || null}
          execucaoSelecionadaId={execucaoFocada?.id || null}
          onSelecionarExecucao={(exec) => setExecucaoFocada(exec)}
        />

        {/* Admin: comparação de execuções do dia por coordenação */}
        {isAdmin && (dataDisponibilizacaoDebounced || dataPublicacaoDebounced) && (
          <ExecucoesDoDiaAdminCard
            dataYmd={dataDisponibilizacaoDebounced || dataPublicacaoDebounced}
          />
        )}

        {/* Actions - Mobile optimized */}
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            disabled={allPublicacoes.length === 0}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
          >
            {selectedIds.size === allPublicacoes.length && allPublicacoes.length > 0
              ? "Desmarcar"
              : `Selecionar todos (${totalExibidoNaPagina})`}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleMarcarLidas}
            disabled={selectedIds.size === 0}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
          >
            {marcarComoLida.isPending ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">Marcar Lida</span>
            <span className="sm:hidden">Lida</span>
            <span className="ml-1">({selectedIds.size})</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreagendarIaOpen(true)}
            disabled={selectedIds.size === 0}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 text-violet-700 hover:bg-violet-50 border-violet-300"
            title="Analisa selecionadas com IA e propõe tarefas/prazos/audiências/eventos"
          >
            <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Pré-agendar IA</span>
            <span className="sm:hidden">IA</span>
            <span className="ml-1">({selectedIds.size})</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDescartarSelecionadas}
            disabled={selectedIds.size === 0 || descartandoSelecionadas || descartarManualmente.isPending}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            title="Analisa as selecionadas e descarta apenas as duplicadas (mesma coordenação + id_djen)"
          >
            {descartandoSelecionadas ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">Descartar Selecionadas</span>
            <span className="sm:hidden">Descartar</span>
            <span className="ml-1">({selectedIds.size})</span>
          </Button>

          {acoesSessao.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={desfazerUltimaAcaoSessao}
              disabled={desfazendoAcao}
              className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-300"
              title={`Desfazer: ${acoesSessao[acoesSessao.length - 1].label}`}
            >
              {desfazendoAcao ? (
                <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
              ) : (
                <Undo2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              )}
              <span className="hidden sm:inline">Desfazer último</span>
              <span className="sm:hidden">Desfazer</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleDescartarDuplicadasSelecionadas}
            disabled={selectedIds.size < 2 || descartandoDupSelecionadas || descartarManualmente.isPending}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-300"
            title="Descarta apenas as duplicadas entre as selecionadas, mantendo uma por grupo (mesma coordenação + id_djen)"
          >
            {descartandoDupSelecionadas ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <Copy className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">Descartar duplicadas selecionadas</span>
            <span className="sm:hidden">Duplicadas</span>
            <span className="ml-1">({selectedIds.size})</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarPdf}
            disabled={allPublicacoes.length === 0}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
          >
            <FileDown className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Gerar PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>


          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarPdfResumoSemIA}
            disabled={allPublicacoes.length === 0 || gerandoResumoSemIA}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 border-slate-400 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-900/30"
          >
            {gerandoResumoSemIA ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <FileDown className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">{gerandoResumoSemIA ? "Gerando..." : "Gerar PDF Resumo"}</span>
            <span className="sm:hidden">{gerandoResumoSemIA ? "..." : "PDF Resumo"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarPdfResumoSemRepeticao}
            disabled={allPublicacoes.length === 0 || gerandoResumoSemRepeticao}
            title="Mesmo Resumo sem IA, descartando publicações idênticas para o mesmo processo (varia só o intimado)"
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 border-slate-400 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-900/30"
          >
            {gerandoResumoSemRepeticao ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <FileDown className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">{gerandoResumoSemRepeticao ? "Gerando..." : "Resumo PDF sem repetição"}</span>
            <span className="sm:hidden">{gerandoResumoSemRepeticao ? "..." : "Sem repetição"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarDocResumoSemRepeticao}
            disabled={allPublicacoes.length === 0 || gerandoDocResumoSemRepeticao}
            title="Mesmo Doc Resumo, descartando publicações idênticas para o mesmo processo (varia só o intimado)"
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 border-slate-400 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-900/30"
          >
            {gerandoDocResumoSemRepeticao ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <Download className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">{gerandoDocResumoSemRepeticao ? "Gerando..." : "Resumo DOC sem repetição"}</span>
            <span className="sm:hidden">{gerandoDocResumoSemRepeticao ? "..." : "DOC s/ rep."}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarDocResumoSemIA}
            disabled={allPublicacoes.length === 0 || gerandoDocResumoSemIA}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 border-slate-400 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-900/30"
          >
            {gerandoDocResumoSemIA ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <Download className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">{gerandoDocResumoSemIA ? "Gerando..." : "Gerar Doc Resumo"}</span>
            <span className="sm:hidden">{gerandoDocResumoSemIA ? "..." : "Doc Resumo"}</span>
          </Button>

          <Button
              variant="outline"
              size="sm"
              onClick={handleGerarDocsTST}
              disabled={allPublicacoes.length === 0 || gerandoDocsTST}
              className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
            >
              {gerandoDocsTST ? (
                <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
              ) : (
                <Gavel className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              )}
              <span className="hidden sm:inline">{gerandoDocsTST ? "Classificando..." : "Docs TST"}</span>
              <span className="sm:hidden">{gerandoDocsTST ? "..." : "TST"}</span>
          </Button>

          <Button
            variant={expandedPublicacoes.size > 0 ? "default" : "outline"}
            size="sm"
            onClick={toggleExpandAll}
            disabled={allPublicacoes.length === 0}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
          >
            <ChevronsUpDown className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">
              {expandedPublicacoes.size > 0 && expandedPublicacoes.size >= allPublicacoes.length
                ? "Recolher Todos"
                : "Expandir Todos"}
            </span>
            <span className="sm:hidden">
              {expandedPublicacoes.size > 0 && expandedPublicacoes.size >= allPublicacoes.length
                ? "−"
                : "+"}
            </span>
          </Button>

          <Button
            variant={expandirGeralAtivo ? "default" : "outline"}
            size="sm"
            onClick={toggleExpandirGeral}
            disabled={allPublicacoes.length === 0}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
            title={expandirGeralAtivo ? "Recolher tudo e restaurar scroll" : "Expandir todas sem scroll (conteúdo completo)"}
          >
            {expandirGeralAtivo ? (
              <>
                <Minimize2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Recolher Geral</span>
                <span className="sm:hidden">−G</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Expandir Geral</span>
                <span className="sm:hidden">+G</span>
              </>
            )}
          </Button>
        </div>

        {/* Results by Coordination */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : allPublicacoes.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhuma publicação encontrada</p>
                <p className="text-sm mt-1">
                  {apenasHoje ? "Não há publicações novas para hoje com os filtros atuais." : "Ajuste os filtros para ver publicações."}
                </p>
                {tipoOrigem !== 'todos' && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <p className="text-xs">
                      Filtro <strong>Tipo de Origem</strong> ativo: <strong>{tipoOrigem}</strong>
                      {totalHoje > 0 && <> · existem <strong>{totalHoje}</strong> publicação(ões) sem esse filtro</>}
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setTipoOrigem('todos')}>
                      Limpar filtro de origem
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Controle TOPO: paginação client-side de apresentação */}
            {visibleIdsSet && tipoOrigem !== 'descartada' && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1">
                <div className="text-xs md:text-sm text-muted-foreground">
                  Mostrando <strong>{totalRenderizadoNaTela}</strong> de{' '}
                  <strong>{allPublicacoes.length}</strong>
                  {temMaisResultados && (
                    <> (total filtrado: <strong>{totalFiltradoGeral}</strong>)</>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayLimit((d) => d + DISPLAY_PAGE_SIZE)}
                >
                  Carregar mais {Math.min(DISPLAY_PAGE_SIZE, allPublicacoes.length - totalRenderizadoNaTela)}
                </Button>
              </div>
            )}
            {coordenacoesOrdenadas
              .filter((grupo) => !visibleIdsSet || grupo.publicacoes.some(p => visibleIdsSet.has(p.id)))
              .map((grupo) => {
              const contadoresGrupo = getGrupoContadores(grupo);
              return (
              <Card key={grupo.coordenacao_id}>
                <Collapsible
                  open={expandedCoordenacoes.has(grupo.coordenacao_id) || expandedCoordenacoes.has('all')}
                  onOpenChange={() => toggleCoordenacao(grupo.coordenacao_id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors px-3 md:px-6 py-3 md:py-4">
                      <div className="flex items-start md:items-center justify-between gap-2">
                        <div className="flex items-start md:items-center gap-2 md:gap-3 min-w-0 flex-1">
                          {expandedCoordenacoes.has(grupo.coordenacao_id) || expandedCoordenacoes.has('all') ? (
                            <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground flex-shrink-0 mt-0.5 md:mt-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground flex-shrink-0 mt-0.5 md:mt-0" />
                          )}
                          <Building2 className="w-4 h-4 md:w-5 md:h-5 text-primary flex-shrink-0 mt-0.5 md:mt-0" />
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm md:text-lg truncate">{grupo.coordenacao_nome}</CardTitle>
                            <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-1">
                              <Badge variant="secondary" className="text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                {contadoresGrupo.total} pub.
                              </Badge>
                              <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                {contadoresGrupo.termos} termos
                              </Badge>
                              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                {contadoresGrupo.processos} proc.
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Badge 
                          variant="default" 
                          className={cn(
                            "flex-shrink-0 text-[10px] md:text-xs px-1.5 md:px-2",
                            contadoresGrupo.naoLidas > 0 
                              ? "bg-amber-500" 
                              : "bg-green-500"
                          )}
                        >
                          {contadoresGrupo.naoLidas}
                          <span className="hidden sm:inline ml-1">não lidas</span>
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 px-2 md:px-6 pb-3">
                      <div className="space-y-2 md:space-y-3">
                        {(visibleIdsSet
                          ? grupo.publicacoes.filter(p => visibleIdsSet.has(p.id))
                          : grupo.publicacoes
                        ).map((pub) => {
                          const isExpanded = expandedPublicacoes.has(pub.id);
                          return (
                          <div
                            key={pub.id}
                            className={cn(
                              "border rounded-lg p-2 md:p-4 transition-colors",
                              selectedIds.has(pub.id) && "bg-primary/5 border-primary/30",
                              !pub.lida && "border-l-4 border-l-primary"
                            )}
                          >
                            <div className="flex items-start gap-2 md:gap-3">
                              <Checkbox
                                checked={selectedIds.has(pub.id)}
                                onCheckedChange={() => toggleSelect(pub.id, pub.tipo_origem as TipoOrigemPublicacao)}
                                className="mt-0.5"
                              />
                              
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1.5 md:mb-2">
                                  {/* Data da publicação à esquerda */}
                                  <span className="text-[10px] md:text-xs text-muted-foreground flex-shrink-0">
                                    {formatDateShort(pub.data_publicacao)}
                                  </span>
                                  {/* Badge da Coordenação - sempre visível quando há nome */}
                                  {pub.coordenacao_nome && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5 max-w-[120px] md:max-w-[180px] truncate">
                                      <Building2 className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
                                      <span className="truncate">{pub.coordenacao_nome}</span>
                                    </Badge>
                                  )}
                                  
                                  {pub.tipo_origem === 'datajud' ? (
                                    <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 hover:bg-cyan-100 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                      <Database className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
                                      DataJud (CNJ)
                                    </Badge>
                                  ) : pub.tipo_origem === 'descartada' ? (
                                    <>
                                      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                        DESCARTADA
                                      </Badge>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-5 md:h-6 px-1.5 md:px-2 text-[10px] md:text-xs border-red-300 text-red-700 hover:bg-red-50"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (!confirm('Desfazer o descarte desta publicação? Ela voltará para a lista ativa.')) return;
                                          try {
                                            const { error } = await (supabase as any).rpc('desfazer_descarte_individual', { p_id: pub.id });
                                            if (error) throw error;
                                            await Promise.all([
                                              queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] }),
                                              queryClient.invalidateQueries({ queryKey: ['descartadas-dedup'] }),
                                              queryClient.invalidateQueries({ queryKey: ['descartadas-count'] }),
                                              queryClient.invalidateQueries({ queryKey: ['descartadas-lotes-recentes'] }),
                                            ]);
                                            toast.success('Descarte desfeito. Publicação restaurada.');
                                          } catch (err: any) {
                                            toast.error(`Erro ao desfazer descarte: ${err?.message || err}`);
                                          }
                                        }}
                                        title="Desfazer descarte desta publicação"
                                      >
                                        <Undo2 className="w-3 h-3 mr-1" />
                                        Desfazer descarte
                                      </Button>
                                    </>
                                    ) : (pub.processo_id || importedProcessos[pub.id]) ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                      <Gavel className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
                                      <span className="hidden sm:inline">Processo Cadastrado</span>
                                      <span className="sm:hidden">Processo</span>
                                    </Badge>
                                  ) : null}

                                  {(pub.fonte || '').toLowerCase() === 'kurier' && (
                                    <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                      <Zap className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
                                      Kurier
                                    </Badge>
                                  )}
                                  
                                  {!pub.lida && (
                                    <Badge variant="default" className="bg-amber-500 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                      Nova
                                    </Badge>
                                  )}
                                  
                                  {/* Mostrar quem já leu esta publicação */}
                                  {pub.lido_por && pub.lido_por.length > 0 && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                      <CheckCheck className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
                                      <span title={pub.lido_por.map(l => `${l.nome} em ${new Date(l.lida_em).toLocaleString('pt-BR')}`).join('\n')}>
                                        Lida por {pub.lido_por.map(l => l.nome.split(' ')[0]).join(', ')}
                                      </span>
                                    </Badge>
                                  )}
                                  
                                   {/* Termo que encontrou a publicação */}
                                   {getMonitoramentoBadgeLabel(pub) && (
                                     <MonitoramentoTermoBadge
                                       label={getMonitoramentoBadgeLabel(pub)!}
                                       monitoramentoId={pub.monitoramento_id}
                                     />
                                   )}
                                </div>

                                {/* Motivo do descarte - destacado em linha própria */}
                                {pub.tipo_origem === 'descartada' && (
                                  <div className="mb-2 rounded-md border border-red-300 bg-red-50 px-2 py-1.5 text-xs md:text-sm text-red-800">
                                    <span className="font-semibold">Motivo do descarte: </span>
                                    <span className="break-words">
                                      {pub.motivo_descarte || 'Não informado'}
                                    </span>
                                    <div className="mt-1">
                                      <span className="font-semibold">Descartado por: </span>
                                      <span className="break-words">
                                        {pub.descartado_por_nome || (pub.descartado_por ? 'Usuário' : 'Sistema')}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Process number with eye button inline */}
                                <div 
                                  className="cursor-pointer select-none"
                                  onClick={() => toggleExpandPublicacao(pub.id)}
                                >
                                  {pub.processo_numero && (
                                    <div className="flex items-start md:items-center gap-1 md:gap-2 mb-1 flex-wrap">
                                      {isExpanded ? (
                                        <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0 mt-0.5 md:mt-0" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0 mt-0.5 md:mt-0" />
                                      )}
                                      <p
                                        className={cn(
                                          "text-xs md:text-sm font-medium hover:underline break-all",
                                          tipoOrigem === 'djet-pautas'
                                            ? "text-[#1E3A5F]"
                                            : "text-primary"
                                        )}
                                      >
                                        Processo {formatProcessoNumero(pub.processo_numero)}
                                      </p>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const formatted = formatProcessoNumero(pub.processo_numero!);
                                          navigator.clipboard.writeText(formatted);
                                          toast.success("Número copiado!");
                                        }}
                                        title="Copiar número do processo"
                                        className="p-0.5 h-auto flex-shrink-0"
                                      >
                                        <Copy className="w-3 h-3 md:w-3.5 md:h-3.5 text-muted-foreground hover:text-foreground" />
                                      </Button>
                                      {/* Link para detalhes do processo - qualquer tipo de origem com processo_id */}
                                      {(pub.processo_id || importedProcessos[pub.id]) && (
                                        <Link 
                                          to={`/processos/${pub.processo_id || importedProcessos[pub.id]}`}
                                          className="text-[10px] md:text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 md:gap-1 flex-shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <ExternalLink className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                          <span className="hidden sm:inline">Ver processo</span>
                                        </Link>
                                      )}

                                       {/* Etiquetas da publicação */}
                                       <div
                                         className="flex-shrink-0"
                                         onClick={(e) => e.stopPropagation()}
                                       >
                                         <EtiquetaPicker
                                           entidade="publicacao"
                                           entidadeId={pub.id}
                                           coordenacaoId={(pub as any).coordenacao_id ?? undefined}
                                           coordenacaoNome={pub.coordenacao_nome ?? undefined}
                                           compact
                                         />
                                       </div>

                                        {/* Ações de vínculo/importação */}
                                       {(pub.processo_id || importedProcessos[pub.id]) ? (
                                         <Button
                                           variant="outline"
                                           size="sm"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             const pid = pub.processo_id || importedProcessos[pub.id];
                                             handleSalvarPublicacao({ ...pub, processo_id: pid });
                                           }}
                                           disabled={savingProcessoId === pub.id}
                                           title="Vincular publicação ao processo (criar movimentação)"
                                           className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-400"
                                         >
                                           {savingProcessoId === pub.id ? (
                                             <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 animate-spin" />
                                           ) : (
                                             <Save className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                           )}
                                           <span className="text-xs">Salvar</span>
                                         </Button>
                                       ) : pub.tipo_origem === 'termo' ? (
                                         <Button
                                           variant="outline"
                                           size="sm"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleImportarProcesso(pub);
                                           }}
                                           disabled={importingProcessoId === pub.id}
                                           title="Importar processo e criar pasta"
                                           className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-400"
                                         >
                                           {importingProcessoId === pub.id ? (
                                             <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 animate-spin" />
                                           ) : (
                                             <FolderPlus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                           )}
                                           <span className="text-xs">Importar</span>
                                         </Button>
                                       ) : pub.tipo_origem === 'descartada' && pub.processo_numero ? (
                                         <Button
                                           variant="outline"
                                           size="sm"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleImportarProcesso(pub);
                                           }}
                                           disabled={importingProcessoId === pub.id}
                                           title="Importar processo descartado e criar pasta"
                                           className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-400"
                                         >
                                           {importingProcessoId === pub.id ? (
                                             <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 animate-spin" />
                                           ) : (
                                             <FolderPlus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                           )}
                                           <span className="text-xs">Importar</span>
                                         </Button>
                                       ) : null}
                                       
                                        <DropdownMenu>
                                          <DropdownMenuTrigger
                                            asChild
                                            onClick={(e) => {
                                              e.stopPropagation();
                                            }}
                                          >
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              title="Adicionar item a partir desta publicação"
                                              className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                                            >
                                              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                              <span className="text-xs">Adicionar</span>
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenuItem onSelect={() => setTimeout(() => handleCriarTarefa(pub), 0)}>
                                              <ClipboardList className="w-4 h-4 mr-2" /> Tarefa
                                            </DropdownMenuItem>
                                             <DropdownMenuItem onSelect={() => setTimeout(async () => { await handleAdicionarClick(pub); setNovoEventoOpen(true); }, 0)}>
                                              <CalendarPlus className="w-4 h-4 mr-2" /> Evento
                                            </DropdownMenuItem>
                                             <DropdownMenuItem onSelect={() => setTimeout(async () => { await handleAdicionarClick(pub); setNovoPrazoOpen(true); }, 0)}>
                                              <Clock className="w-4 h-4 mr-2" /> Prazo
                                            </DropdownMenuItem>
                                             <DropdownMenuItem onSelect={() => setTimeout(async () => { await handleAdicionarClick(pub); setNovaAudienciaOpen(true); }, 0)}>
                                              <Gavel className="w-4 h-4 mr-2" /> Audiência
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                       
                                       {/* Botão Marcar como Lida individual */}
                                       {!pub.lida && (
                                         <Button
                                           variant="outline"
                                           size="sm"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             marcarComoLida.mutate([{ id: pub.id, tipo_origem: pub.tipo_origem }]);
                                           }}
                                           disabled={false}
                                           title="Marcar como lida"
                                           className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                                         >
                                           <CheckCheck className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                           <span className="text-xs">Lida</span>
                                         </Button>
                                       )}

                                        {/* Botão Descartar individual */}
                                        {(pub.tipo_origem === 'termo' || pub.tipo_origem === 'processo') && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (window.confirm('Descartar esta publicação? Ela será movida para a aba "Descartadas" e poderá ser restaurada de lá.')) {
                                                descartarManualmente.mutate({ id: pub.id, tipo_origem: pub.tipo_origem as 'termo' | 'processo' });
                                              }
                                            }}
                                            disabled={descartarManualmente.isPending}
                                            title="Descartar publicação"
                                            className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0 text-rose-600 hover:text-rose-700"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                            <span className="text-xs">Descartar</span>
                                          </Button>
                                        )}

                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           handleView(pub);
                                         }}
                                          title="Expandir/recolher publicação"
                                         className="p-1 md:p-1.5 h-auto flex-shrink-0 ml-auto"
                                       >
                                         <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                       </Button>
                                    </div>
                                  )}

                                  {!pub.processo_numero && (
                                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                                      {isExpanded ? (
                                        <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0" />
                                      )}
                                      <span className="text-xs md:text-sm text-muted-foreground hover:text-foreground">
                                        Clique para ver detalhes
                                      </span>
                                       <DropdownMenu>
                                         <DropdownMenuTrigger
                                           asChild
                                           onClick={(e) => {
                                             e.stopPropagation();
                                           }}
                                         >
                                           <Button
                                             variant="outline"
                                             size="sm"
                                             title="Adicionar item a partir desta publicação"
                                             className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                                           >
                                             <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                             <span className="text-xs">Adicionar</span>
                                           </Button>
                                         </DropdownMenuTrigger>
                                         <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
                                           <DropdownMenuItem onSelect={() => setTimeout(() => handleCriarTarefa(pub), 0)}>
                                             <ClipboardList className="w-4 h-4 mr-2" /> Tarefa
                                           </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setTimeout(async () => { await handleAdicionarClick(pub); setNovoEventoOpen(true); }, 0)}>
                                             <CalendarPlus className="w-4 h-4 mr-2" /> Evento
                                           </DropdownMenuItem>
                                           <DropdownMenuItem onSelect={() => setTimeout(async () => { await handleAdicionarClick(pub); setNovoPrazoOpen(true); }, 0)}>
                                             <Clock className="w-4 h-4 mr-2" /> Prazo
                                           </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setTimeout(async () => { await handleAdicionarClick(pub); setNovaAudienciaOpen(true); }, 0)}>
                                             <Gavel className="w-4 h-4 mr-2" /> Audiência
                                           </DropdownMenuItem>
                                         </DropdownMenuContent>
                                       </DropdownMenu>
                                      
                                      {/* Botão Marcar como Lida individual */}
                                      {!pub.lida && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            marcarComoLida.mutate([{ id: pub.id, tipo_origem: pub.tipo_origem }]);
                                          }}
                                          disabled={false}
                                          title="Marcar como lida"
                                          className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                                        >
                                          <CheckCheck className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                          <span className="text-xs">Lida</span>
                                        </Button>
                                      )}

                                       {/* Botão Descartar individual */}
                                       {(pub.tipo_origem === 'termo' || pub.tipo_origem === 'processo') && (
                                         <Button
                                           variant="outline"
                                           size="sm"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             if (window.confirm('Descartar esta publicação? Ela será movida para a aba "Descartadas".')) {
                                               descartarManualmente.mutate({ id: pub.id, tipo_origem: pub.tipo_origem as 'termo' | 'processo' });
                                             }
                                           }}
                                           disabled={descartarManualmente.isPending}
                                           title="Descartar publicação"
                                           className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0 text-rose-600 hover:text-rose-700"
                                         >
                                           <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                           <span className="text-xs">Descartar</span>
                                         </Button>
                                       )}

                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleView(pub);
                                        }}
                                        title="Expandir/recolher publicação"
                                        className="p-1 md:p-1.5 h-auto flex-shrink-0 ml-auto"
                                      >
                                        <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                      </Button>
                                    </div>
                                  )}

                                  {/* Datas inline - sempre visíveis */}
                                  <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs ml-4 md:ml-6 mb-1.5">
                                    {pub.tribunal && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                                        {pub.tribunal}
                                      </span>
                                    )}
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground font-medium">Disp:</span>
                                      <span className="text-amber-600 dark:text-amber-400">{formatDateOnly(pub.data_disponibilizacao)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground font-medium">Pub:</span>
                                      <span className="text-amber-600 dark:text-amber-400">{formatDateOnly(pub.data_publicacao)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground font-medium">Captura:</span>
                                      <span className="text-muted-foreground">{formatDateShort(pub.created_at)}</span>
                                    </div>
                                    {(pub.fonte || '').toLowerCase() === 'kurier' && kurierLoginsMap[pub.id] && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground font-medium">Login Kurier:</span>
                                        <span className="font-mono text-orange-700 dark:text-orange-400">{kurierLoginsMap[pub.id]}</span>
                                      </div>
                                    )}
                                  </div>

                                  {pub.tipo_origem === 'processo' && (pub.polo_ativo || pub.polo_passivo) && (
                                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1 ml-4 md:ml-6 break-words">
                                      {pub.polo_ativo && <span><strong>Ativo:</strong> {pub.polo_ativo}</span>}
                                      {pub.polo_ativo && pub.polo_passivo && <br className="md:hidden" />}
                                      {pub.polo_ativo && pub.polo_passivo && <span className="hidden md:inline"> | </span>}
                                      {pub.polo_passivo && <span><strong>Passivo:</strong> {pub.polo_passivo}</span>}
                                    </p>
                                  )}

                                  {!isExpanded && (
                                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 ml-4 md:ml-6 break-words overflow-hidden">
                                      {stripHtmlAndDecodeEntities(pub.conteudo).substring(0, 200) || "Sem conteúdo"}...
                                    </p>
                                  )}
                                </div>

                                {/* Expanded inline content - formato oficial DJEN */}
                                {isExpanded && (
                                  <div className="mt-2 md:mt-3 border-t pt-2 md:pt-3">
                                    <PublicacaoConteudoDjen
                                      processoNumero={pub.processo_numero}
                                      tribunal={pub.tribunal}
                                      fonte={pub.fonte}
                                      dataDisponibilizacao={pub.data_disponibilizacao}
                                      dataPublicacao={pub.data_publicacao}
                                      conteudo={pub.conteudo}
                                      poloAtivo={pub.polo_ativo}
                                      poloPassivo={pub.polo_passivo}
                                      monitoramentoOab={pub.monitoramento_oab}
                                      monitoramentoUf={pub.monitoramento_uf}
                                      monitoramentoTermo={pub.monitoramento_termo}
                                      monitoramentoDescricao={pub.monitoramento_descricao}
                                      monitoramentoTipo={pub.monitoramento_tipo}
                                      maxHeight={expandirGeralAtivo ? undefined : "500px"}
                                      orgaoEstruturado={pub.orgao}
                                      tipoComunicacaoEstruturado={pub.tipo_comunicacao}
                                      meioEstruturado={pub.meio}
                                      partesJson={pub.partes_json}
                                      advogadosJson={pub.advogados_json}
                                      expandirGeralExterno={expandirGeralAtivo}
                                    />
                                    <ComentariosPublicacaoDjen publicacaoId={pub.id} />
                                  </div>
                                )}

                              </div>
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
              );
            })}
          </div>
        )}

        {/* Total exibido — sem paginação para não ocultar publicações do dia */}
        {!isLoading && allPublicacoes.length > 0 && (
          <div className="flex flex-col items-center justify-center gap-3 mt-4 px-2">
            <div className="text-xs md:text-sm text-muted-foreground text-center">
              {tipoOrigem === 'descartada' ? (
                <>
                  Exibindo <strong>{publicacoesParaListagem.length}</strong> de{' '}
                  <strong>{descartadasTotalServidor}</strong> descartadas
                  {descartadasTotalPages > 1 && (
                    <> — página <strong>{descartadasPage}</strong> de <strong>{descartadasTotalPages}</strong></>
                  )}
                </>
              ) : (
                <>
                  Mostrando <strong>{totalRenderizadoNaTela}</strong> de{' '}
                  <strong>{allPublicacoes.length}</strong>
                  {temMaisResultados ? <> (total filtrado: <strong>{totalFiltradoGeral}</strong>)</> : null}
                </>
              )}
            </div>
            {tipoOrigem === 'descartada' && descartadasTotalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDescartadasPage(1)}
                  disabled={descartadasPage === 1}
                >
                  « Primeira
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDescartadasPage((p) => Math.max(1, p - 1))}
                  disabled={descartadasPage === 1}
                >
                  ‹ Anterior
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {descartadasPage} / {descartadasTotalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDescartadasPage((p) => Math.min(descartadasTotalPages, p + 1))}
                  disabled={descartadasPage >= descartadasTotalPages}
                >
                  Próxima ›
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDescartadasPage(descartadasTotalPages)}
                  disabled={descartadasPage >= descartadasTotalPages}
                >
                  Última »
                </Button>
              </div>
            )}
            {tipoOrigem !== 'descartada' && visibleIdsSet && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDisplayLimit((d) => d + DISPLAY_PAGE_SIZE)}
              >
                Carregar mais {Math.min(DISPLAY_PAGE_SIZE, allPublicacoes.length - totalRenderizadoNaTela)}
              </Button>
            )}
            {tipoOrigem !== 'descartada' && !visibleIdsSet && temMaisResultados && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setListLimit((current) => current + LOAD_MORE_INCREMENT)}
                disabled={isFetchingPublicacoes}
              >
                {isFetchingPublicacoes ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Buscar mais do servidor (+{LOAD_MORE_INCREMENT})
              </Button>
            )}
          </div>
        )}

        </div>

        {/* Novo Evento, Novo Prazo e Nova Audiência agora são renderizados
            inline no topo da página (ver bloco acima), para esconder a lista
            e abrir o formulário na mesma tela. */}
      </div>
      <PreagendarIaDialog
        open={preagendarIaOpen}
        onOpenChange={setPreagendarIaOpen}
        publicacaoIds={Array.from(selectedIds.keys())}
        coordenacaoId={coordenacaoId ?? undefined}
      />
    </MainLayout>
  );
};

export default AnaliseDjen;
