// DJEN Cadernos (experimental): baixa o caderno completo do dia pela API do Comunica.
// Totalmente separado do DJEN Servidor.
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const API = "https://comunicaapi.pje.jus.br/api/v1/caderno";
type Slot = { base_url: string; token: string };

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, pool: Slot[], log: (v: string, s: number | null, m: string, ok: boolean) => Promise<void>) {
  const vias: Array<{ nome: string; run: () => Promise<Response> }> = [
    { nome: "direto", run: () => fetch(url, { headers: { Accept: "*/*" } }) },
    ...pool.map((s) => ({
      nome: `proxy ${new URL(s.base_url).hostname}`,
      run: () => fetch(`${s.base_url}/fetch?url=${encodeURIComponent(url)}`, { headers: { "x-proxy-token": s.token } }),
    })),
  ];
  for (let rodada = 0; rodada < 3; rodada++) {
    for (const v of vias) {
      try {
        const r = await v.run();
        if (r.ok) { await log(v.nome, r.status, "ok", true); return r; }
        const t = (await r.text()).slice(0, 200);
        await log(v.nome, r.status, t, false);
      } catch (e) {
        await log(v.nome, null, String((e as Error)?.message || e).slice(0, 200), false);
      }
    }
    await sleep(3000 * (rodada + 1));
  }
  return null;
}

function texto(v: unknown): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.map((x) => typeof x === "string" ? x : (x?.nome || x?.advogado?.nome || JSON.stringify(x))).join(" | ");
  return String(v);
}
function advs(c: any): string {
  const a = c.destinatarioadvogados || c.advogados || [];
  if (!Array.isArray(a)) return texto(a);
  return a.map((x: any) => {
    const ad = x.advogado || x;
    return [ad.nome, ad.numero_oab && `OAB ${ad.numero_oab}/${ad.uf_oab || ""}`].filter(Boolean).join(" ");
  }).join(" | ");
}
function extrairItens(d: any): any[] {
  if (Array.isArray(d)) return d;
  return d?.items || d?.comunicacoes || d?.data || [];
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

  const { tribunal, data, meio = "E" } = await req.json().catch(() => ({}));
  if (!tribunal || !/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return j({ error: "parametros_invalidos" }, 400);
  const trib = String(tribunal).toUpperCase().trim();
  const inicio = Date.now();

  const { data: cad, error: e1 } = await admin.from("djen_cadernos").upsert({
    tribunal: trib, data, meio, status: "baixando", erro: null, solicitado_por: u.user.id,
    tamanho_bytes: null, total_comunicacoes: null, tentativas: 0,
  }, { onConflict: "tribunal,data,meio" }).select().single();
  if (e1 || !cad) return j({ error: e1?.message || "falha_registro" }, 500);
  await admin.from("djen_cadernos_comunicacoes").delete().eq("caderno_id", cad.id);

  let tentativas = 0;
  const log = async (via: string, s: number | null, m: string, ok: boolean) => {
    tentativas++;
    await admin.from("djen_cadernos_tentativas").insert({ caderno_id: cad.id, via, http_status: s, mensagem: m, sucesso: ok });
  };
  const falhar = async (erro: string) => {
    await admin.from("djen_cadernos").update({ status: "erro", erro, tentativas, duracao_ms: Date.now() - inicio }).eq("id", cad.id);
    return j({ ok: false, erro, tentativas });
  };

  const { data: poolRows } = await admin.from("djen_proxy_pool").select("base_url,token,saude_status").eq("enabled", true);
  const pool: Slot[] = (poolRows || []).filter((r: any) => r.token && r.saude_status !== "offline")
    .map((r: any) => ({ base_url: String(r.base_url).replace(/\/+$/, ""), token: r.token }));

  const r1 = await get(`${API}/${trib}/${data}/${meio}`, pool, log);
  if (!r1) return await falhar("Não foi possível obter o caderno (bloqueio ou falha em todas as tentativas).");
  const ct = r1.headers.get("content-type") || "";
  let buf: Uint8Array;
  let urlArquivo: string | null = null;
  if (ct.includes("json")) {
    const meta = await r1.json();
    urlArquivo = meta?.url || meta?.link || meta?.urlArquivo || null;
    if (!urlArquivo) {
      const itens = extrairItens(meta);
      if (!itens.length) return await falhar(`Resposta sem link do arquivo: ${JSON.stringify(meta).slice(0, 300)}`);
      buf = new TextEncoder().encode(JSON.stringify(itens));
    } else {
      const r2 = await get(urlArquivo, pool, log);
      if (!r2) return await falhar("Link do caderno obtido, mas o arquivo não pôde ser baixado.");
      buf = new Uint8Array(await r2.arrayBuffer());
    }
  } else {
    buf = new Uint8Array(await r1.arrayBuffer());
  }

  let itens: any[] = [];
  try {
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      const zip = await JSZip.loadAsync(buf);
      for (const f of Object.values(zip.files)) {
        if (f.dir || !/\.json$/i.test(f.name)) continue;
        itens.push(...extrairItens(JSON.parse(await f.async("string"))));
      }
    } else {
      itens = extrairItens(JSON.parse(new TextDecoder().decode(buf)));
    }
  } catch (e) {
    return await falhar(`Arquivo baixado mas não pôde ser lido: ${(e as Error).message}`);
  }

  const linhas = itens.map((c: any) => {
    const num = c.numeroprocessocommascara || c.numero_processo || c.numeroProcesso || "";
    return {
      caderno_id: cad.id,
      comunicacao_id: String(c.id ?? c.hash ?? ""),
      numero_processo: num,
      numero_digitos: String(num).replace(/\D/g, ""),
      partes: texto((c.destinatarios || []).map((d: any) => d.nome)),
      advogados: advs(c),
      orgao: c.nomeOrgao || c.orgao || null,
      tipo: c.tipoComunicacao || c.tipoDocumento || null,
      data_disponibilizacao: (c.data_disponibilizacao || c.datadisponibilizacao || data).slice(0, 10),
      texto: String(c.texto || "").slice(0, 20000),
    };
  });
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await admin.from("djen_cadernos_comunicacoes").insert(linhas.slice(i, i + 500));
    if (error) return await falhar(`Falha ao gravar comunicações: ${error.message}`);
  }
  await admin.from("djen_cadernos").update({
    status: "ok", tamanho_bytes: buf.byteLength, total_comunicacoes: linhas.length,
    tentativas, duracao_ms: Date.now() - inicio, url_arquivo: urlArquivo,
  }).eq("id", cad.id);
  return j({ ok: true, total: linhas.length, tamanho: buf.byteLength, tentativas });
});
