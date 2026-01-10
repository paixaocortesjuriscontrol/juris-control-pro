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

// Função para extrair dados do HTML do e-Processo
function parseEProcessoHtml(html: string, numeroProcesso: string): EProcessoResponse["processo"] | null {
  try {
    // Verificar se encontrou o processo
    if (html.includes("Processo não encontrado") || html.includes("Nenhum resultado")) {
      return null;
    }

    const processo: EProcessoResponse["processo"] = {
      numero: numeroProcesso,
      andamentos: [],
    };

    // Extrair situação/status
    const situacaoMatch = html.match(/Situa[çc][ãa]o[:\s]*<[^>]*>([^<]+)/i) ||
                          html.match(/Status[:\s]*<[^>]*>([^<]+)/i);
    if (situacaoMatch) {
      processo.situacao = situacaoMatch[1].trim();
    }

    // Extrair órgão de origem
    const orgaoMatch = html.match(/[ÓO]rg[ãa]o[:\s]*<[^>]*>([^<]+)/i) ||
                       html.match(/Unidade[:\s]*<[^>]*>([^<]+)/i);
    if (orgaoMatch) {
      processo.orgaoOrigem = orgaoMatch[1].trim();
    }

    // Extrair data de autuação
    const dataMatch = html.match(/Data\s*(de\s*)?Autua[çc][ãa]o[:\s]*<[^>]*>([^<]+)/i) ||
                      html.match(/Autua[çc][ãa]o[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (dataMatch) {
      processo.dataAutuacao = (dataMatch[2] || dataMatch[1]).trim();
    }

    // Extrair assunto
    const assuntoMatch = html.match(/Assunto[:\s]*<[^>]*>([^<]+)/i);
    if (assuntoMatch) {
      processo.assunto = assuntoMatch[1].trim();
    }

    // Extrair interessados
    const interessadosMatch = html.match(/Interessado[s]?[:\s]*<[^>]*>([^<]+)/gi);
    if (interessadosMatch) {
      processo.interessados = interessadosMatch.map(m => {
        const match = m.match(/>([^<]+)$/);
        return match ? match[1].trim() : "";
      }).filter(Boolean);
    }

    // Extrair andamentos da tabela
    const andamentosRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>(\d{2}\/\d{2}\/\d{4})<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?(?:<td[^>]*>([^<]*)<\/td>)?[\s\S]*?<\/tr>/gi;
    let andamentoMatch;
    while ((andamentoMatch = andamentosRegex.exec(html)) !== null) {
      processo.andamentos?.push({
        data: andamentoMatch[1],
        descricao: andamentoMatch[2].trim(),
        unidade: andamentoMatch[3]?.trim(),
      });
    }

    return processo;
  } catch (error) {
    console.error("Erro ao parsear HTML:", error);
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

    // Limpar número do processo - manter pontos e barras para formato administrativo
    const numeroOriginal = numeroProcesso.trim();
    const numeroLimpo = numeroProcesso.replace(/\D/g, "");

    if (numeroLimpo.length < 8) {
      return new Response(
        JSON.stringify({ found: false, error: "Número do processo inválido - mínimo 8 dígitos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Buscando processo administrativo: ${numeroOriginal} (limpo: ${numeroLimpo})`);

    // URL do e-Processo para consulta
    const eprocessoUrl = `https://eprocesso.sit.trabalho.gov.br/ProcessoEletronico/AndamentoProcessual`;
    const consultaUrl = `${eprocessoUrl}?NumeroPAT=${encodeURIComponent(numeroOriginal)}`;

    // Verificar se temos o Firecrawl configurado (preferencial)
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (firecrawlApiKey) {
      console.log("Usando Firecrawl para scraping...");
      
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
            waitFor: 3000, // Aguardar carregamento dinâmico
          }),
        });

        if (!firecrawlResponse.ok) {
          const errorData = await firecrawlResponse.text();
          console.error("Erro Firecrawl:", firecrawlResponse.status, errorData);
          
          // Se Firecrawl falhar, retornar mensagem informativa
          return new Response(
            JSON.stringify({
              found: false,
              error: `Erro ao acessar e-Processo (${firecrawlResponse.status})`,
              message: "O portal pode estar com verificação anti-bot ativa. Tente acessar diretamente.",
              url: consultaUrl,
              numeroProcesso: numeroOriginal,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const firecrawlData = await firecrawlResponse.json();
        console.log("Firecrawl sucesso, dados recebidos");

        // Verificar se obtivemos conteúdo
        const htmlContent = firecrawlData.data?.html || firecrawlData.html || "";
        const markdownContent = firecrawlData.data?.markdown || firecrawlData.markdown || "";

        if (!htmlContent && !markdownContent) {
          return new Response(
            JSON.stringify({
              found: false,
              error: "Página carregada mas sem conteúdo",
              message: "O portal pode estar exigindo verificação humana. Acesse diretamente.",
              url: consultaUrl,
              numeroProcesso: numeroOriginal,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verificar se há verificação CAPTCHA ou anti-bot
        if (htmlContent.includes("captcha") || 
            htmlContent.includes("robot") || 
            htmlContent.includes("verificação") ||
            htmlContent.includes("challenge")) {
          return new Response(
            JSON.stringify({
              found: false,
              error: "Portal exige verificação humana",
              message: "O e-Processo está solicitando verificação anti-bot. Acesse o portal diretamente.",
              url: consultaUrl,
              numeroProcesso: numeroOriginal,
              requiresHumanVerification: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Tentar parsear os dados do processo
        const processo = parseEProcessoHtml(htmlContent, numeroOriginal);

        if (processo) {
          console.log("Processo encontrado:", processo.numero);
          return new Response(
            JSON.stringify({
              found: true,
              processo,
              message: "Processo encontrado com sucesso",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Processo não encontrado no HTML
        // Verificar se a página carregou corretamente
        if (htmlContent.includes("e-Processo") || htmlContent.includes("Andamento")) {
          return new Response(
            JSON.stringify({
              found: false,
              error: "Processo não encontrado",
              message: `O processo ${numeroOriginal} não foi encontrado no e-Processo. Verifique o número e tente novamente.`,
              url: consultaUrl,
              numeroProcesso: numeroOriginal,
              portalAcessivel: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Página não carregou como esperado
        return new Response(
          JSON.stringify({
            found: false,
            error: "Resposta inesperada do portal",
            message: "O portal retornou uma página diferente do esperado. Tente acessar diretamente.",
            url: consultaUrl,
            numeroProcesso: numeroOriginal,
            debug: markdownContent.substring(0, 500),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (firecrawlError) {
        console.error("Erro na chamada Firecrawl:", firecrawlError);
        return new Response(
          JSON.stringify({
            found: false,
            error: `Erro ao consultar: ${firecrawlError instanceof Error ? firecrawlError.message : "Erro desconhecido"}`,
            message: "Ocorreu um erro ao acessar o portal. Tente novamente.",
            url: consultaUrl,
            numeroProcesso: numeroOriginal,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback: sem Firecrawl configurado
    console.log("FIRECRAWL_API_KEY não configurado");
    return new Response(
      JSON.stringify({
        found: false,
        error: "Integração com e-Processo não configurada",
        message: "O conector Firecrawl precisa estar habilitado para consultas automáticas ao e-Processo.",
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
