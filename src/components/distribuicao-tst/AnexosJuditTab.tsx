import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Loader2, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";
import { dedupeJuditAttachments, getJuditAttachmentDedupKey } from "@/lib/juditAnexosDedup";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const formatarDataAnexo = (raw?: string | null): string => {
  if (!raw) return "—";
  const s = String(raw).trim();
  // Tenta ISO ou outros formatos parseáveis
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const temHora = /\d{2}:\d{2}/.test(s);
    return temHora ? `${dd}/${mm}/${yyyy} às ${hh}:${mi}` : `${dd}/${mm}/${yyyy}`;
  }
  // Fallback: YYYY-MM-DD puro
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
};

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
  attachments: Attachment[];
  /** Dados estruturados da Judit a serem usados como camada 1 (hidratação determinística).
   *  Esses campos NÃO serão extraídos do PDF — são copiados literalmente no backend. */
  dadosJudit?: {
    dossie?: string | null;
    tribunal?: string | null;
    tipo_recurso?: string | null;
    data_distribuicao?: string | null;
    turma?: string | null;
    relator?: string | null;
    recorrentes?: string[] | null;
    situacao_processo?: string | null;
    processo_baixado?: string | null;
  } | null;
  /** Disparado quando IA conclui o preenchimento dos formulários, com os campos sugeridos. */
  onIaPreenchido?: (payload: {
    distribuicao_tst: Record<string, any>;
    dados_benner: Record<string, any>;
    resumo?: string;
  }) => void;
}

