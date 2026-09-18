/**
 * alertar-dejt-fonte-atrasada
 *
 * Verifica, por tribunal, o `last-modified` da edição VIGENTE do caderno
 * Judiciário do DEJT (caminho fixo `/cadernos/Diario_J_<ID>.pdf`) e envia um
 * e-mail técnico ao suporte separando três situações distintas:
 *
 *  - `defasada`      → o caderno existe mas a edição está atrasada > 2 dias úteis
 *  - `indisponivel`  → o arquivo não existe/está bloqueado na fonte (403/404)
 *  - `em_dia`        → edição atual
 *
 * Só considera tribunais com monitoramento DJEN ativo e só reenvia e-mail
 * quando o estado de algum tribunal MUDA (piorou, ficou indisponível ou
 * normalizou) — no máximo um aviso por dia por tribunal.
 *
 * Destinatário fixo: suporte@paixaocortes.adv.br (alerta técnico).
 */
import { DEJT_TRIBUNAIS, dejtUrlVigente, dejtTemCadernoJudiciario } from "../_shared/dejtTribunais.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FROM = "JurisControl <alertas@juriscontrol.adv.br>";
const PARA = "suporte@paixaocortes.adv.br";
const LIMITE_DIAS_UTEIS = 2;

type Estado = "em_dia" | "defasada" | "indisponivel";

interface Verificacao {
  tribunal: string;
  estado: Estado;
  edicao: string | null;
  atraso: number | null;
  lastModified: string | null;
}

function sbHeaders() {
  return { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
}

function diasUteisEntre(deIso: string, ateIso: string): number {
  const de = new Date(`${deIso}T12:00:00Z`);
  const ate = new Date(`${ateIso}T12:00:00Z`);
  if (!(de < ate)) return 0;
  let dias = 0;
  const cur = new Date(de);
  while (cur < ate) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) dias++;
  }
  return dias;
}

function ddmmyyyy(iso: string | null): string {
  return iso ? iso.split("-").reverse().join("/") : "não identificada";
}

async function poolSlots(): Promise<Array<{ base_url: string; token: string }>> {
  try {
    if (!SB_URL || !SB_KEY) return [];
    const res = await fetch(
      `${SB_URL}/rest/v1/djen_proxy_pool?select=base_url,token,enabled&enabled=eq.true&order=created_at.asc`,
      { headers: sbHeaders() },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return (rows || [])
      .filter((r) => typeof r.base_url === "string" && typeof r.token === "string" && r.token)
      .map((r) => ({ base_url: String(r.base_url).replace(/\/+$/, ""), token: String(r.token) }));
  } catch {
    return [];
  }
}

/** Devolve o last-modified ou `null` quando a fonte não entrega o arquivo. */
async function lerLastModified(
  url: string,
  slots: Array<{ base_url: string; token: string }>,
): Promise<string | null> {
  const headers = { "Range": "bytes=0-0", "Accept": "application/pdf,*/*", "Referer": "https://dejt.jt.jus.br/" };
  try {
    const res = await fetch(url, { headers });
    const lm = res.headers.get("last-modified");
    await res.body?.cancel();
    if ((res.ok || res.status === 206) && lm) return lm;
  } catch { /* tenta proxy */ }
  for (const s of slots) {
    try {
      const res = await fetch(`${s.base_url}/fetch?url=${encodeURIComponent(url)}`, {
        headers: { "x-proxy-token": s.token },
      });
      const lm = res.headers.get("last-modified");
      await res.body?.cancel();
      if (res.ok && lm) return lm;
    } catch { /* próximo slot */ }
  }
  return null;
}

/** Só alerta se alguma rotina de pautas (browser ou servidor) estiver ativa. */
async function rotinaPautasAtiva(): Promise<boolean> {
  try {
    if (!SB_URL || !SB_KEY) return true;
    const res = await fetch(
      `${SB_URL}/rest/v1/configuracoes_monitoramento?select=tipo,ativo&tipo=in.(djet_pautas,djet_pautas_servidor)`,
      { headers: sbHeaders() },
    );
    if (!res.ok) return true;
    const rows = (await res.json()) as Array<{ ativo?: boolean }>;
    if (!Array.isArray(rows) || rows.length === 0) return false;
    return rows.some((r) => r?.ativo === true);
  } catch {
    return true;
  }
}

/** Tribunais com monitoramento DJEN ativo. Vazio = considera todos. */
async function tribunaisMonitorados(): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    if (!SB_URL || !SB_KEY) return set;
    const res = await fetch(
      `${SB_URL}/rest/v1/monitoramentos_djen?select=tribunais&ativo=eq.true&or=(arquivado.is.null,arquivado.eq.false)`,
      { headers: sbHeaders() },
    );
    if (!res.ok) return set;
    const rows = (await res.json()) as Array<{ tribunais?: string[] | null }>;
    for (const r of rows || []) {
      for (const t of r?.tribunais || []) {
        const up = String(t || "").toUpperCase();
        if (up === "TST" || /^TRT\d{1,2}$/.test(up)) set.add(up);
      }
    }
  } catch { /* ignora */ }
  return set;
}

