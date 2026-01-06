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
import { usePublicacoesDjenUnificadas, PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const AnaliseDjen = () => {
  const { user } = useAuth();

  // Buscar a coordenação do usuário logado
  const { data: userCoordenacao, isLoading: loadingUserCoord } = useQuery({
    queryKey: ['user-coordenacao', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('membros_coordenacao')
        .select('coordenacao_id')
        .eq('usuario_id', user.id)
        .limit(1)
        .maybeSingle();
      return data?.coordenacao_id || null;
    },
    enabled: !!user?.id,
  });

  // Filtros - inicializar com placeholder até carregar coordenação
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [termoBusca, setTermoBusca] = useState<string>("");
  const [apenasNaoLidas, setApenasNaoLidas] = useState(true);
  const [apenasHoje, setApenasHoje] = useState(true);
  const [tipoOrigem, setTipoOrigem] = useState<'todos' | 'termo' | 'processo'>('todos');
  const [initialized, setInitialized] = useState(false);

  // Quando carregar a coordenação do usuário, definir como padrão
  useEffect(() => {
    if (!loadingUserCoord && !initialized) {
      if (userCoordenacao) {
        setCoordenacaoId(userCoordenacao);
      }
      setInitialized(true);
    }
  }, [userCoordenacao, loadingUserCoord, initialized]);
  
  // States
  const [selectedIds, setSelectedIds] = useState<Map<string, 'termo' | 'processo'>>(new Map());
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPublicacao, setSelectedPublicacao] = useState<PublicacaoUnificada | null>(null);
  const [expandedCoordenacoes, setExpandedCoordenacoes] = useState<Set<string>>(new Set(['all']));
  
  const { 
    publicacoes, 
    estatisticas, 
    isLoading, 
    loadingStats,
    marcarComoLida,
    totalHoje,
    naoLidasHoje
  } = usePublicacoesDjenUnificadas({
    coordenacaoId: coordenacaoId || undefined,
    dataInicio: apenasHoje ? undefined : dataInicio || undefined,
    dataFim: apenasHoje ? undefined : dataFim || undefined,
    termoBusca: termoBusca || undefined,
    apenasNaoLidas,
    apenasHoje,
    tipoOrigem: tipoOrigem === 'todos' ? undefined : tipoOrigem,
  });

  const { data: coordenacoes } = useCoordenacoes();

  const toggleSelect = (id: string, tipo: 'termo' | 'processo') => {
    const newSelected = new Map(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.set(id, tipo);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === publicacoes.length) {
      setSelectedIds(new Map());
    } else {
      const newMap = new Map<string, 'termo' | 'processo'>();
      publicacoes.forEach(p => newMap.set(p.id, p.tipo_origem));
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

  const handleMarcarLidas = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma publicação");
      return;
    }
    const items = Array.from(selectedIds.entries()).map(([id, tipo]) => ({ id, tipo_origem: tipo }));
    await marcarComoLida.mutateAsync(items);
    setSelectedIds(new Map());
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Hoje</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                    {loadingStats ? <Loader2 className="w-6 h-6 animate-spin" /> : totalHoje}
                  </p>
                </div>
                <FileText className="w-10 h-10 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Não Lidas</p>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                    {loadingStats ? <Loader2 className="w-6 h-6 animate-spin" /> : naoLidasHoje}
                  </p>
                </div>
                <Eye className="w-10 h-10 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Por Termos</p>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                    {loadingStats ? <Loader2 className="w-6 h-6 animate-spin" /> : 
                      estatisticas.reduce((acc, s) => acc + s.por_tipo.termo, 0)}
                  </p>
                </div>
                <FileSearch className="w-10 h-10 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Por Processos</p>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                    {loadingStats ? <Loader2 className="w-6 h-6 animate-spin" /> : 
                      estatisticas.reduce((acc, s) => acc + s.por_tipo.processo, 0)}
                  </p>
                </div>
                <Gavel className="w-10 h-10 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Coordenação</Label>
                <Select 
                  value={coordenacaoId || "__all__"} 
                  onValueChange={(val) => setCoordenacaoId(val === "__all__" ? "" : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {coordenacoes?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Origem</Label>
                <Select 
                  value={tipoOrigem} 
                  onValueChange={(val) => setTipoOrigem(val as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="termo">Por Termos/OAB</SelectItem>
                    <SelectItem value="processo">Por Processos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!apenasHoje && (
                <>
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Termo, processo, parte..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="apenasHoje"
                  checked={apenasHoje}
                  onCheckedChange={(checked) => setApenasHoje(checked as boolean)}
                />
                <Label htmlFor="apenasHoje" className="cursor-pointer font-medium">
                  Apenas hoje
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="naoLidas"
                  checked={apenasNaoLidas}
                  onCheckedChange={(checked) => setApenasNaoLidas(checked as boolean)}
                />
                <Label htmlFor="naoLidas" className="cursor-pointer">
                  Apenas não lidas
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            disabled={publicacoes.length === 0}
          >
            {selectedIds.size === publicacoes.length && publicacoes.length > 0
              ? "Desmarcar Todos"
              : `Selecionar Todos (${publicacoes.length})`}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleMarcarLidas}
            disabled={selectedIds.size === 0 || marcarComoLida.isPending}
          >
            {marcarComoLida.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Marcar como Lida ({selectedIds.size})
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
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedCoordenacoes.has(grupo.coordenacao_id) || expandedCoordenacoes.has('all') ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                          <Building2 className="w-5 h-5 text-primary" />
                          <div>
                            <CardTitle className="text-lg">{grupo.coordenacao_nome}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary">{grupo.publicacoes.length} publicações</Badge>
                              <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                                {grupo.publicacoes.filter(p => p.tipo_origem === 'termo').length} termos
                              </Badge>
                              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                                {grupo.publicacoes.filter(p => p.tipo_origem === 'processo').length} processos
                              </Badge>
                            </CardDescription>
                          </div>
                        </div>
                        <Badge 
                          variant="default" 
                          className={cn(
                            grupo.publicacoes.filter(p => !p.lida).length > 0 
                              ? "bg-amber-500" 
                              : "bg-green-500"
                          )}
                        >
                          {grupo.publicacoes.filter(p => !p.lida).length} não lidas
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {grupo.publicacoes.map((pub) => (
                          <div
                            key={pub.id}
                            className={cn(
                              "border rounded-lg p-4 transition-colors",
                              selectedIds.has(pub.id) && "bg-primary/5 border-primary/30",
                              !pub.lida && "border-l-4 border-l-primary"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={selectedIds.has(pub.id)}
                                onCheckedChange={() => toggleSelect(pub.id, pub.tipo_origem)}
                              />
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  {pub.tipo_origem === 'termo' ? (
                                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">
                                      <FileSearch className="w-3 h-3 mr-1" />
                                      {pub.monitoramento_tipo === 'advogado' 
                                        ? `OAB ${pub.monitoramento_oab || ''} ${pub.monitoramento_uf || ''}`
                                        : pub.monitoramento_termo || "Termo"
                                      }
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                      <Gavel className="w-3 h-3 mr-1" />
                                      Processo Cadastrado
                                    </Badge>
                                  )}
                                  
                                  {!pub.lida && (
                                    <Badge variant="default" className="bg-amber-500">
                                      Nova
                                    </Badge>
                                  )}
                                  
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {formatDateShort(pub.created_at)}
                                  </span>
                                </div>

                                {pub.processo_numero && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium text-primary">
                                      {pub.processo_numero}
                                    </p>
                                    {pub.tipo_origem === 'processo' && pub.processo_id && (
                                      <Link 
                                        to={`/processos/${pub.processo_id}`}
                                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        Ver processo
                                      </Link>
                                    )}
                                  </div>
                                )}

                                {pub.tipo_origem === 'processo' && (pub.polo_ativo || pub.polo_passivo) && (
                                  <p className="text-xs text-muted-foreground mb-1">
                                    {pub.polo_ativo && <span><strong>Ativo:</strong> {pub.polo_ativo}</span>}
                                    {pub.polo_ativo && pub.polo_passivo && ' | '}
                                    {pub.polo_passivo && <span><strong>Passivo:</strong> {pub.polo_passivo}</span>}
                                  </p>
                                )}

                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {pub.conteudo?.replace(/<[^>]*>/g, ' ').substring(0, 250) || "Sem conteúdo"}...
                                </p>

                                {pub.tribunal && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    <strong>Tribunal:</strong> {pub.tribunal}
                                  </p>
                                )}
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(pub)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Detalhes da Publicação
              </DialogTitle>
              <DialogDescription>
                {selectedPublicacao?.tipo_origem === 'termo' ? 'Monitoramento por Termo/OAB' : 'Monitoramento por Processo'}
              </DialogDescription>
            </DialogHeader>

            {selectedPublicacao && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 p-1">
                  <div className="flex flex-wrap gap-2">
                    {selectedPublicacao.tipo_origem === 'termo' ? (
                      <Badge className="bg-purple-100 text-purple-700">
                        <FileSearch className="w-3 h-3 mr-1" />
                        {selectedPublicacao.monitoramento_tipo === 'advogado'
                          ? `OAB ${selectedPublicacao.monitoramento_oab} ${selectedPublicacao.monitoramento_uf}`
                          : selectedPublicacao.monitoramento_termo
                        }
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <Gavel className="w-3 h-3 mr-1" />
                        Processo Cadastrado
                      </Badge>
                    )}
                    {selectedPublicacao.coordenacao_nome && (
                      <Badge variant="outline">
                        <Building2 className="w-3 h-3 mr-1" />
                        {selectedPublicacao.coordenacao_nome}
                      </Badge>
                    )}
                    {!selectedPublicacao.lida && (
                      <Badge className="bg-amber-500">Nova</Badge>
                    )}
                  </div>

                  {selectedPublicacao.processo_numero && (
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">Processo:</strong>
                      <span className="text-sm font-mono">{selectedPublicacao.processo_numero}</span>
                      {selectedPublicacao.tipo_origem === 'processo' && selectedPublicacao.processo_id && (
                        <Link 
                          to={`/processos/${selectedPublicacao.processo_id}`}
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir processo
                        </Link>
                      )}
                    </div>
                  )}

                  {selectedPublicacao.tipo_origem === 'processo' && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {selectedPublicacao.polo_ativo && (
                        <div>
                          <strong>Polo Ativo:</strong>
                          <p className="text-muted-foreground">{selectedPublicacao.polo_ativo}</p>
                        </div>
                      )}
                      {selectedPublicacao.polo_passivo && (
                        <div>
                          <strong>Polo Passivo:</strong>
                          <p className="text-muted-foreground">{selectedPublicacao.polo_passivo}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <strong>Data Publicação:</strong>
                      <p className="text-muted-foreground">{formatDate(selectedPublicacao.data_publicacao)}</p>
                    </div>
                    <div>
                      <strong>Capturado em:</strong>
                      <p className="text-muted-foreground">{formatDate(selectedPublicacao.created_at)}</p>
                    </div>
                    {selectedPublicacao.fonte && (
                      <div>
                        <strong>Fonte:</strong>
                        <p className="text-muted-foreground">{selectedPublicacao.fonte}</p>
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
                    <strong className="text-sm">Conteúdo:</strong>
                    <div 
                      className="mt-2 p-4 bg-muted/50 rounded-lg text-sm prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ 
                        __html: selectedPublicacao.conteudo || "Sem conteúdo" 
                      }}
                    />
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default AnaliseDjen;
