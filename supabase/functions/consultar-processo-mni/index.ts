import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_TENTATIVAS = 3;
const BLOQUEIO_HORAS = 1;

const ENCRYPTION_KEY = Deno.env.get("COFRE_ENCRYPTION_KEY") ?? "";
const N8N_PROXY_URL = Deno.env.get("N8N_PJE_PROXY_URL") ?? "";
const N8N_PROXY_TOKEN = Deno.env.get("N8N_PJE_PROXY_TOKEN") ?? "";

// =========================
// AES-GCM decrypt (igual cofre-senhas / testar-mni)
// =========================
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
  try { return await decrypt(value); } catch { return value; }
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

// ============================================================
// Endpoints MNI 3.0 (pje-integracao-api) — mesmo padrão de testar-mni
// ============================================================
const MNI_ENDPOINTS: Record<string, string> = {
  TST: "https://pje.tst.jus.br/pje-integracao-api/mni300/intercomunicacao",
  STJ: "https://pje.stj.jus.br/pje-integracao-api/mni300/intercomunicacao",
  STF: "https://pje.stf.jus.br/pje-integracao-api/mni300/intercomunicacao",
};
for (let i = 1; i <= 24; i++) {
  MNI_ENDPOINTS[`TRT${i}`] = `https://pje.trt${i}.jus.br/pje-integracao-api/mni300/intercomunicacao`;
}

function resolverSiglaTribunal(numeroCnj: string): string | null {
  const digits = numeroCnj.replace(/\D/g, "");
  if (digits.length !== 20) return null;
  const justica = digits[13];
  const tribunal = digits.slice(14, 16);
  if (justica === "5") {
    const n = parseInt(tribunal, 10);
    if (n >= 1 && n <= 24) return `TRT${n}`;
  }
  return null;
}

