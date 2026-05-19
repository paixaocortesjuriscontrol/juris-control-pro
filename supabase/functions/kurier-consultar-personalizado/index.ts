import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildKurierUrl,
  corsHeaders,
  decryptKurier,
  getKurierBaseUrlFromDb,
  jsonResponse,
} from "../_kurier-shared/crypto.ts";

// Consulta personalizada (NÃO confirma). Útil para reconsultar histórico.
// Body: { credencial_id, data: 'YYYY-MM-DD', termo?, tribunal?, estado? }

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
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "coordenador");
    if (!allowed) return jsonResponse({ error: "Forbidden" }, 403);

    const { credencial_id, data, termo, tribunal, estado } = await req.json();
    if (!credencial_id || !data) return jsonResponse({ error: "credencial_id e data são obrigatórios" }, 400);

    const { data: cred } = await admin
      .from("kurier_credenciais")
      .select("login, senha_encrypted")
      .eq("id", credencial_id)
      .maybeSingle();
    if (!cred?.senha_encrypted) return jsonResponse({ error: "Credencial sem senha" }, 400);
    const senha = await decryptKurier(cred.senha_encrypted);
    const baseUrl = await getKurierBaseUrlFromDb(admin);

    const url = buildKurierUrl(baseUrl, "/api/KJuridico/ConsultarPublicacoesPersonalizado", {
      login: cred.login, senha, data, termo, tribunal, estado,
    });
    const resp = await fetch(url);
    const texto = await resp.text();
    let payload: unknown;
    try { payload = JSON.parse(texto); } catch { payload = texto; }

    return jsonResponse({ ok: resp.ok, http: resp.status, payload });
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});