export function AnexosJuditTab({ processoNumero, attachments, dadosJudit, onIaPreenchido }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [downloadingSelected, setDownloadingSelected] = useState(false);
  const [stage, setStage] = useState<string>("");
  const uniqueAttachments = useMemo(() => dedupeJuditAttachments(attachments), [JSON.stringify(attachments)]);
  // Mantém todos os "irmãos" (mesmo documento lógico em outra instância/cnj)
  // para fallback quando a Judit retornar ATTACHMENT_NOT_FOUND no escolhido.
  const siblingsByKey = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    for (const a of attachments) {
      const key = getJuditAttachmentDedupKey(a as any);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [JSON.stringify(attachments)]);

  const allChecked = useMemo(
    () => uniqueAttachments.length > 0 && selected.size === uniqueAttachments.length,
    [uniqueAttachments.length, selected.size]
  );
  const toggle = (id: string, v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleAll = (v: boolean) => {
    setSelected(v ? new Set(uniqueAttachments.map((a) => a.step_id)) : new Set());
  };

  const baixarAnexoParaIndexacao = async (att: Attachment) => {
    const key = getJuditAttachmentDedupKey(att as any);
    const siblings = siblingsByKey.get(key) || [att];
    // Tenta o escolhido primeiro, depois irmãos com outro attachment_id/instance/cnj
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
      if (!error && data?.signed_url && !data?.error) {
        return data as {
          signed_url: string;
          filename?: string;
          storage_path?: string;
          content_type?: string;
          file_size?: number;
        };
      }
      lastErr = error?.message || data?.error || "Falha ao baixar anexo";
    }
    throw new Error(lastErr || "Falha ao baixar anexo");
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
    const lista = uniqueAttachments.filter((a) => selected.has(a.step_id));
    setProcessing(true);
    try {
      // A extração pesada do PDF acontece no navegador; o Edge só grava o arquivo/texto no repositório de IA.
      const okResults: Array<{ step_id: string; documento_id?: string; pages?: number }> = [];
      const failed: Array<{ step_id: string; error?: string }> = [];
      let processoIdAcc: string | null = null;

      // Reaproveita anexos já salvos/indexados no repositório (judit_anexos.texto_indexado=true)
      const jaIndexados = lista.filter((a) => a.texto_indexado && a.documento_id);
      const pendentesAnexos = lista.filter((a) => !(a.texto_indexado && a.documento_id));
      for (const a of jaIndexados) {
        okResults.push({ step_id: a.step_id, documento_id: a.documento_id! });
      }
      if (jaIndexados.length > 0 && pendentesAnexos.length === 0) {
        // Nenhum anexo novo para baixar — resolve processo_id direto pelo número.
        const { data: proc } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processoNumero)
          .maybeSingle();
        processoIdAcc = proc?.id || null;
      }
      if (jaIndexados.length > 0) {
        toast.info(`${jaIndexados.length} anexo(s) já indexado(s) reaproveitado(s).`);
      }


      let reaproveitadosStorage = 0;
      // Resolve/cria processo_id uma única vez para permitir paralelismo real
      if (!processoIdAcc) {
        const { data: proc } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processoNumero)
          .maybeSingle();
        if (proc?.id) {
          processoIdAcc = proc.id;
        } else {
          const { data: novo, error: novoErr } = await supabase
            .from("processos")
            .insert({ numero: processoNumero, area: "trabalhista", status: "ativo" } as any)
            .select("id")
            .single();
          if (!novoErr && novo?.id) processoIdAcc = novo.id;
        }
      }

      // Processa anexos em paralelo (limite de concorrência) — cada anexo
      // executa download → extração de PDF → gravação em chunks. Como o
      // processo_id já foi resolvido acima, não há contenção entre anexos.
      const CONCURRENCY = 3;
      let concluidos = 0;
      const total = pendentesAnexos.length;

      const processarAnexo = async (a: typeof pendentesAnexos[number], idx: number) => {
        const label = `${idx + 1}/${total}`;
        let arquivo: Awaited<ReturnType<typeof baixarAnexoParaIndexacao>> | null = null;
        let pagesText: string[] = [];
        const temNoStorage = !!a.storage_path;
        try {
          if (temNoStorage) {
            setStage(`Baixando/lendo ${label} (paralelo)…`);
            const { data: signed, error: signErr } = await supabase.storage
              .from("documentos_processos")
              .createSignedUrl(a.storage_path!, 600);
            if (signErr || !signed?.signedUrl) throw new Error("Falha ao assinar URL do storage: " + (signErr?.message || ""));
            arquivo = {
              signed_url: signed.signedUrl,
              filename: a.attachment_name || `documento_${a.step_id}.pdf`,
              storage_path: a.storage_path!,
              content_type: "application/pdf",
              file_size: 0,
            };
            reaproveitadosStorage++;
          } else {
            setStage(`Baixando/lendo ${label} (paralelo)…`);
            arquivo = await baixarAnexoParaIndexacao(a);
          }
          const isPdf = (arquivo.content_type || "").includes("pdf") || (arquivo.filename || a.attachment_name || "").toLowerCase().endsWith(".pdf");
          if (!isPdf) throw new Error("Somente anexos PDF podem ser lidos com IA nesta rotina.");
          pagesText = await extrairTextoPdfNoNavegador(arquivo.signed_url);
          if (!pagesText.some((page) => page.trim())) {
            throw new Error("PDF sem texto extraível no navegador.");
          }
        } catch (e: any) {
          failed.push({ step_id: a.step_id, error: e?.message || "falha na leitura" });
          concluidos++;
          return;
        }
        if (!arquivo) {
          failed.push({ step_id: a.step_id, error: "Arquivo não baixado" });
          concluidos++;
          return;
        }

        // Envia em chunks de páginas (streaming) para evitar payloads grandes e timeout.
        // Chunks dentro do mesmo anexo precisam ser sequenciais (compartilham documento_id).
        const CHUNK = 50;
        let lastResult: any = null;
        let lastDocId: string | null = null;
        let totalPagesSent = 0;
        for (let start = 0; start < pagesText.length; start += CHUNK) {
          const slice = pagesText.slice(start, start + CHUNK);
          const isFirst = start === 0;
          const isLast = start + CHUNK >= pagesText.length;
          setStage(`Gravando ${label} (${Math.min(start + CHUNK, pagesText.length)}/${pagesText.length}p)…`);
          const { data: procData, error: procErr } = await supabase.functions.invoke("processar-anexos-ia", {
            body: {
              processo_numero: processoNumero,
              processo_id: processoIdAcc,
              source_storage_path: isFirst ? arquivo!.storage_path : null,
              content_type: arquivo!.content_type,
              file_size: arquivo!.file_size,
              pages_text: slice,
              page_offset: totalPagesSent,
              chunk_first: isFirst,
              chunk_last: isLast,
              documento_id: lastDocId,
              attachments: [{
                step_id: a.step_id,
                attachment_name: arquivo!.filename || a.attachment_name,
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
        concluidos++;
        setStage(`Processados ${concluidos}/${total}…`);
      };

      // Pool de workers paralelos
      let cursor = 0;
      const workers: Promise<void>[] = [];
      for (let w = 0; w < Math.min(CONCURRENCY, pendentesAnexos.length); w++) {
        workers.push((async () => {
          while (true) {
            const idx = cursor++;
            if (idx >= pendentesAnexos.length) return;
            await processarAnexo(pendentesAnexos[idx], idx);
          }
        })());
      }
      await Promise.all(workers);
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
      const { data: bennerAtual } = await supabase
        .from("dados_benner" as any)
        .select("dossie, tribunal, tipo_recurso, data_distribuicao, turma, relator, recorrente, situacao_processo, processo_baixado")
        .eq("processo", processoNumero)
        .maybeSingle();
      const dadosJuditAtualizados = {
        ...(dadosJudit || {}),
        dossie: (bennerAtual as any)?.dossie || dadosJudit?.dossie || null,
        tribunal: (bennerAtual as any)?.tribunal || dadosJudit?.tribunal || null,
        tipo_recurso: (bennerAtual as any)?.tipo_recurso || dadosJudit?.tipo_recurso || null,
        data_distribuicao: (bennerAtual as any)?.data_distribuicao || dadosJudit?.data_distribuicao || null,
        turma: (bennerAtual as any)?.turma || dadosJudit?.turma || null,
        relator: (bennerAtual as any)?.relator || dadosJudit?.relator || null,
        recorrentes: (bennerAtual as any)?.recorrente
          ? String((bennerAtual as any).recorrente).split(/[,;]/).map((s) => s.trim()).filter(Boolean)
          : dadosJudit?.recorrentes || null,
        situacao_processo: (bennerAtual as any)?.situacao_processo || dadosJudit?.situacao_processo || null,
        processo_baixado: (bennerAtual as any)?.processo_baixado || dadosJudit?.processo_baixado || null,
      };
      const documentoIdsExtracao = okResults.map((r: any) => r.documento_id).filter(Boolean);
      // Roda em paralelo: extração principal + análise específica do quarteirizado.
      const [iaResp, quartResp] = await Promise.all([
        supabase.functions.invoke("preencher-form-ia-anexos", {
          body: {
            processo_id: processoIdAcc,
            processo_numero: processoNumero,
            documento_ids: documentoIdsExtracao,
            dados_judit: dadosJuditAtualizados,
          },
        }),
        supabase.functions.invoke("analise-quarteirizado-ia", {
          body: {
            processo_id: processoIdAcc,
            processo_numero: processoNumero,
            documento_ids: documentoIdsExtracao,
          },
        }),
      ]);
      const { data: iaData, error: iaErr } = iaResp as any;
      if (iaErr || iaData?.error) {
        throw new Error(iaErr?.message || iaData?.error || "Falha na análise IA");
      }
      const quartData: any = (quartResp as any)?.data || null;
      const quartErr: any = (quartResp as any)?.error || null;
      if (quartErr) console.warn("[Quarteirizado IA] erro:", quartErr);
      if (quartData?.analise_quarteirizado) {
        iaData.dados_benner = iaData.dados_benner || {};
        iaData.dados_benner.analise_quarteirizado = quartData.analise_quarteirizado;
      } else if (quartData?.skipped) {
        console.info("[Quarteirizado IA] pulado:", quartData.motivo);
      }
      console.log("[IA Anexos] quarteirizado:", {
        len: (quartData?.analise_quarteirizado || "").length,
        preview: (quartData?.analise_quarteirizado || "").slice(0, 120),
        confianca: quartData?.confianca,
        skipped: quartData?.skipped,
        motivo: quartData?.motivo,
        merged_in_benner: iaData?.dados_benner?.analise_quarteirizado?.slice?.(0, 80),
      });
      const distQ = Object.keys(iaData?.distribuicao_tst || {}).length;
      const benQ = Object.keys(iaData?.dados_benner || {}).length;
      const distKeys = Object.keys(iaData?.distribuicao_tst || {});
      const benKeys = Object.keys(iaData?.dados_benner || {});
      const alertas: string[] = Array.isArray(iaData?.alertas) ? iaData.alertas : [];
      const pendentes: string[] = Array.isArray(iaData?.pendentes) ? iaData.pendentes : [];
      const juditAplicado: string[] = Array.isArray(iaData?.judit_aplicado) ? iaData.judit_aplicado : [];
      const quartInfo = quartData?.analise_quarteirizado
        ? `Análise Quarteirizado preenchida (confiança: ${quartData.confianca || "—"}).`
        : quartData?.skipped
          ? `Quarteirizado: ${quartData.motivo}`
          : "";
      const resumoLinhas: string[] = [
        `IA preencheu ${distQ} campo(s) em Distribuição TST e ${benQ} em Dados Benner.`,
        juditAplicado.length ? `Judit (camada 1): ${juditAplicado.join(", ")}` : "",
        distKeys.length ? `Distribuição: ${distKeys.join(", ")}` : "",
        benKeys.length ? `Benner: ${benKeys.join(", ")}` : "",
        quartInfo,
        pendentes.length ? `⚠ Revisar: ${pendentes.join(", ")}` : "",
        alertas.length ? `Alertas: ${alertas.join(" | ")}` : "",
      ].filter(Boolean);
      const resumoIa = `[IA ${new Date().toLocaleString("pt-BR")}]\n${resumoLinhas.join("\n")}`;
      onIaPreenchido?.({
        distribuicao_tst: iaData?.distribuicao_tst || {},
        dados_benner: iaData?.dados_benner || {},
        resumo: resumoIa,
      });
      console.log("[IA Anexos] Resultado:", {
        distribuicao_tst: iaData?.distribuicao_tst,
        dados_benner: iaData?.dados_benner,
        alertas, pendentes, judit_aplicado: juditAplicado,
        evidencias: iaData?.evidencias,
      });
      toast.success(
        `IA preencheu ${distQ} campo(s) em Distribuição TST e ${benQ} em Dados Benner.`,
        {
          description: [
            juditAplicado.length ? `Judit (camada 1): ${juditAplicado.join(", ")}` : null,
            distKeys.length ? `Distribuição: ${distKeys.join(", ")}` : null,
            benKeys.length ? `Benner: ${benKeys.join(", ")}` : null,
            pendentes.length ? `⚠ Revisar: ${pendentes.slice(0, 6).join(", ")}${pendentes.length > 6 ? ` (+${pendentes.length - 6})` : ""}` : null,
          ].filter(Boolean).join(" • "),
        }
      );
      if (alertas.length > 0) {
        for (const a of alertas.slice(0, 3)) toast.warning(a);
        if (alertas.length > 3) toast.warning(`+${alertas.length - 3} alerta(s) — veja console.`);
      }
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
      let data: any = null;
      let lastErr = "";
      const key = getJuditAttachmentDedupKey(att as any);
      const siblings = siblingsByKey.get(key) || [att];
      const ordered = [att, ...siblings.filter((s) => s.step_id !== att.step_id)];
      for (const cand of ordered) {
        const { data: d, error } = await supabase.functions.invoke("download-anexo-judit", {
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
        if (!error && d?.signed_url && !d?.error) { data = d; break; }
        lastErr = error?.message || d?.error || "desconhecido";
      }
      if (!data?.signed_url) {
        toast.error("Erro ao baixar anexo: " + lastErr);
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

  const handleDownloadSelecionados = async () => {
    if (selected.size === 0) {
      toast.warning("Selecione ao menos um anexo.");
      return;
    }
    const lista = uniqueAttachments.filter((a) => selected.has(a.step_id));
    setDownloadingSelected(true);
    let ok = 0;
    let fail = 0;
    try {
      for (let i = 0; i < lista.length; i++) {
        const att = lista[i];
        setStage(`Baixando ${i + 1}/${lista.length}…`);
        try {
          let data: any = null;
          let lastErr = "";
          const key = getJuditAttachmentDedupKey(att as any);
          const siblings = siblingsByKey.get(key) || [att];
          const ordered = [att, ...siblings.filter((s) => s.step_id !== att.step_id)];
          // Reaproveita storage quando disponível
          if (att.storage_path) {
            const { data: signed } = await supabase.storage
              .from("documentos_processos")
              .createSignedUrl(att.storage_path, 600);
            if (signed?.signedUrl) {
              data = { signed_url: signed.signedUrl, filename: att.attachment_name || `documento_${att.step_id}` };
            }
          }
          if (!data?.signed_url) {
            for (const cand of ordered) {
              const { data: d, error } = await supabase.functions.invoke("download-anexo-judit", {
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
              if (!error && d?.signed_url && !d?.error) { data = d; break; }
              lastErr = error?.message || d?.error || "desconhecido";
            }
          }
          if (!data?.signed_url) throw new Error(lastErr || "sem URL");
          const fileRes = await fetch(data.signed_url);
          if (!fileRes.ok) throw new Error("HTTP " + fileRes.status);
          const blob = await fileRes.blob();
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = data.filename || att.attachment_name || `documento_${att.step_id}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(objectUrl);
          ok++;
          // Pequeno respiro para o browser não bloquear múltiplos downloads
          await new Promise((r) => setTimeout(r, 300));
        } catch (e: any) {
          console.warn("Falha ao baixar anexo", att.step_id, e);
          fail++;
        }
      }
      if (ok > 0) toast.success(`${ok} anexo(s) baixado(s).`);
      if (fail > 0) toast.warning(`${fail} anexo(s) falharam.`);
    } finally {
      setDownloadingSelected(false);
      setStage("");
    }
  };

  if (!uniqueAttachments.length) {
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadSelecionados}
            disabled={processing || downloadingSelected || selected.size === 0}
          >
            {downloadingSelected ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {stage || "Baixando…"}</>
            ) : (
              <><Download className="w-4 h-4 mr-2" /> Baixar selecionados</>
            )}
          </Button>
          <Button
            size="sm"
            onClick={processarComIA}
            disabled={processing || downloadingSelected || selected.size === 0}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {processing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {stage || "Processando…"}</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Ler com IA &amp; preencher</>
            )}
          </Button>
        </div>
      </div>
      {uniqueAttachments.map((att) => (
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
                {formatarDataAnexo(att.attachment_date)}{att.extension ? ` · .${att.extension}` : ""}
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