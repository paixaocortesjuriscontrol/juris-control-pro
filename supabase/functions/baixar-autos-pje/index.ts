import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BaixarAutosRequest {
  cofre_senha_id: string;
  processo_numero: string;
  processo_id?: string;
  tribunal?: string;
}

const PJE_URLS: Record<string, string> = {
  TRT1: "https://pje.trt1.jus.br",
  TRT2: "https://pje.trt2.jus.br",
  TRT3: "https://pje.trt3.jus.br",
  TRT4: "https://pje.trt4.jus.br",
  TRT5: "https://pje.trt5.jus.br",
  TRT6: "https://pje.trt6.jus.br",
  TRT7: "https://pje.trt7.jus.br",
  TRT8: "https://pje.trt8.jus.br",
  TRT9: "https://pje.trt9.jus.br",
  TRT10: "https://pje.trt10.jus.br",
  TRT11: "https://pje.trt11.jus.br",
  TRT12: "https://pje.trt12.jus.br",
  TRT13: "https://pje.trt13.jus.br",
  TRT14: "https://pje.trt14.jus.br",
  TRT15: "https://pje.trt15.jus.br",
  TRT16: "https://pje.trt16.jus.br",
  TRT17: "https://pje.trt17.jus.br",
  TRT18: "https://pje.trt18.jus.br",
  TRT19: "https://pje.trt19.jus.br",
  TRT20: "https://pje.trt20.jus.br",
  TRT21: "https://pje.trt21.jus.br",
  TRT22: "https://pje.trt22.jus.br",
  TRT23: "https://pje.trt23.jus.br",
  TRT24: "https://pje.trt24.jus.br",
  TJDFT: "https://pje.tjdft.jus.br",
};

