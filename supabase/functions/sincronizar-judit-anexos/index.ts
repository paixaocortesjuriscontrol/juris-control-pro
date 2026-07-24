import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUDIT_LAWSUITS = "https://lawsuits.production.judit.io";

function attachmentLogicalKey(name: any, date: any, ext: any) {
  const n = String(name || "")
    .trim()
    .replace(/\s*\(C[ÓO]PIA\)\s*/gi, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, "")
    .toUpperCase();
  const d = String(date || "").trim();
  const e = String(ext || "").trim().toLowerCase().replace(/^\./, "");
  return `${n}::${d}::${e}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Token inválido" }, 401);

    const juditApiKey = Deno.env.get("JUDIT_API_KEY");
    if (!juditApiKey) return json({ error: "JUDIT_API_KEY não configurada" }, 500);

    const { processo_numero } = await req.json();
    if (!processo_numero) return json({ error: "processo_numero obrigatório" }, 400);
    const cnj = String(processo_numero).replace(/[^0-9.-]/g, "").trim();

    const requestPayload = {
      numero_processo: cnj,
      with_attachments: true,
      origem: "sincronizar-anexos",
    };
    const logConsulta = async (
      status: "sucesso" | "erro_funcao" | "erro_api",
      rawResponse: unknown,
      errorMessage: string | null,
    ) => {
      try {
        await supabase.from("judit_logs").insert({
          processo_numero: cnj,
          tribunal: null,
          request_payload: requestPayload,
          raw_response: rawResponse ?? null,
          status,
          error_message: errorMessage,
          created_by: user.id,
          origem: "sincronizar-anexos",
          tipo_cobranca: "com_anexos",
          user_email: user.email ?? null,
        } as any);
      } catch (e) {
        console.warn("[sincronizar-judit-anexos] falha ao gravar judit_logs:", (e as Error).message);
      }
    };

    // Consulta o datalake síncrono da Judit (POST /lawsuits) com anexos —
    // só ele devolve `status` e `corrupted` por anexo.
    const r = await fetch(`${JUDIT_LAWSUITS}/lawsuits`, {
      method: "POST",
      headers: { "api-key": juditApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ search: { search_type: "lawsuit_cnj", search_key: cnj }, with_attachments: true }),
    });
    if (!r.ok) {
      const txt = await r.text();
      await logConsulta("erro_api", { http_status: r.status, body: txt.substring(0, 500) }, `HTTP ${r.status}`);
      return json({ error: `Judit HTTP ${r.status}: ${txt.substring(0, 200)}` }, 200);
    }
    const payload = await r.json();
    const lawsuits: any[] = Array.isArray(payload?.lawsuits) ? payload.lawsuits : [];
    await logConsulta("sucesso", { lawsuits_count: lawsuits.length }, null);

    // Mantém apenas anexos baixáveis (status done, não corrompidos).
    const valid: any[] = [];
    const seenLogical = new Set<string>();
    for (const rd of lawsuits) {
      const instance = rd?.instance != null ? String(rd.instance) : null;
      const direct = Array.isArray(rd?.attachments) ? rd.attachments : [];
      for (const a of direct) {
        if (String(a?.status || "done").toLowerCase() !== "done" || a?.corrupted === true) continue;
        const downloadId = a?.attachment_id || a?.id || a?.step_id;
        if (!downloadId) continue;
        const logical = attachmentLogicalKey(a?.attachment_name || a?.name, a?.attachment_date || a?.date, a?.extension || a?.ext);
        if (seenLogical.has(logical)) continue;
        seenLogical.add(logical);
        valid.push({
          processo_numero: cnj,
          cnj,
          instance,
          attachment_id: String(downloadId),
          step_id: a?.step_id ? String(a.step_id) : null,
          attachment_name: a?.attachment_name || a?.name || null,
          attachment_date: a?.attachment_date || a?.date || null,
          extension: a?.extension || a?.ext || null,
          status: a?.status || "done",
          corrupted: a?.corrupted ?? false,
          raw_attachment: a,
          created_by: user.id,
        });
      }
    }

    // Substitui a lista persistida do processo apenas se houver anexos válidos
    // — assim não destruímos a lista quando a Judit responde vazio.
    if (valid.length > 0) {
      await supabase.from("judit_anexos").delete().eq("processo_numero", cnj);
      const CHUNK = 200;
      for (let i = 0; i < valid.length; i += CHUNK) {
        const slice = valid.slice(i, i + CHUNK);
        const { error: insErr } = await supabase.from("judit_anexos").insert(slice as any);
        if (insErr) return json({ error: "insert: " + insErr.message }, 200);
      }
    }
    return json({ ok: true, total: valid.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}