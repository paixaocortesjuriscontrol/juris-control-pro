import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Scale } from "lucide-react";
import { useProcessos } from "@/hooks/useProcessos";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface VincularProcessoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pastaId: string;
}

export function VincularProcessoDialog({
  open,
  onOpenChange,
  pastaId,
}: VincularProcessoDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coordenacaoFilter, setCoordenacaoFilter] = useState<string>("all");
  const { data: processos, isLoading } = useProcessos();
  const { data: coordenacoes } = useCoordenacoesFull();
  const queryClient = useQueryClient();

  // Filter processes not already linked to any folder
  const availableProcessos = processos?.filter((p) => {
    if (p.pasta_id) return false;
    
    const matchesSearch =
      p.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.assunto?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCoordenacao =
      coordenacaoFilter === "all" || p.coordenacao_id === coordenacaoFilter;
    
    return matchesSearch && matchesCoordenacao;
  });

  const handleToggleSelect = (processoId: string) => {
    setSelectedIds((prev) =>
      prev.includes(processoId)
        ? prev.filter((id) => id !== processoId)
        : [...prev, processoId]
    );
  };

  const handleSelectAll = () => {
    if (!availableProcessos) return;
    
    const allIds = availableProcessos.map((p) => p.id);
    const allSelected = allIds.every((id) => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const handleVincular = async () => {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos um processo");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("processos")
        .update({ pasta_id: pastaId })
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`${selectedIds.length} processo(s) vinculado(s) com sucesso`);
      queryClient.invalidateQueries({ queryKey: ["pastas"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      queryClient.invalidateQueries({ queryKey: ["pasta", pastaId] });
      onOpenChange(false);
      setSelectedIds([]);
      setSearchQuery("");
    } catch (error) {
      console.error("Erro ao vincular processos:", error);
      toast.error("Erro ao vincular processos");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedIds([]);
      setSearchQuery("");
    }
    onOpenChange(isOpen);
  };

  const allSelected = availableProcessos?.length 
    ? availableProcessos.every((p) => selectedIds.includes(p.id))
    : false;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Vincular Processos</DialogTitle>
          <DialogDescription>
            Selecione os processos que deseja vincular a esta pasta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por número ou assunto..."
                  className="pl-9"
                />
              </div>
              <Select value={coordenacaoFilter} onValueChange={setCoordenacaoFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Coordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {coordenacoes?.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>
                      {coord.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {availableProcessos && availableProcessos.length > 0 && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
            <ScrollArea className="h-[280px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : availableProcessos?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-center p-4">
                <Scale className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Nenhum processo encontrado"
                    : "Todos os processos já estão vinculados"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {availableProcessos?.map((processo) => (
                  <div
                    key={processo.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleToggleSelect(processo.id)}
                  >
                    <Checkbox
                      checked={selectedIds.includes(processo.id)}
                      onCheckedChange={() => handleToggleSelect(processo.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-medium truncate">
                        {processo.numero}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {processo.assunto || "Sem assunto"}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {processo.area}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {processo.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </ScrollArea>
          </div>

          {selectedIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedIds.length} processo(s) selecionado(s)
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleVincular}
            disabled={isSubmitting || selectedIds.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Vinculando...
              </>
            ) : (
              `Vincular ${selectedIds.length > 0 ? `(${selectedIds.length})` : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