// Detectar tribunal pelo número do processo (segmento J.OO)
function detectarTribunal(numero: string): string {
  // Formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
  const match = numero.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (!match) return "TRT10";
  const justica = match[1];
  const tribunal = match[2];
  if (justica === "5") return `TRT${parseInt(tribunal)}`;
  if (justica === "8" && tribunal === "07") return "TJDFT";
  return `TRT${parseInt(tribunal)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const browserlessApiKey = Deno.env.get("BROWSERLESS_API_KEY");

  if (!browserlessApiKey) {
    return new Response(
      JSON.stringify({ error: "BROWSERLESS_API_KEY não configurada" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get("Authorization");
  let userId: string | null = null;
  if (authHeader) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    userId = user?.id ?? null;
  }

  try {
    const body: BaixarAutosRequest = await req.json();
    const { cofre_senha_id, processo_numero, processo_id, tribunal } = body;

    if (!cofre_senha_id || !processo_numero) {
      return new Response(
        JSON.stringify({ error: "cofre_senha_id e processo_numero são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credencial
    const { data: credencial, error: credError } = await supabase
      .from("cofre_senhas")
      .select("*")
      .eq("id", cofre_senha_id)
      .single();

    if (credError || !credencial) {
      return new Response(
        JSON.stringify({ error: "Credencial não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determinar tribunal
    const tribunalKey = tribunal
      ? tribunal.toUpperCase().replace(/[^A-Z0-9]/g, "")
      : detectarTribunal(processo_numero);
    const baseUrl = PJE_URLS[tribunalKey] || PJE_URLS["TRT10"];

    console.log(`[baixar-autos-pje] Tribunal: ${tribunalKey}, Base: ${baseUrl}`);

    const numeroLimpo = processo_numero.replace(/[^0-9.-]/g, "");

    // Usar /scrape endpoint (compatível com Browserless v1/v2)
    // Consulta processual pública do PJe
    const consultaUrl = `${baseUrl}/consultaprocessual/detalhe-processo/${numeroLimpo.replace(/[^0-9]/g, "")}`;
    console.log(`[baixar-autos-pje] Consultando: ${consultaUrl}`);

    const scrapeResponse = await fetch(
      `https://chrome.browserless.io/scrape?token=${browserlessApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: consultaUrl,
          elements: [
            {
              selector: "a[href*='documento'], a[href*='download'], a[href*='binario'], .documentoLink a, .arquivo a, table.documentos a, #divDocumentos a, .lista-documentos a",
            },
            {
              selector: "title",
            },
            {
              selector: "body",
            },
          ],
          waitForSelector: { selector: "body", timeout: 15000 },
          gotoOptions: { waitUntil: "domcontentloaded", timeout: 30000 },
        }),
      }
    );

    if (!scrapeResponse.ok) {
      const errText = await scrapeResponse.text();
      console.error("[baixar-autos-pje] Scrape error:", errText.substring(0, 500));

      // Fallback: tentar /content para obter HTML bruto
      console.log("[baixar-autos-pje] Tentando fallback com /content...");
      const contentResponse = await fetch(
        `https://chrome.browserless.io/content?token=${browserlessApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: consultaUrl,
            gotoOptions: { waitUntil: "domcontentloaded", timeout: 30000 },
          }),
        }
      );

      if (!contentResponse.ok) {
        const contentErr = await contentResponse.text();
        console.error("[baixar-autos-pje] Content fallback error:", contentErr.substring(0, 500));
        throw new Error(`Erro ao acessar portal do PJe: ${scrapeResponse.status}`);
      }

      const html = await contentResponse.text();
      console.log(`[baixar-autos-pje] HTML obtido: ${html.length} bytes`);

      // Extrair documentos do HTML com regex
      const docs = extrairDocumentosDoHtml(html, baseUrl);

      return await salvarESucesso(supabase, docs, processo_id, cofre_senha_id, userId, numeroLimpo, html.length);
    }

    // Processar resultado do scrape
    const scrapeData = await scrapeResponse.json();
    console.log(`[baixar-autos-pje] Scrape OK, data keys: ${Object.keys(scrapeData).join(", ")}`);

    const docs: Array<{ nome: string; url: string; tipo: string }> = [];
    const results = scrapeData?.data || [];

    // O primeiro elemento são os links de documentos
    if (results[0]?.results?.length > 0) {
      for (const item of results[0].results) {
        const text = (item.text || "").trim();
        const href = item.attributes?.find((a: any) => a.name === "href")?.value || "";

        if (text && text.length > 1) {
          docs.push({
            nome: text.substring(0, 200),
            url: href.startsWith("http") ? href : `${baseUrl}${href}`,
            tipo: classificarTipo(text),
          });
        }
      }
    }

    // Deduplicar
    const seen = new Set<string>();
    const docsUnicos = docs.filter((d) => {
      if (seen.has(d.nome)) return false;
      seen.add(d.nome);
      return true;
    }).slice(0, 50);

    console.log(`[baixar-autos-pje] Documentos encontrados: ${docsUnicos.length}`);

    // Se nenhum doc encontrado no scrape, tentar extrair do HTML do body
    if (docsUnicos.length === 0 && results[2]?.results?.length > 0) {
      const bodyHtml = results[2].results[0]?.html || "";
      if (bodyHtml.length > 100) {
        const fallbackDocs = extrairDocumentosDoHtml(bodyHtml, baseUrl);
        docsUnicos.push(...fallbackDocs);
      }
    }

    return await salvarESucesso(supabase, docsUnicos, processo_id, cofre_senha_id, userId, numeroLimpo, 0);
  } catch (error: unknown) {
    console.error("[baixar-autos-pje] Erro geral:", error);
    const msg = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ sucesso: false, erro: msg, documentos_baixados: 0, documentos_total: 0, documentos: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function classificarTipo(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("sentença") || t.includes("sentenca")) return "sentenca";
  if (t.includes("despacho")) return "despacho";
  if (t.includes("petição") || t.includes("peticao")) return "peticao";
  if (t.includes("certidão") || t.includes("certidao")) return "certidao";
  if (t.includes("decisão") || t.includes("decisao")) return "decisao";
  if (t.includes("ata")) return "ata";
  if (t.includes("laudo") || t.includes("perícia") || t.includes("pericia")) return "laudo";
  if (t.includes("acórdão") || t.includes("acordao")) return "acordao";
  if (t.includes("contestação") || t.includes("contestacao")) return "contestacao";
  if (t.includes("recurso")) return "recurso";
  return "auto";
}

function extrairDocumentosDoHtml(html: string, baseUrl: string): Array<{ nome: string; url: string; tipo: string }> {
  const docs: Array<{ nome: string; url: string; tipo: string }> = [];
  // Regex para extrair links de documentos
  const linkRegex = /<a[^>]*href=["']([^"']*(?:documento|download|binario)[^"']*)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  const seen = new Set<string>();
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = (match[2] || "").trim();
    if (text && text.length > 1 && !seen.has(text)) {
      seen.add(text);
      docs.push({
        nome: text.substring(0, 200),
        url: href.startsWith("http") ? href : `${baseUrl}${href}`,
        tipo: classificarTipo(text),
      });
    }
  }
  return docs.slice(0, 50);
}

async function salvarESucesso(
  supabase: any,
  docs: Array<{ nome: string; url: string; tipo: string }>,
  processo_id: string | undefined,
  cofre_senha_id: string,
  userId: string | null,
  numeroLimpo: string,
  htmlSize: number
) {
  const corsH = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Content-Type": "application/json",
  };

  const docsSalvos = [];

  for (const doc of docs) {
    try {
      const { data: saved, error: saveError } = await supabase
        .from("processos_documentos_download")
        .insert({
          processo_id: processo_id || null,
          cofre_senha_id,
          nome_arquivo: doc.nome,
          tipo_documento: doc.tipo || "auto",
          storage_path: `pendente/${numeroLimpo}/${doc.nome}`,
          status_download: "encontrado",
          downloaded_by: userId,
          downloaded_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!saveError && saved) {
        docsSalvos.push({
          id: saved.id,
          nome: doc.nome,
          tipo: doc.tipo,
          url: doc.url,
          status: "encontrado",
        });
      }
    } catch (e) {
      console.error("[baixar-autos-pje] Erro ao salvar doc:", e);
    }
  }

  // Atualizar credencial
  await supabase.from("cofre_senhas").update({
    status_validacao: "acessivel",
    mensagem_erro: null,
    ultima_validacao: new Date().toISOString(),
  }).eq("id", cofre_senha_id);

  return new Response(
    JSON.stringify({
      sucesso: true,
      login_sucesso: false,
      pagina_processo: true,
      documentos_baixados: docsSalvos.length,
      documentos_total: docs.length,
      documentos: docsSalvos,
      mensagem: docs.length > 0
        ? `${docsSalvos.length} documento(s) encontrado(s) na consulta processual pública.`
        : `Consulta realizada. Nenhum documento encontrado na consulta pública. O processo pode requerer login autenticado.`,
    }),
    { headers: corsH }
  );
}
