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

async function runSearchText(
  admin: ReturnType<typeof createClient>,
  args: { table: string; columns: string[]; term: string; select?: string; limit?: number; filters?: Filter[] }
) {
  const table = String(args.table || "").trim();
  if (!table || DENY_TABLES.has(table)) return { error: `Tabela "${table}" não permitida.` };
  const cols = (args.columns || []).filter(Boolean);
  const term = String(args.term || "").trim();
  if (!cols.length || !term) return { error: "search_text exige columns[] e term" };
  const select = args.select && args.select.trim().length ? args.select : "*";
  const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100);

  // Gera variações do termo (sem acentos, primeiro nome, minúsculo)
  const noAccent = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokens = Array.from(new Set([term, noAccent, ...term.split(/\s+/), ...noAccent.split(/\s+/)]))
    .filter((t) => t && t.length >= 3);

  // OR ilike em todas as colunas x todos os tokens
  const orParts: string[] = [];
  for (const col of cols) {
    for (const t of tokens) {
      const safe = t.replace(/[,()*]/g, "");
      orParts.push(`${col}.ilike.%${safe}%`);
    }
  }
  let q: any = admin.from(table).select(select, { count: "exact" }).or(orParts.join(",")).limit(limit);
  for (const f of args.filters || []) {
    if (!f || !f.column || !ALLOWED_OPS.has(f.op)) continue;
    if (f.op === "in" && Array.isArray(f.value)) q = q.in(f.column, f.value as any);
    else q = (q as any)[f.op](f.column, f.value);
  }
  const { data, error, count } = await q;
  if (error) return { error: error.message, tried_tokens: tokens };
  return { rows: data, count, returned: Array.isArray(data) ? data.length : 0, tried_tokens: tokens };
}

async function runCountTable(
  admin: ReturnType<typeof createClient>,
  args: { table: string; filters?: Filter[] }
) {
  const table = String(args.table || "").trim();
  if (!table || DENY_TABLES.has(table)) return { error: `Tabela "${table}" não permitida.` };
  let q: any = admin.from(table).select("*", { count: "exact", head: true });
  for (const f of args.filters || []) {
    if (!f || !f.column || !ALLOWED_OPS.has(f.op)) continue;
    if (f.op === "in" && Array.isArray(f.value)) q = q.in(f.column, f.value as any);
    else q = (q as any)[f.op](f.column, f.value);
  }
  const { count, error } = await q;
  if (error) return { error: error.message };
  return { count: count ?? 0 };
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_table",
      description:
        "SELECT em uma tabela/view do Supabase com filtros AND simples. Use select específico (com joins PostgREST quando precisar de dados relacionados, ex: 'id, nome, membros_coordenacao(usuario_id, cargo)'). Para BUSCA POR NOME use a tool search_text — não use ilike via aqui se houver acentos/variações.",
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
  {
    type: "function",
    function: {
      name: "search_text",
      description:
        "Busca textual fuzzy multi-coluna. Tenta o termo original, sem acentos e cada palavra isolada (OR ilike) em todas as colunas informadas. USE SEMPRE QUE PROCURAR POR NOME DE PESSOA, COORDENAÇÃO, CLIENTE OU PARTE. Ex: term='Thomás' em coordenacoes/['nome','descricao'].",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          columns: { type: "array", items: { type: "string" }, description: "Colunas de texto onde procurar." },
          term: { type: "string", description: "Termo a buscar (pode ter acento ou maiúsculas)." },
          select: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 100 },
          filters: {
            type: "array",
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
        },
        required: ["table","columns","term"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_table",
      description: "Retorna apenas a contagem (COUNT) de linhas de uma tabela aplicando filtros AND. Use para perguntas do tipo 'quantos X existem'.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          filters: {
            type: "array",
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
        },
        required: ["table"],
      },
    },
  },
];

