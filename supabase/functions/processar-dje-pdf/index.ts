import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================
// SISTEMA DJE-PDF - Fase 3: Processamento e Extração de Texto
// Extrai texto dos PDFs baixados e indexa por página
// =============================================================

// Regex para detectar números de processo no padrão CNJ
const PROCESSO_REGEX = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;

// Usa Jina AI para extrair texto de PDFs
async function extractTextWithJina(pdfUrl: string): Promise<{ pages: { page: number; text: string }[]; totalPages: number } | null> {
  const JINA_API_KEY = Deno.env.get("JINA_API_KEY");
  
  if (!JINA_API_KEY) {
    console.error("[DJE-PDF] JINA_API_KEY não configurada");
    return null;
  }

  try {
    console.log("[DJE-PDF] Extraindo texto via Jina AI...");
    
    const response = await fetch(`https://r.jina.ai/${encodeURIComponent(pdfUrl)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${JINA_API_KEY}`,
        "Accept": "application/json",
        "X-Return-Format": "markdown",
      },
    });

    if (!response.ok) {
      console.error(`[DJE-PDF] Jina API erro: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.content || data.data?.content || "";

    if (!content) {
      console.log("[DJE-PDF] Jina não retornou conteúdo");
      return null;
    }

    // Jina retorna o conteúdo inteiro, vamos fragmentar por marcadores de página ou por tamanho
    const pages = splitIntoPages(content);
    
    console.log(`[DJE-PDF] Extraído: ${pages.length} páginas, ${content.length} caracteres`);
    
    return { pages, totalPages: pages.length };
  } catch (error) {
    console.error("[DJE-PDF] Erro ao extrair texto:", error);
    return null;
  }
}

// Fragmenta o conteúdo em páginas (aproximadamente 3000 chars por página)
function splitIntoPages(content: string): { page: number; text: string }[] {
  const pages: { page: number; text: string }[] = [];
  const charsPerPage = 3000;
  
  // Tenta dividir por marcadores de página primeiro
  const pageMarkers = content.split(/(?:^|\n)---\s*Página\s*\d+\s*---(?:\n|$)/i);
  
  if (pageMarkers.length > 1) {
    pageMarkers.forEach((text, index) => {
      if (text.trim()) {
        pages.push({ page: index + 1, text: text.trim() });
      }
    });
    return pages;
  }

  // Fallback: divide por tamanho, tentando quebrar em linhas
  let currentPage = 1;
  let currentText = "";
  const lines = content.split("\n");

  for (const line of lines) {
    if (currentText.length + line.length > charsPerPage && currentText.length > 0) {
      pages.push({ page: currentPage, text: currentText.trim() });
      currentPage++;
      currentText = line;
    } else {
      currentText += (currentText ? "\n" : "") + line;
    }
  }

  if (currentText.trim()) {
    pages.push({ page: currentPage, text: currentText.trim() });
  }

  return pages;
}

// Extrai números de processo do texto
function extractProcessNumbers(text: string): string[] {
  const matches = text.match(PROCESSO_REGEX) || [];
  return [...new Set(matches)]; // Remove duplicatas
}

async function processPdf(
  supabase: SupabaseClient,
  pdfRecord: { id: string; storage_path: string; tribunal: string; data_publicacao: string }
): Promise<{ success: boolean; pages: number; processes: number; error?: string }> {
  
  const logPrefix = `[DJE-PDF ${pdfRecord.tribunal}]`;
  
  try {
    // Marca como processando
    await supabase
      .from("dje_pdfs_diarios")
      .update({ status: "processando" } as never)
      .eq("id", pdfRecord.id);

    // Gera URL assinada para o PDF
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("dje-pdfs")
      .createSignedUrl(pdfRecord.storage_path, 600); // 10 minutos

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error(`${logPrefix} Erro ao gerar URL assinada:`, signedUrlError);
      return { success: false, pages: 0, processes: 0, error: "Erro ao acessar PDF" };
    }

    // Extrai texto via Jina
    const extractedData = await extractTextWithJina(signedUrlData.signedUrl);

    if (!extractedData || extractedData.pages.length === 0) {
      await supabase
        .from("dje_pdfs_diarios")
        .update({ 
          status: "erro", 
          erro_mensagem: "Não foi possível extrair texto do PDF" 
        } as never)
        .eq("id", pdfRecord.id);
      
      return { success: false, pages: 0, processes: 0, error: "Falha na extração de texto" };
    }

    let totalProcesses = 0;

    // Insere conteúdo indexado por página
    for (const pageData of extractedData.pages) {
      const processNumbers = extractProcessNumbers(pageData.text);
      totalProcesses += processNumbers.length;

      const { error: insertError } = await supabase
        .from("dje_conteudo_indexado")
        .upsert({
          pdf_id: pdfRecord.id,
          pagina: pageData.page,
          conteudo_texto: pageData.text,
          processos_detectados: processNumbers,
        } as never, {
          onConflict: "pdf_id,pagina",
          ignoreDuplicates: false,
        });

      if (insertError) {
        console.error(`${logPrefix} Erro ao inserir página ${pageData.page}:`, insertError);
      }
    }

    // Atualiza registro como processado
    await supabase
      .from("dje_pdfs_diarios")
      .update({
        status: "processado",
        total_paginas: extractedData.totalPages,
        processado_em: new Date().toISOString(),
        erro_mensagem: null,
      } as never)
      .eq("id", pdfRecord.id);

    console.log(`${logPrefix} ✅ Processado: ${extractedData.totalPages} páginas, ${totalProcesses} processos detectados`);

    return { 
      success: true, 
      pages: extractedData.totalPages, 
      processes: totalProcesses 
    };

  } catch (error) {
    console.error(`${logPrefix} Erro fatal:`, error);
    
    await supabase
      .from("dje_pdfs_diarios")
      .update({ 
        status: "erro", 
        erro_mensagem: error instanceof Error ? error.message : "Erro desconhecido" 
      } as never)
      .eq("id", pdfRecord.id);

    return { 
      success: false, 
      pages: 0, 
      processes: 0, 
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    };
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
    const { pdf_id, limit = 5 } = body;

    // Se recebeu um ID específico, processa só esse
    if (pdf_id) {
      const { data: pdfRecord, error } = await supabase
        .from("dje_pdfs_diarios")
        .select("id, storage_path, tribunal, data_publicacao")
        .eq("id", pdf_id)
        .single();

      if (error || !pdfRecord) {
        return new Response(
          JSON.stringify({ error: "PDF não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const record = pdfRecord as { id: string; storage_path: string; tribunal: string; data_publicacao: string };
      const result = await processPdf(supabase, record);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Processa PDFs pendentes na fila
    const { data: pendingPdfs, error: fetchError } = await supabase
      .from("dje_pdfs_diarios")
      .select("id, storage_path, tribunal, data_publicacao")
      .eq("status", "baixado")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingPdfs || pendingPdfs.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum PDF pendente para processar", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { id: string; tribunal: string; success: boolean; pages?: number; error?: string }[] = [];

    for (const pdf of pendingPdfs) {
      const record = pdf as { id: string; storage_path: string; tribunal: string; data_publicacao: string };
      const result = await processPdf(supabase, record);
      results.push({
        id: record.id,
        tribunal: record.tribunal,
        success: result.success,
        pages: result.pages,
        error: result.error,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DJE-PDF] Erro fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
