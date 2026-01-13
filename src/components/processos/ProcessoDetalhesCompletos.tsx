import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft,
  ListTodo,
  Activity,
  Paperclip,
  Users,
  DollarSign,
  Download,
  MessageSquare,
  Clock,
  Scale,
  Copy,
  Calendar,
  FileText,
  Gavel,
  AlertCircle,
  FileBox,
  Newspaper,
  Shuffle,
  Radar,
  CalendarDays,
  Globe,
  User,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TarefaPublicacaoView } from "./TarefaPublicacaoView";

interface Responsavel {
  id: string;
  nome: string;
}

interface Envolvido {
  nome: string;
  tipo: "requerido" | "requerente";
  principal?: boolean;
}

interface ProcessoDetalhesCompletosProps {
  processo: any;
  responsaveis: Responsavel[];
  movimentacoes: any[];
  documentos: any[];
  tarefas: any[];
  // Dados adicionais
  audiencias?: any[];
  intimacoes?: any[];
  publicacoesDjen?: any[];
  redistribuicoes?: any[];
  alertas360?: any[];
  eventosAgenda?: any[];
  // Loading states
  loadingAudiencias?: boolean;
  loadingIntimacoes?: boolean;
  loadingPublicacoes?: boolean;
  loadingTarefas?: boolean;
  // Tarefa selection
  selectedTarefaId?: string | null;
  // Handlers
  onVoltar: () => void;
  onEditar: () => void;
  onEditAudiencia?: (audiencia: any) => void;
  onSelectIntimacao?: (intimacao: any) => void;
  onSelectTarefa?: (tarefaId: string) => void;
  onVoltarTarefa?: () => void;
}

