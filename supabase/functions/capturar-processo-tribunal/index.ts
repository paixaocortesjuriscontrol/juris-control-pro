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
    await logCaptura(supabase, cofre_senha_id, null, "info", `Iniciando captura para ${credencial.sistema} - ${credencial.tribunal}`, { processo_numero });

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
    await logCaptura(supabase, cofre_senha_id, null, "success", `Captura concluída: ${resultado.processosCapturados} processos, ${resultado.intimacoesCapturadas} intimações`, { processo_id: processo_numero });

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

// URLs base dos tribunais
const PJE_URLS: Record<string, string> = {
  'TRT1': 'https://pje.trt1.jus.br',
  'TRT2': 'https://pje.trt2.jus.br',
  'TRT3': 'https://pje.trt3.jus.br',
  'TRT4': 'https://pje.trt4.jus.br',
  'TRT5': 'https://pje.trt5.jus.br',
  'TRT6': 'https://pje.trt6.jus.br',
  'TRT7': 'https://pje.trt7.jus.br',
  'TRT8': 'https://pje.trt8.jus.br',
  'TRT9': 'https://pje.trt9.jus.br',
  'TRT10': 'https://pje.trt10.jus.br',
  'TRT11': 'https://pje.trt11.jus.br',
  'TRT12': 'https://pje.trt12.jus.br',
  'TRT13': 'https://pje.trt13.jus.br',
  'TRT14': 'https://pje.trt14.jus.br',
  'TRT15': 'https://pje.trt15.jus.br',
  'TRT16': 'https://pje.trt16.jus.br',
  'TRT17': 'https://pje.trt17.jus.br',
  'TRT18': 'https://pje.trt18.jus.br',
  'TRT19': 'https://pje.trt19.jus.br',
  'TRT20': 'https://pje.trt20.jus.br',
  'TRT21': 'https://pje.trt21.jus.br',
  'TRT22': 'https://pje.trt22.jus.br',
  'TRT23': 'https://pje.trt23.jus.br',
  'TRT24': 'https://pje.trt24.jus.br',
  'TJDFT': 'https://pje.tjdft.jus.br',
  'TJDF': 'https://pje.tjdft.jus.br',
};

