import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  FileBox, 
  Upload, 
  Trash2, 
  Download, 
  FileText, 
  X, 
  Loader2,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  User,
  Calendar,
  Sparkles,
  Tag
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrlOrEmpty } from "@/utils/signedUrl";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sanitizeFileName } from "@/lib/utils";

const CATEGORIAS_LABELS: Record<string, string> = {
  'modelo': 'Modelo',
  'peca_processual': 'Peça Processual',
  'jurisprudencia': 'Jurisprudência',
  'legislacao': 'Legislação',
  'parecer': 'Parecer',
  'contrato': 'Contrato',
  'procuracao': 'Procuração',
  'outros': 'Outros',
  'geral': 'Geral'
};

interface ProcessoDocumentosTabProps {
  processoId: string;
  documentos: any[];
  refetchDocumentos: () => void;
}

export function ProcessoDocumentosTab({ 
  processoId, 
  documentos, 
  refetchDocumentos 
}: ProcessoDocumentosTabProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (tipo: string | null) => {
    if (!tipo) return <File className="h-4 w-4 text-muted-foreground" />;
    
    if (tipo.includes("image")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
    if (tipo.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
    if (tipo.includes("spreadsheet") || tipo.includes("excel") || tipo.includes("csv")) 
      return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    if (tipo.includes("zip") || tipo.includes("rar") || tipo.includes("archive")) 
      return <FileArchive className="h-4 w-4 text-amber-500" />;
    if (tipo.includes("word") || tipo.includes("document")) 
      return <FileText className="h-4 w-4 text-blue-600" />;
    
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  // Função para ler conteúdo de arquivo para análise
  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content || "");
      };
      reader.onerror = () => resolve("");
      
      if (file.type.includes("text") || file.type.includes("json") || file.type.includes("xml")) {
        reader.readAsText(file);
      } else if (file.type.includes("pdf") || file.type.includes("word") || file.type.includes("document")) {
        // Para PDFs/Word, enviar nome para análise baseada no nome
        resolve(`[Arquivo binário: ${file.name}]`);
      } else {
        resolve(`[Tipo de arquivo: ${file.type}]`);
      }
    });
  };

  // Função para analisar documento com IA
  const analisarDocumentoIA = async (
    documentoId: string,
    fileName: string,
    fileContent: string,
    mimeType: string
  ) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analisar-documento`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            fileName,
            fileContent,
            mimeType,
          }),
        }
      );

      if (!response.ok) {
        console.error("Erro na análise IA:", response.status);
        return null;
      }

      const analise = await response.json();
      
      // Atualizar documento com dados da análise
      await supabase
        .from("documentos")
        .update({
          categoria: analise.categoria,
          tipo_documento: analise.tipo_documento,
          descricao: analise.descricao,
          tags: analise.tags,
          analisado_ia: true,
          confianca_ia: analise.confianca,
        })
        .eq("id", documentoId);

      return analise;
    } catch (error) {
      console.error("Erro ao analisar documento:", error);
      return null;
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !user) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = selectedFiles.length;
      let uploadedCount = 0;

      for (const file of selectedFiles) {
        const sanitizedName = sanitizeFileName(file.name);
        const filePath = `${processoId}/${Date.now()}_${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from("documentos_processos")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Erro ao fazer upload:", uploadError);
          toast.error(`Erro ao enviar ${file.name}: ${uploadError.message}`);
          continue;
        }

        const signedUrl = await getSignedUrlOrEmpty("documentos_processos", filePath);

        // Inserir documento
        const { data: docData, error: dbError } = await supabase
          .from("documentos")
          .insert({
            nome: file.name,
            tipo: file.type,
            url: signedUrl,
            tamanho_bytes: file.size,
            processo_id: processoId,
            uploaded_by: user.id,
          })
          .select("id")
          .single();

        if (dbError) {
          console.error("Erro ao salvar documento:", dbError);
          toast.error(`Erro ao registrar ${file.name}: ${dbError.message}`);
          continue;
        }

        // Analisar documento com IA em background
        if (docData?.id) {
          const fileContent = await readFileContent(file);
          analisarDocumentoIA(docData.id, file.name, fileContent, file.type);
        }

        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      }

      toast.success(`${uploadedCount} documento(s) enviado(s) com sucesso. A IA está analisando os documentos...`);
      setSelectedFiles([]);
      refetchDocumentos();
    } catch (error) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao processar upload");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);

    try {
      const doc = documentos.find(d => d.id === deleteId);
      
      if (doc?.url) {
        const url = new URL(doc.url);
        const pathParts = url.pathname.split("/documentos_processos/");
        if (pathParts.length > 1) {
          const storagePath = decodeURIComponent(pathParts[1]);
          await supabase.storage
            .from("documentos_processos")
            .remove([storagePath]);
        }
      }

      const { error } = await supabase
        .from("documentos")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      toast.success("Documento excluído com sucesso");
      refetchDocumentos();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir documento");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleDownload = (doc: any) => {
    if (doc.url) {
      const link = document.createElement("a");
      link.href = doc.url;
      link.download = doc.nome;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileBox className="w-5 h-5" />
          Documentos do Processo
          {documentos.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {documentos.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Area */}
        <div className="border-2 border-dashed rounded-lg p-6 space-y-4">
          <div className="text-center">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Selecionar Arquivos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Arquivos selecionados ({selectedFiles.length}):
              </p>
              <div className="space-y-1">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {uploading && (
                <Progress value={uploadProgress} className="h-2" />
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar {selectedFiles.length} arquivo(s)
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Documents List */}
        {documentos.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Enviado por</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentos.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFileIcon(doc.tipo)}
                          <div className="flex flex-col min-w-0">
                            <span className="truncate max-w-[200px]" title={doc.nome}>
                              {doc.nome}
                            </span>
                            {doc.descricao && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {doc.descricao}
                              </span>
                            )}
                          </div>
                          {doc.analisado_ia && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Sparkles className="h-3 w-3 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Analisado por IA ({doc.confianca_ia})</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {doc.categoria ? (
                            <Badge variant="secondary" className="text-xs w-fit">
                              {CATEGORIAS_LABELS[doc.categoria] || doc.categoria}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs w-fit">
                              {doc.tipo?.split("/")[1]?.toUpperCase() || "N/A"}
                            </Badge>
                          )}
                          {doc.tags && doc.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                {doc.tags.slice(0, 2).join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatFileSize(doc.tamanho_bytes)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="truncate max-w-[100px]">
                            {doc.uploader?.nome || "Desconhecido"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {doc.created_at
                            ? format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })
                            : "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(doc)}
                          title="Baixar"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(doc.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          </ScrollArea>
        ) : (
          <div className="text-center py-8">
            <FileBox className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Nenhum documento anexado a este processo
            </p>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
