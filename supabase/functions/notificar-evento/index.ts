import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificarEventoRequest {
  evento_id: string;
  participantes_ids: string[];
  tipo_notificacao: 'criacao' | 'lembrete' | 'atualizacao';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { evento_id, participantes_ids, tipo_notificacao }: NotificarEventoRequest = await req.json();

    // Buscar dados do evento
    const { data: evento, error: eventoError } = await supabase
      .from('eventos_agenda')
      .select('*')
      .eq('id', evento_id)
      .single();

    if (eventoError || !evento) {
      throw new Error(`Evento não encontrado: ${eventoError?.message}`);
    }

    // Buscar participantes com email habilitado
    const { data: participantes, error: partError } = await supabase
      .from('profiles')
      .select('id, nome, email, notificacoes_email')
      .in('id', participantes_ids);

    if (partError) {
      throw new Error(`Erro ao buscar participantes: ${partError.message}`);
    }

    // Filtrar apenas quem tem notificações por email ativadas
    const participantesComEmail = participantes?.filter(p => p.notificacoes_email && p.email) || [];

    if (participantesComEmail.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum participante com notificações por email ativadas",
          emails_enviados: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Formatar data/hora do evento
    const dataEvento = new Date(evento.data_inicio);
    const dataFormatada = dataEvento.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const horaFormatada = dataEvento.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Definir assunto baseado no tipo de notificação
    let assunto = '';
    let mensagemIntro = '';
    switch (tipo_notificacao) {
      case 'criacao':
        assunto = `📅 Novo evento: ${evento.titulo}`;
        mensagemIntro = 'Você foi adicionado(a) a um novo evento:';
        break;
      case 'lembrete':
        assunto = `⏰ Lembrete: ${evento.titulo}`;
        mensagemIntro = 'Lembrete do seu evento agendado:';
        break;
      case 'atualizacao':
        assunto = `🔄 Evento atualizado: ${evento.titulo}`;
        mensagemIntro = 'Um evento do qual você participa foi atualizado:';
        break;
    }

    // Enviar emails para cada participante
    const emailsEnviados: string[] = [];
    const erros: string[] = [];

    for (const participante of participantesComEmail) {
      try {
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px; }
              .header h1 { color: #1e40af; margin: 0; font-size: 24px; }
              .intro { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
              .event-title { color: #111827; font-size: 20px; font-weight: 600; margin-bottom: 15px; }
              .detail { display: flex; margin-bottom: 10px; }
              .detail-label { color: #6b7280; min-width: 100px; font-weight: 500; }
              .detail-value { color: #111827; }
              .description { background: #f9fafb; padding: 15px; border-radius: 6px; margin-top: 20px; }
              .description-label { color: #6b7280; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📅 JurisControl</h1>
              </div>
              <p class="intro">${mensagemIntro}</p>
              <div class="event-title">${evento.titulo}</div>
              <div class="detail">
                <span class="detail-label">📆 Data:</span>
                <span class="detail-value">${dataFormatada}</span>
              </div>
              <div class="detail">
                <span class="detail-label">🕐 Horário:</span>
                <span class="detail-value">${horaFormatada}</span>
              </div>
              ${evento.local ? `
              <div class="detail">
                <span class="detail-label">📍 Local:</span>
                <span class="detail-value">${evento.local}</span>
              </div>
              ` : ''}
              <div class="detail">
                <span class="detail-label">🏷️ Tipo:</span>
                <span class="detail-value">${evento.tipo}</span>
              </div>
              ${evento.descricao ? `
              <div class="description">
                <div class="description-label">Descrição</div>
                <div>${evento.descricao}</div>
              </div>
              ` : ''}
              <div class="footer">
                Este email foi enviado automaticamente pelo sistema JurisControl.<br>
                Para desativar notificações por email, acesse suas configurações.
              </div>
            </div>
          </body>
          </html>
        `;

        const { error: emailError } = await resend.emails.send({
          from: "JurisControl <onboarding@resend.dev>",
          to: [participante.email],
          subject: assunto,
          html,
        });

        if (emailError) {
          console.error(`Erro ao enviar email para ${participante.email}:`, emailError);
          erros.push(`${participante.email}: ${emailError.message}`);
        } else {
          console.log(`Email enviado com sucesso para ${participante.email}`);
          emailsEnviados.push(participante.email);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Exceção ao enviar email para ${participante.email}:`, errorMessage);
        erros.push(`${participante.email}: ${errorMessage}`);
      }
    }

    console.log(`Emails enviados: ${emailsEnviados.length}, Erros: ${erros.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        emails_enviados: emailsEnviados.length,
        emails: emailsEnviados,
        erros: erros.length > 0 ? erros : undefined
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erro na função notificar-evento:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
