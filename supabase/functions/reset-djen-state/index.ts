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
 
     console.log('[Reset DJEN] Iniciando reset completo do estado...')
 
     // 1. Cancelar todas execuções ativas do DJEN
     const { data: execAtivas, error: execError } = await supabase
       .from('execucoes_agendadas')
       .update({ 
         status: 'cancelado',
         finalizado_em: new Date().toISOString()
       })
       .eq('tipo', 'djen')
       .eq('status', 'executando')
       .select()
 
     if (execError) {
       console.error('Erro ao cancelar execuções:', execError)
     } else {
       console.log(`[Reset DJEN] ${execAtivas?.length || 0} execuções canceladas`)
     }
 
      // 2. Limpar execuções fantasma (executando mas já finalizadas)
      const { data: execFantasma, error: fantasmaError } = await supabase
       .from('execucoes_agendadas')
        .update({ 
          status: 'timeout',
          finalizado_em: new Date().toISOString()
        })
       .eq('tipo', 'djen')
       .eq('status', 'executando')
        .not('finalizado_em', 'is', null)
       .select()
 
     if (fantasmaError) {
       console.error('Erro ao limpar fantasmas:', fantasmaError)
     } else {
       console.log(`[Reset DJEN] ${execFantasma?.length || 0} execuções fantasma limpas`)
     }
 
     // 3. Resetar completamente a configuração do DJEN
     const { error: configError } = await supabase
       .from('configuracoes_monitoramento')
       .update({
         metadata: {
           status: 'idle',
           next_offset: 0,
           current: 0,
           total: 114,
           percentage: 0,
           continuingRun: false,
           cancelado: false,
           has_more: false,
           processados: 0,
           novas: 0,
           duplicatas: 0,
           descartadas: 0,
           erros: 0,
           djen_run: null
         }
       })
       .eq('tipo', 'djen')
 
     if (configError) {
       throw configError
     }
 
     console.log('[Reset DJEN] Configuração resetada com sucesso')
 
     return new Response(
       JSON.stringify({ 
         success: true,
         message: 'Estado do DJEN resetado completamente',
         execucoes_canceladas: execAtivas?.length || 0,
         fantasmas_limpas: execFantasma?.length || 0
       }),
       { 
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 200 
       }
     )
 
   } catch (error) {
     console.error('[Reset DJEN] Erro:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
     return new Response(
      JSON.stringify({ error: errorMessage }),
       { 
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 500 
       }
     )
   }
 })