import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "@/integrations/supabase/client";
import { usePromptsIaTst } from "@/hooks/usePromptsIaTst";
import { dedupeJuditAttachments, getJuditAttachmentDedupKey } from "@/lib/juditAnexosDedup";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Attachment {
  step_id: string;
  attachment_id?: string | null;
  attachment_name: string | null;
  attachment_date: string | null;
  extension: string | null;
  instance?: string | null;
  cnj?: string | null;
  texto_indexado?: boolean | null;
  documento_id?: string | null;
  storage_path?: string | null;
}

interface Props {
  processoNumero: string;
  processoId?: string | null;
  attachments: Attachment[];
  onIaPreenchido?: (payload: {
    distribuicao_tst: Record<string, any>;
    dados_benner: Record<string, any>;
    resumo?: string;
  }) => Promise<void> | void;
}

const formatarDataAnexo = (raw?: string | null): string => {
  if (!raw) return "—";
  const s = String(raw).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  return s;
};

/**
 * Aba "Analisar com IA":
 *  1) Advogado escolhe um Prompt IA TST cadastrado em /prompts-ia-tst
 *  2) Marca anexos retornados pela Judit
 *  3) Sistema indexa anexos novos (texto via pdf.js no navegador) e chama a
 *     edge function `analisar-tst-prompt-ia` que aplica o prompt customizado.
 *  4) Sugestões aparecem como preenchimento azul nos formulários (mesma prop
 *     `iaSugestao` já consumida por DistribuicaoTstForm/DadosBennerForm).
 */
