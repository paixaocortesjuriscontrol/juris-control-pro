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

    console.log('[Atualizar Parâmetros DJEN] Aplicando configuração ultra-conservadora...')

    const { data, error } = await supabase
      .from('parametros_monitoramento_djen')
      .update({
        delay_jina_api: 6000,
        delay_entre_monitoramentos: 4000,
        delay_entre_paginas: 3000,
        delay_entre_tribunais: 3000,
        max_paralelo: 1,
        max_por_invocacao: 5,
        retry_base_delay_ms: 10000,
        max_retries: 2,
        soft_timeout_ms: 110000,
        finalization_buffer_ms: 15000,
        descricao: 'Configuração ultra-conservadora: sem paralelismo, delays longos (6s API), prioridade estabilidade',
        updated_at: new Date().toISOString()
      })
      .eq('ativo', true)
      .select()

    if (error) {
      throw error
    }

    console.log('[Atualizar Parâmetros DJEN] Parâmetros atualizados com sucesso')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Parâmetros DJEN atualizados para configuração ultra-conservadora',
        parametros: data
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('[Atualizar Parâmetros DJEN] Erro:', error)
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