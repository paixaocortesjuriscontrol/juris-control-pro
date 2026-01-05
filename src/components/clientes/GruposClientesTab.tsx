import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GrupoClienteDialog } from "./GrupoClienteDialog";
import { VincularClientesDialog } from "./VincularClientesDialog";

interface GrupoCliente {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  created_at: string;
  clientes_count?: number;
}

export function GruposClientesTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vincularDialogOpen, setVincularDialogOpen] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoCliente | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [grupoToDelete, setGrupoToDelete] = useState<GrupoCliente | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["grupos_clientes"],
    queryFn: async () => {
      const { data: gruposData, error } = await supabase
        .from("grupos_clientes")
        .select("*")
        .order("nome");

      if (error) throw error;

      // Count clients for each group
      const gruposWithCount = await Promise.all(
        (gruposData || []).map(async (grupo) => {
          const { count } = await supabase
            .from("clientes_grupos")
            .select("*", { count: "exact", head: true })
            .eq("grupo_id", grupo.id);

          return {
            ...grupo,
            clientes_count: count || 0,
          };
        })
      );

      return gruposWithCount as GrupoCliente[];
    },
  });

  const handleEdit = (grupo: GrupoCliente) => {
    setSelectedGrupo(grupo);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedGrupo(null);
    setDialogOpen(true);
  };

  const handleVincular = (grupo: GrupoCliente) => {
    setSelectedGrupo(grupo);
    setVincularDialogOpen(true);
  };

  const handleDeleteClick = (grupo: GrupoCliente) => {
    setGrupoToDelete(grupo);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!grupoToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("grupos_clientes")
        .delete()
        .eq("id", grupoToDelete.id);

      if (error) throw error;

      toast({
        title: "Grupo excluído",
        description: "O grupo foi excluído com sucesso.",
      });

      queryClient.invalidateQueries({ queryKey: ["grupos_clientes"] });
    } catch (error: any) {
      console.error("Error deleting grupo:", error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o grupo.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setGrupoToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Grupo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : grupos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum grupo cadastrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((grupo) => (
                  <TableRow key={grupo.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: grupo.cor || "#3b82f6" }}
                        />
                        {grupo.nome}
                      </div>
                    </TableCell>
                    <TableCell>{grupo.descricao || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {grupo.clientes_count} cliente(s)
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleVincular(grupo)}
                          title="Gerenciar clientes"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(grupo)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(grupo)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <GrupoClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        grupo={selectedGrupo}
      />

      <VincularClientesDialog
        open={vincularDialogOpen}
        onOpenChange={setVincularDialogOpen}
        grupo={selectedGrupo}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o grupo "{grupoToDelete?.nome}"?
              Os clientes não serão excluídos, apenas desvinculados do grupo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
