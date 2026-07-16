## Objetivo
Tela admin `/admin/consumo-ia` com relatório detalhado de todas as chamadas de IA do sistema: usuário, tela/origem, função, modelo, tokens (input/output) e custo estimado em USD/BRL.

## Confirmação: AI Gateway da Lovable
Fiz um `rg` no projeto e **não há nenhum uso do AI Gateway da Lovable** (nada de `ai.gateway.lovable`, `LOVABLE_API_KEY`, `createOpenAICompatible` etc). Todas as chamadas vão direto para `generativelanguage.googleapis.com` via `_shared/gemini-openai-compat.ts` usando `GEMINI_API_KEY`. Nada a remover.

## 1. Nova tabela `ai_usage_logs`

Migração cria a tabela + GRANTs + RLS + índices.

Colunas:
- `id uuid pk`, `created_at timestamptz default now()`
- `user_id uuid` (auth.uid() de quem invocou a edge function)
- `user_email text` (denormalizado do profiles p/ relatório sem join)
- `edge_function text not null` (ex.: `repositorio-chat`, `analisar-documento`)
- `origem text` (tela de origem, ex.: `/repositorio`, `/processos/:id`, `/assistente-juridico`) — enviado pelo frontend no body como `_origem`
- `model text not null` (`gemini-2.5-flash` etc.)
- `prompt_tokens int`, `completion_tokens int`, `total_tokens int`
- `custo_usd numeric(10,6)` (calculado no servidor a partir de tokens × tabela de preços)
- `duracao_ms int`
- `status text` (`success` | `error` | `rate_limited`)
- `erro text` (mensagem quando `status != success`)
- `metadata jsonb` (livre — processo_numero, doc_id, etc.)

RLS:
- Só admins fazem SELECT (via `has_role(auth.uid(), 'admin')`).
- INSERT só via `service_role` (edge functions escrevem com service role — não expor ao anon/authenticated).

Índices: `(created_at desc)`, `(user_id, created_at desc)`, `(edge_function, created_at desc)`.

## 2. Helper compartilhado `supabase/functions/_shared/ai-usage-logger.ts`

Função `logAiUsage({ req, supabase, edgeFunction, model, usage, duracaoMs, status, erro?, metadata? })`:
- Extrai `user_id` do JWT (`req.headers.authorization` → `supabase.auth.getUser`).
- Extrai `_origem` do body (o frontend passa; fallback: header `x-lovable-origem` ou `null`).
- Calcula `custo_usd` a partir da tabela de preços (constante no helper):
  - `gemini-2.5-flash`: $0.30 / 1M input, $2.50 / 1M output
  - `gemini-2.5-pro`: $1.25 / 1M input, $10 / 1M output
  - (fácil estender)
- Faz INSERT com `service_role` (client já criado nas functions com service role).
- **Nunca lança** — try/catch interno; logar erro no console mas não quebrar a chamada de IA.

## 3. Instrumentar as edge functions de IA (16 no total)

Padrão em cada function:
```ts
const t0 = Date.now();
try {
  const resp = await geminiChatCompletionsFetch({ ... });
  const data = await resp.json();
  await logAiUsage({ req, supabase, edgeFunction: "repositorio-chat",
    model: "gemini-2.5-flash", usage: data.usage,
    duracaoMs: Date.now() - t0, status: "success",
    metadata: { conversa_id } });
  ...
} catch (err) {
  await logAiUsage({ ..., status: "error", erro: String(err) });
  throw err;
}
```

Functions a instrumentar:
`repositorio-chat`, `preencher-form-ia-anexos`, `preencher-form-ia-anexos-processo`, `analise-quarteirizado-ia`, `ia-responde`, `analisar-documento`, `analisar-tst-ia`, `classificar-publicacoes-tst`, `resumir-publicacoes`, `comparar-dj-santander`, `complementar-planilha-tst`, `ia-preagendar-djen`, `analisar-publicacao-ia`, `analisar-prazos-drive`, `analisar-tst-prompt-ia` — mais quaisquer outras que apareçam no `rg` na hora do build.

## 4. Frontend — envio da tela de origem

Criar wrapper leve `src/lib/invokeIA.ts`:
```ts
export const invokeIA = (name, body) =>
  supabase.functions.invoke(name, {
    body: { ...body, _origem: window.location.pathname }
  });
```
Substituir os `supabase.functions.invoke("<nome-ia>", …)` das ~12 telas identificadas por `invokeIA(...)`. Chamadas de IA feitas via `fetch` direto (poucas — ex.: `repositorio-chat` stream) recebem header `x-lovable-origem: <pathname>`.

## 5. Tela `/admin/consumo-ia` (admin)

Rota nova no `App.tsx`, protegida por `has_role admin`. Card entrará em **Administração**.

Componentes:
- **Filtros no topo:** período (default últimos 7 dias), usuário (select multi), edge_function (select multi), modelo, status.
- **KPIs (4 cards):** total de chamadas, total de tokens, custo total USD, custo total BRL (× cotação fixa configurável — default 5,50).
- **Gráfico 1:** tokens/dia (barra empilhada input vs output).
- **Gráfico 2:** top 10 funções por custo (barra horizontal).
- **Gráfico 3:** top 10 usuários por custo (barra horizontal).
- **Tabela detalhada** (paginada, 50/pg, ordenável): data/hora, usuário, tela (origem), edge function, modelo, prompt tokens, completion tokens, total, custo USD, duração, status. Linha expansível mostra `metadata` + `erro`.
- **Botão "Exportar CSV"** (o filtro atual).

Tudo lê direto de `ai_usage_logs` com RLS. Sem edge function extra.

## 6. Detalhes técnicos

- **Custo em BRL:** cotação hardcoded (5,50) mostrada com nota "estimativa". Se quiser configurável depois, dá pra puxar de `parametros_monitoramento_djen` ou nova tabela — fica fora do escopo.
- **Retroativo:** não fazemos backfill (conforme acordado). A tela mostra "Coleta iniciada em <data>" se o filtro pegar antes da primeira linha.
- **Segurança:** só admin lê; edge functions escrevem via service_role. Nada de escrever do browser.
- **Performance:** para períodos longos usar agregações (`group by date_trunc('day', ...)`) via `supabase--read_query` — a tela usa RPCs SQL para os gráficos e SELECT paginado para a tabela.
- **Sem quebra:** logger nunca lança; se der erro na tabela, a chamada de IA segue normal.

## Fora de escopo
- Alertas de estouro de orçamento.
- Limite por usuário/coordenação.
- Backfill de chamadas antigas.
- Dashboard por coordenação (dá pra adicionar depois — coluna `coordenacao_id` já no metadata).
