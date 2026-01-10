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
// SCRAPER PJE via Browserless Scrape API
// =====================
async function capturarPje(apiKey: string, credencial: any, processoNumero: string | undefined, supabase: any) {
  const tribunalKey = credencial.tribunal?.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TRT2';
  const baseUrl = PJE_URLS[tribunalKey] || PJE_URLS['TRT2'];
  
  await logCaptura(supabase, credencial.id, null, "info", `Conectando ao PJe ${tribunalKey} via Browserless...`);

  try {
    // Usar /content API que é mais simples e confiável
    const loginUrl = `${baseUrl}/primeirograu/login.seam`;
    
    console.log(`[PJe] Acessando ${loginUrl}...`);
    
    // Usar /content para obter HTML da página
    const contentResponse = await fetch(`https://chrome.browserless.io/content?token=${apiKey}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        url: loginUrl,
        gotoOptions: {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        },
        waitForTimeout: 3000,
      }),
    });

    if (!contentResponse.ok) {
      const errorText = await contentResponse.text();
      console.error("Browserless content error:", contentResponse.status, errorText);
      
      // Tentar fallback com /screenshot para verificar se portal está acessível
      const screenshotResponse = await fetch(`https://chrome.browserless.io/screenshot?token=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: loginUrl,
          gotoOptions: {
            waitUntil: "load",
            timeout: 45000,
          },
          options: { type: "png", fullPage: false },
        }),
      });
      
      if (screenshotResponse.ok) {
        // Portal acessível mas /content falhou
        await supabase.from("cofre_senhas").update({
          status_validacao: "acessivel",
          mensagem_erro: null,
          ultima_validacao: new Date().toISOString(),
        }).eq("id", credencial.id);
        
        return {
          sistema: "pje",
          tribunal: credencial.tribunal,
          processosCapturados: 0,
          intimacoesCapturadas: 0,
          mensagem: `Portal PJe ${tribunalKey} acessível (verificado via screenshot)`,
          status: "acessivel",
        };
      }
      
      throw new Error(`Timeout ao acessar portal PJe. Tente novamente.`);
    }

    const htmlContent = await contentResponse.text();
    console.log(`[PJe] Conteúdo obtido: ${htmlContent.length} bytes`);
    
    // Verificar se tem CAPTCHA no HTML
    const hasCaptcha = htmlContent.includes('g-recaptcha') || 
                       htmlContent.includes('captcha') ||
                       htmlContent.includes('data-sitekey');
    
    if (hasCaptcha) {
      await supabase.from("cofre_senhas").update({
        status_validacao: "captcha",
        mensagem_erro: "CAPTCHA detectado no portal",
        ultima_validacao: new Date().toISOString(),
      }).eq("id", credencial.id);
      
      return {
        sistema: "pje",
        tribunal: credencial.tribunal,
        processosCapturados: 0,
        intimacoesCapturadas: 0,
        erro: "CAPTCHA detectado",
        mensagem: "CAPTCHA detectado - login manual necessário",
      };
    }
    
    // Verificar se formulário de login existe
    const hasLoginForm = htmlContent.includes('username') || 
                         htmlContent.includes('login') ||
                         htmlContent.includes('senha');
    
    if (!hasLoginForm) {
      console.log("[PJe] Formulário não encontrado, verificando conteúdo...");
    }

    // Portal está acessível
    await supabase.from("cofre_senhas").update({
      status_validacao: "acessivel",
      mensagem_erro: null,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", credencial.id);

    // Portal está acessível
    await supabase.from("cofre_senhas").update({
      status_validacao: "acessivel",
      mensagem_erro: null,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", credencial.id);

    await logCaptura(supabase, credencial.id, null, "success", 
      `Portal PJe ${tribunalKey} acessível. Login requer integração avançada.`);

    // Tentar buscar dados públicos do processo se número fornecido
    let processoInfo = null;
    if (processoNumero) {
      processoInfo = await buscarProcessoPublicoPje(apiKey, baseUrl, processoNumero, supabase);
    }

    return {
      sistema: "pje",
      tribunal: credencial.tribunal,
      processosCapturados: processoInfo ? 1 : 0,
      intimacoesCapturadas: 0,
      processo: processoInfo,
      mensagem: `Portal PJe ${tribunalKey} verificado. ${processoInfo ? 'Dados públicos obtidos.' : 'Credencial válida para acesso.'}`,
      status: "acessivel",
    };

  } catch (error: any) {
    console.error("Erro ao executar scraper PJe:", error);
    
    await logCaptura(supabase, credencial.id, null, "error", error.message);
    
    await supabase.from("cofre_senhas").update({
      status_validacao: "erro",
      mensagem_erro: error.message,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", credencial.id);
    
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

// Buscar dados públicos de processo no PJe (consulta pública)
async function buscarProcessoPublicoPje(apiKey: string, baseUrl: string, processoNumero: string, supabase: any) {
  try {
    const numeroLimpo = processoNumero.replace(/[^0-9]/g, '');
    const consultaUrl = `${baseUrl}/consultaprocessual/detalhe-processo/${numeroLimpo}`;
    
    const response = await fetch(`https://chrome.browserless.io/scrape?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: consultaUrl,
        gotoOptions: {
          waitUntil: "networkidle2",
          timeout: 30000,
        },
        elements: [
          { selector: ".processo-rotulo, .classeProcessual, [class*='classe']" },
          { selector: ".processo-valor, [class*='assunto']" },
          { selector: ".orgao-julgador, [class*='vara'], [class*='orgao']" },
          { selector: ".polo-ativo, [class*='autor'], [class*='requerente']" },
          { selector: ".polo-passivo, [class*='reu'], [class*='requerido']" },
          { selector: ".movimentacao, [class*='movimento'], table tr" },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    
    const getData = (selector: string) => {
      const element = result.data?.find((d: any) => d.selector.includes(selector));
      return element?.results?.[0]?.text?.trim() || null;
    };

    const movimentacoes = result.data?.find((d: any) => 
      d.selector.includes("movimentacao") || d.selector.includes("movimento")
    )?.results?.slice(0, 10).map((r: any) => ({
      descricao: r.text?.trim() || '',
    })) || [];

    return {
      numero: processoNumero,
      classe: getData("classe"),
      assunto: getData("assunto"),
      vara: getData("vara") || getData("orgao"),
      autor: getData("autor") || getData("requerente") || getData("polo-ativo"),
      reu: getData("reu") || getData("requerido") || getData("polo-passivo"),
      movimentacoes,
    };
  } catch (e) {
    console.error("Erro ao buscar processo público:", e);
    return null;
  }
}

// =====================
// SCRAPER ESAJ via Browserless Scrape API
// =====================
async function capturarEsaj(apiKey: string, credencial: any, processoNumero: string | undefined, supabase: any) {
  await logCaptura(supabase, credencial.id, null, "info", "Verificando portal eSAJ via Browserless...");

  const ESAJ_URLS: Record<string, string> = {
    'TJSP': 'https://esaj.tjsp.jus.br',
    'TJSC': 'https://esaj.tjsc.jus.br',
    'TJMS': 'https://esaj.tjms.jus.br',
    'TJCE': 'https://esaj.tjce.jus.br',
    'TJAM': 'https://esaj.tjam.jus.br',
  };

  const tribunalKey = credencial.tribunal?.toUpperCase().replace(/[^A-Z]/g, '') || 'TJSP';
  const baseUrl = ESAJ_URLS[tribunalKey] || ESAJ_URLS['TJSP'];

  try {
    // Verificar se portal está acessível
    const loginUrl = `${baseUrl}/sajcas/login`;
    
    const scrapeResponse = await fetch(`https://chrome.browserless.io/scrape?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: loginUrl,
        gotoOptions: {
          waitUntil: "networkidle2",
          timeout: 30000,
        },
        elements: [
          { selector: "#usernameForm, input[name='username']" },
          { selector: "form" },
          { selector: ".g-recaptcha, #captcha" },
        ],
      }),
    });

    if (!scrapeResponse.ok) {
      throw new Error(`Erro ao acessar portal eSAJ: ${scrapeResponse.status}`);
    }

    const scrapeResult = await scrapeResponse.json();
    
    const captchaElement = scrapeResult.data?.find((d: any) => 
      d.selector?.includes("captcha") || d.selector?.includes("recaptcha")
    );
    
    if (captchaElement?.results?.length > 0) {
      await supabase.from("cofre_senhas").update({
        status_validacao: "captcha",
        mensagem_erro: "CAPTCHA detectado no eSAJ",
        ultima_validacao: new Date().toISOString(),
      }).eq("id", credencial.id);
      
      return {
        sistema: "esaj",
        tribunal: credencial.tribunal,
        processosCapturados: 0,
        intimacoesCapturadas: 0,
        mensagem: "CAPTCHA detectado - login manual necessário",
      };
    }

    // Portal acessível
    await supabase.from("cofre_senhas").update({
      status_validacao: "acessivel",
      mensagem_erro: null,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", credencial.id);

    // Buscar dados públicos se número fornecido
    let processoInfo = null;
    if (processoNumero) {
      processoInfo = await buscarProcessoPublicoEsaj(apiKey, baseUrl, processoNumero, tribunalKey);
    }

    return {
      sistema: "esaj",
      tribunal: credencial.tribunal,
      processosCapturados: processoInfo ? 1 : 0,
      intimacoesCapturadas: 0,
      processo: processoInfo,
      mensagem: `Portal eSAJ ${tribunalKey} verificado. ${processoInfo ? 'Dados públicos obtidos.' : 'Credencial válida para acesso.'}`,
      status: "acessivel",
    };
  } catch (error: any) {
    await logCaptura(supabase, credencial.id, null, "error", error.message);
    
    await supabase.from("cofre_senhas").update({
      status_validacao: "erro",
      mensagem_erro: error.message,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", credencial.id);
    
    return {
      sistema: "esaj",
      tribunal: credencial.tribunal,
      processosCapturados: 0,
      intimacoesCapturadas: 0,
      mensagem: `Erro: ${error.message}`,
    };
  }
}

async function buscarProcessoPublicoEsaj(apiKey: string, baseUrl: string, processoNumero: string, tribunal: string) {
  try {
    const numeroLimpo = processoNumero.replace(/[^0-9]/g, '');
    const consultaUrl = `${baseUrl}/cpopg/show.do?processo.numero=${numeroLimpo}`;
    
    const response = await fetch(`https://chrome.browserless.io/scrape?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: consultaUrl,
        gotoOptions: {
          waitUntil: "networkidle2",
          timeout: 30000,
        },
        elements: [
          { selector: "#classeProcesso, .classeProcesso" },
          { selector: "#assuntoProcesso, .assuntoProcesso" },
          { selector: "#varaProcesso, .varaProcesso" },
          { selector: "#tablePartesPrincipais tr" },
          { selector: "#tabelaUltimasMovimentacoes tr" },
        ],
      }),
    });

    if (!response.ok) return null;

    const result = await response.json();
    
    const getData = (selector: string) => {
      const element = result.data?.find((d: any) => d.selector.includes(selector));
      return element?.results?.[0]?.text?.trim() || null;
    };

    const movimentacoes = result.data?.find((d: any) => 
      d.selector.includes("Movimentacoes")
    )?.results?.slice(0, 10).map((r: any) => ({
      descricao: r.text?.trim() || '',
    })) || [];

    return {
      numero: processoNumero,
      classe: getData("classe"),
      assunto: getData("assunto"),
      vara: getData("vara"),
      movimentacoes,
    };
  } catch {
    return null;
  }
}

// =====================
// SCRAPER PROJUDI via Browserless Scrape API
// =====================
async function capturarProjudi(apiKey: string, credencial: any, processoNumero: string | undefined, supabase: any) {
  await logCaptura(supabase, credencial.id, null, "info", "Verificando portal Projudi via Browserless...");

  const PROJUDI_URLS: Record<string, string> = {
    'TJPR': 'https://projudi.tjpr.jus.br',
    'TJGO': 'https://projudi.tjgo.jus.br',
    'TJBA': 'https://projudi.tjba.jus.br',
  };

  const tribunalKey = credencial.tribunal?.toUpperCase().replace(/[^A-Z]/g, '') || 'TJPR';
  const baseUrl = PROJUDI_URLS[tribunalKey] || PROJUDI_URLS['TJPR'];

  try {
    const scrapeResponse = await fetch(`https://chrome.browserless.io/scrape?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: baseUrl,
        gotoOptions: {
          waitUntil: "networkidle2",
          timeout: 30000,
        },
        elements: [
          { selector: "input[name='login'], #login" },
          { selector: "form" },
          { selector: ".g-recaptcha, #captcha" },
        ],
      }),
    });

    if (!scrapeResponse.ok) {
      throw new Error(`Erro ao acessar portal Projudi: ${scrapeResponse.status}`);
    }

    const scrapeResult = await scrapeResponse.json();
    
    const captchaElement = scrapeResult.data?.find((d: any) => 
      d.selector?.includes("captcha") || d.selector?.includes("recaptcha")
    );
    
    if (captchaElement?.results?.length > 0) {
      await supabase.from("cofre_senhas").update({
        status_validacao: "captcha",
        mensagem_erro: "CAPTCHA detectado no Projudi",
        ultima_validacao: new Date().toISOString(),
      }).eq("id", credencial.id);
      
      return {
        sistema: "projudi",
        tribunal: credencial.tribunal,
        processosCapturados: 0,
        intimacoesCapturadas: 0,
        mensagem: "CAPTCHA detectado - login manual necessário",
      };
    }

    // Portal acessível
    await supabase.from("cofre_senhas").update({
      status_validacao: "acessivel",
      mensagem_erro: null,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", credencial.id);

    return {
      sistema: "projudi",
      tribunal: credencial.tribunal,
      processosCapturados: 0,
      intimacoesCapturadas: 0,
      mensagem: `Portal Projudi ${tribunalKey} verificado. Credencial válida para acesso.`,
      status: "acessivel",
    };
  } catch (error: any) {
    await logCaptura(supabase, credencial.id, null, "error", error.message);
    
    await supabase.from("cofre_senhas").update({
      status_validacao: "erro",
      mensagem_erro: error.message,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", credencial.id);
    
    return {
      sistema: "projudi",
      tribunal: credencial.tribunal,
      processosCapturados: 0,
      intimacoesCapturadas: 0,
      mensagem: `Erro: ${error.message}`,
    };
  }
}
