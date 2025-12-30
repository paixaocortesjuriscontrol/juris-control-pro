import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Download, FileText, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface MarkdownMessageProps {
  content: string;
  className?: string;
  showCopyButton?: boolean;
}

// UUID pattern
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Patterns para detectar referências a documentos
const documentPatterns = [
  // Menções diretas com aspas
  /documento[s]?\s*["']([^"']+)["']/gi,
  /arquivo[s]?\s*["']([^"']+)["']/gi,
  // Arquivos com extensão em negrito ou aspas
  /\*\*([^*]+\.(?:pdf|docx?|xlsx?|txt|pptx?|odt|rtf))\*\*/gi,
  /["']([^"']+\.(?:pdf|docx?|xlsx?|txt|pptx?|odt|rtf))["']/gi,
  // Menções em markdown links
  /\[([^\]]+\.(?:pdf|docx?|xlsx?|txt|pptx?|odt|rtf))\]/gi,
  // Nomes de documentos após "chamado" ou "intitulado"
  /(?:chamado|intitulado|denominado|nomeado)\s+["']?([^"'\n,]+)["']?/gi,
  // Referências ao repositório
  /repositório[:\s]+["']?([^"'\n,]+)["']?/gi,
  // Nomes após "documento" sem aspas mas com extensão
  /documento\s+(\S+\.(?:pdf|docx?|xlsx?|txt|pptx?|odt|rtf))/gi,
];

type DocumentRef = {
  name: string;
  id?: string;
};

export function MarkdownMessage({ content, className, showCopyButton = true }: MarkdownMessageProps) {
  const [copied, setCopied] = useState(false);

  const extractDocumentReferences = (text: string): DocumentRef[] => {
    const refs = new Map<string, DocumentRef>();
    
    // Extrair UUIDs (IDs de documentos)
    let uuidMatch;
    const uuidRegex = new RegExp(uuidPattern.source, uuidPattern.flags);
    while ((uuidMatch = uuidRegex.exec(text)) !== null) {
      const id = uuidMatch[0];
      refs.set(`id:${id}`, { name: id, id });
    }
    
    // Extrair nomes de documentos pelos padrões
    documentPatterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const name = match[1].trim();
          // Ignorar se for muito curto ou muito genérico
          if (name.length > 3 && !['pdf', 'doc', 'txt'].includes(name.toLowerCase())) {
            refs.set(`name:${name.toLowerCase()}`, { name });
          }
        }
      }
    });
    
    return Array.from(refs.values());
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copiado para a área de transferência");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar texto");
    }
  };

  const handleDownload = async (ref: DocumentRef) => {
    try {
      let query = supabase
        .from("repositorio_documentos")
        .select("id, nome, nome_original, storage_path");
      
      // Buscar por ID ou por nome
      if (ref.id) {
        query = query.eq("id", ref.id);
      } else {
        query = query.or(`nome.ilike.%${ref.name}%,nome_original.ilike.%${ref.name}%`);
      }
      
      const { data: docs, error: searchError } = await query.limit(1);

      if (searchError || !docs || docs.length === 0) {
        toast.error("Documento não encontrado no repositório");
        return;
      }

      const doc = docs[0];
      
      // Gerar URL de download
      const { data: urlData, error: urlError } = await supabase.storage
        .from("repositorio_documentos")
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

  const documentRefs = extractDocumentReferences(content);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:p-3">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {showCopyButton && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-500" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copiar
              </>
            )}
          </Button>
        )}
        
        {documentRefs.length > 0 && (
          <>
            <div className="w-px h-4 bg-border" />
            {documentRefs.map((ref, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={() => handleDownload(ref)}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">
                  {ref.id ? `ID: ${ref.id.substring(0, 8)}...` : ref.name}
                </span>
                <Download className="w-3.5 h-3.5" />
              </Button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
