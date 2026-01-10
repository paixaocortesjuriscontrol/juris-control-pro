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

    // Verificar se temos o secret do Browserless configurado (pode ser BROWSERLESS_API_KEY ou BROWSERLESS_TOKEN)
    const browserlessToken = Deno.env.get("BROWSERLESS_API_KEY") || Deno.env.get("BROWSERLESS_TOKEN");

    if (!browserlessToken) {
      console.log("BROWSERLESS_API_KEY não configurado - retornando instrução");
      
      return new Response(
        JSON.stringify({
          found: false,
          error: "Integração com e-Processo requer configuração do Browserless. Por favor, adicione o BROWSERLESS_API_KEY nas configurações.",
          message: "O portal e-Processo do MTE não possui API pública. A consulta automática requer automação de navegador.",
          url: eprocessoUrl,
          numeroProcesso: numeroLimpo,
        } as EProcessoResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tentar buscar via Browserless (scraping com interação)
    try {
      console.log("Iniciando automação via Browserless...");
      
      // Usar a API /function do Browserless para executar código personalizado
      const browserlessUrl = `https://chrome.browserless.io/function?token=${browserlessToken}`;
      
      const browserlessResponse = await fetch(browserlessUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: `
            module.exports = async ({ page }) => {
              const numeroProcesso = "${numeroLimpo}";
              
              try {
                // Navegar para a página do e-Processo
                await page.goto("https://eprocesso.sit.trabalho.gov.br/ProcessoEletronico/AndamentoProcessual", {
                  waitUntil: "networkidle0",
                  timeout: 30000
                });
                
                // Aguardar o campo de número do processo
                await page.waitForSelector("#NumeroProcesso, input[name='NumeroProcesso'], input[type='text']", { timeout: 10000 });
                
                // Preencher o número do processo
                const inputSelector = "#NumeroProcesso, input[name='NumeroProcesso']";
                await page.type(inputSelector, numeroProcesso);
                
                // Clicar no botão de pesquisa
                const btnSelector = "button[type='submit'], input[type='submit'], .btn-pesquisar, #btnPesquisar";
                await page.click(btnSelector);
                
                // Aguardar resultado
                await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
                await page.waitForTimeout(2000);
                
                // Extrair dados da página
                const dados = await page.evaluate(() => {
                  const getText = (selector) => {
                    const el = document.querySelector(selector);
                    return el ? el.textContent.trim() : null;
                  };
                  
                  const getTexts = (selector) => {
                    return Array.from(document.querySelectorAll(selector)).map(el => el.textContent.trim());
                  };
                  
                  // Tentar extrair informações comuns
                  const situacao = getText(".situacao, .status, #situacao") || getText("td:contains('Situação') + td");
                  const orgao = getText(".orgao, .unidade, #orgao") || getText("td:contains('Órgão') + td");
                  const assunto = getText(".assunto, #assunto") || getText("td:contains('Assunto') + td");
                  const dataAutuacao = getText(".data-autuacao, #dataAutuacao") || getText("td:contains('Data') + td");
                  
                  // Verificar se encontrou o processo
                  const pageText = document.body.innerText.toLowerCase();
                  const naoEncontrado = pageText.includes("não encontrado") || pageText.includes("nenhum resultado");
                  
                  // Extrair andamentos se disponíveis
                  const andamentos = [];
                  const linhasAndamento = document.querySelectorAll("table.andamentos tr, .andamento-item, .movimento");
                  linhasAndamento.forEach(linha => {
                    const data = linha.querySelector(".data, td:first-child")?.textContent?.trim();
                    const descricao = linha.querySelector(".descricao, td:nth-child(2)")?.textContent?.trim();
                    if (data && descricao) {
                      andamentos.push({ data, descricao });
                    }
                  });
                  
                  return {
                    encontrado: !naoEncontrado && (situacao || orgao || assunto || andamentos.length > 0),
                    situacao,
                    orgao,
                    assunto,
                    dataAutuacao,
                    andamentos,
                    htmlDebug: document.body.innerHTML.substring(0, 500)
                  };
                });
                
                return { success: true, dados };
              } catch (error) {
                return { success: false, error: error.message };
              }
            };
          `,
          context: {},
        }),
      });

      if (!browserlessResponse.ok) {
        const errorText = await browserlessResponse.text();
        console.error("Erro no Browserless:", browserlessResponse.status, errorText);
        
        return new Response(
          JSON.stringify({
            found: false,
            error: `Erro na automação do navegador: ${browserlessResponse.status}`,
            message: "Não foi possível acessar o portal e-Processo. Tente novamente mais tarde.",
            url: eprocessoUrl,
            numeroProcesso: numeroLimpo,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await browserlessResponse.json();
      console.log("Resultado Browserless:", JSON.stringify(result).substring(0, 500));

      if (result?.success && result?.dados?.encontrado) {
        const dados = result.dados;
        
        return new Response(
          JSON.stringify({
            found: true,
            processo: {
              numero: numeroLimpo,
              situacao: dados.situacao,
              orgaoOrigem: dados.orgao,
              dataAutuacao: dados.dataAutuacao,
              assunto: dados.assunto,
              andamentos: dados.andamentos || [],
            },
          } as EProcessoResponse),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Processo não encontrado ou erro na extração
        return new Response(
          JSON.stringify({
            found: false,
            error: result?.error || "Processo não encontrado no e-Processo",
            message: "Verifique se o número do processo administrativo está correto.",
            url: eprocessoUrl,
            numeroProcesso: numeroLimpo,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    } catch (browserlessError) {
      console.error("Erro na automação Browserless:", browserlessError);
      return new Response(
        JSON.stringify({
          found: false,
          error: `Erro na automação: ${browserlessError instanceof Error ? browserlessError.message : "Erro desconhecido"}`,
          message: "Ocorreu um erro ao consultar o portal e-Processo. Tente novamente.",
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
