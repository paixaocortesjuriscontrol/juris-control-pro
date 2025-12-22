import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  ArrowLeft,
  Edit,
  Trash2,
  Upload,
  Scale,
  FileText,
  Building2,
  Calendar,
  User,
  ExternalLink,
  Download,
  Link,
} from "lucide-react";
import { usePasta, useDeletePasta, useVincularProcessoPasta } from "@/hooks/usePastas";
import { useDocumentos, useDeleteDocumento } from "@/hooks/useDocumentos";
import { useProcessos } from "@/hooks/useProcessos";
import { PastaDialog } from "@/components/pastas/PastaDialog";
import { UploadDocumentoDialog } from "@/components/pastas/UploadDocumentoDialog";
import { VincularProcessoDialog } from "@/components/pastas/VincularProcessoDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aberta: { label: "Aberta", variant: "default" },
  em_andamento: { label: "Em Andamento", variant: "secondary" },
  fechada: { label: "Fechada", variant: "outline" },
};

export default function PastaDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [vincularDialogOpen, setVincularDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  const { data: pasta, isLoading } = usePasta(id);
  const { data: allDocumentos } = useDocumentos();
  const { data: allProcessos } = useProcessos();
  const deletePasta = useDeletePasta();
  const deleteDocumento = useDeleteDocumento();
  const desvincularProcesso = useVincularProcessoPasta();

  // Filter documents and processes for this pasta
  const documentos = allDocumentos?.filter((d) => d.pasta_id === id) || [];
  const processos = allProcessos?.filter((p) => p.pasta_id === id) || [];

  const handleDeletePasta = async () => {
    if (id) {
      await deletePasta.mutateAsync(id);
      navigate("/pastas");
    }
  };

  const handleDeleteDocumento = async () => {
    if (docToDelete) {
      await deleteDocumento.mutateAsync(docToDelete);
      setDocToDelete(null);
    }
  };

  const handleDesvincularProcesso = async (processoId: string) => {
    await desvincularProcesso.mutateAsync({ processoId, pastaId: null });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (isLoading) {
    return (
      <MainLayout title="Carregando..." subtitle="">
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!pasta) {
    return (
      <MainLayout title="Pasta não encontrada" subtitle="">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">A pasta solicitada não foi encontrada.</p>
            <Button onClick={() => navigate("/pastas")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Pastas
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={pasta.nome}
      subtitle="Detalhes da pasta"
    >
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate("/pastas")}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      {/* Header Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl mb-2">{pasta.nome}</CardTitle>
              <Badge variant={statusLabels[pasta.status]?.variant || "default"}>
                {statusLabels[pasta.status]?.label || pasta.status}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Enviar Docs
              </Button>
              <Button variant="outline" size="sm" onClick={() => setVincularDialogOpen(true)}>
                <Link className="h-4 w-4 mr-2" />
                Vincular Processo
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pasta.descricao && (
            <p className="text-muted-foreground mb-4">{pasta.descricao}</p>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {pasta.coordenacao && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{pasta.coordenacao.nome}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Criador</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(new Date(pasta.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span>{processos.length} processos</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="processos">
        <TabsList>
          <TabsTrigger value="processos">
            <Scale className="h-4 w-4 mr-2" />
            Processos ({processos.length})
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileText className="h-4 w-4 mr-2" />
            Documentos ({documentos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="processos" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {processos.length === 0 ? (
                <div className="text-center py-8">
                  <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Nenhum processo vinculado a esta pasta
                  </p>
                  <Button onClick={() => setVincularDialogOpen(true)}>
                    <Link className="h-4 w-4 mr-2" />
                    Vincular Processo
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processos.map((processo) => (
                      <TableRow key={processo.id}>
                        <TableCell className="font-mono">{processo.numero}</TableCell>
                        <TableCell>{processo.assunto || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{processo.status}</Badge>
                        </TableCell>
                        <TableCell>{processo.area}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/processos/${processo.id}`)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleDesvincularProcesso(processo.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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

        <TabsContent value="documentos" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {documentos.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Nenhum documento nesta pasta
                  </p>
                  <Button onClick={() => setUploadDialogOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Documentos
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentos.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>{doc.nome}</TableCell>
                        <TableCell>{doc.tipo || "-"}</TableCell>
                        <TableCell>{formatFileSize(doc.tamanho_bytes)}</TableCell>
                        <TableCell>
                          {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {doc.url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(doc.url!, "_blank")}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setDocToDelete(doc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
      </Tabs>

      {/* Dialogs */}
      <PastaDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        pasta={pasta}
      />

      <UploadDocumentoDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        pastaId={id}
      />

      <VincularProcessoDialog
        open={vincularDialogOpen}
        onOpenChange={setVincularDialogOpen}
        pastaId={id!}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta pasta? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePasta}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!docToDelete} onOpenChange={() => setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocumento}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
