import { useState, useEffect, useMemo } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType, Tab, TabStopType, TabStopPosition, PageBreak, ExternalHyperlink } from "docx";
import {
  FileText,
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
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatProcessoNumero } from "@/lib/utils";
import { formatConteudoParaExibicao, conteudoDisplayClasses, formatDateOnly, formatDateOnlyFull } from "@/utils/formatConteudo";

import { usePublicacoesDjenUnificadas, PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CriarTarefaPublicacaoDialog } from "@/components/djen/CriarTarefaPublicacaoDialog";
import { DjenExecutionBanner } from "@/components/djen/DjenExecutionBanner";
import { DjenExecutionBannerPro } from "@/components/djen/DjenExecutionBannerPro";
import { PublicacaoConteudoDjen, getPartesEAdvogadosParaExibicao } from "@/components/djen/PublicacaoConteudoDjen";
import { jsPDF } from "jspdf";

type TipoOrigemPublicacao = 'termo' | 'processo' | 'descartada' | 'datajud';
type TipoFiltroOrigem = 'todos' | 'normal' | 'termo' | 'parte' | 'processo' | 'descartada' | 'datajud';

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
  const [apenasNaoLidas, setApenasNaoLidas] = useState(true);
  const [apenasHoje, setApenasHoje] = useState(true); // Sempre marcado por padrão
  const [tipoOrigem, setTipoOrigem] = useState<TipoFiltroOrigem>('todos');

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
    loadingStats,
    marcarComoLida,
    totalHoje,
    naoLidasHoje,
    totalDescartadasHoje
  } = usePublicacoesDjenUnificadas({
    coordenacaoId: coordenacaoFiltroEfetivo,
    // Quando dataDisponibilizacao está preenchido, usar como dataInicio/dataFim para filtrar no banco
    dataInicio: apenasHoje ? undefined : (dataDisponibilizacao || dataInicio || undefined),
    dataFim: apenasHoje ? undefined : (dataDisponibilizacao || dataFim || undefined),
    termoBusca: termoBusca || undefined,
    monitoramentoId: monitoramentoId || undefined,
    apenasNaoLidas,
    apenasHoje,
    // 'todos' e 'normal' passam undefined para buscar termos e processos
    // datajud é tratado separadamente
    tipoOrigem: (tipoOrigem === 'todos' || tipoOrigem === 'normal' || tipoOrigem === 'datajud') ? undefined : tipoOrigem as any,
    // incluir descartadas APENAS quando o filtro 'descartada' estiver ativo
    incluirDescartadas: tipoOrigem === 'descartada',
  });

  // ===== DataJud (CNJ) query =====
  const { data: datajudResults = [], isLoading: isLoadingDatajud } = useQuery({
    queryKey: ['datajud-movimentacoes', coordenacaoFiltroEfetivo, apenasHoje, dataInicio, dataFim, termoBusca, monitoramentoId, apenasNaoLidas],
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
      if (apenasNaoLidas) {
        query = query.eq('lida', false);
      }
      if (monitoramentoId) {
        query = query.eq('monitoramento_id', monitoramentoId);
      }
      if (apenasHoje) {
        const today = new Date().toISOString().slice(0, 10);
        query = query.gte('created_at', `${today}T00:00:00Z`);
      } else {
        if (dataInicio) query = query.gte('created_at', `${dataInicio}T00:00:00Z`);
        if (dataFim) query = query.lte('created_at', `${dataFim}T23:59:59Z`);
      }
      if (termoBusca) {
        const digits = termoBusca.replace(/\D/g, '');
        if (digits.length >= 5) {
          query = query.ilike('numero_processo', `%${digits}%`);
        } else {
          query = query.or(`tipo_movimentacao.ilike.%${termoBusca}%,complemento.ilike.%${termoBusca}%,assuntos.ilike.%${termoBusca}%`);
        }
      }

      const { data, error } = await query;
      if (error) { console.warn('Erro DataJud:', error); return []; }
      return (data || []) as any[];
    },
    enabled: tipoOrigem === 'datajud' || tipoOrigem === 'todos' || tipoOrigem === 'normal',
    staleTime: 30_000,
  });

  // Count DataJud for stats
  const { data: totalDatajudHoje = 0 } = useQuery({
    queryKey: ['datajud-count-hoje', coordenacaoFiltroEfetivo],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from('movimentacoes_datajud')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00Z`);
      if (coordenacaoFiltroEfetivo) query = query.eq('coordenacao_id', coordenacaoFiltroEfetivo);
      const { count } = await query;
      return count || 0;
    },
    staleTime: 30_000,
  });

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
    else if (tipoOrigem === 'todos' || tipoOrigem === 'normal') {
      result = [...publicacoes, ...datajudAsPublicacoes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else {
      result = publicacoes;
    }
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
  const handleGerarPdf = () => {
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const mL = 15;
      const mR = 15;
      const maxW = pageW - mL - mR;
      let y = 34;
      const checkPage = (need: number) => { if (y + need > 280) { doc.addPage(); y = 15; } };

      drawPdfHeader(doc, pageW, "Gestão Jurídica e Publicações DJEN");

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`PUBLICAÇÕES DJEN (${allPublicacoes.length})`, mL, y);
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

  const handleGerarPdfResumo = async () => {
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }

    setGerandoResumo(true);
    const totalPubs = allPublicacoes.length;
    const toastId = toast.loading(`Resumindo 1/${totalPubs}...`);

    try {
      // 1. Chamar IA para resumir cada publicação (Dra. Renata não quer ler o texto na íntegra)
      const resumosMap = new Map<string, string>();
      let erros = 0;

      for (let i = 0; i < totalPubs; i++) {
        const pub = allPublicacoes[i];
        toast.loading(`Resumindo ${i + 1}/${totalPubs}...`, { id: toastId });

        try {
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
      drawPdfHeader(doc, pageW, "Resumo de Publicações DJEN");
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
  const buildPubMetadata = (pub: any, idx: number): Paragraph[] => {
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
    if (pub.tribunal) {
      metaItems.push(new TextRun({ text: "Órgão: ", bold: true, size: docFontSize, font: docFont, color: "333333" }));
      metaItems.push(new TextRun({ text: sanitizeForXml(pub.tribunal) + "   ", size: docFontSize, font: docFont, color: "555555" }));
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

  // ===== "Gerar Doc" - DOCX (plain text sem IA) =====
  const handleGerarDoc = async () => {
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }
    try {
      const children: Paragraph[] = [...buildDocHeader("Relatório de Publicações DJEN", allPublicacoes.length)];

      allPublicacoes.forEach((pub, idx) => {
        children.push(...buildPubMetadata(pub, idx));
        children.push(...buildPartesAdvogados(pub));
        children.push(...buildConteudoParagraphs(pub.conteudo || "Sem conteúdo", "CONTEÚDO INTEGRAL"));
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
    if (allPublicacoes.length === 0) {
      toast.error("Nenhuma publicação para exportar");
      return;
    }

    setGerandoDocResumo(true);
    const totalPubs = allPublicacoes.length;
    const toastId = toast.loading(`Resumindo 1/${totalPubs}...`);

    try {
      const resumosMap = new Map<string, string>();
      let erros = 0;

      for (let i = 0; i < totalPubs; i++) {
        const pub = allPublicacoes[i];
        toast.loading(`Resumindo ${i + 1}/${totalPubs}...`, { id: toastId });
        try {
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
        } catch (e) {
          console.error(`Erro ao resumir publicação ${pub.id}:`, e);
          erros++;
        }
        // Small delay between calls to avoid rate limiting
        if (i < totalPubs - 1) await new Promise(r => setTimeout(r, 800));
      }

      const children: Paragraph[] = [...buildDocHeader(`Resumo de Publicações DJEN${erros > 0 ? ` (${erros} não resumida(s))` : ""}`, totalPubs)];

      allPublicacoes.forEach((pub, idx) => {
        children.push(...buildPubMetadata(pub, idx));
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

  // ===== "Gerar Docs TST" - Classifica publicações e gera 3 documentos Word (TEMAS_IRR, PAUTA, PRAZOS) =====
  const handleGerarDocsTST = async () => {
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
  // Filtro client-side por data de disponibilização
  const allPublicacoes = useMemo(() => {
    if (!dataDisponibilizacao) return mergedPublicacoes;
    return mergedPublicacoes.filter(pub => {
      if (!pub.data_disponibilizacao) return false;
      const pubDate = pub.data_disponibilizacao.slice(0, 10); // YYYY-MM-DD
      return pubDate === dataDisponibilizacao;
    });
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
                  <p className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 truncate">Total Hoje</p>
                  <p className="text-xl md:text-3xl font-bold text-blue-700 dark:text-blue-300">
                    {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : totalHoje}
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
                    {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : naoLidasHoje}
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
                    {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                      estatisticas.reduce((acc, s) => acc + s.por_tipo.termo, 0)}
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
                    {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                      estatisticas.reduce((acc, s) => acc + s.por_tipo.processo, 0)}
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
                    {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : totalDescartadasHoje}
                  </p>
                </div>
                <Trash2 className="w-6 h-6 md:w-10 md:h-10 text-rose-500/50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950/50 dark:to-cyan-900/30 border-cyan-200 dark:border-cyan-800">
            <CardContent className="p-3 md:pt-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-cyan-600 dark:text-cyan-400 truncate">DataJud (CNJ)</p>
                  <p className="text-xl md:text-3xl font-bold text-cyan-700 dark:text-cyan-300">
                    {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : totalDatajudHoje}
                  </p>
                </div>
                <Database className="w-6 h-6 md:w-10 md:h-10 text-cyan-500/50 flex-shrink-0" />
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
                  <option value="todos">Todos</option>
                  <option value="termo">Por Termos/OAB</option>
                  <option value="parte">Por Parte</option>
                  <option value="processo">Por Processos</option>
                  <option value="datajud">DataJud (CNJ)</option>
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
                      setApenasHoje(false);
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

            <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-3 md:mt-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="apenasHoje"
                  checked={apenasHoje}
                  onCheckedChange={(checked) => setApenasHoje(checked as boolean)}
                />
                <Label htmlFor="apenasHoje" className="cursor-pointer text-xs md:text-sm font-medium">
                  Hoje
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="naoLidas"
                  checked={apenasNaoLidas}
                  onCheckedChange={(checked) => setApenasNaoLidas(checked as boolean)}
                />
                <Label htmlFor="naoLidas" className="cursor-pointer text-xs md:text-sm">
                  Não Lidas
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="todasPublicacoes"
                  checked={tipoOrigem === 'todos'}
                  onCheckedChange={(checked) => {
                    setTipoOrigem(checked ? 'todos' : 'normal');
                  }}
                />
                <Label htmlFor="todasPublicacoes" className="cursor-pointer text-xs md:text-sm font-medium">
                  Todas
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="apenasDescartadas"
                  checked={tipoOrigem === 'descartada'}
                  onCheckedChange={(checked) => {
                    setTipoOrigem(checked ? 'descartada' : 'normal');
                  }}
                />
                <Label htmlFor="apenasDescartadas" className="cursor-pointer text-xs md:text-sm text-destructive font-medium">
                  Descartadas
                </Label>
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
              : `Selecionar (${allPublicacoes.length})`}
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
            {coordenacoesOrdenadas.map((grupo) => (
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
                                {grupo.publicacoes.length} pub.
                              </Badge>
                              <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                {grupo.publicacoes.filter(p => p.tipo_origem === 'termo').length} termos
                              </Badge>
                              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                {grupo.publicacoes.filter(p => p.tipo_origem === 'processo').length} proc.
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Badge 
                          variant="default" 
                          className={cn(
                            "flex-shrink-0 text-[10px] md:text-xs px-1.5 md:px-2",
                            grupo.publicacoes.filter(p => !p.lida).length > 0 
                              ? "bg-amber-500" 
                              : "bg-green-500"
                          )}
                        >
                          {grupo.publicacoes.filter(p => !p.lida).length}
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
                                      <p className="text-xs md:text-sm font-medium text-primary hover:underline break-all">
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
                                  </div>
                                )}

                                {!isExpanded && pub.tribunal && (
                                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1 ml-4 md:ml-6">
                                    <strong>Tribunal:</strong> {pub.tribunal}
                                  </p>
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
            ))}
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
