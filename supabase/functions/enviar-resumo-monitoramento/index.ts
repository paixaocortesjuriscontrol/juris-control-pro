import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResumoPayload {
  tipo_monitoramento: 'andamentos' | 'redistribuicoes' | 'distribuicoes' | 'djen' | 'termos';
  resumos_por_coordenacao: {
    coordenacao_id: string;
    coordenacao_nome?: string;
    total_verificados: number;
    total_encontrados: number;
    exemplos: Array<{
      processo_numero: string;
      descricao: string;
    }>;
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TAG = "[enviar-resumo-monitoramento]";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ResumoPayload = await req.json();
    const { tipo_monitoramento, resumos_por_coordenacao } = payload;

    if (!tipo_monitoramento || !resumos_por_coordenacao?.length) {
      console.log(`${TAG} Nenhum resumo para enviar`);
      return new Response(
        JSON.stringify({ message: "Nenhum resumo para enviar", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mapeamento de tipo para tipo_alerta (config_alertas_coordenacao)
    const tipoAlertaMap: Record<string, string> = {
      'andamentos': 'andamentos',
      'redistribuicoes': 'redistribuicoes',
      'distribuicoes': 'distribuicoes',
      'djen': 'djen',
      'termos': 'alertas_360',
    };

    const tipoAlerta = tipoAlertaMap[tipo_monitoramento] || tipo_monitoramento;

    // Mapeamento de ícones e títulos
    const iconMap: Record<string, string> = {
      'andamentos': '📋',
      'redistribuicoes': '🔄',
      'distribuicoes': '⚖️',
      'djen': '📰',
      'termos': '🔍',
    };

    const tituloMap: Record<string, string> = {
      'andamentos': 'Resumo de Andamentos',
      'redistribuicoes': 'Resumo de Redistribuições',
      'distribuicoes': 'Resumo de Novas Distribuições',
      'djen': 'Resumo DJEN',
      'termos': 'Resumo Monitoração 360°',
    };

    const resultados = { emails: 0, whatsapp: 0, erros: [] as string[] };

    for (const resumo of resumos_por_coordenacao) {
      const { coordenacao_id, coordenacao_nome, total_verificados, total_encontrados, exemplos } = resumo;

      // Só envia se encontrou algo
      if (total_encontrados === 0) {
        console.log(`${TAG} Coordenação ${coordenacao_id}: nenhum item encontrado, pulando`);
        continue;
      }

      // Buscar configuração da coordenação
      const { data: config, error: configError } = await supabase
        .from('config_alertas_coordenacao')
        .select('*')
        .eq('coordenacao_id', coordenacao_id)
        .maybeSingle();

      if (configError || !config) {
        console.log(`${TAG} Coordenação ${coordenacao_id} sem configuração de alertas`);
        continue;
      }

      // Verificar se o tipo de alerta está habilitado
      if (!config.tipos_alerta?.includes(tipoAlerta)) {
        console.log(`${TAG} Tipo de alerta "${tipoAlerta}" não habilitado para coordenação ${coordenacao_id}`);
        continue;
      }

      // Verificar horário de envio (usando horário de Brasília)
      const agora = new Date();
      const brasiliaOffset = -3 * 60;
      const localOffset = agora.getTimezoneOffset();
      const brasiliaTime = new Date(agora.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);
      
      const horaAtual = brasiliaTime.toTimeString().slice(0, 5);
      const diaSemana = brasiliaTime.getDay();

      if (config.dias_semana && !config.dias_semana.includes(diaSemana)) {
        console.log(`${TAG} Fora dos dias permitidos para envio`);
        continue;
      }

      if (config.horario_inicio && config.horario_fim) {
        if (horaAtual < config.horario_inicio || horaAtual > config.horario_fim) {
          console.log(`${TAG} Fora do horário permitido: ${horaAtual}`);
          continue;
        }
      }

      // Buscar membros da coordenação
      const { data: membros } = await supabase
        .from('membros_coordenacao')
        .select(`
          usuario_id,
          profiles!membros_coordenacao_usuario_id_fkey (
            id, nome, email, telefone
          )
        `)
        .eq('coordenacao_id', coordenacao_id);

      const emailsDestino: string[] = [];
      const telefonesDestino: string[] = [];

      for (const membro of membros || []) {
        const profile = membro.profiles as any;
        if (profile?.email) emailsDestino.push(profile.email);
        if (profile?.telefone) telefonesDestino.push(profile.telefone);
      }

      // Construir mensagem de resumo
      const icon = iconMap[tipo_monitoramento] || '📊';
      const titulo = `${icon} ${tituloMap[tipo_monitoramento] || 'Resumo de Monitoramento'}`;
      
      // Montar lista COMPLETA de exemplos formatados (sem limite)
      const exemplosTexto = exemplos.map((ex, i) => 
        `${i + 1}. ${ex.processo_numero}: ${ex.descricao}`
      ).join('\n');

      const mensagemTexto = `📊 *${coordenacao_nome || 'Coordenação'}*\n\n` +
        `✅ Verificados: ${total_verificados}\n` +
        `🆕 Encontrados: ${total_encontrados}\n\n` +
        `📋 *Detalhes:*\n${exemplosTexto}\n\n` +
        `_Resumo automático - Juris Control Pro_`;

      // Agrupar por processo para melhor organização no email
      const porProcesso = new Map<string, string[]>();
      for (const ex of exemplos) {
        if (!porProcesso.has(ex.processo_numero)) {
          porProcesso.set(ex.processo_numero, []);
        }
        porProcesso.get(ex.processo_numero)!.push(ex.descricao);
      }

      const listaHtml = Array.from(porProcesso.entries()).map(([numero, descricoes]) => `
        <div style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #6366f1;">
          <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px;">📄 ${numero}</div>
          <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 13px;">
            ${descricoes.map(d => `<li style="margin-bottom: 4px;">${d}</li>`).join('')}
          </ul>
        </div>
      `).join('');

      const mensagemHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 20px;">${icon} ${tituloMap[tipo_monitoramento] || 'Resumo'}</h2>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">${coordenacao_nome || 'Coordenação'}</p>
          </div>
          <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; background: white;">
            <div style="display: flex; gap: 16px; margin-bottom: 20px;">
              <div style="flex: 1; background: #f3f4f6; padding: 16px; border-radius: 12px; text-align: center;">
                <div style="font-size: 28px; font-weight: bold; color: #6b7280;">${total_verificados}</div>
                <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase;">Processos Verificados</div>
              </div>
              <div style="flex: 1; background: #ecfdf5; padding: 16px; border-radius: 12px; text-align: center;">
                <div style="font-size: 28px; font-weight: bold; color: #10b981;">${total_encontrados}</div>
                <div style="font-size: 12px; color: #059669; text-transform: uppercase;">Novos Andamentos</div>
              </div>
            </div>
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
              📋 Lista Completa de Andamentos
            </h3>
            ${listaHtml}
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
            <p style="margin: 0; font-size: 11px; color: #9ca3af; text-align: center;">
              Resumo automático do Juris Control Pro • ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      `;

      // Enviar E-mails
      if (config.email_habilitado && emailsDestino.length > 0) {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        
        if (resendApiKey) {
          for (const email of emailsDestino) {
            try {
              const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${resendApiKey}`,
                },
                body: JSON.stringify({
                  from: "Juris Control <alerta@juriscontrol.adv.br>",
                  to: [email],
                  subject: titulo,
                  html: mensagemHtml,
                }),
              });

              if (response.ok) {
                resultados.emails++;
                await supabase.from('historico_alertas_enviados').insert({
                  coordenacao_id,
                  tipo_alerta: tipoAlerta,
                  canal: 'email',
                  destinatario: email,
                  conteudo: `Resumo: ${total_encontrados} itens encontrados`,
                  status: 'enviado',
                });
              } else {
                const errorText = await response.text();
                resultados.erros.push(`Email para ${email}: ${errorText}`);
              }
            } catch (error: any) {
              console.error(`${TAG} Erro ao enviar email para ${email}:`, error);
              resultados.erros.push(`Email para ${email}: ${error?.message || 'Erro'}`);
            }
          }
        }
      }

      // Enviar WhatsApp
      if (config.whatsapp_habilitado && telefonesDestino.length > 0) {
        const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
        const zapiToken = Deno.env.get("ZAPI_TOKEN");
        const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

        if (zapiInstanceId && zapiToken) {
          for (const telefone of telefonesDestino) {
            try {
              let phoneFormatted = telefone.replace(/\D/g, '');
              if (!phoneFormatted.startsWith('55')) {
                phoneFormatted = '55' + phoneFormatted;
              }
              if (phoneFormatted.length === 12 && phoneFormatted.startsWith('55')) {
                const ddd = phoneFormatted.slice(2, 4);
                const numero = phoneFormatted.slice(4);
                phoneFormatted = `55${ddd}9${numero}`;
              }

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
                    message: mensagemTexto,
                  }),
                }
              );

              if (response.ok) {
                resultados.whatsapp++;
                await supabase.from('historico_alertas_enviados').insert({
                  coordenacao_id,
                  tipo_alerta: tipoAlerta,
                  canal: 'whatsapp',
                  destinatario: telefone,
                  conteudo: `Resumo: ${total_encontrados} itens encontrados`,
                  status: 'enviado',
                });
              } else {
                const errorText = await response.text();
                resultados.erros.push(`WhatsApp para ${telefone}: ${errorText}`);
              }
            } catch (error: any) {
              console.error(`${TAG} Erro ao enviar WhatsApp para ${telefone}:`, error);
              resultados.erros.push(`WhatsApp para ${telefone}: ${error?.message || 'Erro'}`);
            }
          }
        }
      }
    }

    console.log(`${TAG} Resumos enviados: ${resultados.emails} emails, ${resultados.whatsapp} whatsapp`);

    return new Response(
      JSON.stringify({
        success: true,
        enviados: resultados.emails + resultados.whatsapp,
        detalhes: resultados,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error(`${TAG} Erro:`, error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
