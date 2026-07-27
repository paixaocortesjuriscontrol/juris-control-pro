import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, encryptKurier, jsonResponse } from "../_kurier-shared/crypto.ts";

// Salva (criptografa) a senha de uma credencial Kurier.
// Body: { credencial_id: uuid, senha: string }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "coordenador" || r.role === "assistente_coordenador");
    if (!allowed) return jsonResponse({ error: "Forbidden" }, 403);

    const { credencial_id, senha } = await req.json().catch(() => ({} as any));
    if (!credencial_id || typeof senha !== "string" || senha.length < 1) {
      return jsonResponse({ error: "credencial_id e senha são obrigatórios" }, 400);
    }
    if (senha.length > 500) return jsonResponse({ error: "senha muito longa" }, 400);

    const senha_encrypted = await encryptKurier(senha);
    const { error: upErr } = await admin
      .from("kurier_credenciais")
      .update({ senha_encrypted, ultimo_status: "Senha atualizada" })
      .eq("id", credencial_id);
    if (upErr) return jsonResponse({ error: upErr.message }, 500);

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});