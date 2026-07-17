import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { geminiChatCompletionsFetch } from "../_shared/gemini-openai-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `Você é assistente jurídico. Para cada publicação do DJEN, analise e proponha o pré-agendamento adequado.
Devolva JSON estrito com o esquema: { "sugestoes": [ { "publicacao_id": "uuid", "tipo": "tarefa|prazo|audiencia|evento", "titulo": "string curta", "descricao": "string opcional", "data_sugerida": "YYYY-MM-DD", "prioridade": "baixa|media|alta|urgente" } ] }
Regras:
- "prazo": quando a publicação contém prazo processual (contrarrazões, agravo, cumprimento, embargos, resposta). Data sugerida = 8 dias úteis a partir da data de publicação (ou o prazo detectado no texto), sem contar sábados/domingos.
- "audiencia": quando cita designação de audiência/pauta com data específica.
- "tarefa": quando pede análise, ciência ou providência sem prazo processual claro.
- "evento": para pautas, sessões, reuniões.
- Título curto (máx 80 caracteres) descrevendo a providência.
Retorne SOMENTE JSON válido, sem markdown, sem texto extra.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { publicacao_ids }: { publicacao_ids: string[] } = await req.json();
    if (!publicacao_ids?.length) {
      return new Response(JSON.stringify({ error: "publicacao_ids obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ids = publicacao_ids.slice(0, 30);
    const { data: pubs, error } = await supabase
      .from("publicacoes_djen")
      .select("id, processo_numero, data_publicacao, conteudo, tribunal, orgao")
      .in("id", ids);
    if (error) {
      console.error("Erro ao buscar publicações DJEN para pré-agendamento:", error.message);
      throw error;
    }

    const payload = (pubs ?? []).map((p: any) => ({
      publicacao_id: p.id,
      numero_processo: p.processo_numero,
      data_publicacao: p.data_publicacao,
      tribunal: p.tribunal,
      orgao_julgador: p.orgao,
      texto: (p.conteudo ?? "").slice(0, 4000),
    }));

    const resp = await geminiChatCompletionsFetch({
      _ai_usage: { edgeFunction: "ia-preagendar-djen", authHeader: req.headers.get("authorization"), referer: req.headers.get("referer") }, model: Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Publicações:\n${JSON.stringify(payload, null, 2)}\n\nRetorne JSON conforme especificado.` },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("IA pré-agendamento DJEN falhou:", errText.slice(0, 1000));
      return new Response(JSON.stringify({ error: "IA falhou", details: errText.slice(0, 1000) }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { parsed = { sugestoes: [] }; }

    return new Response(JSON.stringify({ ok: true, sugestoes: parsed.sugestoes ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Erro em ia-preagendar-djen:", e?.message ?? e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});