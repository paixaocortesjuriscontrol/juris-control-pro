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
  modo?: "consulta_publica" | "login_certificado";
}

const MAX_TENTATIVAS = 3;
const BLOQUEIO_HORAS = 1;

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

function detectarTribunal(numero: string): string {
  const match = numero.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (!match) return "TRT10";
  const justica = match[1];
  const tribunal = match[2];
  if (justica === "5") return `TRT${parseInt(tribunal)}`;
  if (justica === "8" && tribunal === "07") return "TJDFT";
  return `TRT${parseInt(tribunal)}`;
}

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
  const linkRegex = /<a[^>]*href=["']([^"']*(?:documento|download|binario|anexo)[^"']*)["'][^>]*>([^<]*)<\/a>/gi;
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

// ============================================================
// Verificar se credencial está bloqueada
// ============================================================
async function verificarBloqueio(supabase: any, credencialId: string): Promise<{ bloqueada: boolean; minutos_restantes: number }> {
  const { data } = await supabase
    .from("cofre_senhas")
    .select("tentativas_falhas, bloqueado_ate")
    .eq("id", credencialId)
    .single();

  if (!data) return { bloqueada: false, minutos_restantes: 0 };

  if (data.bloqueado_ate) {
    const bloqueadoAte = new Date(data.bloqueado_ate);
    const agora = new Date();
    if (bloqueadoAte > agora) {
      const diffMs = bloqueadoAte.getTime() - agora.getTime();
      return { bloqueada: true, minutos_restantes: Math.ceil(diffMs / 60000) };
    }
    // Bloqueio expirou, resetar
    await supabase
      .from("cofre_senhas")
      .update({ tentativas_falhas: 0, bloqueado_ate: null })
      .eq("id", credencialId);
  }

  return { bloqueada: false, minutos_restantes: 0 };
}

// ============================================================
// Registrar tentativa falhada
// ============================================================
async function registrarFalha(supabase: any, credencialId: string): Promise<{ bloqueada: boolean; tentativas: number }> {
  const { data } = await supabase
    .from("cofre_senhas")
    .select("tentativas_falhas")
    .eq("id", credencialId)
    .single();

  const tentativas = (data?.tentativas_falhas || 0) + 1;
  const updateData: any = {
    tentativas_falhas: tentativas,
    ultimo_erro_login: new Date().toISOString(),
    status_validacao: "erro",
    mensagem_erro: `Falha de login (${tentativas}/${MAX_TENTATIVAS})`,
  };

  if (tentativas >= MAX_TENTATIVAS) {
    const bloqueadoAte = new Date();
    bloqueadoAte.setHours(bloqueadoAte.getHours() + BLOQUEIO_HORAS);
    updateData.bloqueado_ate = bloqueadoAte.toISOString();
    updateData.mensagem_erro = `Credencial bloqueada até ${bloqueadoAte.toLocaleString("pt-BR")} após ${tentativas} falhas`;
  }

  await supabase.from("cofre_senhas").update(updateData).eq("id", credencialId);

  return { bloqueada: tentativas >= MAX_TENTATIVAS, tentativas };
}

// ============================================================
// Registrar sucesso de login
// ============================================================
async function registrarSucesso(supabase: any, credencialId: string): Promise<void> {
  await supabase
    .from("cofre_senhas")
    .update({
      tentativas_falhas: 0,
      bloqueado_ate: null,
      ultimo_erro_login: null,
      status_validacao: "valido",
      mensagem_erro: null,
      ultima_validacao: new Date().toISOString(),
    })
    .eq("id", credencialId);
}

// ============================================================
// Login via Browserless /function (Puppeteer)
// ============================================================
async function loginPjeComCertificado(
  browserlessApiKey: string,
  baseUrl: string,
  login: string,
  senha: string,
  processoNumero: string,
): Promise<{ sucesso: boolean; html: string; erro?: string }> {
  const numeroDigitos = processoNumero.replace(/[^0-9]/g, "");

  const puppeteerCode = `
    module.exports = async ({ page }) => {
      const baseUrl = "${baseUrl}";
      const loginUrl = baseUrl + "/loginToken.seam";
      const processoUrl = baseUrl + "/painel/usuario/processosNaoLidos.seam";
      
      try {
        // 1. Navegar para login
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('input[name*="username"], input[id*="username"], #username', { timeout: 10000 }).catch(() => {});
        
        // 2. Preencher credenciais
        const usernameSelectors = ['input[name*="username"]', 'input[id*="username"]', '#username', 'input[type="text"]'];
        const passwordSelectors = ['input[name*="password"]', 'input[id*="password"]', '#password', 'input[type="password"]'];
        
        let usernameField = null;
        for (const sel of usernameSelectors) {
          usernameField = await page.$(sel);
          if (usernameField) break;
        }
        
        let passwordField = null;
        for (const sel of passwordSelectors) {
          passwordField = await page.$(sel);
          if (passwordField) break;
        }
        
        if (!usernameField || !passwordField) {
          return { sucesso: false, html: '', erro: 'Campos de login não encontrados no portal do PJe' };
        }
        
        await usernameField.click({ clickCount: 3 });
        await usernameField.type("${login}", { delay: 50 });
        await passwordField.click({ clickCount: 3 });
        await passwordField.type("${senha}", { delay: 50 });
        
        // 3. Submeter
        const submitSelectors = ['button[type="submit"]', 'input[type="submit"]', '#btnEntrar', '.btn-entrar', 'button.btn-primary'];
        let submitBtn = null;
        for (const sel of submitSelectors) {
          submitBtn = await page.$(sel);
          if (submitBtn) break;
        }
        
        if (submitBtn) {
          await submitBtn.click();
        } else {
          await passwordField.press('Enter');
        }
        
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        
        // 4. Verificar se login funcionou
        const currentUrl = page.url();
        const pageContent = await page.content();
        
        const erroIndicadores = ['senha inválida', 'credenciais', 'login incorreto', 'acesso negado', 'bloqueado', 'tentativas'];
        const textoLower = pageContent.toLowerCase();
        
        for (const indicador of erroIndicadores) {
          if (textoLower.includes(indicador)) {
            return { sucesso: false, html: '', erro: 'Login falhou: ' + indicador };
          }
        }
        
        if (currentUrl.includes('login') && !currentUrl.includes('painel')) {
          return { sucesso: false, html: '', erro: 'Login não redirecionou para o painel' };
        }
        
        // 5. Navegar para o processo
        const consultaUrl = baseUrl + "/consultaprocessual/detalhe-processo/${numeroDigitos}";
        await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Esperar documentos carregarem
        await page.waitForSelector('a[href*="documento"], a[href*="download"], a[href*="binario"], .documentoLink, #divDocumentos', { timeout: 15000 }).catch(() => {});
        
        const html = await page.content();
        return { sucesso: true, html };
        
      } catch (err) {
        return { sucesso: false, html: '', erro: err.message || 'Erro no login' };
      }
    };
  `;

  try {
    const response = await fetch(
      `https://chrome.browserless.io/function?token=${browserlessApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: puppeteerCode,
          context: {},
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[baixar-autos-pje] Browserless /function error:", errText);
      return { sucesso: false, html: "", erro: `Erro Browserless: ${response.status}` };
    }

    const result = await response.json();
    return result;
  } catch (err: any) {
    console.error("[baixar-autos-pje] Browserless fetch error:", err);
    return { sucesso: false, html: "", erro: err.message || "Erro de conexão com Browserless" };
  }
}

// ============================================================
// Consulta pública (sem login)
// ============================================================
async function consultaPublica(
  browserlessApiKey: string,
  baseUrl: string,
  consultaUrl: string,
): Promise<Array<{ nome: string; url: string; tipo: string }>> {
  let docs: Array<{ nome: string; url: string; tipo: string }> = [];

  try {
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
            { selector: "body" },
          ],
          waitForSelector: { selector: "body", timeout: 15000 },
          gotoOptions: { waitUntil: "domcontentloaded", timeout: 30000 },
        }),
      }
    );

    if (scrapeResponse.ok) {
      const scrapeData = await scrapeResponse.json();
      const results = scrapeData?.data || [];

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

      if (docs.length === 0 && results[1]?.results?.length > 0) {
        const bodyHtml = results[1].results[0]?.html || "";
        if (bodyHtml.length > 100) {
          docs = extrairDocumentosDoHtml(bodyHtml, baseUrl);
        }
      }
    }
  } catch (err) {
    console.error("[baixar-autos-pje] Consulta pública error:", err);
  }

  return docs;
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
    const { cofre_senha_id, processo_numero, processo_id, tribunal, modo } = body;

    if (!cofre_senha_id || !processo_numero) {
      return new Response(
        JSON.stringify({ error: "cofre_senha_id e processo_numero são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modoEfetivo = modo || "consulta_publica";

    // Determinar tribunal
    const tribunalKey = tribunal
      ? tribunal.toUpperCase().replace(/[^A-Z0-9]/g, "")
      : detectarTribunal(processo_numero);
    const baseUrl = PJE_URLS[tribunalKey] || PJE_URLS["TRT10"];
    const numeroLimpo = processo_numero.replace(/[^0-9.-]/g, "");
    const numeroDigitos = processo_numero.replace(/[^0-9]/g, "");

    // Buscar credencial
    const { data: credencial, error: credError } = await supabase
      .from("cofre_senhas")
      .select("id, nome, tribunal, sistema, login, senha_hash, tentativas_falhas, bloqueado_ate")
      .eq("id", cofre_senha_id)
      .single();

    if (credError || !credencial) {
      return new Response(
        JSON.stringify({ error: "Credencial não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let docs: Array<{ nome: string; url: string; tipo: string }> = [];
    let loginUtilizado = false;
    let loginSucesso = false;

    if (modoEfetivo === "login_certificado") {
      // ============================================================
      // MODO LOGIN COM CONTROLE DE TENTATIVAS
      // ============================================================

      // 1. Verificar bloqueio
      const bloqueio = await verificarBloqueio(supabase, cofre_senha_id);
      if (bloqueio.bloqueada) {
        return new Response(
          JSON.stringify({
            sucesso: false,
            bloqueada: true,
            minutos_restantes: bloqueio.minutos_restantes,
            erro: `Credencial temporariamente bloqueada. Tente novamente em ${bloqueio.minutos_restantes} minuto(s).`,
            documentos_baixados: 0,
            documentos_total: 0,
            documentos: [],
            modo: "bloqueado",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[baixar-autos-pje] Modo: LOGIN COM CERTIFICADO`);
      console.log(`[baixar-autos-pje] Tribunal: ${tribunalKey}, Tentativas anteriores: ${credencial.tentativas_falhas}/${MAX_TENTATIVAS}`);

      // 2. Tentar login via Browserless
      loginUtilizado = true;
      const resultadoLogin = await loginPjeComCertificado(
        browserlessApiKey,
        baseUrl,
        credencial.login,
        credencial.senha_hash,
        processo_numero,
      );

      if (!resultadoLogin.sucesso) {
        // Login falhou - registrar falha
        const falha = await registrarFalha(supabase, cofre_senha_id);
        const tentativasRestantes = MAX_TENTATIVAS - falha.tentativas;

        return new Response(
          JSON.stringify({
            sucesso: false,
            login_sucesso: false,
            bloqueada: falha.bloqueada,
            tentativas_restantes: Math.max(tentativasRestantes, 0),
            minutos_restantes: falha.bloqueada ? BLOQUEIO_HORAS * 60 : 0,
            erro: falha.bloqueada
              ? `Login falhou e credencial foi bloqueada por ${BLOQUEIO_HORAS}h. Motivo: ${resultadoLogin.erro}`
              : `Login falhou (${falha.tentativas}/${MAX_TENTATIVAS}). ${tentativasRestantes} tentativa(s) restante(s). Motivo: ${resultadoLogin.erro}`,
            documentos_baixados: 0,
            documentos_total: 0,
            documentos: [],
            modo: "login_falhou",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Login sucesso - resetar tentativas
      loginSucesso = true;
      await registrarSucesso(supabase, cofre_senha_id);
      console.log(`[baixar-autos-pje] Login bem-sucedido!`);

      // Extrair documentos do HTML autenticado
      if (resultadoLogin.html) {
        docs = extrairDocumentosDoHtml(resultadoLogin.html, baseUrl);
      }
    } else {
      // ============================================================
      // MODO CONSULTA PÚBLICA (sem login)
      // ============================================================
      console.log(`[baixar-autos-pje] Modo: CONSULTA PÚBLICA (sem login)`);
      const consultaUrl = `${baseUrl}/consultaprocessual/detalhe-processo/${numeroDigitos}`;
      docs = await consultaPublica(browserlessApiKey, baseUrl, consultaUrl);
    }

    // Deduplicar
    const seen = new Set<string>();
    const docsUnicos = docs.filter((d) => {
      const key = d.nome.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 50);

    console.log(`[baixar-autos-pje] Documentos encontrados: ${docsUnicos.length}`);

    // Salvar documentos
    const docsSalvos = [];
    for (const doc of docsUnicos) {
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
          docsSalvos.push({ id: saved.id, nome: doc.nome, tipo: doc.tipo, url: doc.url, status: "encontrado" });
        }
      } catch (e) {
        console.error("[baixar-autos-pje] Erro ao salvar doc:", e);
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        login_utilizado: loginUtilizado,
        login_sucesso: loginSucesso,
        modo: modoEfetivo,
        documentos_baixados: docsSalvos.length,
        documentos_total: docsUnicos.length,
        documentos: docsSalvos,
        mensagem: docsUnicos.length > 0
          ? `${docsSalvos.length} documento(s) encontrado(s)${loginUtilizado ? " via login autenticado" : " via consulta pública"}.`
          : loginUtilizado
            ? "Login realizado com sucesso, mas nenhum documento encontrado para este processo."
            : "Consulta pública realizada. Nenhum documento encontrado. Tente usar o modo com login.",
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
