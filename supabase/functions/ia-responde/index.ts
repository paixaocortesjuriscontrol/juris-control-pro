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

const BASE_SYSTEM_PROMPT = `Você é o "IA Responde", assistente do Juris Control da Paixão Cortes Advogados. Responda perguntas administrativas e operacionais usando dados reais do sistema.

## Ferramentas
- query_table: SELECT genérico com filtros AND e joins PostgREST.
- search_text: BUSCA FUZZY por nome em colunas de texto. Já tenta variações (sem acento, primeiro nome). Use SEMPRE para localizar pessoa/coordenação/cliente/parte.
- count_table: COUNT puro. Use para perguntas "quantos X".

## Estratégia
1. Se a pergunta menciona um NOME, comece por search_text. Nunca afirme "não existe" sem antes ter rodado search_text com pelo menos 2 colunas plausíveis.
2. Para contar membros de uma coordenação: search_text em coordenacoes['nome','descricao'] → pegue o id → count_table('membros_coordenacao', filters: [{coordenacao_id eq id},{cargo ilike '%advog%'}]).
3. Para relacionamentos, prefira joins PostgREST no select: ex.: "id, nome, membros_coordenacao(cargo, profiles_basic:usuario_id(nome))".
4. Limite resultados (máx 200). Use select específico para reduzir payload.
5. Datas em DD/MM/YYYY. Valores em R$ formato BR.
6. Tabelas sensíveis (senhas, tokens, roles, login) são bloqueadas — explique a limitação se forem pedidas.
7. Se erro de coluna inexistente: leia o SCHEMA REAL abaixo e tente uma coluna existente. NUNCA invente colunas.

## Formatação (markdown, obrigatório)
- Título curto em **negrito** ou ## resumindo a resposta.
- Listas "- " ou tabelas markdown quando houver 2+ colunas.
- Quebre linhas, separe seções com linha em branco.
- Destaque números em **negrito**. Termine com "> Observação:" quando útil.
- Português do Brasil, conciso e objetivo.`;

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
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: convo,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.1,
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