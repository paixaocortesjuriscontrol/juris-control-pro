import { useState, useRef } from "react";
import { ProcessoTstTab } from "./ProcessoTstTab";
import { BaixarAutosButton } from "./BaixarAutosButton";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  Eye,
  Home,
  Bell,
  BellOff,
  Info,
  ListPlus
} from "lucide-react";
import { ProcessoPedidosTab } from "./ProcessoPedidosTab";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TarefaPublicacaoView } from "./TarefaPublicacaoView";
import { PublicacoesDjenList } from "./PublicacoesDjenList";
import { CobrancaSection } from "./CobrancaSection";
import { MonitoramentoToggle } from "./MonitoramentoToggle";
import { PendenciasProcessoCard } from "./PendenciasProcessoCard";
import { DepositosRecursaisCard } from "./DepositosRecursaisCard";
import { CustasProcessuaisCard } from "./CustasProcessuaisCard";
import { AnaliseDocumentoDialog } from "./AnaliseDocumentoDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast as sonnerToast } from "sonner";
import { Loader2, Upload as UploadIcon } from "lucide-react";

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
  onCriarTarefaPublicacao?: (publicacao: any) => void;
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
  onCriarTarefaPublicacao,
}: ProcessoDetalhesCompletosProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<string>("resumo");
  const [comentario, setComentario] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analiseResult, setAnaliseResult] = useState<any>(null);
  const [analiseDialogOpen, setAnaliseDialogOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<{ docId: string; file: File } | null>(null);

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

  // Upload & AI analysis handler for Pasta section
  const handlePastaFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !processo?.id) return;
    
    setUploading(true);
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${processo.id}/${Date.now()}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos_processos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("documentos_processos")
        .getPublicUrl(filePath);

      const { data: docData, error: dbError } = await supabase
        .from("documentos")
        .insert({
          nome: file.name,
          tipo: file.type,
          url: urlData.publicUrl,
          tamanho_bytes: file.size,
          processo_id: processo.id,
          uploaded_by: user.id,
        })
        .select("id")
        .single();

      if (dbError) throw dbError;

      // Also save to repositorio_documentos
      const repoPath = `${user.id}/${Date.now()}_${sanitizedName}`;
      await supabase.storage.from("repositorio_documentos").upload(repoPath, file);
      await supabase.from("repositorio_documentos").insert({
        nome: file.name,
        nome_original: file.name,
        categoria: "outros",
        tamanho_bytes: file.size,
        mime_type: file.type,
        storage_path: repoPath,
        uploaded_by: user.id,
        processo_id: processo.id,
      });

      // Read only first 50KB of text files for AI analysis (avoids loading huge files in memory)
      const MAX_CONTENT_SIZE = 50_000;
      const fileContent = await new Promise<string>((resolve) => {
        const isText = file.type.includes("text") || file.type.includes("json") || file.type.includes("xml") || file.type.includes("csv");
        if (isText) {
          const slice = file.slice(0, MAX_CONTENT_SIZE);
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || "");
          reader.onerror = () => resolve("");
          reader.readAsText(slice);
        } else {
          // For binary files (PDF, images, etc.), send only the file name for analysis
          resolve(`[Arquivo binário: ${file.name}, tamanho: ${(file.size / 1024 / 1024).toFixed(1)}MB]`);
        }
      });

      sonnerToast.info("Analisando documento com IA...");
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analisar-documento`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            fileContent,
            mimeType: file.type,
            processoAtual: processo,
          }),
        }
      );

      if (response.ok) {
        const analise = await response.json();
        
        if (docData?.id) {
          await supabase.from("documentos").update({
            categoria: analise.categoria,
            tipo_documento: analise.tipo_documento,
            descricao: analise.descricao,
            tags: analise.tags,
            analisado_ia: true,
            confianca_ia: analise.confianca,
          }).eq("id", docData.id);
        }

        const hasCampos = analise.campos_extraidos && Object.keys(analise.campos_extraidos).length > 0;
        const hasPartes = analise.partes?.polo_ativo || analise.partes?.polo_passivo;
        const hasInfo = analise.info_processual && Object.keys(analise.info_processual).length > 0;

        if (hasCampos || hasPartes || hasInfo) {
          setAnaliseResult(analise);
          setPendingUploadFile({ docId: docData?.id || '', file });
          setAnaliseDialogOpen(true);
        } else {
          sonnerToast.success("Documento enviado e analisado pela IA!");
        }
      } else {
        sonnerToast.success("Documento enviado! (análise IA indisponível)");
      }

      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["repositorio-documentos"] });
    } catch (error: any) {
      sonnerToast.error("Erro ao enviar documento: " + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAnaliseConfirm = async (camposParaPreencher: Record<string, any>) => {
    if (!processo?.id || Object.keys(camposParaPreencher).length === 0) {
      setAnaliseDialogOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("processos")
        .update(camposParaPreencher)
        .eq("id", processo.id);

      if (error) throw error;
      sonnerToast.success(`${Object.keys(camposParaPreencher).length} campo(s) preenchido(s) automaticamente!`);
      queryClient.invalidateQueries({ queryKey: ["processos"] });
    } catch (error: any) {
      sonnerToast.error("Erro ao atualizar processo: " + error.message);
    }
    setAnaliseDialogOpen(false);
  };


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

  // Deduplica alertas 360 por movimentacao_id + termo_encontrado (usado na contagem e na listagem)
  // e enriquece com publicação DJEN relacionada (busca por termo no conteúdo)
  const alertas360Unicos = alertas360.reduce((acc: any[], alerta: any) => {
    const chave = `${alerta.movimentacao_id || 'sem-mov'}-${alerta.termo_encontrado}`;
    if (!acc.find((a: any) => `${a.movimentacao_id || 'sem-mov'}-${a.termo_encontrado}` === chave)) {
      // Busca publicação DJEN que contenha o termo encontrado
      const publicacaoRelacionada = publicacoesDjen.find((pub: any) => {
        const conteudo = (pub.conteudo || '').toLowerCase();
        const termo = (alerta.termo_encontrado || '').toLowerCase();
        return conteudo.includes(termo);
      });
      acc.push({ ...alerta, publicacao_relacionada: publicacaoRelacionada || null });
    }
    return acc;
  }, []);

  // Navigation items for sidebar - inclui todas as abas operacionais
  const navItems = [
    { id: "resumo", label: "Resumo", icon: Home },
    { id: "detalhes", label: "Detalhes", icon: FileText },
    { id: "cobranca", label: "Cobrança", icon: DollarSign },
    { id: "audiencias", label: "Audiências", icon: Gavel, count: audiencias.length },
    { id: "intimacoes", label: "Intimações", icon: AlertCircle, count: intimacoes.length },
    { id: "tarefas", label: "Tarefas", icon: ListTodo, count: tarefas.length },
    { id: "tst", label: "TST", icon: Gavel },
    { id: "documentos", label: "Pasta", icon: FileBox, count: documentos.length },
    { id: "pedidos", label: "Pedidos", icon: ListPlus },
    { id: "publicacoes", label: "Pub. DJEN", icon: Newspaper, count: publicacoesDjen.length },
    { id: "andamentos", label: "Andamentos", icon: Activity, count: movimentacoes.length },
    { id: "redistribuicoes", label: "Redistrib.", icon: Shuffle, count: redistribuicoes.length },
    { id: "monitoramento360", label: "360º", icon: Radar, count: alertas360Unicos.length },
    { id: "agenda", label: "Agenda", icon: CalendarDays, count: eventosAgenda.length },
    { id: "portal", label: "Portal", icon: Globe },
    { id: "envolvidos", label: "Envolvidos", icon: Users },
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
          {/*
            No mobile, evitamos criar um scroll container próprio (ScrollArea) com altura fixa.
            Isso reduz conflitos de gesto com scrolls horizontais aninhados (ex.: tabela de Pedidos).
            No desktop mantemos a altura fixa para scroll interno.
          */}
          {/*
            Evita ScrollArea (Radix) no conteúdo para não capturar gestos no mobile.
            No desktop mantemos scroll interno via overflow-y-auto + altura fixa.
          */}
          <div className="p-3 sm:p-4 sm:h-[calc(100vh-120px)] sm:overflow-y-auto">
              {/* Resumo Section - Visão geral rápida */}
              {activeSection === "resumo" && (
                <div className="space-y-4">
                  {/* Card de Resumo Principal */}
                  <Card>
                    <CardContent className="p-4 md:p-6">
                      {/* Título */}
                      <h2 className="text-base font-semibold text-foreground">Resumo do processo</h2>
                      
                      {/* Número */}
                      <div className="mt-2">
                        <p className="text-[10px] text-muted-foreground uppercase">Número</p>
                        <div className="flex items-center gap-1">
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
                      
                      {/* Assunto */}
                      <div className="mt-3 mb-4 pb-3 border-b">
                        <p className="text-[10px] text-muted-foreground uppercase">Assunto</p>
                        <p className="text-sm">{processo.assunto || "Não informado"}</p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                        {/* Coluna Esquerda */}
                        <div className="space-y-4">



                          {/* Situação - Seletor inline */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Situação</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Select
                                value={processo.status || "ativo"}
                                onValueChange={async (newStatus) => {
                                  try {
                                    const { error } = await supabase
                                      .from("processos")
                                      .update({ status: newStatus as any })
                                      .eq("id", processo.id);

                                    if (error) throw error;

                                    window.location.reload();
                                  } catch (err) {
                                    console.error("Erro ao atualizar situação:", err);
                                    toast({
                                      title: "Erro",
                                      description: "Não foi possível atualizar a situação do processo.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="w-auto h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ativo">Ativo</SelectItem>
                                  <SelectItem value="arquivado_parcialmente">Arquivado Parcialmente</SelectItem>
                                  <SelectItem value="arquivado_definitivamente">Arquivado Definitivamente</SelectItem>
                                  <SelectItem value="suspenso">Suspenso</SelectItem>
                                  <SelectItem value="encerrado">Encerrado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Órgão */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Órgão</p>
                            <p className="text-sm text-foreground mt-1">
                              {processo.tribunal || processo.vara || "Não informado"}
                              {processo.comarca && ` - ${processo.comarca}`}
                            </p>
                          </div>

                          {/* Envolvidos */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Envolvidos</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {processo.polo_passivo && (
                                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                                  {processo.polo_passivo}
                                  <span className="ml-2 text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">Req.</span>
                                </Badge>
                              )}
                              {processo.polo_ativo && (
                                <Badge variant="outline" className="bg-muted border-border text-muted-foreground">
                                  {processo.polo_ativo}
                                  <span className="ml-2 text-[10px] bg-muted-foreground text-background px-1.5 py-0.5 rounded">Reqte.</span>
                                </Badge>
                              )}
                            </div>
                            <Button 
                              variant="link" 
                              size="sm" 
                              className="text-xs p-0 h-auto mt-1 text-primary"
                              onClick={() => setActiveSection("envolvidos")}
                            >
                              Expandir
                            </Button>
                          </div>

                          {/* Responsáveis */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsáveis</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {responsaveis.length > 0 ? (
                                responsaveis.map((r) => (
                                  <div key={r.id} className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1">
                                    <Avatar className="w-6 h-6 border border-background">
                                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-semibold">
                                        {r.nome.substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">{r.nome}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">Não atribuído</p>
                              )}
                            </div>
                          </div>

                          {/* Valor da ação */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor da ação</p>
                            <p className="text-lg font-semibold text-foreground">{formatCurrency(processo.valor_causa)}</p>
                          </div>

                          {/* Campos movidos da coluna direita - abaixo do valor da ação */}
                          <div className="pt-3 border-t space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data de distribuição</p>
                                <p className="text-sm text-foreground">{formatDate(processo.data_distribuicao)}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Órgão julgador</p>
                                <p className="text-sm text-foreground">{processo.orgao_julgador || "Não informado"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Área</p>
                                <p className="text-sm text-foreground">{processo.area || "Não informado"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fase</p>
                                <p className="text-sm text-foreground">{processo.fase || "Não informado"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sistema</p>
                                <p className="text-sm text-foreground">{processo.sistema || "Não informado"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pasta física</p>
                                <p className="text-sm text-foreground">{processo.pasta_fisica || "Não informado"}</p>
                              </div>
                            </div>

                            {/* Descrição */}
                            {processo.descricao && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</p>
                                <p className="text-sm text-foreground mt-1">{processo.descricao}</p>
                              </div>
                            )}

                            {/* Pasta do Cliente */}
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pasta do Cliente</p>
                              <p className="text-sm text-foreground">{processo.pasta_cliente || processo.pasta?.nome || "Não vinculado"}</p>
                            </div>

                            {/* Monitoramento */}
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monitoramento</p>
                              <div className="mt-2 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-foreground w-24">Andamentos</span>
                                  <MonitoramentoToggle
                                    processoId={processo.id}
                                    campo="monitorar_andamentos"
                                    valorInicial={!!processo.monitorar_andamentos}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-foreground w-24">DJEN</span>
                                  <MonitoramentoToggle
                                    processoId={processo.id}
                                    campo="monitorar_djen"
                                    valorInicial={!!processo.monitorar_djen}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Coluna Direita - Cards de Pendências, Depósitos e Custas */}
                        <div className="space-y-3">
                          <PendenciasProcessoCard
                            audiencias={audiencias}
                            intimacoes={intimacoes}
                            tarefas={tarefas}
                            movimentacoes={movimentacoes}
                          />
                          <DepositosRecursaisCard processoId={processo.id} />
                          <CustasProcessuaisCard processoId={processo.id} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cards de estatísticas rápidas */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection("tarefas")}>
                      <CardContent className="p-4 text-center">
                        <ListTodo className="w-6 h-6 mx-auto text-primary mb-2" />
                        <p className="text-2xl font-bold">{tarefas.length}</p>
                        <p className="text-xs text-muted-foreground">Tarefas</p>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection("audiencias")}>
                      <CardContent className="p-4 text-center">
                        <Gavel className="w-6 h-6 mx-auto text-primary mb-2" />
                        <p className="text-2xl font-bold">{audiencias.length}</p>
                        <p className="text-xs text-muted-foreground">Audiências</p>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection("andamentos")}>
                      <CardContent className="p-4 text-center">
                        <Activity className="w-6 h-6 mx-auto text-primary mb-2" />
                        <p className="text-2xl font-bold">{movimentacoes.length}</p>
                        <p className="text-xs text-muted-foreground">Andamentos</p>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection("publicacoes")}>
                      <CardContent className="p-4 text-center">
                        <Newspaper className="w-6 h-6 mx-auto text-primary mb-2" />
                        <p className="text-2xl font-bold">{publicacoesDjen.length}</p>
                        <p className="text-xs text-muted-foreground">Publicações</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Detalhes Section - Todas as informações organizadas por categoria */}
              {activeSection === "detalhes" && (
                <div className="space-y-6">
                  {/* MONITORAMENTO E ENVOLVIDOS - Card destacado */}
                  <Card className="border-l-4 border-l-primary">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Monitoramento e Partes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 px-4 space-y-4">
                      {/* Monitoramento Toggles */}
                      <div className="space-y-3">
                        <p className="text-[10px] text-muted-foreground uppercase">Configurações de Monitoramento</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Toggle Buscar Andamentos */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">Buscar Andamentos</span>
                            </div>
                            <MonitoramentoToggle
                              processoId={processo.id}
                              campo="monitorar_andamentos"
                              valorInicial={processo.monitorar_andamentos}
                            />
                          </div>
                          
                          {/* Toggle Buscar DJEN */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Newspaper className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">Buscar DJEN</span>
                            </div>
                            <MonitoramentoToggle
                              processoId={processo.id}
                              campo="monitorar_djen"
                              valorInicial={processo.monitorar_djen}
                            />
                          </div>
                        </div>
                        
                        {/* Status badges */}
                        <div className="flex gap-2 flex-wrap">
                          <Badge className={cn(
                            "text-xs",
                            processo.monitorar_andamentos ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                          )}>
                            {processo.monitorar_andamentos ? <><Bell className="w-3 h-3 mr-1" />Andamentos Ativos</> : <><BellOff className="w-3 h-3 mr-1" />Andamentos Inativos</>}
                          </Badge>
                          <Badge className={cn(
                            "text-xs",
                            processo.monitorar_djen ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-600"
                          )}>
                            {processo.monitorar_djen ? <><Bell className="w-3 h-3 mr-1" />DJEN Ativo</> : <><BellOff className="w-3 h-3 mr-1" />DJEN Inativo</>}
                          </Badge>
                        </div>
                      </div>

                      {/* Envolvidos */}
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase mb-2">Envolvidos</p>
                        <div className="flex flex-wrap gap-2">
                          {processo.polo_passivo && (
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-emerald-500 text-white text-xs px-2 py-0.5 max-w-[200px] truncate" title={processo.polo_passivo}>
                                {processo.polo_passivo}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Requerido</Badge>
                            </div>
                          )}
                          {processo.polo_ativo && (
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-zinc-200 text-zinc-700 text-xs px-2 py-0.5 max-w-[200px] truncate" title={processo.polo_ativo}>
                                {processo.polo_ativo}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Requerente</Badge>
                            </div>
                          )}
                          {processo.terceiro_envolvido && (
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 max-w-[200px] truncate" title={processo.terceiro_envolvido}>
                                {processo.terceiro_envolvido}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Terceiro</Badge>
                            </div>
                          )}
                        </div>
                        <Button variant="link" size="sm" className="text-xs p-0 h-auto mt-1 text-primary" onClick={() => setActiveSection("envolvidos")}>
                          Expandir
                        </Button>
                      </div>

                      {/* Responsáveis */}
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase mb-2">Responsáveis</p>
                        <div className="flex flex-wrap gap-2">
                          {responsaveis.length > 0 ? (
                            responsaveis.map((r) => (
                              <div key={r.id} className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1">
                                <Avatar className="w-6 h-6 border border-background">
                                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-semibold">
                                    {r.nome.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{r.nome}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">Não informado</span>
                          )}
                        </div>
                      </div>

                      {/* Valor da Ação */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Valor da Ação</p>
                          <p className="text-lg font-semibold text-foreground">{formatCurrency(processo.valor_causa)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Pasta do Cliente</p>
                          <p className="text-sm">{processo.pasta_cliente || processo.pasta?.nome || "Não vinculado"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* DADOS BÁSICOS */}
                  <Card>
                    <CardHeader className="py-3 px-4 bg-muted/30">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Dados Básicos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 px-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <FieldItem label="Tipo de Processo" value={processo.tipo_processo === "administrativo" ? "Administrativo" : "Judicial"} />
                        <FieldItem label="Número" value={processo.numero} />
                        <FieldItem label="Área" value={processo.area} />
                        <FieldItem label="Situação" value={processo.status === "ativo" ? "Ativo" : processo.status} />
                        <FieldItem label="Assunto" value={processo.assunto} className="col-span-2" />
                        <FieldItem label="Classe CNJ" value={processo.classe} />
                        <FieldItem label="Natureza" value={processo.natureza} />
                        <FieldItem label="Data Distribuição" value={formatDate(processo.data_distribuicao)} />
                        <FieldItem label="Data Recebimento" value={formatDate(processo.data_recebimento)} />
                        <FieldItem label="Data Citação" value={formatDate(processo.data_citacao)} />
                        <FieldItem label="Cliente" value={processo.cliente?.nome || processo.nome_cliente_envolvido} />
                        <FieldItem label="Pasta Física" value={processo.pasta_fisica} />
                        <FieldItem label="Coordenação" value={processo.coordenacao?.nome} />
                      </div>
                      {processo.descricao && (
                        <div className="mt-4">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Descrição</p>
                          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{processo.descricao}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* TRIBUNAL / ÓRGÃO JULGADOR */}
                  <Card>
                    <CardHeader className="py-3 px-4 bg-muted/30">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Scale className="w-4 h-4" />
                        Tribunal / Órgão Julgador
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 px-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <FieldItem label="Tribunal" value={processo.tribunal} />
                        <FieldItem label="Justiça" value={processo.justica} />
                        <FieldItem label="Vara / Câmara" value={processo.vara} />
                        <FieldItem label="Instância" value={processo.instancia} />
                        <FieldItem label="Comarca" value={processo.comarca} />
                        <FieldItem label="UF" value={processo.uf} />
                        <FieldItem label="Fase Processual" value={processo.fase} />
                        <FieldItem label="Esfera" value={processo.esfera} />
                        <FieldItem label="Sistema" value={processo.sistema} />
                        <FieldItem label="Órgão Julgador" value={processo.orgao_julgador} />
                        <FieldItem label="Matéria" value={processo.materia} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* PARTES */}
                  <Card>
                    <CardHeader className="py-3 px-4 bg-muted/30">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Partes do Processo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 px-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Polo Ativo (Autor / Requerente)</p>
                          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{processo.polo_ativo || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Polo Passivo (Réu / Requerido)</p>
                          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{processo.polo_passivo || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Terceiros Envolvidos</p>
                          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{processo.terceiro_envolvido || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Reclamante</p>
                          <p className="text-sm text-foreground mt-1">{processo.reclamante || "Não informado"}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Reclamados</p>
                          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{processo.reclamados || "Não informado"}</p>
                        </div>
                      </div>
                      {processo.pedidos && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Pedidos</p>
                          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{processo.pedidos}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* ADMINISTRATIVO - Só mostra se tipo_processo = administrativo ou se tem dados */}
                  {(processo.tipo_processo === "administrativo" || processo.auto_infracao || processo.orgao_origem || processo.cnpj_fiscalizado || processo.valor_multa) && (
                    <Card className="border-orange-200 dark:border-orange-900/50">
                      <CardHeader className="py-3 px-4 bg-orange-50 dark:bg-orange-900/20">
                        <CardTitle className="text-sm flex items-center gap-2 text-orange-700 dark:text-orange-400">
                          <FileBox className="w-4 h-4" />
                          Dados Administrativos
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-3 px-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          <FieldItem label="Auto de Infração" value={processo.auto_infracao} />
                          <FieldItem label="Órgão de Origem" value={processo.orgao_origem} />
                          <FieldItem label="CNPJ Fiscalizado" value={processo.cnpj_fiscalizado} />
                          <FieldItem label="NIT / PIS" value={processo.nit_fiscalizado} />
                          <FieldItem label="Valor da Multa" value={formatCurrency(processo.valor_multa)} />
                          <FieldItem label="Data Lavratura" value={formatDate(processo.data_lavratura)} />
                          <FieldItem label="Fiscal Responsável" value={processo.fiscal_responsavel} />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* CONTINGENCIAL */}
                  <Card className="border-purple-200 dark:border-purple-900/50">
                    <CardHeader className="py-3 px-4 bg-purple-50 dark:bg-purple-900/20">
                      <CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-400">
                        <DollarSign className="w-4 h-4" />
                        Dados Contingenciais
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 px-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <FieldItem label="Posição do Cliente" value={processo.ativo_passivo} />
                        <FieldItem label="Tipo de Responsabilidade" value={processo.responsabilidade_tipo} />
                        <FieldItem label="Risco Atual" value={processo.risco_atual} />
                        <FieldItem label="Probabilidade" value={processo.probabilidade} />
                        <FieldItem label="Valor da Causa" value={formatCurrency(processo.valor_causa)} />
                        <FieldItem label="Valor da Condenação" value={formatCurrency(processo.valor_condenacao)} />
                        <FieldItem label="Valor Provisionado" value={formatCurrency(processo.valor_provisionado)} />
                        <FieldItem label="Função/Cargo" value={processo.funcao} />
                        <FieldItem label="Advogado Externo" value={processo.advogado_externo} />
                        <FieldItem label="Risco" value={processo.risco} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Informações do Sistema */}
                  <Card className="border-muted">
                    <CardHeader className="py-2 px-4 bg-muted/20">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        Informações do Sistema
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Criado em:</span>
                          <span className="ml-1">{formatDateTime(processo.created_at)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Atualizado em:</span>
                          <span className="ml-1">{formatDateTime(processo.updated_at)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Monitorar Andamentos:</span>
                          <span className="ml-1">{processo.monitorar_andamentos ? "Sim" : "Não"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Monitorar DJEN:</span>
                          <span className="ml-1">{processo.monitorar_djen ? "Sim" : "Não"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
                    <Button 
                      size="sm" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analisando...</>
                      ) : (
                        <><UploadIcon className="w-3 h-3 mr-1" /> Adicionar</>
                      )}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handlePastaFileSelect}
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
                    />
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

              {/* Pedidos Trabalhistas Section */}
              {activeSection === "pedidos" && (
                <ProcessoPedidosTab processo={processo} />
              )}

              {/* TST Section */}
              {activeSection === "tst" && (
                <ProcessoTstTab processo={processo} />
              )}

              {/* Publicações DJEN Section */}
              {activeSection === "publicacoes" && (
                <PublicacoesDjenList
                  publicacoes={publicacoesDjen}
                  loading={loadingPublicacoes}
                  processoId={processo?.id}
                  onCriarTarefa={onCriarTarefaPublicacao}
                />
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
                  {alertas360Unicos.length > 0 ? (
                    <div className="space-y-2">
                      {alertas360Unicos.map((alerta: any) => (
                          <Card key={alerta.id} className="hover:shadow-sm transition-shadow border-l-2" style={{
                            borderLeftColor: alerta.prioridade === "alta" ? "hsl(var(--destructive))" :
                              alerta.prioridade === "media" ? "hsl(45 93% 47%)" : "hsl(var(--muted-foreground))"
                          }}>
                            <CardContent className="p-3">
                              {/* Header: Badges + Data da movimentação */}
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Badge className={cn(
                                    "text-[10px] px-1.5 py-0",
                                    alerta.prioridade === "alta" ? "bg-red-100 text-red-700" :
                                    alerta.prioridade === "media" ? "bg-amber-100 text-amber-700" :
                                    "bg-zinc-100 text-zinc-700"
                                  )}>
                                    {alerta.prioridade}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {alerta.status}
                                  </Badge>
                                  {alerta.termo?.categoria && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      {alerta.termo.categoria}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {alerta.movimentacao?.data_movimentacao 
                                    ? formatDate(alerta.movimentacao.data_movimentacao)
                                    : formatDate(alerta.created_at)}
                                </span>
                              </div>
                              
                              {/* Termo encontrado em destaque */}
                              <p className="text-sm font-medium text-foreground">
                                Termo: <span className="text-primary">{alerta.termo_encontrado}</span>
                              </p>
                              
                              {/* Movimentação DataJud/CNJ onde foi encontrado */}
                              {alerta.movimentacao && (
                                <div className="mt-2 p-2 bg-muted/50 rounded-md border border-border/50">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Activity className="w-3 h-3 text-primary" />
                                    <span className="text-[10px] font-medium text-primary">
                                      {alerta.movimentacao.fonte || 'Movimentação'}
                                    </span>
                                    {alerta.movimentacao.data_movimentacao && (
                                      <span className="text-[10px] text-muted-foreground ml-auto">
                                        {formatDate(alerta.movimentacao.data_movimentacao)}
                                      </span>
                                    )}
                                  </div>
                                  {alerta.movimentacao.tipo && (
                                    <p className="text-xs font-medium text-foreground mb-0.5">
                                      {alerta.movimentacao.tipo}
                                    </p>
                                  )}
                                  {alerta.movimentacao.descricao && (
                                    <p className="text-xs text-muted-foreground line-clamp-3">
                                      {alerta.movimentacao.descricao}
                                    </p>
                                  )}
                                </div>
                              )}
                              
                              {/* Publicação DJEN relacionada (se encontrada) */}
                              {alerta.publicacao_relacionada && (
                                <div className="mt-2 p-2 bg-muted/50 rounded-md border border-border/50">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Newspaper className="w-3 h-3 text-primary" />
                                    <span className="text-[10px] font-medium text-primary">Publicação DJEN</span>
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                      {formatDate(alerta.publicacao_relacionada.data_publicacao)}
                                    </span>
                                  </div>
                                  {alerta.publicacao_relacionada.resumo_ia ? (
                                    <p className="text-xs text-muted-foreground line-clamp-3">
                                      {alerta.publicacao_relacionada.resumo_ia}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground line-clamp-3">
                                      {alerta.publicacao_relacionada.conteudo?.substring(0, 200)}...
                                    </p>
                                  )}
                                </div>
                              )}
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
                      Portal do Tribunal
                    </h3>
                  </div>
                  <BaixarAutosButton
                    processoId={processo?.id}
                    processoNumero={processo?.numero}
                    tribunal={processo?.tribunal}
                  />
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

              {/* Cobrança Section */}
              {activeSection === "cobranca" && (
                <CobrancaSection processo={processo} formatDate={formatDate} />
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
        </div>
      </div>
      {/* AI Analysis Dialog */}
      <AnaliseDocumentoDialog
        open={analiseDialogOpen}
        onOpenChange={setAnaliseDialogOpen}
        analise={analiseResult}
        processo={processo}
        onConfirm={handleAnaliseConfirm}
        onSkip={() => {
          setAnaliseDialogOpen(false);
          sonnerToast.success("Documento enviado com sucesso!");
        }}
      />
    </div>
  );
}
