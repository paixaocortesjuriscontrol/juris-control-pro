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
     
      // 1. DESATIVAR monitoramento PRIMEIRO (cancela cron jobs)
      await supabase
        .from('configuracoes_monitoramento')
        .update({ 
          ativo: false,
          metadata: {
            status: 'idle',
            cancelado: true,
            paused_globally: true,
            continuingRun: false
          }
        })
        .eq('tipo', 'djen')
      
      console.log('[Reset DJEN] Aguardando workers pararem...')
      await new Promise(r => setTimeout(r, 2000))
 
      // 2. Deletar execuções
      await supabase
       .from('execucoes_agendadas')
        .delete()
       .eq('tipo', 'djen')
 
      // 3. Marcar execuções ghost como canceladas
      await supabase
        .from('execucoes_agendadas')
        .update({ 
          status: 'cancelado', 
          finalizado_em: new Date().toISOString() 
        })
        .eq('tipo', 'djen')
        .eq('status', 'executando')

      console.log('[Reset DJEN] Zerando metadata...')
      await new Promise(r => setTimeout(r, 1000))

      // 4. ZERAR METADATA COMPLETO (sobrescreve qualquer atualização tardia)
      const { error: resetError } = await supabase
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
 
      if (resetError) throw resetError
 
      console.log('[Reset DJEN] Reset completo!')
 
     return new Response(
       JSON.stringify({ 
         success: true,
          message: 'Estado do DJEN resetado completamente'
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