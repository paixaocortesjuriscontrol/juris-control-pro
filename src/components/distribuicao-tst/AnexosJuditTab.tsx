import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Loader2, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Attachment {
  step_id: string;
  attachment_name: string | null;
  attachment_date: string | null;
  extension: string | null;
  instance?: string | null;
  cnj?: string | null;
  texto_indexado?: boolean | null;
  documento_id?: string | null;
}

interface Props {
  processoNumero: string;
  attachments: Attachment[];
  /** Disparado quando IA conclui o preenchimento dos formulários, com os campos sugeridos. */
  onIaPreenchido?: (payload: {
    distribuicao_tst: Record<string, any>;
    dados_benner: Record<string, any>;
  }) => void;
}

export function AnexosJuditTab({ processoNumero, attachments, onIaPreenchido }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [stage, setStage] = useState<string>("");

  const allChecked = useMemo(
    () => attachments.length > 0 && selected.size === attachments.length,
    [attachments.length, selected.size]
  );
  const toggle = (id: string, v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleAll = (v: boolean) => {
    setSelected(v ? new Set(attachments.map((a) => a.step_id)) : new Set());
  };

  const processarComIA = async () => {
    if (selected.size === 0) {
      toast.warning("Selecione ao menos um anexo.");
      return;
    }
    const lista = attachments.filter((a) => selected.has(a.step_id));
    setProcessing(true);
    try {
      setStage(`Baixando e indexando ${lista.length} anexo(s)…`);
      const { data: procData, error: procErr } = await supabase.functions.invoke("processar-anexos-ia", {
        body: {
          processo_numero: processoNumero,
          attachments: lista.map((a) => ({
            step_id: a.step_id,
            attachment_name: a.attachment_name,
            instance: a.instance || null,
            cnj: a.cnj || processoNumero,
            extension: a.extension || null,
          })),
        },
      });
      if (procErr || procData?.error) {
        throw new Error(procErr?.message || procData?.error || "Falha ao processar anexos");
      }
      const okResults = (procData?.results || []).filter((r: any) => r.ok);
      const failed = (procData?.results || []).filter((r: any) => !r.ok);
      if (failed.length > 0) {
        console.warn("Anexos com falha:", failed);
        toast.warning(`${failed.length} anexo(s) falharam ao indexar.`);
      }
      if (okResults.length === 0) {
        toast.error("Nenhum anexo pôde ser indexado.");
        return;
      }
      toast.success(`${okResults.length} anexo(s) indexado(s) no repositório de IA.`);

      setStage("Analisando peças com IA…");
      const { data: iaData, error: iaErr } = await supabase.functions.invoke("preencher-form-ia-anexos", {
        body: {
          processo_id: procData?.processo_id || null,
          processo_numero: processoNumero,
          documento_ids: okResults.map((r: any) => r.documento_id).filter(Boolean),
        },
      });
      if (iaErr || iaData?.error) {
        throw new Error(iaErr?.message || iaData?.error || "Falha na análise IA");
      }
      const distQ = Object.keys(iaData?.distribuicao_tst || {}).length;
      const benQ = Object.keys(iaData?.dados_benner || {}).length;
      onIaPreenchido?.({
        distribuicao_tst: iaData?.distribuicao_tst || {},
        dados_benner: iaData?.dados_benner || {},
      });
      toast.success(`IA preencheu ${distQ} campo(s) em Distribuição TST e ${benQ} em Dados Benner.`);
      setSelected(new Set());
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || "erro"));
    } finally {
      setProcessing(false);
      setStage("");
    }
  };

  const handleDownload = async (att: Attachment) => {
    setDownloadingId(att.step_id);
    try {
      const { data, error } = await supabase.functions.invoke("download-anexo-judit", {
        body: {
          cnj: att.cnj || processoNumero,
          instance: att.instance || null,
          attachment_id: att.step_id,
          filename: att.attachment_name || `documento_${att.step_id}${att.extension ? `.${att.extension}` : ""}`,
        },
      });
      if (error || !data?.signed_url) {
        toast.error("Erro ao baixar anexo: " + (error?.message || data?.error || "desconhecido"));
        return;
      }
      const fileRes = await fetch(data.signed_url);
      if (!fileRes.ok) {
        toast.error("Erro ao baixar anexo: HTTP " + fileRes.status);
        return;
      }
      const blob = await fileRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = data.filename || att.attachment_name || `documento_${att.step_id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
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
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAll(v === true)} disabled={processing} />
          <span className="text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selecionado(s)` : "Selecionar todos"}
          </span>
        </label>
        <Button
          size="sm"
          onClick={processarComIA}
          disabled={processing || selected.size === 0}
          className="bg-sky-600 hover:bg-sky-700 text-white"
        >
          {processing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {stage || "Processando…"}</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Ler com IA &amp; preencher</>
          )}
        </Button>
      </div>
      {attachments.map((att) => (
        <div key={att.step_id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-md hover:bg-muted/50">
          <div className="flex items-center gap-3 min-w-0">
            <Checkbox
              checked={selected.has(att.step_id)}
              onCheckedChange={(v) => toggle(att.step_id, v === true)}
              disabled={processing}
            />
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-2">
                {att.attachment_name || `documento_${att.step_id}`}
                {att.texto_indexado && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> indexado
                  </span>
                )}
              </p>
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