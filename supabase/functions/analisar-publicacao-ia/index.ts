import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { geminiChatCompletionsFetch } from "../_shared/gemini-openai-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Modelo dedicado ao preenchimento automático de tarefas/prazos/eventos/audiências.
// Usa o modelo mais capaz (Pro) por padrão; cai para o rápido em caso de 429/5xx.
const AI_MODEL = Deno.env.get("GEMINI_MODEL_TAREFAS") || "gemini-2.5-pro";
const AI_MODEL_FALLBACK = "gemini-flash-latest";

type TipoItem = "prazo" | "tarefa" | "evento" | "audiencia";

const PROMPT_PADRAO_PRAZO = `Você é um assistente jurídico especializado em análise de publicações do Diário de Justiça.
Sua função é analisar o conteúdo de publicações jurídicas e sugerir os campos para criação de um PRAZO.

REGRAS IMPORTANTES:
1. Seja conciso e objetivo
2. O título deve ter no máximo 100 caracteres
3. A descrição deve resumir as ações necessárias
4. A prioridade deve ser baseada em prazos e urgência mencionados
5. Calcule a data de vencimento com base em prazos legais mencionados ou sugira 5 dias úteis como padrão
6. Identifique o tipo correto de tarefa baseado no conteúdo

TIPOS DE TAREFA DISPONÍVEIS:
- INTIMAÇÃO, DEFESA, RECURSO, CONTRARRAZÕES, PETIÇÃO, DILIGÊNCIA, AUDIÊNCIA, PROTOCOLO, ANÁLISE, MANIFESTAÇÃO, OUTROS

PRIORIDADES:
- baixa: Prazos longos (>15 dias) ou informativos
- media: Prazos normais (5-15 dias)
- alta: Prazos curtos (3-5 dias) ou citações
- urgente: Prazos fatais próximos (<3 dias) ou liminares`;

const PROMPT_PADRAO_TAREFA = `Você é um assistente jurídico especializado em análise de publicações do Diário de Justiça.
Sua função é analisar o conteúdo de publicações jurídicas e sugerir os campos para criação de uma TAREFA DE EQUIPE.
Foque em: ação prática a executar, responsável adequado, e prazo interno para conclusão.
O título deve descrever a ação em até 100 caracteres. Sugira 5 dias úteis como padrão.
PRIORIDADES: baixa, media, alta, urgente.`;

const PROMPT_PADRAO_EVENTO = `Você é um assistente jurídico especializado em análise de publicações do Diário de Justiça.
Sua função é analisar o conteúdo de publicações e sugerir os campos para criação de um EVENTO na agenda.
Foque em data/hora do evento, local (físico ou virtual/link), assunto e observações relevantes.
Se houver data/hora explícita, use-a como data_vencimento. Inclua link/plataforma nas observações.
PRIORIDADES: baixa, media, alta, urgente.`;

const PROMPT_PADRAO_AUDIENCIA = `Você é um assistente jurídico especializado em análise de publicações do Diário de Justiça.
Sua função é analisar o conteúdo de publicações e sugerir os campos para agendamento de uma AUDIÊNCIA.
Foque em: data e hora, tipo (instrução, conciliação, una, inicial), local ou link, preparação e testemunhas.
Use a data/hora da audiência como data_vencimento. Detalhes de local/link nas observações.
PRIORIDADES: baixa, media, alta, urgente.`;

const PROMPT_PADRAO: Record<TipoItem, string> = {
  prazo: PROMPT_PADRAO_PRAZO,
  tarefa: PROMPT_PADRAO_TAREFA,
  evento: PROMPT_PADRAO_EVENTO,
  audiencia: PROMPT_PADRAO_AUDIENCIA,
};

function normalizeTipoItem(raw: unknown, tipoTarefa?: string): TipoItem {
  const s = (typeof raw === "string" ? raw : "").toLowerCase();
  if (s === "prazo" || s === "tarefa" || s === "evento" || s === "audiencia") return s;
  const t = (tipoTarefa || "").toUpperCase();
  if (t === "PRAZO") return "prazo";
  if (t === "AUDIÊNCIA" || t === "AUDIENCIA") return "audiencia";
  if (t === "EVENTO") return "evento";
  return "tarefa";
}

