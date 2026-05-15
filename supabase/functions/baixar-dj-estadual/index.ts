import { createClient } from "npm:@supabase/supabase-js@2";
import {
  TRIBUNAIS_ESTADUAIS,
  browserHeaders,
} from "../_shared/djeEstaduaisTribunais.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const tribunal = String(body.tribunal || "").toUpperCase();
    const dataISO = String(body.data || "");
    const caderno = String(body.caderno || "judicial-1");

    if (!tribunal || !dataISO) {
      return json({ error: "tribunal e data são obrigatórios" }, 400);
    }

    const cfg = TRIBUNAIS_ESTADUAIS[tribunal];
    if (!cfg) {
      return json({ error: `Tribunal não suportado: ${tribunal}` }, 400);
    }

    // Idempotência: se já existe registro processado, devolve.
    const { data: existente } = await supabase
      .from("dj_estaduais_pdfs")
      .select("id, status, storage_path, total_paginas")
      .eq("tribunal", tribunal)
      .eq("data_publicacao", dataISO)
      .eq("caderno", caderno)
      .maybeSingle();

    if (existente && (existente as any).status === "processado") {
      return json({ ok: true, reused: true, pdf: existente });
    }

    // Cria/atualiza registro como "baixando"
    const { data: registro, error: upErr } = await supabase
      .from("dj_estaduais_pdfs")
      .upsert(
        {
          tribunal,
          data_publicacao: dataISO,
          caderno,
          status: "baixando",
          erro_mensagem: null,
        },
        { onConflict: "tribunal,data_publicacao,caderno" },
      )
      .select()
      .single();

    if (upErr || !registro) {
      return json({ error: upErr?.message || "Falha ao registrar PDF" }, 500);
    }

    const url = cfg.buildUrl(dataISO, caderno);
    console.log(`[DJ-ESTADUAL] Baixando ${tribunal} ${dataISO} ${caderno} -> ${url}`);

    const headers = { ...browserHeaders, ...(cfg.headers || {}) };
    let resp: Response;
    try {
      resp = await fetch(url, { headers, redirect: "follow" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await marcarErro(supabase, (registro as any).id, `fetch: ${msg}`);
      return json({ error: `Falha de rede: ${msg}`, url }, 502);
    }

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      const msg = `HTTP ${resp.status} ao baixar PDF`;
      await marcarErro(supabase, (registro as any).id, `${msg} | ${txt.slice(0, 200)}`);
      return json({ error: msg, status: resp.status, url }, 502);
    }

    const ct = resp.headers.get("content-type") || "";
    const buf = new Uint8Array(await resp.arrayBuffer());

    // Heurística: PDF começa com %PDF-
    const ehPdf =
      ct.toLowerCase().includes("pdf") ||
      (buf.length > 4 &&
        buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46);

    if (!ehPdf) {
      const sample = new TextDecoder().decode(buf.slice(0, 200));
      await marcarErro(
        supabase,
        (registro as any).id,
        `Resposta não é PDF (content-type=${ct}): ${sample}`,
      );
      return json(
        { error: "Endpoint não retornou um PDF (provável anti-bot ou data sem caderno)", url, contentType: ct },
        502,
      );
    }

    const path = `${tribunal}/${dataISO}/${caderno}.pdf`;
    const { error: stErr } = await supabase.storage
      .from("dj-estaduais-pdfs")
      .upload(path, buf, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (stErr) {
      await marcarErro(supabase, (registro as any).id, `storage: ${stErr.message}`);
      return json({ error: stErr.message }, 500);
    }

    const { error: updErr } = await supabase
      .from("dj_estaduais_pdfs")
      .update({
        status: "baixado",
        storage_path: path,
        baixado_em: new Date().toISOString(),
        erro_mensagem: null,
      })
      .eq("id", (registro as any).id);

    if (updErr) return json({ error: updErr.message }, 500);

    return json({
      ok: true,
      pdf_id: (registro as any).id,
      tribunal,
      data: dataISO,
      caderno,
      tamanho: buf.length,
      storage_path: path,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DJ-ESTADUAL] erro fatal:", msg);
    return json({ error: msg }, 500);
  }
});

async function marcarErro(supabase: any, id: string, mensagem: string) {
  await supabase
    .from("dj_estaduais_pdfs")
    .update({ status: "erro", erro_mensagem: mensagem.slice(0, 1000) })
    .eq("id", id);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}