import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('[Desativar Cron DJEN] Desativando todos os cron jobs DJEN...')

    // Usar cron.unschedule para desativar os jobs
    const { data: jobs, error: listError } = await supabase
      .rpc('cron_unschedule_djen_jobs')

    if (listError) {
      // Tentar deletar diretamente via SQL
      const { error: deleteError } = await supabase.rpc('delete_djen_cron_jobs')
      
      if (deleteError) {
        console.log('[Desativar Cron DJEN] Não foi possível desativar via RPC, tentando fallback')
        // Fallback: apenas desativar via update
        const { error: updateError } = await supabase
          .from('configuracoes_monitoramento')
          .update({ 
            ativo: false,
            metadata: {
              status: 'idle',
              cancelado: false,
              paused_globally: false,
              continuingRun: false,
              next_offset: 0,
              current: 0,
              total: 0,
              percentage: 0,
              processados: 0
            }
          })
          .eq('tipo', 'djen')
        
        if (updateError) throw updateError
      }
    }

    console.log('[Desativar Cron DJEN] Concluído!')

    return new Response(
      JSON.stringify({ success: true, message: 'Cron jobs DJEN desativados' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[Desativar Cron DJEN] Erro:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})