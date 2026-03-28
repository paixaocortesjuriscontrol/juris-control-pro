import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { processos } = await req.json();

    if (!Array.isArray(processos) || processos.length === 0) {
      return new Response(
        JSON.stringify({ error: "Array de processos é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const systemPrompt = `Você é um analista jurídico especializado em processos trabalhistas do TST.
Recebeu uma lista de processos com dados parciais. Para cada processo, tente complementar os campos faltantes com base no número do processo e nos dados já disponíveis.

CAMPOS A COMPLEMENTAR:
- DOSSIÊ: código do dossiê/pasta do escritório
- EQUIPE: nome da equipe/núcleo responsável
- RECLAMANTE: nome do reclamante/autor da ação
- RECLAMADA: nome da empresa reclamada/ré
- RELATOR: nome do ministro relator no TST

REGRAS:
- Retorne APENAS os campos que você consegue inferir com razoável confiança
- Se não conseguir determinar um campo, retorne "(Não localizado)"
- Use o formato CNJ do número do processo para inferir tribunal e região
- Mantenha nomes próprios com a capitalização correta`;

    const processosTexto = processos.map((p: any, i: number) => {
      const parts = [`Processo ${i + 1}: ${p.numero_processo}`];
      if (p.dossie && p.dossie !== "(Não localizado)") parts.push(`Dossiê: ${p.dossie}`);
      if (p.equipe && p.equipe !== "(Não localizado)") parts.push(`Equipe: ${p.equipe}`);
      if (p.reclamante && p.reclamante !== "(Não localizado)") parts.push(`Reclamante: ${p.reclamante}`);
      if (p.reclamada && p.reclamada !== "(Não localizado)") parts.push(`Reclamada: ${p.reclamada}`);
      if (p.relator && p.relator !== "(Não localizado)") parts.push(`Relator: ${p.relator}`);
      return parts.join(" | ");
    }).join("\n");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Complemente os dados dos seguintes processos:\n\n${processosTexto}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "complementar_processos",
            description: "Retorna os dados complementados de cada processo",
            parameters: {
              type: "object",
              properties: {
                resultados: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      numero_processo: { type: "string" },
                      dossie: { type: "string" },
                      equipe: { type: "string" },
                      reclamante: { type: "string" },
                      reclamada: { type: "string" },
                      relator: { type: "string" },
                    },
                    required: ["numero_processo"],
                  },
                },
              },
              required: ["resultados"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "complementar_processos" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) throw new Error("Rate limit OpenAI - aguarde e tente novamente");
      throw new Error(`Erro OpenAI: ${resp.status}`);
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(
        JSON.stringify({ resultados: parsed.resultados || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ resultados: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
