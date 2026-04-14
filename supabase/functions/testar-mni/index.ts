import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ENCRYPTION_KEY = Deno.env.get("COFRE_ENCRYPTION_KEY") ?? "";

// Decrypt AES-GCM (same as cofre-senhas)
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
    return value; // plaintext fallback
  }
}
  // TST
  TST: "https://pje.tst.jus.br/pje-integracao-api/mni300/intercomunicacao",
  // TRTs
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
  // STJ / STF
  STJ: "https://pje.stj.jus.br/pje-integracao-api/mni300/intercomunicacao",
  STF: "https://pje.stf.jus.br/pje-integracao-api/mni300/intercomunicacao",
};

function buildConsultarAvisosPendentesSOAP(
  login: string,
  senha: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:ser="http://www.cnj.jus.br/servico-intercomunicacao-2.2.2">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:consultarAvisosPendentes>
      <ser:idConsultante>${escapeXml(login)}</ser:idConsultante>
      <ser:senhaConsultante>${escapeXml(senha)}</ser:senhaConsultante>
    </ser:consultarAvisosPendentes>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

    // Verify user
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cofre_senha_id } = await req.json();
    if (!cofre_senha_id) {
      return new Response(
        JSON.stringify({ error: "cofre_senha_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get decrypted credentials from cofre-senhas function
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // First get the credential metadata
    const { data: credencial, error: credError } = await supabaseAdmin
      .from("cofre_senhas")
      .select(
        "id, login, sistema, tribunal, certificado_a1_path, usuario_id, senha_hash, certificado_a1_senha"
      )
      .eq("id", cofre_senha_id)
      .single();

    if (credError || !credencial) {
      return new Response(
        JSON.stringify({
          error: "Credencial não encontrada",
          details: credError?.message,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify ownership
    if (credencial.usuario_id !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get decrypted password via cofre-senhas edge function
    const cofreResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/cofre-senhas`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "obter_senha",
          cofre_senha_id,
        }),
      }
    );

    const cofreData = await cofreResponse.json();
    if (!cofreData.success) {
      return new Response(
        JSON.stringify({
          error: "Erro ao obter credenciais do cofre",
          details: cofreData.error,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { login, senha } = cofreData.data;
    const tribunal = credencial.tribunal?.toUpperCase().replace(/\s+/g, "");

    // Find MNI endpoint
    const mniUrl = MNI_ENDPOINTS[tribunal];
    if (!mniUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Endpoint MNI não configurado para o tribunal: ${tribunal}`,
          tribunal,
          endpoints_disponiveis: Object.keys(MNI_ENDPOINTS),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[testar-mni] Testando MNI para tribunal ${tribunal} em ${mniUrl}`
    );

    // Build SOAP envelope
    const soapBody = buildConsultarAvisosPendentesSOAP(login, senha);

    const startTime = Date.now();

    // Make SOAP request
    const mniResponse = await fetch(mniUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: "consultarAvisosPendentes",
      },
      body: soapBody,
    });

    const elapsedMs = Date.now() - startTime;
    const responseText = await mniResponse.text();

    console.log(
      `[testar-mni] Resposta MNI: status=${mniResponse.status}, tempo=${elapsedMs}ms, tamanho=${responseText.length}`
    );

    // Parse response
    const isFault = responseText.includes("Fault") || responseText.includes("fault");
    const isAuthError =
      responseText.includes("Autenticação") ||
      responseText.includes("autenticacao") ||
      responseText.includes("credencial") ||
      responseText.includes("senha") ||
      responseText.includes("Unauthorized") ||
      responseText.includes("401");

    // Extract fault message if present
    let faultMessage = "";
    const faultStringMatch = responseText.match(
      /<(?:[\w:]*)?faultstring[^>]*>([\s\S]*?)<\/(?:[\w:]*)?faultstring>/i
    );
    if (faultStringMatch) {
      faultMessage = faultStringMatch[1].trim();
    }

    // Extract message from detail if available
    const detailMatch = responseText.match(
      /<(?:[\w:]*)?mensagem[^>]*>([\s\S]*?)<\/(?:[\w:]*)?mensagem>/i
    );
    const mensagem = detailMatch ? detailMatch[1].trim() : "";

    // Check for successful response (contains avisos or success indicator)
    const hasAvisos = responseText.includes("consultarAvisosPendentesResponse");
    const isSuccess = mniResponse.ok && (hasAvisos || !isFault);

    // Update credential status
    const statusUpdate: Record<string, unknown> = {
      ultima_validacao: new Date().toISOString(),
      status_validacao: isSuccess ? "valido" : isAuthError ? "erro_credencial" : "erro_conexao",
      mensagem_erro: isSuccess ? null : faultMessage || mensagem || `HTTP ${mniResponse.status}`,
    };

    if (isSuccess) {
      statusUpdate.tentativas_falhas = 0;
      statusUpdate.ultimo_erro_login = null;
    } else if (isAuthError) {
      // Increment failure counter
      const { data: currentCred } = await supabaseAdmin
        .from("cofre_senhas")
        .select("tentativas_falhas")
        .eq("id", cofre_senha_id)
        .single();

      const newFalhas = (currentCred?.tentativas_falhas || 0) + 1;
      statusUpdate.tentativas_falhas = newFalhas;
      statusUpdate.ultimo_erro_login = new Date().toISOString();

      // Block after 3 failures
      if (newFalhas >= 3) {
        const bloqueioAte = new Date();
        bloqueioAte.setMinutes(bloqueioAte.getMinutes() + 30);
        statusUpdate.bloqueado_ate = bloqueioAte.toISOString();
      }
    }

    await supabaseAdmin
      .from("cofre_senhas")
      .update(statusUpdate)
      .eq("id", cofre_senha_id);

    // Count avisos if successful
    let totalAvisos = 0;
    if (isSuccess) {
      const avisoMatches = responseText.match(/<(?:[\w:]*)?aviso[\s>]/gi);
      totalAvisos = avisoMatches ? avisoMatches.length : 0;
    }

    return new Response(
      JSON.stringify({
        success: isSuccess,
        tribunal,
        endpoint: mniUrl,
        tempo_ms: elapsedMs,
        http_status: mniResponse.status,
        autenticacao_ok: isSuccess,
        total_avisos_pendentes: isSuccess ? totalAvisos : undefined,
        erro: !isSuccess ? faultMessage || mensagem || `HTTP ${mniResponse.status}` : undefined,
        tipo_erro: !isSuccess
          ? isAuthError
            ? "credencial_invalida"
            : "erro_conexao"
          : undefined,
        detalhes: !isSuccess
          ? responseText.substring(0, 500)
          : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[testar-mni] Erro:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(err),
        tipo_erro: "erro_interno",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
