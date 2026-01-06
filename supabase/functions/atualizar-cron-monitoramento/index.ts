import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de frequência para expressão cron
const frequenciaCron: Record<string, string> = {
  'diario': '0 10 * * *', // 7h BRT (10h UTC)
  '2x_dia': '0 10,21 * * *', // 7h e 18h BRT (10h e 21h UTC)
  'semanal': '0 10 * * 1', // Segunda 7h BRT (10h UTC)
};

// Tipos válidos de monitoramento
const tiposValidos = ['redistribuicoes', 'andamentos', 'distribuicoes', 'termos'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { frequencia, tipo } = await req.json();
    
    if (!frequencia || !frequenciaCron[frequencia]) {
      return new Response(
        JSON.stringify({ error: 'Frequência inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se tipo não for especificado, usar 'redistribuicoes' por compatibilidade
    const tipoMonitoramento = tipo && tiposValidos.includes(tipo) ? tipo : 'redistribuicoes';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cronExpression = frequenciaCron[frequencia];

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
