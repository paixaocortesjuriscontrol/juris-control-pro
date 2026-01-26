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
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT1&data=${encodeURIComponent(data)}&caderno=${encodeURIComponent(caderno)}`,
    cadernos: ["judiciario", "administrativo"],
  },
  TRT2: {
    nome: "TRT2 - São Paulo",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT2&data=${encodeURIComponent(data)}&caderno=${encodeURIComponent(caderno)}`,
    cadernos: ["judiciario", "administrativo"],
  },
  TRT10: {
    nome: "TRT10 - Brasília/Tocantins",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT10&data=${encodeURIComponent(data)}&caderno=${encodeURIComponent(caderno)}`,
    cadernos: ["judiciario", "administrativo"],
  },
  TRT23: {
    nome: "TRT23 - Mato Grosso",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT23&data=${encodeURIComponent(data)}&caderno=${encodeURIComponent(caderno)}`,
    cadernos: ["judiciario", "administrativo"],
  },
  TRT24: {
    nome: "TRT24 - Mato Grosso do Sul",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRT24&data=${encodeURIComponent(data)}&caderno=${encodeURIComponent(caderno)}`,
    cadernos: ["judiciario", "administrativo"],
  },
  TST: {
    nome: "TST - Tribunal Superior do Trabalho",
    buildUrl: (data, caderno = "judiciario") =>
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TST&data=${encodeURIComponent(data)}&caderno=${encodeURIComponent(caderno)}`,
    cadernos: ["judiciario", "administrativo"],
  },
};

// Obtém data atual no Brasil (UTC-3)
function getDataBrasil(): Date {
  const now = new Date();
  // Ajusta para UTC-3 (horário de Brasília)
  const brasilOffset = -3 * 60; // -3 horas em minutos
  const utcOffset = now.getTimezoneOffset(); // offset local em minutos
  const brasilTime = new Date(now.getTime() + (utcOffset + brasilOffset) * 60 * 1000);
  return brasilTime;
}

// Persistência no banco (YYYY-MM-DD) - sempre no horário do Brasil
function formatDateISO(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// DEJT (dd/MM/yyyy)
function formatDateForDEJT(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function isoToDejtDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

function dejtToIsoDate(dmy: string): string | null {
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}

function normalizeDataPublicacao(raw?: unknown): { iso: string; dejt: string } {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return { iso: trimmed, dejt: isoToDejtDate(trimmed) };
    }
    const isoFromDejt = dejtToIsoDate(trimmed);
    if (isoFromDejt) {
      return { iso: isoFromDejt, dejt: trimmed };
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const iso = formatDateISO(parsed);
      return { iso, dejt: isoToDejtDate(iso) };
    }
  }
  // Usa data atual do Brasil como fallback
  const dataBrasil = getDataBrasil();
  const iso = formatDateISO(dataBrasil);
  return { iso, dejt: isoToDejtDate(iso) };
}

// Fallback: PDFs do DEJT migraram para diario.jt.jus.br (estrutura por pasta YYYY/MM/DD)
function buildDiarioJtUrls(tribunal: string, dataIso: string, caderno: string): string[] {
  const m = dataIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return [];

  const [, y, mo, d] = m;
  const base = `https://diario.jt.jus.br/cadernos/${y}/${mo}/${d}`;
  const cadCode = (caderno || "judiciario").toLowerCase() === "administrativo" ? "A" : "J";

  // Tentativas comuns de nome (podem variar por período)
  return [
    `${base}/${tribunal}_${cadCode}.pdf`,
    `${base}/${tribunal}_${cadCode.toLowerCase()}.pdf`,
    `${base}/${tribunal}${cadCode}.pdf`,
    `${base}/${tribunal}${cadCode.toLowerCase()}.pdf`,
    `${base}/${tribunal}_${caderno}.pdf`,
    `${base}/${tribunal}_${String(caderno).toLowerCase()}.pdf`,
  ];
}

