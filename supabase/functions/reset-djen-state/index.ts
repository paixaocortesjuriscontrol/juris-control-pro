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
 
      // 1. LIMPAR TUDO: execuções fantasma E ativas
      // Fantasmas = status 'executando' MAS já tem finalizado_em preenchido
      const { data: todasExecucoes, error: execError } = await supabase
       .from('execucoes_agendadas')
       .update({
         status: 'cancelado',
         finalizado_em: new Date().toISOString()
       })
       .eq('tipo', 'djen')
       .or('status.eq.executando,status.eq.pendente,status.eq.agendado')
       .select()
 
      if (execError) {
        console.error('Erro ao cancelar execuções:', execError)
     } else {
        console.log(`[Reset DJEN] ${todasExecucoes?.length || 0} execuções canceladas/limpas`)
     }
 
      // 2. ZERAR METADATA COMPLETAMENTE
     const { error: configError } = await supabase
       .from('configuracoes_monitoramento')
       .update({
         metadata: {
           status: 'idle',
           cancelado: false,
            paused_globally: false,
            continuingRun: false,
            // ZERAR TODOS os contadores
            next_offset: 0,
            current: 0,
            total: 0,
            percentage: 0,
            processados: 0,
            novas: 0,
            duplicatas: 0,
            descartadas: 0,
            erros: 0,
            has_more: false,
            // Limpar run IDs
            djen_run: null,
            last_run: null,
            last_complete_run: null
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
         execucoes_limpas: todasExecucoes?.length || 0
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