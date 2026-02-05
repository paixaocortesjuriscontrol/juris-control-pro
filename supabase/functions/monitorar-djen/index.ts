// ============================================================================
// MONITORAR-DJEN Edge Function - Ultra Minimal Version
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const execucaoId = body?.execucaoId;
    
    console.log('[DJEN] Function invoked');

    // Simple test - count monitoramentos
    const { count } = await supabase
      .from('monitoramentos_djen')
      .select('id', { count: 'exact', head: true })
      .eq('ativo', true);

    console.log(`[DJEN] Total active monitoramentos: ${count}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Minimal version deployed successfully',
        totalMonitoramentos: count,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