// Baixa PDF de um tribunal específico
async function downloadPDF(url: string): Promise<{ data: ArrayBuffer; size: number } | null> {
  try {
    console.log(`[DJE-PDF] Baixando: ${url}`);

    let referer = undefined as string | undefined;
    try {
      const u = new URL(url);
      referer = `${u.origin}/`;
    } catch {
      // ignore
    }
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/pdf,*/*",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        ...(referer ? { Referer: referer } : {}),
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
  dataRefIso: string,
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
      .eq("data_publicacao", dataRefIso)
      .eq("caderno", caderno)
      .maybeSingle();

    if (existing) {
      const existingRecord = existing as { id: string; status: string };
      if (existingRecord.status === "processado" || existingRecord.status === "baixado") {
        console.log(`${logPrefix} Já processado para ${dataRefIso}`);
        return { tribunal, caderno, status: "ja_existe" };
      }
      
      // Se estava com erro, tenta novamente
      if (existingRecord.status !== "erro") {
        console.log(`${logPrefix} Em processamento: ${existingRecord.status}`);
        return { tribunal, caderno, status: existingRecord.status };
      }
    }

    // Cria ou atualiza registro como "baixando"
    const url = config.buildUrl(isoToDejtDate(dataRefIso), caderno);
    const candidateUrls = [url, ...buildDiarioJtUrls(tribunal, dataRefIso, caderno)];
    
    const recordData = {
      tribunal,
      data_publicacao: dataRefIso,
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
    let pdfResult: { data: ArrayBuffer; size: number } | null = null;
    let usedUrl = url;

    for (const candidate of candidateUrls) {
      const res = await downloadPDF(candidate);
      if (res) {
        pdfResult = res;
        usedUrl = candidate;
        break;
      }
    }

    if (!pdfResult) {
      // PDF não disponível (pode ser final de semana ou feriado)
      await supabase
        .from("dje_pdfs_diarios")
        .update({ 
          status: "erro", 
          erro_mensagem: `PDF não disponível ou não encontrado. URLs tentadas: ${candidateUrls.slice(0, 3).join(" | ")}`
        } as never)
        .eq("id", recordId);

      return { tribunal, caderno, status: "indisponivel", error: "PDF não encontrado" };
    }

    // Salva no Storage
    const storagePath = `${tribunal}/${dataRefIso}/${caderno}.pdf`;
    
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
        url_origem: usedUrl,
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
    const body = await req.json().catch(() => ({} as any));

    const tribunal = body?.tribunal as string | undefined;
    const data_publicacao = body?.data_publicacao as string | undefined;
    const tribunais_batch = body?.tribunais_batch as string[] | undefined; // Para processar múltiplos tribunais de uma vez
    const cadernos_batch = body?.cadernos_batch as string[] | undefined;
    const hasCadernoInBody = Object.prototype.hasOwnProperty.call(body, "caderno");
    const cadernoFromBody = body?.caderno as string | undefined;
    const cadernoDefault = typeof cadernoFromBody === "string" && cadernoFromBody.trim() ? cadernoFromBody.trim() : "judiciario";

    const { iso: dataRefIso } = normalizeDataPublicacao(data_publicacao);

    // Se recebeu um batch de tribunais, processa todos
    if (tribunais_batch && Array.isArray(tribunais_batch)) {
      // Importante: no banco, sempre ISO (YYYY-MM-DD)
      const dataRef = dataRefIso;
      const results: { tribunal: string; status: string; error?: string }[] = [];

      for (const t of tribunais_batch) {
        if (!TRIBUNAIS[t]) {
          results.push({ tribunal: t, status: "erro", error: "Tribunal não suportado" });
          continue;
        }

        const config = TRIBUNAIS[t];

        // Por padrão (sem caderno/cadernos_batch), mantém o comportamento antigo: baixa todos os cadernos suportados.
        // Se o request enviar caderno explícito ou cadernos_batch, baixa somente o(s) solicitado(s).
        const cadernosToProcess = Array.isArray(cadernos_batch)
          ? cadernos_batch
          : hasCadernoInBody
            ? [cadernoDefault]
            : config.cadernos;

        for (const cad of cadernosToProcess) {
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

    const dataRef = dataRefIso;
    const config = TRIBUNAIS[tribunal];

    const result = await processDownload(supabase, tribunal, dataRef, cadernoDefault, config);

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
