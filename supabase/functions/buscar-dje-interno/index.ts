import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================
// SISTEMA DJE-PDF - Fase 4: Busca Interna dos Termos
// Busca termos monitorados no conteúdo indexado dos PDFs
// =============================================================

interface Monitoramento {
  id: string;
  termo: string;
  tipo: string;
  tribunal: string;
}

interface SearchMatch {
  conteudo_id: string;
  monitoramento_id: string;
  termo_encontrado: string;
  contexto: string;
  processo_numero: string | null;
  pagina: number;
}

// Extrai contexto em torno do termo encontrado
function extractContext(text: string, termo: string, contextSize: number = 250): string {
  const lowerText = text.toLowerCase();
  const lowerTermo = termo.toLowerCase();
  const index = lowerText.indexOf(lowerTermo);
  
  if (index === -1) return "";
  
  const start = Math.max(0, index - contextSize);
  const end = Math.min(text.length, index + termo.length + contextSize);
  
  let context = text.slice(start, end);
  
  if (start > 0) context = "..." + context;
  if (end < text.length) context = context + "...";
  
  return context;
}

// Busca um termo no conteúdo indexado
async function searchTermo(
  supabase: SupabaseClient,
  monitoramento: Monitoramento,
  dataPublicacao: string
): Promise<SearchMatch[]> {
  const matches: SearchMatch[] = [];
  
  try {
    // Busca páginas do tribunal/data com o termo
    // Usa ILIKE para busca case-insensitive
    const { data: pages, error } = await supabase
      .from("dje_conteudo_indexado")
      .select(`
        id,
        pagina,
        conteudo_texto,
        processos_detectados,
        pdf:dje_pdfs_diarios!inner(
          id,
          tribunal,
          data_publicacao
        )
      `)
      .eq("pdf.tribunal", monitoramento.tribunal)
      .eq("pdf.data_publicacao", dataPublicacao)
      .ilike("conteudo_texto", `%${monitoramento.termo}%`);

    if (error) {
      console.error(`[DJE-BUSCA] Erro ao buscar termo "${monitoramento.termo}":`, error);
      return matches;
    }

    if (!pages || pages.length === 0) {
      return matches;
    }

    for (const page of pages) {
      const pageData = page as {
        id: string;
        pagina: number;
        conteudo_texto: string;
        processos_detectados: string[];
      };

      const context = extractContext(pageData.conteudo_texto, monitoramento.termo);
      
      // Tenta encontrar um número de processo próximo ao termo
      const processoProximo = pageData.processos_detectados?.[0] || null;

      matches.push({
        conteudo_id: pageData.id,
        monitoramento_id: monitoramento.id,
        termo_encontrado: monitoramento.termo,
        contexto: context,
        processo_numero: processoProximo,
        pagina: pageData.pagina,
      });
    }

    return matches;
  } catch (error) {
    console.error(`[DJE-BUSCA] Erro inesperado:`, error);
    return matches;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing environment configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { 
      data_publicacao,
      tribunal,
      monitoramento_id,
    } = body;

    // Data padrão: hoje
    const dataRef = data_publicacao || new Date().toISOString().split("T")[0];

    // Busca monitoramentos ativos
    let monitoramentosQuery = supabase
      .from("monitoramentos_djen")
      .select("id, termo, tipo, tribunal")
      .eq("ativo", true);

    if (tribunal) {
      monitoramentosQuery = monitoramentosQuery.eq("tribunal", tribunal);
    }

    if (monitoramento_id) {
      monitoramentosQuery = monitoramentosQuery.eq("id", monitoramento_id);
    }

    const { data: monitoramentos, error: monError } = await monitoramentosQuery;

    if (monError) {
      return new Response(
        JSON.stringify({ error: monError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!monitoramentos || monitoramentos.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum monitoramento ativo encontrado", matches: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DJE-BUSCA] Buscando ${monitoramentos.length} termos para ${dataRef}`);

    const allMatches: SearchMatch[] = [];
    const stats: { tribunal: string; termos: number; matches: number }[] = [];

    // Agrupa por tribunal para otimizar
    const byTribunal = new Map<string, Monitoramento[]>();
    for (const mon of monitoramentos) {
      const monData = mon as Monitoramento;
      const list = byTribunal.get(monData.tribunal) || [];
      list.push(monData);
      byTribunal.set(monData.tribunal, list);
    }

    for (const [trib, monList] of byTribunal) {
      let tribunalMatches = 0;

      for (const mon of monList) {
        const matches = await searchTermo(supabase, mon, dataRef);
        allMatches.push(...matches);
        tribunalMatches += matches.length;
      }

      stats.push({
        tribunal: trib,
        termos: monList.length,
        matches: tribunalMatches,
      });

      console.log(`[DJE-BUSCA] ${trib}: ${tribunalMatches} matches em ${monList.length} termos`);
    }

    // Insere resultados no banco (evitando duplicatas)
    if (allMatches.length > 0) {
      const { error: insertError } = await supabase
        .from("dje_resultados_busca")
        .upsert(
          allMatches.map(m => ({
            conteudo_id: m.conteudo_id,
            monitoramento_id: m.monitoramento_id,
            termo_encontrado: m.termo_encontrado,
            contexto: m.contexto,
            processo_numero: m.processo_numero,
            pagina: m.pagina,
            origem: "dje_pdf",
          })) as never[],
          { ignoreDuplicates: true }
        );

      if (insertError) {
        console.error("[DJE-BUSCA] Erro ao inserir resultados:", insertError);
      }
    }

    console.log(`[DJE-BUSCA] ✅ Total: ${allMatches.length} matches encontrados`);

    return new Response(
      JSON.stringify({
        success: true,
        data_publicacao: dataRef,
        monitoramentos_processados: monitoramentos.length,
        total_matches: allMatches.length,
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DJE-BUSCA] Erro fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