// ============================================================
// Construir envelope SOAP para consultarProcesso
// ============================================================
function buildSoapEnvelope(cpf: string, senha: string, numeroProcesso: string, incluirDocumentos: boolean, incluirMovimentos: boolean): string {
  // Remove formatação do CPF
  const cpfLimpo = cpf.replace(/\D/g, "");
  // Remove formatação do número do processo  
  const numLimpo = numeroProcesso.replace(/\D/g, "");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ser="http://www.cnj.jus.br/servico-intercomunicacao-2.2.2/"
                  xmlns:tip="http://www.cnj.jus.br/tipos-servico-intercomunicacao-2.2.2">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:consultarProcesso>
      <tip:idConsultante>${cpfLimpo}</tip:idConsultante>
      <tip:senhaConsultante>${senha}</tip:senhaConsultante>
      <tip:numeroProcesso>${numLimpo}</tip:numeroProcesso>
      <tip:movimentos>${incluirMovimentos}</tip:movimentos>
      <tip:incluirCabecalho>true</tip:incluirCabecalho>
      <tip:incluirDocumentos>${incluirDocumentos}</tip:incluirDocumentos>
    </ser:consultarProcesso>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ============================================================
// Parser XML simples (sem dependência externa)
// ============================================================
function getTagContent(xml: string, tag: string): string {
  // Busca com namespace ou sem
  const patterns = [
    new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:]+:)?${tag}>`, "i"),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    if (m) return m[1].trim();
  }
  return "";
}

function getAllTagContents(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:]+:)?${tag}>`, "gi");
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function getAttr(xml: string, attr: string): string {
  const re = new RegExp(`${attr}=["']([^"']*)["']`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}

// ============================================================
// Extrair dados estruturados do XML de resposta MNI
// ============================================================
interface ParteMni {
  nome: string;
  documento: string;
  tipoPessoa: string;
  polo: string;
  advogados: Array<{ nome: string; inscricao: string }>;
}

interface DocumentoMni {
  idDocumento: string;
  tipo: string;
  descricao: string;
  dataJuntada: string;
  mimetype: string;
}

interface MovimentacaoMni {
  data: string;
  descricao: string;
  codigo: string;
  complementos: string[];
}

interface ResultadoMni {
  sucesso: boolean;
  origem: string;
  dadosBasicos: {
    numero: string;
    classe: string;
    assuntos: string[];
    valorCausa: number;
    orgaoJulgador: string;
    dataAjuizamento: string;
  };
  partes: ParteMni[];
  documentos: DocumentoMni[];
  movimentacoes: MovimentacaoMni[];
  mensagem?: string;
  erro?: string;
}

function parseMniResponse(xml: string): ResultadoMni {
  // Verificar erro SOAP
  const faultString = getTagContent(xml, "faultstring");
  if (faultString) {
    return {
      sucesso: false,
      origem: "mni",
      dadosBasicos: { numero: "", classe: "", assuntos: [], valorCausa: 0, orgaoJulgador: "", dataAjuizamento: "" },
      partes: [],
      documentos: [],
      movimentacoes: [],
      erro: faultString,
    };
  }

  // Dados básicos
  const processo = getTagContent(xml, "processo") || xml;
  const dadosBasicos = getTagContent(processo, "dadosBasicos") || processo;

  const numero = getTagContent(dadosBasicos, "numero") || getAttr(dadosBasicos, "numero");
  const classe = getTagContent(dadosBasicos, "classeProcessual") || getTagContent(dadosBasicos, "descricao");
  const valorCausaStr = getTagContent(dadosBasicos, "valorCausa") || "0";
  const orgaoJulgador = getTagContent(dadosBasicos, "nomeOrgao") || getTagContent(dadosBasicos, "orgaoJulgador");
  const dataAjuizamento = getTagContent(dadosBasicos, "dataAjuizamento") || "";

  // Assuntos
  const assuntosXml = getAllTagContents(dadosBasicos, "assunto");
  const assuntos = assuntosXml
    .map((a) => getTagContent(a, "descricao") || a)
    .filter(Boolean);

  // Partes (polos)
  const polosXml = getAllTagContents(processo, "polo");
  const partes: ParteMni[] = [];

  for (const poloXml of polosXml) {
    const tipoPolo = getAttr(poloXml, "polo") || getTagContent(poloXml, "polo");
    const partesDoPoloXml = getAllTagContents(poloXml, "parte");

    for (const parteXml of partesDoPoloXml) {
      const pessoa = getTagContent(parteXml, "pessoa") || parteXml;
      const nome = getTagContent(pessoa, "nome") || getAttr(pessoa, "nome") || "";
      const documento = getTagContent(pessoa, "numeroDocumentoPrincipal") || getTagContent(pessoa, "documento") || "";
      const tipoPessoa = getAttr(pessoa, "tipoPessoa") || getTagContent(pessoa, "tipoPessoa") || "";

      // Advogados da parte
      const advsXml = getAllTagContents(parteXml, "advogado");
      const advogados = advsXml.map((adv) => ({
        nome: getTagContent(adv, "nome") || getAttr(adv, "nome") || "",
        inscricao: getTagContent(adv, "inscricao") || getTagContent(adv, "numeroOAB") || "",
      }));

      partes.push({
        nome,
        documento,
        tipoPessoa,
        polo: tipoPolo.toUpperCase().includes("AT") ? "ativo" : "passivo",
        advogados,
      });
    }
  }

  // Documentos
  const docsXml = getAllTagContents(processo, "documento");
  const documentos: DocumentoMni[] = docsXml.map((docXml) => ({
    idDocumento: getTagContent(docXml, "idDocumento") || getAttr(docXml, "idDocumento") || "",
    tipo: getTagContent(docXml, "tipoDocumento") || getTagContent(docXml, "descricao") || "",
    descricao: getTagContent(docXml, "descricao") || "",
    dataJuntada: getTagContent(docXml, "dataHora") || "",
    mimetype: getTagContent(docXml, "mimetype") || getAttr(docXml, "mimetype") || "application/pdf",
  })).filter((d) => d.idDocumento || d.tipo);

  // Movimentações
  const movsXml = getAllTagContents(processo, "movimento");
  const movimentacoes: MovimentacaoMni[] = movsXml.map((movXml) => {
    const complementosXml = getAllTagContents(movXml, "complemento");
    return {
      data: getTagContent(movXml, "dataHora") || getAttr(movXml, "dataHora") || "",
      descricao: getTagContent(movXml, "descricao") || "",
      codigo: getTagContent(movXml, "movimentoNacional") || getAttr(movXml, "codigoNacional") || "",
      complementos: complementosXml.map((c) => getTagContent(c, "descricao") || c).filter(Boolean),
    };
  });

  const sucesso = partes.length > 0 || documentos.length > 0 || numero !== "";

  return {
    sucesso,
    origem: "mni",
    dadosBasicos: {
      numero,
      classe,
      assuntos,
      valorCausa: parseFloat(valorCausaStr) || 0,
      orgaoJulgador,
      dataAjuizamento,
    },
    partes,
    documentos,
    movimentacoes,
    mensagem: sucesso
      ? `Encontrado: ${partes.length} parte(s), ${documentos.length} documento(s), ${movimentacoes.length} movimentação(ões)`
      : undefined,
  };
}

// ============================================================
// Controle de tentativas (mesmo padrão do baixar-autos-pje)
// ============================================================
async function verificarBloqueio(supabase: any, credId: string) {
  const { data } = await supabase
    .from("cofre_senhas")
    .select("tentativas_falhas, bloqueado_ate")
    .eq("id", credId)
    .single();

  if (!data) return { bloqueada: false, minutos: 0 };

  if (data.bloqueado_ate) {
    const ate = new Date(data.bloqueado_ate);
    if (ate > new Date()) {
      return { bloqueada: true, minutos: Math.ceil((ate.getTime() - Date.now()) / 60000) };
    }
    await supabase
      .from("cofre_senhas")
      .update({ tentativas_falhas: 0, bloqueado_ate: null })
      .eq("id", credId);
  }
  return { bloqueada: false, minutos: 0 };
}

async function registrarFalha(supabase: any, credId: string) {
  const { data } = await supabase
    .from("cofre_senhas")
    .select("tentativas_falhas")
    .eq("id", credId)
    .single();

  const t = (data?.tentativas_falhas || 0) + 1;
  const upd: any = {
    tentativas_falhas: t,
    ultimo_erro_login: new Date().toISOString(),
    status_validacao: "erro",
    mensagem_erro: `Falha MNI (${t}/${MAX_TENTATIVAS})`,
  };

  if (t >= MAX_TENTATIVAS) {
    const ate = new Date();
    ate.setHours(ate.getHours() + BLOQUEIO_HORAS);
    upd.bloqueado_ate = ate.toISOString();
    upd.mensagem_erro = `Bloqueada até ${ate.toLocaleString("pt-BR")} após ${t} falhas MNI`;
  }

  await supabase.from("cofre_senhas").update(upd).eq("id", credId);
  return { bloqueada: t >= MAX_TENTATIVAS, tentativas: t };
}

async function registrarSucesso(supabase: any, credId: string) {
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
    .eq("id", credId);
}

// ============================================================
// Handler principal
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Validar JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Token inválido" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { cofre_senha_id, processo_numero, incluir_documentos = true, incluir_movimentos = true } = body;

    if (!cofre_senha_id || !processo_numero) {
      return new Response(
        JSON.stringify({ error: "cofre_senha_id e processo_numero são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Resolver endpoint MNI
    const sigla = resolverSiglaTribunal(processo_numero);
    const endpoint = sigla ? MNI_ENDPOINTS[sigla] : null;
    if (!sigla || !endpoint) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: "Tribunal não suportado pela API MNI. Número CNJ inválido ou tribunal sem endpoint MNI configurado.",
          origem: "mni",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[consultar-processo-mni] Tribunal: ${sigla}, Endpoint: ${endpoint}`);

    // 2. Buscar credencial (com cert A1 e ownership)
    const { data: credencial, error: credErr } = await supabase
      .from("cofre_senhas")
      .select("id, login, senha_hash, usuario_id, certificado_a1_path, certificado_a1_senha, tentativas_falhas, bloqueado_ate")
      .eq("id", cofre_senha_id)
      .single();

    if (credErr || !credencial) {
      return new Response(
        JSON.stringify({ error: "Credencial não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (credencial.usuario_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verificar bloqueio
    const bloqueio = await verificarBloqueio(supabase, cofre_senha_id);
    if (bloqueio.bloqueada) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          bloqueada: true,
          minutos_restantes: bloqueio.minutos,
          erro: `Credencial bloqueada. Tente novamente em ${bloqueio.minutos} minuto(s).`,
          origem: "mni",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validar proxy n8n (Edge Function não faz mTLS — precisa do VPS com PFX)
    if (!N8N_PROXY_URL || !N8N_PROXY_TOKEN) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: "Proxy n8n não configurado (N8N_PJE_PROXY_URL / N8N_PJE_PROXY_TOKEN ausentes).",
          origem: "mni",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Baixar certificado A1 (.pfx) do Storage se houver
    let pfxBase64: string | null = null;
    let pfxPassword: string | null = null;
    if (credencial.certificado_a1_path) {
      const { data: pfxFile, error: pfxError } = await supabase.storage
        .from("cofre_certificados")
        .download(credencial.certificado_a1_path);
      if (pfxError || !pfxFile) {
        return new Response(
          JSON.stringify({
            sucesso: false,
            erro: "Falha ao baixar certificado A1 do storage",
            detalhes: pfxError?.message,
            origem: "mni",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const pfxBuffer = await pfxFile.arrayBuffer();
      pfxBase64 = arrayBufferToBase64(pfxBuffer);
      pfxPassword = await decryptSafe(credencial.certificado_a1_senha);
    }

    // 6. Decriptar senha do login e montar SOAP
    const senhaPlain = await decryptSafe(credencial.senha_hash);
    if (!senhaPlain) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Senha do cofre vazia", origem: "mni" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const soapBody = buildSoapEnvelope(
      credencial.login,
      senhaPlain,
      processo_numero,
      incluir_documentos,
      incluir_movimentos
    );

    // 7. Enviar via proxy n8n (mTLS com PFX)
    console.log(`[consultar-processo-mni] POST via n8n proxy -> ${endpoint}`);
    const proxyController = new AbortController();
    const proxyTimeout = setTimeout(() => proxyController.abort(), 55000);

    let httpStatus = 0;
    let responseText = "";
    try {
      const proxyResp = await fetch(N8N_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Proxy-Token": N8N_PROXY_TOKEN,
        },
        body: JSON.stringify({
          endpoint,
          soap_action: "consultarProcesso",
          soap_body: soapBody,
          pfx_base64: pfxBase64,
          pfx_password: pfxPassword,
          timeout_ms: 45000,
        }),
        signal: proxyController.signal,
      });
      clearTimeout(proxyTimeout);

      if (!proxyResp.ok) {
        const errText = await proxyResp.text();
        return new Response(
          JSON.stringify({
            sucesso: false,
            erro: `Proxy n8n retornou HTTP ${proxyResp.status}`,
            detalhes: errText.slice(0, 500),
            origem: "mni",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const proxyJson = await proxyResp.json();
      httpStatus = proxyJson.status ?? proxyJson.http_status ?? 0;
      responseText = proxyJson.body ?? proxyJson.data ?? "";
    } catch (proxyErr: any) {
      clearTimeout(proxyTimeout);
      console.error("[consultar-processo-mni] Erro proxy n8n:", proxyErr);
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: "Falha ao contatar proxy n8n",
          detalhes: String(proxyErr?.message || proxyErr),
          origem: "mni",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (httpStatus < 200 || httpStatus >= 300) {
      console.error(`[consultar-processo-mni] HTTP ${httpStatus}: ${responseText.slice(0, 500)}`);

      // Verificar se é erro de autenticação
      const isAuthError =
        responseText.toLowerCase().includes("senha") ||
        responseText.toLowerCase().includes("autenticação") ||
        responseText.toLowerCase().includes("credenciais") ||
        responseText.toLowerCase().includes("unauthorized") ||
        httpStatus === 401 ||
        httpStatus === 403;

      if (isAuthError) {
        const falha = await registrarFalha(supabase, cofre_senha_id);
        return new Response(
          JSON.stringify({
            sucesso: false,
            login_sucesso: false,
            bloqueada: falha.bloqueada,
            tentativas_restantes: Math.max(MAX_TENTATIVAS - falha.tentativas, 0),
            erro: falha.bloqueada
              ? `Credencial bloqueada por ${BLOQUEIO_HORAS}h após ${falha.tentativas} falhas.`
              : `Autenticação falhou (${falha.tentativas}/${MAX_TENTATIVAS}).`,
            origem: "mni",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: `Tribunal retornou HTTP ${httpStatus}. O serviço MNI pode estar temporariamente indisponível.`,
          origem: "mni",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Parsear resposta
    const resultado = parseMniResponse(responseText);

    if (resultado.sucesso) {
      await registrarSucesso(supabase, cofre_senha_id);
    } else if (resultado.erro) {
      // Verificar se o erro no SOAP indica auth failure
      const erroLower = resultado.erro.toLowerCase();
      if (erroLower.includes("senha") || erroLower.includes("credencial") || erroLower.includes("autenticação")) {
        const falha = await registrarFalha(supabase, cofre_senha_id);
        resultado.erro = falha.bloqueada
          ? `Credencial bloqueada por ${BLOQUEIO_HORAS}h. ${resultado.erro}`
          : `${resultado.erro} (${falha.tentativas}/${MAX_TENTATIVAS})`;
      }
    }

    console.log(`[consultar-processo-mni] Resultado: sucesso=${resultado.sucesso}, partes=${resultado.partes.length}, docs=${resultado.documentos.length}`);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[consultar-processo-mni] Erro:", err);
    return new Response(
      JSON.stringify({ sucesso: false, erro: err.message || "Erro interno", origem: "mni" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
