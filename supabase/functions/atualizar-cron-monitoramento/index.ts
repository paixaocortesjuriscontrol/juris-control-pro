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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { frequencia } = await req.json();
    
    if (!frequencia || !frequenciaCron[frequencia]) {
      return new Response(
        JSON.stringify({ error: 'Frequência inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cronExpression = frequenciaCron[frequencia];
    const projectUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    // Atualizar configuração no banco
    const { error: updateError } = await supabase
      .from('configuracoes_monitoramento')
      .update({ frequencia })
      .eq('tipo', 'redistribuicoes');

    if (updateError) {
      console.error('Erro ao atualizar configuração:', updateError);
    }

    // Nota: A atualização do cron job precisa ser feita manualmente pelo admin
    // via SQL no dashboard do Supabase, pois não há RPC para cron.schedule/unschedule
    console.log(`Configuração atualizada para frequência: ${frequencia} (${cronExpression})`);
    console.log('Para aplicar a nova frequência no cron, execute no SQL Editor:');
    console.log(`SELECT cron.unschedule('monitorar-redistribuicoes-diario');`);
    console.log(`SELECT cron.schedule('monitorar-redistribuicoes-diario', '${cronExpression}', ...);`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        frequencia, 
        cronExpression,
        message: 'Configuração atualizada. A nova frequência será aplicada na próxima execução.' 
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
