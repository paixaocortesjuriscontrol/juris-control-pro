import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  FileSearch,
  Gavel,
  ListChecks,
  Loader2,
  Newspaper,
  Search,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface PublicacaoDjen {
  id: string;
  processo_id?: string;
  processo_numero?: string;
  conteudo?: string;
  data_publicacao?: string;
  data_disponibilizacao?: string;
  fonte?: string;
  lida?: boolean;
  created_at?: string;
  polo_ativo?: string;
  polo_passivo?: string;
  tribunal?: string;
}

interface PublicacoesDjenListProps {
  publicacoes: PublicacaoDjen[];
  loading?: boolean;
  processoId?: string;
  onCriarTarefa?: (pub: PublicacaoDjen) => void;
}

export function PublicacoesDjenList({
  publicacoes,
  loading = false,
  processoId,
  onCriarTarefa,
}: PublicacoesDjenListProps) {
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPub, setSelectedPub] = useState<PublicacaoDjen | null>(null);
  const [markingAsRead, setMarkingAsRead] = useState(false);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const toggleExpandAll = () => {
    if (expandedIds.size === publicacoes.length && publicacoes.length > 0) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(publicacoes.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === publicacoes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(publicacoes.map(p => p.id)));
    }
  };

  const handleView = (pub: PublicacaoDjen) => {
    setSelectedPub(pub);
    setViewDialogOpen(true);
  };

  const handleMarcarLidas = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma publicação");
      return;
    }

    setMarkingAsRead(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("publicacoes_djen_processos")
        .update({ lida: true })
        .in("id", ids);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["publicacoes-djen-processo", processoId] });
      setSelectedIds(new Set());
      toast.success("Publicação(ões) marcada(s) como lida(s)");
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setMarkingAsRead(false);
    }
  };

  const formatDateShort = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    try {
      return format(parseISO(dateString), "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    try {
      return format(parseISO(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const naoLidas = publicacoes.filter(p => !p.lida).length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (publicacoes.length === 0) {
    return (
      <div className="text-center py-8">
        <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma publicação encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            Publicações DJEN
          </h3>
          <Badge variant="secondary" className="text-xs">
            {publicacoes.length} pub.
          </Badge>
          {naoLidas > 0 && (
            <Badge className="bg-amber-500 text-xs">
              {naoLidas} não lidas
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleExpandAll}
            className="h-7 text-xs"
          >
            <ChevronsUpDown className="w-3 h-3 mr-1" />
            {expandedIds.size === publicacoes.length ? "Recolher" : "Expandir"}
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarcarLidas}
              disabled={markingAsRead}
              className="h-7 text-xs"
            >
              {markingAsRead ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="w-3 h-3 mr-1" />
              )}
              Marcar lidas ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Publications list */}
      <div className="space-y-2">
        {publicacoes.map((pub) => {
          const isExpanded = expandedIds.has(pub.id);
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
                  onCheckedChange={() => toggleSelect(pub.id)}
                  className="mt-0.5"
                />
                
                <div className="flex-1 min-w-0 overflow-hidden">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1.5 md:mb-2">
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                      <Gavel className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
                      Processo Cadastrado
                    </Badge>
                    
                    {!pub.lida && (
                      <Badge variant="default" className="bg-amber-500 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">
                        Nova
                      </Badge>
                    )}
                    
                    <span className="text-[10px] md:text-xs text-muted-foreground ml-auto flex-shrink-0">
                      {formatDateShort(pub.created_at)}
                    </span>
                  </div>

                  {/* Clickable row with expand */}
                  <div 
                    className="cursor-pointer select-none"
                    onClick={() => toggleExpand(pub.id)}
                  >
                    <div className="flex items-start md:items-center gap-1 md:gap-2 mb-1 flex-wrap">
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0 mt-0.5 md:mt-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0 mt-0.5 md:mt-0" />
                      )}
                      <p className="text-xs md:text-sm font-medium text-primary break-all">
                        {pub.processo_numero || "Processo"}
                      </p>
                      
                      {onCriarTarefa && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCriarTarefa(pub);
                          }}
                          title="Criar tarefa a partir desta publicação"
                          className="h-7 md:h-8 px-2 md:px-3 flex-shrink-0 ml-auto"
                        >
                          <ListChecks className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                          <span className="text-xs">Criar Tarefa</span>
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
                        className="p-1 md:p-1.5 h-auto flex-shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </Button>
                    </div>

                    {/* Dates inline */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs ml-4 md:ml-6 mb-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground font-medium">Disp:</span>
                        <span className="text-amber-600 dark:text-amber-400">{formatDateShort(pub.data_disponibilizacao)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground font-medium">Pub:</span>
                        <span className="text-amber-600 dark:text-amber-400">{formatDateShort(pub.data_publicacao)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground font-medium">Captura:</span>
                        <span className="text-muted-foreground">{formatDateShort(pub.created_at)}</span>
                      </div>
                    </div>

                    {(pub.polo_ativo || pub.polo_passivo) && (
                      <p className="text-[10px] md:text-xs text-muted-foreground mb-1 ml-4 md:ml-6 break-words">
                        {pub.polo_ativo && <span><strong>Ativo:</strong> {pub.polo_ativo}</span>}
                        {pub.polo_ativo && pub.polo_passivo && <span className="mx-1">|</span>}
                        {pub.polo_passivo && <span><strong>Passivo:</strong> {pub.polo_passivo}</span>}
                      </p>
                    )}

                    {!isExpanded && (
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 ml-4 md:ml-6 break-words overflow-hidden">
                        {pub.conteudo?.replace(/<[^>]*>/g, ' ').substring(0, 200) || "Sem conteúdo"}...
                      </p>
                    )}
                  </div>

                  {/* Expanded content */}
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
                      
                      <div 
                        className={cn(conteudoDisplayClasses, "text-xs md:text-sm")}
                        dangerouslySetInnerHTML={{ 
                          __html: formatConteudoParaExibicao(pub.conteudo || "") 
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Newspaper className="w-5 h-5" />
              Publicação DJEN
            </DialogTitle>
            <DialogDescription>
              {selectedPub?.processo_numero || "Detalhes da publicação"}
            </DialogDescription>
          </DialogHeader>
          {selectedPub && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Data Disponibilização:</strong>
                  <p className="text-muted-foreground">{formatDate(selectedPub.data_disponibilizacao)}</p>
                </div>
                <div>
                  <strong>Data Publicação:</strong>
                  <p className="text-muted-foreground">{formatDate(selectedPub.data_publicacao)}</p>
                </div>
                {selectedPub.fonte && (
                  <div>
                    <strong>Fonte:</strong>
                    <p className="text-muted-foreground">{selectedPub.fonte}</p>
                  </div>
                )}
                {selectedPub.tribunal && (
                  <div>
                    <strong>Tribunal:</strong>
                    <p className="text-muted-foreground">{selectedPub.tribunal}</p>
                  </div>
                )}
              </div>
              
              <div>
                <strong>Conteúdo:</strong>
                <div 
                  className={cn(conteudoDisplayClasses, "mt-2 p-4 bg-muted/30 rounded-lg text-sm")}
                  dangerouslySetInnerHTML={{ 
                    __html: formatConteudoParaExibicao(selectedPub.conteudo || "") 
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