// =====================
// SCRAPER PJE via Browserless Function API
// =====================
async function capturarPje(apiKey: string, credencial: any, processoNumero: string | undefined, supabase: any) {
  const tribunalKey = credencial.tribunal?.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TRT2';
  const baseUrl = PJE_URLS[tribunalKey] || PJE_URLS['TRT2'];
  
  await logCaptura(supabase, credencial.id, null, "info", `Conectando ao PJe ${tribunalKey} via Browserless...`);

  // Script Puppeteer para executar no Browserless /function endpoint
  const puppeteerCode = `
    module.exports = async ({ page, context }) => {
      const { login, senha, baseUrl, processoNumero } = context;
      
      const resultado = {
        sucesso: false,
        erro: null,
        intimacoes: [],
        processo: null,
        movimentacoes: []
      };

      try {
        // Configurar timeout e navegação
        page.setDefaultTimeout(30000);
        
        // Ir para página de login
        const loginUrl = baseUrl + '/primeirograu/login.seam';
        console.log('Navegando para:', loginUrl);
        await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Aguardar formulário de login
        await page.waitForSelector('#username', { timeout: 15000 }).catch(() => {
          // Tentar seletor alternativo
          return page.waitForSelector('input[name="username"]', { timeout: 5000 });
        });
        
        // Verificar se há CAPTCHA
        const hasCaptcha = await page.$('#captcha, .g-recaptcha, [data-sitekey]');
        if (hasCaptcha) {
          resultado.erro = 'CAPTCHA detectado - login manual necessário';
          return resultado;
        }
        
        // Preencher credenciais
        await page.type('#username', login, { delay: 50 });
        await page.type('#password', senha, { delay: 50 });
        
        // Clicar em entrar
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          page.click('#btnEntrar, button[type="submit"]')
        ]);
        
        // Verificar se login foi bem sucedido
        await page.waitForTimeout(2000);
        const currentUrl = page.url();
        
        if (currentUrl.includes('login.seam') || currentUrl.includes('erro')) {
          resultado.erro = 'Falha no login - verifique credenciais';
          return resultado;
        }
        
        resultado.sucesso = true;
        
        // Se temos número de processo, buscar detalhes
        if (processoNumero) {
          try {
            // Navegar para consulta de processo
            await page.goto(baseUrl + '/primeirograu/Processo/ConsultaProcesso/listView.seam', { 
              waitUntil: 'networkidle2', 
              timeout: 30000 
            });
            
            // Buscar pelo número
            const inputNumero = await page.$('#fPP\\\\:numeroProcesso, input[id*="numeroProcesso"]');
            if (inputNumero) {
              await inputNumero.type(processoNumero.replace(/[^0-9]/g, ''), { delay: 30 });
              await page.click('#fPP\\\\:btPesquisar, button[id*="Pesquisar"]');
              await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
              
              // Extrair dados do processo
              resultado.processo = {
                numero: processoNumero,
                classe: await page.$eval('.classeProcessual, [id*="classe"]', el => el.textContent?.trim()).catch(() => null),
                assunto: await page.$eval('.assuntoPrincipal, [id*="assunto"]', el => el.textContent?.trim()).catch(() => null),
                vara: await page.$eval('.orgaoJulgador, [id*="orgao"]', el => el.textContent?.trim()).catch(() => null),
              };
              
              // Extrair movimentações
              const movs = await page.$$eval('.movimentacao, tr[id*="movimentacao"]', rows => {
                return rows.slice(0, 20).map(row => ({
                  data: row.querySelector('.dataMovimentacao, td:first-child')?.textContent?.trim() || '',
                  descricao: row.querySelector('.descricaoMovimentacao, td:nth-child(2)')?.textContent?.trim() || ''
                }));
              }).catch(() => []);
              resultado.movimentacoes = movs;
            }
          } catch (e) {
            console.log('Erro ao buscar processo:', e.message);
          }
        }
        
        // Buscar intimações pendentes
        try {
          await page.goto(baseUrl + '/primeirograu/Painel/painel_usuario/advogado.seam', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
          });
          
          // Tentar diferentes seletores para intimações
          const intimacoes = await page.$$eval(
            '.rich-table tbody tr, table[id*="intimacoes"] tbody tr, [id*="painel"] table tbody tr',
            rows => {
              return rows.slice(0, 50).map(row => {
                const cells = row.querySelectorAll('td');
                return {
                  processo: cells[0]?.textContent?.trim() || '',
                  data: cells[1]?.textContent?.trim() || '',
                  prazo: cells[2]?.textContent?.trim() || '',
                  tipo: cells[3]?.textContent?.trim() || ''
                };
              }).filter(i => i.processo);
            }
          ).catch(() => []);
          
          resultado.intimacoes = intimacoes;
        } catch (e) {
          console.log('Erro ao buscar intimações:', e.message);
        }
        
        return resultado;
        
      } catch (error) {
        resultado.erro = error.message || 'Erro desconhecido';
        return resultado;
      }
    };
  `;

  try {
    // Chamar Browserless Function API
    const response = await fetch(`https://chrome.browserless.io/function?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: puppeteerCode,
        context: {
          login: credencial.login,
          senha: credencial.senha_hash, // Nota: idealmente deveria ser descriptografada
          baseUrl: baseUrl,
          processoNumero: processoNumero || null,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Browserless error:", errorText);
      
      // Atualizar status da credencial
      await supabase.from("cofre_senhas").update({
        status_validacao: "erro",
        mensagem_erro: `Erro Browserless: ${response.status}`,
        ultima_validacao: new Date().toISOString(),
      }).eq("id", credencial.id);
      
      throw new Error(`Browserless error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const resultado = await response.json();
    
    if (resultado.erro) {
      await logCaptura(supabase, credencial.id, null, "error", resultado.erro);
      
      await supabase.from("cofre_senhas").update({
        status_validacao: resultado.erro.includes("CAPTCHA") ? "captcha" : "erro",
        mensagem_erro: resultado.erro,
        ultima_validacao: new Date().toISOString(),
      }).eq("id", credencial.id);
      
      return {
        sistema: "pje",
        tribunal: credencial.tribunal,
        processosCapturados: 0,
        intimacoesCapturadas: 0,
        erro: resultado.erro,
        mensagem: resultado.erro,
      };
    }
    
    // Sucesso - atualizar status
    await supabase.from("cofre_senhas").update({
      status_validacao: "valido",
      mensagem_erro: null,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", credencial.id);

    return {
      sistema: "pje",
      tribunal: credencial.tribunal,
      processosCapturados: resultado.processo ? 1 : 0,
      intimacoesCapturadas: resultado.intimacoes?.length || 0,
      processo: resultado.processo,
      intimacoes: resultado.intimacoes,
      movimentacoes: resultado.movimentacoes,
      mensagem: `Conectado com sucesso ao PJe ${tribunalKey}`,
    };

  } catch (error: any) {
    console.error("Erro ao executar scraper PJe:", error);
    
    await logCaptura(supabase, credencial.id, null, "error", error.message);
    
    return {
      sistema: "pje",
      tribunal: credencial.tribunal,
      processosCapturados: 0,
      intimacoesCapturadas: 0,
      erro: error.message,
      mensagem: `Erro ao conectar: ${error.message}`,
    };
  }
}

// =====================
// SCRAPER ESAJ
// =====================
async function capturarEsaj(apiKey: string, credencial: any, processoNumero: string | undefined, supabase: any) {
  await logCaptura(supabase, credencial.id, null, "info", "Conectando ao eSAJ via Browserless...");

  const ESAJ_URLS: Record<string, string> = {
    'TJSP': 'https://esaj.tjsp.jus.br',
    'TJSC': 'https://esaj.tjsc.jus.br',
    'TJMS': 'https://esaj.tjms.jus.br',
    'TJCE': 'https://esaj.tjce.jus.br',
    'TJAM': 'https://esaj.tjam.jus.br',
  };

  const tribunalKey = credencial.tribunal?.toUpperCase().replace(/[^A-Z]/g, '') || 'TJSP';
  const baseUrl = ESAJ_URLS[tribunalKey] || ESAJ_URLS['TJSP'];

  const puppeteerCode = `
    module.exports = async ({ page, context }) => {
      const { login, senha, baseUrl, processoNumero } = context;
      
      const resultado = {
        sucesso: false,
        erro: null,
        intimacoes: [],
        processo: null
      };

      try {
        page.setDefaultTimeout(30000);
        
        // eSAJ login page
        await page.goto(baseUrl + '/sajcas/login', { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Preencher credenciais
        await page.waitForSelector('#usernameForm', { timeout: 15000 });
        await page.type('#usernameForm', login, { delay: 50 });
        await page.type('#passwordForm', senha, { delay: 50 });
        
        // Submit
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          page.click('#pbEntrar')
        ]);
        
        await page.waitForTimeout(2000);
        
        if (page.url().includes('login')) {
          resultado.erro = 'Falha no login eSAJ';
          return resultado;
        }
        
        resultado.sucesso = true;
        resultado.mensagem = 'Conectado ao eSAJ com sucesso';
        
        return resultado;
      } catch (error) {
        resultado.erro = error.message;
        return resultado;
      }
    };
  `;

  try {
    const response = await fetch(`https://chrome.browserless.io/function?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: puppeteerCode,
        context: {
          login: credencial.login,
          senha: credencial.senha_hash,
          baseUrl: baseUrl,
          processoNumero: processoNumero || null,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Browserless error: ${response.status}`);
    }

    const resultado = await response.json();
    
    await supabase.from("cofre_senhas").update({
      status_validacao: resultado.sucesso ? "valido" : "erro",
      mensagem_erro: resultado.erro || null,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", credencial.id);

    return {
      sistema: "esaj",
      tribunal: credencial.tribunal,
      processosCapturados: resultado.processo ? 1 : 0,
      intimacoesCapturadas: resultado.intimacoes?.length || 0,
      mensagem: resultado.erro || resultado.mensagem || "Conectado ao eSAJ",
    };
  } catch (error: any) {
    await logCaptura(supabase, credencial.id, null, "error", error.message);
    return {
      sistema: "esaj",
      tribunal: credencial.tribunal,
      processosCapturados: 0,
      intimacoesCapturadas: 0,
      mensagem: `Erro: ${error.message}`,
    };
  }
}

// =====================
// SCRAPER PROJUDI
// =====================
async function capturarProjudi(apiKey: string, credencial: any, processoNumero: string | undefined, supabase: any) {
  await logCaptura(supabase, credencial.id, null, "info", "Conectando ao Projudi via Browserless...");

  const PROJUDI_URLS: Record<string, string> = {
    'TJPR': 'https://projudi.tjpr.jus.br',
    'TJGO': 'https://projudi.tjgo.jus.br',
    'TJBA': 'https://projudi.tjba.jus.br',
  };

  const tribunalKey = credencial.tribunal?.toUpperCase().replace(/[^A-Z]/g, '') || 'TJPR';
  const baseUrl = PROJUDI_URLS[tribunalKey] || PROJUDI_URLS['TJPR'];

  const puppeteerCode = `
    module.exports = async ({ page, context }) => {
      const { login, senha, baseUrl } = context;
      
      const resultado = {
        sucesso: false,
        erro: null,
        intimacoes: []
      };

      try {
        page.setDefaultTimeout(30000);
        
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Projudi login
        await page.waitForSelector('input[name="login"]', { timeout: 15000 });
        await page.type('input[name="login"]', login, { delay: 50 });
        await page.type('input[name="senha"]', senha, { delay: 50 });
        
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          page.click('input[type="submit"], button[type="submit"]')
        ]);
        
        await page.waitForTimeout(2000);
        
        if (page.url().includes('login') || page.url().includes('erro')) {
          resultado.erro = 'Falha no login Projudi';
          return resultado;
        }
        
        resultado.sucesso = true;
        resultado.mensagem = 'Conectado ao Projudi com sucesso';
        
        return resultado;
      } catch (error) {
        resultado.erro = error.message;
        return resultado;
      }
    };
  `;

  try {
    const response = await fetch(`https://chrome.browserless.io/function?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: puppeteerCode,
        context: {
          login: credencial.login,
          senha: credencial.senha_hash,
          baseUrl: baseUrl,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Browserless error: ${response.status}`);
    }

    const resultado = await response.json();
    
    await supabase.from("cofre_senhas").update({
      status_validacao: resultado.sucesso ? "valido" : "erro",
      mensagem_erro: resultado.erro || null,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", credencial.id);

    return {
      sistema: "projudi",
      tribunal: credencial.tribunal,
      processosCapturados: 0,
      intimacoesCapturadas: resultado.intimacoes?.length || 0,
      mensagem: resultado.erro || resultado.mensagem || "Conectado ao Projudi",
    };
  } catch (error: any) {
    await logCaptura(supabase, credencial.id, null, "error", error.message);
    return {
      sistema: "projudi",
      tribunal: credencial.tribunal,
      processosCapturados: 0,
      intimacoesCapturadas: 0,
      mensagem: `Erro: ${error.message}`,
    };
  }
}
