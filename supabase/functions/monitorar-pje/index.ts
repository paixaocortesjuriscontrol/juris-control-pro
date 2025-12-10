import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_API_BASE = "https://comunica.pje.jus.br";

interface Monitoramento {
  id: string;
  tipo: string;
  termo_busca: string;
  oab?: string;
  uf?: string;
  criado_por: string;
}

// Generate hash for publication content to detect duplicates
function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

async function searchPJE(monitoramento: Monitoramento): Promise<any[]> {
  const queryParams = new URLSearchParams();
  
  switch (monitoramento.tipo) {
    case "advogado":
      if (!monitoramento.oab || !monitoramento.uf) return [];
      queryParams.append("numeroOAB", monitoramento.oab);
      queryParams.append("siglaUFOAB", monitoramento.uf.toUpperCase());
      break;
    case "palavra-chave":
      queryParams.append("texto", monitoramento.termo_busca);
      break;
    case "processo":
      queryParams.append("numeroProcesso", monitoramento.termo_busca.replace(/\D/g, ''));
      break;
    default:
      return [];
  }

  // Add date filter for last 30 days
  const dataFim = new Date().toISOString().split('T')[0];
  const dataInicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  queryParams.append("dataDisponibilizacaoInicio", dataInicio);
  queryParams.append("dataDisponibilizacaoFim", dataFim);
  queryParams.append("pagina", "0");
  queryParams.append("itensPorPagina", "50");
  
  const fullUrl = `${PJE_API_BASE}/api/consulta?${queryParams.toString()}`;
  
  console.log(`Searching PJE for monitoramento ${monitoramento.id}: ${fullUrl}`);
  
  try {
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: { 
        "Accept": "application/json",
        "User-Agent": "JurisControl/1.0",
      },
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 422) {
        console.log(`No results for monitoramento ${monitoramento.id}`);
        return [];
      }
      console.error(`PJE API error for ${monitoramento.id}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.comunicacoes || data.items || data.content || [];
  } catch (error) {
    console.error(`Error searching PJE for ${monitoramento.id}:`, error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting PJE monitoring job...");

    // Fetch all active monitoramentos
    const { data: monitoramentos, error: fetchError } = await supabase
      .from('monitoramentos_pje')
      .select('*')
      .eq('ativo', true);

    if (fetchError) {
      console.error("Error fetching monitoramentos:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${monitoramentos?.length || 0} active PJE monitoramentos`);

    let totalNewPublications = 0;

    for (const monitoramento of monitoramentos || []) {
      const publications = await searchPJE(monitoramento);
      console.log(`Found ${publications.length} publications for monitoramento ${monitoramento.id}`);

      for (const pub of publications) {
        const conteudo = pub.texto || pub.conteudo || pub.descricao || JSON.stringify(pub);
        const hashConteudo = generateHash(conteudo + (pub.dataDisponibilizacao || pub.dataPublicacao || pub.data || ''));

        // Try to insert (will fail if duplicate due to unique constraint)
        const { error: insertError } = await supabase
          .from('publicacoes_pje')
          .insert({
            monitoramento_id: monitoramento.id,
            hash_conteudo: hashConteudo,
            data_publicacao: pub.dataDisponibilizacao || pub.dataPublicacao || pub.data || null,
            processo_numero: pub.numeroProcesso || pub.processo || null,
            conteudo: conteudo.substring(0, 10000),
            fonte: pub.orgaoJulgador || pub.tribunal || 'PJE',
          });

        if (!insertError) {
          totalNewPublications++;
          
          // Create notification for the user
          await supabase.from('notificacoes').insert({
            usuario_id: monitoramento.criado_por,
            titulo: 'Nova publicação no PJE',
            mensagem: `Encontrada publicação para: "${monitoramento.termo_busca}"`,
            tipo: 'pje',
            link: '/buscar-pje',
            dados: {
              monitoramento_id: monitoramento.id,
              processo: pub.numeroProcesso || pub.processo,
              preview: conteudo.substring(0, 200),
            },
          });
        }
      }
    }

    console.log(`PJE Monitoring complete. ${totalNewPublications} new publications found.`);

    return new Response(
      JSON.stringify({
        success: true,
        monitoramentosProcessados: monitoramentos?.length || 0,
        novasPublicacoes: totalNewPublications,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("PJE Monitoring error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
