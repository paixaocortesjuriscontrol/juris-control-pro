const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EProcessoResponse {
  found: boolean;
  processo?: {
    numero: string;
    situacao?: string;
    orgaoOrigem?: string;
    dataAutuacao?: string;
    interessados?: string[];
    assunto?: string;
    andamentos?: Array<{
      data: string;
      descricao: string;
      unidade?: string;
    }>;
  };
  error?: string;
  message?: string;
}

// Função para extrair dados do Markdown/HTML do e-Processo
function parseEProcessoContent(markdown: string, html: string, numeroProcesso: string): EProcessoResponse["processo"] | null {
  try {
    // Verificar se encontrou o processo
    if (markdown.includes("Processo não encontrado") || 
        markdown.includes("Nenhum resultado") ||
        html.includes("Processo não encontrado")) {
      console.log("Processo não encontrado na página");
      return null;
    }

    const processo: EProcessoResponse["processo"] = {
      numero: numeroProcesso,
      andamentos: [],
    };

    console.log("Parseando conteúdo, markdown length:", markdown.length, "html length:", html.length);

    // Tentar extrair do Markdown primeiro (mais limpo)
    const lines = markdown.split("\n").map(l => l.trim()).filter(Boolean);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1] || "";
      
      // Situação/Status
      if (/situa[çc][ãa]o|status/i.test(line) && !processo.situacao) {
        const value = nextLine || line.replace(/.*[:]\s*/, "").trim();
        if (value && !/situa[çc][ãa]o|status/i.test(value)) {
          processo.situacao = value;
          console.log("Situação encontrada:", processo.situacao);
        }
      }
      
      // Órgão de origem/Unidade
      if (/[óo]rg[ãa]o|unidade/i.test(line) && !processo.orgaoOrigem) {
        const value = nextLine || line.replace(/.*[:]\s*/, "").trim();
        if (value && !/[óo]rg[ãa]o|unidade/i.test(value)) {
          processo.orgaoOrigem = value;
          console.log("Órgão encontrado:", processo.orgaoOrigem);
        }
      }
      
      // Data de autuação
      if (/autua[çc][ãa]o|data.*autua/i.test(line) && !processo.dataAutuacao) {
        const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) {
          processo.dataAutuacao = dateMatch[1];
          console.log("Data autuação encontrada:", processo.dataAutuacao);
        }
      }
      
      // Assunto
      if (/assunto/i.test(line) && !processo.assunto) {
        const value = nextLine || line.replace(/.*[:]\s*/, "").trim();
        if (value && !/assunto/i.test(value)) {
          processo.assunto = value;
          console.log("Assunto encontrado:", processo.assunto);
        }
      }
      
      // Interessados
      if (/interessado/i.test(line)) {
        const value = nextLine || line.replace(/.*[:]\s*/, "").trim();
        if (value && !/interessado/i.test(value)) {
          processo.interessados = processo.interessados || [];
          processo.interessados.push(value);
          console.log("Interessado encontrado:", value);
        }
      }
    }

    // Fallback para regex no HTML se não encontrou no markdown
    if (!processo.situacao) {
      const situacaoMatch = html.match(/Situa[çc][ãa]o[:\s]*<[^>]*>([^<]+)/i) ||
                            html.match(/Status[:\s]*<[^>]*>([^<]+)/i);
      if (situacaoMatch) {
        processo.situacao = situacaoMatch[1].trim();
        console.log("Situação via HTML:", processo.situacao);
      }
    }

    if (!processo.orgaoOrigem) {
      const orgaoMatch = html.match(/[ÓO]rg[ãa]o[:\s]*<[^>]*>([^<]+)/i) ||
                         html.match(/Unidade[:\s]*<[^>]*>([^<]+)/i);
      if (orgaoMatch) {
        processo.orgaoOrigem = orgaoMatch[1].trim();
        console.log("Órgão via HTML:", processo.orgaoOrigem);
      }
    }

    if (!processo.dataAutuacao) {
      const dataMatch = html.match(/Autua[çc][ãa]o[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
      if (dataMatch) {
        processo.dataAutuacao = dataMatch[1];
        console.log("Data autuação via HTML:", processo.dataAutuacao);
      }
    }

    const hasAnyDetail = Boolean(
      processo.situacao ||
      processo.orgaoOrigem ||
      processo.dataAutuacao ||
      processo.assunto ||
      (processo.interessados && processo.interessados.length > 0)
    );

    console.log("Processo parseado:", JSON.stringify(processo));

    // Se não conseguimos extrair nenhum campo útil, retornamos null
    if (!hasAnyDetail) {
      console.log("Nenhum dado estruturado extraído");
      return null;
    }

    return processo;
  } catch (error) {
    console.error("Erro ao parsear conteúdo:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numeroProcesso } = await req.json();

    if (!numeroProcesso) {
      return new Response(
        JSON.stringify({ found: false, error: "Número do processo é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numeroOriginal = numeroProcesso.trim();
    const numeroLimpo = numeroProcesso.replace(/\D/g, "");

    if (numeroLimpo.length < 8) {
      return new Response(
        JSON.stringify({ found: false, error: "Número do processo inválido - mínimo 8 dígitos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Buscando processo administrativo: ${numeroOriginal}`);

    const eprocessoUrl = `https://eprocesso.sit.trabalho.gov.br/ProcessoEletronico/AndamentoProcessual`;
    const consultaUrl = `${eprocessoUrl}?NumeroPAT=${encodeURIComponent(numeroOriginal)}`;

    // ========== 1. Tentar Jina Reader primeiro ==========
    const jinaApiKey = Deno.env.get("JINA_API_KEY");
    
    if (jinaApiKey) {
      console.log("Tentando com Jina Reader...");
      
      try {
        const jinaResponse = await fetch(`https://r.jina.ai/${consultaUrl}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${jinaApiKey}`,
            "X-Return-Format": "markdown",
          },
        });

        if (jinaResponse.ok) {
          const jinaMarkdown = await jinaResponse.text();
          console.log("Jina retornou conteúdo, tamanho:", jinaMarkdown.length);
          console.log("Jina preview:", jinaMarkdown.substring(0, 800));
          
          const processo = parseEProcessoContent(jinaMarkdown, "", numeroOriginal);
          
          if (processo) {
            console.log("Jina: Processo encontrado com dados");
            return new Response(
              JSON.stringify({
                found: true,
                processo,
                message: "Processo encontrado com sucesso",
                url: consultaUrl,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.log("Jina: Página carregou mas sem dados estruturados extraíveis");
          }
        } else {
          console.log("Jina falhou com status:", jinaResponse.status);
        }
      } catch (jinaError) {
        console.error("Erro Jina:", jinaError);
      }
    }

    // ========== 2. Fallback para Firecrawl ==========
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (firecrawlApiKey) {
      console.log("Tentando com Firecrawl...");
      
      try {
        const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: consultaUrl,
            formats: ["markdown", "html"],
            onlyMainContent: false,
            waitFor: 5000,
          }),
        });

        if (firecrawlResponse.ok) {
          const firecrawlData = await firecrawlResponse.json();
          console.log("Firecrawl sucesso");

          const htmlContent = firecrawlData.data?.html || firecrawlData.html || "";
          const markdownContent = firecrawlData.data?.markdown || firecrawlData.markdown || "";
          
          console.log("Firecrawl markdown preview:", markdownContent.substring(0, 800));

          if (markdownContent || htmlContent) {
            const processo = parseEProcessoContent(markdownContent, htmlContent, numeroOriginal);
            
            if (processo) {
              console.log("Firecrawl: Processo encontrado");
              return new Response(
                JSON.stringify({
                  found: true,
                  processo,
                  message: "Processo encontrado com sucesso",
                  url: consultaUrl,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } else {
          console.log("Firecrawl falhou com status:", firecrawlResponse.status);
        }
      } catch (firecrawlError) {
        console.error("Erro Firecrawl:", firecrawlError);
      }
    }

    // ========== 3. Nenhum serviço conseguiu ==========
    if (!jinaApiKey && !firecrawlApiKey) {
      return new Response(
        JSON.stringify({
          found: false,
          error: "Integração com e-Processo não configurada",
          message: "Configure JINA_API_KEY ou FIRECRAWL_API_KEY para consultas automáticas.",
          url: consultaUrl,
          numeroProcesso: numeroOriginal,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Serviços configurados mas não extraíram dados
    return new Response(
      JSON.stringify({
        found: false,
        error: "Não foi possível extrair dados do e-Processo",
        message: "O portal pode ter proteção anti-bot ou conteúdo dinâmico. Acesse o link diretamente para consultar.",
        url: consultaUrl,
        numeroProcesso: numeroOriginal,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na busca e-Processo:", error);
    return new Response(
      JSON.stringify({
        found: false,
        error: error instanceof Error ? error.message : "Erro ao buscar processo",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
