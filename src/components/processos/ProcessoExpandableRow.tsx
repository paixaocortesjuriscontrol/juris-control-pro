import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Scale, ArrowRightLeft, FileText, Activity, ChevronDown, ChevronUp, Gavel, AlertCircle, ClipboardList, ExternalLink, MoreVertical, Users, BadgeCheck, PanelRightOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { formatConteudoParaExibicao, conteudoDisplayClasses, formatDateOnlyFull } from "@/utils/formatConteudo";
import { formatDateSafe } from "@/utils/date";
import { EtiquetaPicker } from "@/components/etiquetas/EtiquetaPicker";

interface ProcessoExpandableRowProps {
  processo: {
    id: string;
    numero: string;
    polo_ativo: string | null;
    polo_passivo: string | null;
    status: string;
    area: string;
    vara: string | null;
    tribunal: string | null;
    data_distribuicao: string | null;
    created_at: string;
    cliente?: { id: string; nome: string; tipo: string } | null;
    pasta?: { id: string; nome: string } | null;
    advogado_responsavel?: { id: string; nome: string } | null;
    coordenacao_id?: string | null;
  };
  isSelectionMode: boolean;
  isSelected: boolean;
  temRedistribuicaoRecente: boolean;
  onToggleSelection: (id: string) => void;
  onNavigate: (id: string) => void;
  /** Etiquetas já carregadas em lote para esta linha. */
  etiquetaIds?: string[];
  /** Abre o painel lateral com resumo + itens (audiências, prazos, tarefas, eventos). */
  onOpenLateral?: (id: string) => void;
  lateralAberto?: boolean;
}

