import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VincularClientesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grupo: {
    id: string;
    nome: string;
  } | null;
}

interface Cliente {
  id: string;
  nome: string;
  tipo: string;
  cpf_cnpj: string | null;
}

export function VincularClientesDialog({
  open,
  onOpenChange,
  grupo,
}: VincularClientesDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientes, setSelectedClientes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all clients
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, tipo, cpf_cnpj")
        .order("nome");
      if (error) throw error;
      return data as Cliente[];
    },
  });

  // Fetch already linked clients
  const { data: linkedClientes = [], isLoading: loadingLinked } = useQuery({
    queryKey: ["clientes_grupos", grupo?.id],
    queryFn: async () => {
      if (!grupo) return [];
      const { data, error } = await supabase
        .from("clientes_grupos")
        .select("cliente_id")
        .eq("grupo_id", grupo.id);
      if (error) throw error;
      return data.map((r) => r.cliente_id);
    },
    enabled: !!grupo?.id,
  });

  useEffect(() => {
    if (open && linkedClientes.length > 0) {
      setSelectedClientes(new Set(linkedClientes));
    } else if (open) {
      setSelectedClientes(new Set());
    }
  }, [open, linkedClientes]);

  const filteredClientes = clientes.filter(
    (cliente) =>
      cliente.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cliente.cpf_cnpj && cliente.cpf_cnpj.includes(searchQuery))
  );

  const toggleCliente = (clienteId: string) => {
    const newSet = new Set(selectedClientes);
    if (newSet.has(clienteId)) {
      newSet.delete(clienteId);
    } else {
      newSet.add(clienteId);
    }
    setSelectedClientes(newSet);
  };

  const handleSave = async () => {
    if (!grupo) return;

    setSaving(true);
    try {
      // Remove all existing links for this group
      const { error: deleteError } = await supabase
        .from("clientes_grupos")
        .delete()
        .eq("grupo_id", grupo.id);

      if (deleteError) throw deleteError;

      // Insert new links
      if (selectedClientes.size > 0) {
        const links = Array.from(selectedClientes).map((clienteId) => ({
          grupo_id: grupo.id,
          cliente_id: clienteId,
        }));

        const { error: insertError } = await supabase
          .from("clientes_grupos")
          .insert(links);

        if (insertError) throw insertError;
      }

      toast({
        title: "Clientes vinculados",
        description: `${selectedClientes.size} cliente(s) vinculado(s) ao grupo.`,
      });

      queryClient.invalidateQueries({ queryKey: ["grupos_clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes_grupos", grupo.id] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving links:", error);
      toast({
        title: "Erro ao vincular",
        description: error.message || "Não foi possível vincular os clientes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isLoading = loadingClientes || loadingLinked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular Clientes ao Grupo: {grupo?.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar clientes..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedClientes.size} cliente(s) selecionado(s)
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-1">
                {filteredClientes.map((cliente) => (
                  <div
                    key={cliente.id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                      selectedClientes.has(cliente.id)
                        ? "bg-primary/10"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => toggleCliente(cliente.id)}
                  >
                    <Checkbox
                      checked={selectedClientes.has(cliente.id)}
                      onCheckedChange={() => toggleCliente(cliente.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cliente.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {cliente.tipo === "pessoa_fisica"
                          ? "Pessoa Física"
                          : "Pessoa Jurídica"}
                        {cliente.cpf_cnpj && ` • ${cliente.cpf_cnpj}`}
                      </p>
                    </div>
                    {selectedClientes.has(cliente.id) && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                ))}
                {filteredClientes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado.
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
