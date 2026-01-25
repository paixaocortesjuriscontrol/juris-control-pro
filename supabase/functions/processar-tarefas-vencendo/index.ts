import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para processar alertas de tarefas vencendo
// Deve ser chamada via cron job diariamente

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    console.log("Iniciando processamento de tarefas vencendo...");

    // Buscar tarefas que vencem hoje, amanhã ou em 3 dias (pendentes apenas)
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const tresDias = new Date(hoje);
    tresDias.setDate(tresDias.getDate() + 3);

    const hojeStr = hoje.toISOString().split('T')[0];
    const amanhaStr = amanha.toISOString().split('T')[0];
    const tresDiasStr = tresDias.toISOString().split('T')[0];

    const { data: tarefasVencendo, error: tarefasError } = await supabase
      .from('tarefas')
      .select(`
        id,
        titulo,
        descricao,
        data_vencimento,
        prioridade,
        processo_id,
        responsavel_id,
        processos:processo_id (
          numero,
          coordenacao_id
        ),
        profiles:responsavel_id (
          id,
          nome,
          email,
          telefone
        )
      `)
      .eq('status', 'pendente')
      .in('data_vencimento', [hojeStr, amanhaStr, tresDiasStr])
      .order('data_vencimento', { ascending: true });

    if (tarefasError) {
      console.error("Erro ao buscar tarefas:", tarefasError);
      throw tarefasError;
    }

    console.log(`Encontradas ${tarefasVencendo?.length || 0} tarefas vencendo`);

    const resultados = {
      processadas: 0,
      emails: 0,
      whatsapp: 0,
      alertasCoordenacao: 0,
      erros: [] as string[],
    };

    for (const tarefa of tarefasVencendo || []) {
      try {
        const responsavel = tarefa.profiles as any;
        const processo = tarefa.processos as any;

        if (!responsavel) {
          console.log(`Tarefa ${tarefa.id} sem responsável, pulando...`);
          continue;
        }

        // Calcular dias restantes
        const dataVenc = new Date(tarefa.data_vencimento!);
        const diffTime = dataVenc.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let urgenciaTexto = "";
        let urgenciaEmoji = "";
        if (diffDays === 0) {
          urgenciaTexto = "VENCE HOJE";
          urgenciaEmoji = "🚨";
        } else if (diffDays === 1) {
          urgenciaTexto = "VENCE AMANHÃ";
          urgenciaEmoji = "⚠️";
        } else {
          urgenciaTexto = `Vence em ${diffDays} dias`;
          urgenciaEmoji = "📅";
        }

        const dataFormatada = dataVenc.toLocaleDateString('pt-BR');
        const processoNumero = processo?.numero || null;

        // Enviar e-mail direto para o responsável
        if (resendApiKey && responsavel.email) {
          try {
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: ${diffDays === 0 ? '#EF4444' : diffDays === 1 ? '#F59E0B' : '#3B82F6'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                  <h2 style="margin: 0;">${urgenciaEmoji} Tarefa ${urgenciaTexto}</h2>
                </div>
                <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <h3 style="margin: 0 0 16px 0; color: #1a1a2e;">${tarefa.titulo}</h3>
                  <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>Vencimento:</strong> ${dataFormatada}</p>
                  ${processoNumero ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>Processo:</strong> ${processoNumero}</p>` : ''}
                  ${tarefa.descricao ? `<p style="margin: 16px 0; font-size: 14px; color: #374151;">${tarefa.descricao}</p>` : ''}
                  <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    Acesse o sistema para visualizar e concluir esta tarefa.
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
                subject: `${urgenciaEmoji} Tarefa ${urgenciaTexto}: ${tarefa.titulo}`,
                html: emailHtml,
              }),
            });

            if (response.ok) {
              resultados.emails++;
              console.log(`Email enviado para ${responsavel.email} - Tarefa: ${tarefa.titulo}`);
            } else {
              const errorText = await response.text();
              console.error(`Erro ao enviar email: ${errorText}`);
            }
          } catch (error: any) {
            console.error("Erro ao enviar email:", error);
          }
        }

        // Enviar WhatsApp direto para o responsável
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

            const whatsappMensagem = `${urgenciaEmoji} *Tarefa ${urgenciaTexto}*\n\n📋 *${tarefa.titulo}*\n📅 Vencimento: ${dataFormatada}${processoNumero ? `\n📁 Processo: ${processoNumero}` : ''}\n\n_Juris Control Pro_`;

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
              console.log(`WhatsApp enviado para ${responsavel.telefone} - Tarefa: ${tarefa.titulo}`);
            }
          } catch (error: any) {
            console.error("Erro ao enviar WhatsApp:", error);
          }
        }

        // Enviar alerta via coordenação se tiver
        if (processo?.coordenacao_id) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/enviar-alerta-coordenacao`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                tipo_alerta: "tarefas",
                coordenacao_id: processo.coordenacao_id,
                titulo: `${urgenciaEmoji} Tarefa ${urgenciaTexto}`,
                mensagem: `"${tarefa.titulo}" atribuída a ${responsavel.nome}. Vencimento: ${dataFormatada}`,
                prioridade: diffDays === 0 ? 'urgente' : diffDays === 1 ? 'alta' : 'media',
                referencia_id: tarefa.id,
                processo_numero: processoNumero,
              }),
            });
            resultados.alertasCoordenacao++;
          } catch (error) {
            console.error("Erro ao enviar alerta de coordenação:", error);
          }
        }

        resultados.processadas++;
      } catch (error: any) {
        console.error(`Erro ao processar tarefa ${tarefa.id}:`, error);
        resultados.erros.push(`Tarefa ${tarefa.id}: ${error?.message}`);
      }
    }

    console.log(`Processamento concluído: ${resultados.processadas} tarefas, ${resultados.emails} emails, ${resultados.whatsapp} whatsapp`);

    return new Response(
      JSON.stringify({
        success: true,
        tarefasEncontradas: tarefasVencendo?.length || 0,
        resultados,
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
