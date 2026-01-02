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
import { Scale, ArrowRightLeft, FileText, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import DOMPurify from "dompurify";

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
    advogado_responsavel?: { id: string; nome: string } | null;
  };
  isSelectionMode: boolean;
  isSelected: boolean;
  temRedistribuicaoRecente: boolean;
  onToggleSelection: (id: string) => void;
  onNavigate: (id: string) => void;
}

export function ProcessoExpandableRow({
  processo,
  isSelectionMode,
  isSelected,
  temRedistribuicaoRecente,
  onToggleSelection,
  onNavigate,
}: ProcessoExpandableRowProps) {
  const [expandedSection, setExpandedSection] = useState<"djen" | "andamentos" | null>(null);

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

  const hasDjen = (countDjen ?? 0) > 0;
  const hasMov = (countMov ?? 0) > 0;

  const toggleSection = (section: "djen" | "andamentos") => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons
    if ((e.target as HTMLElement).closest("button")) return;
    if (isSelectionMode) {
      onToggleSelection(processo.id);
    } else {
      onNavigate(processo.id);
    }
  };

  return (
    <Collapsible open={!!expandedSection}>
      <div
        onClick={handleRowClick}
        className={cn(
          "grid grid-cols-1 md:grid-cols-[40px_1fr_200px_180px_180px] gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group",
          isSelected && "bg-primary/5"
        )}
      >
        {/* Checkbox Column */}
        <div className="hidden md:flex items-start justify-center pt-1">
          {isSelectionMode ? (
            <Checkbox
              checked={isSelected}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={() => onToggleSelection(processo.id)}
            />
          ) : (
            <div className="w-6 h-6 rounded bg-muted/50 flex items-center justify-center">
              <Scale className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Title Column */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {temRedistribuicaoRecente && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-medium px-1.5 py-0 border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30 shrink-0"
                  >
                    <ArrowRightLeft className="w-2.5 h-2.5" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Redistribuído nos últimos 7 dias</TooltipContent>
              </Tooltip>
            )}
            <span className="font-medium text-foreground truncate">
              {processo.polo_ativo && processo.polo_passivo
                ? `${processo.polo_ativo} X ${processo.polo_passivo}`
                : processo.polo_ativo || processo.polo_passivo || processo.numero}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-primary">Processo {processo.status}</span>
            {(processo.polo_ativo || processo.polo_passivo) && (
              <span className="font-mono">{processo.numero}</span>
            )}
          </div>
          {/* Mobile only: show all info + action buttons */}
          <div className="md:hidden mt-2 space-y-2">
            <div className="text-xs text-muted-foreground space-y-1">
              {processo.cliente?.nome && <div>Cliente: {processo.cliente.nome}</div>}
              <div>{processo.vara || processo.tribunal || "-"}</div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              {hasDjen && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 gap-1",
                    expandedSection === "djen" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection("djen");
                  }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="text-xs">{countDjen}</span>
                </Button>
              )}
              {hasMov && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 gap-1",
                    expandedSection === "andamentos" && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection("andamentos");
                  }}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span className="text-xs">{countMov}</span>
                </Button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {processo.data_distribuicao
                  ? new Date(processo.data_distribuicao).toLocaleDateString("pt-BR")
                  : new Date(processo.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        </div>

        {/* Cliente/Pasta Column */}
        <div className="hidden md:block min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {processo.cliente?.nome || "-"}
          </div>
          {processo.cliente?.tipo && (
            <div className="text-xs text-muted-foreground">
              {processo.cliente.tipo === "pessoa_juridica" ? "Pessoa Jurídica" : "Pessoa Física"}
            </div>
          )}
        </div>

        {/* Ação/Foro Column */}
        <div className="hidden md:block min-w-0">
          <div className="text-sm text-foreground truncate">
            {processo.area === "civil" ? "ACPCiv" : processo.area === "trabalhista" ? "ATOrd" : "AEmp"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {processo.vara || processo.tribunal || "-"}
          </div>
        </div>

        {/* Actions + Date Column */}
        <div className="hidden md:flex items-center justify-end gap-2">
          {hasDjen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 gap-1",
                    expandedSection === "djen" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection("djen");
                  }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="text-xs">{countDjen}</span>
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
                    "h-7 px-2 gap-1",
                    expandedSection === "andamentos" && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection("andamentos");
                  }}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span className="text-xs">{countMov}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Andamentos</TooltipContent>
            </Tooltip>
          )}

          <span className="text-sm text-muted-foreground ml-2">
            {processo.data_distribuicao
              ? new Date(processo.data_distribuicao).toLocaleDateString("pt-BR")
              : new Date(processo.created_at).toLocaleDateString("pt-BR")}
          </span>
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
                            {pub.data_publicacao
                              ? format(new Date(pub.data_publicacao), "dd/MM/yyyy")
                              : format(new Date(pub.created_at), "dd/MM/yyyy")}
                          </span>
                          {pub.fonte && (
                            <Badge variant="outline" className="text-xs">
                              {pub.fonte}
                            </Badge>
                          )}
                        </div>
                        <div
                          className="prose prose-sm max-w-none dark:prose-invert text-sm overflow-x-auto break-words [word-break:break-word] [overflow-wrap:anywhere] [&_table]:table-fixed [&_table]:w-full [&_table]:text-xs [&_td]:break-words [&_th]:break-words [&_td]:p-1 [&_th]:p-1 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(pub.conteudo || "Sem conteúdo"),
                          }}
                        />
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
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
