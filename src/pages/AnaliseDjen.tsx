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
import { addDays, endOfDay, format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatProcessoNumero } from "@/lib/utils";
import { formatConteudoParaExibicao, conteudoDisplayClasses, formatDateOnly, formatDateOnlyFull } from "@/utils/formatConteudo";
import { conteudoContemFraseExata } from "@/utils/djenTermoMatch";

import { usePublicacoesDjenUnificadas, PublicacaoUnificada, FiltroLeituraDjen } from "@/hooks/usePublicacoesDjenUnificadas";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { CriarTarefaPublicacaoDialog } from "@/components/djen/CriarTarefaPublicacaoDialog";
import { DjenExecutionBanner } from "@/components/djen/DjenExecutionBanner";
import { DjenExecutionBannerPro } from "@/components/djen/DjenExecutionBannerPro";
import { PublicacaoConteudoDjen, getPartesEAdvogadosParaExibicao } from "@/components/djen/PublicacaoConteudoDjen";
import { ComentariosPublicacaoDjen } from "@/components/djen/ComentariosPublicacaoDjen";
import { jsPDF } from "jspdf";
import { dedupePublicacoesDjen } from "@/utils/djenDedup";

type TipoOrigemPublicacao = 'termo' | 'processo' | 'descartada' | 'datajud';
type TipoFiltroOrigem = 'todos' | 'normal' | 'termo' | 'parte' | 'processo' | 'descartada' | 'datajud' | 'djet-pautas';
type FiltroDiaDjen = 'hoje' | 'todos';

const formatToUTC = (date: Date) => date.toISOString();

const dateLocalToUTCRange = (dateStr: string, isEnd: boolean): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isEnd) {
    const nextDay = addDays(new Date(year, month - 1, day), 1);
    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T02:59:59.999Z`;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T03:00:00Z`;
};