function extrairJson(texto: string) {
  let jsonStr = texto.trim();
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    const inicio = jsonStr.indexOf("{");
    const fim = jsonStr.lastIndexOf("}");
    if (inicio >= 0 && fim > inicio) {
      return JSON.parse(jsonStr.slice(inicio, fim + 1));
    }
    throw new Error("Resposta da IA não veio em JSON válido");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { conteudo, tipoTarefa, tipoItem, coordenacaoId, processoNumero, dataPublicacao } = await req.json();

    if (!conteudo) {
      return new Response(
        JSON.stringify({ error: "Conteúdo da publicação é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tipoItemFinal = normalizeTipoItem(tipoItem, tipoTarefa);

    // Busca prompt personalizado da coordenação (se houver). Usa cliente autenticado
    // para respeitar RLS: só o próprio usuário/admin enxerga os prompts da sua coord.
    let systemPromptResolved = PROMPT_PADRAO[tipoItemFinal];
    let promptOrigem = "padrão";
    try {
      let query = supabaseAuth
        .from("prompts_ia_publicacoes")
        .select("prompt, coordenacao_id")
        .eq("tipo_item", tipoItemFinal)
        .eq("ativo", true);
      if (coordenacaoId) {
        query = query.eq("coordenacao_id", coordenacaoId);
      }
      const { data: promptsCustom, error: promptErr } = await query.limit(1);
      if (promptErr) {
        console.warn("Falha ao buscar prompt customizado:", promptErr.message);
      } else if (promptsCustom && promptsCustom.length > 0 && promptsCustom[0].prompt) {
        systemPromptResolved = promptsCustom[0].prompt as string;
        promptOrigem = `customizado (coord ${promptsCustom[0].coordenacao_id})`;
      }
    } catch (e) {
      console.warn("Erro consultando prompts_ia_publicacoes:", (e as Error).message);
    }
    console.info(`analisar-publicacao-ia tipoItem=${tipoItemFinal} prompt=${promptOrigem}`);

    const geminiKeySource = Deno.env.get("GEMINI_API_KEY_DJEN")
      ? "GEMINI_API_KEY_DJEN"
      : Deno.env.get("GEMINI_API_KEY")
        ? "GEMINI_API_KEY"
        : Deno.env.get("GOOGLE_API_KEY")
          ? "GOOGLE_API_KEY"
          : null;

    if (!geminiKeySource) {
      throw new Error("GEMINI_API_KEY_DJEN não configurada. Configure a chave do Gemini para usar a IA.");
    }
    console.info(`analisar-publicacao-ia usando ${geminiKeySource} com modelo ${AI_MODEL}`);

    const tipoDescricao = tipoTarefa ? `O usuário selecionou o tipo de tarefa: ${tipoTarefa}.` : "";

    const systemPrompt = systemPromptResolved;

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

    const aiBody = {
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.3,
      tools: [{
        type: "function",
        function: {
          name: "preencher_tarefa_publicacao",
          description: "Sugere campos para criação de tarefa a partir de uma publicação jurídica",
          parameters: {
            type: "object",
            properties: {
              tipo_tarefa: { type: "string" },
              titulo: { type: "string" },
              descricao: { type: "string" },
              prioridade: { type: "string" },
              dias_prazo: { type: "number" },
              observacoes: { type: "string" },
            },
            required: ["titulo", "descricao", "prioridade", "dias_prazo"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "preencher_tarefa_publicacao" } },
    };

    (aiBody as any)._ai_usage = { edgeFunction: "analisar-publicacao-ia", authHeader: req.headers.get("authorization"), referer: req.headers.get("referer") };
    const response = await geminiChatCompletionsFetch(aiBody);

    if (!response.ok) {
      if (response.status === 429) {
        const errorText = await response.text();
        console.error("IA 429:", errorText);
        const lower = errorText.toLowerCase();
        const isGeminiBilling = lower.includes("prepayment credits are depleted")
          || lower.includes("resource_exhausted")
          || lower.includes("sem créditos");
        return new Response(
          JSON.stringify({
            error: isGeminiBilling
              ? "A chave Gemini configurada está SEM CRÉDITOS no Google AI Studio. Adicione créditos em https://ai.studio/projects para continuar usando a IA."
              : `Limite de requisições do Gemini excedido. Tente novamente em alguns segundos.`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Erro de autenticação na API Gemini. Verifique a chave configurada." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Erro na API de IA:", response.status, errorText);
      let errorMessage = "Erro ao consultar IA";
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed?.error?.message || parsed?.error || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText.slice(0, 500);
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const toolArgs = message?.tool_calls?.[0]?.function?.arguments;
    const content = toolArgs || message?.content;

    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    const resultado = extrairJson(content);

    // Validar e normalizar campos
    const tiposValidos = [
      "PRAZO", "TAREFA EQUIPE", "INTIMAÇÃO", "DEFESA", "RECURSO", "CONTRARRAZÕES", "PETIÇÃO",
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

    // Calcular data de vencimento (dias úteis)
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

    // Calcular data fatal (data_vencimento + 2 dias úteis)
    let diasFatalAdicionados = 0;
    while (diasFatalAdicionados < 2) {
      hoje.setDate(hoje.getDate() + 1);
      const diaSemana = hoje.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        diasFatalAdicionados++;
      }
    }
    resultado.data_fatal = hoje.toISOString().split("T")[0];

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
