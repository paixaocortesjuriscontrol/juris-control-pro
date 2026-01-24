import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertPayload {
  tipo_alerta: string;
  coordenacao_id: string;
  titulo: string;
  mensagem: string;
  prioridade?: 'baixa' | 'media' | 'alta' | 'urgente';
  referencia_id?: string;
  processo_numero?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: AlertPayload = await req.json();
    const { tipo_alerta, coordenacao_id, titulo, mensagem, prioridade, referencia_id, processo_numero } = payload;

    if (!tipo_alerta || !coordenacao_id) {
      return new Response(
        JSON.stringify({ error: "tipo_alerta e coordenacao_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configuração da coordenação
    const { data: config, error: configError } = await supabase
      .from('config_alertas_coordenacao')
      .select('*')
      .eq('coordenacao_id', coordenacao_id)
      .maybeSingle();

    if (configError) {
      console.error("Erro ao buscar config:", configError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar configuração" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config) {
      console.log("Nenhuma configuração encontrada para coordenação:", coordenacao_id);
      return new Response(
        JSON.stringify({ message: "Coordenação sem configuração de alertas", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se o tipo de alerta está habilitado
    if (!config.tipos_alerta?.includes(tipo_alerta)) {
      console.log(`Tipo de alerta "${tipo_alerta}" não habilitado para coordenação`);
      return new Response(
        JSON.stringify({ message: "Tipo de alerta não habilitado", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se deve enviar apenas urgentes
    if (config.apenas_urgentes && prioridade !== 'urgente' && prioridade !== 'alta') {
      console.log("Alerta ignorado: apenas urgentes/altos estão habilitados");
      return new Response(
        JSON.stringify({ message: "Alerta não é urgente/alto", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar horário de envio (usando horário de Brasília)
    const agora = new Date();
    const brasiliaOffset = -3 * 60; // UTC-3 em minutos
    const localOffset = agora.getTimezoneOffset();
    const brasiliaTime = new Date(agora.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);
    
    const horaAtual = brasiliaTime.toTimeString().slice(0, 5);
    const diaSemana = brasiliaTime.getDay();

    if (config.dias_semana && !config.dias_semana.includes(diaSemana)) {
      console.log("Fora dos dias permitidos para envio");
      return new Response(
        JSON.stringify({ message: "Fora dos dias permitidos", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (config.horario_inicio && config.horario_fim) {
      if (horaAtual < config.horario_inicio || horaAtual > config.horario_fim) {
        console.log(`Fora do horário permitido: ${horaAtual} não está entre ${config.horario_inicio} e ${config.horario_fim}`);
        return new Response(
          JSON.stringify({ message: "Fora do horário permitido", enviados: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Buscar membros da coordenação com seus dados de contato
    const { data: membros, error: membrosError } = await supabase
      .from('membros_coordenacao')
      .select(`
        usuario_id,
        profiles!membros_coordenacao_usuario_id_fkey (
          id,
          nome,
          email,
          telefone
        )
      `)
      .eq('coordenacao_id', coordenacao_id);

    if (membrosError) {
      console.error("Erro ao buscar membros:", membrosError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar membros da coordenação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair emails e telefones dos membros
    const emailsDestino: string[] = [];
    const telefonesDestino: string[] = [];

    for (const membro of membros || []) {
      const profile = membro.profiles as any;
      if (profile?.email) {
        emailsDestino.push(profile.email);
      }
      if (profile?.telefone) {
        telefonesDestino.push(profile.telefone);
      }
    }

    console.log(`Membros encontrados: ${membros?.length || 0}, Emails: ${emailsDestino.length}, Telefones: ${telefonesDestino.length}`);

    const resultados = { emails: 0, whatsapp: 0, erros: [] as string[] };

    // Enviar E-mails para os membros
    if (config.email_habilitado && emailsDestino.length > 0) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      
      if (resendApiKey) {
        for (const email of emailsDestino) {
          try {
            const prioridadeEmoji = prioridade === 'urgente' ? '🚨' : prioridade === 'alta' ? '⚠️' : 'ℹ️';
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                  <h2 style="margin: 0;">${prioridadeEmoji} ${titulo}</h2>
                </div>
                <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0 0 16px 0; font-size: 16px;">${mensagem}</p>
                  ${processo_numero ? `<p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;"><strong>Processo:</strong> ${processo_numero}</p>` : ''}
                  <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Tipo:</strong> ${tipo_alerta}</p>
                  <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    Este alerta foi enviado automaticamente pelo Juris Control Pro.
                  </p>
                </div>
              </div>
            `;

            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: "Juris Control <suporte@paixaocortes.adv.br>",
                to: [email],
                subject: `${prioridadeEmoji} ${titulo}`,
                html: emailHtml,
              }),
            });

            if (response.ok) {
              resultados.emails++;
              // Registrar no histórico
              await supabase.from('historico_alertas_enviados').insert({
                coordenacao_id,
                tipo_alerta,
                canal: 'email',
                destinatario: email,
                conteudo: mensagem,
                referencia_id,
                status: 'enviado',
              });
            } else {
              const errorText = await response.text();
              resultados.erros.push(`Email para ${email}: ${errorText}`);
              await supabase.from('historico_alertas_enviados').insert({
                coordenacao_id,
                tipo_alerta,
                canal: 'email',
                destinatario: email,
                conteudo: mensagem,
                referencia_id,
                status: 'falha',
                erro: errorText,
              });
            }
          } catch (error: any) {
            console.error(`Erro ao enviar email para ${email}:`, error);
            resultados.erros.push(`Email para ${email}: ${error?.message || 'Erro desconhecido'}`);
          }
        }
      } else {
        console.log("RESEND_API_KEY não configurada");
        resultados.erros.push("RESEND_API_KEY não configurada");
      }
    }

    // Enviar WhatsApp para os membros
    if (config.whatsapp_habilitado && telefonesDestino.length > 0) {
      const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
      const zapiToken = Deno.env.get("ZAPI_TOKEN");
      const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

      if (zapiInstanceId && zapiToken) {
        const prioridadeEmoji = prioridade === 'urgente' ? '🚨' : prioridade === 'alta' ? '⚠️' : 'ℹ️';
        const whatsappMensagem = `${prioridadeEmoji} *${titulo}*\n\n${mensagem}${processo_numero ? `\n\n📋 Processo: ${processo_numero}` : ''}\n\n_Alerta automático - Juris Control Pro_`;

        for (const telefone of telefonesDestino) {
          try {
            // Formatar telefone - remover caracteres não numéricos
            let phoneFormatted = telefone.replace(/\D/g, '');
            
            // Adicionar código do país se não tiver
            if (!phoneFormatted.startsWith('55')) {
              phoneFormatted = '55' + phoneFormatted;
            }
            
            // Garantir 9 dígitos após DDD (celular brasileiro)
            if (phoneFormatted.length === 12 && phoneFormatted.startsWith('55')) {
              const ddd = phoneFormatted.slice(2, 4);
              const numero = phoneFormatted.slice(4);
              phoneFormatted = `55${ddd}9${numero}`;
            }

            console.log(`Enviando WhatsApp para: ${phoneFormatted} (original: ${telefone})`);

            const response = await fetch(
              `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Client-Token": zapiClientToken || "",
                },
                body: JSON.stringify({
                  phone: phoneFormatted,
                  message: whatsappMensagem,
                }),
              }
            );

            if (response.ok) {
              resultados.whatsapp++;
              await supabase.from('historico_alertas_enviados').insert({
                coordenacao_id,
                tipo_alerta,
                canal: 'whatsapp',
                destinatario: telefone,
                conteudo: mensagem,
                referencia_id,
                status: 'enviado',
              });
            } else {
              const errorText = await response.text();
              resultados.erros.push(`WhatsApp para ${telefone}: ${errorText}`);
              await supabase.from('historico_alertas_enviados').insert({
                coordenacao_id,
                tipo_alerta,
                canal: 'whatsapp',
                destinatario: telefone,
                conteudo: mensagem,
                referencia_id,
                status: 'falha',
                erro: errorText,
              });
            }
          } catch (error: any) {
            console.error(`Erro ao enviar WhatsApp para ${telefone}:`, error);
            resultados.erros.push(`WhatsApp para ${telefone}: ${error?.message || 'Erro desconhecido'}`);
          }
        }
      } else {
        console.log("Credenciais Z-API não configuradas");
        resultados.erros.push("Credenciais Z-API não configuradas");
      }
    }

    console.log(`Alertas enviados: ${resultados.emails} emails, ${resultados.whatsapp} whatsapp`);

    return new Response(
      JSON.stringify({
        success: true,
        enviados: resultados.emails + resultados.whatsapp,
        detalhes: resultados,
        membrosEncontrados: membros?.length || 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro na edge function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
