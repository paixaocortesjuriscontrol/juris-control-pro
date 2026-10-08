// Busca direta no PJe (MNI consultarAvisosPendentes) com a credencial de cada usuário,
// filtrando os avisos pelos termos DJEN ativos das coordenações do usuário.
// O aviso NÃO é marcado como ciente: só se usa consultarTeorComunicacao.
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizar, extrairPalavraChavePura } from "../_kurier-shared/djenMatch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ENC = Deno.env.get("COFRE_ENCRYPTION_KEY") ?? "";
const PROXY_URL = Deno.env.get("N8N_PJE_PROXY_URL") ?? "";
const PROXY_TOKEN = Deno.env.get("N8N_PJE_PROXY_TOKEN") ?? "";

export const TRIBUNAIS = [
  "TST", ...Array.from({ length: 24 }, (_, i) => `TRT${i + 1}`),
];
const endpoint = (t: string) =>
  `https://pje.${t.toLowerCase()}.jus.br/pje-integracao-api/mni300/intercomunicacao`;

async function key(usage: KeyUsage[]) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(ENC.padEnd(32, "0").slice(0, 32)), "AES-GCM", false, usage);
}
async function encrypt(t: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(["encrypt"]), new TextEncoder().encode(t)));
  const all = new Uint8Array(12 + c.length); all.set(iv); all.set(c, 12);
  return btoa(String.fromCharCode(...all));
}
async function decrypt(v: string) {
  const all = Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, await key(["decrypt"]), all.slice(12)));
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NS = "http://www.cnj.jus.br/servico-intercomunicacao-2.2.2";

interface PfxOpts { pfx_base64: string | null; pfx_password: string | null }
const SEM_PFX: PfxOpts = { pfx_base64: null, pfx_password: null };

