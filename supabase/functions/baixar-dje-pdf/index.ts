import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================
// SISTEMA DJE-PDF - Fase 2: Download Automatizado de PDFs
// Baixa PDFs diários dos tribunais e armazena no Supabase Storage
// =============================================================

interface TribunalConfig {
  nome: string;
  buildUrl: (data: string, caderno?: string) => string;
  cadernos: string[];
}

// Configuração dos tribunais suportados
const TRIBUNAIS: Record<string, TribunalConfig> = {
  // TRTs via DEJT (Diário Eletrônico da Justiça do Trabalho)
  TRT1: {
    nome: "TRT1 - Rio de Janeiro",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT1&data=${data}&caderno=${caderno}`,
    cadernos: ["judiciario", "administrativo"],
  },
  TRT2: {
    nome: "TRT2 - São Paulo",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT2&data=${data}&caderno=${caderno}`,
    cadernos: ["judiciario", "administrativo"],
  },
  TRT10: {
    nome: "TRT10 - Brasília/Tocantins",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT10&data=${data}&caderno=${caderno}`,
    cadernos: ["judiciario", "administrativo"],
  },
  TRT23: {
    nome: "TRT23 - Mato Grosso",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT23&data=${data}&caderno=${caderno}`,
    cadernos: ["judiciario", "administrativo"],
  },
  TRT24: {
    nome: "TRT24 - Mato Grosso do Sul",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT24&data=${data}&caderno=${caderno}`,
    cadernos: ["judiciario", "administrativo"],
  },
  TST: {
    nome: "TST - Tribunal Superior do Trabalho",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TST&data=${data}&caderno=${caderno}`,
    cadernos: ["judiciario", "administrativo"],
  },
};