const AnaliseDjen = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [importingProcessoId, setImportingProcessoId] = useState<string | null>(null);
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
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [dataDisponibilizacao, setDataDisponibilizacao] = useState<string>("");
  const [termoBusca, setTermoBusca] = useState<string>("");
  const [monitoramentoId, setMonitoramentoId] = useState<string>("");
  const [filtroDia, setFiltroDia] = useState<FiltroDiaDjen>('hoje');
  const [readStatus, setReadStatus] = useState<FiltroLeituraDjen>('nao_lidas');
  const [tipoOrigem, setTipoOrigem] = useState<TipoFiltroOrigem>('todos');
  const apenasHoje = filtroDia === 'hoje';
  const apenasNaoLidas = readStatus === 'nao_lidas';
  // Evita travar a tela renderizando milhares de cards de uma vez.
  const INITIAL_LIST_LIMIT = 300;
  const LOAD_MORE_INCREMENT = 300;
  const [listLimit, setListLimit] = useState(INITIAL_LIST_LIMIT);

  // Debounce inputs digitáveis para evitar disparar 3+ queries pesadas
  // a cada tecla (termo de busca + data digitada manualmente).
  const termoBuscaDebounced = useDebouncedValue(termoBusca, 350);
  const dataInicioDebounced = useDebouncedValue(dataInicio, 250);
  const dataFimDebounced = useDebouncedValue(dataFim, 250);
  const dataDisponibilizacaoDebounced = useDebouncedValue(dataDisponibilizacao, 250);

  // Quando carregar a coordenação do usuário, definir como padrão
  useEffect(() => {
    if (!loadingUserCoord && coordenacaoId === null) {
      setCoordenacaoId(userCoordenacao || "");
    }
  }, [userCoordenacao, loadingUserCoord, coordenacaoId]);

  // Limpar termo ao trocar coordenação
  useEffect(() => {
    setMonitoramentoId("");
  }, [coordenacaoId]);
  
  // States
  const [selectedIds, setSelectedIds] = useState<Map<string, TipoOrigemPublicacao>>(
    new Map<string, TipoOrigemPublicacao>()
  );
  const [viewDialogOpen, setViewDialogOpen] = useState(false); // kept for potential future use
  const [criarTarefaDialogOpen, setCriarTarefaDialogOpen] = useState(false);
  const [selectedPublicacao, setSelectedPublicacao] = useState<PublicacaoUnificada | null>(null);
  const [expandedCoordenacoes, setExpandedCoordenacoes] = useState<Set<string>>(new Set(['all']));
  const [expandedPublicacoes, setExpandedPublicacoes] = useState<Set<string>>(new Set());
  const [expandirGeralAtivo, setExpandirGeralAtivo] = useState(false);
  const [gerandoDocResumo, setGerandoDocResumo] = useState(false);
  const [gerandoDocsTST, setGerandoDocsTST] = useState(false);

  useEffect(() => {
    setListLimit(INITIAL_LIST_LIMIT);
    setSelectedIds(new Map<string, TipoOrigemPublicacao>());
    setExpandedPublicacoes(new Set());
    setExpandirGeralAtivo(false);
  }, [coordenacaoId, filtroDia, readStatus, tipoOrigem, monitoramentoId, termoBuscaDebounced, dataInicioDebounced, dataFimDebounced, dataDisponibilizacaoDebounced]);

  // Determinar o filtro efetivo de coordenação
  const coordenacaoFiltroEfetivo = coordenacaoId === null 
    ? undefined
    : coordenacaoId === "" 
      ? undefined
      : coordenacaoId;
  
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
    totalHoje,
    naoLidasHoje,
    totalDescartadasHoje,
    totalTermosHoje,
    totalProcessosHoje,
  } = usePublicacoesDjenUnificadas({
    coordenacaoId: coordenacaoFiltroEfetivo,
    // Quando dataDisponibilizacao está preenchido, usar como dataInicio/dataFim para filtrar no banco
    dataInicio: apenasHoje ? undefined : (dataDisponibilizacaoDebounced || dataInicioDebounced || undefined),
    dataFim: apenasHoje ? undefined : (dataDisponibilizacaoDebounced || dataFimDebounced || undefined),
    termoBusca: termoBuscaDebounced || undefined,
    monitoramentoId: monitoramentoId || undefined,
    apenasNaoLidas,
    readStatus,
    apenasHoje,
    // 'todos' e 'normal' passam undefined para buscar termos e processos
    // datajud é tratado separadamente
    tipoOrigem: (tipoOrigem === 'todos' || tipoOrigem === 'normal' || tipoOrigem === 'datajud') ? undefined : tipoOrigem as any,
    // incluir descartadas APENAS quando o filtro 'descartada' estiver ativo
    incluirDescartadas: tipoOrigem === 'descartada',
    page: 1,
    // Quando há coordenação selecionada, carrega tudo de uma vez (sem paginação visual)
    pageSize: coordenacaoFiltroEfetivo ? 100000 : listLimit,
    desabilitarLista: tipoOrigem === 'datajud',
    desabilitarStats: tipoOrigem === 'datajud' || tipoOrigem === 'descartada' || tipoOrigem === 'djet-pautas',
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
        const today = new Date().toISOString().slice(0, 10);
        query = query.gte('created_at', `${today}T00:00:00Z`);
      } else {
        if (dataInicioDebounced) query = query.gte('created_at', `${dataInicioDebounced}T00:00:00Z`);
        if (dataFimDebounced) query = query.lte('created_at', `${dataFimDebounced}T23:59:59Z`);
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
        const today = new Date().toISOString().slice(0, 10);
        let query = supabase
          .from('movimentacoes_datajud')
          .select('id', { count: 'exact', head: true });
        if (apenasHoje) {
          query = query.gte('created_at', `${today}T00:00:00Z`);
        } else {
          if (dataInicioDebounced) query = query.gte('created_at', `${dataInicioDebounced}T00:00:00Z`);
          if (dataFimDebounced) query = query.lte('created_at', `${dataFimDebounced}T23:59:59Z`);
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

      const dataInicioEfetiva = dataDisponibilizacaoDebounced || dataInicioDebounced;
      const dataFimEfetiva = dataDisponibilizacaoDebounced || dataFimDebounced;
      const dataInicioFiltro = apenasHoje
        ? formatToUTC(startOfDay(new Date()))
        : dataInicioEfetiva
          ? dateLocalToUTCRange(dataInicioEfetiva, false)
          : null;
      const dataFimFiltro = apenasHoje
        ? formatToUTC(endOfDay(new Date()))
        : dataFimEfetiva
          ? dateLocalToUTCRange(dataFimEfetiva, true)
          : null;

      let query = (supabase.from('publicacoes_djen') as any)
        .select(`
          id, monitoramento_id, processo_numero, conteudo, data_publicacao,
          data_disponibilizacao, fonte, tribunal, lida, created_at, orgao, tipo_comunicacao,
          meio, advogados_json, partes_json, polo_ativo, polo_passivo,
          monitoramento:monitoramentos_djen!inner(
            id, tipo, termo_busca, descricao, oab, uf, coordenacao_id,
            coordenacao:coordenacoes(id, nome)
          )
        `)
        .eq('tipo_publicacao', 'pauta')
        .order('created_at', { ascending: false });

      if (dataInicioFiltro) query = query.gte('created_at', dataInicioFiltro);
      if (dataFimFiltro) query = query.lte('created_at', dataFimFiltro);
      if (coordenacaoFiltroEfetivo) query = query.eq('monitoramento.coordenacao_id', coordenacaoFiltroEfetivo);
      if (!isAdmin && !coordenacaoFiltroEfetivo && userCoordenacaoIds.length > 0) {
        query = query.in('monitoramento.coordenacao_id', userCoordenacaoIds);
      }
      if (monitoramentoId) query = query.eq('monitoramento_id', monitoramentoId);

      const { data, error } = await query.limit(10000);
      if (error) throw error;

      let rows = (data || []) as any[];
      if (dataDisponibilizacaoDebounced) {
        rows = rows.filter((pub) => pub.data_disponibilizacao?.slice(0, 10) === dataDisponibilizacaoDebounced);
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

  // ===== Descartadas stats (independente, respeita filtros, igual aos demais cards) =====
  const { data: descartadasStats = { total: 0 }, isLoading: isLoadingDescartadasStats } = useQuery({
    queryKey: ['descartadas-stats-header', user?.id, coordenacaoFiltroEfetivo, JSON.stringify(userCoordenacaoIds), isAdmin, apenasHoje, dataInicioDebounced, dataFimDebounced, dataDisponibilizacaoDebounced, termoBuscaDebounced, monitoramentoId, tipoOrigem],
    queryFn: async () => {
      if (!user?.id) return { total: 0 };

      const dataInicioEfetiva = dataDisponibilizacaoDebounced || dataInicioDebounced;
      const dataFimEfetiva = dataDisponibilizacaoDebounced || dataFimDebounced;
      const dataInicioFiltro = apenasHoje
        ? formatToUTC(startOfDay(new Date()))
        : dataInicioEfetiva
          ? dateLocalToUTCRange(dataInicioEfetiva, false)
          : null;
      const dataFimFiltro = apenasHoje
        ? formatToUTC(endOfDay(new Date()))
        : dataFimEfetiva
          ? dateLocalToUTCRange(dataFimEfetiva, true)
          : null;

      try {
        let q = (supabase.from('publicacoes_djen_descartadas') as any)
          .select(`
            id, processo_numero, conteudo, data_disponibilizacao, created_at,
            monitoramento:monitoramentos_djen!inner(id, termo_busca, coordenacao_id)
          `)
          .order('created_at', { ascending: false });

        if (dataInicioFiltro) q = q.gte('created_at', dataInicioFiltro);
        if (dataFimFiltro) q = q.lte('created_at', dataFimFiltro);
        if (coordenacaoFiltroEfetivo) q = q.eq('monitoramento.coordenacao_id', coordenacaoFiltroEfetivo);
        if (!isAdmin && !coordenacaoFiltroEfetivo && userCoordenacaoIds.length > 0) {
          q = q.in('monitoramento.coordenacao_id', userCoordenacaoIds);
        }
        if (monitoramentoId) q = q.eq('monitoramento_id', monitoramentoId);

        const { data, error } = await q.limit(10000);
        if (error) {
          console.warn('Erro ao contar descartadas (stats header):', error);
          return { total: 0 };
        }

        let rows = (data || []) as any[];
        if (dataDisponibilizacaoDebounced) {
          rows = rows.filter((pub) => pub.data_disponibilizacao?.slice(0, 10) === dataDisponibilizacaoDebounced);
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

        return { total: rows.length };
      } catch (e) {
        console.warn('Erro ao contar descartadas (stats header):', e);
        return { total: 0 };
      }
    },
    // Heavy query (até 10k rows). Só roda quando o card de Descartadas está
    // selecionado — antes disso o badge mostra 0 e a tela responde rápido.
    enabled: !!user?.id && tipoOrigem === 'descartada',
    staleTime: 30_000,
  });

  const isLoadingStatsCards = loadingStats || isLoadingDatajudStats || isLoadingPautasDejtStats || isLoadingDescartadasStats;
  const totalGeralFiltrado = tipoOrigem === 'datajud'
    ? totalDatajudHoje
    : tipoOrigem === 'descartada'
      ? totalDescartadasHoje
      : totalHoje;
  const naoLidasTotalFiltrado = tipoOrigem === 'datajud'
    ? naoLidasDatajudHoje
    : tipoOrigem === 'descartada'
      ? 0
      : naoLidasHoje;
  const totalTermosFiltrado = tipoOrigem !== 'datajud' && tipoOrigem !== 'descartada' ? totalTermosHoje : 0;
  const totalProcessosFiltrado = tipoOrigem !== 'datajud' && tipoOrigem !== 'descartada' ? totalProcessosHoje : 0;
  const totalDescartadasFiltrado = tipoOrigem === 'datajud' ? 0 : descartadasStats.total;
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
    else result = publicacoes;
    return filtrarPorCoordenacaoUsuario(result);
  }, [tipoOrigem, publicacoes, datajudAsPublicacoes, deveRestringirPorCoordenacao, userCoordenacaoIds]);

  // Loading considera tanto o carregamento inicial da coordenação quanto das publicações
  const isLoading = loadingUserCoord || coordenacaoId === null || isLoadingPublicacoes || (tipoOrigem === 'datajud' && isLoadingDatajud);


  // Buscar termos (monitoramentos) da coordenação selecionada (ordem alfabética)
  const { data: monitoramentos = [] } = useQuery({
    queryKey: ['monitoramentos-djen-coord', coordenacaoFiltroEfetivo],
    queryFn: async () => {
      if (!coordenacaoFiltroEfetivo) return [];
      const { data, error } = await supabase
        .from('monitoramentos_djen')
        .select('id, termo_busca, descricao, tipo, oab, uf')
        .eq('coordenacao_id', coordenacaoFiltroEfetivo)
        .eq('ativo', true);
      if (error) throw error;
      const list = (data || []) as { id: string; termo_busca: string; descricao?: string; tipo?: string; oab?: string; uf?: string }[];
      const getLabel = (m: typeof list[0]) =>
        m.descricao || m.termo_busca || `${m.tipo || 'Termo'} ${m.oab || ''} ${m.uf || ''}`.trim() || m.id.slice(0, 8);
      return list.sort((a, b) => getLabel(a).localeCompare(getLabel(b), 'pt-BR', { sensitivity: 'base' }));
    },
    enabled: !!coordenacaoFiltroEfetivo,
  });

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

  const handleCriarTarefa = (pub: PublicacaoUnificada) => {
    setSelectedPublicacao(pub);
    setCriarTarefaDialogOpen(true);
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
      // 1. Vincular a publicação ao processo (adicionar como movimentação)
      const { error: movError } = await supabase
        .from('movimentacoes')
        .insert({
          processo_id: processoId,
          descricao: `Publicação DJEN: ${pub.conteudo?.replace(/<[^>]*>/g, ' ').substring(0, 1000) || 'Importado do DJEN'}`,
          tipo: 'publicacao',
          fonte: 'DJEN',
          data_movimentacao: pub.data_publicacao || new Date().toISOString(),
        });

      if (movError) throw movError;

      // 2. Marcar a publicação como lida (tabela correta)
      const { error: lidaError } = await supabase
        .from(pub.tipo_origem === 'termo' ? 'publicacoes_djen' : 'publicacoes_djen_processos')
        .update({ lida: true })
        .eq('id', pub.id);

      if (lidaError) throw lidaError;

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats-header'] });

      toast.success("Publicação vinculada ao processo!", {
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
          assunto: pub.conteudo?.replace(/<[^>]*>/g, ' ').substring(0, 500) || 'Processo importado do DJEN',
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
          descricao: `Publicação DJEN: ${pub.conteudo?.replace(/<[^>]*>/g, ' ').substring(0, 1000) || 'Importado do DJEN'}`,
          tipo: 'publicacao',
          fonte: 'DJEN',
          data_movimentacao: pub.data_publicacao || new Date().toISOString(),
        });

      // 5. Marcar a publicação como lida
      await supabase
        .from('publicacoes_djen')
        .update({ lida: true })
        .eq('id', pub.id);

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats-header'] });
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      queryClient.invalidateQueries({ queryKey: ['pastas'] });

      toast.success("Processo e pasta criados com sucesso!", {
        action: {
          label: "Ver processo",
          onClick: () => navigate(`/processos/${processo.id}`),
        },
      });
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
        const rawContent = (pub.conteudo || "Sem conteúdo").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
  const [gerandoResumo, setGerandoResumo] = useState(false);

  // Detecta se a publicação é uma Pauta de Julgamento (sessão virtual/presencial).
  const isPautaDeJulgamento = (conteudo?: string | null): boolean => {
    if (!conteudo) return false;
    const txt = String(conteudo).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    return /Pauta\s+de\s+Julgamento/i.test(txt) ||
      (/\bSess[aã]o\s+(Ordin[áa]ria|Extraordin[áa]ria|Virtual|Presencial)/i.test(txt) &&
        /\bsess[aã]o\s+(virtual|presencial)/i.test(txt));
  };

  // Para pautas, retorna apenas o cabeçalho da sessão e o bloco do processo atual.
  // Evita trazer a pauta completa ou repetir as linhas iniciais no resumo.
  const extractTrechoPauta = (conteudo?: string | null, processo?: string | null): string => {
    if (!conteudo || !isPautaDeJulgamento(conteudo)) return "";
    const linhas = String(conteudo)
      .replace(/<br\s*\/?>(?=)/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map(l => l.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean);

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
    const semHtml = String(conteudo)
      .replace(/<br\s*\/?>(?=)/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r\n?/g, "\n");
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

  // Modo HÍBRIDO: usa heurística e cai para IA quando o resultado é
  // visivelmente ruim (muito longo, muito curto ou cobre quase todo o texto).
  const extractTrechoHibrido = async (pub: any): Promise<string> => {
    const original = String(pub?.conteudo || "");
    // Pautas: extração determinística, sem IA, para não repetir o início nem trazer a pauta completa.
    const ehPauta = isPautaDeJulgamento(original);
    const heur = ehPauta ? extractTrechoPauta(original, pub?.processo_numero) : extractTrechoFinal(original);
    // Pautas: SEMPRE retornamos o resultado determinístico, sem fallback IA nem
    // "trecho final" — isso evita que a publicação inteira da pauta (com dezenas
    // de processos) seja despejada no Resumo Rápido.
    if (ehPauta) {
      return heur || (original.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500));
    }
    const tamanhoOriginal = original.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
    const tamanhoHeur = heur.length;
    const ratio = tamanhoOriginal > 0 ? tamanhoHeur / tamanhoOriginal : 0;

    const precisaIA = (
      tamanhoHeur < 80 ||
      tamanhoHeur > 2500 ||
      (tamanhoOriginal > 1500 && ratio > 0.65)
    );
    if (!precisaIA) return heur;

    try {
      const { data, error } = await supabase.functions.invoke("resumir-publicacoes", {
        body: {
          apenasTrecho: true,
          publicacao: {
            id: pub.id,
            conteudo: original,
            processo: pub.processo_numero,
            data: pub.data_disponibilizacao,
          },
        },
      });
      if (error) throw error;
      const trechoIA: string = (data?.trecho || "").trim();
      if (trechoIA && trechoIA.length >= 40) return trechoIA;
    } catch (e) {
      console.warn("Fallback IA falhou para pub", pub?.id, e);
    }
    return heur;
  };

  const [gerandoResumoRapido, setGerandoResumoRapido] = useState(false);
  const [gerandoDocResumoRapido, setGerandoDocResumoRapido] = useState(false);

  const handleGerarPdfResumo = async () => {
    const allPublicacoes = getPubsParaGerar();
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }

    setGerandoResumo(true);
    const totalPubs = allPublicacoes.length;
    const toastId = toast.loading(`Resumindo 1/${totalPubs}...`);

    try {
      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));
      // 1. Chamar IA para resumir cada publicação (Dra. Renata não quer ler o texto na íntegra)
      const resumosMap = new Map<string, string>();
      const orgaosMap = new Map<string, string>();
      let erros = 0;

      for (let i = 0; i < totalPubs; i++) {
        const pub = allPublicacoes[i];
        toast.loading(`Resumindo ${i + 1}/${totalPubs}...`, { id: toastId });

        try {
          const resumoPauta = isPautaDeJulgamento(pub.conteudo) ? resumirTrechoPauta(extractTrechoPauta(pub.conteudo, pub.processo_numero)) : "";
          if (resumoPauta) {
            resumosMap.set(pub.id, resumoPauta);
            continue;
          }
          const { data: aiData, error: aiError } = await supabase.functions.invoke('resumir-publicacoes', {
            body: {
              resumoIndividual: true,
              publicacao: {
                id: pub.id,
                conteudo: pub.conteudo,
                processo: pub.processo_numero,
                dataDisponibilizacao: pub.data_disponibilizacao,
              },
            },
          });

          if (aiError) throw aiError;
          if (aiData?.resumo) {
            resumosMap.set(pub.id, aiData.resumo);
          }
        } catch (e) {
          console.error(`Erro ao resumir publicação ${pub.id}:`, e);
          erros++;
        }
        // Small delay between calls to avoid rate limiting
        if (i < totalPubs - 1) await new Promise(r => setTimeout(r, 800));
      }

      if (erros > 0) {
        console.warn(`${erros} publicação(ões) não puderam ser resumidas`);
      }

      // 2. Gerar PDF: mesmo layout da Busca DJEN Termos, com Parte(s) e Advogado(s) limpos e Resumo por IA
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const mL = 15;
      const mR = 15;
      const maxW = pageW - mL - mR;
      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      drawPdfHeader(doc, pageW, `Resumo de Publicações ${origemLabel}`);
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
        addRow("Órgão", (pub.orgao || pub.tribunal) || "—");
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
            linhas.forEach((l: string) => {
              doc.text(l, mL + 6, y);
              y += 5;
            });
          });
        } else {
          doc.text("—", mL, y);
          y += 5;
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
            linhas.forEach((l: string) => {
              doc.text(l, mL + 6, y);
              y += 5;
            });
          });
        } else {
          doc.text("—", mL, y);
          y += 5;
        }
        y += 2;

        // Conteúdo Integral (resumo por IA – padrão do Doc)
        const resumoIA = resumosMap.get(pub.id);
        if (resumoIA) {
          y += 4;
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text("Conteúdo Integral:", mL, y);
          y += 6;
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          const paragrafos = resumoIA.split(/\n+/).map((p) => p.trim()).filter(Boolean);
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

        // Comentários da coordenação
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

      doc.save(`resumo_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`);
      toast.success("PDF Resumo gerado com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao gerar PDF Resumo:", error);
      toast.error("Erro ao gerar PDF Resumo", { id: toastId });
    } finally {
      setGerandoResumo(false);
    }
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
    const orgaoCombo = [pub.tribunal, orgaoExtra].filter(Boolean).join(' - ');
    if (orgaoCombo) {
      metaItems.push(new TextRun({ text: "Órgão: ", bold: true, size: docFontSize, font: docFont, color: "333333" }));
      metaItems.push(new TextRun({ text: sanitizeForXml(orgaoCombo) + "   ", size: docFontSize, font: docFont, color: "555555" }));
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

    paragraphs.push(new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: label, bold: true, size: 20, font: docFont, color: mediumBlue })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: borderGray } },
    }));

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

  // ===== "Gerar Doc Resumo" - Texto com resumo IA =====
  const handleGerarDocResumo = async () => {
    const allPublicacoes = getPubsParaGerar();
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }

    setGerandoDocResumo(true);
    const totalPubs = allPublicacoes.length;
    const toastId = toast.loading(`Resumindo 1/${totalPubs}...`);

    try {
      const resumosMap = new Map<string, string>();
      const orgaosMap = new Map<string, string>();
      let erros = 0;

      for (let i = 0; i < totalPubs; i++) {
        const pub = allPublicacoes[i];
        toast.loading(`Resumindo ${i + 1}/${totalPubs}...`, { id: toastId });
        try {
          const resumoPauta = isPautaDeJulgamento(pub.conteudo) ? resumirTrechoPauta(extractTrechoPauta(pub.conteudo, pub.processo_numero)) : "";
          if (resumoPauta) {
            resumosMap.set(pub.id, resumoPauta);
            continue;
          }
          const { data: aiData, error: aiError } = await supabase.functions.invoke('resumir-publicacoes', {
            body: {
              resumoIndividual: true,
              publicacao: {
                id: pub.id,
                conteudo: pub.conteudo,
                processo: pub.processo_numero,
                dataDisponibilizacao: pub.data_disponibilizacao,
              },
            },
          });
          if (aiError) throw aiError;
          if (aiData?.resumo) resumosMap.set(pub.id, aiData.resumo);
          if (aiData?.orgao) orgaosMap.set(pub.id, String(aiData.orgao));
        } catch (e) {
          console.error(`Erro ao resumir publicação ${pub.id}:`, e);
          erros++;
        }
        // Small delay between calls to avoid rate limiting
        if (i < totalPubs - 1) await new Promise(r => setTimeout(r, 800));
      }

      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      const children: Paragraph[] = [...buildDocHeader(`Resumo de Publicações ${origemLabel}${erros > 0 ? ` (${erros} não resumida(s))` : ""}`, totalPubs)];

      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));
      allPublicacoes.forEach((pub, idx) => {
        children.push(...buildPubMetadata(pub, idx, orgaosMap.get(pub.id) || null));
        children.push(...buildPartesAdvogados(pub));

        const resumo = resumosMap.get(pub.id);
        if (resumo) {
          children.push(new Paragraph({
            spacing: { before: 160, after: 80 },
            children: [new TextRun({ text: "RESUMO", bold: true, size: 20, font: docFont, color: mediumBlue })],
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: borderGray } },
          }));

          const resumoLines = sanitizeForXml(resumo).split(/\n+/).filter(l => l.trim());
          resumoLines.forEach(line => {
            children.push(new Paragraph({
              spacing: { after: 80, line: 276 },
              indent: { left: 180 },
              children: [new TextRun({ text: line.trim(), size: docFontSize, font: docFont, color: "333333" })],
            }));
          });

          children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
        }
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
      a.download = `resumo_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Documento Resumo Word gerado com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao gerar Doc Resumo:", error);
      toast.error("Erro ao gerar Doc Resumo", { id: toastId });
    } finally {
      setGerandoDocResumo(false);
    }
  };

  // ===== "Gerar PDF Resumo Rápido" - apenas trecho final ORIGINAL (assinatura + intimados), SEM IA =====
  const handleGerarPdfResumoRapido = async () => {
    const allPublicacoes = getPubsParaGerar();
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    setGerandoResumoRapido(true);
    const toastId = toast.loading("Gerando PDF Resumo Rápido...");
    try {
      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));

      // Pré-extrai os trechos (com fallback IA), com throttling de 800ms entre chamadas
      const trechosMap = new Map<string, string>();
      for (let i = 0; i < allPublicacoes.length; i++) {
        const pub = allPublicacoes[i];
        toast.loading(`Extraindo trechos ${i + 1}/${allPublicacoes.length}...`, { id: toastId });
        trechosMap.set(pub.id, await extractTrechoHibrido(pub));
        if (i < allPublicacoes.length - 1) await new Promise(r => setTimeout(r, 800));
      }
      toast.loading("Montando PDF...", { id: toastId });

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const mL = 15;
      const mR = 15;
      const maxW = pageW - mL - mR;
      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      drawPdfHeader(doc, pageW, `Resumo Rápido de Publicações ${origemLabel}`);
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
        addRow("Órgão", (pub.orgao || pub.tribunal) || "—");
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
            linhas.forEach((l: string) => {
              doc.text(l, mL + 6, y);
              y += 5;
            });
          });
        } else {
          doc.text("—", mL, y);
          y += 5;
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
            linhas.forEach((l: string) => {
              doc.text(l, mL + 6, y);
              y += 5;
            });
          });
        } else {
          doc.text("—", mL, y);
          y += 5;
        }
        y += 2;

        // Trecho final ORIGINAL (assinatura + intimados)
        const trecho = trechosMap.get(pub.id) || extractTrechoFinal(pub.conteudo);
        if (trecho) {
          y += 4;
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text("Trecho final (assinatura e intimados):", mL, y);
          y += 6;
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

        // Comentários da coordenação
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

      doc.save(`resumo_rapido_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`);
      toast.success("PDF Resumo Rápido gerado!", { id: toastId });
    } catch (error: any) {
      console.error("Erro ao gerar PDF Resumo Rápido:", error);
      toast.error(`Erro ao gerar PDF Resumo Rápido: ${error?.message || ""}`, { id: toastId });
    } finally {
      setGerandoResumoRapido(false);
    }
  };

  // ===== "Gerar Doc Resumo Rápido" - DOCX apenas com trecho final ORIGINAL =====
  const handleGerarDocResumoRapido = async () => {
    const allPublicacoes = getPubsParaGerar();
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    setGerandoDocResumoRapido(true);
    const toastId = toast.loading("Gerando Doc Resumo Rápido...");
    try {
      const isPautasDejt = tipoOrigem === 'djet-pautas';
      const origemLabel = isPautasDejt ? 'DEJT' : 'DJEN';
      const children: Paragraph[] = [...buildDocHeader(`Resumo Rápido de Publicações ${origemLabel}`, allPublicacoes.length)];

      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));

      // Pré-extrai os trechos (com fallback IA), com throttling de 800ms entre chamadas
      const trechosMap = new Map<string, string>();
      for (let i = 0; i < allPublicacoes.length; i++) {
        const pub = allPublicacoes[i];
        toast.loading(`Extraindo trechos ${i + 1}/${allPublicacoes.length}...`, { id: toastId });
        trechosMap.set(pub.id, await extractTrechoHibrido(pub));
        if (i < allPublicacoes.length - 1) await new Promise(r => setTimeout(r, 800));
      }
      toast.loading("Montando DOCX...", { id: toastId });

      allPublicacoes.forEach((pub, idx) => {
        children.push(...buildPubMetadata(pub, idx));
        children.push(...buildPartesAdvogados(pub));
        const trecho = trechosMap.get(pub.id) || extractTrechoFinal(pub.conteudo);
        children.push(...buildConteudoParagraphs(trecho || "Sem trecho disponível", "TRECHO FINAL (ASSINATURA E INTIMADOS)"));
        children.push(...buildComentariosParagraphs(comentariosMap.get(pub.id)));
      });

      const doc = new Document({
        styles: {
          default: { document: { run: { font: docFont, size: docFontSize } } },
        },
        sections: [{
          properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } },
          children,
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumo_rapido_djen_${format(new Date(), "yyyy-MM-dd_HHmm")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Doc Resumo Rápido gerado!", { id: toastId });
    } catch (err: any) {
      console.error("Erro ao gerar Doc Resumo Rápido:", err);
      toast.error(`Erro ao gerar Doc Resumo Rápido: ${err?.message || ""}`, { id: toastId });
    } finally {
      setGerandoDocResumoRapido(false);
    }
  };

  // ===== "Gerar Docs TST" - Classifica publicações e gera 3 documentos Word (TEMAS_IRR, PAUTA, PRAZOS) =====
  const handleGerarDocsTST = async () => {
    const allPublicacoes = getPubsParaGerar();
    if (allPublicacoes.length === 0) { toast.error("Nenhuma publicação para classificar"); return; }
    setGerandoDocsTST(true);
    const toastId = toast.loading(`Classificando ${allPublicacoes.length} publicações com IA...`);
    try {
      // Enviar uma publicação por vez para evitar timeout
      const pubsPayload = allPublicacoes.map(p => ({ id: p.id, processo_numero: p.processo_numero, conteudo: (p.conteudo || "").substring(0, 3000), orgao: p.orgao || p.tribunal, tipo_comunicacao: p.tipo_comunicacao }));
      let allClassificacoes: Array<{ id: string; categoria: "TEMAS_IRR" | "PAUTA" | "PRAZOS"; tema_irr?: string; observacao_ia?: string; resumo?: string }> = [];
      for (let i = 0; i < pubsPayload.length; i++) {
        toast.loading(`Classificando publicação ${i + 1}/${pubsPayload.length} com IA...`, { id: toastId });
        const { data: classData, error: classError } = await supabase.functions.invoke('classificar-publicacoes-tst', { body: { publicacoes: [pubsPayload[i]] } });
        if (classError) throw classError;
        if (!classData?.classificacoes) throw new Error("Classificação não retornada pela IA");
        allClassificacoes = allClassificacoes.concat(classData.classificacoes);
      }
      const classificacoes = allClassificacoes;
      const classMap = new Map(classificacoes.map(c => [c.id, c]));
      type PubComClass = { pub: typeof allPublicacoes[0]; class_info: typeof classificacoes[0] };
      const pubsTemasIRR: PubComClass[] = []; const pubsPauta: PubComClass[] = []; const pubsPrazos: PubComClass[] = [];
      allPublicacoes.forEach(pub => {
        const ci = classMap.get(pub.id) || { id: pub.id, categoria: "PRAZOS" as const };
        if (ci.categoria === "TEMAS_IRR") pubsTemasIRR.push({ pub, class_info: ci });
        else if (ci.categoria === "PAUTA") pubsPauta.push({ pub, class_info: ci });
        else pubsPrazos.push({ pub, class_info: ci });
      });
      toast.loading(`Gerando documentos... (Temas: ${pubsTemasIRR.length}, Pauta: ${pubsPauta.length}, Prazos: ${pubsPrazos.length})`, { id: toastId });
      const dataStr = format(new Date(), "dd.MM.yy");
      const comentariosMap = await fetchComentariosMap(allPublicacoes.map(p => p.id));
      const buildTSTDocChildren = (pubs: PubComClass[], titulo: string, useConclusao = false): Paragraph[] => {
        const ch: Paragraph[] = [...buildDocHeader(titulo, pubs.length)];
        pubs.forEach((item, idx) => {
          const { pub, class_info: ci } = item;
          ch.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: idx > 0 ? 360 : 120, after: 120 }, shading: { type: ShadingType.SOLID, color: mediumBlue, fill: mediumBlue }, children: [new TextRun({ text: `  COMUNICAÇÃO PJE #${sanitizeForXml(pub.processo_numero || "N/A")}`, bold: true, size: 24, color: "FFFFFF", font: docFont })] }));
          const ml = [["Processo", sanitizeForXml(pub.processo_numero || "N/A")], ["Órgão", sanitizeForXml(pub.orgao || pub.tribunal || "N/A")], ["Data de disponibilização", pub.data_disponibilizacao ? formatDateOnlyFull(pub.data_disponibilizacao) : "N/A"], ["Tipo de Comunicação", sanitizeForXml(pub.tipo_comunicacao || "Intimação")], ["Meio", "Diário de Justiça Eletrônico Nacional"]];
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
          if (ci.observacao_ia) ch.push(new Paragraph({ spacing: { before: 60, after: 80 }, indent: { left: 180 }, children: [new TextRun({ text: "IA: ", bold: true, size: 18, font: docFont, color: "6B7280", italics: true }), new TextRun({ text: sanitizeForXml(ci.observacao_ia), size: 18, font: docFont, color: "6B7280", italics: true })] }));
          ch.push(...buildPartesAdvogados(pub));
          if (useConclusao && ci.resumo) {
            ch.push(...buildConteudoParagraphs(ci.resumo, "Conteúdo Integral"));
          } else {
            ch.push(...buildConteudoParagraphs(pub.conteudo || "Sem conteúdo", "Conteúdo Integral"));
          }
          ch.push(...buildComentariosParagraphs(comentariosMap.get(pub.id)));
        });
        return ch;
      };
      const mkDoc = (ch: Paragraph[]) => new Document({ styles: { default: { document: { run: { font: docFont, size: docFontSize } } } }, sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } }, children: ch }] });
      const dl = async (d: Document, fn: string) => { const b = await Packer.toBlob(d); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = fn; a.click(); URL.revokeObjectURL(u); };
      let dg = 0;
      if (pubsTemasIRR.length > 0) { await dl(mkDoc(buildTSTDocChildren(pubsTemasIRR, `Temas IRR - ${dataStr}`)), `TEMAS_IRR_${dataStr}.docx`); dg++; }
      if (pubsPauta.length > 0) { await dl(mkDoc(buildTSTDocChildren(pubsPauta, `Pauta de Julgamento - ${dataStr}`)), `PAUTA_${dataStr}.docx`); dg++; }
      if (pubsPrazos.length > 0) { await dl(mkDoc(buildTSTDocChildren(pubsPrazos, `Prazos e Decisões - ${dataStr}`, true)), `PRAZOS_${dataStr}.docx`); dg++; }
      toast.success(`${dg} documento(s) gerado(s)! (Temas: ${pubsTemasIRR.length}, Pauta: ${pubsPauta.length}, Prazos: ${pubsPrazos.length})`, { id: toastId });
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
    setSelectedIds(new Map<string, TipoOrigemPublicacao>());
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

  // Use merged data for all rendering (shadow the hook's publicacoes)
  // Filtro client-side por data de disponibilização.
  const allPublicacoes = useMemo(() => {
    let result = mergedPublicacoes;
    if (dataDisponibilizacao) {
      result = result.filter(pub => {
        if (!pub.data_disponibilizacao) return false;
        const pubDate = pub.data_disponibilizacao.slice(0, 10);
        return pubDate === dataDisponibilizacao;
      });
    }
    return result;
  }, [mergedPublicacoes, dataDisponibilizacao]);

  // Agrupar publicações por coordenação
  const publicacoesPorCoordenacao = allPublicacoes.reduce((acc, pub) => {
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
        {/* Banners de execução DJEN */}
        <DjenExecutionBanner />
        <DjenExecutionBannerPro />

        {/* Stats Cards - Mobile optimized */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
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

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800">
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

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
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

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800">
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

          <Card className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/50 dark:to-rose-900/30 border-rose-200 dark:border-rose-800">
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
        </div>

        {/* Filtros - Mobile optimized */}
        <Card>
          <CardHeader className="pb-2 md:pb-4 px-3 md:px-6">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Filter className="w-4 h-4 md:w-5 md:h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
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
                  <option value="todos">DJEN: Termos + Processos</option>
                  <option value="termo">Por Termos/OAB</option>
                  <option value="parte">Por Parte</option>
                  <option value="processo">Por Processos</option>
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

              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Data Disponibilização</Label>
                <Input
                  type="date"
                  value={dataDisponibilizacao}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDataDisponibilizacao(val);
                    if (val && val !== new Date().toISOString().slice(0, 10)) {
                      setFiltroDia('todos');
                    }
                  }}
                  className="h-9 md:h-10 text-sm"
                />
              </div>

              {!apenasHoje && (
                <>
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
                </>
              )}

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs md:text-sm">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Termo, processo..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    className="pl-9 h-9 md:h-10 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4 mt-3 md:mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Período</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={filtroDia === 'hoje' ? 'default' : 'outline'} onClick={() => setFiltroDia('hoje')} disabled={tipoOrigem === 'descartada'}>
                    Somente Hoje
                  </Button>
                  <Button type="button" size="sm" variant={filtroDia === 'todos' ? 'default' : 'outline'} onClick={() => setFiltroDia('todos')} disabled={tipoOrigem === 'descartada'}>
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

            </div>
          </CardContent>
        </Card>

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
            disabled={selectedIds.size === 0 || marcarComoLida.isPending}
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
            onClick={handleGerarPdfResumo}
            disabled={allPublicacoes.length === 0 || gerandoResumo}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
          >
            {gerandoResumo ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">{gerandoResumo ? "Gerando Resumo..." : "Gerar PDF Resumo"}</span>
            <span className="sm:hidden">{gerandoResumo ? "..." : "Resumo"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarDoc}
            disabled={allPublicacoes.length === 0}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
          >
            <Download className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Gerar Doc</span>
            <span className="sm:hidden">Doc</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarDocResumo}
            disabled={allPublicacoes.length === 0 || gerandoDocResumo}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
          >
            {gerandoDocResumo ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">{gerandoDocResumo ? "Gerando..." : "Gerar Doc Resumo"}</span>
            <span className="sm:hidden">{gerandoDocResumo ? "..." : "Doc IA"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarPdfResumoRapido}
            disabled={allPublicacoes.length === 0 || gerandoResumoRapido}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            {gerandoResumoRapido ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <FileDown className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">{gerandoResumoRapido ? "Gerando..." : "Gerar PDF Resumo Rápido"}</span>
            <span className="sm:hidden">{gerandoResumoRapido ? "..." : "PDF Rápido"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarDocResumoRapido}
            disabled={allPublicacoes.length === 0 || gerandoDocResumoRapido}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            {gerandoDocResumoRapido ? (
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
            ) : (
              <Download className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            )}
            <span className="hidden sm:inline">{gerandoDocResumoRapido ? "Gerando..." : "Gerar Doc Resumo Rápido"}</span>
            <span className="sm:hidden">{gerandoDocResumoRapido ? "..." : "Doc Rápido"}</span>
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
            <span className="hidden sm:inline">{gerandoDocsTST ? "Classificando..." : "Docs TST (IA)"}</span>
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
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {coordenacoesOrdenadas.map((grupo) => {
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
                        {grupo.publicacoes.map((pub) => {
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
                                    <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                      DESCARTADA
                                    </Badge>
                                  ) : pub.tipo_origem === 'termo' ? (
                                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5 max-w-[150px] md:max-w-none truncate">
                                      <FileSearch className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
                                      <span className="truncate">
                                        {pub.monitoramento_tipo === 'advogado' 
                                          ? `OAB ${pub.monitoramento_oab || ''} ${pub.monitoramento_uf || ''}`
                                          : pub.monitoramento_termo || "Termo"
                                        }
                                      </span>
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                      <Gavel className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
                                      <span className="hidden sm:inline">Processo Cadastrado</span>
                                      <span className="sm:hidden">Processo</span>
                                    </Badge>
                                  )}
                                  
                                  {/* Motivo do descarte */}
                                  {pub.tipo_origem === 'descartada' && pub.motivo_descarte && (
                                    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5 max-w-[200px] truncate">
                                      {pub.motivo_descarte}
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
                                  {pub.monitoramento_termo && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                      <Search className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
                                      <span>{pub.monitoramento_termo}</span>
                                    </Badge>
                                  )}
                                </div>

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
                                      {pub.processo_id && (
                                        <Link 
                                          to={`/processos/${pub.processo_id}`}
                                          className="text-[10px] md:text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 md:gap-1 flex-shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <ExternalLink className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                          <span className="hidden sm:inline">Ver processo</span>
                                        </Link>
                                      )}
                                      
                                       {/* Ações de vínculo/importação */}
                                       {pub.processo_id ? (
                                         <Button
                                           variant="outline"
                                           size="sm"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleSalvarPublicacao(pub);
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
                                       
                                       <Button
                                         variant="outline"
                                         size="sm"
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           handleCriarTarefa(pub);
                                         }}
                                         title="Criar tarefa a partir desta publicação"
                                         className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                                       >
                                         <ListChecks className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                         <span className="text-xs">Criar Tarefa</span>
                                       </Button>
                                       
                                       {/* Botão Marcar como Lida individual */}
                                       {!pub.lida && (
                                         <Button
                                           variant="outline"
                                           size="sm"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             marcarComoLida.mutate([{ id: pub.id, tipo_origem: pub.tipo_origem }]);
                                           }}
                                           disabled={marcarComoLida.isPending}
                                           title="Marcar como lida"
                                           className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                                         >
                                           <CheckCheck className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                           <span className="text-xs">Lida</span>
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
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCriarTarefa(pub);
                                        }}
                                        title="Criar tarefa a partir desta publicação"
                                        className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                                      >
                                        <ListChecks className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                        <span className="text-xs">Criar Tarefa</span>
                                      </Button>
                                      
                                      {/* Botão Marcar como Lida individual */}
                                      {!pub.lida && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            marcarComoLida.mutate([{ id: pub.id, tipo_origem: pub.tipo_origem }]);
                                          }}
                                          disabled={marcarComoLida.isPending}
                                          title="Marcar como lida"
                                          className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0"
                                        >
                                          <CheckCheck className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                                          <span className="text-xs">Lida</span>
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
                                      {pub.conteudo?.replace(/<[^>]*>/g, ' ').substring(0, 200) || "Sem conteúdo"}...
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
              Exibindo <strong>{totalExibidoNaPagina}</strong> registros filtrados
              {temMaisResultados ? <> de <strong>{totalFiltradoGeral}</strong></> : null}
            </div>
            {temMaisResultados && !coordenacaoFiltroEfetivo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setListLimit((current) => current + LOAD_MORE_INCREMENT)}
                disabled={isFetchingPublicacoes}
              >
                {isFetchingPublicacoes ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Carregar mais {Math.min(LOAD_MORE_INCREMENT, totalFiltradoGeral - totalExibidoNaPagina)}
              </Button>
            )}
          </div>
        )}

        {/* Dialog para criar tarefa a partir da publicação */}
        <CriarTarefaPublicacaoDialog
          open={criarTarefaDialogOpen}
          onOpenChange={setCriarTarefaDialogOpen}
          publicacao={selectedPublicacao}
        />
      </div>
    </MainLayout>
  );
};

export default AnaliseDjen;