export function ProcessoExpandableRow({
  processo,
  isSelectionMode,
  isSelected,
  temRedistribuicaoRecente,
  onToggleSelection,
  onNavigate,
  etiquetaIds,
  onOpenLateral,
  lateralAberto,
}: ProcessoExpandableRowProps) {
  const [expandedSection, setExpandedSection] = useState<"djen" | "andamentos" | "audiencias" | "intimacoes" | "tarefas" | null>(null);

  // Coordenações responsáveis + indicador de preenchimento pela Judit
  const { data: extras } = useQuery({
    queryKey: ["processo-row-extras", processo.id, processo.coordenacao_id],
    queryFn: async () => {
      const [respRes, procRes] = await Promise.all([
        supabase
          .from("processos_coordenacoes_responsaveis" as any)
          .select("coordenacao_id, principal")
          .eq("processo_id", processo.id),
        supabase.from("processos").select("judit_campos").eq("id", processo.id).maybeSingle(),
      ]);

      const ids = new Set<string>();
      if (processo.coordenacao_id) ids.add(processo.coordenacao_id);
      for (const r of ((respRes.data as any[]) || [])) {
        if (r?.coordenacao_id) ids.add(r.coordenacao_id);
      }

      let nomes: string[] = [];
      if (ids.size > 0) {
        const { data: coords } = await supabase
          .from("coordenacoes")
          .select("id, nome")
          .in("id", [...ids]);
        nomes = ((coords as any[]) || [])
          .map((c) => c.nome as string)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "pt-BR"));
      }

      const campos = (procRes.data as any)?.judit_campos;
      return { coordenacoes: nomes, temJudit: Array.isArray(campos) ? campos.length > 0 : !!campos };
    },
  });

  // Check if process has DJEN publications
  const { data: countDjen } = useQuery({
    queryKey: ["count-djen-processo", processo.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("publicacoes_djen_processos")
        .select("id", { count: "exact", head: true })
        .eq("processo_id", processo.id);
      if (error) throw error;
      return count || 0;
    },
  });

  // Check if process has movements
  const { data: countMov } = useQuery({
    queryKey: ["count-mov-processo", processo.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("movimentacoes")
        .select("id", { count: "exact", head: true })
        .eq("processo_id", processo.id);
      if (error) throw error;
      return count || 0;
    },
  });

  // Check if process has audiencias
  const { data: countAudiencias } = useQuery({
    queryKey: ["count-audiencias-processo", processo.id, processo.numero],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("audiencias_detectadas")
        .select("id", { count: "exact", head: true })
        .or(`processo_id.eq.${processo.id},processo_numero.eq.${processo.numero}`);
      if (error) throw error;
      return count || 0;
    },
  });

  // Check if process has intimacoes
  const { data: countIntimacoes } = useQuery({
    queryKey: ["count-intimacoes-processo", processo.id, processo.numero],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("intimacoes_detectadas")
        .select("id", { count: "exact", head: true })
        .or(`processo_id.eq.${processo.id},processo_numero.eq.${processo.numero}`);
      if (error) throw error;
      return count || 0;
    },
  });

  // Check if process has tarefas
  const { data: countTarefas } = useQuery({
    queryKey: ["count-tarefas-processo", processo.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tarefas")
        .select("id", { count: "exact", head: true })
        .eq("processo_id", processo.id);
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch DJEN publications when expanded
  const { data: publicacoesDjen, isLoading: loadingDjen } = useQuery({
    queryKey: ["publicacoes-djen-processo", processo.id],
    enabled: expandedSection === "djen" && (countDjen ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publicacoes_djen_processos")
        .select("*")
        .eq("processo_id", processo.id)
        .order("data_publicacao", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch movements when expanded
  const { data: movimentacoes, isLoading: loadingMov } = useQuery({
    queryKey: ["movimentacoes-processo", processo.id],
    enabled: expandedSection === "andamentos" && (countMov ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .eq("processo_id", processo.id)
        .order("data_movimentacao", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch audiencias when expanded
  const { data: audiencias, isLoading: loadingAudiencias } = useQuery({
    queryKey: ["audiencias-processo-expand", processo.id, processo.numero],
    enabled: expandedSection === "audiencias" && (countAudiencias ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audiencias_detectadas")
        .select("*")
        .or(`processo_id.eq.${processo.id},processo_numero.eq.${processo.numero}`)
        .order("data_audiencia", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch intimacoes when expanded
  const { data: intimacoes, isLoading: loadingIntimacoes } = useQuery({
    queryKey: ["intimacoes-processo-expand", processo.id, processo.numero],
    enabled: expandedSection === "intimacoes" && (countIntimacoes ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intimacoes_detectadas")
        .select("*")
        .or(`processo_id.eq.${processo.id},processo_numero.eq.${processo.numero}`)
        .order("data_intimacao", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch tarefas when expanded
  const { data: tarefas, isLoading: loadingTarefas } = useQuery({
    queryKey: ["tarefas-processo-expand", processo.id],
    enabled: expandedSection === "tarefas" && (countTarefas ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*, responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)")
        .eq("processo_id", processo.id)
        .order("data_fatal", { ascending: true, nullsFirst: false })
        .order("data_vencimento", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data || [];
    },
  });

  const hasDjen = (countDjen ?? 0) > 0;
  const hasMov = (countMov ?? 0) > 0;
  const hasAudiencias = (countAudiencias ?? 0) > 0;
  const hasIntimacoes = (countIntimacoes ?? 0) > 0;
  const hasTarefas = (countTarefas ?? 0) > 0;

  const toggleSection = (section: "djen" | "andamentos" | "audiencias" | "intimacoes" | "tarefas") => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons
    if ((e.target as HTMLElement).closest("button")) return;
    if (isSelectionMode) {
      onToggleSelection(processo.id);
    } else if (onOpenLateral) {
      onOpenLateral(processo.id);
    } else {
      onNavigate(processo.id);
    }
  };

  return (
    <Collapsible open={!!expandedSection}>
      <div
        onClick={handleRowClick}
        className={cn(
          "relative flex gap-3 px-3 py-3 hover:bg-muted/30 transition-colors cursor-pointer group",
          // Left accent bar (Projuris-style)
          "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary/70",
          isSelected && "bg-primary/5"
        )}
      >
        {/* Checkbox */}
        <div className="flex items-start pt-1 pl-1">
          <Checkbox
            checked={isSelected}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={() => onToggleSelection(processo.id)}
            aria-label="Selecionar processo"
          />
        </div>

        {/* Projuris-style labeled 3-column grid */}
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2">
          {/* Coluna 1: Cliente / Envolvido */}
          <div className="min-w-0 space-y-2">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground leading-tight">Cliente</div>
              <div className="text-sm font-medium text-foreground truncate">
                {processo.cliente?.nome || processo.polo_passivo || "Não informado"}
              </div>
              <Badge
                variant="secondary"
                className="mt-0.5 text-[10px] px-1.5 py-0 font-normal bg-muted text-muted-foreground"
              >
                Reclamado
              </Badge>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground leading-tight">Envolvido</div>
              <div className="text-sm font-medium text-foreground truncate">
                {processo.polo_ativo || "Não informado"}
              </div>
              <Badge
                variant="secondary"
                className="mt-0.5 text-[10px] px-1.5 py-0 font-normal bg-muted text-muted-foreground"
              >
                Reclamante
              </Badge>
            </div>
          </div>

          {/* Coluna 2: Número / Assunto */}
          <div className="min-w-0 space-y-2">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground leading-tight">Número do processo</div>
              <div className="text-sm text-foreground truncate flex items-center gap-1">
                <span className={cn("font-mono", processo.status === "encerrado" && "text-destructive font-semibold")}>
                  {processo.numero}
                </span>
                {processo.status === "encerrado" && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive text-destructive">
                    Encerrado
                  </Badge>
                )}
                <span className="text-muted-foreground text-xs">(CNJ)</span>
                {temRedistribuicaoRecente && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30 ml-1"
                      >
                        <ArrowRightLeft className="w-2.5 h-2.5" />
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Redistribuído nos últimos 7 dias</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <EtiquetaPicker
                entidade="processo"
                entidadeId={processo.id}
                coordenacaoId={processo.coordenacao_id ?? undefined}
                etiquetaIds={etiquetaIds ?? []}
                compact
              />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground leading-tight">Assunto</div>
              <div className="text-sm text-foreground truncate">
                {processo.pasta?.nome ||
                  (processo.area === "civil"
                    ? "Jurídico Cível"
                    : processo.area === "trabalhista"
                    ? "Jurídico Trabalhista"
                    : "Jurídico Empresarial")}
              </div>
            </div>
          </div>

          {/* Coluna 3: Órgão / Órgão julgador */}
          <div className="min-w-0 space-y-2">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground leading-tight">Órgão</div>
              <div className="text-sm text-foreground truncate">
                {processo.tribunal || "Não informado"}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground leading-tight">Órgão julgador</div>
              <div className="text-sm text-foreground truncate">
                {processo.vara || "Não informado"}
              </div>
            </div>
            {(extras?.coordenacoes?.length ?? 0) > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground leading-tight">
                  {extras!.coordenacoes.length > 1 ? "Coordenações responsáveis" : "Coordenação responsável"}
                </div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {extras!.coordenacoes.map((nome) => (
                    <Badge key={nome} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                      <Users className="w-2.5 h-2.5 mr-1" />
                      {nome}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Counts row (across all columns) */}
          {(hasDjen || hasMov || hasAudiencias || hasIntimacoes || hasTarefas) && (
            <div className="md:col-span-3 flex flex-wrap items-center gap-1.5 pt-1">
              {hasDjen && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 px-1.5 gap-1",
                        expandedSection === "djen" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      )}
                      onClick={(e) => { e.stopPropagation(); toggleSection("djen"); }}
                    >
                      <FileText className="w-3 h-3" />
                      <span className="text-[11px]">{countDjen}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Publicações DJEN</TooltipContent>
                </Tooltip>
              )}
              {hasMov && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 px-1.5 gap-1",
                        expandedSection === "andamentos" && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                      )}
                      onClick={(e) => { e.stopPropagation(); toggleSection("andamentos"); }}
                    >
                      <Activity className="w-3 h-3" />
                      <span className="text-[11px]">{countMov}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Andamentos</TooltipContent>
                </Tooltip>
              )}
              {hasAudiencias && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 px-1.5 gap-1",
                        expandedSection === "audiencias" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      )}
                      onClick={(e) => { e.stopPropagation(); toggleSection("audiencias"); }}
                    >
                      <Gavel className="w-3 h-3" />
                      <span className="text-[11px]">{countAudiencias}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Audiências</TooltipContent>
                </Tooltip>
              )}
              {hasIntimacoes && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 px-1.5 gap-1",
                        expandedSection === "intimacoes" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      )}
                      onClick={(e) => { e.stopPropagation(); toggleSection("intimacoes"); }}
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span className="text-[11px]">{countIntimacoes}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Intimações</TooltipContent>
                </Tooltip>
              )}
              {hasTarefas && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 px-1.5 gap-1",
                        expandedSection === "tarefas" && "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      )}
                      onClick={(e) => { e.stopPropagation(); toggleSection("tarefas"); }}
                    >
                      <ClipboardList className="w-3 h-3" />
                      <span className="text-[11px]">{countTarefas}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Tarefas</TooltipContent>
                </Tooltip>
              )}
              <span className="text-[11px] text-muted-foreground ml-auto">
                {processo.data_distribuicao
                  ? new Date(processo.data_distribuicao).toLocaleDateString("pt-BR")
                  : new Date(processo.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          )}
        </div>

        {/* Right side: responsável + ações */}
        <div className="flex items-start gap-1 shrink-0">
          {extras?.temJudit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="h-8 flex items-center">
                  <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Campos preenchidos pela Judit</TooltipContent>
            </Tooltip>
          )}
          {processo.advogado_responsavel?.nome && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-8 w-8 rounded bg-orange-400 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {processo.advogado_responsavel.nome
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((s) => s[0]?.toUpperCase() ?? "")
                    .join("")}
                </div>
              </TooltipTrigger>
              <TooltipContent>{processo.advogado_responsavel.nome}</TooltipContent>
            </Tooltip>
          )}
          {onOpenLateral && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn("h-8 w-8", lateralAberto && "bg-primary/10 border-primary text-primary")}
                  onClick={(e) => { e.stopPropagation(); onOpenLateral(processo.id); }}
                >
                  <PanelRightOpen className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resumo e itens do processo</TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            title="Abrir processo"
            onClick={(e) => { e.stopPropagation(); onNavigate(processo.id); }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Abrir processo</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="h-8 w-8 bg-foreground hover:bg-foreground/90"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onNavigate(processo.id)}>Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate(processo.id)}>Detalhes</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expandable Content */}
      <CollapsibleContent>
        <div className="px-4 pb-4 bg-muted/20 border-t border-border/30">
          {expandedSection === "djen" && (
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-sm">Publicações DJEN</span>
                {publicacoesDjen && (
                  <Badge variant="secondary" className="text-xs">
                    {publicacoesDjen.length}
                  </Badge>
                )}
              </div>

              {loadingDjen ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : publicacoesDjen && publicacoesDjen.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-2 sm:pr-4">
                    {publicacoesDjen.map((pub) => (
                      <div
                        key={pub.id}
                        className={cn(
                          "p-3 sm:p-4 rounded-lg border overflow-hidden",
                          pub.lida
                            ? "bg-background border-border/50"
                            : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            Disp.: {pub.data_disponibilizacao
                              ? formatDateOnlyFull(pub.data_disponibilizacao)
                              : "-"} | Pub.: {pub.data_publicacao
                              ? formatDateOnlyFull(pub.data_publicacao)
                              : formatDateOnlyFull(pub.created_at)}
                          </span>
                          {pub.fonte && (
                            <Badge variant="outline" className="text-xs">
                              {pub.fonte}
                            </Badge>
                          )}
                        </div>
                        <div className={cn("text-sm", conteudoDisplayClasses)}>
                          {formatConteudoParaExibicao(pub.conteudo)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma publicação DJEN encontrada
                </p>
              )}
            </div>
          )}

          {expandedSection === "andamentos" && (
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-green-600" />
                <span className="font-medium text-sm">Andamentos</span>
                {movimentacoes && (
                  <Badge variant="secondary" className="text-xs">
                    {movimentacoes.length}
                  </Badge>
                )}
              </div>

              {loadingMov ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : movimentacoes && movimentacoes.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {movimentacoes.map((mov) => (
                      <div
                        key={mov.id}
                        className="p-4 rounded-lg border bg-background border-border/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            {format(new Date(mov.data_movimentacao), "dd/MM/yyyy HH:mm")}
                          </span>
                          {mov.tipo && (
                            <Badge variant="outline" className="text-xs">
                              {mov.tipo}
                            </Badge>
                          )}
                        </div>
                        <p className="text-foreground text-sm whitespace-pre-wrap break-words">{mov.descricao}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum andamento encontrado
                </p>
              )}
            </div>
          )}

          {expandedSection === "audiencias" && (
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-3">
                <Gavel className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-sm">Audiências</span>
                {audiencias && (
                  <Badge variant="secondary" className="text-xs">
                    {audiencias.length}
                  </Badge>
                )}
              </div>

              {loadingAudiencias ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : audiencias && audiencias.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {audiencias.map((aud: any) => (
                      <div
                        key={aud.id}
                        className={cn(
                          "p-4 rounded-lg border",
                          aud.status === "pendente"
                            ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                            : "bg-background border-border/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            {aud.data_audiencia
                              ? format(new Date(aud.data_audiencia), "dd/MM/yyyy")
                              : "Data não informada"}
                            {aud.hora && ` às ${aud.hora}`}
                          </span>
                          <div className="flex items-center gap-2">
                            {aud.tipo_audiencia && (
                              <Badge variant="outline" className="text-xs">
                                {aud.tipo_audiencia}
                              </Badge>
                            )}
                            <Badge
                              variant={aud.status === "pendente" ? "default" : "secondary"}
                              className={cn(
                                "text-xs",
                                aud.status === "pendente" && "bg-amber-600"
                              )}
                            >
                              {aud.status === "pendente" ? "Pendente" : aud.status === "tratado" ? "Tratada" : "Ignorada"}
                            </Badge>
                          </div>
                        </div>
                        {aud.local_audiencia && (
                          <p className="text-sm text-muted-foreground mb-1">Local: {aud.local_audiencia}</p>
                        )}
                        {aud.vara_camara && (
                          <p className="text-sm text-muted-foreground">Vara: {aud.vara_camara}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma audiência encontrada
                </p>
              )}
            </div>
          )}

          {expandedSection === "intimacoes" && (
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="font-medium text-sm">Intimações</span>
                {intimacoes && (
                  <Badge variant="secondary" className="text-xs">
                    {intimacoes.length}
                  </Badge>
                )}
              </div>

              {loadingIntimacoes ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : intimacoes && intimacoes.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {intimacoes.map((int: any) => (
                      <div
                        key={int.id}
                        className={cn(
                          "p-4 rounded-lg border",
                          int.status === "pendente"
                            ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                            : "bg-background border-border/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            {int.data_intimacao
                              ? formatDateSafe(int.data_intimacao)
                              : "Data não informada"}
                            {int.data_limite && (
                              <span className="text-red-600 ml-2">
                                Limite: {formatDateSafe(int.data_limite)}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            {int.tipo_intimacao && (
                              <Badge variant="outline" className="text-xs">
                                {int.tipo_intimacao}
                              </Badge>
                            )}
                            <Badge
                              variant={int.status === "pendente" ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              {int.status === "pendente" ? "Pendente" : int.status === "tratado" ? "Tratada" : "Ignorada"}
                            </Badge>
                          </div>
                        </div>
                        {int.descricao && (
                          <p className="text-foreground text-sm whitespace-pre-wrap break-words">{int.descricao}</p>
                        )}
                        {int.orgao_intimante && (
                          <p className="text-sm text-muted-foreground mt-1">Órgão: {int.orgao_intimante}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma intimação encontrada
                </p>
              )}
            </div>
          )}

          {expandedSection === "tarefas" && (
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-sm">Tarefas</span>
                {tarefas && (
                  <Badge variant="secondary" className="text-xs">
                    {tarefas.length}
                  </Badge>
                )}
              </div>

              {loadingTarefas ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : tarefas && tarefas.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {tarefas.map((tarefa: any) => (
                      <div
                        key={tarefa.id}
                        className={cn(
                          "p-4 rounded-lg border",
                          tarefa.status === "pendente" || tarefa.status === "em_andamento"
                            ? "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800"
                            : "bg-background border-border/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground">
                            {tarefa.titulo}
                          </span>
                          <div className="flex items-center gap-2">
                            {tarefa.prioridade && (
                              <Badge
                                variant={
                                  tarefa.prioridade === "alta" || tarefa.prioridade === "urgente"
                                    ? "destructive"
                                    : tarefa.prioridade === "media"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {tarefa.prioridade}
                              </Badge>
                            )}
                            <Badge
                              variant={
                                tarefa.status === "cumprido"
                                  ? "secondary"
                                  : tarefa.status === "em_andamento"
                                  ? "default"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {tarefa.status === "pendente"
                                ? "Pendente"
                                : tarefa.status === "em_andamento"
                                ? "Em Andamento"
                                : "Cumprida"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {tarefa.data_vencimento && (
                            <span>
                              Limite: {formatDateSafe(tarefa.data_vencimento)}
                            </span>
                          )}
                          {tarefa.data_fatal && (
                            <span>
                              Fatal: {formatDateSafe(tarefa.data_fatal)}
                            </span>
                          )}
                          {tarefa.responsavel?.nome && (
                            <span>• Resp.: {tarefa.responsavel.nome}</span>
                          )}
                        </div>
                        {tarefa.descricao && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{tarefa.descricao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma tarefa encontrada
                </p>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
