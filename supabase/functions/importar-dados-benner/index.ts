import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type JsonRecord = Record<string, unknown>;
type Failure = {
  processo: string;
  operation: "insert" | "update" | "lookup" | "auth" | "request";
  error: string;
};

function respond(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getProcesso(row: JsonRecord) {
  return String(row.processo || "").trim();
}

function getDossie(row: JsonRecord) {
  return String(row.dossie || "").trim();
}

function getCompositeKey(row: JsonRecord) {
  const processo = getProcesso(row);
  const dossie = getDossie(row);
  return processo && dossie ? `${processo}::${dossie}` : "";
}

function dedupeRowsByCompositeKey(rows: JsonRecord[]) {
  const uniqueRows = new Map<string, JsonRecord>();

  for (const row of rows) {
    const processo = getProcesso(row);
    const dossie = getDossie(row);
    const key = getCompositeKey(row);
    if (!key) continue;

    const previous = uniqueRows.get(key) || {};
    const merged: JsonRecord = { ...previous, processo, dossie };

    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined || value === "") continue;
      merged[key] = value;
    }

    uniqueRows.set(key, merged);
  }

  return Array.from(uniqueRows.values());
}

async function insertBatchWithFallback(serviceClient: ReturnType<typeof createClient>, batch: JsonRecord[]) {
  const failures: Failure[] = [];
  let inserted = 0;

  const { error } = await serviceClient.from("dados_benner").insert(batch);
  if (!error) {
    return { inserted: batch.length, failures };
  }

  console.error("[importar-dados-benner] batch insert failed, retrying row-by-row:", error.message);

  for (const row of batch) {
    const processo = getProcesso(row);
    const { error: rowError } = await serviceClient.from("dados_benner").insert(row);
    if (rowError) {
      failures.push({
        processo,
        operation: "insert",
        error: rowError.message,
      });
    } else {
      inserted += 1;
    }
  }

  return { inserted, failures };
}

async function updateBatchWithFallback(serviceClient: ReturnType<typeof createClient>, batch: JsonRecord[]) {
  const failures: Failure[] = [];
  let updated = 0;

  const { error } = await serviceClient.from("dados_benner").upsert(batch, { onConflict: "id" });
  if (!error) {
    return { updated: batch.length, failures };
  }

  console.error("[importar-dados-benner] batch update failed, retrying row-by-row:", error.message);

  for (const row of batch) {
    const processo = getProcesso(row);
    const { error: rowError } = await serviceClient.from("dados_benner").upsert(row, { onConflict: "id" });
    if (rowError) {
      failures.push({
        processo,
        operation: "update",
        error: rowError.message,
      });
    } else {
      updated += 1;
    }
  }

  return { updated, failures };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ ok: false, error: "Unauthorized", failed: 0, diagnostics: { stage: "auth_header" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const effectiveUserId = claimsData?.claims?.sub;

    if (claimsError || !effectiveUserId) {
      return respond({
        ok: false,
        error: "Usuário não autenticado",
        failed: 0,
        diagnostics: { stage: "claims", details: claimsError?.message || null },
      });
    }

    let body: { rows?: JsonRecord[]; userId?: string; preserveFields?: string[] };
    try {
      body = await req.json();
    } catch {
      return respond({ ok: false, error: "Payload inválido", failed: 0, diagnostics: { stage: "json" } });
    }

    const rows = Array.isArray(body.rows) ? body.rows : [];
    const userId = body.userId;
    const preserveFields = Array.isArray(body.preserveFields) ? body.preserveFields : ["situacao_processo", "status"];

    if (!rows.length) {
      return respond({ ok: false, error: "Nenhum registro enviado", failed: 0, diagnostics: { stage: "validation" } });
    }

    if (userId && userId !== effectiveUserId) {
      return respond({ ok: false, error: "Usuário inválido", failed: rows.length, diagnostics: { stage: "user_id_mismatch" } });
    }

    const normalizedRows = dedupeRowsByCompositeKey(rows);
    const deduplicated = rows.length - normalizedRows.length;

    if (deduplicated > 0) {
      console.warn(`[importar-dados-benner] ${deduplicated} linha(s) duplicada(s) por processo+dossie consolidadas antes da persistência`);
    }

    const processos = [...new Set(normalizedRows.map(getProcesso).filter(Boolean))];
    const existingMap = new Map<string, { id: string; updated_at?: string | null }>();
    const failures: Failure[] = [];

    for (let i = 0; i < processos.length; i += 500) {
      const batch = processos.slice(i, i + 500);
      const { data, error } = await serviceClient
        .from("dados_benner")
        .select("id, processo, dossie, updated_at")
        .in("processo", batch);

      if (error) {
        console.error("[importar-dados-benner] lookup error:", error.message);
        return respond({
          ok: false,
          error: `Erro ao buscar registros existentes: ${error.message}`,
          failed: rows.length,
          diagnostics: { stage: "lookup", sampleFailures: [{ processo: "", operation: "lookup", error: error.message }] },
        });
      }

      for (const item of data || []) {
        const key = getCompositeKey(item as JsonRecord);
        if (!key) continue;

        const current = existingMap.get(key);
        if (!current || (item.updated_at && (!current.updated_at || item.updated_at > current.updated_at))) {
          existingMap.set(key, { id: item.id, updated_at: item.updated_at });
        }
      }
    }

    const toInsert: JsonRecord[] = [];
    const toUpdate: JsonRecord[] = [];

    for (const originalRow of normalizedRows) {
      const processo = getProcesso(originalRow);
      const dossie = getDossie(originalRow);
      const compositeKey = getCompositeKey(originalRow);
      if (!processo || !dossie || !compositeKey) continue;

      const row: JsonRecord = { ...originalRow, user_id: effectiveUserId };

      if (existingMap.has(compositeKey)) {
        const updateRow: JsonRecord = { id: existingMap.get(compositeKey)!.id };
        for (const [key, value] of Object.entries(row)) {
          if (key === "id" || preserveFields.includes(key)) continue;
          // Skip empty/null values to avoid overwriting existing data
          if (value === null || value === undefined || value === "") continue;
          // Keep boolean false values (they are intentional)
          updateRow[key] = value;
        }
        toUpdate.push(updateRow);
      } else {
        toInsert.push(row);
      }
    }

    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < toInsert.length; i += 500) {
      const batch = toInsert.slice(i, i + 500);
      const result = await insertBatchWithFallback(serviceClient, batch);
      inserted += result.inserted;
      failures.push(...result.failures);
    }

    for (let i = 0; i < toUpdate.length; i += 500) {
      const batch = toUpdate.slice(i, i + 500);
      const result = await updateBatchWithFallback(serviceClient, batch);
      updated += result.updated;
      failures.push(...result.failures);
    }

    if (failures.length > 0) {
      console.error("[importar-dados-benner] partial failures:", JSON.stringify(failures.slice(0, 5)));
    }

    return respond({
      ok: failures.length === 0,
      inserted,
      updated,
      failed: failures.length,
      total: inserted + updated,
      deduplicated,
      error: failures.length ? `Falha em ${failures.length} registro(s)` : null,
      diagnostics: failures.length
        ? {
            stage: "persist",
            sampleFailures: failures.slice(0, 10),
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("[importar-dados-benner] unexpected error:", message);
    return respond({ ok: false, error: message, failed: 0, diagnostics: { stage: "catch" } });
  }
});
