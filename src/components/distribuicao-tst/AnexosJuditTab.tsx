import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Loader2, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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

  const baixarAnexoParaIndexacao = async (att: Attachment) => {
    const { data, error } = await supabase.functions.invoke("download-anexo-judit", {
      body: {
        cnj: att.cnj || processoNumero,
        instance: att.instance || null,
        attachment_id: att.step_id,
        filename: att.attachment_name || `documento_${att.step_id}${att.extension ? `.${att.extension}` : ""}`,
      },
    });
    if (error || !data?.signed_url || data?.error) {
      throw new Error(error?.message || data?.error || "Falha ao baixar anexo");
    }
    return data as {
      signed_url: string;
      filename?: string;
      storage_path?: string;
      content_type?: string;
      file_size?: number;
    };
  };

  const extrairTextoPdfNoNavegador = async (signedUrl: string) => {
    const fileRes = await fetch(signedUrl);
    if (!fileRes.ok) throw new Error(`Falha ao abrir PDF: HTTP ${fileRes.status}`);
    const arrayBuffer = await fileRes.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      disableFontFace: true,
      useSystemFonts: false,
      isEvalSupported: false,
    } as any).promise;
    const pagesText: string[] = [];

    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const page = await pdf.getPage(i);
        try {
          const content = await page.getTextContent();
          pagesText.push(content.items.map((item: any) => item.str).join(" ").trim());
        } finally {
          try { (page as any).cleanup?.(); } catch {}
        }
      }
    } finally {
      try { await (pdf as any).destroy?.(); } catch {}
    }

    return pagesText;
  };

  const processarComIA = async () => {
    if (selected.size === 0) {
      toast.warning("Selecione ao menos um anexo.");
      return;
    }
    const lista = attachments.filter((a) => selected.has(a.step_id));
    setProcessing(true);
    try {
      // A extração pesada do PDF acontece no navegador; o Edge só grava o arquivo/texto no repositório de IA.
      const okResults: Array<{ step_id: string; documento_id?: string; pages?: number }> = [];
      const failed: Array<{ step_id: string; error?: string }> = [];
      let processoIdAcc: string | null = null;
      for (let i = 0; i < lista.length; i++) {
        const a = lista[i];
        setStage(`Baixando anexo ${i + 1}/${lista.length}…`);
        let arquivo: Awaited<ReturnType<typeof baixarAnexoParaIndexacao>> | null = null;
        let pagesText: string[] = [];
        try {
          arquivo = await baixarAnexoParaIndexacao(a);
          const isPdf = (arquivo.content_type || "").includes("pdf") || (arquivo.filename || a.attachment_name || "").toLowerCase().endsWith(".pdf");
          if (!isPdf) throw new Error("Somente anexos PDF podem ser lidos com IA nesta rotina.");
          setStage(`Lendo PDF ${i + 1}/${lista.length}…`);
          pagesText = await extrairTextoPdfNoNavegador(arquivo.signed_url);
          if (!pagesText.some((page) => page.trim())) {
            throw new Error("PDF sem texto extraível no navegador.");
          }
        } catch (e: any) {
          failed.push({ step_id: a.step_id, error: e?.message || "falha na leitura" });
          continue;
        }
        if (!arquivo) {
          failed.push({ step_id: a.step_id, error: "Arquivo não baixado" });
          continue;
        }

        // Envia em chunks de páginas (streaming) para evitar payloads grandes e timeout
        const CHUNK = 25;
        let lastResult: any = null;
        let lastDocId: string | null = null;
        let totalPagesSent = 0;
        for (let start = 0; start < pagesText.length; start += CHUNK) {
          const slice = pagesText.slice(start, start + CHUNK);
          const isFirst = start === 0;
          const isLast = start + CHUNK >= pagesText.length;
          setStage(`Gravando texto ${i + 1}/${lista.length} (${Math.min(start + CHUNK, pagesText.length)}/${pagesText.length}p)…`);
          const { data: procData, error: procErr } = await supabase.functions.invoke("processar-anexos-ia", {
            body: {
              processo_numero: processoNumero,
              processo_id: processoIdAcc,
              source_storage_path: isFirst ? arquivo.storage_path : null,
              content_type: arquivo.content_type,
              file_size: arquivo.file_size,
              pages_text: slice,
              page_offset: totalPagesSent,
              chunk_first: isFirst,
              chunk_last: isLast,
              documento_id: lastDocId,
              attachments: [{
                step_id: a.step_id,
                attachment_name: arquivo.filename || a.attachment_name,
                instance: a.instance || null,
                cnj: a.cnj || processoNumero,
                extension: a.extension || null,
              }],
            },
          });
          if (procErr || procData?.error) {
            failed.push({ step_id: a.step_id, error: procErr?.message || procData?.error });
            lastResult = null;
            break;
          }
          if (procData?.processo_id) processoIdAcc = procData.processo_id;
          const r = (procData?.results || [])[0];
          if (r?.documento_id) lastDocId = r.documento_id;
          totalPagesSent += slice.length;
          lastResult = r;
          if (!r?.ok && isLast) {
            failed.push({ step_id: a.step_id, error: r?.error || "falha" });
          }
        }
        if (lastResult?.ok) okResults.push(lastResult);
      }
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
          processo_id: processoIdAcc,
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