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

    // Verificar se temos o secret do Browserless configurado
    const browserlessToken = Deno.env.get("BROWSERLESS_API_KEY") || Deno.env.get("BROWSERLESS_TOKEN");

    if (!browserlessToken) {
      console.log("BROWSERLESS_API_KEY não configurado");
      
      return new Response(
        JSON.stringify({
          found: false,
          error: "Integração com e-Processo requer configuração do BROWSERLESS_API_KEY.",
          message: "O portal e-Processo do MTE não possui API pública. A consulta automática requer automação de navegador.",
          url: eprocessoUrl,
          numeroProcesso: numeroOriginal,
        } as EProcessoResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tentar buscar via Browserless usando a API /scrape
    try {
      console.log("Iniciando scraping via Browserless...");
      
      // Primeiro, acessar a página de consulta
      const browserlessUrl = `https://chrome.browserless.io/scrape?token=${browserlessToken}`;
      
      // Step 1: Carregar a página principal e identificar o formulário
      const initialResponse = await fetch(browserlessUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: eprocessoUrl,
          waitFor: 3000,
          elements: [
            { selector: "body" },
            { selector: "input[type='text'], input[name*='processo'], input[name*='numero'], #NumeroProcesso" },
            { selector: "form" },
          ],
          gotoOptions: {
            waitUntil: "networkidle2",
            timeout: 30000
          }
        }),
      });

      if (!initialResponse.ok) {
        const errorText = await initialResponse.text();
        console.error("Erro no Browserless (scrape inicial):", initialResponse.status, errorText);
        
        // Retornar informação útil para o usuário
        return new Response(
          JSON.stringify({
            found: false,
            error: `O portal e-Processo está temporariamente indisponível (${initialResponse.status}).`,
            message: "Tente novamente em alguns minutos ou consulte diretamente no portal.",
            url: eprocessoUrl,
            numeroProcesso: numeroOriginal,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const initialResult = await initialResponse.json();
      console.log("Página inicial carregada, elementos encontrados:", initialResult?.data?.length || 0);

      // Nota: O e-Processo requer interação JavaScript complexa
      // A API /scrape do Browserless é limitada para formulários interativos
      // Para uma automação completa, seria necessário usar /content com Puppeteer script

      // Por enquanto, retornamos informação sobre como consultar manualmente
      // mas indicamos que a estrutura está preparada para automação futura
      
      // Tentar usar a API /content para execução de script
      const contentUrl = `https://chrome.browserless.io/content?token=${browserlessToken}`;
      
      const contentResponse = await fetch(contentUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: eprocessoUrl,
          waitFor: 5000,
          gotoOptions: {
            waitUntil: "networkidle2",
            timeout: 30000
          }
        }),
      });

      if (contentResponse.ok) {
        const htmlContent = await contentResponse.text();
        console.log("HTML obtido, tamanho:", htmlContent.length);
        
        // Verificar se a página carregou corretamente
        const pageLoaded = htmlContent.includes("Andamento") || htmlContent.includes("Processo") || htmlContent.includes("e-Processo");
        
        if (pageLoaded) {
          // Página carregou - informar que automação está em desenvolvimento
          return new Response(
            JSON.stringify({
              found: false,
              error: "Automação do e-Processo em desenvolvimento",
              message: `O portal e-Processo foi acessado com sucesso. A automação completa do formulário de busca está sendo implementada. Por enquanto, acesse o portal diretamente: ${eprocessoUrl}`,
              url: eprocessoUrl,
              numeroProcesso: numeroOriginal,
              portalAcessivel: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Fallback - portal pode estar com problemas
      return new Response(
        JSON.stringify({
          found: false,
          error: "Não foi possível acessar o portal e-Processo",
          message: "O portal pode estar temporariamente indisponível. Tente acessar diretamente.",
          url: eprocessoUrl,
          numeroProcesso: numeroOriginal,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (browserlessError) {
      console.error("Erro na automação Browserless:", browserlessError);
      return new Response(
        JSON.stringify({
          found: false,
          error: `Erro na automação: ${browserlessError instanceof Error ? browserlessError.message : "Erro desconhecido"}`,
          message: "Ocorreu um erro ao consultar o portal e-Processo. Tente novamente.",
          url: eprocessoUrl,
          numeroProcesso: numeroOriginal,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
