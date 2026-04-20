import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ENCRYPTION_KEY = Deno.env.get("COFRE_ENCRYPTION_KEY") ?? "";
const N8N_PROXY_URL = Deno.env.get("N8N_PJE_PROXY_URL") ?? "";
const N8N_PROXY_TOKEN = Deno.env.get("N8N_PJE_PROXY_TOKEN") ?? "";

// Credencial fixa de teste (Paixão Cortes - TST - Osmar A1)
const FIXED_COFRE_ID = "20531186-32eb-4e07-8b48-59c2a2f5e6fc";
const MNI_ENDPOINTS: Record<string, string> = {
  TST: "https://pje.tst.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT1: "https://pje.trt1.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT2: "https://pje.trt2.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT3: "https://pje.trt3.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT4: "https://pje.trt4.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT5: "https://pje.trt5.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT6: "https://pje.trt6.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT7: "https://pje.trt7.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT8: "https://pje.trt8.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT9: "https://pje.trt9.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT10: "https://pje.trt10.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT11: "https://pje.trt11.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT12: "https://pje.trt12.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT13: "https://pje.trt13.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT14: "https://pje.trt14.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT15: "https://pje.trt15.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT16: "https://pje.trt16.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT17: "https://pje.trt17.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT18: "https://pje.trt18.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT19: "https://pje.trt19.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT20: "https://pje.trt20.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT21: "https://pje.trt21.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT22: "https://pje.trt22.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT23: "https://pje.trt23.jus.br/pje-integracao-api/mni300/intercomunicacao",
  TRT24: "https://pje.trt24.jus.br/pje-integracao-api/mni300/intercomunicacao",
};

// ============ Utilitários de cripto ============
async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret.padEnd(32, "0").slice(0, 32)),
    "AES-GCM",
    false,
    ["decrypt"]
  );
}

async function decrypt(ciphertext: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const key = await deriveKey(ENCRYPTION_KEY);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}

async function decryptSafe(value: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    return await decrypt(value);
  } catch {
    return value;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    );
  }
  return btoa(binary);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============ XML helpers ============
function getTagContent(xml: string, tag: string): string {
  const patterns = [
    new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:]+:)?${tag}>`, "i"),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m) return m[1].trim();
  }
  return "";
}

function getAllTagContents(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:]+:)?${tag}>`, "gi");
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

function getAttr(xml: string, attr: string): string {
  const m = xml.match(new RegExp(`${attr}="([^"]*)"`, "i"));
  return m ? m[1] : "";
}

function limparNumeroProcesso(numero: string): string {
  return numero.replace(/\D/g, "").padStart(20, "0");
}

function extrairTribunalDoProcesso(numeroProcesso: string): string | null {
  const numeroLimpo = limparNumeroProcesso(numeroProcesso);
  if (numeroLimpo.length !== 20) return null;

  const segmentoJustica = numeroLimpo.charAt(13);
  const tribunal = numeroLimpo.substring(14, 16).replace(/^0+/, "") || "0";

  if (segmentoJustica !== "5") return null;
  return tribunal === "0" ? "TST" : `TRT${tribunal}`;
}

