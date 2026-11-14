import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { concluirItensEmLote, type ItemConclusaoLote } from "@/lib/concluirItensEmLote";
import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, UserPlus, Trash2, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AcoesEmLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  selectedItens?: ItemConclusaoLote[];
  onSuccess: () => void;
}

export function AcoesEmLoteDialog({
  open,
  onOpenChange,
  selectedIds,
  selectedItens,
  onSuccess,
}: AcoesEmLoteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string>("");
  const [novoResponsavel, setNovoResponsavel] = useState<string>("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const itensSelecionados: ItemConclusaoLote[] = selectedItens ?? selectedIds.map((id) => ({ id, tipo: "tarefa", origem: "tarefa" }));
  const somenteTarefas = itensSelecionados.every((item) => item.origem === "tarefa");

  // Fetch all profiles for reassignment
  const { data: profiles } = useQuery({
    queryKey: ["profiles-lote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const handleConcluirEmLote = async () => {
    setLoading(true);
    try {
      const total = await concluirItensEmLote(itensSelecionados);
      await invalidarItensAgenda(queryClient);
      toast({
        title: "Itens concluídos!",
        description: `${total} item(ns) foram concluídos.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao concluir itens",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReatribuirEmLote = async () => {
    if (!novoResponsavel) {
      toast({
        title: "Selecione um responsável",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("tarefas")
        .update({
          responsavel_id: novoResponsavel,
        })
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Tarefas reatribuídas!",
        description: `${selectedIds.length} tarefa(s) foram reatribuídas.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao reatribuir tarefas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirEmLote = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tarefas")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Tarefas excluídas!",
        description: `${selectedIds.length} tarefa(s) foram excluídas.`,
      });

      onSuccess();
      onOpenChange(false);
      setConfirmDeleteOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir tarefas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ações em lote</DialogTitle>
            <DialogDescription>
              Executar ação para {selectedIds.length} item(ns) selecionado(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Concluir em lote */}
            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">Concluir itens</p>
                  <p className="text-sm text-muted-foreground">
                    Marcar todas como concluídas
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleConcluirEmLote}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Executar"}
              </Button>
            </div>

            {/* Reatribuir em lote */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">Reatribuir tarefas</p>
                  <p className="text-sm text-muted-foreground">
                    {somenteTarefas ? "Alterar responsável de todas" : "Disponível apenas para uma seleção somente de tarefas"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={novoResponsavel} onValueChange={setNovoResponsavel}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o novo responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleReatribuirEmLote}
                  disabled={loading || !novoResponsavel || !somenteTarefas}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Executar"}
                </Button>
              </div>
            </div>

            {/* Excluir em lote */}
            <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg hover:bg-destructive/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="font-medium text-destructive">Excluir tarefas</p>
                  <p className="text-sm text-muted-foreground">
                    {somenteTarefas ? "Esta ação não pode ser desfeita" : "Disponível apenas para uma seleção somente de tarefas"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={loading || !somenteTarefas}
              >
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir {selectedIds.length} tarefa(s). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluirEmLote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