export function AnalisarComIATab({ processoNumero, processoId, attachments, onIaPreenchido }: Props) {
  const { data: prompts = [], isLoading: loadingPrompts } = usePromptsIaTst({ somenteAtivos: true });
  const [promptId, setPromptId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [stage, setStage] = useState("");

  const uniqueAttachments = useMemo(() => dedupeJuditAttachments(attachments || []), [JSON.stringify(attachments)]);
  const uidOf = (a: Attachment) => getJuditAttachmentDedupKey(a as any);
  const siblingsByKey = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    for (const a of attachments || []) {
      const key = getJuditAttachmentDedupKey(a as any);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [JSON.stringify(attachments)]);

  const allChecked = uniqueAttachments.length > 0 && selected.size === uniqueAttachments.length;
  const someChecked = selected.size > 0 && !allChecked;
  const toggle = (id: string, v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleAll = (v: boolean) => setSelected(v ? new Set(uniqueAttachments.map(uidOf)) : new Set());

  const baixarAnexo = async (att: Attachment) => {
    const key = getJuditAttachmentDedupKey(att as any);
    const siblings = siblingsByKey.get(key) || [att];
    const ordered = [att, ...siblings.filter((s) => s.step_id !== att.step_id)];
    let lastErr = "";
    for (const cand of ordered) {
      const { data, error } = await supabase.functions.invoke("download-anexo-judit", {
        body: {
          cnj: cand.cnj || processoNumero,
          instance: cand.instance || null,
          attachment_id: cand.attachment_id || cand.step_id,
          attachment_name: cand.attachment_name || null,
          attachment_date: cand.attachment_date || null,
          extension: cand.extension || null,
          filename: cand.attachment_name || `documento_${cand.step_id}${cand.extension ? `.${cand.extension}` : ""}`,
        },
      });
      if (!error && data?.signed_url && !data?.error) return data as any;
      lastErr = (error as any)?.message || data?.error || "falha";
    }
    throw new Error(lastErr || "Falha ao baixar anexo");
  };

  const extrairTextoPdf = async (signedUrl: string) => {
    const res = await fetch(signedUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf, disableFontFace: true, useSystemFonts: false, isEvalSupported: false } as any).promise;
    const pages: string[] = [];
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const page = await pdf.getPage(i);
        try {
          const content = await page.getTextContent();
          pages.push(content.items.map((it: any) => it.str).join(" ").trim());
        } finally {
          try { (page as any).cleanup?.(); } catch {}
        }
      }
    } finally {
      try { await (pdf as any).destroy?.(); } catch {}
    }
    return pages;
  };

  const indexarAnexo = async (att: Attachment, pidAcc: string | null): Promise<{ documento_id: string | null; processo_id: string | null }> => {
    let arquivo: any;
    if (att.storage_path) {
      const { data: signed } = await supabase.storage.from("documentos_processos").createSignedUrl(att.storage_path, 600);
      if (!signed?.signedUrl) throw new Error("Storage sem URL");
      arquivo = { signed_url: signed.signedUrl, filename: att.attachment_name || `doc_${att.step_id}.pdf`, storage_path: att.storage_path, content_type: "application/pdf", file_size: 0 };
    } else {
      arquivo = await baixarAnexo(att);
    }
    const pages = await extrairTextoPdf(arquivo.signed_url);
    if (!pages.some((p) => p.trim())) throw new Error("Sem texto extraível");
    const CHUNK = 50;
    let documentoId: string | null = null;
    let processoId: string | null = pidAcc;
    let totalSent = 0;
    for (let start = 0; start < pages.length; start += CHUNK) {
      const slice = pages.slice(start, start + CHUNK);
      const isFirst = start === 0;
      const isLast = start + CHUNK >= pages.length;
      const { data: r, error } = await supabase.functions.invoke("processar-anexos-ia", {
        body: {
          processo_numero: processoNumero,
          processo_id: processoId,
          source_storage_path: isFirst ? arquivo.storage_path : null,
          content_type: arquivo.content_type,
          file_size: arquivo.file_size,
          pages_text: slice,
          page_offset: totalSent,
          chunk_first: isFirst,
          chunk_last: isLast,
          documento_id: documentoId,
          attachments: [{
            step_id: att.step_id,
            attachment_name: arquivo.filename || att.attachment_name,
            instance: att.instance || null,
            cnj: att.cnj || processoNumero,
            extension: att.extension || null,
          }],
        },
      });
      if (error || (r as any)?.error) throw new Error((error as any)?.message || (r as any)?.error || "falha");
      const result = ((r as any)?.results || [])[0];
      if (result?.documento_id) documentoId = result.documento_id;
      if ((r as any)?.processo_id) processoId = (r as any).processo_id;
      totalSent += slice.length;
    }
    return { documento_id: documentoId, processo_id: processoId };
  };

  const analisar = async () => {
    if (!promptId) {
      toast.warning("Escolha um prompt.");
      return;
    }
    if (selected.size === 0) {
      toast.warning("Selecione ao menos um anexo.");
      return;
    }
    setProcessing(true);
    try {
      // Resolve processo_id
      let pid: string | null = processoId || null;
      if (!pid) {
        const { data: proc } = await supabase.from("processos").select("id").eq("numero", processoNumero).maybeSingle();
        pid = proc?.id || null;
        if (!pid) {
          const { data: novo } = await supabase.from("processos").insert({ numero: processoNumero, area: "trabalhista", status: "ativo" } as any).select("id").single();
          pid = novo?.id || null;
        }
      }

      const lista = uniqueAttachments.filter((a) => selected.has(uidOf(a)));
      const documentoIds: string[] = [];
      const falhas: { nome: string; motivo: string }[] = [];
      let idx = 0;
      for (const att of lista) {
        idx++;
        if (att.texto_indexado && att.documento_id) {
          documentoIds.push(att.documento_id);
          continue;
        }
        setStage(`Indexando anexo ${idx}/${lista.length}…`);
        try {
          const r = await indexarAnexo(att, pid);
          if (r.documento_id) documentoIds.push(r.documento_id);
          if (r.processo_id) pid = r.processo_id;
          else falhas.push({ nome: att.attachment_name || att.step_id, motivo: "sem documento_id retornado" });
        } catch (e: any) {
          const motivo = e?.message || String(e);
          console.warn("Falha ao indexar", att.step_id, motivo, e);
          falhas.push({ nome: att.attachment_name || att.step_id, motivo });
        }
      }
      if (documentoIds.length === 0) {
        const primeiras = falhas.slice(0, 3).map((f) => `• ${f.nome}: ${f.motivo}`).join("\n");
        toast.error("Nenhum anexo pôde ser indexado.", {
          description: primeiras || "Verifique se o JUDIT_API_KEY está configurado e se os PDFs têm texto extraível.",
          duration: 15000,
        });
        return;
      }
      if (falhas.length > 0) {
        toast.warning(`${falhas.length} anexo(s) não indexado(s)`, {
          description: falhas.slice(0, 3).map((f) => `${f.nome}: ${f.motivo}`).join(" | "),
          duration: 10000,
        });
      }

      setStage("Analisando com IA…");
      const { data, error } = await supabase.functions.invoke("analisar-tst-prompt-ia", {
        body: {
          prompt_id: promptId,
          processo_id: pid,
          processo_numero: processoNumero,
          documento_ids: documentoIds,
        },
      });
      if (error || (data as any)?.error) {
        throw new Error((error as any)?.message || (data as any)?.error || "Falha na IA");
      }
      const dist = (data as any)?.distribuicao_tst || {};
      const ben = (data as any)?.dados_benner || {};
      const resumo = (data as any)?.resumo || "";
      const alertas: string[] = Array.isArray((data as any)?.alertas) ? (data as any).alertas : [];
      const distQ = Object.keys(dist).length;
      const benQ = Object.keys(ben).length;
      const promptTitulo = (data as any)?.prompt_titulo || "prompt";
      const resumoFinal = `[IA "${promptTitulo}" · ${new Date().toLocaleString("pt-BR")}]\n${resumo || `${distQ} campo(s) Distribuição + ${benQ} campo(s) Benner.`}${alertas.length ? `\nAlertas: ${alertas.join(" | ")}` : ""}`;
      await onIaPreenchido?.({ distribuicao_tst: dist, dados_benner: ben, resumo: resumoFinal });
      toast.success(`IA sugeriu ${distQ + benQ} campo(s).`, {
        description: [
          distQ ? `Distribuição: ${Object.keys(dist).join(", ")}` : null,
          benQ ? `Benner: ${Object.keys(ben).join(", ")}` : null,
        ].filter(Boolean).join(" • ") || undefined,
      });
      if (alertas.length) for (const a of alertas.slice(0, 3)) toast.warning(a);
      setSelected(new Set());
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || "erro"));
    } finally {
      setProcessing(false);
      setStage("");
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" /> Prompt IA TST
          </Label>
          {loadingPrompts ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Carregando prompts…
            </div>
          ) : prompts.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md p-3">
              Nenhum prompt cadastrado. Vá em <strong>Prompt IA TST</strong> no menu lateral para cadastrar.
            </div>
          ) : (
            <Select value={promptId} onValueChange={setPromptId}>
              <SelectTrigger><SelectValue placeholder="Selecione o prompt a aplicar…" /></SelectTrigger>
              <SelectContent>
                {prompts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.titulo} <span className="text-xs text-muted-foreground ml-2">({p.modelo})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {uniqueAttachments.length === 0 ? (
          <div className="border border-dashed rounded-md p-4 text-sm text-muted-foreground text-center">
            Nenhum anexo carregado. Use o botão <strong>Buscar Judit (com anexos)</strong> na lateral para carregar os documentos do processo.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox
                  checked={allChecked ? true : someChecked ? "indeterminate" : false}
                  onCheckedChange={() => toggleAll(!allChecked)}
                  disabled={processing}
                />
                <span className="text-muted-foreground">
                  {selected.size > 0
                    ? `${selected.size} de ${uniqueAttachments.length} selecionado(s)`
                    : "Selecionar todos"}
                </span>
              </label>
              <Button
                size="sm"
                onClick={analisar}
                disabled={processing || !promptId || selected.size === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {stage || "Processando…"}</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Analisar com IA</>
                )}
              </Button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {uniqueAttachments.map((att) => (
                <div
                  key={uidOf(att)}
                  className="flex items-center gap-3 p-2.5 border border-border rounded-md hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selected.has(uidOf(att))}
                    onCheckedChange={(v) => toggle(uidOf(att), v === true)}
                    disabled={processing}
                  />
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      {att.attachment_name || `documento_${att.step_id}`}
                      {att.texto_indexado && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> indexado
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatarDataAnexo(att.attachment_date)}
                      {att.extension ? ` · .${att.extension}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}