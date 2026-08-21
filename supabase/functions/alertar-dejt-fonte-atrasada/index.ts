/**
 * alertar-dejt-fonte-atrasada
 *
 * Verifica, por tribunal, o `last-modified` da edição VIGENTE do caderno
 * Judiciário do DEJT (caminho fixo `/cadernos/Diario_J_<ID>.pdf`) e envia um
 * e-mail técnico ao suporte quando a fonte está defasada em mais de 2 dias
 * úteis. Serve para tornar visível a estagnação do portal sem depender de
 * alguém olhar o painel.
 *
 * Destinatário fixo: suporte@paixaocortes.adv.br (alerta técnico).
 */
import { DEJT_TRIBUNAIS, dejtUrlVigente } from "../_shared/dejtTribunais.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = "JurisControl <alertas@juriscontrol.adv.br>";
const PARA = "suporte@paixaocortes.adv.br";
const LIMITE_DIAS_UTEIS = 2;

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

async function poolSlots(): Promise<Array<{ base_url: string; token: string }>> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return [];
    const res = await fetch(
      `${url}/rest/v1/djen_proxy_pool?select=base_url,token,enabled&enabled=eq.true&order=created_at.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
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

async function lerLastModified(
  url: string,
  slots: Array<{ base_url: string; token: string }>,
): Promise<string | null> {
  const headers = { "Range": "bytes=0-0", "Accept": "application/pdf,*/*", "Referer": "https://dejt.jt.jus.br/" };
  try {
    const res = await fetch(url, { headers });
    await res.body?.cancel();
    if (res.ok || res.status === 206) return res.headers.get("last-modified");
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const hojeIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const slots = await poolSlots();

    const atrasados: Array<{ tribunal: string; edicao: string | null; atraso: number }> = [];
    const verificados: Array<Record<string, unknown>> = [];

    for (const t of DEJT_TRIBUNAIS) {
      const url = dejtUrlVigente(t.sigla, "judiciario");
      if (!url) continue;
      const lm = await lerLastModified(url, slots);
      const edicaoIso = lm ? new Date(lm).toISOString().slice(0, 10) : null;
      const atraso = edicaoIso ? diasUteisEntre(edicaoIso, hojeIso) : 999;
      verificados.push({ tribunal: t.sigla, lastModified: lm, edicao: edicaoIso, atrasoDiasUteis: atraso });
      if (atraso > LIMITE_DIAS_UTEIS) atrasados.push({ tribunal: t.sigla, edicao: edicaoIso, atraso });
    }

    let emailEnviado = false;
    if (atrasados.length > 0 && RESEND_API_KEY) {
      const linhas = atrasados
        .map((a) => `<tr><td style="padding:4px 10px;border:1px solid #ddd">${a.tribunal}</td>` +
          `<td style="padding:4px 10px;border:1px solid #ddd">${a.edicao ? a.edicao.split("-").reverse().join("/") : "não identificada"}</td>` +
          `<td style="padding:4px 10px;border:1px solid #ddd">${a.atraso === 999 ? "—" : a.atraso}</td></tr>`)
        .join("");
      const html = `
        <h2>DJEN Pautas — fonte DEJT defasada</h2>
        <p>A edição vigente do caderno Judiciário está atrasada em mais de ${LIMITE_DIAS_UTEIS} dias úteis
        nos tribunais abaixo (verificação de ${hojeIso.split("-").reverse().join("/")}).</p>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
          <tr><th style="padding:4px 10px;border:1px solid #ddd">Tribunal</th>
              <th style="padding:4px 10px;border:1px solid #ddd">Edição servida</th>
              <th style="padding:4px 10px;border:1px solid #ddd">Atraso (dias úteis)</th></tr>
          ${linhas}
        </table>
        <p style="color:#666;font-size:12px">Alerta técnico automático — não enviado aos advogados.</p>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [PARA],
          subject: `DJEN Pautas - Alerta - Fonte DEJT defasada (${atrasados.length} tribunais)`,
          html,
        }),
      });
      emailEnviado = res.ok;
      if (!res.ok) console.error("[alertar-dejt-fonte-atrasada] Resend falhou:", res.status, await res.text());
    }

    return new Response(
      JSON.stringify({ ok: true, hoje: hojeIso, atrasados, emailEnviado, verificados }),
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
