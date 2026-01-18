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
  FileSpreadsheet, FileImage, Archive, Sparkles, Loader2, Check, Link
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

type FileAnalysis = {
  file: File;
  nome: string;
  categoria: string;
  tipo_documento: string | null;
  descricao: string;
  tags: string[];
  confianca: "alta" | "media" | "baixa";
  analyzing: boolean;
  analyzed: boolean;
  error?: string;
  // Campos de vinculação de processo
  processo_id: string | null;
  processo_numero: string | null;
  numero_processo_extraido: string | null;
};

type UploadStep = "select" | "analyze" | "review";

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
  
  // Upload flow state
  const [uploadStep, setUploadStep] = useState<UploadStep>("select");
  const [fileAnalyses, setFileAnalyses] = useState<FileAnalysis[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
    addFilesForAnalysis(files);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFilesForAnalysis(files);
    }
  };

  const addFilesForAnalysis = (files: File[]) => {
    const newAnalyses: FileAnalysis[] = files.map(file => ({
      file,
      nome: file.name.replace(/\.[^/.]+$/, ""),
      categoria: "outros",
      tipo_documento: null,
      descricao: "",
      tags: [],
      confianca: "baixa",
      analyzing: false,
      analyzed: false,
      processo_id: null,
      processo_numero: null,
      numero_processo_extraido: null,
    }));
    setFileAnalyses(prev => [...prev, ...newAnalyses]);
  };

  const removeFile = (index: number) => {
    setFileAnalyses(prev => prev.filter((_, i) => i !== index));
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      if (file.type.includes("text") || 
          file.name.endsWith(".txt") || 
          file.name.endsWith(".md") ||
          file.name.endsWith(".rtf")) {
        reader.onload = (e) => resolve(e.target?.result as string || "");
        reader.onerror = reject;
        reader.readAsText(file);
      } else {
        // Para PDFs e outros, ler como ArrayBuffer e converter parcialmente
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          // Tentar extrair texto legível do buffer
          const bytes = new Uint8Array(arrayBuffer);
          let text = "";
          for (let i = 0; i < Math.min(bytes.length, 50000); i++) {
            const char = bytes[i];
            // Apenas caracteres ASCII imprimíveis
            if (char >= 32 && char <= 126) {
              text += String.fromCharCode(char);
            } else if (char === 10 || char === 13) {
              text += "\n";
            }
          }
          resolve(text);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const analyzeFile = async (index: number) => {
    const analysis = fileAnalyses[index];
    if (!analysis) return;

    setFileAnalyses(prev => prev.map((a, i) => 
      i === index ? { ...a, analyzing: true, error: undefined } : a
    ));

    try {
      const content = await readFileContent(analysis.file);
      
      const { data, error } = await supabase.functions.invoke("analisar-documento", {
        body: {
          fileName: analysis.file.name,
          fileContent: content,
          mimeType: analysis.file.type,
        },
      });

      if (error) throw error;

      setFileAnalyses(prev => prev.map((a, i) => 
        i === index ? {
          ...a,
          categoria: data.categoria || "outros",
          tipo_documento: data.tipo_documento || null,
          descricao: data.descricao || "",
          tags: data.tags || [],
          confianca: data.confianca || "baixa",
          analyzing: false,
          analyzed: true,
          processo_id: data.processo_id || null,
          processo_numero: data.processo_numero || null,
          numero_processo_extraido: data.numero_processo_extraido || null,
        } : a
      ));
    } catch (error: any) {
      console.error("Erro ao analisar:", error);
      setFileAnalyses(prev => prev.map((a, i) => 
        i === index ? { 
          ...a, 
          analyzing: false, 
          analyzed: true,
          error: "Falha na análise automática" 
        } : a
      ));
    }
  };

  const analyzeAllFiles = async () => {
    setUploadStep("analyze");
    
    for (let i = 0; i < fileAnalyses.length; i++) {
      if (!fileAnalyses[i].analyzed) {
        await analyzeFile(i);
      }
    }
    
    setUploadStep("review");
  };

  const handleUpload = async () => {
    if (!fileAnalyses.length || !user) return;
    
    setIsUploading(true);

    try {
      for (const analysis of fileAnalyses) {
        await uploadMutation.mutateAsync({
          file: analysis.file,
          nome: analysis.nome,
          categoria: analysis.categoria,
          descricao: analysis.descricao || undefined,
          tipo_documento: analysis.tipo_documento || undefined,
          tags: analysis.tags.length > 0 ? analysis.tags : undefined,
          userId: user.id,
          processo_id: analysis.processo_id || undefined,
          numero_processo_extraido: analysis.numero_processo_extraido || undefined,
        });
      }
      
      setUploadDialogOpen(false);
      resetUploadForm();
      toast.success(`${fileAnalyses.length} documento(s) enviado(s) com sucesso`);
    } catch (error) {
      console.error("Erro no upload:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadForm = () => {
    setFileAnalyses([]);
    setUploadStep("select");
    setEditingIndex(null);
  };

  const updateFileAnalysis = (index: number, updates: Partial<FileAnalysis>) => {
    setFileAnalyses(prev => prev.map((a, i) => 
      i === index ? { ...a, ...updates } : a
    ));
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

  const getConfiancaBadge = (confianca: string) => {
    switch (confianca) {
      case "alta":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Alta</Badge>;
      case "media":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Média</Badge>;
      default:
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Baixa</Badge>;
    }
  };

  const allFilesAnalyzed = fileAnalyses.length > 0 && fileAnalyses.every(f => f.analyzed);
  const someFilesAnalyzing = fileAnalyses.some(f => f.analyzing);

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
                  <TableHead>Processo Vinculado</TableHead>
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
                    <TableCell>
                      {doc.processo ? (
                        <a 
                          href={`/processos/${doc.processo.id}`}
                          className="flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          <Link className="w-3 h-3" />
                          {doc.processo.numero}
                        </a>
                      ) : doc.numero_processo_extraido ? (
                        <span className="text-xs text-muted-foreground" title="Processo não encontrado no sistema">
                          {doc.numero_processo_extraido}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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

      {/* Upload Dialog with AI Analysis */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) resetUploadForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {uploadStep === "select" && "Selecionar Documentos"}
              {uploadStep === "analyze" && (
                <>
                  <Sparkles className="w-5 h-5 text-primary" />
                  Analisando com IA...
                </>
              )}
              {uploadStep === "review" && (
                <>
                  <Sparkles className="w-5 h-5 text-primary" />
                  Revisar Classificação
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Step 1: Select Files */}
            {uploadStep === "select" && (
              <>
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

                {fileAnalyses.length > 0 && (
                  <div className="space-y-2">
                    <Label>Arquivos selecionados ({fileAnalyses.length}):</Label>
                    <div className="max-h-40 overflow-auto space-y-1">
                      {fileAnalyses.map((analysis, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between bg-muted/50 rounded px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            {getFileIcon(analysis.file.type)}
                            <span className="text-sm truncate flex-1">{analysis.file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(analysis.file.size)}
                            </span>
                          </div>
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

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Classificação Automática</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        A IA irá analisar cada documento e sugerir categoria, tipo e descrição. 
                        Você poderá revisar e editar antes de confirmar o envio.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Analyzing */}
            {uploadStep === "analyze" && (
              <div className="space-y-3">
                {fileAnalyses.map((analysis, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      {getFileIcon(analysis.file.type)}
                      <span className="text-sm">{analysis.file.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysis.analyzing && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                      {analysis.analyzed && !analysis.error && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                      {analysis.error && (
                        <span className="text-xs text-destructive">{analysis.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 3: Review */}
            {uploadStep === "review" && (
              <div className="space-y-4">
                {fileAnalyses.map((analysis, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardHeader className="pb-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getFileIcon(analysis.file.type)}
                          <span className="font-medium text-sm">{analysis.file.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getConfiancaBadge(analysis.confianca)}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            {editingIndex === index ? "Fechar" : "Editar"}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      {editingIndex === index ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Nome</Label>
                            <Input
                              value={analysis.nome}
                              onChange={(e) => updateFileAnalysis(index, { nome: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Categoria</Label>
                              <Select 
                                value={analysis.categoria} 
                                onValueChange={(v) => updateFileAnalysis(index, { categoria: v })}
                              >
                                <SelectTrigger className="h-8 text-sm">
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
                            <div className="space-y-1">
                              <Label className="text-xs">Tipo</Label>
                              <Select 
                                value={analysis.tipo_documento || ""} 
                                onValueChange={(v) => updateFileAnalysis(index, { tipo_documento: v || null })}
                              >
                                <SelectTrigger className="h-8 text-sm">
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
                          <div className="space-y-1">
                            <Label className="text-xs">Descrição</Label>
                            <Textarea
                              value={analysis.descricao}
                              onChange={(e) => updateFileAnalysis(index, { descricao: e.target.value })}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Tags (separadas por vírgula)</Label>
                            <Input
                              value={analysis.tags.join(", ")}
                              onChange={(e) => updateFileAnalysis(index, { 
                                tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) 
                              })}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-muted-foreground">Categoria:</span>
                            <Badge variant="secondary">{getCategoriaLabel(analysis.categoria)}</Badge>
                            {analysis.tipo_documento && (
                              <>
                                <span className="text-muted-foreground">Tipo:</span>
                                <Badge variant="outline">
                                  {TIPOS_DOCUMENTO.find(t => t.value === analysis.tipo_documento)?.label}
                                </Badge>
                              </>
                            )}
                          </div>
                          {analysis.processo_id && analysis.processo_numero && (
                            <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-md border border-green-500/20">
                              <Link className="w-4 h-4 text-green-600" />
                              <span className="text-green-700 dark:text-green-400 font-medium">
                                Vinculado ao processo: {analysis.processo_numero}
                              </span>
                            </div>
                          )}
                          {!analysis.processo_id && analysis.numero_processo_extraido && (
                            <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded-md border border-yellow-500/20">
                              <span className="text-yellow-700 dark:text-yellow-400 text-xs">
                                Nº processo encontrado: {analysis.numero_processo_extraido} (não cadastrado no sistema)
                              </span>
                            </div>
                          )}
                          {analysis.descricao && (
                            <p className="text-muted-foreground">{analysis.descricao}</p>
                          )}
                          {analysis.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {analysis.tags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            {uploadStep === "select" && (
              <>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={analyzeAllFiles} 
                  disabled={fileAnalyses.length === 0}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analisar com IA
                </Button>
              </>
            )}
            {uploadStep === "analyze" && (
              <Button disabled>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analisando...
              </Button>
            )}
            {uploadStep === "review" && (
              <>
                <Button variant="outline" onClick={() => setUploadStep("select")}>
                  Voltar
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={isUploading || someFilesAnalyzing}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Confirmar e Enviar ({fileAnalyses.length})
                    </>
                  )}
                </Button>
              </>
            )}
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
