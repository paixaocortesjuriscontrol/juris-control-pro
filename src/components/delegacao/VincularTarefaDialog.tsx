import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, CheckCircle2, Clock, Link } from "lucide-react";
import { cn } from "@/lib/utils";

interface VincularTarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefaOrigemId: string;
  onSuccess: () => void;
}

export function VincularTarefaDialog({
  open,
  onOpenChange,
  tarefaOrigemId,
  onSuccess,
}: VincularTarefaDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedTarefaId, setSelectedTarefaId] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);

  // Buscar tarefas para vincular
  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["tarefas-para-vincular", search, tarefaOrigemId],
    queryFn: async () => {
      let query = supabase
        .from("tarefas")
        .select(`
          id,
          titulo,
          status,
          prioridade,
          data_vencimento,
          processo:processos!tarefas_processo_id_fkey(numero)
        `)
        .neq("id", tarefaOrigemId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (search.length >= 2) {
        query = query.ilike("titulo", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filtrar tarefas já vinculadas
      const { data: jaVinculadas } = await supabase
        .from("tarefas_relacionadas")
        .select("tarefa_relacionada_id, tarefa_origem_id")
        .or(`tarefa_origem_id.eq.${tarefaOrigemId},tarefa_relacionada_id.eq.${tarefaOrigemId}`);

      const idsVinculados = new Set<string>();
      jaVinculadas?.forEach(v => {
        idsVinculados.add(v.tarefa_relacionada_id);
        idsVinculados.add(v.tarefa_origem_id);
      });

      return data?.filter(t => !idsVinculados.has(t.id)) || [];
    },
    enabled: open,
  });

  const handleVincular = async () => {
    if (!selectedTarefaId || !user?.id) return;

    setVinculando(true);
    try {
      const { error } = await supabase
        .from("tarefas_relacionadas")
        .insert({
          tarefa_origem_id: tarefaOrigemId,
          tarefa_relacionada_id: selectedTarefaId,
          criado_por: user.id,
        });

      if (error) throw error;

      toast({
        title: "Tarefa vinculada",
        description: "A tarefa foi vinculada com sucesso.",
      });

      setSelectedTarefaId(null);
      setSearch("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao vincular",
        description: error.message || "Não foi possível vincular a tarefa.",
        variant: "destructive",
      });
    } finally {
      setVinculando(false);
    }
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const classes: Record<string, string> = {
      urgente: "bg-red-500/10 text-red-600 border-red-200",
      alta: "bg-orange-500/10 text-orange-600 border-orange-200",
      media: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
      baixa: "bg-green-500/10 text-green-600 border-green-200",
    };
    return (
      <Badge variant="outline" className={cn("text-xs", classes[prioridade] || "")}>
        {prioridade}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            Vincular Tarefa Existente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tarefa por título..."
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : tarefas?.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {search.length >= 2 
                  ? "Nenhuma tarefa encontrada" 
                  : "Digite pelo menos 2 caracteres para buscar"}
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {tarefas?.map((tarefa) => (
                  <div
                    key={tarefa.id}
                    onClick={() => setSelectedTarefaId(tarefa.id)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedTarefaId === tarefa.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {tarefa.status === "cumprido" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                        )}
                        <span className={cn(
                          "text-sm truncate",
                          tarefa.status === "cumprido" && "line-through text-muted-foreground"
                        )}>
                          {tarefa.titulo}
                        </span>
                      </div>
                      {getPrioridadeBadge(tarefa.prioridade)}
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-6 text-xs text-muted-foreground">
                      {tarefa.processo?.numero && (
                        <span className="font-mono">{tarefa.processo.numero}</span>
                      )}
                      {tarefa.data_vencimento && (
                        <span>• {format(parseISO(tarefa.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleVincular}
              disabled={!selectedTarefaId || vinculando}
            >
              {vinculando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Vincular
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
