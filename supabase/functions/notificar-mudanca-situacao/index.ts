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

function labelEntidade(e: string): string {
  return { tarefa: "Tarefa", evento: "Evento", audiencia: "Audiência", parcela: "Parcela" }[e] ?? e;
}

function dentroDaJanela(inicio: number, fim: number): boolean {
  const brtMs = Date.now() - 3 * 60 * 60 * 1000;
  const h = new Date(brtMs).getUTCHours();
  if (inicio <= fim) return h >= inicio && h < fim;
  return h >= inicio || h < fim; // janela cruza meia-noite
}

async function enviarEmail(to: string, subject: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  if (!RESEND_API_KEY) return { ok: false, erro: "RESEND_API_KEY não configurada" };
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:pre-wrap">${
    texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  }</div>`;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!resp.ok) return { ok: false, erro: `resend ${resp.status}: ${(await resp.text()).slice(0, 200)}` };
  await resp.json().catch(() => null);
  return { ok: true };
}

async function enviarWhatsApp(supabase: any, telefone: string, mensagem: string) {
  const { data, error } = await supabase.functions.invoke("enviar-whatsapp-zapi", {
    body: { telefones: [telefone], mensagem, tipo: "lembrete" },
  });
  if (error) return { ok: false, erro: String(error.message ?? error) };
  return { ok: true, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 25);

    const { data: pendentes, error } = await supabase
      .from("notificacoes_fila")
      .select("*")
      .eq("processado", false)
      .lt("tentativas", 5)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    let enviados = 0;
    const erros: string[] = [];

    for (const item of pendentes ?? []) {
      try {
        const responsaveis: string[] = item.responsaveis ?? [];
        if (responsaveis.length === 0) {
          await supabase.from("notificacoes_fila").update({ processado: true, processado_em: new Date().toISOString() }).eq("id", item.id);
          continue;
        }

        // Perfis + configs
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, email, telefone")
          .in("id", responsaveis);
        const { data: configs } = await supabase
          .from("config_notificacoes_usuario")
          .select("*")
          .in("usuario_id", responsaveis);
        const cfgMap = new Map((configs ?? []).map((c: any) => [c.usuario_id, c]));

        const assunto = `[${labelEntidade(item.entidade)}] Situação alterada: ${item.status_anterior ?? "?"} → ${item.status_novo ?? "?"}`;
        const corpo = `${item.titulo ?? labelEntidade(item.entidade)}\n\nSituação anterior: ${item.status_anterior ?? "-"}\nNova situação: ${item.status_novo ?? "-"}\n\nAcesse o sistema para conferir.`;

        // In-app: cria notificação para cada responsável
        const notifRows = responsaveis.map((uid) => {
          const cfg = cfgMap.get(uid);
          if (cfg && cfg.canal_in_app === false) return null;
          if (cfg && cfg.evento_mudanca_situacao === false) return null;
          return {
            usuario_id: uid,
            tipo: "mudanca_situacao",
            titulo: assunto,
            mensagem: corpo,
            lida: false,
            dados: { entidade: item.entidade, entidade_id: item.entidade_id, status_anterior: item.status_anterior, status_novo: item.status_novo },
          };
        }).filter(Boolean);
        if (notifRows.length > 0) {
          await supabase.from("notificacoes").insert(notifRows as any);
        }

        for (const p of profiles ?? []) {
          const cfg: any = cfgMap.get(p.id) ?? {
            canal_email: true, canal_whatsapp: true, evento_mudanca_situacao: true,
            janela_hora_inicio: 8, janela_hora_fim: 20,
          };
          if (cfg.evento_mudanca_situacao === false) continue;
          if (!dentroDaJanela(cfg.janela_hora_inicio, cfg.janela_hora_fim)) continue;

          if (cfg.canal_email && p.email) {
            const r = await enviarEmail(p.email, assunto, corpo);
            await supabase.from("historico_alertas_enviados").insert({
              tipo_alerta: "mudanca_situacao", canal: "email", destinatario: p.email,
              conteudo: corpo, referencia_id: item.entidade_id, status: r.ok ? "enviado" : "erro", erro: r.erro,
            });
          }
          if (cfg.canal_whatsapp && p.telefone) {
            const r = await enviarWhatsApp(supabase, p.telefone, corpo);
            await supabase.from("historico_alertas_enviados").insert({
              tipo_alerta: "mudanca_situacao", canal: "whatsapp", destinatario: p.telefone,
              conteudo: corpo, referencia_id: item.entidade_id, status: r.ok ? "enviado" : "erro", erro: r.erro,
            });
          }
        }

        await supabase.from("notificacoes_fila").update({
          processado: true, processado_em: new Date().toISOString(),
        }).eq("id", item.id);
        enviados++;
      } catch (e: any) {
        erros.push(`${item.id}: ${e?.message ?? e}`);
        await supabase.from("notificacoes_fila").update({
          tentativas: (item.tentativas ?? 0) + 1, ultimo_erro: String(e?.message ?? e),
        }).eq("id", item.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, processados: enviados, erros }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});