// ============================================================================
// verificar-saude-pool-djen
// Checa cada VPS do pool DJEN: responde? em quanto tempo? e quantos dias
// faltam para o certificado TLS vencer. Grava o resultado em djen_proxy_pool
// e envia e-mail aos administradores em 30/15/7/1 dias, no vencimento e
// quando a VPS está fora do ar.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import * as tls from "node:tls";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = "JurisControl <alertas@juriscontrol.adv.br>";
const TAG = "[verificar-saude-pool-djen]";
const LIMIARES_DIAS = [30, 15, 7, 1];

type Slot = {
  id: string;
  label: string | null;
  base_url: string;
  token: string | null;
  enabled: boolean | null;
  cert_expira_em: string | null;
  ultimo_alerta_cert_em: string | null;
  ultimo_alerta_offline_em: string | null;
};

type Resultado = {
  id: string;
  label: string;
  base_url: string;
  status: "ok" | "cert_expirado" | "cert_invalido" | "offline" | "erro";
  motivo: string | null;
  latencia_ms: number | null;
  cert_expira_em: string | null;
  cert_dias_restantes: number | null;
};

const log = (...a: unknown[]) => console.log(TAG, ...a);

/** Lê notAfter do certificado do peer via handshake TLS (aceita cert expirado). */
function lerCertificado(
  host: string,
  port: number,
): Promise<{ validTo: string | null; erro: string | null }> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (validTo: string | null, erro: string | null) => {
      if (done) return;
      done = true;
      try { socket?.destroy(); } catch { /* ignore */ }
      resolve({ validTo, erro });
    };
    let socket: tls.TLSSocket | undefined;
    try {
      socket = tls.connect(
        { host, port, servername: host, rejectUnauthorized: false, timeout: 12_000 },
        () => {
          const cert = socket!.getPeerCertificate();
          finish(cert && cert.valid_to ? cert.valid_to : null, null);
        },
      );
      socket.on("timeout", () => finish(null, "timeout no handshake TLS"));
      socket.on("error", (e: Error) => finish(null, e.message));
    } catch (e) {
      finish(null, e instanceof Error ? e.message : String(e));
    }
  });
}

/** GET /health respeitando o certificado (é assim que o daemon enxerga a VPS). */
async function checarHealth(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "");
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
    });
    const latencia = Date.now() - t0;
    if (!res.ok) {
      return { ok: false, latencia, motivo: `HTTP ${res.status} em /health` };
    }
    await res.text().catch(() => "");
    return { ok: true, latencia, motivo: null as string | null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, latencia: Date.now() - t0, motivo: msg };
  }
}

function ehErroDeCertificado(motivo: string | null) {
  return !!motivo && /certificate|cert_|tls|ssl|self.signed|expired|unknown issuer/i.test(motivo);
}

function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

