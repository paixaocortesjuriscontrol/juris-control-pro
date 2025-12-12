import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TermoMonitoramento {
  id: string;
  termo: string;
  categoria: string;
  prioridade: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting term monitoring scan...');

    // Buscar termos ativos
    const { data: termos, error: termosError } = await supabase
      .from('termos_monitoramento')
      .select('id, termo, categoria, prioridade')
      .eq('ativo', true);

    if (termosError) throw termosError;

    if (!termos || termos.length === 0) {
      console.log('No active terms configured');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum termo configurado', alertasGerados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${termos.length} active terms`);

    // Buscar movimentações dos últimos 30 dias que ainda não têm alertas
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: movimentacoes, error: movError } = await supabase
      .from('movimentacoes')
      .select('id, processo_id, descricao, data_movimentacao')
      .gte('data_movimentacao', thirtyDaysAgo.toISOString())
      .order('data_movimentacao', { ascending: false })
      .limit(1000);

    if (movError) throw movError;

    console.log(`Scanning ${movimentacoes?.length || 0} movements`);

    // Buscar alertas existentes para evitar duplicatas
    const { data: alertasExistentes } = await supabase
      .from('alertas_monitoramento')
      .select('movimentacao_id, termo_id');

    const alertasSet = new Set(
      (alertasExistentes || []).map(a => `${a.movimentacao_id}-${a.termo_id}`)
    );

    let alertasGerados = 0;
    const novosAlertas: any[] = [];

    // Varrer movimentações buscando termos
    for (const mov of movimentacoes || []) {
      const descricaoLower = mov.descricao.toLowerCase();

      for (const termo of termos) {
        const termoLower = termo.termo.toLowerCase();
        
        // Verificar se o termo está presente na descrição
        if (descricaoLower.includes(termoLower)) {
          const key = `${mov.id}-${termo.id}`;
          
          // Evitar duplicatas
          if (!alertasSet.has(key)) {
            // Extrair contexto (100 caracteres ao redor do termo)
            const index = descricaoLower.indexOf(termoLower);
            const start = Math.max(0, index - 50);
            const end = Math.min(mov.descricao.length, index + termo.termo.length + 50);
            const contexto = (start > 0 ? '...' : '') + 
                            mov.descricao.slice(start, end) + 
                            (end < mov.descricao.length ? '...' : '');

            novosAlertas.push({
              termo_id: termo.id,
              processo_id: mov.processo_id,
              movimentacao_id: mov.id,
              termo_encontrado: termo.termo,
              contexto,
              prioridade: termo.prioridade,
              status: 'pendente',
            });

            alertasSet.add(key);
            alertasGerados++;
          }
        }
      }
    }

    // Inserir alertas em lotes
    if (novosAlertas.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < novosAlertas.length; i += BATCH_SIZE) {
        const batch = novosAlertas.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
          .from('alertas_monitoramento')
          .insert(batch);

        if (insertError) {
          console.error('Error inserting alerts batch:', insertError);
        }
      }
    }

    console.log(`Scan complete. Generated ${alertasGerados} alerts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertasGerados,
        movimentacoesVerificadas: movimentacoes?.length || 0,
        termosAtivos: termos.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in term monitoring:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
