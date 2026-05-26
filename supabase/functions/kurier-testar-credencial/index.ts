import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildKurierUrl,
  corsHeaders,
  decryptKurier,
  getKurierBaseUrlFromDb,
  jsonResponse,
} from "../_kurier-shared/crypto.ts";

// Testa uma credencial Kurier sem confirmar publicações.
// Body:
//   { credencial_id: uuid }                          -> usa senha do banco
//   { login: string, senha: string, base_url?: str }-> testa com valores brutos

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

    // Role check
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "coordenador");
    if (!allowed) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    let login: string | undefined = body.login;
    let senha: string | undefined = body.senha;
    const baseUrlOverride: string | undefined = body.base_url;

    if (body.credencial_id) {
      const { data: cred, error: credErr } = await admin
        .from("kurier_credenciais")
        .select("login, senha_encrypted")
        .eq("id", body.credencial_id)
        .maybeSingle();
      if (credErr || !cred) return jsonResponse({ error: "Credencial não encontrada" }, 404);
      if (!cred.senha_encrypted) return jsonResponse({ error: "Credencial sem senha cadastrada" }, 400);
      login = cred.login;
      senha = await decryptKurier(cred.senha_encrypted);
    }

    if (!login || !senha) return jsonResponse({ error: "login e senha são obrigatórios" }, 400);

    const baseUrl = baseUrlOverride && baseUrlOverride.trim()
      ? baseUrlOverride.trim()
      : await getKurierBaseUrlFromDb(admin);

    const url = buildKurierUrl(
      baseUrl,
      "/api/KJuridico/ConsultarQuantidadePublicacoesDisponiveis",
      { login, senha },
    );

    const t0 = Date.now();
    let httpStatus = 0;
    let texto = "";
    try {
      const resp = await fetch(url, { method: "GET" });
      httpStatus = resp.status;
      texto = await resp.text();
    } catch (e) {
      return jsonResponse({ ok: false, erro: `Falha de rede: ${String(e)}`, base_url: baseUrl }, 200);
    }
    const ms = Date.now() - t0;

    if (httpStatus < 200 || httpStatus >= 300) {
      const friendlyErro = httpStatus === 401
        ? "HTTP 401 — login ou senha recusados pela Kurier. Confira a credencial informada no manual/portal Kurier."
        : `HTTP ${httpStatus}${texto.trim() ? ` — ${texto.slice(0, 500)}` : " — resposta sem mensagem"}`;
      if (body.credencial_id) {
        await admin
          .from("kurier_credenciais")
          .update({
            ultimo_uso: new Date().toISOString(),
            ultimo_status: friendlyErro.slice(0, 180),
          })
          .eq("id", body.credencial_id);
      }
      return jsonResponse({
        ok: false,
        http_status: httpStatus,
        erro: friendlyErro,
        raw: texto.slice(0, 500),
        base_url: baseUrl,
        ms,
      });
    }

    // Resposta esperada: número ou JSON com total
    let total: number | null = null;
    const num = Number(texto.trim());
    if (!Number.isNaN(num)) total = num;
    else {
      try {
        const j = JSON.parse(texto);
        total = Number(j?.total ?? j?.Total ?? j?.quantidade ?? j?.Quantidade ?? 0) || 0;
      } catch { /* ignore */ }
    }

    // Atualiza ultimo_uso/ultimo_status se foi feito por credencial_id
    if (body.credencial_id) {
      await admin
        .from("kurier_credenciais")
        .update({
          ultimo_uso: new Date().toISOString(),
          ultimo_status: total !== null ? `OK (${total} pendentes)` : `OK (resposta: ${texto.slice(0, 80)})`,
        })
        .eq("id", body.credencial_id);
    }

    return jsonResponse({
      ok: true,
      total,
      raw: texto.slice(0, 500),
      base_url: baseUrl,
      ms,
    });
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});