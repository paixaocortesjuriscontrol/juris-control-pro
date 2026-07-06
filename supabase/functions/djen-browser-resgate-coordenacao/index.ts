import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Monitoramento = {
  id: string;
  tipo: string;
  termo_busca: string | null;
  oab?: string | null;
  uf?: string | null;
  exclusoes?: string[] | null;
  termos_or?: string[] | null;
  condicao_concomitante?: string | null;
  coordenacao_id?: string | null;
  criado_por?: string | null;
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizar(raw: unknown): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[&/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function contemFrase(textoNorm: string, fraseNorm: string): boolean {
  if (!fraseNorm) return true;
  const escaped = fraseNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(textoNorm);
}

function contemFraseComAnd(textoNorm: string, termoRaw: unknown): boolean {
  const termo = String(termoRaw || "").trim();
  if (!termo) return true;
  if (!termo.includes("+")) return contemFrase(textoNorm, normalizar(termo));
  return termo
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean)
    .every((p) => /^OAB\s/i.test(p) || contemFrase(textoNorm, normalizar(p)));
}

function parseArrayLike(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getTexto(pub: any): string {
  return String(pub?.texto || pub?.conteudo || pub?.teor || "");
}

function extrairSecaoAdvogadosTexto(pub: any): string {
  const texto = getTexto(pub);
  if (!texto) return "";
  const headerRe = /\bAdvogados?\s*(?:\(\s*s\s*\))?\s*:?\s*/gi;
  const stopRe = /\b(?:Parte\s*\(\s*s\s*\)|Destinat[áa]rio(?:\(a\))?|Órgão|Data\s+de\s+disponibiliza|Tipo\s+de\s+comunica|Meio|Processo|Inteiro\s+teor)\s*:?|\bPolo\s+(?:ativo|passivo)\b/i;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(texto)) !== null) {
    const after = texto.slice(m.index + m[0].length, m.index + m[0].length + 1800);
    const stop = after.search(stopRe);
    const section = (stop >= 0 ? after.slice(0, stop) : after).trim();
    if (section) out.push(section);
  }
  return out.join("\n");
}

function extrairSecoesPartesTexto(pub: any): string[] {
  const texto = getTexto(pub);
  if (!texto) return [];
  const headers = [
    /\bParte\s*\(\s*s\s*\)\s*:?\s*/gi,
    /\bPolo\s+ativo\s*:?\s*/gi,
    /\bPolo\s+passivo\s*:?\s*/gi,
    /\bDestinat[áa]rio(?:\(a\))?\s*:?\s*/gi,
  ];
  const stopRe = /\bAdvogados?\s*(?:\(\s*s\s*\))?\s*:?|(?:^|\n)\s*(?:Órgão|Data\s+de\s+disponibiliza|Tipo\s+de\s+comunica|Meio|Processo|Inteiro\s+teor)\s*:?|\bPolo\s+(?:ativo|passivo)\b/i;
  const out: string[] = [];
  for (const re of headers) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      const after = texto.slice(m.index + m[0].length, m.index + m[0].length + 1800);
      const stop = after.search(stopRe);
      const section = (stop >= 0 ? after.slice(0, stop) : after).trim();
      if (section) out.push(section);
    }
  }
  return out;
}

function buildTextoCompleto(pub: any): string {
  const parts = [getTexto(pub)];
  for (const d of parseArrayLike(pub?.destinatarios)) if (d?.nome) parts.push(d.nome);
  for (const adv of parseArrayLike(pub?.destinatarioadvogados)) {
    const a = adv?.advogado || adv;
    if (a?.nome) parts.push(a.nome);
    if (a?.numero_oab) parts.push(`OAB ${a.uf_oab || ""} ${a.numero_oab}`);
  }
  return parts.filter(Boolean).join("\n");
}

function parsearTermoOr(raw: unknown): { nome: string; oabDigits?: string } | null {
  let t = String(raw || "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{3,6})\s*\/\s*(.+)$/);
  if (m) return { oabDigits: m[1], nome: m[2].trim() };
  m = t.match(/^(.+?)\s*\/\s*(\d{3,6})$/);
  if (m) return { oabDigits: m[2], nome: m[1].trim() };
  t = t
    .replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*Adv\.?\s*/i, "")
    .replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*/i, "")
    .replace(/^Adv\.?\s*/i, "")
    .trim();
  return t ? { nome: t } : null;
}

