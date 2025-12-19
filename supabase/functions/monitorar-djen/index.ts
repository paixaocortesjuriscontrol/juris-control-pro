import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DJEN_API_BASE = "https://comunicaapi.pje.jus.br/api/v1";

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

async function searchDJEN(monitoramento: Monitoramento): Promise<any[]> {
  const results: any[] = [];
  
  // Handle multiple UFs for advogado type
  if (monitoramento.tipo === "advogado") {
    if (!monitoramento.oab) return [];
    
    const ufsToSearch = monitoramento.uf === 'TODAS' 
      ? ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']
      : (monitoramento.uf?.split(',') || []);
    
    for (const uf of ufsToSearch) {
      const ufResults = await searchDJENByAdvogado(monitoramento.oab, uf.trim(), monitoramento.id);
      results.push(...ufResults);
    }
    return results;
  }
  
  // Other types (palavra-chave, processo)
  let url: string;
  
  switch (monitoramento.tipo) {
    case "palavra-chave":
      const encodedKeyword = encodeURIComponent(monitoramento.termo_busca);
      url = `${DJEN_API_BASE}/comunicacao/pesquisa?texto=${encodedKeyword}`;
      break;
    case "processo":
      const cleanedNumber = monitoramento.termo_busca.replace(/\D/g, '');
      url = `${DJEN_API_BASE}/comunicacao/processo/${cleanedNumber}`;
      break;
    default:
      return [];
  }

  return await fetchDJENResults(url, monitoramento.id);
}

async function searchDJENByAdvogado(oab: string, uf: string, monitoramentoId: string): Promise<any[]> {
  const url = `${DJEN_API_BASE}/comunicacao/advogado/${oab}/${uf.toUpperCase()}`;
  return await fetchDJENResults(url, monitoramentoId);
}

async function fetchDJENResults(url: string, monitoramentoId: string): Promise<any[]> {
  // Add date filter for last 30 days
  const dataFim = new Date().toISOString().split('T')[0];
  const dataInicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const queryParams = new URLSearchParams();
  queryParams.append("pagina", "0");
  queryParams.append("tamanhoPagina", "50");
  queryParams.append("dataInicio", dataInicio);
  queryParams.append("dataFim", dataFim);
  
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}${queryParams.toString()}`;
  
  console.log(`Searching DJEN: ${fullUrl}`);
  
  try {
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 422) {
        console.log(`No results for URL: ${fullUrl}`);
        return [];
      }
      console.error(`DJEN API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.items || data.content || [];
  } catch (error) {
    console.error(`Error searching DJEN:`, error);
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

    console.log("Starting DJEN monitoring job...");

    // Fetch all active monitoramentos
    const { data: monitoramentos, error: fetchError } = await supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true);

    if (fetchError) {
      console.error("Error fetching monitoramentos:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${monitoramentos?.length || 0} active monitoramentos`);

    let totalNewPublications = 0;

    for (const monitoramento of monitoramentos || []) {
      const publications = await searchDJEN(monitoramento);
      console.log(`Found ${publications.length} publications for monitoramento ${monitoramento.id}`);

      for (const pub of publications) {
        const conteudo = pub.conteudo || pub.texto || pub.descricao || JSON.stringify(pub);
        const hashConteudo = generateHash(conteudo + (pub.dataPublicacao || pub.data || ''));

        // Try to insert (will fail if duplicate due to unique constraint)
        const { error: insertError } = await supabase
          .from('publicacoes_djen')
          .insert({
            monitoramento_id: monitoramento.id,
            hash_conteudo: hashConteudo,
            data_publicacao: pub.dataPublicacao || pub.data || null,
            processo_numero: pub.numeroProcesso || pub.processo || null,
            conteudo: conteudo.substring(0, 10000),
            fonte: pub.fonte || pub.tribunal || 'DJEN',
          });

        if (!insertError) {
          totalNewPublications++;
          
          // Get users to notify (creator + admins + coordinators)
          const usersToNotify: string[] = [monitoramento.criado_por];
          
          const { data: adminUsers } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'coordenador']);
          
          adminUsers?.forEach((u: any) => {
            if (!usersToNotify.includes(u.user_id)) {
              usersToNotify.push(u.user_id);
            }
          });

          // Create notifications for all users
          for (const userId of usersToNotify) {
            await supabase.from('notificacoes').insert({
              usuario_id: userId,
              titulo: 'Nova publicação no DJEN',
              mensagem: `Encontrada publicação para: "${monitoramento.termo_busca}"`,
              tipo: 'info',
              link: '/buscar-djen',
              dados: {
                monitoramento_id: monitoramento.id,
                processo: pub.numeroProcesso || pub.processo,
                preview: conteudo.substring(0, 200),
              },
            });
          }
        }
      }
    }

    // Atualizar configuração de monitoramento
    await supabase
      .from('configuracoes_monitoramento')
      .update({ 
        ultima_execucao: new Date().toISOString(),
        metadata: {
          last_complete_run: new Date().toISOString(),
          monitoramentos_processados: monitoramentos?.length || 0,
          novas_publicacoes: totalNewPublications,
        }
      })
      .eq('tipo', 'djen');

    console.log(`Monitoring complete. ${totalNewPublications} new publications found.`);

    return new Response(
      JSON.stringify({
        success: true,
        monitoramentosProcessados: monitoramentos?.length || 0,
        novasPublicacoes: totalNewPublications,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Monitoring error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