// Formata data para o padrão esperado pelo DEJT (YYYY-MM-DD)
function formatDateForDEJT(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Baixa PDF de um tribunal específico
async function downloadPDF(url: string): Promise<{ data: ArrayBuffer; size: number } | null> {
  try {
    console.log(`[DJE-PDF] Baixando: ${url}`);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/pdf,*/*",
      },
    });

    if (!response.ok) {
      console.error(`[DJE-PDF] Erro HTTP ${response.status} para ${url}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    
    // DEJT pode retornar HTML de erro ao invés de PDF
    if (contentType.includes("text/html")) {
      const text = await response.text();
      if (text.includes("não encontrado") || text.includes("indisponível") || text.length < 1000) {
        console.log(`[DJE-PDF] PDF não disponível para ${url}`);
        return null;
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Verifica se é realmente um PDF (magic bytes)
    const bytes = new Uint8Array(arrayBuffer.slice(0, 5));
    const header = String.fromCharCode(...bytes);
    
    if (!header.startsWith("%PDF")) {
      console.log(`[DJE-PDF] Resposta não é PDF válido para ${url}`);
      return null;
    }

    console.log(`[DJE-PDF] PDF baixado com sucesso: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
    return { data: arrayBuffer, size: arrayBuffer.byteLength };
  } catch (error) {
    console.error(`[DJE-PDF] Erro ao baixar ${url}:`, error);
    return null;
  }
}

async function processDownload(
  supabase: SupabaseClient,
  tribunal: string,
  dataRef: string,
  caderno: string,
  config: TribunalConfig
): Promise<{ tribunal: string; caderno: string; status: string; error?: string; storage_path?: string }> {
  
  const logPrefix = `[DJE-PDF ${tribunal}/${caderno}]`;
  
  try {
    // Verifica se já existe registro para esse tribunal/data/caderno
    const { data: existing } = await supabase
      .from("dje_pdfs_diarios")
      .select("id, status")
      .eq("tribunal", tribunal)
      .eq("data_publicacao", dataRef)
      .eq("caderno", caderno)
      .maybeSingle();

    if (existing) {
      const existingRecord = existing as { id: string; status: string };
      if (existingRecord.status === "processado" || existingRecord.status === "baixado") {
        console.log(`${logPrefix} Já processado para ${dataRef}`);
        return { tribunal, caderno, status: "ja_existe" };
      }
      
      // Se estava com erro, tenta novamente
      if (existingRecord.status !== "erro") {
        console.log(`${logPrefix} Em processamento: ${existingRecord.status}`);
        return { tribunal, caderno, status: existingRecord.status };
      }
    }

    // Cria ou atualiza registro como "baixando"
    const url = config.buildUrl(dataRef, caderno);
    
    const recordData = {
      tribunal,
      data_publicacao: dataRef,
      caderno,
      url_origem: url,
      status: "baixando",
      erro_mensagem: null,
    };

    const { data: record, error: upsertError } = await supabase
      .from("dje_pdfs_diarios")
      .upsert(recordData as never, { 
        onConflict: "tribunal,data_publicacao,caderno",
        ignoreDuplicates: false 
      })
      .select("id")
      .single();

    if (upsertError) {
      console.error(`${logPrefix} Erro ao criar registro:`, upsertError);
      return { tribunal, caderno, status: "erro", error: upsertError.message };
    }

    const recordId = (record as { id: string })?.id;

    // Baixa o PDF
    const pdfResult = await downloadPDF(url);

    if (!pdfResult) {
      // PDF não disponível (pode ser final de semana ou feriado)
      await supabase
        .from("dje_pdfs_diarios")
        .update({ 
          status: "erro", 
          erro_mensagem: "PDF não disponível ou não encontrado" 
        } as never)
        .eq("id", recordId);

      return { tribunal, caderno, status: "indisponivel", error: "PDF não encontrado" };
    }

    // Salva no Storage
    const storagePath = `${tribunal}/${dataRef}/${caderno}.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from("dje-pdfs")
      .upload(storagePath, pdfResult.data, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error(`${logPrefix} Erro ao salvar no Storage:`, uploadError);
      
      await supabase
        .from("dje_pdfs_diarios")
        .update({ 
          status: "erro", 
          erro_mensagem: `Erro no upload: ${uploadError.message}` 
        } as never)
        .eq("id", recordId);

      return { tribunal, caderno, status: "erro", error: uploadError.message };
    }

    // Atualiza registro como "baixado"
    await supabase
      .from("dje_pdfs_diarios")
      .update({
        status: "baixado",
        storage_path: storagePath,
        tamanho_bytes: pdfResult.size,
        erro_mensagem: null,
      } as never)
      .eq("id", recordId);

    console.log(`${logPrefix} ✅ PDF salvo: ${storagePath} (${(pdfResult.size / 1024 / 1024).toFixed(2)} MB)`);
    
    return { 
      tribunal, 
      caderno, 
      status: "baixado", 
      storage_path: storagePath 
    };

  } catch (error) {
    console.error(`${logPrefix} Erro:`, error);
    return { 
      tribunal, 
      caderno, 
      status: "erro", 
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
      console.error("[DJE-PDF] Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Missing environment configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const {
      tribunal,
      data_publicacao,
      caderno = "judiciario",
      tribunais_batch, // Para processar múltiplos tribunais de uma vez
    } = body;

    // Se recebeu um batch de tribunais, processa todos
    if (tribunais_batch && Array.isArray(tribunais_batch)) {
      const dataRef = data_publicacao || formatDateForDEJT(new Date());
      const results: { tribunal: string; status: string; error?: string }[] = [];

      for (const t of tribunais_batch) {
        if (!TRIBUNAIS[t]) {
          results.push({ tribunal: t, status: "erro", error: "Tribunal não suportado" });
          continue;
        }

        const config = TRIBUNAIS[t];
        for (const cad of config.cadernos) {
          const result = await processDownload(supabase, t, dataRef, cad, config);
          results.push(result);
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Processamento individual
    if (!tribunal) {
      return new Response(
        JSON.stringify({ 
          error: "Tribunal obrigatório",
          tribunais_disponiveis: Object.keys(TRIBUNAIS),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!TRIBUNAIS[tribunal]) {
      return new Response(
        JSON.stringify({ 
          error: `Tribunal ${tribunal} não suportado`,
          tribunais_disponiveis: Object.keys(TRIBUNAIS),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dataRef = data_publicacao || formatDateForDEJT(new Date());
    const config = TRIBUNAIS[tribunal];
    
    const result = await processDownload(supabase, tribunal, dataRef, caderno, config);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.status === "erro" ? 500 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("[DJE-PDF] Erro fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
