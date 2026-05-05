import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Attachment {
  step_id: string;
  attachment_name: string | null;
  attachment_date: string | null;
  extension: string | null;
  instance?: string | null;
  cnj?: string | null;
}

interface Props {
  processoNumero: string;
  attachments: Attachment[];
}

export function AnexosJuditTab({ processoNumero, attachments }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (att: Attachment) => {
    setDownloadingId(att.step_id);
    try {
      const { data, error } = await supabase.functions.invoke("download-anexo-judit", {
        body: {
          cnj: att.cnj || processoNumero,
          instance: att.instance || null,
          attachment_id: att.step_id,
        },
      });
      if (error || !data?.signed_url) {
        toast.error("Erro ao baixar anexo: " + (error?.message || data?.error || "desconhecido"));
        return;
      }
      const a = document.createElement("a");
      a.href = data.signed_url;
      a.download = att.attachment_name || `documento_${att.step_id}`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      toast.error("Falha ao baixar: " + (e?.message || "erro"));
    } finally {
      setDownloadingId(null);
    }
  };

  if (!attachments.length) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        Nenhum anexo carregado. Use o botão Judit → "Buscar com anexos".
      </CardContent></Card>
    );
  }

  return (
    <Card><CardContent className="p-4 space-y-2">
      {attachments.map((att) => (
        <div key={att.step_id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-md hover:bg-muted/50">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{att.attachment_name || `documento_${att.step_id}`}</p>
              <p className="text-xs text-muted-foreground">
                {att.attachment_date || "—"} {att.extension ? ` · .${att.extension}` : ""}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => handleDownload(att)} disabled={downloadingId === att.step_id}>
            {downloadingId === att.step_id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download
          </Button>
        </div>
      ))}
    </CardContent></Card>
  );
}