// ============ SOAP envelope ============
function buildSoapConsultarProcesso(login: string, senha: string, numeroProcesso: string): string {
  const numLimpo = numeroProcesso.replace(/\D/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ser="http://www.cnj.jus.br/servico-intercomunicacao-2.2.2/"
                  xmlns:tip="http://www.cnj.jus.br/tipos-servico-intercomunicacao-2.2.2">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:consultarProcesso>
      <tip:idConsultante>${escapeXml(login)}</tip:idConsultante>
      <tip:senhaConsultante>${escapeXml(senha)}</tip:senhaConsultante>
      <tip:numeroProcesso>${numLimpo}</tip:numeroProcesso>
      <tip:movimentos>true</tip:movimentos>
      <tip:incluirCabecalho>true</tip:incluirCabecalho>
      <tip:incluirDocumentos>false</tip:incluirDocumentos>
    </ser:consultarProcesso>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ============ Parser MNI -> formato Judit-like ============
function isoToBr(iso: string): string | null {
  if (!iso) return null;
  // dataAjuizamento normalmente vem "20210315103000" (yyyymmddhhmmss) OU "2021-03-15T..."
  let m = iso.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return null;
}

function extrairTurmaERelator(orgaoJulgador: string): { turma: string | null; relator: string | null } {
  if (!orgaoJulgador) return { turma: null, relator: null };
  let turma: string | null = null;
  let relator: string | null = null;

  const mTurma = orgaoJulgador.match(/(\d+)[ªºa]?\s*turma/i);
  if (mTurma) turma = `${mTurma[1]}ª Turma`;
  else if (/sdi|sbdi|se[çc][aã]o|tribunal\s+pleno|[oó]rg[aã]o\s+especial/i.test(orgaoJulgador)) {
    turma = orgaoJulgador;
  }

  const mGab = orgaoJulgador.match(/gabinete\s+d[oa]?\s+(?:ministr[oa]|min\.?|desembargador(?:a)?)\s+(.+?)$/i);
  if (mGab) relator = mGab[1].trim().replace(/[.,;()\-]+$/, "");

  return { turma, relator };
}

interface ParseResult {
  numero: string | null;
  classe: string | null;
  orgao_julgador: string | null;
  data_distribuicao: string | null;
  tribunal: string | null;
  turma: string | null;
  relator: string | null;
  recorrente: string | null;
  reclamante: string | null;
  reclamada: string | null;
  parties_detail: Array<{ nome: string; documento: string | null; tipo_pessoa: string | null; polo: string; is_advogado: boolean }>;
  total_movimentos: number;
}

function parseMniToJuditLike(xml: string, tribunalSigla: string): ParseResult {
  const processo = getTagContent(xml, "processo") || xml;
  const dadosBasicos = getTagContent(processo, "dadosBasicos") || processo;

  const numero = getTagContent(dadosBasicos, "numero") || getAttr(dadosBasicos, "numero") || null;
  const classe = getTagContent(dadosBasicos, "classeProcessual") || null;
  const orgaoJulgador = getTagContent(dadosBasicos, "nomeOrgao") || getTagContent(dadosBasicos, "orgaoJulgador") || null;
  const dataAjuizamentoRaw = getTagContent(dadosBasicos, "dataAjuizamento") || getAttr(dadosBasicos, "dataAjuizamento") || "";
  const dataDistribuicao = isoToBr(dataAjuizamentoRaw);

  const { turma, relator } = extrairTurmaERelator(orgaoJulgador || "");

  // Partes
  const partiesDetail: ParseResult["parties_detail"] = [];
  let reclamante: string | null = null;
  let reclamada: string | null = null;

  const polosXml = getAllTagContents(processo, "polo");
  for (const poloXml of polosXml) {
    const tipoPolo = (getAttr(poloXml, "polo") || getTagContent(poloXml, "polo") || "").toUpperCase();
    const polo = tipoPolo.includes("AT") ? "ATIVO" : "PASSIVO";
    const partesXml = getAllTagContents(poloXml, "parte");

    for (const parteXml of partesXml) {
      const pessoa = getTagContent(parteXml, "pessoa") || parteXml;
      const nome = getTagContent(pessoa, "nome") || getAttr(pessoa, "nome");
      const documento = getTagContent(pessoa, "numeroDocumentoPrincipal") || getTagContent(pessoa, "documento") || null;
      const tipoPessoa = getAttr(pessoa, "tipoPessoa") || getTagContent(pessoa, "tipoPessoa") || null;

      if (nome) {
        partiesDetail.push({ nome, documento, tipo_pessoa: tipoPessoa, polo, is_advogado: false });
        if (polo === "ATIVO" && !reclamante) reclamante = nome;
        if (polo === "PASSIVO" && !reclamada) reclamada = nome;
      }

      const advsXml = getAllTagContents(parteXml, "advogado");
      for (const advXml of advsXml) {
        const nomeAdv = getTagContent(advXml, "nome") || getAttr(advXml, "nome");
        if (nomeAdv) {
          partiesDetail.push({ nome: nomeAdv, documento: null, tipo_pessoa: "FISICA", polo, is_advogado: true });
        }
      }
    }
  }

  const tribunal = tribunalSigla;

  // Recorrente: heurística — se o nome do órgão indica "Vice-Presidência" / recurso, recorrente é o passivo (ativo no recurso)
  // No mínimo, no TST, recorrente costuma ser o reclamante OU reclamada. Sem dados extras, deixamos null.
  const recorrente = null;

  const movsCount = getAllTagContents(processo, "movimento").length;

  return {
    numero,
    classe,
    orgao_julgador: orgaoJulgador,
    data_distribuicao: dataDistribuicao,
    tribunal,
    turma,
    relator,
    recorrente,
    reclamante,
    reclamada,
    parties_detail: partiesDetail,
    total_movimentos: movsCount,
  };
}

// ============ Handler ============
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const numeroProcesso = body?.numero_processo;
    if (!numeroProcesso || typeof numeroProcesso !== "string") {
      return new Response(JSON.stringify({ error: "numero_processo é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar credencial fixa (sem checar ownership — é compartilhada para teste)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: credencial, error: credError } = await supabaseAdmin
      .from("cofre_senhas")
      .select("id, login, senha_hash, certificado_a1_path, certificado_a1_senha")
      .eq("id", FIXED_COFRE_ID)
      .single();

    if (credError || !credencial) {
      return new Response(JSON.stringify({
        error: "Credencial fixa de teste não encontrada no cofre",
        detalhes: credError?.message,
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const login = credencial.login;
    const senha = await decryptSafe(credencial.senha_hash);
    if (!senha) {
      return new Response(JSON.stringify({ error: "Senha do cofre indisponível" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!N8N_PROXY_URL || !N8N_PROXY_TOKEN) {
      return new Response(JSON.stringify({
        error: "Proxy n8n não configurado",
        tipo_erro: "proxy_nao_configurado",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // O proxy n8n agora usa o nó HTTP Request com credencial SSL Certificate
    // configurada diretamente no n8n. Não precisamos mais enviar o PFX no body.
    const tribunalAlvo = extrairTribunalDoProcesso(numeroProcesso);
    if (!tribunalAlvo || !MNI_ENDPOINTS[tribunalAlvo]) {
      return new Response(JSON.stringify({
        error: "Número do processo não pertence à Justiça do Trabalho suportada pelo MNI",
        tipo_erro: "tribunal_nao_suportado",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mniUrl = MNI_ENDPOINTS[tribunalAlvo];
    const soapBody = buildSoapConsultarProcesso(login, senha, numeroProcesso);
    const startTime = Date.now();

    const proxyController = new AbortController();
    const proxyTimeout = setTimeout(() => proxyController.abort(), 60000);

    let proxyHttpStatus = 0;
    let responseText = "";

    try {
      const proxyResponse = await fetch(N8N_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Proxy-Token": N8N_PROXY_TOKEN,
        },
        body: JSON.stringify({
          endpoint: mniUrl,
          soap_action: "consultarProcesso",
          soap_body: soapBody,
          timeout_ms: 55000,
        }),
        signal: proxyController.signal,
      });
      clearTimeout(proxyTimeout);

      if (!proxyResponse.ok) {
        const errText = await proxyResponse.text();
        console.error("[testar-pje-buscar-processo] Proxy HTTP", proxyResponse.status, "body:", errText.substring(0, 2000));
        return new Response(JSON.stringify({
          error: `Proxy n8n retornou HTTP ${proxyResponse.status}`,
          tipo_erro: "proxy_unreachable",
          detalhes: errText.substring(0, 2000),
        }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const proxyJson = await proxyResponse.json();
      proxyHttpStatus = proxyJson.status ?? proxyJson.http_status ?? 0;
      responseText = proxyJson.body ?? proxyJson.data ?? "";
      console.log("[testar-pje-buscar-processo] proxyJson keys:", Object.keys(proxyJson));
      console.log("[testar-pje-buscar-processo] proxyJson preview:", JSON.stringify(proxyJson).substring(0, 1500));
    } catch (proxyErr) {
      clearTimeout(proxyTimeout);
      return new Response(JSON.stringify({
        error: "Falha ao contatar proxy n8n",
        tipo_erro: "proxy_unreachable",
        detalhes: String(proxyErr),
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const elapsedMs = Date.now() - startTime;

    if (!responseText || responseText.trim() === "<xml>...</xml>") {
      return new Response(JSON.stringify({
        error: "O proxy n8n retornou resposta vazia. Verifique se o nó HTTP Request com credencial SSL Certificate está configurado corretamente no workflow.",
        tipo_erro: "proxy_resposta_invalida",
        tempo_ms: elapsedMs,
        tribunal: tribunalAlvo,
        http_status: proxyHttpStatus,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar fault
    const faultMatch = responseText.match(/<(?:[\w:]*)?faultstring[^>]*>([\s\S]*?)<\/(?:[\w:]*)?faultstring>/i);
    if (faultMatch) {
      return new Response(JSON.stringify({
        error: `Erro do PJE: ${faultMatch[1].trim()}`,
        tipo_erro: "pje_fault",
        http_status: proxyHttpStatus,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (proxyHttpStatus < 200 || proxyHttpStatus >= 300) {
      return new Response(JSON.stringify({
        error: `PJE retornou HTTP ${proxyHttpStatus}`,
        tipo_erro: "pje_http_error",
        detalhes: responseText.substring(0, 500),
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = parseMniToJuditLike(responseText, tribunalAlvo);

    if (!parsed.numero) {
      console.log("[testar-pje-buscar-processo] XML sem numero. Primeiros 2000 chars:", responseText.substring(0, 2000));
      return new Response(JSON.stringify({
        error: "Processo não encontrado no PJE TST ou XML sem dados",
        tipo_erro: "processo_nao_encontrado",
        tempo_ms: elapsedMs,
        xml_preview: responseText.substring(0, 1500),
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ...parsed,
      origem: "pje-mni",
      tempo_ms: elapsedMs,
      http_status: proxyHttpStatus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[testar-pje-buscar-processo] Erro:", err);
    return new Response(JSON.stringify({
      error: String(err),
      tipo_erro: "erro_interno",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
