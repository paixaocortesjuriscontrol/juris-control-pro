import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Scale } from "lucide-react";
import { useProcessos } from "@/hooks/useProcessos";
import { useVincularProcessoPasta } from "@/hooks/usePastas";

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
  const { data: processos, isLoading } = useProcessos();
  const vincularProcesso = useVincularProcessoPasta();

  // Filter processes not already linked to any folder
  const availableProcessos = processos?.filter(
    (p) => !p.pasta_id && 
    (p.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
     p.assunto?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleVincular = async (processoId: string) => {
    await vincularProcesso.mutateAsync({ processoId, pastaId });
    onOpenChange(false);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Vincular Processo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Buscar processo</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por número ou assunto..."
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="h-[300px] border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : availableProcessos?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
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
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-medium truncate">
                        {processo.numero}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {processo.assunto || "Sem assunto"}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {processo.area}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {processo.status}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleVincular(processo.id)}
                      disabled={vincularProcesso.isPending}
                    >
                      {vincularProcesso.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Vincular"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
