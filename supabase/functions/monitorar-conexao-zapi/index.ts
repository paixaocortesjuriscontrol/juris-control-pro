// ============================================================================
// monitorar-conexao-zapi
// Checa a cada 5 minutos se o número da Z-API (WhatsApp) está conectado.
// Ao detectar desconexão, avisa por e-mail e tenta avisar por WhatsApp.
// Reenvia o aviso no máximo uma vez por hora enquanto permanecer offline,
// e manda um aviso de "voltou a funcionar" quando reconectar.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TAG = "[monitorar-conexao-zapi]";
const FROM = "JurisControl <alertas@juriscontrol.adv.br>";
const EMAILS_ALERTA = ["edutorres1976@gmail.com"];
const TELEFONES_ALERTA = ["5561999776905"];
const REPETIR_ALERTA_MS = 60 * 60 * 1000; // 1 hora

const log = (...a: unknown[]) => console.log(TAG, ...a);

function agoraBrt() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function enviarEmail(assunto: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    log("RESEND_API_KEY ausente — e-mail não enviado");
    return { ok: false, detalhe: "RESEND_API_KEY ausente" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: EMAILS_ALERTA, subject: assunto, html }),
  });
  const body = await res.text();
  if (!res.ok) log(`falha no e-mail [${res.status}]: ${body}`);
  return { ok: res.ok, detalhe: body.slice(0, 300) };
}

async function enviarWhatsapp(mensagem: string) {
  const instancia = Deno.env.get("ZAPI_INSTANCE_ID");
  const token = Deno.env.get("ZAPI_TOKEN");
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!instancia || !token || !clientToken) return { ok: false, detalhe: "credenciais Z-API ausentes" };

  const resultados: string[] = [];
  for (const phone of TELEFONES_ALERTA) {
    try {
      const res = await fetch(
        `https://api.z-api.io/instances/${instancia}/token/${token}/send-text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": clientToken },
          body: JSON.stringify({ phone, message: mensagem }),
        },
      );
      const body = await res.text();
      resultados.push(`${phone}: ${res.status} ${body.slice(0, 120)}`);
    } catch (e) {
      resultados.push(`${phone}: erro ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log("whatsapp", resultados.join(" | "));
  return { ok: true, detalhe: resultados.join(" | ") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const instancia = Deno.env.get("ZAPI_INSTANCE_ID");
  const token = Deno.env.get("ZAPI_TOKEN");
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!instancia || !token || !clientToken) {
    return new Response(JSON.stringify({ error: "Credenciais da Z-API não configuradas" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1) Estado atual da instância
  let conectado = false;
  let motivo: string | null = null;
  try {
    const res = await fetch(`https://api.z-api.io/instances/${instancia}/token/${token}/status`, {
      headers: { "Client-Token": clientToken },
      signal: AbortSignal.timeout(20_000),
    });
    const texto = await res.text();
    if (!res.ok) {
      motivo = `HTTP ${res.status}: ${texto.slice(0, 200)}`;
    } else {
      const data = JSON.parse(texto);
      const smartphone = data?.smartphoneConnected;
      conectado = data?.connected === true && smartphone !== false;
      if (!conectado) {
        motivo = data?.error
          ? String(data.error)
          : data?.connected !== true
            ? "instância desconectada do WhatsApp"
            : "celular sem conexão com a internet";
      }
    }
  } catch (e) {
    motivo = `falha ao consultar status: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 2) Estado anterior
  const { data: estado } = await supabase
    .from("zapi_conexao_estado")
    .select("*")
    .eq("instancia", instancia)
    .maybeSingle();

  const eraConectado = estado?.conectado;
  const ultimoAlerta = estado?.ultimo_alerta_em ? new Date(estado.ultimo_alerta_em).getTime() : 0;
  const agora = Date.now();

  let alertou = false;
  let tipoAlerta: "desconexao" | "reconexao" | null = null;

  if (!conectado) {
    const primeiraDeteccao = eraConectado !== false;
    const passouIntervalo = agora - ultimoAlerta >= REPETIR_ALERTA_MS;
    if (primeiraDeteccao || passouIntervalo) {
      tipoAlerta = "desconexao";
      const quando = agoraBrt();
      await enviarEmail(
        "⚠️ WhatsApp (Z-API) DESCONECTADO — JurisControl",
        `<h2>O número do WhatsApp do JurisControl está desconectado</h2>
         <p><strong>Detectado em:</strong> ${quando} (horário de Brasília)</p>
         <p><strong>Motivo:</strong> ${motivo || "desconhecido"}</p>
         <p>Enquanto estiver desconectado, nenhum aviso de audiência, prazo ou tarefa será entregue pelo WhatsApp.</p>
         <p>Abra o painel da Z-API e leia o QR Code novamente para reconectar.</p>`,
      );
      await enviarWhatsapp(
        `⚠️ JurisControl: o número do WhatsApp está DESCONECTADO desde ${quando} (BRT).\nMotivo: ${motivo || "desconhecido"}\nLeia o QR Code na Z-API para reconectar.`,
      );
      alertou = true;
    }
  } else if (eraConectado === false) {
    tipoAlerta = "reconexao";
    const quando = agoraBrt();
    await enviarEmail(
      "✅ WhatsApp (Z-API) reconectado — JurisControl",
      `<h2>O número do WhatsApp voltou a funcionar</h2>
       <p><strong>Reconectado em:</strong> ${quando} (horário de Brasília)</p>
       <p>Os avisos voltaram a ser entregues normalmente.</p>`,
    );
    await enviarWhatsapp(`✅ JurisControl: o WhatsApp voltou a funcionar em ${quando} (BRT).`);
    alertou = true;
  }

  await supabase.from("zapi_conexao_estado").upsert(
    {
      instancia,
      conectado,
      motivo,
      verificado_em: new Date().toISOString(),
      mudou_em: eraConectado === conectado ? (estado?.mudou_em ?? new Date().toISOString()) : new Date().toISOString(),
      ultimo_alerta_em: alertou ? new Date().toISOString() : (estado?.ultimo_alerta_em ?? null),
    },
    { onConflict: "instancia" },
  );

  log(`conectado=${conectado} motivo=${motivo || "-"} alerta=${tipoAlerta || "nenhum"}`);

  return new Response(
    JSON.stringify({ conectado, motivo, alerta: tipoAlerta }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
