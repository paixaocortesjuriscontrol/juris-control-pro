import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Plus,
  FolderOpen,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Scale,
  Upload,
  Building2,
  Calendar,
} from "lucide-react";
import { usePastas, useDeletePasta, Pasta } from "@/hooks/usePastas";
import { PastaDialog } from "@/components/pastas/PastaDialog";
import { UploadDocumentoDialog } from "@/components/pastas/UploadDocumentoDialog";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aberta: { label: "Aberta", variant: "default" },
  em_andamento: { label: "Em Andamento", variant: "secondary" },
  fechada: { label: "Fechada", variant: "outline" },
};

export default function Pastas() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedPasta, setSelectedPasta] = useState<Pasta | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pastaToDelete, setPastaToDelete] = useState<Pasta | null>(null);

  const { data: pastas, isLoading } = usePastas({ withCounts: true });
  const deletePasta = useDeletePasta();

  const filteredPastas = pastas?.filter((pasta) =>
    pasta.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pasta.descricao?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (pasta: Pasta) => {
    setSelectedPasta(pasta);
    setDialogOpen(true);
  };

  const handleUpload = (pasta: Pasta) => {
    setSelectedPasta(pasta);
    setUploadDialogOpen(true);
  };

  const handleDelete = (pasta: Pasta) => {
    setPastaToDelete(pasta);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (pastaToDelete) {
      await deletePasta.mutateAsync(pastaToDelete.id);
      setDeleteDialogOpen(false);
      setPastaToDelete(null);
    }
  };

  const openNewDialog = () => {
    setSelectedPasta(null);
    setDialogOpen(true);
  };

  return (
    <MainLayout
      title="Pastas"
      subtitle="Organize casos e documentos antes de vincular processos"
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Pastas</p>
                <p className="text-2xl font-bold">{pastas?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Scale className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Com Processos</p>
                <p className="text-2xl font-bold">
                  {pastas?.filter((p) => (p._count?.processos || 0) > 0).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <FileText className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Documentos</p>
                <p className="text-2xl font-bold">
                  {pastas?.reduce((acc, p) => acc + (p._count?.documentos || 0), 0) || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pastas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Pasta
        </Button>
      </div>

      {/* Pastas Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredPastas?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma pasta encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "Tente ajustar sua busca"
                : "Crie sua primeira pasta para organizar casos"}
            </p>
            {!searchQuery && (
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Pasta
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPastas?.map((pasta) => (
            <Card
              key={pasta.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/pastas/${pasta.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base line-clamp-1">
                      {pasta.nome}
                    </CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUpload(pasta); }}>
                        <Upload className="h-4 w-4 mr-2" />
                        Enviar Documentos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(pasta); }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); handleDelete(pasta); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Badge variant={statusLabels[pasta.status]?.variant || "default"}>
                  {statusLabels[pasta.status]?.label || pasta.status}
                </Badge>
              </CardHeader>
              <CardContent>
                {pasta.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {pasta.descricao}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                  {pasta.coordenacao && (
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {pasta.coordenacao.nome}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(pasta.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                </div>

                <div className="flex gap-4 pt-2 border-t">
                  <div className="flex items-center gap-1 text-sm">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    <span>{pasta._count?.processos || 0} processos</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{pasta._count?.documentos || 0} documentos</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PastaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pasta={selectedPasta}
      />

      <UploadDocumentoDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        pastaId={selectedPasta?.id}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a pasta "{pastaToDelete?.nome}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
