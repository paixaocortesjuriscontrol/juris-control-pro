import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  remessaId: string;
  para: string[];
  cc?: string[];
  assunto: string;
  corpo: string;
  de?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.remessaId || !Array.isArray(body.para) || body.para.length === 0 || !body.assunto) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: remessa, error: rErr } = await admin
      .from("remessas_benner")
      .select("*")
      .eq("id", body.remessaId)
      .single();
    if (rErr || !remessa) {
      return new Response(JSON.stringify({ error: "Remessa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let attachments: { filename: string; content: string }[] = [];
    if (remessa.arquivo_path) {
      const { data: fileData, error: fErr } = await admin.storage
        .from("cargas-benner-remessas")
        .download(remessa.arquivo_path);
      if (fErr || !fileData) {
        return new Response(JSON.stringify({ error: "Falha ao baixar arquivo" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const buf = new Uint8Array(await fileData.arrayBuffer());
      // base64
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
      }
      const b64 = btoa(binary);
      attachments.push({
        filename: remessa.arquivo_nome || `Remessa_${remessa.numero_sequencial}.xlsx`,
        content: b64,
      });
    }

    const fromAddr =
      (body.de && body.de.trim()) ||
      Deno.env.get("REMESSA_BENNER_FROM") ||
      "Carga Benner <onboarding@resend.dev>";

    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">
      <p>${(body.corpo || "").replace(/\n/g, "<br/>")}</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
      <p style="font-size:12px;color:#666">
        Remessa <strong>${remessa.numero_sequencial}</strong> &middot;
        ${remessa.quantidade_itens} item(ns) &middot;
        Gerada em ${new Date(remessa.data_geracao).toLocaleString("pt-BR")}
      </p>
    </div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        to: body.para,
        cc: body.cc && body.cc.length > 0 ? body.cc : undefined,
        subject: body.assunto,
        html,
        attachments,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: `Resend ${resp.status}: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await resp.json();

    // Update remessa
    await admin
      .from("remessas_benner")
      .update({
        status: "enviada",
        data_envio: new Date().toISOString(),
        enviado_por: userData.user.id,
        email_destinatarios: body.para,
        email_cc: body.cc ?? null,
        email_assunto: body.assunto,
        email_corpo: body.corpo,
      })
      .eq("id", body.remessaId);

    // Update dossies → enviado
    const { data: itens } = await admin
      .from("remessas_benner_itens")
      .select("dado_benner_id")
      .eq("remessa_id", body.remessaId);
    const ids = ((itens as any[]) || []).map((i) => i.dado_benner_id).filter(Boolean);
    const UB = 200;
    for (let i = 0; i < ids.length; i += UB) {
      const batch = ids.slice(i, i + UB);
      await admin.from("dados_benner").update({ status: "enviado" }).in("id", batch);
    }

    return new Response(JSON.stringify({ ok: true, resend: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});