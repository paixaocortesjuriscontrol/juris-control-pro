import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos válidos de monitoramento
const tiposValidos = [
  'redistribuicoes',
  'andamentos',
  'distribuicoes',
  'termos',
  'djen',
  'djen_processos',
] as const;

type TipoMonitoramento = (typeof tiposValidos)[number];

// Mapeamento de frequência para expressão cron (apenas informativo; o agendamento em si é feito via SQL/pg_cron)
function getCronExpression(frequencia: string, tipo: TipoMonitoramento): string | null {
  const isDjen = tipo === 'djen' || tipo === 'djen_processos';

  const map: Record<string, string> = isDjen
    ? {
        // 08h BRT = 11h UTC
        diario: '0 11 * * *',
        // 08h e 18h BRT = 11h e 21h UTC
        '2x_dia': '0 11,21 * * *',
        // Segunda 08h BRT
        semanal: '0 11 * * 1',
      }
    : {
        // 07h BRT = 10h UTC
        diario: '0 10 * * *',
        // 07h e 18h BRT
        '2x_dia': '0 10,21 * * *',
        // Segunda 07h BRT
        semanal: '0 10 * * 1',
      };

  return map[frequencia] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { frequencia, tipo } = await req.json();

    if (!frequencia) {
      return new Response(
        JSON.stringify({ error: 'Frequência não informada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se tipo não for especificado, usar 'redistribuicoes' por compatibilidade
    let tipoMonitoramento: TipoMonitoramento = 'redistribuicoes';

    if (tipo !== undefined) {
      if (!tiposValidos.includes(tipo)) {
        return new Response(
          JSON.stringify({ error: 'Tipo de monitoramento inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      tipoMonitoramento = tipo;
    }

    const cronExpression = getCronExpression(frequencia, tipoMonitoramento);
    if (!cronExpression) {
      return new Response(
        JSON.stringify({ error: 'Frequência inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar configuração no banco para o tipo especificado
    const { error: updateError } = await supabase
      .from('configuracoes_monitoramento')
      .update({ frequencia })
      .eq('tipo', tipoMonitoramento);

    if (updateError) {
      console.error('Erro ao atualizar configuração:', updateError);
      throw updateError;
    }

    console.log(`Configuração de ${tipoMonitoramento} atualizada para frequência: ${frequencia} (${cronExpression})`);
      JSON.stringify({ 
        success: true, 
        tipo: tipoMonitoramento,
        frequencia, 
        cronExpression,
        message: `Configuração de ${tipoMonitoramento} atualizada. A nova frequência será aplicada na próxima execução.` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao atualizar cron:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