// deno-lint-ignore no-explicit-any
async function carregarPfx(admin: any, c: any): Promise<PfxOpts> {
  if (!c.certificado_path) return SEM_PFX;
  const { data, error } = await admin.storage.from("certificados-a1").download(c.certificado_path);
  if (error || !data) throw new Error("Não consegui ler o certificado digital salvo");
  const bytes = new Uint8Array(await data.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const senhaCert = c.certificado_senha_cifrada ? await decrypt(c.certificado_senha_cifrada) : null;
  return { pfx_base64: btoa(bin), pfx_password: senhaCert };
}

async function soap(tribunal: string, action: string, inner: string, pfx: PfxOpts = SEM_PFX): Promise<string> {
  if (!PROXY_URL || !PROXY_TOKEN) throw new Error("Proxy PJe não configurado");
  const body = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="${NS}"><soapenv:Header/><soapenv:Body><ser:${action}>${inner}</ser:${action}></soapenv:Body></soapenv:Envelope>`;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 35000);
  try {
    const r = await fetch(PROXY_URL, {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", "X-Proxy-Token": PROXY_TOKEN },
      body: JSON.stringify({ endpoint: endpoint(tribunal), soap_action: action, soap_body: body, pfx_base64: pfx.pfx_base64, pfx_password: pfx.pfx_password, timeout_ms: 30000 }),
    });
    if (!r.ok) throw new Error(`Proxy HTTP ${r.status}`);
    const j = await r.json();
    const txt = String(j.body ?? j.data ?? "");
    const fault = txt.match(/faultstring[^>]*>([\s\S]*?)<\//i);
    if (fault) throw new Error(fault[1].trim().slice(0, 300));
    const ok = txt.match(/<[\w:]*sucesso[^>]*>\s*false/i);
    if (ok) {
      const m = txt.match(/<[\w:]*mensagem[^>]*>([\s\S]*?)<\//i);
      throw new Error((m?.[1] ?? "Falha no PJe").trim().slice(0, 300));
    }
    return txt;
  } finally { clearTimeout(to); }
}

const cred = (cpf: string, senha: string) =>
  `<ser:idConsultante>${esc(cpf)}</ser:idConsultante><ser:senhaConsultante>${esc(senha)}</ser:senhaConsultante>`;

interface Aviso { id: string; processo: string | null; data: string | null; tipo: string | null; orgao: string | null }
function parseAvisos(xml: string): Aviso[] {
  const out: Aviso[] = [];
  const re = /<([\w]+:)?aviso\b([^>]*)>([\s\S]*?)<\/\1?aviso>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = m[2], inner = m[3];
    const at = (s: string, n: string) => s.match(new RegExp(`\\b${n}="([^"]*)"`, "i"))?.[1] ?? null;
    const id = at(attrs, "idAviso"); if (!id) continue;
    const proc = inner.match(/<[\w:]*processo\b([^>]*)>/i)?.[1] ?? "";
    const orgao = inner.match(/<[\w:]*orgaoJulgador\b([^>]*)>/i)?.[1] ?? "";
    out.push({ id, processo: at(proc, "numero"), data: at(attrs, "dataDisponibilizacao"), tipo: at(attrs, "tipoComunicacao"), orgao: at(orgao, "nomeOrgao") });
  }
  return out;
}
function parseData(d: string | null): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "12"}:${m[5] ?? "00"}:00-03:00`;
  const dt = new Date(d); return isNaN(dt.getTime()) ? null : dt.toISOString();
}
function teorTexto(xml: string): string {
  const t = xml.match(/<[\w:]*teor[^>]*>([\s\S]*?)<\/[\w:]*teor>/i)?.[1];
  let s = t ?? "";
  if (!s) {
    const b64 = xml.match(/<[\w:]*conteudo[^>]*>([A-Za-z0-9+/=\s]{40,})<\//i)?.[1];
    if (b64) { try { s = new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0))); } catch { /* */ } }
  }
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
const hash = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");

// deno-lint-ignore no-explicit-any
function casaTermo(m: any, textoNorm: string, tribunal: string): boolean {
  if (m.tribunais?.length && !m.tribunais.some((t: string) => t.toUpperCase() === tribunal || t.toUpperCase() === "TODOS")) return false;
  const tem = (s: string) => { const n = normalizar(s); return !!n && ` ${textoNorm} `.includes(` ${n} `); };
  let ok = false;
  if (m.tipo === "advogado" && m.oab) {
    const oab = String(m.oab).replace(/\D/g, "");
    ok = !!oab && new RegExp(`OAB\\s*(?:[A-Z]{2}\\s*)?0*${oab}\\b`).test(textoNorm);
  } else {
    ok = tem(extrairPalavraChavePura(m.termo_busca)) || (m.termos_or ?? []).some((t: string) => tem(t));
  }
  if (!ok) return false;
  if (m.condicao_concomitante && !tem(m.condicao_concomitante)) return false;
  if ((m.exclusoes ?? []).some((e: string) => e && tem(e))) return false;
  return true;
}

// deno-lint-ignore no-explicit-any
async function executar(admin: any, c: any, origem: string, apenasTribunal?: string) {
  const senha = await decrypt(c.senha_cifrada);
  const pfx = await carregarPfx(admin, c);
  const { data: membros } = await admin.from("membros_coordenacao").select("coordenacao_id").eq("usuario_id", c.usuario_id);
  const coords = [...new Set((membros ?? []).map((x: { coordenacao_id: string }) => x.coordenacao_id))];
  const { data: termos } = coords.length
    ? await admin.from("monitoramentos_djen").select("*").in("coordenacao_id", coords).eq("ativo", true).eq("arquivado", false)
    : { data: [] };
  const resumo: Record<string, unknown>[] = [];
  let erroGeral: string | null = null;
  for (const tribunal of (apenasTribunal ? [apenasTribunal] : c.tribunais)) {
    const r = { tribunal, encontrados: 0, filtrados: 0, novos: 0, erro: null as string | null };
    try {
      const avisos = parseAvisos(await soap(tribunal, "consultarAvisosPendentes", cred(c.cpf, senha), pfx));
      r.encontrados = avisos.length;
      for (const a of avisos) {
        let teor = "";
        try {
          teor = teorTexto(await soap(tribunal, "consultarTeorComunicacao", cred(c.cpf, senha) + `<ser:identificadorAviso>${esc(a.id)}</ser:identificadorAviso>`, pfx));
        } catch { /* sem teor */ }
        const texto = `${a.processo ?? ""} ${a.orgao ?? ""} ${teor}`;
        const norm = normalizar(texto);
        // deno-lint-ignore no-explicit-any
        const casados = (termos ?? []).filter((m: any) => casaTermo(m, norm, tribunal));
        if (!casados.length) continue;
        r.filtrados++;
        const dataIso = parseData(a.data);
        const digits = (a.processo ?? "").replace(/\D/g, "");
        const vistos = new Set<string>();
        for (const m of casados) {
          if (vistos.has(m.coordenacao_id)) continue; vistos.add(m.coordenacao_id);
          if (digits && dataIso) {
            const { count } = await admin.from("publicacoes_djen").select("id", { count: "exact", head: true })
              .eq("coordenacao_id", m.coordenacao_id).eq("dedup_processo_digits", digits).eq("dedup_data_ref", dataIso.slice(0, 10));
            if ((count ?? 0) > 0) continue;
          }
          const h = await hash(`pje_direto|${tribunal}|${a.id}|${m.coordenacao_id}`);
          const { count: ja } = await admin.from("publicacoes_djen").select("id", { count: "exact", head: true })
            .eq("coordenacao_id", m.coordenacao_id).eq("hash_conteudo", h);
          if ((ja ?? 0) > 0) continue;
          const { error } = await admin.from("publicacoes_djen").insert({
            monitoramento_id: m.id, coordenacao_id: m.coordenacao_id, hash_conteudo: h,
            conteudo: teor || `Aviso PJe ${a.id} — processo ${a.processo ?? "?"} (teor indisponível)`,
            fonte: "pje_direto", processo_numero: a.processo, data_publicacao: dataIso, data_disponibilizacao: dataIso,
            tribunal, orgao: a.orgao, tipo_comunicacao: a.tipo ?? "Intimação", meio: "PJe direto",
          });
          if (!error) r.novos++; else console.error("insert", error.message);
        }
      }
    } catch (e) { r.erro = String((e as Error).message ?? e); erroGeral = r.erro; }
    await admin.from("execucoes_pje_direto").insert({
      usuario_id: c.usuario_id, coordenacao_id: coords[0] ?? null, tribunal,
      avisos_encontrados: r.encontrados, avisos_filtrados: r.filtrados, novos: r.novos, erro: r.erro, origem,
    });
    resumo.push(r);
  }
  await admin.from("credenciais_pje_usuario").update({
    ultima_execucao: new Date().toISOString(), ultimo_status: erroGeral ? "erro" : "ok", ultima_mensagem: erroGeral,
  }).eq("id", c.id);
  if (erroGeral && origem === "agendada") {
    await admin.from("notificacoes").insert({
      usuario_id: c.usuario_id, titulo: "Busca direta no PJe falhou", tipo: "warning", link: "/credenciais-pje",
      mensagem: `Não foi possível consultar o PJe com sua credencial: ${erroGeral}`,
    });
  }
  return resumo;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const acao = String(body.acao ?? "");

    if (acao === "buscar_todos") {
      const tok = req.headers.get("x-cron-token") ?? "";
      const { data: t } = await admin.from("pje_direto_cron_token").select("token").limit(1).maybeSingle();
      if (!tok || !t || t.token !== tok) return json({ error: "Não autorizado" }, 401);
      const { data: creds } = await admin.from("credenciais_pje_usuario").select("*").eq("ativo", true);
      let total = 0;
      for (const c of creds ?? []) {
        try { (await executar(admin, c, "agendada")).forEach((r) => (total += Number(r.novos))); } catch (e) { console.error(e); }
      }
      return json({ success: true, credenciais: creds?.length ?? 0, novos: total });
    }

    const auth = req.headers.get("Authorization") ?? "";
    const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await uc.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    if (acao === "salvar") {
      const cpf = String(body.cpf ?? "").replace(/\D/g, "");
      const tribunais = (Array.isArray(body.tribunais) ? body.tribunais : []).map(String).filter((t: string) => TRIBUNAIS.includes(t));
      if (cpf.length !== 11) return json({ error: "CPF inválido" }, 400);
      if (!tribunais.length) return json({ error: "Escolha ao menos um tribunal" }, 400);
      const senha = String(body.senha ?? "");
      const { data: atual } = await admin.from("credenciais_pje_usuario").select("id, certificado_path").eq("usuario_id", user.id).maybeSingle();
      if (!atual && senha.length < 4) return json({ error: "Informe a senha do PJe" }, 400);
      const reg: Record<string, unknown> = { usuario_id: user.id, cpf, tribunais, ativo: body.ativo !== false };
      if (senha) reg.senha_cifrada = await encrypt(senha);

      // Certificado digital A1 (.pfx/.p12) — opcional, usado no handshake mTLS do proxy
      const certB64 = String(body.certificado_base64 ?? "");
      if (body.remover_certificado === true) {
        reg.certificado_path = null; reg.certificado_nome = null; reg.certificado_senha_cifrada = null;
        if (atual?.certificado_path) await admin.storage.from("certificados-a1").remove([atual.certificado_path]);
      } else if (certB64) {
        if (certB64.length > 4_000_000) return json({ error: "Arquivo do certificado muito grande" }, 400);
        let bytes: Uint8Array;
        try { bytes = Uint8Array.from(atob(certB64), (ch) => ch.charCodeAt(0)); }
        catch { return json({ error: "Arquivo do certificado inválido" }, 400); }
        const path = `pje-direto/${user.id}.pfx`;
        const up = await admin.storage.from("certificados-a1").upload(path, bytes, { contentType: "application/x-pkcs12", upsert: true });
        if (up.error) return json({ error: `Falha ao guardar o certificado: ${up.error.message}` }, 400);
        reg.certificado_path = path;
        reg.certificado_nome = String(body.certificado_nome ?? "certificado.pfx").slice(0, 200);
        const senhaCert = String(body.certificado_senha ?? "");
        if (!senhaCert) return json({ error: "Informe a senha do certificado" }, 400);
        reg.certificado_senha_cifrada = await encrypt(senhaCert);
      } else if (String(body.certificado_senha ?? "") && atual?.certificado_path) {
        reg.certificado_senha_cifrada = await encrypt(String(body.certificado_senha));
      }

      const { error } = atual
        ? await admin.from("credenciais_pje_usuario").update(reg).eq("id", atual.id)
        : await admin.from("credenciais_pje_usuario").insert(reg);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    const { data: c } = await admin.from("credenciais_pje_usuario").select("*").eq("usuario_id", user.id).maybeSingle();
    if (!c) return json({ error: "Cadastre sua credencial do PJe primeiro" }, 400);

    if (acao === "testar") {
      const tribunal = String(body.tribunal ?? c.tribunais[0]);
      try {
        const avisos = parseAvisos(await soap(tribunal, "consultarAvisosPendentes", cred(c.cpf, await decrypt(c.senha_cifrada)), await carregarPfx(admin, c)));
        await admin.from("credenciais_pje_usuario").update({ ultimo_status: "ok", ultima_mensagem: null }).eq("id", c.id);
        return json({ success: true, tribunal, avisos: avisos.length });
      } catch (e) {
        const msg = String((e as Error).message ?? e);
        await admin.from("credenciais_pje_usuario").update({ ultimo_status: "erro", ultima_mensagem: msg }).eq("id", c.id);
        return json({ success: false, tribunal, error: msg });
      }
    }
    if (acao === "buscar") return json({ success: true, resultado: await executar(admin, c, "manual") });
    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
