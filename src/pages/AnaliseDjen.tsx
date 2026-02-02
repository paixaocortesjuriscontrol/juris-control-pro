import { useState, useEffect } from "react";
import {
  FileText,
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
  CheckCheck,
  FolderPlus,
  Save,
  Trash2,
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
import { cn } from "@/lib/utils";
import { formatConteudoParaExibicao, conteudoDisplayClasses, formatDateOnly } from "@/utils/formatConteudo";

import { usePublicacoesDjenUnificadas, PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CriarTarefaPublicacaoDialog } from "@/components/djen/CriarTarefaPublicacaoDialog";
import { DjenExecutionBanner } from "@/components/djen/DjenExecutionBanner";

type TipoOrigemPublicacao = 'termo' | 'processo' | 'descartada';
type TipoFiltroOrigem = 'todos' | 'normal' | 'termo' | 'processo' | 'descartada';

const AnaliseDjen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [importingProcessoId, setImportingProcessoId] = useState<string | null>(null);
  const [savingProcessoId, setSavingProcessoId] = useState<string | null>(null);

  // Buscar a coordenação do usuário logado
  const { data: userCoordenacao, isLoading: loadingUserCoord } = useQuery({
    queryKey: ['user-coordenacao', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('membros_coordenacao')
        .select('coordenacao_id')
        .eq('usuario_id', user.id);

      if (error) throw error;

      const ids = (data || []).map((r: any) => r.coordenacao_id).filter(Boolean);

      // Se o usuário estiver em várias coordenações, por padrão mostrar TODAS.
      if (ids.length !== 1) return "";

      // Se estiver em apenas 1, manter a experiência antiga (filtrar pela coordenação do usuário)
      return ids[0];
    },
    enabled: !!user?.id,
  });

  // Filtros - inicializar com coordenação do usuário
  const [coordenacaoId, setCoordenacaoId] = useState<string | null>(null); // null = ainda não inicializado
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [termoBusca, setTermoBusca] = useState<string>("");
  const [apenasNaoLidas, setApenasNaoLidas] = useState(true);
  const [apenasHoje, setApenasHoje] = useState(true); // Sempre marcado por padrão
  const [tipoOrigem, setTipoOrigem] = useState<TipoFiltroOrigem>('todos');

  // Quando carregar a coordenação do usuário, definir como padrão
  useEffect(() => {
    if (!loadingUserCoord && coordenacaoId === null) {
      // Inicializa com a coordenação do usuário (ou string vazia para "todas" se não tiver)
      setCoordenacaoId(userCoordenacao || "");
    }
  }, [userCoordenacao, loadingUserCoord, coordenacaoId]);
  
  // States
  const [selectedIds, setSelectedIds] = useState<Map<string, TipoOrigemPublicacao>>(
    new Map<string, TipoOrigemPublicacao>()
  );
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [criarTarefaDialogOpen, setCriarTarefaDialogOpen] = useState(false);
  const [selectedPublicacao, setSelectedPublicacao] = useState<PublicacaoUnificada | null>(null);
  const [expandedCoordenacoes, setExpandedCoordenacoes] = useState<Set<string>>(new Set(['all']));
  const [expandedPublicacoes, setExpandedPublicacoes] = useState<Set<string>>(new Set());


  // Determinar o filtro efetivo de coordenação
  // Se coordenacaoId ainda é null, aguardar inicialização
  // Se é string vazia "", significa "todas as coordenações"
  // Se tem valor, usar esse valor
  const coordenacaoFiltroEfetivo = coordenacaoId === null 
    ? undefined // ainda carregando
    : coordenacaoId === "" 
      ? undefined // todas
      : coordenacaoId; // coordenação específica
  
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
    dataInicio: apenasHoje ? undefined : dataInicio || undefined,
    dataFim: apenasHoje ? undefined : dataFim || undefined,
    termoBusca: termoBusca || undefined,
    apenasNaoLidas,
    apenasHoje,
    // 'todos' e 'normal' passam undefined para buscar termos e processos
    tipoOrigem: (tipoOrigem === 'todos' || tipoOrigem === 'normal') ? undefined : tipoOrigem,
    // incluir descartadas APENAS quando o filtro 'descartada' estiver ativo
    incluirDescartadas: tipoOrigem === 'descartada',
  });
  // Loading considera tanto o carregamento inicial da coordenação quanto das publicações
  const isLoading = loadingUserCoord || coordenacaoId === null || isLoadingPublicacoes;

  const { data: coordenacoes } = useCoordenacoes();

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
    if (selectedIds.size === publicacoes.length) {
      setSelectedIds(new Map<string, TipoOrigemPublicacao>());
    } else {
      const newMap = new Map<string, TipoOrigemPublicacao>();
      publicacoes.forEach(p => newMap.set(p.id, p.tipo_origem as TipoOrigemPublicacao));
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
    setSelectedPublicacao(pub);
    setViewDialogOpen(true);
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

  const toggleExpandAll = () => {
    if (expandedPublicacoes.size === publicacoes.length && publicacoes.length > 0) {
      setExpandedPublicacoes(new Set());
    } else {
      setExpandedPublicacoes(new Set(publicacoes.map(p => p.id)));
    }
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

  // Agrupar publicações por coordenação
  const publicacoesPorCoordenacao = publicacoes.reduce((acc, pub) => {
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
        {/* Banner de execução DJEN */}
        <DjenExecutionBanner />

        {/* Stats Cards - Mobile optimized */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Coordenação</Label>
                <select
                  className="w-full h-9 md:h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={coordenacaoId === null ? "__loading__" : (coordenacaoId || "__all__")}
                  onChange={(e) => setCoordenacaoId(e.target.value === "__all__" ? "" : e.target.value)}
                  disabled={coordenacaoId === null}
                >
                  {coordenacaoId === null && <option value="__loading__">Carregando...</option>}
                  <option value="__all__">Todas as Coordenações</option>
                  {coordenacoes?.map((c) => (
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
                  <option value="processo">Por Processos</option>
                </select>
              </div>

              {!apenasHoje && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs md:text-sm">Data Início</Label>
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="h-9 md:h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs md:text-sm">Data Fim</Label>
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
            disabled={publicacoes.length === 0}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
          >
            {selectedIds.size === publicacoes.length && publicacoes.length > 0
              ? "Desmarcar"
              : `Selecionar (${publicacoes.length})`}
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
            onClick={toggleExpandAll}
            disabled={publicacoes.length === 0}
            className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3"
          >
            <ChevronsUpDown className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">
              {expandedPublicacoes.size === publicacoes.length && publicacoes.length > 0
                ? "Recolher"
                : "Expandir"}
            </span>
            <span className="sm:hidden">
              {expandedPublicacoes.size === publicacoes.length && publicacoes.length > 0
                ? "−"
                : "+"}
            </span>
          </Button>
        </div>

        {/* Results by Coordination */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : publicacoes.length === 0 ? (
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
                                  
                                  {pub.tipo_origem === 'descartada' ? (
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
                                  
                                  {/* Descrição do termo que encontrou a publicação */}
                                  {(pub.monitoramento_descricao || pub.monitoramento_termo) && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                                      <Search className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
                                      <span>{pub.monitoramento_descricao || pub.monitoramento_termo}</span>
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
                                        {pub.processo_numero}
                                      </p>
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
                                         title="Ver detalhes em modal"
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
                                        title="Ver detalhes em modal"
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

                                {/* Expanded inline content - now uses full width */}
                                {isExpanded && (
                                  <div className="mt-2 md:mt-3 space-y-2 md:space-y-3 border-t pt-2 md:pt-3">
                                    {(pub.fonte || pub.tribunal) && (
                                      <div className="flex flex-wrap gap-3 md:gap-4 text-[10px] md:text-xs">
                                        {pub.fonte && (
                                          <div>
                                            <strong>Fonte:</strong>
                                            <span className="text-muted-foreground ml-1">{pub.fonte}</span>
                                          </div>
                                        )}
                                        {pub.tribunal && (
                                          <div>
                                            <strong>Tribunal:</strong>
                                            <span className="text-muted-foreground ml-1">{pub.tribunal}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <div>
                                      <strong className="text-[10px] md:text-xs">Conteúdo:</strong>
                                      <div className={cn("mt-1.5 md:mt-2 p-2 md:p-3 bg-muted/50 rounded-lg text-xs md:text-sm", conteudoDisplayClasses)}>
                                        {formatConteudoParaExibicao(pub.conteudo)}
                                      </div>
                                    </div>
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

        {/* View Dialog - Mobile optimized */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] md:w-auto p-3 md:p-6">
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center gap-2 text-sm md:text-base">
                <FileText className="w-4 h-4 md:w-5 md:h-5" />
                Detalhes da Publicação
              </DialogTitle>
              <DialogDescription className="text-xs md:text-sm">
                {selectedPublicacao?.tipo_origem === 'termo' ? 'Monitoramento por Termo/OAB' : 'Monitoramento por Processo'}
              </DialogDescription>
            </DialogHeader>

            {selectedPublicacao && (
              <ScrollArea className="max-h-[65vh] md:max-h-[60vh]">
                <div className="space-y-3 md:space-y-4 pr-2 md:pr-4">
                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    {selectedPublicacao.tipo_origem === 'termo' ? (
                      <Badge className="bg-purple-100 text-purple-700 text-xs">
                        <FileSearch className="w-3 h-3 mr-1" />
                        {selectedPublicacao.monitoramento_tipo === 'advogado'
                          ? `OAB ${selectedPublicacao.monitoramento_oab} ${selectedPublicacao.monitoramento_uf}`
                          : selectedPublicacao.monitoramento_termo
                        }
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                        <Gavel className="w-3 h-3 mr-1" />
                        Processo Cadastrado
                      </Badge>
                    )}
                    {selectedPublicacao.coordenacao_nome && (
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="w-3 h-3 mr-1" />
                        {selectedPublicacao.coordenacao_nome}
                      </Badge>
                    )}
                    {!selectedPublicacao.lida && (
                      <Badge className="bg-amber-500 text-xs">Nova</Badge>
                    )}
                  </div>

                  {selectedPublicacao.processo_numero && (
                    <div className="flex flex-wrap items-start md:items-center gap-1 md:gap-2">
                      <strong className="text-xs md:text-sm">Processo:</strong>
                      <span className="text-xs md:text-sm font-mono break-all">{selectedPublicacao.processo_numero}</span>
                      {selectedPublicacao.tipo_origem === 'processo' && selectedPublicacao.processo_id && (
                        <Link 
                          to={`/processos/${selectedPublicacao.processo_id}`}
                          className="text-xs md:text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir
                        </Link>
                      )}
                    </div>
                  )}

                  {selectedPublicacao.tipo_origem === 'processo' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
                      {selectedPublicacao.polo_ativo && (
                        <div>
                          <strong>Polo Ativo:</strong>
                          <p className="text-muted-foreground break-words">{selectedPublicacao.polo_ativo}</p>
                        </div>
                      )}
                      {selectedPublicacao.polo_passivo && (
                        <div>
                          <strong>Polo Passivo:</strong>
                          <p className="text-muted-foreground break-words">{selectedPublicacao.polo_passivo}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
                    <div>
                      <strong>Disponibilização:</strong>
                      <p className="text-muted-foreground">{formatDate(selectedPublicacao.data_disponibilizacao)}</p>
                    </div>
                    <div>
                      <strong>Publicação:</strong>
                      <p className="text-muted-foreground">{formatDate(selectedPublicacao.data_publicacao)}</p>
                    </div>
                    {selectedPublicacao.fonte && (
                      <div>
                        <strong>Fonte:</strong>
                        <p className="text-muted-foreground break-words">{selectedPublicacao.fonte}</p>
                      </div>
                    )}
                    {selectedPublicacao.tribunal && (
                      <div>
                        <strong>Tribunal:</strong>
                        <p className="text-muted-foreground">{selectedPublicacao.tribunal}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <strong className="text-xs md:text-sm">Conteúdo:</strong>
                    <div className={cn("mt-1.5 md:mt-2 p-2 md:p-4 bg-muted/50 rounded-lg text-xs md:text-sm", conteudoDisplayClasses)}>
                      {formatConteudoParaExibicao(selectedPublicacao.conteudo)}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

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
