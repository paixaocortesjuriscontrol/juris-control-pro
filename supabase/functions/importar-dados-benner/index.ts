import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type JsonRecord = Record<string, unknown>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      rows = [],
      userId,
      preserveFields = ["situacao_processo", "status"],
    } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "Nenhum registro enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ ok: false, error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId && userId !== authData.user.id) {
      return new Response(JSON.stringify({ ok: false, error: "Usuário inválido" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const effectiveUserId = authData.user.id;
    const processos = [...new Set(rows.map((row: JsonRecord) => String(row.processo || "").trim()).filter(Boolean))];

    const existingMap = new Map<string, string>();
    for (let i = 0; i < processos.length; i += 500) {
      const batch = processos.slice(i, i + 500);
      const { data, error } = await serviceClient
        .from("dados_benner")
        .select("id, processo")
        .in("processo", batch);

      if (error) {
        throw new Error(`Erro ao buscar registros existentes: ${error.message}`);
      }

      for (const item of data || []) {
        if (item.processo) existingMap.set(item.processo, item.id);
      }
    }

    const toInsert: JsonRecord[] = [];
    const toUpdate: JsonRecord[] = [];

    for (const originalRow of rows as JsonRecord[]) {
      const processo = String(originalRow.processo || "").trim();
      if (!processo) continue;

      const row: JsonRecord = { ...originalRow, user_id: effectiveUserId };

      if (existingMap.has(processo)) {
        const updateRow: JsonRecord = { id: existingMap.get(processo)! };
        for (const [key, value] of Object.entries(row)) {
          if (key === "id" || preserveFields.includes(key)) continue;
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
      const { error } = await serviceClient.from("dados_benner").insert(batch);
      if (error) {
        throw new Error(`Erro ao inserir lote ${Math.floor(i / 500) + 1}: ${error.message}`);
      }
      inserted += batch.length;
    }

    for (let i = 0; i < toUpdate.length; i += 500) {
      const batch = toUpdate.slice(i, i + 500);
      const { error } = await serviceClient
        .from("dados_benner")
        .upsert(batch, { onConflict: "id" });
      if (error) {
        throw new Error(`Erro ao atualizar lote ${Math.floor(i / 500) + 1}: ${error.message}`);
      }
      updated += batch.length;
    }

    return new Response(JSON.stringify({ ok: true, inserted, updated, total: inserted + updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
