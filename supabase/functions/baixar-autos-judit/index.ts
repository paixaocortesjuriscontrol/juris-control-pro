import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JUDIT_DATALAKE = "https://datalake.prod.judit.io";
const JUDIT_REQUESTS = "https://requests.prod.judit.io";

interface Attachment {
  step_id: string;
  attachment_name: string;
  attachment_date: string | null;
  extension: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const juditApiKey = Deno.env.get("JUDIT_API_KEY");

    if (!juditApiKey) {
      return new Response(JSON.stringify({ error: "JUDIT_API_KEY não configurada" }), { status: 500, headers });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Input
    const { processo_id, processo_numero } = await req.json();
    if (!processo_id || !processo_numero) {
      return new Response(JSON.stringify({ error: "processo_id e processo_numero são obrigatórios" }), { status: 400, headers });
    }

    const cnj = processo_numero.replace(/[^0-9.-]/g, "").trim();
    console.log(`[baixar-autos-judit] Buscando attachments para CNJ: ${cnj}`);

    // ── Step 1: Query datalake for existing attachments ──
    let attachments: Attachment[] = [];
    let instance = 1;

    const datalakeRes = await fetch(`${JUDIT_DATALAKE}/lawsuits/${encodeURIComponent(cnj)}`, {
      headers: { "api-key": juditApiKey, "Content-Type": "application/json" },
    });

    if (datalakeRes.ok) {
      const datalakeData = await datalakeRes.json();
      // Try to find attachments in the response
      if (Array.isArray(datalakeData)) {
        for (const item of datalakeData) {
          instance = item.instance || 1;
          if (Array.isArray(item.attachments) && item.attachments.length > 0) {
            attachments = item.attachments;
            break;
          }
        }
      } else if (datalakeData && Array.isArray(datalakeData.attachments)) {
        attachments = datalakeData.attachments;
        instance = datalakeData.instance || 1;
      }
    } else {
      console.log(`[baixar-autos-judit] Datalake response: ${datalakeRes.status}`);
      await datalakeRes.text(); // consume body
    }

    // ── Step 2: If no attachments, request crawler ──
    if (attachments.length === 0) {
      console.log("[baixar-autos-judit] Nenhum attachment no datalake. Solicitando crawler...");

      const crawlerRes = await fetch(`${JUDIT_REQUESTS}/requests`, {
        method: "POST",
        headers: { "api-key": juditApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          search_type: "lawsuit_cnj",
          search_key: cnj,
          response_type: "attachments",
        }),
      });

      if (!crawlerRes.ok) {
        const errText = await crawlerRes.text();
        console.error("[baixar-autos-judit] Crawler request failed:", errText);
        return new Response(JSON.stringify({
          error: "Falha ao solicitar documentos ao crawler da Judit",
          detalhes: errText,
        }), { status: 502, headers });
      }

      const crawlerData = await crawlerRes.json();
      const requestId = crawlerData.request_id || crawlerData.id;

      if (!requestId) {
        return new Response(JSON.stringify({
          error: "Crawler não retornou request_id",
          sucesso: false,
          documentos_baixados: 0,
          mensagem: "O pedido de documentos foi enviado à Judit, mas sem ID de acompanhamento. Tente novamente em alguns minutos.",
        }), { status: 200, headers });
      }

      console.log(`[baixar-autos-judit] Request ID: ${requestId}. Polling...`);

      // Poll for completion (max ~90s)
      const maxPolls = 18;
      let completed = false;

      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, 5000));

        const pollRes = await fetch(`${JUDIT_REQUESTS}/requests/${requestId}`, {
          headers: { "api-key": juditApiKey },
        });

        if (!pollRes.ok) {
          await pollRes.text();
          continue;
        }

        const pollData = await pollRes.json();
        console.log(`[baixar-autos-judit] Poll ${i + 1}: status=${pollData.status}`);

        if (pollData.status === "completed" || pollData.status === "done") {
          completed = true;
          break;
        }
        if (pollData.status === "failed" || pollData.status === "error") {
          return new Response(JSON.stringify({
            error: "O crawler da Judit falhou ao processar os documentos",
            detalhes: pollData.error || pollData.message,
            sucesso: false,
            documentos_baixados: 0,
          }), { status: 200, headers });
        }
      }

      if (!completed) {
        return new Response(JSON.stringify({
          sucesso: false,
          documentos_baixados: 0,
          mensagem: "O crawler ainda está processando os documentos. Tente novamente em alguns minutos.",
        }), { status: 200, headers });
      }

      // Re-fetch datalake after crawler
      const refetchRes = await fetch(`${JUDIT_DATALAKE}/lawsuits/${encodeURIComponent(cnj)}`, {
        headers: { "api-key": juditApiKey, "Content-Type": "application/json" },
      });

      if (refetchRes.ok) {
        const refetchData = await refetchRes.json();
        if (Array.isArray(refetchData)) {
          for (const item of refetchData) {
            instance = item.instance || 1;
            if (Array.isArray(item.attachments) && item.attachments.length > 0) {
              attachments = item.attachments;
              break;
            }
          }
        } else if (refetchData && Array.isArray(refetchData.attachments)) {
          attachments = refetchData.attachments;
          instance = refetchData.instance || 1;
        }
      } else {
        await refetchRes.text();
      }
    }

    if (attachments.length === 0) {
      return new Response(JSON.stringify({
        sucesso: true,
        documentos_baixados: 0,
        documentos: [],
        mensagem: "Nenhum documento encontrado para este processo na Judit.",
      }), { status: 200, headers });
    }

    console.log(`[baixar-autos-judit] ${attachments.length} attachment(s) encontrado(s). Baixando...`);

    // ── Step 3: Download each attachment ──
    const documentosBaixados: any[] = [];
    let erros = 0;

    for (const att of attachments) {
      const attachmentId = att.step_id;
      const nomeArquivo = att.attachment_name || `documento_${attachmentId}`;
      const ext = att.extension || "pdf";
      const nomeCompleto = nomeArquivo.endsWith(`.${ext}`) ? nomeArquivo : `${nomeArquivo}.${ext}`;
      const storagePath = `${processo_id}/${nomeCompleto}`;

      // Dedup check
      const { data: existing } = await supabase
        .from("processos_documentos_download")
        .select("id")
        .eq("processo_id", processo_id)
        .eq("nome_arquivo", nomeCompleto)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[baixar-autos-judit] Documento já existe: ${nomeCompleto}`);
        documentosBaixados.push({ nome: nomeCompleto, status: "ja_existente" });
        continue;
      }

      try {
        // Download from Judit
        const downloadUrl = `${JUDIT_DATALAKE}/lawsuits/${encodeURIComponent(cnj)}/${instance}/attachments/${attachmentId}`;
        console.log(`[baixar-autos-judit] Baixando: ${downloadUrl}`);

        const downloadRes = await fetch(downloadUrl, {
          headers: { "api-key": juditApiKey },
        });

        if (!downloadRes.ok) {
          const errText = await downloadRes.text();
          console.error(`[baixar-autos-judit] Erro ao baixar ${nomeCompleto}: ${downloadRes.status} - ${errText}`);
          erros++;

          await supabase.from("processos_documentos_download").insert({
            processo_id,
            nome_arquivo: nomeCompleto,
            tipo_documento: ext,
            storage_path: storagePath,
            status_download: "erro",
            mensagem_erro: `HTTP ${downloadRes.status}: ${errText.substring(0, 200)}`,
            downloaded_by: user.id,
            downloaded_at: new Date().toISOString(),
            data_documento: att.attachment_date || null,
          });

          documentosBaixados.push({ nome: nomeCompleto, status: "erro" });
          continue;
        }

        const fileBlob = await downloadRes.blob();
        const fileBytes = await fileBlob.arrayBuffer();

        // Upload to Storage
        const { error: uploadError } = await supabase.storage
          .from("documentos_processos")
          .upload(storagePath, new Uint8Array(fileBytes), {
            contentType: ext === "pdf" ? "application/pdf" : "application/octet-stream",
            upsert: true,
          });

        if (uploadError) {
          console.error(`[baixar-autos-judit] Erro upload storage: ${uploadError.message}`);
          erros++;

          await supabase.from("processos_documentos_download").insert({
            processo_id,
            nome_arquivo: nomeCompleto,
            tipo_documento: ext,
            storage_path: storagePath,
            status_download: "erro",
            mensagem_erro: `Upload storage: ${uploadError.message}`,
            downloaded_by: user.id,
            downloaded_at: new Date().toISOString(),
            data_documento: att.attachment_date || null,
          });

          documentosBaixados.push({ nome: nomeCompleto, status: "erro" });
          continue;
        }

        // Register in DB
        await supabase.from("processos_documentos_download").insert({
          processo_id,
          nome_arquivo: nomeCompleto,
          tipo_documento: ext,
          storage_path: storagePath,
          status_download: "concluido",
          tamanho_bytes: fileBytes.byteLength,
          downloaded_by: user.id,
          downloaded_at: new Date().toISOString(),
          data_documento: att.attachment_date || null,
        });

        documentosBaixados.push({
          nome: nomeCompleto,
          status: "baixado",
          tamanho: fileBytes.byteLength,
        });

        console.log(`[baixar-autos-judit] ✅ ${nomeCompleto} (${fileBytes.byteLength} bytes)`);
      } catch (err) {
        console.error(`[baixar-autos-judit] Exceção ao baixar ${nomeCompleto}:`, err);
        erros++;
        documentosBaixados.push({ nome: nomeCompleto, status: "erro" });
      }
    }

    const totalBaixados = documentosBaixados.filter((d) => d.status === "baixado").length;
    const totalExistentes = documentosBaixados.filter((d) => d.status === "ja_existente").length;

    return new Response(JSON.stringify({
      sucesso: true,
      documentos_baixados: totalBaixados,
      documentos_existentes: totalExistentes,
      documentos_erro: erros,
      documentos_total: attachments.length,
      documentos: documentosBaixados,
      mensagem: totalBaixados > 0
        ? `${totalBaixados} documento(s) baixado(s) com sucesso${totalExistentes > 0 ? `, ${totalExistentes} já existiam` : ""}`
        : totalExistentes > 0
        ? `Todos os ${totalExistentes} documento(s) já haviam sido baixados`
        : "Nenhum documento pôde ser baixado",
    }), { status: 200, headers });
  } catch (err) {
    console.error("[baixar-autos-judit] Erro geral:", err);
    return new Response(JSON.stringify({
      error: "Erro interno ao processar documentos",
      detalhes: err.message,
    }), { status: 500, headers });
  }
});
