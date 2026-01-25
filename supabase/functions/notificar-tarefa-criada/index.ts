import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TarefaCriadaPayload {
  tarefa_id: string;
  titulo: string;
  descricao?: string;
  data_vencimento?: string;
  prioridade: string;
  processo_id?: string;
  responsavel_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TarefaCriadaPayload = await req.json();
    const { tarefa_id, titulo, descricao, data_vencimento, prioridade, processo_id, responsavel_id } = payload;

    if (!tarefa_id || !responsavel_id) {
      return new Response(
        JSON.stringify({ error: "tarefa_id e responsavel_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Notificando tarefa criada: ${tarefa_id} para responsável ${responsavel_id}`);

    // Buscar dados do responsável
    const { data: responsavel } = await supabase
      .from('profiles')
      .select('id, nome, email, telefone')
      .eq('id', responsavel_id)
      .single();

    if (!responsavel) {
      console.log("Responsável não encontrado");
      return new Response(
        JSON.stringify({ message: "Responsável não encontrado", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do processo e coordenação
    let coordenacaoId: string | null = null;
    let processoNumero: string | null = null;

    if (processo_id) {
      const { data: processo } = await supabase
        .from('processos')
        .select('numero, coordenacao_id')
        .eq('id', processo_id)
        .single();

      if (processo) {
        coordenacaoId = processo.coordenacao_id;
        processoNumero = processo.numero;
      }
    }

    // Enviar alerta direto para o responsável (independente de coordenação)
    const resultados = { emails: 0, whatsapp: 0, erros: [] as string[] };
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Formatar data de vencimento
    const dataFormatada = data_vencimento 
      ? new Date(data_vencimento).toLocaleDateString('pt-BR')
      : 'Não definida';

    const prioridadeEmoji = prioridade === 'urgente' ? '🚨' : prioridade === 'alta' ? '⚠️' : '✅';
    const mensagem = `Nova tarefa atribuída a você:\n\n📋 ${titulo}\n📅 Vencimento: ${dataFormatada}${processoNumero ? `\n📁 Processo: ${processoNumero}` : ''}\n\n${descricao || ''}`;

    // Enviar e-mail direto para o responsável
    if (resendApiKey && responsavel.email) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #22C55E; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">${prioridadeEmoji} Nova Tarefa Atribuída</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h3 style="margin: 0 0 16px 0; color: #1a1a2e;">${titulo}</h3>
              <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>Vencimento:</strong> ${dataFormatada}</p>
              ${processoNumero ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>Processo:</strong> ${processoNumero}</p>` : ''}
              ${descricao ? `<p style="margin: 16px 0; font-size: 14px; color: #374151;">${descricao}</p>` : ''}
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
            from: "Juris Control <alerta@juriscontrol.adv.br>",
            to: [responsavel.email],
            subject: `${prioridadeEmoji} Nova Tarefa: ${titulo}`,
            html: emailHtml,
          }),
        });

        if (response.ok) {
          resultados.emails++;
          console.log(`Email enviado para ${responsavel.email}`);
        } else {
          const errorText = await response.text();
          console.error(`Erro ao enviar email: ${errorText}`);
          resultados.erros.push(`Email: ${errorText}`);
        }
      } catch (error: any) {
        console.error("Erro ao enviar email:", error);
        resultados.erros.push(`Email: ${error?.message}`);
      }
    }

    // Enviar WhatsApp direto para o responsável
    const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (zapiInstanceId && zapiToken && responsavel.telefone) {
      try {
        let phoneFormatted = responsavel.telefone.replace(/\D/g, '');
        if (!phoneFormatted.startsWith('55')) {
          phoneFormatted = '55' + phoneFormatted;
        }
        if (phoneFormatted.length === 12 && phoneFormatted.startsWith('55')) {
          const ddd = phoneFormatted.slice(2, 4);
          const numero = phoneFormatted.slice(4);
          phoneFormatted = `55${ddd}9${numero}`;
        }

        const whatsappMensagem = `${prioridadeEmoji} *Nova Tarefa Atribuída*\n\n📋 *${titulo}*\n📅 Vencimento: ${dataFormatada}${processoNumero ? `\n📁 Processo: ${processoNumero}` : ''}\n\n_Juris Control Pro_`;

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
          console.log(`WhatsApp enviado para ${responsavel.telefone}`);
        } else {
          const errorText = await response.text();
          console.error(`Erro ao enviar WhatsApp: ${errorText}`);
          resultados.erros.push(`WhatsApp: ${errorText}`);
        }
      } catch (error: any) {
        console.error("Erro ao enviar WhatsApp:", error);
        resultados.erros.push(`WhatsApp: ${error?.message}`);
      }
    }

    // Se tem coordenação, enviar alerta via sistema de coordenação também
    if (coordenacaoId) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/enviar-alerta-coordenacao`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            tipo_alerta: "tarefas",
            coordenacao_id: coordenacaoId,
            titulo: `✅ Nova Tarefa: ${titulo}`,
            mensagem: `Tarefa atribuída a ${responsavel.nome}. Vencimento: ${dataFormatada}`,
            prioridade: prioridade,
            referencia_id: tarefa_id,
            processo_numero: processoNumero,
          }),
        });
        console.log(`Alerta de coordenação enviado para ${coordenacaoId}`);
      } catch (error) {
        console.error("Erro ao enviar alerta de coordenação:", error);
      }
    }

    console.log(`Resultados: ${resultados.emails} emails, ${resultados.whatsapp} whatsapp`);

    return new Response(
      JSON.stringify({
        success: true,
        enviados: resultados.emails + resultados.whatsapp,
        detalhes: resultados,
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
