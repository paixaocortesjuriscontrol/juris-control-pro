import { useState, useMemo } from "react";
import {
  FileText,
  Filter,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileType,
  Download,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useDocumentos, useDeleteDocumento, type Documento } from "@/hooks/useDocumentos";
import { DocumentoDialog } from "@/components/documentos/DocumentoDialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const tipoLabels: Record<string, string> = {
  peticao: "Petição",
  contrato: "Contrato",
  procuracao: "Procuração",
  sentenca: "Sentença",
  acordao: "Acórdão",
  recurso: "Recurso",
  notificacao: "Notificação",
  certidao: "Certidão",
  comprovante: "Comprovante",
  outros: "Outros",
};

const Documentos = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDocumento, setSelectedDocumento] = useState<Documento | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentoToDelete, setDocumentoToDelete] = useState<string | null>(null);

  const { data: documentos, isLoading } = useDocumentos();
  const deleteDocumento = useDeleteDocumento();

  // Calcula estatísticas
  const stats = useMemo(() => {
    if (!documentos) return { total: 0, comProcesso: 0, semProcesso: 0 };

    const total = documentos.length;
    const comProcesso = documentos.filter((d) => d.processo_id).length;
    const semProcesso = total - comProcesso;

    return { total, comProcesso, semProcesso };
  }, [documentos]);

  // Filtra documentos
  const filteredDocumentos = useMemo(() => {
    if (!documentos) return [];

    return documentos.filter((documento) => {
      // Busca
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchNome = documento.nome.toLowerCase().includes(query);
        const matchProcesso = documento.processo?.numero.toLowerCase().includes(query);
        const matchUploader = documento.uploader?.nome.toLowerCase().includes(query);
        if (!matchNome && !matchProcesso && !matchUploader) return false;
      }

      // Tipo filter
      if (tipoFilter !== "all" && documento.tipo !== tipoFilter) {
        return false;
      }

      return true;
    });
  }, [documentos, searchQuery, tipoFilter]);

  const getFileIcon = (tipo: string | null) => {
    switch (tipo) {
      case "peticao":
      case "recurso":
      case "sentenca":
      case "acordao":
        return <FileText className="w-5 h-5 text-blue-500" />;
      case "contrato":
      case "procuracao":
        return <FileType className="w-5 h-5 text-purple-500" />;
      case "comprovante":
        return <FileImage className="w-5 h-5 text-green-500" />;
      case "certidao":
        return <FileSpreadsheet className="w-5 h-5 text-amber-500" />;
      default:
        return <File className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleEdit = (documento: Documento) => {
    setSelectedDocumento(documento);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDocumentoToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (documentoToDelete) {
      await deleteDocumento.mutateAsync(documentoToDelete);
      setDeleteDialogOpen(false);
      setDocumentoToDelete(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setTipoFilter("all");
  };

  const hasActiveFilters = searchQuery || tipoFilter !== "all";

  return (
    <MainLayout
      title="Documentos"
      subtitle="Gerencie os documentos dos processos"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : stats.comProcesso}</p>
                <p className="text-xs text-muted-foreground">Vinculados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : stats.semProcesso}</p>
                <p className="text-xs text-muted-foreground">Avulsos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nome, processo ou usuário..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {Object.entries(tipoLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => { setSelectedDocumento(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Documento
            </Button>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-sm text-muted-foreground">Filtros ativos:</span>
              {searchQuery && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery("")}>
                  Busca: {searchQuery} ×
                </Badge>
              )}
              {tipoFilter !== "all" && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setTipoFilter("all")}>
                  {tipoLabels[tipoFilter]} ×
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar todos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredDocumentos.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum documento encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters
                  ? "Tente ajustar os filtros de busca"
                  : "Cadastre seu primeiro documento"}
              </p>
              {!hasActiveFilters && (
                <Button onClick={() => { setSelectedDocumento(null); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Documento
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Cadastrado por</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocumentos.map((documento) => (
                  <TableRow key={documento.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getFileIcon(documento.tipo)}
                        <span className="font-medium">{documento.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {documento.tipo ? (
                        <Badge variant="secondary">
                          {tipoLabels[documento.tipo] || documento.tipo}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {documento.processo ? (
                        <Button
                          variant="link"
                          className="p-0 h-auto text-primary"
                          onClick={() => navigate(`/processos/${documento.processo_id}`)}
                        >
                          {documento.processo.numero}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">Avulso</span>
                      )}
                    </TableCell>
                    <TableCell>{formatFileSize(documento.tamanho_bytes)}</TableCell>
                    <TableCell>{documento.uploader?.nome || "-"}</TableCell>
                    <TableCell>
                      {format(parseISO(documento.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {documento.url && (
                            <DropdownMenuItem asChild>
                              <a href={documento.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Abrir Link
                              </a>
                            </DropdownMenuItem>
                          )}
                          {documento.processo_id && (
                            <DropdownMenuItem onClick={() => navigate(`/processos/${documento.processo_id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Processo
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleEdit(documento)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(documento.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <DocumentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        documento={selectedDocumento}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.
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
};

export default Documentos;
