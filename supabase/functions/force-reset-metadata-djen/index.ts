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
 
      console.log('[Force Reset] Limpeza total do estado DJEN...')
 
      // 1. Desativar cron jobs DJEN usando service role
      console.log('[Force Reset] Desativando cron jobs...')
      const { error: cronError1 } = await supabase.rpc('cron_unschedule', { job_id: 86 }) // monitorar-djen-processos-manha
      const { error: cronError2 } = await supabase.rpc('cron_unschedule', { job_id: 43 }) // processar-alertas-djen-coordenacao
      
      if (cronError1) console.log('[Force Reset] Aviso cron 86:', cronError1.message)
      if (cronError2) console.log('[Force Reset] Aviso cron 43:', cronError2.message)
      
      // 2. Cancelar execuções pendentes
      await supabase
        .from('execucoes_agendadas')
        .delete()
        .eq('tipo', 'djen')

      // 3. Zerar metadata e desativar
     const { error } = await supabase
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
            processados: 0,
            novas: 0,
            duplicatas: 0,
            descartadas: 0,
            erros: 0,
            has_more: false,
            djen_run: null,
            last_run: null,
            last_complete_run: null,
            tribunais_stats: [],
            total_paginas: 0,
            total_resultados: 0,
            duracao_s: 0,
            offset_processado: 0
         }
       })
       .eq('tipo', 'djen')
 
     if (error) throw error
 
     console.log('[Force Reset] Metadata zerado!')
 
     return new Response(
       JSON.stringify({ success: true, message: 'Metadata resetado' }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
     )
 
   } catch (error) {
     console.error('[Force Reset] Erro:', error)
     const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
     )
   }
 })