const BASE_SYSTEM_PROMPT = `Você é o "IA Responde", assistente do Juris Control da Paixão Cortes Advogados. Responde com dados REAIS do banco usando as ferramentas.

## REGRA INVIOLÁVEL
É PROIBIDO responder "não encontrei" sem antes ter chamado as ferramentas. Você SEMPRE deve chamar pelo menos uma ferramenta antes de afirmar que algo não existe. Se a primeira tool retorna 0, tente outra coluna/tabela/termo. Mínimo 3 tentativas antes de desistir.

## Ferramentas
- **search_text** (USE SEMPRE PARA NOMES): busca fuzzy multi-coluna. Já tenta automaticamente: termo original, sem acento, e cada palavra isolada com pelo menos 3 letras. Ex.: para "Dr. Thomás" tenta "Thomás", "Thomas", "Dr.", "Dr".
- **count_table**: COUNT puro com filtros AND.
- **query_table**: SELECT genérico com filtros AND e joins PostgREST.

## RECEITAS PRONTAS

### "Quantos advogados na coordenação do <NOME>?"
Passo 1: search_text({ table: "coordenacoes", columns: ["nome","descricao"], term: "<NOME>", select: "id, nome" })
Passo 2 (com o id retornado): count_table({ table: "membros_coordenacao", filters: [{column:"coordenacao_id",op:"eq",value:"<id>"},{column:"cargo",op:"ilike",value:"%advog%"}] })
Passo 3: responder em markdown.

### "Liste advogados da coordenação <NOME>"
Passo 1: search_text em coordenacoes (igual acima).
Passo 2: query_table({ table:"membros_coordenacao", select:"cargo, usuario:profiles_basic!membros_coordenacao_usuario_id_fkey(nome)", filters:[{column:"coordenacao_id",op:"eq",value:"<id>"},{column:"cargo",op:"ilike",value:"%advog%"}], limit:100 })

### "Quantos processos ativos por coordenação?"
query_table({ table:"coordenacoes", select:"id,nome", limit:50 }) → para cada, count_table em processos filtrando coordenacao_id e status.

## Regras gerais
- Limite resultados (máx 200). Use select específico.
- Datas DD/MM/YYYY. Valores em R$ formato BR.
- Tabelas sensíveis (senhas, tokens, roles, login) são bloqueadas — explique.
- Use somente nomes de tabelas/colunas que aparecem no SCHEMA REAL abaixo. NUNCA invente.

## Formatação (markdown obrigatório)
- Título curto em **negrito** ou ## resumindo a resposta.
- Listas "- " ou tabelas markdown quando houver 2+ colunas.
- Quebre linhas, separe seções com linha em branco.
- Destaque números em **negrito**. Termine com "> Observação:" quando útil.
- Português do Brasil, conciso.`;

function buildSchemaPrompt(schema: any[]): string {
  if (!schema?.length) return "";
  const lines = schema.map((t: any) => {
    const cols = (t.columns || []).map((c: any) => `${c.name}:${c.type}`).join(", ");
    return `- ${t.table_name}(${cols})`;
  });
  return `\n\n## SCHEMA REAL DO BANCO (use exatamente estes nomes)\n${lines.join("\n")}`;
}

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
    const MODEL = "gpt-4o";

    // Carrega schema real (com fallback silencioso)
    let schemaPrompt = "";
    try {
      const { data: schemaData } = await admin.rpc("get_ia_schema");
      if (Array.isArray(schemaData)) schemaPrompt = buildSchemaPrompt(schemaData);
    } catch (e) {
      console.error("schema load failed", e);
    }

    const convo: any[] = [
      { role: "system", content: BASE_SYSTEM_PROMPT + schemaPrompt },
      ...messages,
    ];
    const trace: any[] = [];

    for (let step = 0; step < 12; step++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: convo,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.1,
        }),
      });
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`AI Gateway ${resp.status}: ${txt}`);
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
        switch (tc.function.name) {
          case "query_table": result = await runQueryTable(admin, args); break;
          case "search_text": result = await runSearchText(admin, args); break;
          case "count_table": result = await runCountTable(admin, args); break;
          default: result = { error: `Tool desconhecida: ${tc.function.name}` };
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