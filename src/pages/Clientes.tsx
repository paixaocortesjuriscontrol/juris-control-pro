import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, User, Building2, Loader2, Eye, Users } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ClienteDialog } from "@/components/clientes/ClienteDialog";
import { GruposClientesTab } from "@/components/clientes/GruposClientesTab";

export default function Clientes() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredClientes = clientes.filter((cliente) => {
    const matchesSearch =
      cliente.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cliente.cpf_cnpj && cliente.cpf_cnpj.includes(searchQuery)) ||
      (cliente.email && cliente.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTipo = tipoFilter === "all" || cliente.tipo === tipoFilter;

    return matchesSearch && matchesTipo;
  });

  const handleEdit = (cliente: any) => {
    setSelectedCliente(cliente);
    setDialogOpen(true);
  };

  const handleNewCliente = () => {
    setSelectedCliente(null);
    setDialogOpen(true);
  };

  const handleDeleteClick = (cliente: any) => {
    setClienteToDelete(cliente);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clienteToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clienteToDelete.id);

      if (error) throw error;

      toast({
        title: "Cliente excluído",
        description: "O cliente foi excluído com sucesso.",
      });

      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (error: any) {
      console.error("Error deleting cliente:", error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o cliente.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setClienteToDelete(null);
    }
  };

  const pessoasFisicas = clientes.filter((c) => c.tipo === "pessoa_fisica").length;
  const pessoasJuridicas = clientes.filter((c) => c.tipo === "pessoa_juridica").length;

  return (
    <MainLayout title="Clientes" subtitle="Gerencie os clientes do escritório">
      <Tabs defaultValue="clientes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="clientes" className="gap-2">
            <User className="w-4 h-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-2">
            <Users className="w-4 h-4" />
            Grupos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clientes.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pessoas Físicas</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pessoasFisicas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pessoas Jurídicas</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pessoasJuridicas}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nome, CPF/CNPJ ou email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                <SelectItem value="pessoa_juridica">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleNewCliente}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </div>

          {/* Clients Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredClientes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery || tipoFilter !== "all"
                    ? "Nenhum cliente encontrado com os filtros aplicados."
                    : "Nenhum cliente cadastrado."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">{cliente.nome}</TableCell>
                        <TableCell>
                          <Badge variant={cliente.tipo === "pessoa_fisica" ? "outline" : "secondary"}>
                            {cliente.tipo === "pessoa_fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
                          </Badge>
                        </TableCell>
                        <TableCell>{cliente.cpf_cnpj || "-"}</TableCell>
                        <TableCell>{cliente.email || "-"}</TableCell>
                        <TableCell>{cliente.telefone || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/clientes/${cliente.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(cliente)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(cliente)}
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
        </TabsContent>

        <TabsContent value="grupos">
          <GruposClientesTab />
        </TabsContent>
      </Tabs>

      {/* Cliente Dialog */}
      <ClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={selectedCliente}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{clienteToDelete?.nome}"?
              Esta ação não pode ser desfeita.
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
    </MainLayout>
  );
}
