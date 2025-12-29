import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { 
  Search, Upload, FileText, File, MoreHorizontal, 
  Pencil, Trash2, Download, FolderOpen, X, Plus,
  FileSpreadsheet, FileImage, Archive
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useRepositorioDocumentos, 
  useUploadRepositorioDocumento,
  useUpdateRepositorioDocumento,
  useDeleteRepositorioDocumento,
  CATEGORIAS_DOCUMENTO,
  TIPOS_DOCUMENTO,
  type RepositorioDocumento
} from "@/hooks/useRepositorioDocumentos";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function RepositorioDocumentos() {
  const { user } = useAuth();
  const { data: documentos, isLoading } = useRepositorioDocumentos();
  const uploadMutation = useUploadRepositorioDocumento();
  const updateMutation = useUpdateRepositorioDocumento();
  const deleteMutation = useDeleteRepositorioDocumento();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<RepositorioDocumento | null>(null);
  
  // Upload form state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadNome, setUploadNome] = useState("");
  const [uploadCategoria, setUploadCategoria] = useState("modelo");
  const [uploadTipo, setUploadTipo] = useState("");
  const [uploadDescricao, setUploadDescricao] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const filteredDocs = documentos?.filter(doc => {
    const matchesSearch = 
      doc.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.nome_original.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.descricao?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategoria = categoriaFilter === "all" || doc.categoria === categoriaFilter;
    
    return matchesSearch && matchesCategoria;
  });

  const stats = {
    total: documentos?.length || 0,
    modelos: documentos?.filter(d => d.categoria === "modelo").length || 0,
    pecas: documentos?.filter(d => d.categoria === "peca_processual").length || 0,
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="w-5 h-5 text-muted-foreground" />;
    if (mimeType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
    if (mimeType.includes("word") || mimeType.includes("document")) 
      return <FileText className="w-5 h-5 text-blue-500" />;
    if (mimeType.includes("sheet") || mimeType.includes("excel")) 
      return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    if (mimeType.includes("image")) return <FileImage className="w-5 h-5 text-purple-500" />;
    if (mimeType.includes("zip") || mimeType.includes("rar")) 
      return <Archive className="w-5 h-5 text-yellow-500" />;
    return <File className="w-5 h-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoriaLabel = (value: string) => {
    return CATEGORIAS_DOCUMENTO.find(c => c.value === value)?.label || value;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    setUploadFiles(prev => [...prev, ...files]);
    if (files.length === 1 && !uploadNome) {
      setUploadNome(files[0].name.replace(/\.[^/.]+$/, ""));
    }
  }, [uploadNome]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadFiles(prev => [...prev, ...files]);
      if (files.length === 1 && !uploadNome) {
        setUploadNome(files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!uploadFiles.length || !user) return;
    
    setIsUploading(true);
    const tags = uploadTags.split(",").map(t => t.trim()).filter(Boolean);

    try {
      for (const file of uploadFiles) {
        await uploadMutation.mutateAsync({
          file,
          nome: uploadFiles.length === 1 ? uploadNome : file.name.replace(/\.[^/.]+$/, ""),
          categoria: uploadCategoria,
          descricao: uploadDescricao || undefined,
          tipo_documento: uploadTipo || undefined,
          tags: tags.length > 0 ? tags : undefined,
          userId: user.id,
        });
      }
      
      setUploadDialogOpen(false);
      resetUploadForm();
    } catch (error) {
      console.error("Erro no upload:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFiles([]);
    setUploadNome("");
    setUploadCategoria("modelo");
    setUploadTipo("");
    setUploadDescricao("");
    setUploadTags("");
  };

  const handleEdit = (doc: RepositorioDocumento) => {
    setSelectedDoc(doc);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDoc) return;
    
    await updateMutation.mutateAsync({
      id: selectedDoc.id,
      nome: selectedDoc.nome,
      categoria: selectedDoc.categoria,
      descricao: selectedDoc.descricao || undefined,
      tipo_documento: selectedDoc.tipo_documento || undefined,
      tags: selectedDoc.tags || undefined,
    });
    
    setEditDialogOpen(false);
    setSelectedDoc(null);
  };

  const handleDelete = (doc: RepositorioDocumento) => {
    setSelectedDoc(doc);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedDoc) return;
    
    await deleteMutation.mutateAsync({
      id: selectedDoc.id,
      storagePath: selectedDoc.storage_path,
    });
    
    setDeleteDialogOpen(false);
    setSelectedDoc(null);
  };

  const handleDownload = async (doc: RepositorioDocumento) => {
    try {
      const { data, error } = await supabase.storage
        .from("repositorio_documentos")
        .download(doc.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nome_original;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error("Erro ao baixar documento: " + error.message);
    }
  };

  return (
    <MainLayout 
      title="Repositório de Documentos" 
      subtitle="Documentos para consulta e geração por IA"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Modelos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.modelos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Peças Processuais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pecas}</div>
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
                placeholder="Buscar documentos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {CATEGORIAS_DOCUMENTO.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Enviar Documento
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando documentos...
            </div>
          ) : filteredDocs?.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || categoriaFilter !== "all" 
                  ? "Nenhum documento encontrado com os filtros aplicados"
                  : "Nenhum documento no repositório. Envie o primeiro!"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs?.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.mime_type)}
                        <div>
                          <p className="font-medium">{doc.nome}</p>
                          {doc.descricao && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {doc.descricao}
                            </p>
                          )}
                          {doc.tags && doc.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {doc.tags.slice(0, 3).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {doc.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{doc.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getCategoriaLabel(doc.categoria)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {doc.tipo_documento 
                        ? TIPOS_DOCUMENTO.find(t => t.value === doc.tipo_documento)?.label || doc.tipo_documento
                        : "-"}
                    </TableCell>
                    <TableCell>{formatFileSize(doc.tamanho_bytes)}</TableCell>
                    <TableCell>
                      {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(doc)}>
                            <Download className="w-4 h-4 mr-2" />
                            Baixar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(doc)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(doc)}
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

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar Documentos</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Arraste arquivos aqui ou
              </p>
              <label>
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>
                    <Plus className="w-4 h-4 mr-2" />
                    Selecionar Arquivos
                  </span>
                </Button>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf"
                />
              </label>
            </div>

            {/* Selected Files */}
            {uploadFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Arquivos selecionados:</Label>
                <div className="max-h-32 overflow-auto space-y-1">
                  {uploadFiles.map((file, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between bg-muted/50 rounded px-3 py-2"
                    >
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadFiles.length === 1 && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Documento</Label>
                <Input
                  id="nome"
                  value={uploadNome}
                  onChange={(e) => setUploadNome(e.target.value)}
                  placeholder="Nome para identificação"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={uploadCategoria} onValueChange={setUploadCategoria}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_DOCUMENTO.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={uploadTipo} onValueChange={setUploadTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={uploadDescricao}
                onChange={(e) => setUploadDescricao(e.target.value)}
                placeholder="Breve descrição do documento..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="trabalhista, reclamação, dano moral..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!uploadFiles.length || isUploading}
            >
              {isUploading ? "Enviando..." : `Enviar ${uploadFiles.length > 1 ? `(${uploadFiles.length})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Documento</DialogTitle>
          </DialogHeader>
          
          {selectedDoc && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={selectedDoc.nome}
                  onChange={(e) => setSelectedDoc({ ...selectedDoc, nome: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select 
                    value={selectedDoc.categoria} 
                    onValueChange={(v) => setSelectedDoc({ ...selectedDoc, categoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_DOCUMENTO.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={selectedDoc.tipo_documento || ""} 
                    onValueChange={(v) => setSelectedDoc({ ...selectedDoc, tipo_documento: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_DOCUMENTO.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={selectedDoc.descricao || ""}
                  onChange={(e) => setSelectedDoc({ ...selectedDoc, descricao: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <Input
                  value={selectedDoc.tags?.join(", ") || ""}
                  onChange={(e) => setSelectedDoc({ 
                    ...selectedDoc, 
                    tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) 
                  })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento "{selectedDoc?.nome}" será removido permanentemente do repositório.
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
