import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CapturaRequest {
  cofre_senha_id: string;
  processo_numero?: string;
  capturar_intimacoes?: boolean;
  capturar_processos?: boolean;
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

  try {
    const { cofre_senha_id, processo_numero, capturar_intimacoes = true, capturar_processos = true }: CapturaRequest = await req.json();

    if (!cofre_senha_id) {
      return new Response(
        JSON.stringify({ error: "cofre_senha_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credencial do cofre
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

    // Log início
    await logCaptura(supabase, cofre_senha_id, null, "info", `Iniciando captura para ${credencial.sistema} - ${credencial.tribunal}`);

    // Determinar qual scraper usar baseado no sistema
    let resultado;
    switch (credencial.sistema.toLowerCase()) {
      case "pje":
        resultado = await capturarPje(browserlessApiKey, credencial, processo_numero, supabase);
        break;
      case "esaj":
        resultado = await capturarEsaj(browserlessApiKey, credencial, processo_numero, supabase);
        break;
      case "projudi":
        resultado = await capturarProjudi(browserlessApiKey, credencial, processo_numero, supabase);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Sistema ${credencial.sistema} não suportado ainda` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Log sucesso
    await logCaptura(supabase, cofre_senha_id, null, "success", `Captura concluída: ${resultado.processosCapturados} processos, ${resultado.intimacoesCapturadas} intimações`);

    return new Response(
      JSON.stringify({ success: true, ...resultado }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro na captura:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function logCaptura(supabase: any, cofreSenhaId: string, capturaId: string | null, tipo: string, mensagem: string, detalhes?: any) {
  await supabase.from("logs_captura_tribunal").insert({
    cofre_senha_id: cofreSenhaId,
    captura_id: capturaId,
    tipo,
    mensagem,
    detalhes,
  });
}

// =====================
// SCRAPER PJE
// =====================
async function capturarPje(apiKey: string, credencial: any, processoNumero: string | undefined, supabase: any) {
  const browserlessUrl = `https://chrome.browserless.io/scrape?token=${apiKey}`;

  // Script Puppeteer para executar no Browserless
  const pjeScript = `
    async function loginPje(page, login, senha, tribunal) {
      // URLs base por tribunal
      const urls = {
        'TRT1': 'https://pje.trt1.jus.br/primeirograu/login.seam',
        'TRT2': 'https://pje.trt2.jus.br/primeirograu/login.seam',
        'TRT3': 'https://pje.trt3.jus.br/primeirograu/login.seam',
        'TRT4': 'https://pje.trt4.jus.br/primeirograu/login.seam',
        'TRT5': 'https://pje.trt5.jus.br/primeirograu/login.seam',
        'TRT6': 'https://pje.trt6.jus.br/primeirograu/login.seam',
        'TRT7': 'https://pje.trt7.jus.br/primeirograu/login.seam',
        'TRT8': 'https://pje.trt8.jus.br/primeirograu/login.seam',
        'TRT9': 'https://pje.trt9.jus.br/primeirograu/login.seam',
        'TRT10': 'https://pje.trt10.jus.br/primeirograu/login.seam',
        'TRT11': 'https://pje.trt11.jus.br/primeirograu/login.seam',
        'TRT12': 'https://pje.trt12.jus.br/primeirograu/login.seam',
        'TRT13': 'https://pje.trt13.jus.br/primeirograu/login.seam',
        'TRT14': 'https://pje.trt14.jus.br/primeirograu/login.seam',
        'TRT15': 'https://pje.trt15.jus.br/primeirograu/login.seam',
        'TRT16': 'https://pje.trt16.jus.br/primeirograu/login.seam',
        'TRT17': 'https://pje.trt17.jus.br/primeirograu/login.seam',
        'TRT18': 'https://pje.trt18.jus.br/primeirograu/login.seam',
        'TRT19': 'https://pje.trt19.jus.br/primeirograu/login.seam',
        'TRT20': 'https://pje.trt20.jus.br/primeirograu/login.seam',
        'TRT21': 'https://pje.trt21.jus.br/primeirograu/login.seam',
        'TRT22': 'https://pje.trt22.jus.br/primeirograu/login.seam',
        'TRT23': 'https://pje.trt23.jus.br/primeirograu/login.seam',
        'TRT24': 'https://pje.trt24.jus.br/primeirograu/login.seam',
      };

      const baseUrl = urls[tribunal] || urls['TRT2'];
      await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Aguardar formulário de login
      await page.waitForSelector('#username', { timeout: 10000 });
      
      // Preencher credenciais
      await page.type('#username', login);
      await page.type('#password', senha);
      
      // Clicar em entrar
      await page.click('#btnEntrar');
      
      // Aguardar login
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      
      return true;
    }

    async function capturarIntimacoes(page) {
      const intimacoes = [];
      
      try {
        // Navegar para painel de intimações
        await page.goto(page.url().replace('/painel', '/intimacao/lista.seam'), { waitUntil: 'networkidle2' });
        
        // Aguardar tabela de intimações
        await page.waitForSelector('.rich-table', { timeout: 10000 });
        
        // Extrair intimações
        const rows = await page.$$('.rich-table tbody tr');
        for (const row of rows) {
          const cells = await row.$$('td');
          if (cells.length >= 4) {
            intimacoes.push({
              processo: await cells[0].evaluate(el => el.textContent?.trim()),
              dataDisponibilizacao: await cells[1].evaluate(el => el.textContent?.trim()),
              prazo: await cells[2].evaluate(el => el.textContent?.trim()),
              tipo: await cells[3].evaluate(el => el.textContent?.trim()),
            });
          }
        }
      } catch (e) {
        console.log('Erro ao capturar intimações:', e.message);
      }
      
      return intimacoes;
    }

    async function capturarProcesso(page, numeroProcesso) {
      const processo = {};
      
      try {
        // Buscar processo
        await page.goto(page.url().replace(/\\/[^/]+$/, '/processo/consulta.seam'), { waitUntil: 'networkidle2' });
        
        await page.waitForSelector('#fPP\\\\:numeroProcesso', { timeout: 10000 });
        await page.type('#fPP\\\\:numeroProcesso', numeroProcesso);
        await page.click('#fPP\\\\:btPesquisar');
        
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        // Extrair dados do processo
        processo.numero = numeroProcesso;
        processo.classe = await page.$eval('.classeProcessual', el => el.textContent?.trim()).catch(() => null);
        processo.assunto = await page.$eval('.assuntoPrincipal', el => el.textContent?.trim()).catch(() => null);
        processo.vara = await page.$eval('.orgaoJulgador', el => el.textContent?.trim()).catch(() => null);
        
        // Extrair partes
        processo.partes = [];
        const partesElements = await page.$$('.parteProcesso');
        for (const parte of partesElements) {
          const tipo = await parte.$eval('.tipoParte', el => el.textContent?.trim()).catch(() => '');
          const nome = await parte.$eval('.nomeParte', el => el.textContent?.trim()).catch(() => '');
          processo.partes.push({ tipo, nome });
        }
        
        // Extrair movimentações
        processo.movimentacoes = [];
        const movRows = await page.$$('.movimentacao');
        for (const mov of movRows) {
          const data = await mov.$eval('.dataMovimentacao', el => el.textContent?.trim()).catch(() => '');
          const descricao = await mov.$eval('.descricaoMovimentacao', el => el.textContent?.trim()).catch(() => '');
          processo.movimentacoes.push({ data, descricao });
        }
        
      } catch (e) {
        console.log('Erro ao capturar processo:', e.message);
      }
      
      return processo;
    }
  `;

  // Executar scrape via Browserless
  const response = await fetch(browserlessUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "about:blank",
      elements: [],
      gotoOptions: { waitUntil: "networkidle2" },
      // Browserless scrape API - executa script customizado
      // Para automação completa, usar /function ou /pdf endpoint
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Browserless error: ${errorText}`);
  }

  // Por enquanto, retornar estrutura básica
  // A implementação completa requer usar o endpoint /function do Browserless
  // que executa Puppeteer code arbitrário
  
  await logCaptura(supabase, credencial.id, null, "info", "Conectando ao PJe via Browserless...");

  // TODO: Implementar captura completa usando Browserless /function endpoint
  // A API de scrape é limitada, precisamos usar /function para execução de Puppeteer

  return {
    sistema: "pje",
    tribunal: credencial.tribunal,
    processosCapturados: 0,
    intimacoesCapturadas: 0,
    mensagem: "Estrutura criada. Captura PJe requer configuração adicional do Browserless /function endpoint.",
  };
}

// =====================
// SCRAPER ESAJ
// =====================
async function capturarEsaj(apiKey: string, credencial: any, processoNumero: string | undefined, supabase: any) {
  await logCaptura(supabase, credencial.id, null, "info", "Conectando ao eSAJ via Browserless...");

  // eSAJ tem estrutura diferente do PJe
  // URLs comuns:
  // TJSP: https://esaj.tjsp.jus.br/cpopg/open.do
  // TJSC: https://esaj.tjsc.jus.br/cpopg/open.do
  
  // TODO: Implementar scraper eSAJ

  return {
    sistema: "esaj",
    tribunal: credencial.tribunal,
    processosCapturados: 0,
    intimacoesCapturadas: 0,
    mensagem: "Scraper eSAJ em desenvolvimento.",
  };
}

// =====================
// SCRAPER PROJUDI
// =====================
async function capturarProjudi(apiKey: string, credencial: any, processoNumero: string | undefined, supabase: any) {
  await logCaptura(supabase, credencial.id, null, "info", "Conectando ao Projudi via Browserless...");

  // TODO: Implementar scraper Projudi

  return {
    sistema: "projudi",
    tribunal: credencial.tribunal,
    processosCapturados: 0,
    intimacoesCapturadas: 0,
    mensagem: "Scraper Projudi em desenvolvimento.",
  };
}
