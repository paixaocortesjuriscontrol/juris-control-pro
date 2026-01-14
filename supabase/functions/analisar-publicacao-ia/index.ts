import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conteudo, tipoTarefa, processoNumero, dataPublicacao } = await req.json();

    if (!conteudo) {
      return new Response(
        JSON.stringify({ error: "Conteúdo da publicação é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurada");
    }

    const tipoDescricao = tipoTarefa ? `O usuário selecionou o tipo de tarefa: ${tipoTarefa}.` : "";

    const systemPrompt = `Você é um assistente jurídico especializado em análise de publicações do Diário de Justiça.
Sua função é analisar o conteúdo de publicações jurídicas e sugerir os campos para criação de uma tarefa.

REGRAS IMPORTANTES:
1. Seja conciso e objetivo
2. O título deve ter no máximo 100 caracteres
3. A descrição deve resumir as ações necessárias
4. A prioridade deve ser baseada em prazos e urgência mencionados
5. Calcule a data de vencimento com base em prazos legais mencionados ou sugira 5 dias úteis como padrão
6. Identifique o tipo correto de tarefa baseado no conteúdo

TIPOS DE TAREFA DISPONÍVEIS:
- INTIMAÇÃO: Intimações gerais
- DEFESA: Contestações, defesas preliminares
- RECURSO: Recursos ordinários, extraordinários, especiais
- CONTRARRAZÕES: Resposta a recursos
- PETIÇÃO: Petições diversas
- DILIGÊNCIA: Atos a serem cumpridos fora do processo
- AUDIÊNCIA: Designação ou preparo de audiências
- PROTOCOLO: Atos de protocolo
- ANÁLISE: Análise de documentos ou situação processual
- MANIFESTAÇÃO: Manifestações processuais
- OUTROS: Outros tipos

PRIORIDADES:
- baixa: Prazos longos (>15 dias) ou informativos
- media: Prazos normais (5-15 dias)
- alta: Prazos curtos (3-5 dias) ou citações
- urgente: Prazos fatais próximos (<3 dias) ou liminares`;

    const userPrompt = `Analise a seguinte publicação jurídica e sugira os campos para criação de uma tarefa:

${processoNumero ? `PROCESSO: ${processoNumero}` : ""}
${dataPublicacao ? `DATA DA PUBLICAÇÃO: ${dataPublicacao}` : ""}
${tipoDescricao}

CONTEÚDO DA PUBLICAÇÃO:
${conteudo.substring(0, 6000)}

Responda APENAS com um JSON válido no seguinte formato (sem markdown, sem explicações):
{
  "tipo_tarefa": "TIPO_SUGERIDO",
  "titulo": "Título conciso da tarefa",
  "descricao": "Descrição detalhada das ações necessárias",
  "prioridade": "baixa|media|alta|urgente",
  "dias_prazo": 5,
  "observacoes": "Observações relevantes sobre prazos ou ações específicas"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para uso da IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Erro na API de IA:", response.status, errorText);
      throw new Error("Erro ao consultar IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    // Limpar possíveis marcadores de código markdown
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const resultado = JSON.parse(jsonStr);

    // Validar e normalizar campos
    const tiposValidos = [
      "INTIMAÇÃO", "DEFESA", "RECURSO", "CONTRARRAZÕES", "PETIÇÃO",
      "DILIGÊNCIA", "AUDIÊNCIA", "PROTOCOLO", "ANÁLISE", "MANIFESTAÇÃO", "OUTROS"
    ];
    const prioridadesValidas = ["baixa", "media", "alta", "urgente"];

    if (!tiposValidos.includes(resultado.tipo_tarefa)) {
      resultado.tipo_tarefa = tipoTarefa || "ANÁLISE";
    }
    if (!prioridadesValidas.includes(resultado.prioridade)) {
      resultado.prioridade = "media";
    }
    if (!resultado.dias_prazo || resultado.dias_prazo < 1) {
      resultado.dias_prazo = 5;
    }

    // Calcular data de vencimento
    const hoje = new Date();
    let diasAdicionados = 0;
    while (diasAdicionados < resultado.dias_prazo) {
      hoje.setDate(hoje.getDate() + 1);
      const diaSemana = hoje.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        diasAdicionados++;
      }
    }
    resultado.data_vencimento = hoje.toISOString().split("T")[0];

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao analisar publicação:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
