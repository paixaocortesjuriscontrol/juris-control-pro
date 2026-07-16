# Padronizar TODA IA em `gemini-2.5-flash` + atualizar InfoSistema

## Escopo aprovado
Padronizar todas as chamadas de IA para `gemini-2.5-flash`, incluindo a remoção do Claude/Anthropic. Atualizar as descrições em `src/components/admin/InfoSistemaTab.tsx`.

## Outras ocorrências de Claude encontradas (aviso)
Além das já listadas, achei mais uma edge function usando Claude que **também será migrada**:

- `supabase/functions/classificar-publicacoes-tst/index.ts` — Claude `claude-sonnet-4-20250514` (backend, sem UI) → migrar para `gemini-2.5-flash`.

Nenhuma outra referência a Claude/Anthropic/GPT-4/GPT-5 foi encontrada no código executável do app (o resto é comentário/nomes de arquivo compat).

## Alterações — Edge Functions (trocar modelo por `gemini-2.5-flash`)

Onde já existe `geminiChatCompletionsFetch`, apenas trocar o valor de `model`:

| Arquivo | Linha atual | Mudança |
|---|---|---|
| `repositorio-chat/index.ts` | 249: `gemini-2.5-pro` | → `gemini-2.5-flash` |
| `preencher-form-ia-anexos/index.ts` | 323: `gemini-2.5-pro` | → `gemini-2.5-flash` |
| `preencher-form-ia-anexos-processo/index.ts` | 185: `gemini-2.5-flash` | sem mudança |
| `analise-quarteirizado-ia/index.ts` | 191: `gemini-2.5-pro` | → `gemini-2.5-flash` |
| `ia-responde/index.ts` | 293: `gemini-2.5-pro` | → `gemini-2.5-flash` |
| `analisar-documento/index.ts` | 275: `gemini-2.5-pro` | → `gemini-2.5-flash` |

## Alterações — Migração Claude → Gemini

Duas funções chamam a API da Anthropic diretamente (`https://api.anthropic.com/v1/messages`). Reescrever para usar `geminiChatCompletionsFetch` do `_shared/gemini-openai-compat.ts` (mesmo padrão das outras):

### `supabase/functions/analisar-tst-ia/index.ts`
- Remover leitura de `ANTHROPIC_API_KEY` e o `fetch` para `api.anthropic.com`.
- Passar a usar `geminiChatCompletionsFetch({ model: "gemini-2.5-flash", temperature: 0.2, response_format: { type: "json_object" }, messages: [{role:"system",...},{role:"user",...}] })`.
- Ajustar parsing: o retorno passa a ser `choices[0].message.content` (JSON string) em vez de `content[0].text`.
- Atualizar mensagens de log ("Analisando TST com Gemini…", "Análise TST Gemini concluída…").
- Reduzir/manter `maxChars` (era 80 000 para Claude); Gemini 2.5 Flash suporta 1M tokens de contexto, então manter os 80 000 é seguro.

### `supabase/functions/classificar-publicacoes-tst/index.ts`
- Mesma reescrita: remover Anthropic e usar `geminiChatCompletionsFetch({ model: "gemini-2.5-flash", temperature: 0.1, response_format: { type: "json_object" }, ... })`.
- Ajustar parsing para `choices[0].message.content` (JSON puro, sem cercas markdown esperadas — o `response_format: json_object` já garante).
- Atualizar mensagens de erro/log (trocar "Claude" por "IA").

## Alterações — `src/components/admin/InfoSistemaTab.tsx`

Trocar "GPT-4o" / "OpenAI" por Gemini nas descrições:

- **L142** — `"OpenAI (GPT-4o)"` → `"Google Gemini (gemini-2.5-flash)"`. Descrição: "IA generativa (Gemini Flash) para resumo de publicações, detecção de audiências, análise de documentos, classificação TST e assistente jurídico."
- **L186** — Análise DJEN: "OpenAI GPT-4o" → "Gemini 2.5 Flash".
- **L205** — Assistente IA: "GPT-4o" → "Gemini 2.5 Flash".
- **L286** — `resumir-publicacoes`: "GPT-4o" → "Gemini".
- **L345** — `repositorio-chat`: "GPT-4o" → "Gemini 2.5 Flash".
- **L451** — "GPT-4o para detectar audiências" → "Gemini 2.5 Flash para detectar audiências".

## Fora do escopo / observações

- **Segredo `ANTHROPIC_API_KEY`**: após a migração ele deixa de ser usado. Posso deixar o segredo cadastrado (inofensivo) ou remover — sinalize se quer que eu remova.
- `resumir-publicacoes` continua com `gemini-2.5-pro` (não estava na sua lista). Se quiser padronizar tudo em `flash`, me avise que incluo. Idem `comparar-dj-santander`, `complementar-planilha-tst`, `ia-preagendar-djen`, `analisar-publicacao-ia`, `analisar-prazos-drive`, `analisar-tst-prompt-ia` (todos já Gemini, mas com modelos variando entre `flash` e `pro`).
- Nenhuma alteração de schema/RLS.
- Após deploy, testar: uma análise TST via `/processos/:id` (aba TST) e a classificação de publicações TST no fluxo DJEN.
