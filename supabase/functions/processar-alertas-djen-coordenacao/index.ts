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

      // Prosseguimos com o envio - o updated_at será atualizado após o envio

      // Buscar telefones dos membros
      if (!alerta.membros_ids?.length) {
        console.log(`[processar-alertas-djen-coordenacao] Sem membros configurados para alerta ${alerta.id}`);
        resultados.push({ alertaId: alerta.id, status: 'sem_membros' });
        continue;
      }

      const { data: membros, error: membrosError } = await supabase
        .from('profiles')
        .select('id, nome, telefone')
        .in('id', alerta.membros_ids);

      if (membrosError || !membros?.length) {
        console.error('Erro ao buscar membros:', membrosError);
        resultados.push({ alertaId: alerta.id, status: 'erro_membros' });
        continue;
      }

      const coordenacaoNome = (alerta.coordenacoes as any)?.nome || 'Coordenação';

      // Preparar mensagem
      const mensagem = `📋 *Resumo DJEN - ${coordenacaoNome}*\n\n` +
        `📅 Data: ${dataBrt.split('-').reverse().join('/')}\n` +
        `📰 Total de publicações: ${publicacoes.length}\n\n` +
        `📝 *Processos encontrados:*\n` +
        publicacoes.slice(0, 10).map(p => `• ${p.processo_numero || 'N/A'}`).join('\n') +
        (publicacoes.length > 10 ? `\n... e mais ${publicacoes.length - 10} publicações` : '') +
        `\n\n🔗 Acesse o sistema para ver os detalhes completos.`;

      // Enviar para cada membro
      let enviados = 0;
      for (const membro of membros) {
        if (!membro.telefone) {
          console.log(`[processar-alertas-djen-coordenacao] Membro ${membro.nome} sem telefone`);
          continue;
        }

        // Formatar telefone
        let telefone = membro.telefone.replace(/\D/g, '');
        if (!telefone.startsWith('55')) {
          telefone = '55' + telefone;
        }
        // Garantir 9 dígitos após DDD
        if (telefone.length === 12 && telefone.startsWith('55')) {
          const ddd = telefone.slice(2, 4);
          const numero = telefone.slice(4);
          telefone = `55${ddd}9${numero}`;
        }

        if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
          console.error('Credenciais Z-API não configuradas');
          continue;
        }

        const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

        try {
          const zapiRes = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': ZAPI_CLIENT_TOKEN,
            },
            body: JSON.stringify({
              phone: telefone,
              message: mensagem,
            }),
          });

          if (zapiRes.ok) {
            console.log(`[processar-alertas-djen-coordenacao] Mensagem enviada para ${membro.nome} (${telefone})`);
            enviados++;
          } else {
            const errText = await zapiRes.text();
            console.error(`[processar-alertas-djen-coordenacao] Erro Z-API para ${telefone}:`, errText);
          }
        } catch (zapiErr) {
          console.error(`[processar-alertas-djen-coordenacao] Erro ao enviar para ${telefone}:`, zapiErr);
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
        membrosNotificados: enviados,
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
