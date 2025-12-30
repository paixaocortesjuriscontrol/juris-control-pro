import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

// Regex para detectar referências a documentos no texto
const documentPatterns = [
  /documento[s]?\s*["']([^"']+)["']/gi,
  /arquivo[s]?\s*["']([^"']+)["']/gi,
  /\*\*([^*]+\.(?:pdf|docx?|xlsx?|txt))\*\*/gi,
  /["']([^"']+\.(?:pdf|docx?|xlsx?|txt))["']/gi,
];

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  const extractDocumentNames = (text: string): string[] => {
    const names = new Set<string>();
    
    documentPatterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          names.add(match[1].trim());
        }
      }
    });
    
    return Array.from(names);
  };

  const handleDownload = async (documentName: string) => {
    try {
      // Buscar o documento pelo nome
      const { data: docs, error: searchError } = await supabase
        .from("repositorio_documentos")
        .select("id, nome, nome_original, storage_path")
        .or(`nome.ilike.%${documentName}%,nome_original.ilike.%${documentName}%`)
        .limit(1);

      if (searchError || !docs || docs.length === 0) {
        toast.error("Documento não encontrado no repositório");
        return;
      }

      const doc = docs[0];
      
      // Gerar URL de download
      const { data: urlData, error: urlError } = await supabase.storage
        .from("repositorio-documentos")
        .createSignedUrl(doc.storage_path, 60);

      if (urlError || !urlData) {
        toast.error("Erro ao gerar link de download");
        return;
      }

      // Abrir em nova aba ou fazer download
      const link = document.createElement("a");
      link.href = urlData.signedUrl;
      link.download = doc.nome_original || doc.nome;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Download iniciado");
    } catch (error) {
      console.error("Erro ao baixar documento:", error);
      toast.error("Erro ao baixar documento");
    }
  };

  const documentNames = extractDocumentNames(content);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:p-3">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      
      {documentNames.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          {documentNames.map((name, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="gap-2 h-8 text-xs"
              onClick={() => handleDownload(name)}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="max-w-[150px] truncate">{name}</span>
              <Download className="w-3.5 h-3.5" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
