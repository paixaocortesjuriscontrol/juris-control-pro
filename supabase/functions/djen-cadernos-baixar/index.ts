// DJEN Cadernos (experimental): a VPS Hostinger baixa e lê o caderno completo do
// Comunica; esta função só grava uma página por chamada (limite de CPU do Supabase).
// Totalmente separado do DJEN Servidor.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const PAGINA = 1000;

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") || "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return j({ error: "nao_autenticado" }, 401);
  const admin = createClient(url, key);
  const { data: isAdm } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (!isAdm) return j({ error: "somente_admin" }, 403);

  const body = await req.json().catch(() => ({}));
  const { tribunal, data, meio = "D" } = body;
  const offset = Math.max(0, Number(body.offset) || 0);
  if (!tribunal || !/^\d{4}-\d{2}-\d{2}$/.test(String(data)) || !/^[A-Z]$/.test(String(meio))) return j({ error: "parametros_invalidos" }, 400);
  const trib = String(tribunal).toUpperCase().replace(/[^A-Z0-9]/g, "");

  let cad: any;
  if (offset === 0) {
    const { data: c, error } = await admin.from("djen_cadernos").upsert({
      tribunal: trib, data, meio, status: "baixando", erro: null, solicitado_por: u.user.id,
      tamanho_bytes: null, total_comunicacoes: 0, tentativas: 0, duracao_ms: null,
    }, { onConflict: "tribunal,data,meio" }).select().single();
    if (error || !c) return j({ error: error?.message || "falha_registro" }, 500);
    cad = c;
    await admin.from("djen_cadernos_comunicacoes").delete().eq("caderno_id", cad.id);
  } else {
    const { data: c } = await admin.from("djen_cadernos").select("*").eq("tribunal", trib).eq("data", data).eq("meio", meio).maybeSingle();
    if (!c) return j({ error: "caderno_nao_iniciado" }, 400);
    cad = c;
  }

  const log = (via: string, s: number | null, m: string, ok: boolean) =>
    admin.from("djen_cadernos_tentativas").insert({ caderno_id: cad.id, via, http_status: s, mensagem: m.slice(0, 500), sucesso: ok });
  const falhar = async (erro: string) => {
    await admin.from("djen_cadernos").update({ status: "erro", erro, tentativas: (cad.tentativas || 0) + 1 }).eq("id", cad.id);
    return j({ ok: false, erro });
  };

  const { data: vps } = await admin.from("djen_proxy_pool").select("base_url,token")
    .eq("enabled", true).ilike("base_url", "%djen-hostinger%").maybeSingle();
  if (!vps?.token) return await falhar("VPS Hostinger não encontrada ou sem token no pool.");
  const base = String(vps.base_url).replace(/\/+$/, "");
  const q = new URLSearchParams({ tribunal: trib, data, meio, offset: String(offset), limit: String(PAGINA) });
  if (offset === 0) q.set("renovar", "1");

  let r: Response;
  try {
    r = await fetch(`${base}/caderno?${q}`, { headers: { "x-proxy-token": vps.token } });
  } catch (e) {
    await log("hostinger", null, String((e as Error).message), false);
    return await falhar(`Não foi possível falar com a VPS Hostinger: ${(e as Error).message}`);
  }
  const txt = await r.text();
  if (r.status === 404 && txt.includes("not_found")) {
    await log("hostinger", 404, txt, false);
    return await falhar("A VPS Hostinger ainda está com o programa antigo (sem a leitura de cadernos). Atualize e reinicie o serviço.");
  }
  if (r.status === 404) {
    await log("hostinger", 404, "Nenhum caderno", false);
    return await falhar(`O DJEN respondeu (sem bloqueio), mas ainda não há caderno do ${trib} para ${data.split("-").reverse().join("/")}. Tente uma data anterior.`);
  }
  if (!r.ok) { await log("hostinger", r.status, txt, false); return await falhar(`VPS Hostinger: ${txt.slice(0, 300)}`); }

  const p = JSON.parse(txt);
  if (offset === 0) await log("hostinger", 200, `caderno lido na VPS: ${p.total} comunicações, ${p.tamanho || "?"} bytes ${p.meta ? JSON.stringify(p.meta).slice(0, 300) : ""}`, true);
  const linhas = (p.itens || []).map((c: any) => ({ ...c, caderno_id: cad.id }));
  for (let i = 0; i < linhas.length; i += 250) {
    const { error } = await admin.from("djen_cadernos_comunicacoes").insert(linhas.slice(i, i + 250));
    if (error) return await falhar(`Falha ao gravar comunicações: ${error.message}`);
  }
  const gravadas = offset + linhas.length;
  const fim = p.proximo == null;
  await admin.from("djen_cadernos").update({
    status: fim ? "ok" : "baixando", total_comunicacoes: gravadas, tamanho_bytes: p.tamanho || null,
    tentativas: 1, duracao_ms: Date.now() - new Date(cad.created_at || Date.now()).getTime(),
  }).eq("id", cad.id);
  return j({ ok: true, total: p.total, gravadas, proximo: p.proximo ?? null });
});
