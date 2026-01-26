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
 
     console.log('[Force Reset] Zerando metadata DJEN...')
 
     // SOMENTE zerar metadata, nada mais
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