export function ProcessoDetalhesCompletos({
  processo,
  responsaveis,
  movimentacoes,
  documentos,
  tarefas,
  audiencias = [],
  intimacoes = [],
  publicacoesDjen = [],
  redistribuicoes = [],
  alertas360 = [],
  eventosAgenda = [],
  loadingAudiencias = false,
  loadingIntimacoes = false,
  loadingPublicacoes = false,
  loadingTarefas = false,
  selectedTarefaId,
  onVoltar,
  onEditar,
  onEditAudiencia,
  onSelectIntimacao,
  onSelectTarefa,
  onVoltarTarefa,
}: ProcessoDetalhesCompletosProps) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>("detalhes");
  const [comentario, setComentario] = useState("");

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Não informado";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return "Não informado";
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "Não informado";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Envolvidos extraídos dos polos
  const envolvidos: Envolvido[] = [
    ...(processo.polo_passivo ? [{ nome: processo.polo_passivo, tipo: "requerido" as const, principal: true }] : []),
    ...(processo.polo_ativo ? [{ nome: processo.polo_ativo, tipo: "requerente" as const, principal: true }] : []),
  ];

  const FieldItem = ({ label, value, className }: { label: string; value: any; className?: string }) => (
    <div className={className}>
      <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{label}</p>
      <p className="text-sm text-foreground">{value || "Não informado"}</p>
    </div>
  );

  // Navigation items for sidebar - inclui todas as abas operacionais
  const navItems = [
    { id: "detalhes", label: "Detalhes", icon: FileText },
    { id: "audiencias", label: "Audiências", icon: Gavel, count: audiencias.length },
    { id: "intimacoes", label: "Intimações", icon: AlertCircle, count: intimacoes.length },
    { id: "tarefas", label: "Tarefas", icon: ListTodo, count: tarefas.length },
    { id: "documentos", label: "Pasta", icon: FileBox, count: documentos.length },
    { id: "publicacoes", label: "Pub. DJEN", icon: Newspaper, count: publicacoesDjen.length },
    { id: "andamentos", label: "Andamentos", icon: Activity, count: movimentacoes.length },
    { id: "redistribuicoes", label: "Redistrib.", icon: Shuffle, count: redistribuicoes.length },
    { id: "monitoramento360", label: "360º", icon: Radar, count: alertas360.length },
    { id: "agenda", label: "Agenda", icon: CalendarDays, count: eventosAgenda.length },
    { id: "portal", label: "Portal", icon: Globe },
    { id: "envolvidos", label: "Envolvidos", icon: Users },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
    { id: "comentarios", label: "Comentários", icon: MessageSquare },
  ];

  const getAudienciaStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      pendente: { className: "bg-amber-100 text-amber-700", label: "Pendente" },
      confirmada: { className: "bg-emerald-100 text-emerald-700", label: "Confirmada" },
      realizada: { className: "bg-blue-100 text-blue-700", label: "Realizada" },
      cancelada: { className: "bg-red-100 text-red-700", label: "Cancelada" },
    };
    const config = statusConfig[status] || statusConfig.pendente;
    return <Badge className={cn("text-xs", config.className)}>{config.label}</Badge>;
  };

  const getIntimacaoStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      pendente: { className: "bg-amber-100 text-amber-700", label: "Pendente" },
      em_andamento: { className: "bg-blue-100 text-blue-700", label: "Em andamento" },
      tratada: { className: "bg-emerald-100 text-emerald-700", label: "Tratada" },
      ignorada: { className: "bg-zinc-100 text-zinc-700", label: "Ignorada" },
    };
    const config = statusConfig[status] || statusConfig.pendente;
    return <Badge className={cn("text-xs", config.className)}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header compacto */}
      <div className="border-b bg-card">
        <div className="flex items-center gap-3 px-2 sm:px-4 py-2">
          <Button variant="ghost" size="sm" onClick={onVoltar}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {envolvidos.slice(0, 2).map((env, idx) => (
              <div key={idx} className="flex items-center gap-1">
                {idx > 0 && <span className="text-muted-foreground text-sm">×</span>}
                <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-[200px]">{env.nome}</span>
                <Badge 
                  className={cn(
                    "text-[9px] px-1 py-0",
                    env.tipo === "requerido" 
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-zinc-100 text-zinc-700"
                  )}
                >
                  {env.tipo === "requerido" ? "Req." : "Reqte."}
                </Badge>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Badge className="bg-blue-600 text-white text-xs hidden sm:inline-flex">Judicial</Badge>
            <Button variant="outline" size="sm" onClick={onEditar}>
              Editar
            </Button>
          </div>
        </div>
      </div>

      {/* Subheader compacto - Número e Assunto */}
      <div className="border-b bg-muted/30 px-2 sm:px-4 py-2">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Número</p>
            <div className="flex items-center gap-1">
              <p className="text-xs sm:text-sm font-mono">{processo.numero}</p>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5"
                onClick={() => copyToClipboard(processo.numero)}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase">Assunto</p>
            <p className="text-xs sm:text-sm truncate">{processo.assunto || "Não informado"}</p>
          </div>
        </div>
      </div>

      {/* Main Content - Sidebar + Content */}
      <div className="flex flex-col sm:flex-row min-w-0">
        {/* Sidebar Navigation - Horizontal scrollable on mobile, vertical on desktop */}
        <aside className="w-full sm:w-36 md:w-44 border-b sm:border-b-0 sm:border-r bg-muted/20 flex-shrink-0">
          {/* Mobile: horizontal scroll */}
          <div className="sm:hidden overflow-x-auto pb-1">
            <nav className="flex gap-1 px-2 py-2 min-w-max">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-md whitespace-nowrap transition-colors",
                    activeSection === item.id
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-3 h-3 flex-shrink-0" />
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[8px] h-3.5 px-1 min-w-[14px] flex items-center justify-center bg-background/80">
                      {item.count}
                    </Badge>
                  )}
                </button>
              ))}
            </nav>
          </div>
          {/* Desktop: vertical sidebar */}
          <ScrollArea className="hidden sm:block h-[calc(100vh-120px)]">
            <nav className="py-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-left transition-colors",
                    activeSection === item.id
                      ? "bg-primary/10 text-primary border-r-2 border-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1 min-w-[16px] flex items-center justify-center">
                      {item.count}
                    </Badge>
                  )}
                </button>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="p-3 sm:p-4">
              {/* Detalhes Section */}
              {activeSection === "detalhes" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-3">
                      <FieldItem label="Situação" value={processo.status === "ativo" ? "Ativo" : processo.status} />
                      
                      <div>
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Assunto</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm">{processo.assunto || "Não informado"}</p>
                          {processo.assunto && (
                            <Badge className="bg-amber-400 text-amber-900">
                              <Scale className="w-3 h-3" />
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <FieldItem label="Pasta física" value={processo.pasta_fisica} />
                        <FieldItem label="Pasta do cliente" value={processo.pasta_cliente || processo.pasta?.nome} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Responsáveis</p>
                          <div className="flex -space-x-2 mt-1">
                            {responsaveis.slice(0, 3).map((r) => (
                              <Avatar key={r.id} className="w-7 h-7 border-2 border-background">
                                <AvatarFallback className="text-xs bg-primary/10">
                                  {r.nome.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Marcadores</p>
                          <Badge className="bg-zinc-700 text-white text-xs mt-1">CAPTURA</Badge>
                        </div>
                      </div>

                      <FieldItem label="Descrição" value={processo.descricao} />
                    </div>

                    {/* Right Column */}
                    <div className="space-y-3">
                      <FieldItem label="Justiça" value={processo.justica || "Justiça dos Estados"} />
                      <FieldItem label="Órgão" value={`${processo.tribunal || ""} - ${processo.comarca || ""}`} />
                      
                      <div className="grid grid-cols-2 gap-3">
                        <FieldItem label="Órgão julgador" value={processo.orgao_julgador} />
                        <FieldItem label="Instância" value={processo.instancia || "1ª Instância"} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <FieldItem label="Sistema" value={processo.sistema} />
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Monitoramento</p>
                          <Badge className={cn(
                            "text-xs mt-1",
                            processo.monitorar_andamentos 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-zinc-100 text-zinc-600"
                          )}>
                            {processo.monitorar_andamentos ? "Habilitado" : "Desabilitado"}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Distribuição</p>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            {formatDate(processo.data_distribuicao)}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Citação</p>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            {formatDate(processo.data_citacao)}
                          </div>
                        </div>
                      </div>

                      <Separator className="my-2" />

                      <div className="grid grid-cols-2 gap-3">
                        <FieldItem label="Área" value={processo.area} />
                        <FieldItem label="Fase" value={processo.fase} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <FieldItem label="Valor da ação" value={formatCurrency(processo.valor_causa)} />
                        <FieldItem label="Probabilidade" value={processo.probabilidade} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Audiências Section */}
              {activeSection === "audiencias" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Gavel className="w-4 h-4" />
                      Audiências
                    </h3>
                  </div>
                  {loadingAudiencias ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
                    </div>
                  ) : audiencias.length > 0 ? (
                    <div className="space-y-2">
                      {audiencias.map((aud) => (
                        <Card 
                          key={aud.id} 
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => onEditAudiencia?.(aud)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getAudienciaStatusBadge(aud.status)}
                                  {aud.tipo_audiencia && (
                                    <Badge variant="outline" className="text-xs">{aud.tipo_audiencia}</Badge>
                                  )}
                                </div>
                                <p className="text-sm font-medium">
                                  {formatDate(aud.data_audiencia)} {aud.hora && `às ${aud.hora}`}
                                </p>
                                {aud.local_audiencia && (
                                  <p className="text-xs text-muted-foreground">{aud.local_audiencia}</p>
                                )}
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Gavel className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma audiência</p>
                    </div>
                  )}
                </div>
              )}

              {/* Intimações Section */}
              {activeSection === "intimacoes" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Intimações
                    </h3>
                  </div>
                  {loadingIntimacoes ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
                    </div>
                  ) : intimacoes.length > 0 ? (
                    <div className="space-y-2">
                      {intimacoes.map((int) => (
                        <Card 
                          key={int.id} 
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => onSelectIntimacao?.(int)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  {getIntimacaoStatusBadge(int.status)}
                                </div>
                                {int.descricao && (
                                  <p className="text-sm line-clamp-2">{int.descricao}</p>
                                )}
                                {int.data_limite && (
                                  <p className="text-xs text-destructive flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Prazo: {formatDate(int.data_limite)}
                                  </p>
                                )}
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma intimação</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tarefas Section */}
              {activeSection === "tarefas" && (
                <div className="space-y-3">
                  {selectedTarefaId ? (
                    <TarefaPublicacaoView
                      tarefaId={selectedTarefaId}
                      processoId={processo.id}
                      onVoltar={() => onVoltarTarefa?.()}
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <ListTodo className="w-4 h-4" />
                          Tarefas
                        </h3>
                        <Button 
                          size="sm" 
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7"
                          onClick={() => navigate(`/nova-tarefa?processo_id=${processo.id}`)}
                        >
                          Nova Tarefa
                        </Button>
                      </div>
                      {loadingTarefas ? (
                        <div className="space-y-3">
                          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                        </div>
                      ) : tarefas.length > 0 ? (
                        <div className="space-y-2">
                          {tarefas.map((tarefa: any) => (
                            <Card 
                              key={tarefa.id} 
                              className="hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => onSelectTarefa?.(tarefa.id)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium">{tarefa.titulo}</p>
                                    {tarefa.descricao && (
                                      <p className="text-xs text-muted-foreground line-clamp-1">{tarefa.descricao}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {tarefa.data_vencimento && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {formatDate(tarefa.data_vencimento)}
                                        </span>
                                      )}
                                      {tarefa.responsavel?.nome && (
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          {tarefa.responsavel.nome}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant={tarefa.status === 'cumprido' ? 'default' : 'secondary'} className="text-xs">
                                    {tarefa.status}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <ListTodo className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Nenhuma tarefa</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Documentos/Pasta Section */}
              {activeSection === "documentos" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <FileBox className="w-4 h-4" />
                      Pasta
                    </h3>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7">
                      Adicionar
                    </Button>
                  </div>
                  {documentos.length > 0 ? (
                    <div className="space-y-2">
                      {documentos.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between py-2 px-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{doc.nome}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileBox className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum documento</p>
                    </div>
                  )}
                </div>
              )}

              {/* Publicações DJEN Section */}
              {activeSection === "publicacoes" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Newspaper className="w-4 h-4" />
                      Publicações DJEN
                    </h3>
                  </div>
                  {loadingPublicacoes ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
                    </div>
                  ) : publicacoesDjen.length > 0 ? (
                    <div className="space-y-2">
                      {publicacoesDjen.map((pub: any) => (
                        <Card key={pub.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-3">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">{formatDate(pub.data_publicacao)}</p>
                              {pub.conteudo && (
                                <p className="text-sm line-clamp-3">{pub.conteudo}</p>
                              )}
                              {!pub.lida && (
                                <Badge className="bg-amber-500 text-xs">Nova</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma publicação</p>
                    </div>
                  )}
                </div>
              )}

              {/* Andamentos Section */}
              {activeSection === "andamentos" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Andamentos
                    </h3>
                    <Button size="sm" variant="outline" className="text-xs h-7">
                      Atualizar
                    </Button>
                  </div>
                  {movimentacoes.length > 0 ? (
                    <div className="space-y-2">
                      {movimentacoes.map((mov: any) => (
                        <div key={mov.id} className="border-l-2 border-blue-500/50 pl-3 py-2">
                          <p className="text-xs text-muted-foreground">{formatDate(mov.data_movimentacao)}</p>
                          <p className="text-sm">{mov.descricao}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum andamento</p>
                    </div>
                  )}
                </div>
              )}

              {/* Redistribuições Section */}
              {activeSection === "redistribuicoes" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Shuffle className="w-4 h-4" />
                      Redistribuições
                    </h3>
                  </div>
                  {redistribuicoes.length > 0 ? (
                    <div className="space-y-2">
                      {redistribuicoes.map((red: any) => (
                        <div key={red.id} className="border-l-2 border-amber-500/50 pl-3 py-2">
                          <p className="text-xs text-muted-foreground">{formatDate(red.data_movimentacao)}</p>
                          <p className="text-sm">{red.descricao}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Shuffle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma redistribuição</p>
                    </div>
                  )}
                </div>
              )}

              {/* Monitoramento 360 Section */}
              {activeSection === "monitoramento360" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Radar className="w-4 h-4" />
                      Monitoramento 360°
                    </h3>
                  </div>
                  {alertas360.length > 0 ? (
                    <div className="space-y-2">
                      {alertas360.map((alerta: any) => (
                        <Card key={alerta.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge className={cn(
                                  "text-xs",
                                  alerta.prioridade === "alta" ? "bg-red-100 text-red-700" :
                                  alerta.prioridade === "media" ? "bg-amber-100 text-amber-700" :
                                  "bg-zinc-100 text-zinc-700"
                                )}>
                                  {alerta.prioridade}
                                </Badge>
                                <Badge variant="outline" className="text-xs">{alerta.status}</Badge>
                              </div>
                              <p className="text-sm font-medium">{alerta.termo_encontrado}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(alerta.created_at)}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum alerta</p>
                    </div>
                  )}
                </div>
              )}

              {/* Agenda Section */}
              {activeSection === "agenda" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      Agenda
                    </h3>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7">
                      Novo Evento
                    </Button>
                  </div>
                  {eventosAgenda.length > 0 ? (
                    <div className="space-y-2">
                      {eventosAgenda.map((evento: any) => (
                        <Card key={evento.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{evento.titulo}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDateTime(evento.data_inicio)}
                              </p>
                              {evento.descricao && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{evento.descricao}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum evento</p>
                    </div>
                  )}
                </div>
              )}

              {/* Portal Section */}
              {activeSection === "portal" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Portal do Cliente
                    </h3>
                  </div>
                  <div className="text-center py-8">
                    <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Portal do cliente disponível na visualização resumida</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={onVoltar}>
                      Voltar para resumo
                    </Button>
                  </div>
                </div>
              )}

              {/* Envolvidos Section */}
              {activeSection === "envolvidos" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Envolvidos
                    </h3>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7">
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {envolvidos.map((env, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 px-3 border rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-blue-600">{env.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {env.tipo === "requerido" ? "Requerido" : "Requerente"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {env.tipo === "requerido" && (
                            <Badge className="bg-emerald-500 text-white text-xs">Cliente</Badge>
                          )}
                          {env.principal && (
                            <Badge variant="outline" className="text-xs">Principal</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financeiro Section */}
              {activeSection === "financeiro" && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Financeiro
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldItem label="Valor da ação" value={formatCurrency(processo.valor_causa)} />
                    <FieldItem label="Valor provisionado" value={formatCurrency(processo.valor_provisionado)} />
                    <FieldItem label="Depósito judicial" value={formatCurrency(processo.deposito_judicial)} />
                    <FieldItem label="Valor pago" value={formatCurrency(processo.valor_pago)} />
                    <FieldItem label="Probabilidade" value={processo.probabilidade} />
                    <FieldItem label="Risco" value={processo.risco} />
                  </div>
                </div>
              )}

              {/* Comentários Section */}
              {activeSection === "comentarios" && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comentários
                  </h3>
                  <div className="space-y-3">
                    <div className="text-right text-xs text-muted-foreground">
                      2000 caracteres restantes
                    </div>
                    <Textarea 
                      placeholder="Utilize o @ antes de um nome para citar outros usuários do sistema."
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <Button className="bg-zinc-700 hover:bg-zinc-800 text-white text-sm">
                      Comentar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
