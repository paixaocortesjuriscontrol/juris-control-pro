import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "JurisControl <alertas@juriscontrol.adv.br>";

function ymdBRT(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function enviarEmail(to: string, subject: string, texto: string) {
  if (!RESEND_API_KEY) return { ok: false, erro: "RESEND_API_KEY não configurada" };
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:pre-wrap">${
    texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  }</div>`;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!resp.ok) return { ok: false, erro: `resend ${resp.status}` };
  await resp.json().catch(() => null);
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const hoje = ymdBRT();

  try {
    // Tarefas com data_fatal < hoje e não concluídas
    const { data: vencidas } = await supabase
      .from("tarefas")
      .select("id, titulo, data_fatal, status, responsavel_id, tarefa_responsaveis(usuario_id)")
      .lt("data_fatal", hoje)
      .not("status", "in", "(concluida,cancelada,arquivada)")
      .limit(1000);

    // Agrupa por responsável
    const porUsuario = new Map<string, any[]>();
    for (const t of vencidas ?? []) {
      const ids = new Set<string>();
      if (t.responsavel_id) ids.add(t.responsavel_id);
      for (const r of (t.tarefa_responsaveis ?? []) as any[]) if (r.usuario_id) ids.add(r.usuario_id);
      for (const uid of ids) {
        if (!porUsuario.has(uid)) porUsuario.set(uid, []);
        porUsuario.get(uid)!.push(t);
      }
    }

    let enviados = 0;
    for (const [uid, itens] of porUsuario) {
      // Já enviou hoje?
      const { data: jaEnviado } = await supabase
        .from("historico_alertas_enviados")
        .select("id")
        .eq("tipo_alerta", "prazo_perdido")
        .eq("destinatario", uid)
        .gte("enviado_em", `${hoje}T00:00:00Z`)
        .limit(1);
      if ((jaEnviado ?? []).length > 0) continue;

      const { data: profile } = await supabase
        .from("profiles").select("id, nome, email, telefone").eq("id", uid).maybeSingle();
      if (!profile) continue;

      const { data: cfg } = await supabase
        .from("config_notificacoes_usuario").select("*").eq("usuario_id", uid).maybeSingle();
      const c = cfg ?? { canal_email: true, canal_whatsapp: true, evento_prazo_perdido: true };
      if (c.evento_prazo_perdido === false) continue;

      const linhas = itens.slice(0, 20).map((t: any) => `• ${t.titulo ?? "(sem título)"} — venceu em ${t.data_fatal}`).join("\n");
      const corpo = `Olá ${profile.nome ?? ""},\n\nVocê tem ${itens.length} pendência(s) com prazo vencido:\n\n${linhas}${itens.length > 20 ? `\n... e mais ${itens.length - 20}` : ""}\n\nAcesse o sistema para tratar.`;
      const assunto = `⚠️ Você tem ${itens.length} prazo(s) perdido(s)`;

      if (c.canal_email && profile.email) {
        const r = await enviarEmail(profile.email, assunto, corpo);
        await supabase.from("historico_alertas_enviados").insert({
          tipo_alerta: "prazo_perdido", canal: "email", destinatario: uid, conteudo: corpo, status: r.ok ? "enviado" : "erro", erro: r.erro,
        });
      }
      if (c.canal_whatsapp && profile.telefone) {
        const { error } = await supabase.functions.invoke("enviar-whatsapp-zapi", {
          body: { telefones: [profile.telefone], mensagem: corpo, tipo: "lembrete" },
        });
        await supabase.from("historico_alertas_enviados").insert({
          tipo_alerta: "prazo_perdido", canal: "whatsapp", destinatario: uid, conteudo: corpo,
          status: error ? "erro" : "enviado", erro: error ? String(error.message ?? error) : null,
        });
      }
      // Marca o destinatario=uid para dedup por dia
      enviados++;
    }

    return new Response(JSON.stringify({ ok: true, usuarios_notificados: enviados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});