function coletarAdvogados(pub: any): Array<{ nome: string; numero_oab?: string }> {
  const out: Array<{ nome: string; numero_oab?: string }> = [];
  const add = (entry: any) => {
    const adv = entry?.advogado || entry;
    const nome = typeof adv === "string" ? adv : adv?.nome || adv?.nomeAdvogado || adv?.nomeRepresentante || "";
    if (!nome) return;
    out.push({ nome: String(nome), numero_oab: String(adv?.numero_oab || adv?.numeroOab || adv?.oab || "").replace(/\D/g, "") || undefined });
  };
  for (const field of ["destinatarioadvogados", "advogados", "representantes", "procuradores", "advogados_json"]) {
    for (const entry of parseArrayLike(pub?.[field])) add(entry);
  }
  for (const dest of parseArrayLike(pub?.destinatarios)) {
    for (const field of ["advogados", "representantes", "procuradores"]) for (const entry of parseArrayLike(dest?.[field])) add(entry);
    if (dest?.nomeAdvogado) add({ nome: dest.nomeAdvogado, numeroOab: dest.numeroOab });
  }
  return out;
}

function validarAdvogado(pub: any, nome?: string | null, oab?: string | null): boolean {
  const nomeNorm = normalizar(nome);
  const oabDigits = String(oab || "").replace(/\D/g, "");
  for (const adv of coletarAdvogados(pub)) {
    if (nomeNorm && contemFrase(normalizar(adv.nome), nomeNorm)) return true;
    if (pub?.__advogadoOabFallback && oabDigits && adv.numero_oab === oabDigits) return true;
  }
  const secao = normalizar(extrairSecaoAdvogadosTexto(pub));
  if (nomeNorm && secao && contemFrase(secao, nomeNorm)) return true;
  if (nomeNorm && contemFrase(normalizar(buildTextoCompleto(pub)), nomeNorm)) return true;
  return false;
}

function validarParte(pub: any, nomeParte?: string | null): boolean {
  const nomeNorm = normalizar(nomeParte);
  if (!nomeNorm) return false;
  const matches = (raw: any): boolean => {
    const s = typeof raw === "string" ? raw : raw?.nome || raw?.nomeParte || raw?.parte || raw?.nomeDestinatario || raw?.destinatarioNome || "";
    return String(s)
      .split(/\s*,\s*|\s*;\s*/)
      .some((c) => contemFrase(normalizar(c), nomeNorm));
  };
  for (const d of parseArrayLike(pub?.destinatarios)) if (matches(d)) return true;
  for (const p of parseArrayLike(pub?.partes)) if (matches(p)) return true;
  for (const p of parseArrayLike(pub?.partes_json)) if (matches(p)) return true;
  if (matches(pub?.poloAtivo) || matches(pub?.poloPassivo) || matches(pub?.destinatarioNome)) return true;
  return extrairSecoesPartesTexto(pub).some((s) => contemFrase(normalizar(s), nomeNorm));
}

function textoPartes(pub: any): string {
  const out: string[] = [];
  for (const d of parseArrayLike(pub?.destinatarios)) if (d?.nome) out.push(d.nome);
  for (const p of parseArrayLike(pub?.partes)) out.push(typeof p === "string" ? p : p?.nome || "");
  for (const p of parseArrayLike(pub?.partes_json)) out.push(typeof p === "string" ? p : p?.nome || "");
  if (pub?.poloAtivo) out.push(pub.poloAtivo);
  if (pub?.poloPassivo) out.push(pub.poloPassivo);
  if (pub?.destinatarioNome) out.push(pub.destinatarioNome);
  out.push(...extrairSecoesPartesTexto(pub));
  return out.filter(Boolean).join("\n");
}

function validarTermo(pub: any, mon: Monitoramento): boolean {
  if (mon.tipo === "geral") {
    const termos = [mon.termo_busca, ...(mon.termos_or || [])].map((t) => String(t || "").trim()).filter(Boolean);
    const textoNorm = normalizar(buildTextoCompleto(pub));
    const pn = String(pub?.numeroProcesso || pub?.numero_processo || pub?.processo_numero || pub?.processo || "").replace(/\D/g, "");
    return termos.some((t) => {
      const td = t.replace(/\D/g, "");
      return contemFrase(textoNorm, normalizar(t)) || validarParte(pub, t) || validarAdvogado(pub, t) || (!!td && pn.includes(td));
    });
  }

  const tipo = mon.tipo === "nome" ? "advogado" : mon.tipo;
  if (tipo === "parte") {
    if (validarParte(pub, mon.termo_busca)) return true;
    return (mon.termos_or || []).some((t) => validarParte(pub, t));
  }
  if (tipo === "advogado") {
    if (validarAdvogado(pub, mon.termo_busca, mon.oab)) return true;
    return (mon.termos_or || []).some((t) => {
      const p = parsearTermoOr(t);
      return !!p && validarAdvogado(pub, p.nome, p.oabDigits);
    });
  }
  if (tipo === "processo") {
    const nd = String(mon.termo_busca || "").replace(/\D/g, "");
    const pn = String(pub?.numeroProcesso || pub?.numero_processo || pub?.processo_numero || pub?.processo || "").replace(/\D/g, "");
    return !!nd && pn.includes(nd);
  }
  const textoNorm = normalizar(buildTextoCompleto(pub));
  if (contemFraseComAnd(textoNorm, mon.termo_busca)) return true;
  return (mon.termos_or || []).some((t) => {
    const p = parsearTermoOr(t);
    return !!p && contemFraseComAnd(textoNorm, p.nome);
  });
}

