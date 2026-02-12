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

  // Extract user from JWT
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

    // Verificar se tem certificado A1
    const temCertificado = !!credencial.certificado_a1_path;
    const tribunalKey = (tribunal || credencial.tribunal || "TRT2").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const baseUrl = PJE_URLS[tribunalKey] || PJE_URLS["TRT2"];

    console.log(`[baixar-autos-pje] Tribunal: ${tribunalKey}, Base: ${baseUrl}, Certificado: ${temCertificado}`);

    // Buscar certificado do storage se disponível
    let certBase64: string | null = null;
    if (temCertificado) {
      try {
        const { data: certData, error: certError } = await supabase.storage
          .from("cofre_certificados")
          .download(credencial.certificado_a1_path);

        if (!certError && certData) {
          const arrayBuffer = await certData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          // Convert to base64
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          certBase64 = btoa(binary);
          console.log(`[baixar-autos-pje] Certificado carregado: ${certBase64.length} chars base64`);
        }
      } catch (e) {
        console.error("[baixar-autos-pje] Erro ao carregar certificado:", e);
      }
    }

    // Puppeteer script que roda no Browserless
    const numeroLimpo = processo_numero.replace(/[^0-9]/g, "");

    const puppeteerCode = `
      module.exports = async ({ page, context }) => {
        const { baseUrl, numeroProcesso, login, senha, temCert, certB64, certSenha } = context;

        const resultado = {
          documentos: [],
          erro: null,
          loginSucesso: false,
          paginaProcesso: false,
        };

        try {
          // 1. Navegar para login
          console.log("[PJe] Navegando para login...");
          await page.goto(baseUrl + "/primeirograu/login.seam", {
            waitUntil: "domcontentloaded",
            timeout: 45000,
          });
          await page.waitForTimeout(2000);

          // 2. Tentar login com usuário/senha
          const usernameField = await page.$('input[name="username"], input[id="username"], #username');
          const passwordField = await page.$('input[name="password"], input[type="password"], #password');

          if (usernameField && passwordField) {
            console.log("[PJe] Formulário de login encontrado, preenchendo...");
            await usernameField.click({ clickCount: 3 });
            await usernameField.type(login, { delay: 50 });
            await passwordField.click({ clickCount: 3 });
            await passwordField.type(senha, { delay: 50 });

            // Clicar botão de login
            const loginBtn = await page.$('input[type="submit"], button[type="submit"], #btnEntrar, .btn-login');
            if (loginBtn) {
              await loginBtn.click();
              await page.waitForTimeout(5000);
            }

            // Verificar se logou (ausência de formulário de login)
            const stillLogin = await page.$('input[name="username"], #username');
            resultado.loginSucesso = !stillLogin;
            console.log("[PJe] Login sucesso:", resultado.loginSucesso);
          } else {
            console.log("[PJe] Formulário de login não encontrado - pode ter CAPTCHA ou certificado obrigatório");
            
            // Verificar CAPTCHA
            const captcha = await page.$('.g-recaptcha, #captcha, [data-sitekey]');
            if (captcha) {
              resultado.erro = "CAPTCHA detectado no portal. Login com certificado A1 é recomendado.";
              return resultado;
            }
          }

          // 3. Navegar para o processo
          if (resultado.loginSucesso) {
            console.log("[PJe] Buscando processo:", numeroProcesso);
            
            // Tentar consulta processual
            const consultaUrl = baseUrl + "/consultaprocessual/detalhe-processo/" + numeroProcesso;
            await page.goto(consultaUrl, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            await page.waitForTimeout(3000);
            resultado.paginaProcesso = true;

            // 4. Extrair lista de documentos/autos
            const docs = await page.evaluate(() => {
              const documentos = [];
              
              // Seletores comuns do PJe para documentos
              const selectors = [
                'a[href*="documento"]',
                'a[href*="download"]',
                'a[href*="binario"]',
                '.documentoLink a',
                '.arquivo a',
                'table.documentos a',
                '#divDocumentos a',
                '.lista-documentos a',
                'a[onclick*="documento"]',
              ];
              
              for (const sel of selectors) {
                const links = document.querySelectorAll(sel);
                links.forEach((link) => {
                  const href = link.getAttribute("href") || "";
                  const onclick = link.getAttribute("onclick") || "";
                  const nome = (link.textContent || "").trim();
                  
                  if (nome && (href || onclick)) {
                    documentos.push({
                      nome: nome.substring(0, 200),
                      url: href,
                      onclick: onclick.substring(0, 500),
                      tipo: nome.toLowerCase().includes("sentença") ? "sentenca" :
                            nome.toLowerCase().includes("despacho") ? "despacho" :
                            nome.toLowerCase().includes("petição") ? "peticao" :
                            nome.toLowerCase().includes("certidão") ? "certidao" :
                            nome.toLowerCase().includes("decisão") ? "decisao" :
                            nome.toLowerCase().includes("ata") ? "ata" : "auto",
                    });
                  }
                });
              }
              
              // Deduplicar por nome
              const seen = new Set();
              return documentos.filter(d => {
                if (seen.has(d.nome)) return false;
                seen.add(d.nome);
                return true;
              }).slice(0, 50); // Máximo 50 docs
            });

            resultado.documentos = docs;
            console.log("[PJe] Documentos encontrados:", docs.length);
          }

        } catch (error) {
          console.error("[PJe] Erro:", error.message);
          resultado.erro = error.message;
        }

        return resultado;
      };
    `;

    // Executar no Browserless
    console.log("[baixar-autos-pje] Executando Puppeteer no Browserless...");
    const browserlessResponse = await fetch(
      `https://chrome.browserless.io/function?token=${browserlessApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: puppeteerCode,
          context: {
            baseUrl,
            numeroProcesso: numeroLimpo,
            login: credencial.login,
            senha: credencial.senha_hash,
            temCert: temCertificado,
            certB64: certBase64,
            certSenha: credencial.certificado_a1_senha,
          },
        }),
      }
    );

    if (!browserlessResponse.ok) {
      const errText = await browserlessResponse.text();
      console.error("[baixar-autos-pje] Browserless error:", errText);
      throw new Error(`Erro no Browserless: ${browserlessResponse.status}`);
    }

    const resultado = await browserlessResponse.json();
    console.log("[baixar-autos-pje] Resultado:", JSON.stringify(resultado).substring(0, 500));

    if (resultado.erro) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: resultado.erro,
          documentos_baixados: 0,
          documentos_total: 0,
          documentos: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Salvar referências dos documentos encontrados no banco
    const docsParaSalvar = resultado.documentos || [];
    const docsSalvos = [];

    for (const doc of docsParaSalvar) {
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

    // Atualizar status da credencial
    await supabase.from("cofre_senhas").update({
      status_validacao: resultado.loginSucesso ? "valido" : "acessivel",
      mensagem_erro: null,
      ultima_validacao: new Date().toISOString(),
    }).eq("id", cofre_senha_id);

    return new Response(
      JSON.stringify({
        sucesso: true,
        login_sucesso: resultado.loginSucesso,
        pagina_processo: resultado.paginaProcesso,
        documentos_baixados: docsSalvos.length,
        documentos_total: docsParaSalvar.length,
        documentos: docsSalvos,
        mensagem: resultado.loginSucesso
          ? `Login realizado com sucesso. ${docsSalvos.length} documento(s) encontrado(s).`
          : `Portal acessível. ${docsSalvos.length} documento(s) encontrado(s) na consulta pública.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[baixar-autos-pje] Erro geral:", error);
    const msg = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ sucesso: false, erro: msg, documentos_baixados: 0, documentos_total: 0, documentos: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
