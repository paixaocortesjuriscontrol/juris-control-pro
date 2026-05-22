import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tabelas sensíveis bloqueadas (não expor por IA)
const DENY_TABLES = new Set([
  "cofre_senhas",
  "kurier_credenciais",
  "historico_login",
  "historico_capturas",
  "google_calendar_tokens",
  "user_roles",
  "convites_cliente",
]);

const ALLOWED_OPS = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in",
]);

type Filter = { column: string; op: string; value: unknown };

async function runQueryTable(
  admin: ReturnType<typeof createClient>,
  args: {
    table: string;
    select?: string;
    filters?: Filter[];
    order?: { column: string; ascending?: boolean };
    limit?: number;
  }
) {
  const table = String(args.table || "").trim();
  if (!table || DENY_TABLES.has(table)) {
    return { error: `Tabela "${table}" não permitida.` };
  }
  const select = args.select && args.select.trim().length ? args.select : "*";
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);

  let q: any = admin.from(table).select(select, { count: "exact" }).limit(limit);

  for (const f of args.filters || []) {
    if (!f || !f.column || !ALLOWED_OPS.has(f.op)) continue;
    if (f.op === "in" && Array.isArray(f.value)) {
      q = q.in(f.column, f.value as any);
    } else {
      q = (q as any)[f.op](f.column, f.value);
    }
  }
  if (args.order?.column) {
    q = q.order(args.order.column, { ascending: args.order.ascending !== false });
  }

  const { data, error, count } = await q;
  if (error) return { error: error.message };
  return { rows: data, count, returned: Array.isArray(data) ? data.length : 0 };
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_table",
      description:
        "Consulta uma tabela do Supabase do sistema. Use para responder perguntas sobre processos, tarefas, audiências, prazos, publicações DJEN, coordenações, usuários, etc. Sempre aplique filtros e limite resultados. Use select específico para reduzir payload.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Nome da tabela ou view (ex: processos, tarefas, publicacoes_djen, dados_benner, coordenacoes, profiles_basic)." },
          select: { type: "string", description: "Colunas separadas por vírgula. Padrão '*'." },
          filters: {
            type: "array",
            description: "Filtros where (combinados com AND).",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                op: { type: "string", enum: ["eq","neq","gt","gte","lt","lte","like","ilike","is","in"] },
                value: {},
              },
              required: ["column","op","value"],
            },
          },
          order: {
            type: "object",
            properties: {
              column: { type: "string" },
              ascending: { type: "boolean" },
            },
          },
          limit: { type: "integer", minimum: 1, maximum: 200 },
        },
        required: ["table"],
      },
    },
  },
];

const SYSTEM_PROMPT = `Você é o "IA Responde", assistente do Juris Control da Paixão Cortes Advogados. Responda perguntas administrativas e operacionais usando dados reais do sistema.

- Use a ferramenta query_table para consultar o banco quando a pergunta exigir dados. Faça quantas chamadas precisar (encadeadas).
- Limite resultados (no máximo 200 linhas). Use select com colunas específicas.
- Para contagens, use limit=1 e leia o campo "count".
- Datas em DD/MM/YYYY na resposta. Valores monetários em R$.
- Seja conciso, objetivo e em português do Brasil. Formate respostas em markdown quando útil (tabelas, listas).
- Tabelas principais: processos, tarefas, eventos_agenda, audiencias_detectadas, intimacoes_detectadas, publicacoes_djen, publicacoes_djen_descartadas, dados_benner, coordenacoes, membros_coordenacao, profiles_basic, notificacoes, monitoramentos_djen, prazos via tarefas (data_vencimento/data_fatal), pautas_tst, distribuicoes_encontradas.
- Tabelas sensíveis (senhas, tokens, roles, login) são bloqueadas. Se a pergunta exigir, explique a limitação.
- Se não souber, diga que não encontrou dados, não invente.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verifica role admin
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const convo: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
    const trace: any[] = [];

    for (let step = 0; step < 8; step++) {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: convo,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.2,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`OpenAI ${resp.status}: ${txt}`);
      }
      const json = await resp.json();
      const msg = json.choices?.[0]?.message;
      if (!msg) throw new Error("Resposta vazia da OpenAI");

      convo.push(msg);

      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        return new Response(
          JSON.stringify({ answer: msg.content || "", trace }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const tc of toolCalls) {
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { args = {}; }
        let result: any;
        if (tc.function.name === "query_table") {
          result = await runQueryTable(admin, args);
        } else {
          result = { error: `Tool desconhecida: ${tc.function.name}` };
        }
        trace.push({ tool: tc.function.name, args, result_preview: { count: result.count, returned: result.returned, error: result.error } });
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 60000),
        });
      }
    }

    return new Response(JSON.stringify({ answer: "Não foi possível concluir a consulta (limite de passos).", trace }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ia-responde error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});