function limiarCruzado(dias: number | null): number | null {
  if (dias === null) return null;
  if (dias < 0) return 0;
  for (const l of [...LIMIARES_DIAS].sort((a, b) => a - b)) {
    if (dias <= l) return l;
  }
  return null;
}

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const dryRun = body?.dryRun === true;
  const somenteChecar = body?.somenteChecar === true; // usado pelo botão "Testar agora"
  const slotId = typeof body?.slotId === "string" ? body.slotId : null;

  try {
    let q = supabase
      .from("djen_proxy_pool")
      .select(
        "id, label, base_url, token, enabled, cert_expira_em, ultimo_alerta_cert_em, ultimo_alerta_offline_em",
      )
      .order("created_at", { ascending: true });
    if (slotId) q = q.eq("id", slotId);

    const { data: slots, error } = await q;
    if (error) throw error;

    const resultados: Resultado[] = [];

    for (const s of (slots || []) as Slot[]) {
      const label = s.label || s.base_url;
      let url: URL;
      try {
        url = new URL(s.base_url);
      } catch {
        resultados.push({
          id: s.id, label, base_url: s.base_url, status: "erro",
          motivo: "URL base inválida", latencia_ms: null,
          cert_expira_em: null, cert_dias_restantes: null,
        });
        continue;
      }

      const health = await checarHealth(s.base_url);

      // Handshake TLS separado (aceita certificado inválido) só para ler notAfter.
      let certExpiraEm: string | null = null;
      let certErro: string | null = null;
      if (url.protocol === "https:") {
        const port = Number(url.port || 443);
        const info = await lerCertificado(url.hostname, port);
        certErro = info.erro;
        if (!info.validTo) log(`sem notAfter para ${label}`, info.erro || "handshake sem certificado");
        if (info.validTo) {
          const d = new Date(info.validTo);
          if (!Number.isNaN(d.getTime())) certExpiraEm = d.toISOString();
        }
      }

      const dias = diasAte(certExpiraEm);
      let status: Resultado["status"];
      let motivo: string | null = null;

      if (health.ok) {
        status = "ok";
      } else if (dias !== null && dias < 0) {
        status = "cert_expirado";
        motivo = `Certificado TLS expirou em ${fmtData(certExpiraEm)} — o proxy pode estar de pé, mas o daemon rejeita a conexão.`;
      } else if (ehErroDeCertificado(health.motivo)) {
        status = "cert_invalido";
        motivo = `Problema no certificado TLS: ${health.motivo}`;
      } else if (certErro && !certExpiraEm) {
        status = "offline";
        motivo = `Sem resposta: ${health.motivo || certErro}`;
      } else {
        status = "offline";
        motivo = health.motivo || "sem resposta em /health";
      }

      resultados.push({
        id: s.id,
        label,
        base_url: s.base_url,
        status,
        motivo,
        latencia_ms: health.ok ? health.latencia : null,
        cert_expira_em: certExpiraEm,
        cert_dias_restantes: dias,
      });

      await supabase
        .from("djen_proxy_pool")
        .update({
          ultima_checagem_em: new Date().toISOString(),
          saude_status: status,
          saude_motivo: motivo,
          latencia_ms: health.ok ? health.latencia : null,
          cert_expira_em: certExpiraEm,
          cert_dias_restantes: dias,
        })
        .eq("id", s.id);
    }

    log(`checadas ${resultados.length} VPS`, resultados.map((r) => `${r.label}=${r.status}`).join(" | "));

    if (somenteChecar) {
      return new Response(JSON.stringify({ ok: true, resultados }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Decide quem merece alerta hoje ─────────────────────────────────────
    const mapaSlots = new Map<string, Slot>(((slots || []) as Slot[]).map((s) => [s.id, s]));
    const hoje = new Date().toISOString().slice(0, 10);
    const alertasCert: Resultado[] = [];
    const alertasOffline: Resultado[] = [];

    for (const r of resultados) {
      const s = mapaSlots.get(r.id)!;
      const limiar = limiarCruzado(r.cert_dias_restantes);
      if (limiar !== null) {
        const ultimo = (s.ultimo_alerta_cert_em || "").slice(0, 10);
        if (ultimo !== hoje) alertasCert.push(r);
      }
      if (r.status === "offline" || r.status === "cert_invalido") {
        const ultimo = (s.ultimo_alerta_offline_em || "").slice(0, 10);
        if (ultimo !== hoje) alertasOffline.push(r);
      }
    }

    let emailsEnviados = 0;
    if (alertasCert.length > 0 || alertasOffline.length > 0) {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = (adminRoles || []).map((r: { user_id: string }) => r.user_id).filter(Boolean);
      let destinatarios: string[] = [];
      if (adminIds.length > 0) {
        const { data: perfis } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", adminIds);
        destinatarios = Array.from(
          new Set((perfis || []).map((p: { email: string | null }) => p.email).filter(Boolean) as string[]),
        );
      }

      const linha = (r: Resultado) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.label}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.base_url}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.status}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${
            r.cert_dias_restantes === null
              ? "—"
              : r.cert_dias_restantes < 0
                ? `vencido em ${fmtData(r.cert_expira_em)}`
                : `${r.cert_dias_restantes} dia(s) — ${fmtData(r.cert_expira_em)}`
          }</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.motivo || "—"}</td>
        </tr>`;

      const secao = (titulo: string, itens: Resultado[]) =>
        itens.length === 0
          ? ""
          : `<h3 style="font-family:Arial,sans-serif;color:#1f2937;margin:18px 0 6px">${titulo}</h3>
             <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;width:100%">
               <thead><tr style="background:#f3f4f6;text-align:left">
                 <th style="padding:6px 10px">VPS</th><th style="padding:6px 10px">URL</th>
                 <th style="padding:6px 10px">Status</th><th style="padding:6px 10px">Certificado</th>
                 <th style="padding:6px 10px">Motivo</th>
               </tr></thead>
               <tbody>${itens.map(linha).join("")}</tbody>
             </table>`;

      const html = `
        <div style="font-family:Arial,sans-serif;color:#111827">
          <h2 style="margin:0 0 4px">Pool de Proxies DJEN — atenção necessária</h2>
          <p style="color:#6b7280;margin:0 0 8px">Checagem automática de ${fmtData(new Date().toISOString())}.</p>
          ${secao("Certificados vencidos ou próximos do vencimento", alertasCert)}
          ${secao("VPS fora do ar", alertasOffline)}
          <p style="color:#6b7280;font-size:12px;margin-top:18px">
            Renove o certificado com <code>certbot renew</code> na VM e reinicie o proxy.
            Cada VPS fora do pool reduz o paralelismo do motor DJEN Termos.
          </p>
        </div>`;

      const assunto =
        alertasCert.some((r) => (r.cert_dias_restantes ?? 99) < 0) || alertasOffline.length > 0
          ? "🚨 Pool DJEN: VPS fora do ar / certificado vencido"
          : "⚠️ Pool DJEN: certificado próximo do vencimento";

      if (dryRun || !RESEND_API_KEY || destinatarios.length === 0) {
        log(`e-mail não enviado (dryRun=${dryRun} key=${!!RESEND_API_KEY} destinatarios=${destinatarios.length})`);
      } else {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({ from: FROM, to: destinatarios, subject: assunto, html }),
        });
        if (!res.ok) {
          log(`erro Resend [${res.status}]`, await res.text());
        } else {
          emailsEnviados = destinatarios.length;
          const agora = new Date().toISOString();
          for (const r of alertasCert) {
            await supabase.from("djen_proxy_pool").update({ ultimo_alerta_cert_em: agora }).eq("id", r.id);
          }
          for (const r of alertasOffline) {
            await supabase.from("djen_proxy_pool").update({ ultimo_alerta_offline_em: agora }).eq("id", r.id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        checadas: resultados.length,
        alertas_certificado: alertasCert.length,
        alertas_offline: alertasOffline.length,
        emails_enviados: emailsEnviados,
        resultados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(TAG, "erro fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