async function estadoAnterior(): Promise<Map<string, { estado: Estado; notificado_em: string | null }>> {
  const map = new Map<string, { estado: Estado; notificado_em: string | null }>();
  try {
    if (!SB_URL || !SB_KEY) return map;
    const res = await fetch(
      `${SB_URL}/rest/v1/alertas_dejt_fonte_estado?select=tribunal,estado,notificado_em`,
      { headers: sbHeaders() },
    );
    if (!res.ok) return map;
    const rows = (await res.json()) as Array<{ tribunal: string; estado: Estado; notificado_em: string | null }>;
    for (const r of rows || []) map.set(r.tribunal, { estado: r.estado, notificado_em: r.notificado_em });
  } catch { /* ignora */ }
  return map;
}

async function gravarEstado(v: Verificacao, notificar: boolean, anterior?: string | null) {
  if (!SB_URL || !SB_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/alertas_dejt_fonte_estado?on_conflict=tribunal`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        tribunal: v.tribunal,
        estado: v.estado,
        edicao: v.edicao,
        atraso_dias_uteis: v.atraso,
        notificado_em: notificar ? new Date().toISOString() : (anterior ?? null),
        updated_at: new Date().toISOString(),
      }),
    });
  } catch { /* ignora */ }
}

function tabela(titulo: string, linhas: string, cabecalhos: string[]): string {
  if (!linhas) return "";
  return `
    <h3 style="font-family:Arial,sans-serif;font-size:14px;margin:18px 0 6px">${titulo}</h3>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
      <tr>${cabecalhos.map((c) => `<th style="padding:4px 10px;border:1px solid #ddd;background:#f6f6f6">${c}</th>`).join("")}</tr>
      ${linhas}
    </table>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await rotinaPautasAtiva())) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, motivo: "rotina DJEN Pautas desativada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hojeIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const hojeBrt = ddmmyyyy(hojeIso);
    const [slots, monitorados, anteriores] = await Promise.all([
      poolSlots(),
      tribunaisMonitorados(),
      estadoAnterior(),
    ]);

    const alvo = DEJT_TRIBUNAIS.filter((t) => monitorados.size === 0 || monitorados.has(t.sigla));
    const verificados: Verificacao[] = [];

    for (const t of alvo) {
      if (!dejtTemCadernoJudiciario(t.sigla)) {
        verificados.push({ tribunal: t.sigla, estado: "indisponivel", edicao: null, atraso: null, lastModified: null });
        continue;
      }
      const url = dejtUrlVigente(t.sigla, "judiciario");
      if (!url) continue;
      const lm = await lerLastModified(url, slots);
      if (!lm) {
        verificados.push({ tribunal: t.sigla, estado: "indisponivel", edicao: null, atraso: null, lastModified: null });
        continue;
      }
      const edicao = new Date(lm).toISOString().slice(0, 10);
      const atraso = diasUteisEntre(edicao, hojeIso);
      verificados.push({
        tribunal: t.sigla,
        estado: atraso > LIMITE_DIAS_UTEIS ? "defasada" : "em_dia",
        edicao,
        atraso,
        lastModified: lm,
      });
    }

    // Decide quem entra no e-mail: mudou de estado, ou piorou, ou o aviso do dia
    // ainda não foi enviado para um tribunal que continua com problema.
    const mudancas: Verificacao[] = [];
    for (const v of verificados) {
      const ant = anteriores.get(v.tribunal);
      const antEstado = ant?.estado;
      const avisadoHoje = ant?.notificado_em
        ? new Date(ant.notificado_em).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) === hojeIso
        : false;
      const problema = v.estado !== "em_dia";
      const normalizou = v.estado === "em_dia" && antEstado && antEstado !== "em_dia";
      if ((problema && (!avisadoHoje || antEstado !== v.estado)) || normalizou) mudancas.push(v);
    }

    const defasados = mudancas.filter((v) => v.estado === "defasada");
    const indisponiveis = mudancas.filter((v) => v.estado === "indisponivel");
    const normalizados = mudancas.filter((v) => v.estado === "em_dia");

    let emailEnviado = false;
    if (mudancas.length > 0 && RESEND_API_KEY) {
      const linhasDefasados = defasados
        .map((v) => `<tr><td style="padding:4px 10px;border:1px solid #ddd">${v.tribunal}</td>` +
          `<td style="padding:4px 10px;border:1px solid #ddd">${ddmmyyyy(v.edicao)}</td>` +
          `<td style="padding:4px 10px;border:1px solid #ddd">${v.atraso ?? "—"}</td></tr>`)
        .join("");
      const linhasIndisponiveis = indisponiveis
        .map((v) => `<tr><td style="padding:4px 10px;border:1px solid #ddd">${v.tribunal}</td>` +
          `<td style="padding:4px 10px;border:1px solid #ddd">caderno Judiciário não disponibilizado no repositório</td></tr>`)
        .join("");
      const linhasNormalizados = normalizados
        .map((v) => `<tr><td style="padding:4px 10px;border:1px solid #ddd">${v.tribunal}</td>` +
          `<td style="padding:4px 10px;border:1px solid #ddd">${ddmmyyyy(v.edicao)}</td></tr>`)
        .join("");

      const html = `
        <h2 style="font-family:Arial,sans-serif">DJEN Pautas — situação da fonte DEJT</h2>
        <p style="font-family:Arial,sans-serif;font-size:13px">Verificação de ${hojeBrt} (horário de Brasília).
        A rotina está funcionando; abaixo estão apenas os tribunais cuja situação na fonte mudou.</p>
        ${tabela(
          `Fonte defasada (edição com mais de ${LIMITE_DIAS_UTEIS} dias úteis)`,
          linhasDefasados,
          ["Tribunal", "Edição servida", "Atraso (dias úteis)"],
        )}
        ${tabela("Caderno indisponível na fonte", linhasIndisponiveis, ["Tribunal", "Situação"])}
        ${linhasIndisponiveis ? `<p style="font-family:Arial,sans-serif;font-size:12px;color:#666">
          Limitação permanente da fonte pública: nesses tribunais o caderno Judiciário não é publicado
          no repositório oficial de PDFs, então não há pauta a capturar por esse caminho.</p>` : ""}
        ${tabela("Fonte normalizada", linhasNormalizados, ["Tribunal", "Edição servida"])}
        <p style="color:#666;font-size:12px;font-family:Arial,sans-serif">Alerta técnico automático — não enviado aos advogados.</p>`;

      const assuntoPartes: string[] = [];
      if (defasados.length) assuntoPartes.push(`${defasados.length} defasados`);
      if (indisponiveis.length) assuntoPartes.push(`${indisponiveis.length} indisponíveis`);
      if (normalizados.length) assuntoPartes.push(`${normalizados.length} normalizados`);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [PARA],
          subject: `DJEN Pautas - Fonte DEJT (${assuntoPartes.join(", ")})`,
          html,
        }),
      });
      emailEnviado = res.ok;
      if (!res.ok) console.error("[alertar-dejt-fonte-atrasada] Resend falhou:", res.status, await res.text());
    }

    const notificados = new Set(emailEnviado ? mudancas.map((v) => v.tribunal) : []);
    for (const v of verificados) {
      await gravarEstado(v, notificados.has(v.tribunal), anteriores.get(v.tribunal)?.notificado_em ?? null);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        hoje: hojeIso,
        emailEnviado,
        defasados: defasados.map((v) => v.tribunal),
        indisponiveis: indisponiveis.map((v) => v.tribunal),
        normalizados: normalizados.map((v) => v.tribunal),
        verificados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[alertar-dejt-fonte-atrasada] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
