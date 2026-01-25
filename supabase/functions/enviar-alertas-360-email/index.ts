import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const zapiToken = Deno.env.get("ZAPI_TOKEN");
  const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const forceRun = body.forceRun === true;

    // Converter para BRT (UTC-3)
    const nowUtc = new Date();
    const nowBrt = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
    const dataBrt = nowBrt.toISOString().slice(0, 10);

    console.log(`[enviar-alertas-360] Início: ${nowUtc.toISOString()} | forceRun: ${forceRun}`);

    // Buscar alertas pendentes de hoje com coordenação do processo
    const { data: alertas, error: alertasError } = await supabase
      .from("alertas_monitoramento")
      .select(`
        id,
        termo_encontrado,
        contexto,
        prioridade,
        created_at,
        processo_id,
        processo:processos(id, numero, polo_ativo, polo_passivo, coordenacao_id)
      `)
      .eq("status", "pendente")
      .gte("created_at", `${dataBrt}T00:00:00-03:00`)
      .lte("created_at", `${dataBrt}T23:59:59-03:00`);

    if (alertasError) {
      console.error("Erro ao buscar alertas:", alertasError);
      throw alertasError;
    }

    if (!alertas || alertas.length === 0) {
      console.log("[enviar-alertas-360] Nenhum alerta para enviar");
      return new Response(
        JSON.stringify({ success: true, emailsEnviados: 0, whatsappEnviados: 0, message: "Nenhum alerta para enviar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enviar-alertas-360] ${alertas.length} alertas encontrados`);

    // Agrupar alertas por coordenação
    const alertasPorCoordenacao: Record<string, any[]> = {};
    for (const alerta of alertas) {
      const coordId = (alerta.processo as any)?.coordenacao_id;
      if (coordId) {
        if (!alertasPorCoordenacao[coordId]) {
          alertasPorCoordenacao[coordId] = [];
        }
        alertasPorCoordenacao[coordId].push(alerta);
      }
    }

    const dataFormatada = dataBrt.split("-").reverse().join("/");
    let totalEmails = 0;
    let totalWhatsapp = 0;
    const erros: string[] = [];

    // Processar cada coordenação
    for (const [coordenacaoId, alertasCoordenacao] of Object.entries(alertasPorCoordenacao)) {
      // Verificar configuração da coordenação
      const { data: config } = await supabase
        .from("config_alertas_coordenacao")
        .select("*")
        .eq("coordenacao_id", coordenacaoId)
        .maybeSingle();

      if (!config) {
        console.log(`[enviar-alertas-360] Sem config para coordenação ${coordenacaoId}`);
        continue;
      }

      // Verificar se alertas360 está habilitado
      const tiposAlerta = config.tipos_alerta || [];
      if (tiposAlerta.length > 0 && !tiposAlerta.includes('alertas360')) {
        console.log(`[enviar-alertas-360] alertas360 não habilitado para coordenação ${coordenacaoId}`);
        continue;
      }

      // Buscar membros da coordenação
      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select(`
          usuario_id,
          profiles!membros_coordenacao_usuario_id_fkey (
            id,
            nome,
            email,
            telefone
          )
        `)
        .eq("coordenacao_id", coordenacaoId);

      if (!membros?.length) {
        console.log(`[enviar-alertas-360] Sem membros para coordenação ${coordenacaoId}`);
        continue;
      }

      // Deduplicar alertas por termo + processo
      const alertasUnicos: any[] = [];
      const chavesVistas = new Set<string>();
      for (const alerta of alertasCoordenacao) {
        const processo = (alerta.processo as any)?.numero || "N/A";
        const termo = alerta.termo_encontrado || "";
        const chave = `${termo}|${processo}`;
        if (!chavesVistas.has(chave)) {
          chavesVistas.add(chave);
          alertasUnicos.push(alerta);
        }
      }

      // Preparar conteúdo
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

      // Agrupar por prioridade
      const alertasPorPrioridade: Record<string, any[]> = { urgente: [], alta: [], media: [], baixa: [] };
      for (const alerta of alertasUnicos) {
        const prioridade = alerta.prioridade || "media";
        if (alertasPorPrioridade[prioridade]) {
          alertasPorPrioridade[prioridade].push(alerta);
        } else {
          alertasPorPrioridade.media.push(alerta);
        }
      }

      // Construir HTML do email
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
                </tr>
              </thead>
              <tbody>
                ${lista.slice(0, 20).map(alerta => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">${alerta.termo_encontrado}</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb;">${(alerta.processo as any)?.numero || "N/A"}</td>
                  </tr>
                `).join("")}
                ${lista.length > 20 ? `<tr><td colspan="2" style="padding: 8px; border: 1px solid #e5e7eb; color: #6b7280;">... e mais ${lista.length - 20} alertas</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        `;
      }

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Alertas 360°</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🎯 Monitoração 360° - Alertas</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Resumo de ${dataFormatada}</p>
          </div>
          <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <div style="background-color: white; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
              <p style="margin: 0; font-size: 18px;"><strong>${alertasUnicos.length}</strong> alerta(s) detectado(s)</p>
            </div>
            ${alertasHtml}
            <p style="margin-top: 32px; font-size: 12px; color: #6b7280; text-align: center;">
              Este email foi enviado automaticamente pelo JurisControl.
            </p>
          </div>
        </body>
        </html>
      `;

      // Construir mensagem WhatsApp
      let whatsappMsg = `🎯 *Monitoração 360° - Alertas*\n📅 ${dataFormatada}\n\n`;
      whatsappMsg += `*${alertasUnicos.length} alerta(s) detectado(s)*\n\n`;
      for (const [prioridade, lista] of Object.entries(alertasPorPrioridade)) {
        if (lista.length === 0) continue;
        whatsappMsg += `${prioridadeEmoji[prioridade]} *${prioridade.charAt(0).toUpperCase() + prioridade.slice(1)}* (${lista.length}):\n`;
        lista.slice(0, 5).forEach(a => {
          whatsappMsg += `• ${a.termo_encontrado} - ${(a.processo as any)?.numero || 'N/A'}\n`;
        });
        if (lista.length > 5) whatsappMsg += `  ... e mais ${lista.length - 5}\n`;
        whatsappMsg += '\n';
      }
      whatsappMsg += `_Juris Control Pro_`;

      // Enviar para cada membro
      for (const membro of membros) {
        const profile = membro.profiles as any;
        if (!profile) continue;

        // Enviar Email
        if (config.email_habilitado && profile.email && resendApiKey) {
          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "JurisControl <alertas@juriscontrol.adv.br>",
                to: [profile.email],
                subject: `🎯 Monitoração 360° - ${alertasUnicos.length} alerta(s) - ${dataFormatada}`,
                html: emailHtml,
              }),
            });

            if (res.ok) {
              console.log(`[enviar-alertas-360] Email enviado para ${profile.email}`);
              totalEmails++;
            } else {
              const errBody = await res.text();
              console.error(`[enviar-alertas-360] Erro email ${profile.email}:`, errBody);
              erros.push(`${profile.email}: ${errBody}`);
            }
          } catch (e: any) {
            console.error(`[enviar-alertas-360] Erro email:`, e);
            erros.push(`${profile.email}: ${e.message}`);
          }
        }

        // Enviar WhatsApp
        if (config.whatsapp_habilitado && profile.telefone && zapiInstanceId && zapiToken) {
          let telefone = profile.telefone.replace(/\D/g, '');
          if (!telefone.startsWith('55')) telefone = '55' + telefone;
          if (telefone.length === 12 && telefone.startsWith('55')) {
            const ddd = telefone.slice(2, 4);
            const numero = telefone.slice(4);
            telefone = `55${ddd}9${numero}`;
          }

          try {
            const res = await fetch(
              `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Client-Token": zapiClientToken || "",
                },
                body: JSON.stringify({
                  phone: telefone,
                  message: whatsappMsg,
                }),
              }
            );

            if (res.ok) {
              console.log(`[enviar-alertas-360] WhatsApp enviado para ${profile.telefone}`);
              totalWhatsapp++;
            } else {
              const errBody = await res.text();
              console.error(`[enviar-alertas-360] Erro WhatsApp ${profile.telefone}:`, errBody);
            }
          } catch (e: any) {
            console.error(`[enviar-alertas-360] Erro WhatsApp:`, e);
          }
        }
      }
    }

    console.log(`[enviar-alertas-360] Fim | Emails: ${totalEmails}, WhatsApp: ${totalWhatsapp}`);

    return new Response(
      JSON.stringify({
        success: true,
        alertasProcessados: alertas.length,
        emailsEnviados: totalEmails,
        whatsappEnviados: totalWhatsapp,
        erros: erros.length > 0 ? erros : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[enviar-alertas-360] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
