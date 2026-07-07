// Edge Function: djen-backfill-processo-numero
// Percorre publicacoes_djen_servidor com processo_numero NULL (últimos N dias)
// e reconsulta a API PJE Comunica (via djen_proxy_pool) para preencher
// processo_numero + advogados_json + orgao/tipo_comunicacao/meio.
// Chamada manual pela UI de admin. Best-effort, sem cron.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type ProxySlot = { id: string; base_url: string; token: string; label: string };

function ymdOf(dateLike: unknown): string {
  return String(dateLike || "").slice(0, 10);
}

function normalizeForApi(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function baseParamsFor(mon: any, dia: string, tribunal: string): Record<string, string> {
  const params: Record<string, string> = {
    siglaTribunal: tribunal,
    dataDisponibilizacaoInicio: dia,
    dataDisponibilizacaoFim: dia,
  };
  const tipo = String(mon?.tipo || "").toLowerCase();
  if (tipo === "advogado") {
    if (mon?.termo_busca) params.nomeAdvogado = normalizeForApi(mon.termo_busca);
    else if (mon?.oab && mon?.uf && !String(mon.uf).includes(",") && String(mon.uf).toUpperCase() !== "TODAS") {
      params.numeroOab = String(mon.oab).replace(/\D/g, "");
      params.ufOab = String(mon.uf).toUpperCase();
    }
  } else if (tipo === "processo") {
    params.numeroProcesso = String(mon?.termo_busca || "").replace(/\D/g, "");
  } else if (tipo === "parte") {
    params.nomeParte = normalizeForApi(mon?.termo_busca || "");
  } else {
    params.texto = normalizeForApi(mon?.termo_busca || "");
  }
  return params;
}

async function fetchSlotPage(slot: ProxySlot, params: Record<string, string>, page: number): Promise<any[]> {
  const url = new URL(`${slot.base_url.replace(/\/$/, "")}/djen`);
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);
  url.searchParams.append("pagina", String(page));
  url.searchParams.append("tamanhoPagina", "50");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(url.toString(), {
      headers: { "x-proxy-token": slot.token, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const wrap = await res.json().catch(() => null);
    if (!wrap) return [];
    const body = typeof wrap.body === "string" ? JSON.parse(wrap.body) : wrap.body || wrap;
    return body?.items || body?.comunicacoes || [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchAllPages(slot: ProxySlot, params: Record<string, string>): Promise<any[]> {
  const all: any[] = [];
  const seen = new Set<string>();
  let empty = 0;
  for (let page = 0; page < 20; page++) {
    const items = await fetchSlotPage(slot, params, page);
    if (items.length === 0) {
      empty++;
      if (empty >= 2) break;
      continue;
    }
    empty = 0;
    let added = 0;
    for (const it of items) {
      const id = String(it?.id || it?.id_djen || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      all.push(it);
      added++;
    }
    if (added === 0) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  return all;
}

function sanitizeAdvogados(arr: any): any[] {
  if (!Array.isArray(arr)) return [];
  const out: any[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const aninhado = item.advogado && typeof item.advogado === "object" ? item.advogado : null;
    const nome = String(item.nome ?? item.nomeAdvogado ?? aninhado?.nome ?? "").replace(/\s+/g, " ").trim();
    if (!nome) continue;
    out.push({
      ...item,
      nome,
      numero_oab: item.numero_oab ?? aninhado?.numero_oab ?? null,
      uf_oab: item.uf_oab ?? aninhado?.uf_oab ?? null,
    });
  }
  return out;
}

function extractProcesso(item: any): string | null {
  const explicit =
    item?.numeroProcesso ||
    item?.numero_processo ||
    item?.numeroprocessounico ||
    item?.numeroProcessoUnico ||
    item?.processoNumero ||
    item?.processo_numero ||
    item?.processo ||
    null;
  if (explicit) return String(explicit).trim();
  const texto = String(item?.texto || item?.conteudo || "");
  const m = texto.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  return m ? m[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });

  // Autentica usuário chamador
  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await anonClient.auth.getUser();
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // dry run without body permitido
  }
  const dias = Math.min(90, Math.max(1, Number(body?.dias || 30)));
  const dryRun = body?.dryRun === true;
  const limit = Math.min(2000, Math.max(1, Number(body?.limit || 1000)));

  const dataMin = new Date();
  dataMin.setUTCDate(dataMin.getUTCDate() - dias);
  const dataMinIso = dataMin.toISOString();

  const { data: proxies, error: proxErr } = await sb
    .from("djen_proxy_pool")
    .select("id, base_url, token, label, enabled, pool_enabled_global")
    .eq("enabled", true)
    .eq("pool_enabled_global", true);
  if (proxErr || !proxies?.length) {
    return new Response(JSON.stringify({ error: "no_proxies_available", detail: proxErr?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const slots: ProxySlot[] = proxies.map((p: any) => ({ id: p.id, base_url: p.base_url, token: p.token, label: p.label || p.base_url }));

  const { data: nullRows, error: selErr } = await sb
    .from("publicacoes_djen_servidor")
    .select("id, id_djen, tribunal, data_disponibilizacao, monitoramento_id, coordenacao_id, advogados_json, orgao, meio, tipo_comunicacao")
    .is("processo_numero", null)
    .not("id_djen", "is", null)
    .gte("data_disponibilizacao", dataMinIso)
    .limit(limit);
  if (selErr) {
    return new Response(JSON.stringify({ error: "select_failed", detail: selErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!nullRows?.length) {
    return new Response(JSON.stringify({ ok: true, atualizadas: 0, grupos: 0, linhasNull: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const monIds = [...new Set(nullRows.map((r: any) => r.monitoramento_id).filter(Boolean))];
  const { data: mons } = await sb
    .from("monitoramentos_djen")
    .select("id, tipo, termo_busca, oab, uf")
    .in("id", monIds);
  const monById = new Map((mons || []).map((m: any) => [m.id, m]));

  type Group = { monId: string; tribunal: string; dia: string; rows: any[] };
  const groups = new Map<string, Group>();
  for (const row of nullRows) {
    if (!row.monitoramento_id || !row.tribunal || !row.data_disponibilizacao) continue;
    const dia = ymdOf(row.data_disponibilizacao);
    const key = `${row.monitoramento_id}|${row.tribunal}|${dia}`;
    let g = groups.get(key);
    if (!g) {
      g = { monId: row.monitoramento_id, tribunal: row.tribunal, dia, rows: [] };
      groups.set(key, g);
    }
    g.rows.push(row);
  }

  let atualizadas = 0;
  let tentativas = 0;
  let slotIdx = 0;
  const grupos = groups.size;

  if (dryRun) {
    return new Response(JSON.stringify({ ok: true, dryRun: true, grupos, linhasNull: nullRows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const grp of groups.values()) {
    const mon = monById.get(grp.monId);
    if (!mon) continue;
    const params = baseParamsFor(mon, grp.dia, grp.tribunal);
    if (!params.nomeAdvogado && !params.numeroOab && !params.nomeParte && !params.texto && !params.numeroProcesso) continue;
    tentativas++;
    const slot = slots[slotIdx++ % slots.length];
    const items = await fetchAllPages(slot, params);
    const byId = new Map<string, any>();
    for (const it of items) {
      const idj = String(it?.id || it?.id_djen || "");
      if (idj) byId.set(idj, it);
    }
    for (const row of grp.rows) {
      const item = byId.get(String(row.id_djen));
      if (!item) continue;
      const numero = extractProcesso(item);
      const patch: Record<string, unknown> = {};
      if (numero) patch.processo_numero = numero;
      const advVazio = !row.advogados_json || (Array.isArray(row.advogados_json) && row.advogados_json.length === 0);
      if (advVazio) {
        const advs = sanitizeAdvogados(item?.destinatarioadvogados || item?.advogados);
        if (advs.length > 0) patch.advogados_json = advs;
      }
      if (!row.orgao && (item?.nomeOrgao || item?.orgao)) patch.orgao = item.nomeOrgao || item.orgao;
      if (!row.tipo_comunicacao && (item?.tipoComunicacao || item?.tipo)) patch.tipo_comunicacao = item.tipoComunicacao || item.tipo;
      if (!row.meio && item?.meio) patch.meio = item.meio;
      if (Object.keys(patch).length === 0) continue;
      const { error: upErr } = await sb.from("publicacoes_djen_servidor").update(patch).eq("id", row.id);
      if (upErr) {
        console.log("[backfill] update err:", upErr.message);
        continue;
      }
      if (row.coordenacao_id && row.id_djen) {
        await sb
          .from("publicacoes_djen")
          .update(patch)
          .eq("id_djen", row.id_djen)
          .eq("coordenacao_id", row.coordenacao_id)
          .eq("fonte", "servidor");
      }
      atualizadas++;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  return new Response(JSON.stringify({ ok: true, grupos, tentativas, atualizadas, linhasNull: nullRows.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});