function temExclusao(pub: any, mon: Monitoramento): boolean {
  const tipo = mon.tipo === "nome" ? "advogado" : mon.tipo === "geral" ? "palavra-chave" : mon.tipo;
  const textoNorm = normalizar(tipo === "parte" ? textoPartes(pub) : buildTextoCompleto(pub));
  return (mon.exclusoes || []).some((e) => {
    const n = normalizar(e);
    return n && textoNorm.includes(n);
  });
}

function condicaoOk(pub: any, mon: Monitoramento): boolean {
  if (!mon.condicao_concomitante) return true;
  const tipo = mon.tipo === "nome" ? "advogado" : mon.tipo === "geral" ? "palavra-chave" : mon.tipo;
  const textoNorm = normalizar(tipo === "parte" ? textoPartes(pub) : buildTextoCompleto(pub));
  if (!textoNorm) return tipo !== "parte";
  const grupos = String(mon.condicao_concomitante).split("|").map((g) => g.trim()).filter(Boolean);
  return grupos.some((g) => g.split(",").map((t) => t.trim()).filter(Boolean).every((t) => contemFrase(textoNorm, normalizar(t))));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return response({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return response({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const monitoramentoId = String(body?.monitoramentoId || "").trim();
    const diaYmd = String(body?.diaYmd || "").trim();
    const tribunal = String(body?.tribunal || "").trim().toUpperCase();
    if (!monitoramentoId || !/^\d{4}-\d{2}-\d{2}$/.test(diaYmd) || !tribunal) {
      return response({ error: "Parâmetros inválidos" }, 400);
    }

    const { data: mon, error: monError } = await admin
      .from("monitoramentos_djen")
      .select("id,tipo,termo_busca,oab,uf,exclusoes,termos_or,condicao_concomitante,coordenacao_id,criado_por")
      .eq("id", monitoramentoId)
      .maybeSingle();
    if (monError || !mon?.coordenacao_id) return response({ items: [] });

    const [{ data: roleRows }, { data: memberRows }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "coordenador"]),
      admin.from("membros_coordenacao").select("coordenacao_id").eq("usuario_id", user.id).eq("coordenacao_id", mon.coordenacao_id),
    ]);
    const allowed = mon.criado_por === user.id || (roleRows || []).length > 0 || (memberRows || []).length > 0;
    if (!allowed) return response({ error: "Permissão negada" }, 403);

    const { data: rows, error } = await admin
      .from("publicacoes_djen")
      .select("id,id_djen,hash_conteudo,processo_numero,conteudo,data_disponibilizacao,data_publicacao,tribunal,fonte,orgao,tipo_comunicacao,meio,advogados_json,partes_json,coordenacao_id,status")
      .eq("status", "encontrada")
      .eq("tribunal", tribunal)
      .gte("data_disponibilizacao", `${diaYmd}T00:00:00.000Z`)
      .lte("data_disponibilizacao", `${diaYmd}T23:59:59.999Z`)
      .neq("coordenacao_id", mon.coordenacao_id)
      .limit(10000);

    if (error) return response({ error: error.message }, 500);

    const items = (rows || []).map((row: any) => ({
      ...row,
      id: row.id_djen || row.id,
      texto: row.conteudo,
      conteudo: row.conteudo,
      teor: row.conteudo,
      dataDisponibilizacao: row.data_disponibilizacao,
      dataPublicacao: row.data_publicacao,
      siglaTribunal: row.tribunal,
      numeroProcesso: row.processo_numero,
      numero_processo: row.processo_numero,
      destinatarioadvogados: row.advogados_json,
      advogados: row.advogados_json,
      destinatarios: row.partes_json,
      partes: row.partes_json,
      __resgatadaDeOutraCoordenacao: row.coordenacao_id,
      __resgatadaDeFonte: "publicacoes_djen",
    })).filter((pub: any) => validarTermo(pub, mon as Monitoramento) && !temExclusao(pub, mon as Monitoramento) && condicaoOk(pub, mon as Monitoramento));

    return response({ items });
  } catch (e) {
    return response({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});