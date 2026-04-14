import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JUDIT_LAWSUITS = "https://lawsuits.production.judit.io";
const JUDIT_REQUESTS = "https://requests.prod.judit.io";

const headers200 = { ...corsHeaders, "Content-Type": "application/json" };

function respond(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: headers200 });
}

interface Attachment {
  step_id: string;
  attachment_name: string;
  attachment_date: string | null;
  extension: string | null;
}

const RECENT_CRAWLER_WINDOW_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let supabase: ReturnType<typeof createClient> | null = null;
  let jobId: string | null = null;

  // Helper to update job progress in DB
  async function updateJob(updates: Record<string, unknown>) {
    if (!supabase || !jobId) return;
    try {
      await supabase.from("baixar_autos_jobs").update(updates).eq("id", jobId);
    } catch (e) {
      console.error("[baixar-autos-judit] Erro ao atualizar job:", e);
    }
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ error: "Não autenticado", sucesso: false, documentos_baixados: 0 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const juditApiKey = Deno.env.get("JUDIT_API_KEY");

    if (!juditApiKey) {
      return respond({ error: "JUDIT_API_KEY não configurada", sucesso: false, documentos_baixados: 0 });
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return respond({ error: "Token inválido", sucesso: false, documentos_baixados: 0 });
    }

    const { processo_id, processo_numero } = await req.json();
    if (!processo_id || !processo_numero) {
      return respond({ error: "processo_id e processo_numero são obrigatórios", sucesso: false, documentos_baixados: 0 });
    }

    const cnj = processo_numero.replace(/[^0-9.-]/g, "").trim();
    console.log(`[baixar-autos-judit] Buscando attachments para CNJ: ${cnj}`);

    const [activeJobResult, existingDocsResult] = await Promise.all([
      supabase
        .from("baixar_autos_jobs")
        .select("id, status, etapa, documentos_total, documentos_baixados, documentos_existentes, documentos_erro, mensagem, erro, updated_at")
        .eq("processo_id", processo_id)
        .in("status", ["iniciado", "crawler", "baixando"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("processos_documentos_download")
        .select("id, nome_arquivo, tipo_documento, tamanho_bytes")
        .eq("processo_id", processo_id)
        .eq("status_download", "concluido")
        .order("created_at", { ascending: false }),
    ]);

    const activeJob = activeJobResult.data;
    if (activeJob) {
      console.log(`[baixar-autos-judit] Reutilizando job em andamento: ${activeJob.id}`);
      return respond({
        sucesso: true,
        em_andamento: true,
        documentos_baixados: activeJob.documentos_baixados || 0,
        documentos_existentes: activeJob.documentos_existentes || 0,
        documentos_erro: activeJob.documentos_erro || 0,
        documentos_total: activeJob.documentos_total || 0,
        documentos: [],
        mensagem: activeJob.mensagem || activeJob.etapa,
        erro: activeJob.erro,
        job_id: activeJob.id,
      });
    }

    const existingDocs = existingDocsResult.data || [];
    if (existingDocs.length > 0) {
      console.log(`[baixar-autos-judit] ${existingDocs.length} documento(s) já disponíveis no storage. Nenhuma nova busca será feita.`);
      return respond({
        sucesso: true,
        reutilizado: true,
        documentos_baixados: 0,
        documentos_existentes: existingDocs.length,
        documentos_erro: 0,
        documentos_total: existingDocs.length,
        documentos: existingDocs.map((doc) => ({
          id: doc.id,
          nome: doc.nome_arquivo,
          tipo: doc.tipo_documento,
          tamanho: doc.tamanho_bytes,
          status: "ja_existente",
        })),
        mensagem: `${existingDocs.length} documento(s) já estão disponíveis. Nenhuma nova busca foi realizada.`,
      });
    }

    // Create job record for progress tracking
    const { data: jobData } = await supabase.from("baixar_autos_jobs").insert({
      processo_id,
      user_id: user.id,
      status: "iniciado",
      etapa: "Consultando datalake da Judit...",
    }).select("id").single();

    jobId = jobData?.id || null;

    const juditHeaders = { "api-key": juditApiKey, "Content-Type": "application/json" };

    // ── Step 1: Query lawsuits endpoint for existing attachments ──
    let attachments: Attachment[] = [];
    let instance = 1;

    const lawsuitRes = await fetch(`${JUDIT_LAWSUITS}/lawsuits/${encodeURIComponent(cnj)}`, {
      headers: juditHeaders,
    });

    if (lawsuitRes.ok) {
      const lawsuitData = await lawsuitRes.json();
      if (Array.isArray(lawsuitData)) {
        for (const item of lawsuitData) {
          instance = item.instance || 1;
          if (Array.isArray(item.attachments) && item.attachments.length > 0) {
            attachments = item.attachments;
            break;
          }
        }
      } else if (lawsuitData && Array.isArray(lawsuitData.attachments)) {
        attachments = lawsuitData.attachments;
        instance = lawsuitData.instance || 1;
      }
      console.log(`[baixar-autos-judit] Datalake: ${attachments.length} attachment(s), instance=${instance}`);
    } else {
      const errText = await lawsuitRes.text();
      console.log(`[baixar-autos-judit] Lawsuit endpoint ${lawsuitRes.status}: ${errText.substring(0, 200)}`);
    }

    // ── Step 2: If no attachments, request crawler ──
    if (attachments.length === 0) {
      const { data: recentCrawlerJob } = await supabase
        .from("baixar_autos_jobs")
        .select("id, status, etapa, mensagem, updated_at")
        .eq("processo_id", processo_id)
        .neq("id", jobId)
        .in("status", ["crawler", "timeout"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const recentCrawlerStillFresh = recentCrawlerJob
        ? Date.now() - new Date(recentCrawlerJob.updated_at).getTime() < RECENT_CRAWLER_WINDOW_MS
        : false;

      if (recentCrawlerStillFresh) {
        const mensagem = "Verificação concluída: os arquivos ainda não foram disponibilizados pela Judit. Nenhuma nova solicitação foi enviada.";
        console.log(`[baixar-autos-judit] Crawler recente já solicitado (${recentCrawlerJob?.id}). Apenas verificando disponibilidade.`);
        await updateJob({
          status: "concluido",
          etapa: "Aguardando disponibilização dos arquivos",
          documentos_total: 0,
          documentos_baixados: 0,
          documentos_existentes: 0,
          documentos_erro: 0,
          mensagem,
        });
        return respond({
          sucesso: true,
          verificacao_apenas: true,
          documentos_baixados: 0,
          documentos_existentes: 0,
          documentos_erro: 0,
          documentos_total: 0,
          documentos: [],
          mensagem,
          job_id: jobId,
        });
      }

      await updateJob({ etapa: "Solicitando crawler da Judit...", status: "crawler" });

      const instanceNumber = Number(instance);
      const crawlerAttempts = [
        {
          mode: "attachments",
          body: {
            search: {
              search_type: "lawsuit_cnj",
              search_key: cnj,
              response_type: "attachments",
              ...(Number.isFinite(instanceNumber)
                ? { search_params: { lawsuit_instance: instanceNumber } }
                : {}),
            },
          },
        },
        {
          mode: "lawsuit",
          body: {
            search: {
              search_type: "lawsuit_cnj",
              search_key: cnj,
              response_type: "lawsuit",
              ...(Number.isFinite(instanceNumber)
                ? { search_params: { lawsuit_instance: instanceNumber } }
                : {}),
            },
          },
        },
      ];

      let crawlerRes: Response | null = null;
      let crawlerErrorText = "";
      let crawlerMode = "attachments";

      for (const attempt of crawlerAttempts) {
        crawlerMode = attempt.mode;
        console.log(`[baixar-autos-judit] Crawler request (${crawlerMode}) body: ${JSON.stringify(attempt.body)}`);

        crawlerRes = await fetch(`${JUDIT_REQUESTS}/requests`, {
          method: "POST",
          headers: juditHeaders,
          body: JSON.stringify(attempt.body),
        });

        if (crawlerRes.ok) {
          console.log(`[baixar-autos-judit] Crawler aceito com mode=${crawlerMode}`);
          break;
        }

        crawlerErrorText = await crawlerRes.text();
        console.error(
          `[baixar-autos-judit] Crawler request failed (${crawlerMode}):`,
          crawlerRes.status,
          crawlerErrorText.substring(0, 300),
        );
      }

      if (!crawlerRes?.ok) {
        await updateJob({ status: "erro", etapa: "Erro no crawler", erro: "Falha ao solicitar documentos ao crawler da Judit" });
        return respond({
          error: "Falha ao solicitar documentos ao crawler da Judit",
          detalhes: crawlerErrorText.substring(0, 200),
          sucesso: false,
          documentos_baixados: 0,
          job_id: jobId,
        });
      }

      const crawlerData = await crawlerRes.json();
      const requestId = crawlerData.request_id || crawlerData.id;

      if (!requestId) {
        await updateJob({ status: "erro", etapa: "Sem ID de acompanhamento", erro: "Crawler não retornou request_id" });
        return respond({
          sucesso: false,
          documentos_baixados: 0,
          mensagem: "Pedido enviado à Judit, mas sem ID de acompanhamento. Tente novamente em alguns minutos.",
          job_id: jobId,
        });
      }

      console.log(`[baixar-autos-judit] Request ID: ${requestId}. Polling... mode=${crawlerMode}`);

      // Poll for completion (max ~90s)
      const maxPolls = 18;
      let completed = false;

      for (let i = 0; i < maxPolls; i++) {
        await updateJob({ etapa: `Aguardando crawler... (${i + 1}/${maxPolls})` });
        await new Promise((r) => setTimeout(r, 5000));

        const pollRes = await fetch(`${JUDIT_REQUESTS}/requests/${requestId}`, {
          headers: juditHeaders,
        });

        if (!pollRes.ok) {
          await pollRes.text();
          continue;
        }

        const pollData = await pollRes.json();
        const status = pollData.status || pollData.search?.status;
        console.log(`[baixar-autos-judit] Poll ${i + 1}: status=${status}`);

        if (status === "completed" || status === "done") {
          completed = true;
          break;
        }
        if (status === "failed" || status === "error") {
          await updateJob({ status: "erro", etapa: "Crawler falhou", erro: "O crawler da Judit falhou" });
          return respond({
            error: "O crawler da Judit falhou ao processar os documentos",
            detalhes: pollData.error || pollData.message || "",
            sucesso: false,
            documentos_baixados: 0,
            job_id: jobId,
          });
        }
      }

      if (!completed) {
        await updateJob({ status: "timeout", etapa: "Timeout do crawler", mensagem: "Crawler ainda processando" });
        return respond({
          sucesso: false,
          documentos_baixados: 0,
          mensagem: "O crawler ainda está processando. Tente novamente em alguns minutos.",
          job_id: jobId,
        });
      }

      await updateJob({ etapa: "Re-consultando datalake após crawler..." });

      // Re-fetch after crawler
      const refetchRes = await fetch(`${JUDIT_LAWSUITS}/lawsuits/${encodeURIComponent(cnj)}`, {
        headers: juditHeaders,
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
        const refetchErr = await refetchRes.text();
        console.error(`[baixar-autos-judit] Refetch falhou: ${refetchRes.status} ${refetchErr.substring(0, 200)}`);
      }
    }

    if (attachments.length === 0) {
      await updateJob({ status: "concluido", etapa: "Nenhum documento encontrado", documentos_total: 0 });
      return respond({
        sucesso: true,
        documentos_baixados: 0,
        documentos: [],
        mensagem: "Nenhum documento encontrado para este processo na Judit.",
        job_id: jobId,
      });
    }

    await updateJob({
      etapa: `Baixando 0/${attachments.length} documento(s)...`,
      documentos_total: attachments.length,
      status: "baixando",
    });

    console.log(`[baixar-autos-judit] ${attachments.length} attachment(s). Baixando...`);

    // ── Step 3: Download each attachment ──
    const documentosBaixados: any[] = [];
    let erros = 0;
    let baixados = 0;
    let existentes = 0;

    for (let idx = 0; idx < attachments.length; idx++) {
      const att = attachments[idx];
      const attachmentId = att.step_id;
      const nomeArquivo = att.attachment_name || `documento_${attachmentId}`;
      const ext = att.extension || "pdf";
      const nomeCompleto = nomeArquivo.endsWith(`.${ext}`) ? nomeArquivo : `${nomeArquivo}.${ext}`;
      const storagePath = `${processo_id}/${nomeCompleto}`;

      await updateJob({
        etapa: `Baixando ${idx + 1}/${attachments.length}: ${nomeCompleto.substring(0, 40)}...`,
        documentos_baixados: baixados,
        documentos_existentes: existentes,
        documentos_erro: erros,
      });

      // Dedup check
      const { data: existing } = await supabase
        .from("processos_documentos_download")
        .select("id")
        .eq("processo_id", processo_id)
        .eq("nome_arquivo", nomeCompleto)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[baixar-autos-judit] Já existe: ${nomeCompleto}`);
        documentosBaixados.push({ nome: nomeCompleto, status: "ja_existente" });
        existentes++;
        continue;
      }

      try {
        const downloadUrl = `${JUDIT_LAWSUITS}/lawsuits/${encodeURIComponent(cnj)}/${instance}/attachments/${attachmentId}`;
        console.log(`[baixar-autos-judit] Baixando: ${downloadUrl}`);

        const downloadRes = await fetch(downloadUrl, { headers: { "api-key": juditApiKey } });

        if (!downloadRes.ok) {
          const errText = await downloadRes.text();
          console.error(`[baixar-autos-judit] Erro download ${nomeCompleto}: ${downloadRes.status}`);
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

        const { error: uploadError } = await supabase.storage
          .from("documentos_processos")
          .upload(storagePath, new Uint8Array(fileBytes), {
            contentType: ext === "pdf" ? "application/pdf" : "application/octet-stream",
            upsert: true,
          });

        if (uploadError) {
          console.error(`[baixar-autos-judit] Upload error: ${uploadError.message}`);
          erros++;

          await supabase.from("processos_documentos_download").insert({
            processo_id,
            nome_arquivo: nomeCompleto,
            tipo_documento: ext,
            storage_path: storagePath,
            status_download: "erro",
            mensagem_erro: `Upload: ${uploadError.message}`,
            downloaded_by: user.id,
            downloaded_at: new Date().toISOString(),
            data_documento: att.attachment_date || null,
          });

          documentosBaixados.push({ nome: nomeCompleto, status: "erro" });
          continue;
        }

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

        baixados++;
        documentosBaixados.push({ nome: nomeCompleto, status: "baixado", tamanho: fileBytes.byteLength });
        console.log(`[baixar-autos-judit] ✅ ${nomeCompleto} (${fileBytes.byteLength} bytes)`);
      } catch (err) {
        console.error(`[baixar-autos-judit] Exceção ${nomeCompleto}:`, err);
        erros++;
        documentosBaixados.push({ nome: nomeCompleto, status: "erro" });
      }
    }

    const mensagem = baixados > 0
      ? `${baixados} documento(s) baixado(s)${existentes > 0 ? `, ${existentes} já existiam` : ""}`
      : existentes > 0
      ? `Todos os ${existentes} documento(s) já haviam sido baixados`
      : "Nenhum documento pôde ser baixado";

    await updateJob({
      status: "concluido",
      etapa: mensagem,
      documentos_baixados: baixados,
      documentos_existentes: existentes,
      documentos_erro: erros,
      documentos_total: attachments.length,
      mensagem,
    });

    return respond({
      sucesso: true,
      documentos_baixados: baixados,
      documentos_existentes: existentes,
      documentos_erro: erros,
      documentos_total: attachments.length,
      documentos: documentosBaixados,
      mensagem,
      job_id: jobId,
    });
  } catch (err) {
    console.error("[baixar-autos-judit] Erro geral:", err);
    const errorMessage = err instanceof Error ? err.message : "desconhecido";
    await updateJob({ status: "erro", etapa: "Erro interno", erro: errorMessage });
    return respond({
      error: "Erro interno ao processar documentos: " + errorMessage,
      sucesso: false,
      documentos_baixados: 0,
      job_id: jobId,
    });
  }
});
