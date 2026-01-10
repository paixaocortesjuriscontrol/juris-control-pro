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
    dataAuutacao?: string;
    interessados?: string[];
    assunto?: string;
    andamentos?: Array<{
      data: string;
      descricao: string;
      unidade?: string;
    }>;
  };
  error?: string;
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

    // Limpar número do processo (remover caracteres especiais)
    const numeroLimpo = numeroProcesso.replace(/\D/g, "");

    if (numeroLimpo.length < 10) {
      return new Response(
        JSON.stringify({ found: false, error: "Número do processo inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Buscando processo administrativo: ${numeroProcesso} (limpo: ${numeroLimpo})`);

    // URL do e-Processo para consulta
    const eprocessoUrl = `https://eprocesso.sit.trabalho.gov.br/ProcessoEletronico/AndamentoProcessual`;

    // Nota: O e-Processo do MTE não possui API pública disponível
    // A integração completa requer automação com Browserless ou similar
    // Por enquanto, retornamos estrutura para integração futura

    // Verificar se temos o secret do Browserless configurado
    const browserlessToken = Deno.env.get("BROWSERLESS_TOKEN");

    if (!browserlessToken) {
      console.log("BROWSERLESS_TOKEN não configurado - retornando mock para desenvolvimento");
      
      return new Response(
        JSON.stringify({
          found: false,
          error: "Integração com e-Processo requer configuração do Browserless. Por favor, adicione o BROWSERLESS_TOKEN nas configurações.",
          message: "O portal e-Processo do MTE não possui API pública. A consulta automática requer automação de navegador.",
          url: eprocessoUrl,
          numeroProcesso: numeroLimpo,
        } as EProcessoResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tentar buscar via Browserless (scraping)
    try {
      const scrapeUrl = `https://chrome.browserless.io/scrape?token=${browserlessToken}`;
      
      const scrapeResponse = await fetch(scrapeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: eprocessoUrl,
          elements: [
            { selector: "#numeroProcesso", timeout: 5000 }
          ],
          gotoOptions: {
            waitUntil: "networkidle0",
            timeout: 30000
          }
        }),
      });

      if (!scrapeResponse.ok) {
        const errorText = await scrapeResponse.text();
        console.error("Erro no Browserless:", errorText);
        throw new Error(`Browserless error: ${scrapeResponse.status}`);
      }

      // O e-Processo requer interação (formulário)
      // Uma implementação completa precisaria:
      // 1. Acessar a página
      // 2. Preencher o campo de número do processo
      // 3. Clicar em buscar
      // 4. Aguardar resultado
      // 5. Extrair dados

      // Por enquanto, informar que a automação está em desenvolvimento
      return new Response(
        JSON.stringify({
          found: false,
          error: "Automação do e-Processo em desenvolvimento",
          message: "O portal e-Processo requer interação com formulário. Funcionalidade será implementada em breve.",
          url: eprocessoUrl,
          numeroProcesso: numeroLimpo,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (browserlessError) {
      console.error("Erro na automação Browserless:", browserlessError);
      return new Response(
        JSON.stringify({
          found: false,
          error: `Erro na automação: ${browserlessError instanceof Error ? browserlessError.message : "Erro desconhecido"}`,
          url: eprocessoUrl,
          numeroProcesso: numeroLimpo,
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
