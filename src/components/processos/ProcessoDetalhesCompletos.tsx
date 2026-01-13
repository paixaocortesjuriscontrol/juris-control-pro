import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft,
  ListTodo,
  GitBranch,
  Activity,
  Paperclip,
  Users,
  Link2,
  DollarSign,
  Download,
  ClipboardList,
  Package,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  MoreVertical,
  Scale,
  Copy,
  Calendar,
  MapPin,
  Building2,
  Bell,
  BellOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  onVoltar: () => void;
  onEditar: () => void;
}

export function ProcessoDetalhesCompletos({
  processo,
  responsaveis,
  movimentacoes,
  documentos,
  tarefas,
  onVoltar,
  onEditar,
}: ProcessoDetalhesCompletosProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    tarefas: false,
    workflow: false,
    andamentos: true,
    documentos: false,
    envolvidos: true,
    relacionados: false,
    financeiro: false,
    solicitacoes: false,
    pedidos: false,
    bens: false,
    comentarios: true,
    timesheet: false,
    auditoria: false,
  });

  const [comentario, setComentario] = useState("");

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Não informado";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
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

  const SectionHeader = ({ 
    icon: Icon, 
    title, 
    section, 
    count,
    actionButton,
    hasSearch = false
  }: { 
    icon: any; 
    title: string; 
    section: string;
    count?: number;
    actionButton?: React.ReactNode;
    hasSearch?: boolean;
  }) => (
    <CollapsibleTrigger 
      className="w-full"
      onClick={() => toggleSection(section)}
    >
      <div className="flex items-center justify-between py-3 px-4 bg-slate-50 dark:bg-slate-800/50 border rounded-t-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{title}</span>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs">{count}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasSearch && expandedSections[section] && (
            <div className="flex items-center gap-1 mr-2">
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          {actionButton}
          {expandedSections[section] ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
    </CollapsibleTrigger>
  );

  const ActionButton = ({ label, variant = "default" }: { label: string; variant?: "default" | "outline" }) => (
    <Button 
      size="sm" 
      variant={variant === "default" ? "default" : "outline"}
      className={cn(
        "h-7 text-xs",
        variant === "default" && "bg-emerald-600 hover:bg-emerald-700"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Button>
  );

  const FieldItem = ({ label, value, className }: { label: string; value: any; className?: string }) => (
    <div className={className}>
      <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{label}</p>
      <p className="text-sm text-foreground">{value || "Não informado"}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Partes envolvidas */}
      <div className="border-b bg-card">
        <div className="flex items-center gap-4 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onVoltar}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-wrap">
            {envolvidos.map((env, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {idx > 0 && <span className="text-muted-foreground">×</span>}
                <span className="font-medium">{env.nome}</span>
                <Badge 
                  className={cn(
                    "text-[10px]",
                    env.tipo === "requerido" 
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-zinc-100 text-zinc-700"
                  )}
                >
                  {env.tipo === "requerido" ? "Requerido" : "Requerente"}
                </Badge>
              </div>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Badge className="bg-blue-600 text-white">Judicial</Badge>
            {/* Icon buttons - simplified */}
            <div className="flex items-center gap-1">
              {[Calendar, ListTodo, Paperclip, Link2, Users, Activity, Clock, DollarSign, Download].map((Icon, idx) => (
                <Button key={idx} variant="ghost" size="icon" className="h-8 w-8">
                  <Icon className="w-4 h-4" />
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Subheader - Identificador, Número, Assunto */}
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="grid grid-cols-3 gap-8">
          <div>
            <p className="text-xs text-muted-foreground">Identificador</p>
            <p className="text-sm font-mono">{processo.identificador_projuris || `PRO.${processo.id.slice(0, 8).toUpperCase()}`}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Número do Processo</p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-mono">{processo.numero}</p>
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
          <div>
            <p className="text-xs text-muted-foreground">Assunto</p>
            <div className="flex items-center gap-2">
              <p className="text-sm">{processo.assunto || "Não informado"}</p>
              {processo.assunto && (
                <Badge className="bg-amber-400 text-amber-900">
                  <Scale className="w-3 h-3" />
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left Column - Detalhes */}
        <ScrollArea className="h-[calc(100vh-180px)] border-r">
          <div className="p-6 space-y-6">
            {/* Detalhes do processo */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Detalhes do processo</h3>
                <Button variant="outline" size="sm" onClick={onEditar}>
                  Editar
                </Button>
              </div>

              <div className="space-y-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <FieldItem label="Pasta física" value={processo.pasta_fisica} />
                  <FieldItem label="Pasta do cliente" value={processo.pasta_cliente || processo.pasta?.nome} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Responsáveis</p>
                    <div className="flex -space-x-2 mt-1">
                      {responsaveis.slice(0, 3).map((r) => (
                        <Avatar key={r.id} className="w-8 h-8 border-2 border-background">
                          <AvatarFallback className="text-xs bg-primary/10">
                            {r.nome.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                  <FieldItem label="Grupos de trabalho" value="Não informado" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FieldItem label="Unidade organizacional origem" value={processo.unidade_origem || "Não informado"} />
                  <FieldItem label="Unidade organizacional atual" value={processo.unidade_atual || "Não informado"} />
                </div>

                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Marcadores</p>
                  <Badge className="bg-zinc-700 text-white text-xs mt-1">CAPTURA</Badge>
                </div>

                <FieldItem label="Descrição" value={processo.descricao} />
              </div>
            </div>

            <Separator />

            {/* Numeração */}
            <div>
              <h3 className="font-semibold mb-4">Numeração</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Numeração padrão CNJ</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono">{processo.numero}</p>
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
                <FieldItem label="Numeração complementar" value={processo.numero_complementar} />
              </div>
            </div>

            <Separator />

            {/* Endereçamento */}
            <div>
              <h3 className="font-semibold mb-4">Endereçamento</h3>
              <div className="space-y-4">
                <FieldItem label="Justiça" value={processo.justica || "Justiça dos Estados e do Distrito Federal e Territórios"} />
                <FieldItem label="Órgão" value={`${processo.tribunal || ""} - ${processo.comarca || ""}`} />
                
                <div className="grid grid-cols-2 gap-4">
                  <FieldItem label="Órgão julgador" value={processo.orgao_julgador} />
                  <FieldItem label="Instância" value={processo.instancia || "1ª Instância"} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FieldItem label="Sistema" value={processo.sistema} />
                  <div>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Monitoramento (Push)</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={cn(
                        "text-xs",
                        processo.monitorar_andamentos 
                          ? "bg-emerald-100 text-emerald-700" 
                          : "bg-zinc-100 text-zinc-600"
                      )}>
                        {processo.monitorar_andamentos ? "Habilitado" : "Desabilitado"}
                      </Badge>
                      <Badge className="bg-amber-100 text-amber-700 text-xs">Em andamento</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Recebimento</p>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      {formatDate(processo.data_recebimento)}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Arquivamento</p>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      {formatDate(processo.data_arquivamento)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Autos */}
            <div>
              <h3 className="font-semibold mb-4">Autos</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FieldItem label="Área" value={processo.area} />
                  <FieldItem label="Fase" value={processo.fase} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FieldItem label="Instância - CNJ" value={processo.instancia} />
                  <FieldItem label="Classe - CNJ" value={processo.classe_cnj} />
                </div>
                <FieldItem label="Assunto - CNJ" value={processo.assunto_cnj || "0 itens selecionados"} />
                <div className="grid grid-cols-2 gap-4">
                  <FieldItem label="Segredo de justiça" value={processo.segredo_justica ? "Sim" : "Não"} />
                  <FieldItem label="Senha do processo" value={processo.senha_processo} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Pedidos */}
            <div>
              <h3 className="font-semibold mb-4">Pedidos</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FieldItem label="Valor da ação" value={formatCurrency(processo.valor_causa)} />
                  <FieldItem label="Valor provisionado" value={formatCurrency(processo.valor_provisionado)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FieldItem label="Probabilidade" value={processo.probabilidade} />
                  <FieldItem label="Provisionamento" value={processo.provisionamento} />
                </div>
                <FieldItem label="Risco" value={processo.risco} />
              </div>
            </div>

            <Separator />

            {/* Campos personalizados */}
            <div>
              <h3 className="font-semibold mb-4">Campos personalizados</h3>
              <FieldItem label="Sistema Judicial" value={processo.sistema || "PJE"} />
            </div>
          </div>
        </ScrollArea>

        {/* Right Column - Sections */}
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-4 space-y-2">
            {/* Tarefas */}
            <Collapsible open={expandedSections.tarefas}>
              <SectionHeader 
                icon={ListTodo} 
                title="Tarefas" 
                section="tarefas" 
                count={tarefas.length}
                actionButton={<ActionButton label="Adicionar" />}
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  {tarefas.length > 0 ? (
                    <div className="space-y-2">
                      {tarefas.slice(0, 5).map((tarefa: any) => (
                        <div key={tarefa.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">{tarefa.titulo}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(tarefa.data_vencimento)}</p>
                          </div>
                          <Badge variant={tarefa.status === "concluida" ? "secondary" : "default"}>
                            {tarefa.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Workflow */}
            <Collapsible open={expandedSections.workflow}>
              <SectionHeader 
                icon={GitBranch} 
                title="Workflow" 
                section="workflow"
                actionButton={<ActionButton label="Iniciar fluxo" />}
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum workflow ativo</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Andamentos */}
            <Collapsible open={expandedSections.andamentos}>
              <SectionHeader 
                icon={Activity} 
                title="Andamentos" 
                section="andamentos"
                count={movimentacoes.length}
                actionButton={<ActionButton label="Adicionar" />}
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4 max-h-[300px] overflow-y-auto">
                  {movimentacoes.length > 0 ? (
                    <div className="space-y-3">
                      {movimentacoes.slice(0, 10).map((mov: any) => (
                        <div key={mov.id} className="border-b last:border-0 pb-2">
                          <p className="text-xs text-muted-foreground">{formatDate(mov.data_movimentacao)}</p>
                          <p className="text-sm">{mov.descricao}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum andamento</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Documentos */}
            <Collapsible open={expandedSections.documentos}>
              <SectionHeader 
                icon={Paperclip} 
                title="Documentos" 
                section="documentos"
                count={documentos.length}
                actionButton={<ActionButton label="Adicionar" />}
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  {documentos.length > 0 ? (
                    <div className="space-y-2">
                      {documentos.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between py-2">
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
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Envolvidos */}
            <Collapsible open={expandedSections.envolvidos}>
              <SectionHeader 
                icon={Users} 
                title="Envolvidos" 
                section="envolvidos"
                hasSearch
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  <div className="space-y-3">
                    {envolvidos.map((env, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-xs text-muted-foreground">Pessoa</p>
                          <p className="text-sm font-medium text-blue-600">{env.nome}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Envolvimento</p>
                            <p className="text-sm">{env.tipo === "requerido" ? "Requerido" : "Requerente"}</p>
                          </div>
                          <div className="flex gap-1">
                            {env.tipo === "requerido" && (
                              <Badge className="bg-emerald-500 text-white text-xs">Cliente</Badge>
                            )}
                            {env.principal && (
                              <Badge variant="outline" className="text-xs">Principal</Badge>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white">
                    Adicionar
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Processos relacionados */}
            <Collapsible open={expandedSections.relacionados}>
              <SectionHeader 
                icon={Link2} 
                title="Processos relacionados" 
                section="relacionados"
                actionButton={<ActionButton label="Adicionar" />}
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum processo relacionado</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Financeiro */}
            <Collapsible open={expandedSections.financeiro}>
              <SectionHeader 
                icon={DollarSign} 
                title="Financeiro" 
                section="financeiro"
                actionButton={<ActionButton label="Adicionar" />}
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro financeiro</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Solicitações */}
            <Collapsible open={expandedSections.solicitacoes}>
              <SectionHeader 
                icon={Download} 
                title="Solicitações" 
                section="solicitacoes"
                actionButton={<ActionButton label="Adicionar" />}
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma solicitação</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Pedidos */}
            <Collapsible open={expandedSections.pedidos}>
              <SectionHeader 
                icon={ClipboardList} 
                title="Pedidos" 
                section="pedidos"
                actionButton={<ActionButton label="Adicionar" />}
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Bens e garantias */}
            <Collapsible open={expandedSections.bens}>
              <SectionHeader 
                icon={Package} 
                title="Bens e garantias" 
                section="bens"
                actionButton={<ActionButton label="Adicionar" />}
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum bem ou garantia</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Comentários */}
            <Collapsible open={expandedSections.comentarios}>
              <SectionHeader 
                icon={MessageSquare} 
                title="Comentários" 
                section="comentarios"
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
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
                    <Button className="bg-zinc-700 hover:bg-zinc-800 text-white">
                      Comentar
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Timesheet */}
            <Collapsible open={expandedSections.timesheet}>
              <SectionHeader 
                icon={Clock} 
                title="Timesheet" 
                section="timesheet"
                actionButton={<ActionButton label="Adicionar" />}
              />
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Auditoria */}
            <Collapsible open={expandedSections.auditoria}>
              <div className="flex items-center gap-2">
                <SectionHeader 
                  icon={Clock} 
                  title="Auditoria" 
                  section="auditoria"
                />
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">ALPHA</Badge>
              </div>
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4">
                  <p className="text-sm text-muted-foreground text-center py-4">Histórico de alterações</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
