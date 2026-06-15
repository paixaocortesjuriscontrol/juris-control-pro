import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUDIT_LAWSUITS = "https://lawsuits.production.judit.io";
const BUCKET = "documentos_processos";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AttIn {
  step_id: string;
  attachment_name?: string | null;
  attachment_date?: string | null;
  instance?: string | null;
  cnj?: string | null;
  extension?: string | null;
  source_storage_path?: string | null;
  content_type?: string | null;
  file_size?: number | null;
  pages_text?: string[] | null;
}

function safeFileName(rawName: string, fallback: string) {
  return rawName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

function normalizePages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").replace(/\u0000/g, "").trim())
    .filter(Boolean);
}

function normalizeAttachmentName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s*\(C[ÓO]PIA\)\s*/gi, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, "")
    .toUpperCase();
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    console.log("[processar-anexos-ia] start", { method: req.method });
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Token inválido" }, 401);

    const juditApiKey = Deno.env.get("JUDIT_API_KEY");
    if (!juditApiKey) return json({ error: "JUDIT_API_KEY não configurada" }, 500);

    const body = await req.json();
    console.log("[processar-anexos-ia] body keys", Object.keys(body || {}), {
      processo_id: body?.processo_id,
      attachments: Array.isArray(body?.attachments) ? body.attachments.length : 0,
      pages_text: Array.isArray(body?.pages_text) ? body.pages_text.length : 0,
      chunk_first: body?.chunk_first,
      chunk_last: body?.chunk_last,
      page_offset: body?.page_offset,
      documento_id: body?.documento_id,
    });
    const processoId: string = String(body?.processo_id || "").trim();
    const attachments: AttIn[] = Array.isArray(body?.attachments) ? body.attachments : [];
    const topLevelPages = normalizePages(body?.pages_text);
    const topLevelSourcePath = body?.source_storage_path ? String(body.source_storage_path) : null;
    const topLevelContentType = body?.content_type ? String(body.content_type) : null;
    const topLevelFileSize = Number(body?.file_size || 0) || null;
    const chunkFirst: boolean = body?.chunk_first !== false; // default true (compat)
    const chunkLast: boolean = body?.chunk_last !== false;   // default true (compat)
    const pageOffset: number = Math.max(0, Number(body?.page_offset || 0) | 0);
    const incomingDocId: string | null = body?.documento_id ? String(body.documento_id) : null;

    if (!processoId || attachments.length === 0) {
      return json({ error: "processo_id e attachments são obrigatórios" }, 400);
    }

    const { data: proc } = await supabase
      .from("processos")
      .select("id, numero")
      .eq("id", processoId)
      .maybeSingle();
    if (!proc?.id) return json({ error: "Processo não encontrado pelo id" }, 404);
    const processoNumero: string = String((proc as any).numero || "").trim();
    console.log("[processar-anexos-ia] processo_id validado", processoId);

    const results: Array<{ step_id: string; ok: boolean; pages?: number; error?: string; documento_id?: string }> = [];

    for (const att of attachments) {
      const stepId = String(att.step_id || "");
      if (!stepId) {
        results.push({ step_id: stepId, ok: false, error: "step_id ausente" });
        continue;
      }

      try {
        const rawName = String(att.attachment_name || `documento_${stepId}.${att.extension || "pdf"}`);
        const safeName = safeFileName(rawName, `documento_${stepId}.pdf`);
        const storagePath = `${processoId}/judit-anexos/${stepId}_${safeName}`;
        const wantedName = normalizeAttachmentName(att.attachment_name || rawName);
        const wantedExt = String(att.extension || "").trim().toLowerCase().replace(/^\./, "");
        const wantedDate = String(att.attachment_date || "").trim();
        const suppliedSourcePath = att.source_storage_path || topLevelSourcePath;
        let contentType = att.content_type || topLevelContentType || "application/pdf";
        let fileSize = Number(att.file_size || topLevelFileSize || 0) || 0;
        let downloadedBytes: Uint8Array | null = null;

        if (suppliedSourcePath && chunkFirst) {
          await supabase.storage.from(BUCKET).remove([storagePath]);
          const { error: copyErr } = await (supabase.storage.from(BUCKET) as any).copy(suppliedSourcePath, storagePath);
          if (copyErr) {
            const { data: sourceBlob, error: dlErr } = await supabase.storage.from(BUCKET).download(suppliedSourcePath);
            if (dlErr || !sourceBlob) {
              results.push({ step_id: stepId, ok: false, error: "Falha ao copiar anexo do storage: " + (copyErr.message || dlErr?.message || "") });
              continue;
            }
            downloadedBytes = new Uint8Array(await sourceBlob.arrayBuffer());
            fileSize = downloadedBytes.byteLength;
            contentType = sourceBlob.type || contentType;
            const { error: upErr } = await supabase.storage
              .from(BUCKET)
              .upload(storagePath, downloadedBytes, { upsert: true, contentType });
            if (upErr) {
              results.push({ step_id: stepId, ok: false, error: "Upload falhou: " + upErr.message });
              continue;
            }
          }
        } else if (!suppliedSourcePath && chunkFirst) {
          const cnj = String(att.cnj || processoNumero).replace(/[^0-9.-]/g, "").trim();
          const order: string[] = [];
          const primary = att.instance ? String(att.instance) : "1";
          order.push(primary);
          for (const i of ["1", "2", "3"]) if (!order.includes(i)) order.push(i);

          let fileRes: Response | null = null;
          let lastErr = "";
          for (const inst of order) {
            const url = `${JUDIT_LAWSUITS}/lawsuits/${encodeURIComponent(cnj)}/${inst}/attachments/${encodeURIComponent(stepId)}`;
            const r = await fetch(url, { headers: { "api-key": juditApiKey } });
            if (r.ok) { fileRes = r; break; }
            lastErr = `HTTP ${r.status}`;
            if (r.status !== 404) break;
          }
          if (!fileRes) {
            results.push({ step_id: stepId, ok: false, error: `Anexo não encontrado (${lastErr})` });
            continue;
          }

          downloadedBytes = new Uint8Array(await fileRes.arrayBuffer());
          fileSize = downloadedBytes.byteLength;
          contentType = fileRes.headers.get("content-type") || contentType;
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, downloadedBytes, { upsert: true, contentType });
          if (upErr) {
            results.push({ step_id: stepId, ok: false, error: "Upload falhou: " + upErr.message });
            continue;
          }
        }

        let documentoId: string | null = null;
        if (incomingDocId) {
          documentoId = incomingDocId;
        } else {
          const { data: previousAttachment } = await supabase
            .from("judit_anexos")
            .select("documento_id, attachment_name, attachment_date, extension")
            .eq("processo_numero", processoNumero)
            .eq("texto_indexado", true)
            .not("documento_id", "is", null)
            .limit(200);
          const previousRows = Array.isArray(previousAttachment) ? previousAttachment : [];
          const siblingDocId = previousRows.find((row: any) => {
            const rowName = normalizeAttachmentName(row?.attachment_name);
            const rowExt = String(row?.extension || "").trim().toLowerCase().replace(/^\./, "");
            const rowDate = String(row?.attachment_date || "").trim();
            return row?.documento_id && wantedName && rowName === wantedName && (!wantedExt || rowExt === wantedExt) && (!wantedDate || rowDate === wantedDate);
          })?.documento_id || null;
          if (siblingDocId) documentoId = siblingDocId;
          const { data: existingDoc } = await supabase
            .from("documentos")
            .select("id")
            .eq("processo_id", processoId)
            .eq("nome", safeName)
            .maybeSingle();
          if (!documentoId && existingDoc?.id) {
            documentoId = existingDoc.id;
            await supabase.from("documentos").update({
              tamanho_bytes: fileSize,
              tipo: contentType,
              categoria: "anexo-judit",
            } as any).eq("id", documentoId);
          } else if (!documentoId) {
            const { data: newDoc, error: docErr } = await supabase
              .from("documentos")
              .insert({
                processo_id: processoId,
                nome: safeName,
                tipo: contentType,
                tamanho_bytes: fileSize,
                uploaded_by: user.id,
                categoria: "anexo-judit",
                tipo_documento: "ANEXO_JUDIT",
              } as any)
              .select("id")
              .single();
            if (docErr || !newDoc) {
              results.push({ step_id: stepId, ok: false, error: "Falha ao criar documento: " + docErr?.message });
              continue;
            }
            documentoId = newDoc.id;
          }
        }

        let pagesText = normalizePages(att.pages_text);
        if (pagesText.length === 0) pagesText = topLevelPages;
        if (pagesText.length === 0 && downloadedBytes && !contentType.includes("pdf")) {
          const decoded = new TextDecoder("utf-8").decode(downloadedBytes);
          pagesText = [contentType.includes("html") ? stripHtml(decoded) : decoded.trim()].filter(Boolean);
        }
        if (pagesText.length === 0) {
          results.push({ step_id: stepId, ok: false, error: "Nenhum texto extraído foi recebido para este anexo." });
          continue;
        }

        if (chunkFirst && pageOffset === 0) {
          await supabase.from("documentos_texto_indexado").delete().eq("documento_id", documentoId);
        }

        const rows = pagesText.map((t, idx) => ({
          documento_id: documentoId!,
          processo_id: processoId!,
          pagina: pageOffset + idx + 1,
          conteudo_texto: t.trim(),
        })).filter((r) => r.conteudo_texto.length > 0);

        for (let i = 0; i < rows.length; i += 50) {
          const slice = rows.slice(i, i + 50);
          const { error: insErr } = await supabase
            .from("documentos_texto_indexado")
            .insert(slice as any);
          if (insErr) console.warn("Insert texto falhou:", insErr.message);
        }

        if (chunkLast) {
          const { count: totalPages } = await supabase
            .from("documentos_texto_indexado")
            .select("id", { count: "exact", head: true })
            .eq("documento_id", documentoId);
          const finalPages = totalPages || (pageOffset + pagesText.length);

          // Build flat content from indexed pages (cap to 60k)
          const { data: pagesRows } = await supabase
            .from("documentos_texto_indexado")
            .select("pagina, conteudo_texto")
            .eq("documento_id", documentoId)
            .order("pagina", { ascending: true });
          const conteudoFlat = (pagesRows || [])
            .map((p: any) => `--- Página ${p.pagina} ---\n${p.conteudo_texto}`)
            .join("\n\n")
            .substring(0, 60000);

          await supabase.from("documentos").update({
            texto_completo_indexado: true,
            paginas_extraidas: finalPages,
            conteudo_extraido: conteudoFlat,
          } as any).eq("id", documentoId);

          const updatePayload = {
              texto_indexado: true,
              texto_indexado_em: new Date().toISOString(),
              documento_id: documentoId,
              processo_id: processoId,
              storage_path: storagePath,
              paginas_extraidas: finalPages,
            } as any;
          await supabase.from("judit_anexos")
            .update(updatePayload)
            .eq("processo_numero", processoNumero)
            .eq("attachment_id", stepId);
          const siblingsUpdate = supabase.from("judit_anexos")
            .update(updatePayload)
            .eq("processo_numero", processoNumero);
          if (wantedName) {
            await siblingsUpdate
              .eq("attachment_name", att.attachment_name || rawName)
              .eq("extension", att.extension || null);
          }

          results.push({ step_id: stepId, ok: true, pages: finalPages, documento_id: documentoId! });
        } else {
          results.push({ step_id: stepId, ok: true, pages: pageOffset + pagesText.length, documento_id: documentoId! });
        }
      } catch (e: any) {
        results.push({ step_id: stepId, ok: false, error: e?.message || String(e) });
      }
    }

    return json({ processo_id: processoId, results });
  } catch (e: any) {
    console.error("processar-anexos-ia erro:", e);
    return json({ error: e?.message || String(e), stack: e?.stack }, 200);
  }
});
