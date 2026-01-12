import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertaComDetalhes {
  id: string;
  termo_encontrado: string;
  contexto: string | null;
  prioridade: string;
  created_at: string;
  processo: {
    id: string;
    numero: string;
    polo_ativo: string | null;
    polo_passivo: string | null;
  } | null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const alertaIds: string[] = body.alertaIds || [];
    const forceRun = body.forceRun === true;

    // Converter para BRT (UTC-3)
    const nowUtc = new Date();
    const nowBrt = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
    const dataBrt = nowBrt.toISOString().slice(0, 10);

    console.log(`[enviar-alertas-360-email] Início: ${nowUtc.toISOString()} | forceRun: ${forceRun} | alertaIds: ${alertaIds.length}`);

    // Se alertaIds foram passados, buscar esses alertas específicos
    // Caso contrário, buscar alertas pendentes criados hoje
    let alertasQuery = supabase
      .from("alertas_monitoramento")
      .select(`
        id,
        termo_encontrado,
        contexto,
        prioridade,
        created_at,
        processo:processos(id, numero, polo_ativo, polo_passivo)
      `)
      .eq("status", "pendente");

    if (alertaIds.length > 0) {
      alertasQuery = alertasQuery.in("id", alertaIds);
    } else {
      // Buscar apenas alertas de hoje
      alertasQuery = alertasQuery
        .gte("created_at", `${dataBrt}T00:00:00-03:00`)
        .lte("created_at", `${dataBrt}T23:59:59-03:00`);
    }

    const { data: alertas, error: alertasError } = await alertasQuery;

    if (alertasError) {
      console.error("Erro ao buscar alertas:", alertasError);
      throw alertasError;
    }

    if (!alertas || alertas.length === 0) {
      console.log("[enviar-alertas-360-email] Nenhum alerta para enviar");
      return new Response(
        JSON.stringify({ success: true, emailsEnviados: 0, message: "Nenhum alerta para enviar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enviar-alertas-360-email] ${alertas.length} alertas encontrados`);

    // Buscar usuários que optaram por receber emails de Monitoração 360
    const { data: usuarios, error: usuariosError } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .eq("notificacoes_email_360", true)
      .eq("ativo", true);

    if (usuariosError) {
      console.error("Erro ao buscar usuários:", usuariosError);
      throw usuariosError;
    }

    if (!usuarios || usuarios.length === 0) {
      console.log("[enviar-alertas-360-email] Nenhum usuário configurado para receber emails");
      return new Response(
        JSON.stringify({ success: true, emailsEnviados: 0, message: "Nenhum usuário configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enviar-alertas-360-email] ${usuarios.length} usuários para notificar`);

    // Agrupar alertas por prioridade
    const alertasPorPrioridade: Record<string, any[]> = {
      urgente: [],
      alta: [],
      media: [],
      baixa: [],
    };

    for (const alerta of alertas) {
      const prioridade = alerta.prioridade || "media";
      if (alertasPorPrioridade[prioridade]) {
        alertasPorPrioridade[prioridade].push(alerta);
      } else {
        alertasPorPrioridade.media.push(alerta);
      }
    }

    // Construir HTML do email
    const prioridadeEmoji: Record<string, string> = {
      urgente: "🚨",
      alta: "⚠️",
      media: "📋",
      baixa: "📝",
    };

    const prioridadeCor: Record<string, string> = {
      urgente: "#dc2626",
      alta: "#ea580c",
      media: "#2563eb",
      baixa: "#16a34a",
    };

    let alertasHtml = "";
    for (const [prioridade, lista] of Object.entries(alertasPorPrioridade)) {
      if (lista.length === 0) continue;
      
      alertasHtml += `
        <div style="margin-bottom: 24px;">
          <h3 style="color: ${prioridadeCor[prioridade]}; margin-bottom: 12px;">
            ${prioridadeEmoji[prioridade]} ${prioridade.charAt(0).toUpperCase() + prioridade.slice(1)} (${lista.length})
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Termo</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Processo</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Contexto</th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(alerta => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">${alerta.termo_encontrado}</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb;">${(alerta.processo as any)?.numero || "N/A"}</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">${alerta.contexto?.substring(0, 150) || ""}...</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    const dataFormatada = dataBrt.split("-").reverse().join("/");
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Alertas Monitoração 360°</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🎯 Monitoração 360° - Alertas</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Resumo de ${dataFormatada}</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background-color: white; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
            <p style="margin: 0; font-size: 18px;">
              <strong>${alertas.length}</strong> alerta(s) detectado(s) pela varredura de termos estratégicos.
            </p>
          </div>
          
          ${alertasHtml}
          
          <div style="text-align: center; margin-top: 32px;">
            <a href="https://juriscontrol.adv.br/monitoramento-360" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Ver Alertas no Sistema
            </a>
          </div>
          
          <p style="margin-top: 32px; font-size: 12px; color: #6b7280; text-align: center;">
            Este email foi enviado automaticamente pelo JurisControl.<br>
            Para desativar estes alertas, acesse Configurações > Preferências no sistema.
          </p>
        </div>
      </body>
      </html>
    `;

    // Enviar email para cada usuário usando a API do Resend via fetch
    let emailsEnviados = 0;
    const erros: string[] = [];

    for (const usuario of usuarios) {
      if (!usuario.email) {
        console.log(`[enviar-alertas-360-email] Usuário ${usuario.nome} sem email`);
        continue;
      }

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "JurisControl <alertas@juriscontrol.adv.br>",
            to: [usuario.email],
            subject: `🎯 Monitoração 360° - ${alertas.length} alerta(s) - ${dataFormatada}`,
            html: htmlEmail.replace("Olá,", `Olá, ${usuario.nome},`),
          }),
        });

        if (emailResponse.ok) {
          console.log(`[enviar-alertas-360-email] Email enviado para ${usuario.email}`);
          emailsEnviados++;
        } else {
          const errBody = await emailResponse.text();
          console.error(`[enviar-alertas-360-email] Erro ao enviar para ${usuario.email}:`, errBody);
          erros.push(`${usuario.email}: ${errBody}`);
        }
      } catch (emailError: any) {
        console.error(`[enviar-alertas-360-email] Erro ao enviar para ${usuario.email}:`, emailError);
        erros.push(`${usuario.email}: ${emailError.message}`);
      }
    }

    console.log(`[enviar-alertas-360-email] Fim | Emails enviados: ${emailsEnviados}, Erros: ${erros.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        alertasProcessados: alertas.length,
        emailsEnviados,
        erros: erros.length > 0 ? erros : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[enviar-alertas-360-email] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
