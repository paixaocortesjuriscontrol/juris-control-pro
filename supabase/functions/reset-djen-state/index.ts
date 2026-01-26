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
     
     // LOOP: Repetir 3x para garantir que workers ativos param
     for (let attempt = 1; attempt <= 3; attempt++) {
       console.log(`[Reset DJEN] Tentativa ${attempt}/3...`)
       
       // 1. Desativar PRIMEIRO para parar cron jobs
       await supabase
         .from('configuracoes_monitoramento')
         .update({ ativo: false })
         .eq('tipo', 'djen')
       
       // 2. Aguardar 500ms para workers verem a flag
       await new Promise(r => setTimeout(r, 500))
       
       // 3. Deletar execuções
       await supabase
         .from('execucoes_agendadas')
         .delete()
         .eq('tipo', 'djen')
     }
 
     // 4. Contagem final de execuções deletadas
      const { data: deletadas, error: deleteError } = await supabase
       .from('execucoes_agendadas')
       .select('id')
       .eq('tipo', 'djen')
 
      // 5. ZERAR METADATA
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
         execucoes_deletadas: deletadas?.length || 0
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