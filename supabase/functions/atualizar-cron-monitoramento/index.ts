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
// Todos os monitoramentos agora rodam às 09h e 18h BRT (12h e 21h UTC)
function getCronExpression(frequencia: string, tipo: TipoMonitoramento): string | null {
  // 09h BRT = 12h UTC, 18h BRT = 21h UTC
  const map: Record<string, string> = {
    diario: '0 12 * * *',
    '2x_dia': '0 12,21 * * *',
    semanal: '0 12 * * 1',
  };

  return map[frequencia] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { frequencia, tipo } = await req.json();

    if (!frequencia) {
      return new Response(
        JSON.stringify({ error: 'Frequência não informada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const { error: updateError } = await supabase
      .from('configuracoes_monitoramento')
      .update({ frequencia })
      .eq('tipo', tipoMonitoramento);

    if (updateError) {
      console.error('Erro ao atualizar configuração:', updateError);
      throw updateError;
    }

    console.log(`Configuração de ${tipoMonitoramento} atualizada para frequência: ${frequencia} (${cronExpression})`);
    
    return new Response(
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
