/**
 * alertar-servidor-travado
 * Envia por e-mail (suporte) e WhatsApp os avisos "DJEN Servidor: ..." criados
 * pelo reaper/retomada. Idempotente: só envia avisos das últimas 6h ainda não
 * registrados em historico_alertas_enviados (por execução + tipo + canal).
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const EMAIL = "suporte@paixaocortes.adv.br";
const TELEFONE = "5561999776905";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const desde = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data: notifs, error } = await sb.from("notificacoes")
    .select("titulo, mensagem, dados, created_at")
    .like("titulo", "DJEN Servidor:%").gte("created_at", desde)
    .order("created_at", { ascending: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });

  const avisos = new Map<string, { titulo: string; mensagem: string; execId: string; tipo: string }>();
  for (const n of notifs || []) {
    const execId = (n.dados as any)?.execucao_id;
    if (!execId) continue;
    const tipo = n.titulo.includes("interrompida") ? "djen_servidor_interrompido" : "djen_servidor_retomada";
    avisos.set(`${execId}|${tipo}`, { titulo: n.titulo, mensagem: n.mensagem, execId, tipo });
  }

  const res = { emails: 0, whatsapp: 0, erros: [] as string[] };
  for (const a of avisos.values()) {
    const { data: ja } = await sb.from("historico_alertas_enviados").select("canal")
      .eq("referencia_id", a.execId).eq("tipo_alerta", a.tipo);
    const canais = new Set((ja || []).map((r: any) => r.canal));

    if (!canais.has("email")) {
      const key = Deno.env.get("RESEND_API_KEY");
      let erro: string | null = key ? null : "RESEND_API_KEY não configurada";
      if (key) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            from: "Juris Control <alerta@juriscontrol.adv.br>", to: [EMAIL], subject: `⚠️ ${a.titulo}`,
            html: `<div style="font-family:Arial,sans-serif"><h2>${a.titulo}</h2><p>${a.mensagem}</p>
              <p><a href="https://juriscontrol.adv.br/monitoramento-djen-servidor">Abrir DJEN Servidor</a></p></div>`,
          }),
        });
        if (!r.ok) erro = await r.text(); else res.emails++;
      }
      if (erro) res.erros.push(`email: ${erro}`);
      await sb.from("historico_alertas_enviados").insert({
        tipo_alerta: a.tipo, canal: "email", destinatario: EMAIL, conteudo: a.mensagem,
        referencia_id: a.execId, status: erro ? "falha" : "enviado", erro,
      });
    }

    if (!canais.has("whatsapp")) {
      const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN");
      let erro: string | null = inst && tok ? null : "Z-API não configurada";
      if (inst && tok) {
        const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": Deno.env.get("ZAPI_CLIENT_TOKEN") || "" },
          body: JSON.stringify({ phone: TELEFONE, message: `⚠️ *${a.titulo}*\n\n${a.mensagem}\n\n_Alerta automático - Juris Control_` }),
        });
        if (!r.ok) erro = await r.text(); else res.whatsapp++;
      }
      if (erro) res.erros.push(`whatsapp: ${erro}`);
      await sb.from("historico_alertas_enviados").insert({
        tipo_alerta: a.tipo, canal: "whatsapp", destinatario: TELEFONE, conteudo: a.mensagem,
        referencia_id: a.execId, status: erro ? "falha" : "enviado", erro,
      });
    }
  }
  return new Response(JSON.stringify(res), { headers: { ...cors, "Content-Type": "application/json" } });
});
