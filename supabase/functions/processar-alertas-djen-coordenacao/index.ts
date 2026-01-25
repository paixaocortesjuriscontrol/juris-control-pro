import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
  const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
  const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  // Permitir forceRun para testes manuais
  let forceRun = false;
  try {
    const body = await req.json();
    forceRun = body?.forceRun === true;
  } catch {
    // Sem body é ok
  }

  const nowUtc = new Date();
  // Converter para BRT (UTC-3)
  const nowBrt = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
  const horaBrt = nowBrt.toISOString().slice(11, 16); // "HH:MM"
  const dataBrt = nowBrt.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const dataFormatada = dataBrt.split('-').reverse().join('/');

  console.log(`[processar-alertas-djen-coordenacao] Início: ${nowUtc.toISOString()} (BRT: ${nowBrt.toISOString()}) | Hora BRT: ${horaBrt} | forceRun: ${forceRun}`);

  try {
    // Buscar alertas ativos
    const { data: alertas, error: alertasError } = await supabase
      .from('alertas_coordenacao_djen')
      .select(`
        id,
        coordenacao_id,
        ativo,
        horario_envio,
        membros_ids,
        updated_at,
        coordenacoes!inner (
          id,
          nome
        )
      `)
      .eq('ativo', true);

    if (alertasError) {
      console.error('Erro ao buscar alertas:', alertasError);
      throw alertasError;
    }

    console.log(`[processar-alertas-djen-coordenacao] Alertas ativos encontrados: ${alertas?.length || 0}`);

    const resultados: any[] = [];

    for (const alerta of alertas || []) {
      const horarioEnvio = alerta.horario_envio?.slice(0, 5) || "08:00"; // "HH:MM"
      
      console.log(`[processar-alertas-djen-coordenacao] Verificando alerta ${alerta.id}: horario_envio=${horarioEnvio}, hora_atual=${horaBrt}`);

      // Verificar se já foi enviado hoje (updated_at >= início do dia BRT)
      const updatedAt = alerta.updated_at ? new Date(alerta.updated_at) : null;
      const inicioDiaBrt = new Date(`${dataBrt}T00:00:00-03:00`);
      
      if (!forceRun && updatedAt && updatedAt >= inicioDiaBrt) {
        console.log(`[processar-alertas-djen-coordenacao] Alerta ${alerta.id} já enviado hoje (updated_at: ${updatedAt.toISOString()})`);
        resultados.push({ alertaId: alerta.id, status: 'ja_enviado_hoje' });
        continue;
      }

      // Verificar se está no horário de envio (com tolerância de 5 minutos)
      const [horaEnvio, minEnvio] = horarioEnvio.split(':').map(Number);
      const [horaAtual, minAtual] = horaBrt.split(':').map(Number);
      
      const minutosEnvio = horaEnvio * 60 + minEnvio;
      const minutosAtual = horaAtual * 60 + minAtual;
      
      // Só envia se estiver dentro da janela de 5 minutos após o horário configurado (ou forceRun)
      if (!forceRun && (minutosAtual < minutosEnvio || minutosAtual > minutosEnvio + 5)) {
        console.log(`[processar-alertas-djen-coordenacao] Alerta ${alerta.id} fora do horário (${minutosAtual} vs ${minutosEnvio})`);
        resultados.push({ alertaId: alerta.id, status: 'fora_do_horario' });
        continue;
      }
      const { data: monitoramentos, error: monError } = await supabase
        .from('monitoramentos_djen')
        .select('id')
        .eq('coordenacao_id', alerta.coordenacao_id)
        .eq('ativo', true);

      if (monError || !monitoramentos?.length) {
        console.log(`[processar-alertas-djen-coordenacao] Sem monitoramentos para coordenação ${alerta.coordenacao_id}`);
        resultados.push({ alertaId: alerta.id, status: 'sem_monitoramentos' });
        continue;
      }

      const monitoramentoIds = monitoramentos.map(m => m.id);

      // Buscar publicações de hoje para essa coordenação
      const { data: publicacoes, error: pubError } = await supabase
        .from('publicacoes_djen')
        .select('id, processo_numero, conteudo, data_publicacao')
        .in('monitoramento_id', monitoramentoIds)
        .gte('created_at', `${dataBrt}T00:00:00-03:00`)
        .lte('created_at', `${dataBrt}T23:59:59-03:00`);

      if (pubError) {
        console.error('Erro ao buscar publicações:', pubError);
        resultados.push({ alertaId: alerta.id, status: 'erro', erro: pubError.message });
        continue;
      }

      console.log(`[processar-alertas-djen-coordenacao] Publicações hoje para ${alerta.coordenacao_id}: ${publicacoes?.length || 0}`);

      if (!publicacoes?.length) {
        resultados.push({ alertaId: alerta.id, status: 'sem_publicacoes' });
        continue;
      }

      // Buscar configuração de alerta para saber se email/whatsapp estão habilitados
      const { data: configAlerta } = await supabase
        .from('config_alertas_coordenacao')
        .select('email_habilitado, whatsapp_habilitado, tipos_alerta')
        .eq('coordenacao_id', alerta.coordenacao_id)
        .maybeSingle();

      const emailHabilitado = configAlerta?.email_habilitado ?? true;
      const whatsappHabilitado = configAlerta?.whatsapp_habilitado ?? true;
      const tiposAlerta = configAlerta?.tipos_alerta || [];
      const djenHabilitado = tiposAlerta.length === 0 || tiposAlerta.includes('djen');

      if (!djenHabilitado) {
        console.log(`[processar-alertas-djen-coordenacao] Tipo DJEN não habilitado para coordenação ${alerta.coordenacao_id}`);
        resultados.push({ alertaId: alerta.id, status: 'tipo_nao_habilitado' });
        continue;
      }

      // Buscar dados dos membros (telefone E email)
      if (!alerta.membros_ids?.length) {
        console.log(`[processar-alertas-djen-coordenacao] Sem membros configurados para alerta ${alerta.id}`);
        resultados.push({ alertaId: alerta.id, status: 'sem_membros' });
        continue;
      }

      const { data: membros, error: membrosError } = await supabase
        .from('profiles')
        .select('id, nome, telefone, email')
        .in('id', alerta.membros_ids);

      if (membrosError || !membros?.length) {
        console.error('Erro ao buscar membros:', membrosError);
        resultados.push({ alertaId: alerta.id, status: 'erro_membros' });
        continue;
      }

      const coordenacaoNome = (alerta.coordenacoes as any)?.nome || 'Coordenação';

      // Preparar mensagem WhatsApp
      const mensagemWhatsapp = `📋 *Resumo DJEN - ${coordenacaoNome}*\n\n` +
        `📅 Data: ${dataFormatada}\n` +
        `📰 Total de publicações: ${publicacoes.length}\n\n` +
        `📝 *Processos encontrados:*\n` +
        publicacoes.slice(0, 10).map(p => `• ${p.processo_numero || 'N/A'}`).join('\n') +
        (publicacoes.length > 10 ? `\n... e mais ${publicacoes.length - 10} publicações` : '') +
        `\n\n🔗 Acesse o sistema para ver os detalhes completos.`;

      // Preparar HTML do Email
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">📋 Resumo DJEN - ${coordenacaoNome}</h2>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Data: ${dataFormatada}</p>
          </div>
          <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <div style="background-color: #EFF6FF; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="margin: 0; font-size: 18px;"><strong>${publicacoes.length}</strong> publicações encontradas hoje</p>
            </div>
            <h3 style="margin: 16px 0 8px 0;">Processos:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              ${publicacoes.slice(0, 15).map(p => `<li style="margin-bottom: 4px;">${p.processo_numero || 'N/A'}</li>`).join('')}
              ${publicacoes.length > 15 ? `<li style="margin-top: 8px; color: #6b7280;">... e mais ${publicacoes.length - 15} publicações</li>` : ''}
            </ul>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">Este email foi enviado automaticamente pelo Juris Control Pro.</p>
          </div>
        </div>
      `;

      // Enviar para cada membro
      let whatsappEnviados = 0;
      let emailsEnviados = 0;

      for (const membro of membros) {
        // Enviar WhatsApp
        if (whatsappHabilitado && membro.telefone && ZAPI_INSTANCE_ID && ZAPI_TOKEN) {
          let telefone = membro.telefone.replace(/\D/g, '');
          if (!telefone.startsWith('55')) {
            telefone = '55' + telefone;
          }
          if (telefone.length === 12 && telefone.startsWith('55')) {
            const ddd = telefone.slice(2, 4);
            const numero = telefone.slice(4);
            telefone = `55${ddd}9${numero}`;
          }

          try {
            const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
            const zapiRes = await fetch(zapiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Token': ZAPI_CLIENT_TOKEN || '',
              },
              body: JSON.stringify({
                phone: telefone,
                message: mensagemWhatsapp,
              }),
            });

            if (zapiRes.ok) {
              console.log(`[processar-alertas-djen-coordenacao] WhatsApp enviado para ${membro.nome}`);
              whatsappEnviados++;
            } else {
              const errText = await zapiRes.text();
              console.error(`[processar-alertas-djen-coordenacao] Erro Z-API para ${telefone}:`, errText);
            }
          } catch (zapiErr) {
            console.error(`[processar-alertas-djen-coordenacao] Erro ao enviar WhatsApp:`, zapiErr);
          }
        }

        // Enviar Email
        if (emailHabilitado && membro.email && RESEND_API_KEY) {
          try {
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: 'Juris Control <alerta@juriscontrol.adv.br>',
                to: [membro.email],
                subject: `📋 Resumo DJEN - ${coordenacaoNome} - ${dataFormatada}`,
                html: emailHtml,
              }),
            });

            if (emailRes.ok) {
              console.log(`[processar-alertas-djen-coordenacao] Email enviado para ${membro.email}`);
              emailsEnviados++;
            } else {
              const errText = await emailRes.text();
              console.error(`[processar-alertas-djen-coordenacao] Erro Resend para ${membro.email}:`, errText);
            }
          } catch (emailErr) {
            console.error(`[processar-alertas-djen-coordenacao] Erro ao enviar email:`, emailErr);
          }
        }
      }

      // Atualizar updated_at para marcar que enviamos hoje
      await supabase
        .from('alertas_coordenacao_djen')
        .update({ updated_at: nowUtc.toISOString() })
        .eq('id', alerta.id);

      resultados.push({
        alertaId: alerta.id,
        coordenacao: coordenacaoNome,
        status: 'enviado',
        publicacoes: publicacoes.length,
        whatsappEnviados,
        emailsEnviados,
      });
    }

    console.log(`[processar-alertas-djen-coordenacao] Fim | Resultados:`, JSON.stringify(resultados));

    return new Response(
      JSON.stringify({ success: true, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[processar-alertas-djen-coordenacao] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
