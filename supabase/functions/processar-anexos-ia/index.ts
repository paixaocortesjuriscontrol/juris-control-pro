import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUDIT_LAWSUITS = "https://lawsuits.production.judit.io";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AttIn {
  step_id: string;
  attachment_name?: string | null;
  instance?: string | null;
  cnj?: string | null;
  extension?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Token inválido" }, 401);

    const juditApiKey = Deno.env.get("JUDIT_API_KEY");
    if (!juditApiKey) return json({ error: "JUDIT_API_KEY não configurada" }, 500);

    const body = await req.json();
    const processoNumero: string = String(body?.processo_numero || "").trim();
    let processoId: string | null = body?.processo_id || null;
    const attachments: AttIn[] = Array.isArray(body?.attachments) ? body.attachments : [];
    if (!processoNumero || attachments.length === 0) {
      return json({ error: "processo_numero e attachments são obrigatórios" }, 400);
    }

    // Garante processo_id (cria se necessário) — espelha o repositório de IA usado nas outras telas.
    if (!processoId) {
      const { data: proc } = await supabase
        .from("processos")
        .select("id")
        .eq("numero", processoNumero)
        .maybeSingle();
      if (proc?.id) {
        processoId = proc.id;
      } else {
        const { data: newProc, error: newErr } = await supabase
          .from("processos")
          .insert({ numero: processoNumero, tipo: "civil", status: "ativo" } as any)
          .select("id")
          .single();
        if (newErr) return json({ error: "Falha ao criar processo: " + newErr.message }, 500);
        processoId = newProc!.id;
      }
    }

    const results: Array<{ step_id: string; ok: boolean; pages?: number; error?: string; documento_id?: string }> = [];

    for (const att of attachments) {
      const stepId = String(att.step_id || "");
      if (!stepId) {
        results.push({ step_id: stepId, ok: false, error: "step_id ausente" });
        continue;
      }
      try {
        const cnj = String(att.cnj || processoNumero).replace(/[^0-9.-]/g, "").trim();
        // Tenta a instância informada e faz fallback (1/2/3) — Judit nem sempre traz a instância correta.
        const order: string[] = [];
        const primary = att.instance ? String(att.instance) : "1";
        order.push(primary);
        for (const i of ["1", "2", "3"]) if (!order.includes(i)) order.push(i);

        let pdfRes: Response | null = null;
        let lastErr = "";
        for (const inst of order) {
          const url = `${JUDIT_LAWSUITS}/lawsuits/${encodeURIComponent(cnj)}/${inst}/attachments/${encodeURIComponent(stepId)}`;
          const r = await fetch(url, { headers: { "api-key": juditApiKey } });
          if (r.ok) { pdfRes = r; break; }
          lastErr = `HTTP ${r.status}`;
          if (r.status !== 404) break;
        }
        if (!pdfRes) {
          results.push({ step_id: stepId, ok: false, error: `Anexo não encontrado (${lastErr})` });
          continue;
        }
        const buf = new Uint8Array(await pdfRes.arrayBuffer());
        const rawName = String(att.attachment_name || `documento_${stepId}.${att.extension || "pdf"}`);
        const safeName = rawName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "") || `documento_${stepId}.pdf`;

        const storagePath = `${processoId}/judit-anexos/${stepId}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("documentos_processos")
          .upload(storagePath, buf, {
            upsert: true,
            contentType: pdfRes.headers.get("content-type") || "application/pdf",
          });
        if (upErr) {
          results.push({ step_id: stepId, ok: false, error: "Upload falhou: " + upErr.message });
          continue;
        }

        // Cria/recupera documento
        let documentoId: string | null = null;
        const { data: existingDoc } = await supabase
          .from("documentos")
          .select("id")
          .eq("processo_id", processoId)
          .eq("nome", safeName)
          .maybeSingle();
        if (existingDoc?.id) {
          documentoId = existingDoc.id;
          await supabase.from("documentos").update({
            tamanho_bytes: buf.byteLength,
            tipo: "application/pdf",
            categoria: "anexo-judit",
          } as any).eq("id", documentoId);
        } else {
          const { data: newDoc, error: docErr } = await supabase
            .from("documentos")
            .insert({
              processo_id: processoId,
              nome: safeName,
              tipo: "application/pdf",
              tamanho_bytes: buf.byteLength,
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

        // Extrai texto página a página (mesma lógica do DEJT Paralela: unpdf)
        let pagesText: string[] = [];
        let totalPages = 0;
        try {
          const pdf = await getDocumentProxy(buf, { useSystemFonts: true } as any);
          totalPages = pdf.numPages || 0;
          for (let i = 1; i <= totalPages; i++) {
            try {
              const { text } = await extractText(pdf, { mergePages: false, page: i } as any);
              const pageStr = Array.isArray(text) ? text[0] || "" : String(text || "");
              pagesText.push(pageStr);
            } catch (_e) {
              pagesText.push("");
            }
          }
        } catch (e: any) {
          // Fallback: extrai tudo numa string única
          try {
            const pdf2 = await getDocumentProxy(buf, { useSystemFonts: true } as any);
            const { text, totalPages: tp } = await extractText(pdf2, { mergePages: true } as any);
            totalPages = tp || 1;
            pagesText = [String(text || "")];
          } catch (e2: any) {
            results.push({ step_id: stepId, ok: false, error: "PDF sem texto extraível: " + (e2?.message || e?.message) });
            continue;
          }
        }

        // Limpa páginas anteriores deste documento (reprocessamento)
        await supabase.from("documentos_texto_indexado").delete().eq("documento_id", documentoId);

        const rows = pagesText
          .map((t, idx) => ({
            documento_id: documentoId!,
            processo_id: processoId!,
            pagina: idx + 1,
            conteudo_texto: (t || "").trim(),
          }))
          .filter((r) => r.conteudo_texto.length > 0);

        // Insere em lotes de 50
        for (let i = 0; i < rows.length; i += 50) {
          const slice = rows.slice(i, i + 50);
          const { error: insErr } = await supabase
            .from("documentos_texto_indexado")
            .insert(slice as any);
          if (insErr) {
            console.warn("Insert texto falhou:", insErr.message);
          }
        }

        const conteudoFlat = pagesText.join("\n\n").substring(0, 60000);
        await supabase.from("documentos").update({
          texto_completo_indexado: true,
          paginas_extraidas: totalPages,
          conteudo_extraido: conteudoFlat,
        } as any).eq("id", documentoId);

        await supabase.from("judit_anexos")
          .update({
            texto_indexado: true,
            texto_indexado_em: new Date().toISOString(),
            documento_id: documentoId,
            processo_id: processoId,
            storage_path: storagePath,
            paginas_extraidas: totalPages,
          } as any)
          .eq("processo_numero", processoNumero)
          .eq("attachment_id", stepId);

        results.push({ step_id: stepId, ok: true, pages: totalPages, documento_id: documentoId! });
      } catch (e: any) {
        results.push({ step_id: stepId, ok: false, error: e?.message || String(e) });
      }
    }

    return json({ processo_id: processoId, results });
  } catch (e: any) {
    console.error("processar-anexos-ia erro:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});