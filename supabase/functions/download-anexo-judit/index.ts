import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUDIT_LAWSUITS = "https://lawsuits.production.judit.io";

function normalizeAttachmentKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s*\(C[ÓO]PIA\)\s*/gi, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, "")
    .toUpperCase();
}

function uniquePush(arr: string[], value: unknown) {
  const v = String(value ?? "").trim();
  if (v && !arr.includes(v)) arr.push(v);
}

function instanceCandidates(value: unknown) {
  const order: string[] = [];
  const primary = String(value || "1").match(/\d+/)?.[0] || "1";
  uniquePush(order, primary);
  for (const i of ["1", "2", "3"]) uniquePush(order, i);
  return order;
}

function collectAttachmentCandidates(payload: any, wanted: { id: string; name?: string; date?: string; ext?: string }) {
  const out: Array<{ ids: string[]; instances: string[] }> = [];
  const wantedName = normalizeAttachmentKey(wanted.name);
  const wantedDate = String(wanted.date || "").trim();
  const wantedExt = String(wanted.ext || "").trim().toLowerCase().replace(/^\./, "");

  const roots: any[] = [];
  const addRoot = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) value.forEach(addRoot);
    else if (Array.isArray(value?.response_data)) value.response_data.forEach(addRoot);
    else if (value?.response_data && typeof value.response_data === "object") addRoot(value.response_data);
    else if (typeof value === "object") roots.push(value);
  };
  addRoot(payload);

  const maybeAdd = (a: any, rd: any, step?: any) => {
    const ids: string[] = [];
    uniquePush(ids, a?.attachment_id);
    uniquePush(ids, a?.id);
    uniquePush(ids, a?.step_id);
    uniquePush(ids, step?.step_id);
    uniquePush(ids, step?.id);

    if (!ids.length) return;
    const name = normalizeAttachmentKey(a?.attachment_name || a?.name || a?.title);
    const date = String(a?.attachment_date || a?.date || step?.step_date || step?.date || "").trim();
    const ext = String(a?.extension || a?.ext || "").trim().toLowerCase().replace(/^\./, "");
    const idMatches = ids.includes(wanted.id);
    const metaMatches = !!wantedName && name === wantedName && (!wantedDate || date === wantedDate) && (!wantedExt || ext === wantedExt);
    if (!idMatches && !metaMatches) return;
    if (String(a?.status || "done").toLowerCase() !== "done" || a?.corrupted === true) return;

    out.push({ ids, instances: instanceCandidates(rd?.instance || rd?.crawler?.instance) });
  };

  for (const rd of roots) {
    if (Array.isArray(rd?.attachments)) {
      for (const a of rd.attachments) maybeAdd(a, rd);
    }
    if (Array.isArray(rd?.steps)) {
      for (const step of rd.steps) {
        if (!Array.isArray(step?.attachments)) continue;
        for (const a of step.attachments) maybeAdd(a, rd, step);
      }
    }
  }
  return out;
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

    const { cnj, instance, attachment_id, filename, attachment_name, attachment_date, extension } = await req.json();
    if (!cnj || !attachment_id) return json({ error: "cnj e attachment_id obrigatórios" }, 400);

    const cnjClean = String(cnj).replace(/[^0-9.-]/g, "").trim();

    // Tenta a instância informada e, em caso de 404 ATTACHMENT_NOT_FOUND, faz
    // fallback para outras instâncias (1, 2, 3) — a Judit às vezes devolve o
    // anexo no nível da capa sem indicar a instância correta.
    const tried = new Set<string>();
    const idsToTry = [String(attachment_id)];
    const order = instanceCandidates(instance);

    let res: Response | null = null;
    let lastErr = "";
    const tryDownload = async (ids: string[], instances: string[]) => {
      for (const id of ids) {
        for (const inst of instances) {
          const key = `${id}::${inst}`;
          if (tried.has(key)) continue;
          tried.add(key);
          const url = `${JUDIT_LAWSUITS}/lawsuits/${encodeURIComponent(cnjClean)}/${inst}/attachments/${encodeURIComponent(id)}`;
          const r = await fetch(url, { headers: { "api-key": juditApiKey } });
          if (r.ok) return r;
          const txt = await r.text();
          lastErr = `HTTP ${r.status}: ${txt.substring(0, 200)}`;
          if (r.status !== 404) return r;
        }
      }
      return null;
    };

    res = await tryDownload(idsToTry, order);

    if (res && !res.ok) return json({ error: lastErr }, 200);

    if (!res) {
      const lookup = await fetch(`${JUDIT_LAWSUITS}/lawsuits/${encodeURIComponent(cnjClean)}`, {
        headers: { "api-key": juditApiKey, "Content-Type": "application/json" },
      });
      if (lookup.ok) {
        const lawsuitPayload = await lookup.json();
        const candidates = collectAttachmentCandidates(lawsuitPayload, {
          id: String(attachment_id),
          name: attachment_name || filename,
          date: attachment_date,
          ext: extension,
        });
        for (const cand of candidates) {
          res = await tryDownload(cand.ids, cand.instances);
          if (res?.ok) break;
          if (res && !res.ok) return json({ error: lastErr }, 200);
        }
      } else {
        lastErr = `lookup HTTP ${lookup.status}: ${(await lookup.text()).substring(0, 200)}`;
      }
    }
    if (!res) {
      return json({ error: `Anexo não encontrado em nenhuma instância (1/2/3). Último erro: ${lastErr}` }, 200);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const rawName = String(filename || `documento_${attachment_id}.pdf`);
    const safeName = rawName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-zA-Z0-9._-]+/g, "_") // only safe ascii for storage key
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      || `documento_${attachment_id}.pdf`;
    const contentType = res.headers.get("content-type") || (safeName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    const path = `judit-temp/${user.id}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from("documentos_processos").upload(path, buf, { upsert: true, contentType });
    if (upErr) return json({ error: "Upload falhou: " + upErr.message }, 200);
    const { data: signed, error: signErr } = await supabase.storage.from("documentos_processos").createSignedUrl(path, 3600);
    if (signErr || !signed?.signedUrl) return json({ error: "Falha ao gerar URL: " + (signErr?.message || "") }, 200);
    return json({
      signed_url: signed.signedUrl,
      filename: safeName,
      storage_path: path,
      content_type: contentType,
      file_size: buf.byteLength,
    }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}