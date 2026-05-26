import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildKurierAuthHeaders,
  buildKurierUrl,
  corsHeaders,
  decryptKurier,
  getKurierBaseUrlFromDb,
  jsonResponse,
} from "../_kurier-shared/crypto.ts";

// Retorna a quantidade de publicações pendentes para uma ou todas as credenciais ativas.
// Body: { credencial_id?: uuid }

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

    const body = await req.json().catch(() => ({} as any));
    const baseUrl = await getKurierBaseUrlFromDb(admin);

    let q = admin.from("kurier_credenciais").select("id, login, senha_encrypted").not("senha_encrypted", "is", null);
    if (body.credencial_id) q = q.eq("id", body.credencial_id); else q = q.eq("ativo", true);
    const { data: creds, error } = await q;
    if (error) return jsonResponse({ error: error.message }, 500);

    const resultados: any[] = [];
    for (const cred of creds ?? []) {
      try {
        const senha = await decryptKurier((cred as any).senha_encrypted);
        const url = buildKurierUrl(baseUrl, "/api/KJuridico/ConsultarQuantidadePublicacoesDisponiveis", {
        });
        const resp = await fetch(url, { headers: buildKurierAuthHeaders(cred.login, senha) });
        const texto = await resp.text();
        let total = 0;
        const n = Number(texto.trim());
        if (!Number.isNaN(n)) total = n;
        else {
          try {
            const j = JSON.parse(texto);
            total = Number(j?.total ?? j?.Total ?? j?.quantidade ?? 0) || 0;
          } catch { /* */ }
        }
        resultados.push({ credencial_id: cred.id, login: cred.login, total, http: resp.status });
      } catch (e) {
        resultados.push({ credencial_id: cred.id, login: cred.login, erro: String(e) });
      }
    }

    return jsonResponse({ ok: true, resultados, total_geral: resultados.reduce((a, r) => a + (r.total ?? 0), 0) });
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});