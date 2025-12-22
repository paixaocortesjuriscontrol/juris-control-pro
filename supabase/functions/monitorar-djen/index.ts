import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

interface Monitoramento {
  id: string;
  tipo: string;
  termo_busca: string;
  oab?: string;
  uf?: string;
  criado_por: string;
}

// Browser-like headers to avoid blocking
const browserHeaders = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://comunica.pje.jus.br",
  "Referer": "https://comunica.pje.jus.br/",
};

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
  let searchText: string;
  
  switch (monitoramento.tipo) {
    case "palavra-chave":
      searchText = monitoramento.termo_busca;
      break;
    case "processo":
      searchText = monitoramento.termo_busca.replace(/\D/g, '');
      break;
    default:
      return [];
  }

  return await fetchDJENResults(searchText, monitoramento.id);
}

async function searchDJENByAdvogado(oab: string, uf: string, monitoramentoId: string): Promise<any[]> {
  // Use the same format as buscar-djen: "OAB {number} {uf}"
  const searchText = `OAB ${oab} ${uf.toUpperCase()}`;
  return await fetchDJENResults(searchText, monitoramentoId);
}

async function fetchDJENResults(searchText: string, monitoramentoId: string): Promise<any[]> {
  // Use current date as both start and end date
  const dataAtual = new Date().toISOString().split('T')[0];
  
  const queryParams = new URLSearchParams();
  queryParams.append("texto", searchText);
  queryParams.append("dataDisponibilizacaoInicio", dataAtual);
  queryParams.append("dataDisponibilizacaoFim", dataAtual);
  
  // Try multiple possible API endpoints (same as buscar-djen)
  const endpoints = [
    `${PJE_COMUNICA_API}/comunicacao/consulta`,
    `${PJE_COMUNICA_API}/comunicacoes`,
    `${PJE_COMUNICA_API}/comunicacao/pesquisar`,
    `${PJE_COMUNICA_API}/comunicacao`,
  ];

  const fullQueryString = queryParams.toString();
  
  for (const endpoint of endpoints) {
    const fullUrl = `${endpoint}?${fullQueryString}`;
    console.log(`Searching DJEN: ${fullUrl}`);
    
    try {
      const response = await fetch(fullUrl, {
        method: "GET",
        headers: browserHeaders,
      });

      const contentType = response.headers.get("content-type") || "";
      console.log("Response status:", response.status, "Content-Type:", contentType);
      
      // If we get HTML, skip to next endpoint
      if (contentType.includes("text/html")) {
        console.log("Got HTML response, trying next endpoint...");
        continue;
      }

      if (response.ok) {
        const data = await response.json();
        console.log("Success! Got JSON response");
        
        // Handle different response formats
        const items = data.items || data.content || data.comunicacoes || data.publicacoes || [];
        
        if (Array.isArray(items)) {
          return items;
        }
        
        return [];
      }

      // 422 means "not found" - return empty results
      if (response.status === 422) {
        console.log("No results for this search");
        return [];
      }

      console.error(`DJEN API error: ${response.status}`);
    } catch (error) {
      console.error(`Error with endpoint ${endpoint}:`, error);
    }
  }

  console.log("All endpoints failed, returning empty results");
  return [];
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
        const conteudo = pub.conteudo || pub.texto || pub.teor || pub.descricao || JSON.stringify(pub);
        const hashConteudo = generateHash(conteudo + (pub.dataPublicacao || pub.dataDisponibilizacao || pub.data || ''));

        // Try to insert (will fail if duplicate due to unique constraint)
        const { error: insertError } = await supabase
          .from('publicacoes_djen')
          .insert({
            monitoramento_id: monitoramento.id,
            hash_conteudo: hashConteudo,
            data_publicacao: pub.dataPublicacao || pub.dataDisponibilizacao || pub.data || null,
            processo_numero: pub.numeroProcesso || pub.processo || null,
            conteudo: conteudo.substring(0, 10000),
            fonte: pub.fonte || pub.orgao || pub.tribunal || 'DJEN',
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
              link: '/analise-djen',
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
