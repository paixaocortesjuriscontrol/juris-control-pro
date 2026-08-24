---
name: Gemini model deprecations
description: gemini-2.5-pro foi removido pelo Google; compatibilizador redireciona modelos pro para GEMINI_PRO_MODEL (gemini-3.1-pro-preview) e faz fallback 404 para gemini-flash-latest
type: feature
---
`supabase/functions/_shared/gemini-openai-compat.ts` centraliza a compatibilidade de modelos:

- Modelos "pro" descontinuados (`gemini-2.5-pro`, `gemini-1.5-pro`, `gemini-pro`) → `GEMINI_PRO_MODEL` (default `gemini-3.1-pro-preview`).
- Modelos flash descontinuados (`gemini-2.5-flash`, `gemini-1.5-flash`) → `gemini-flash-latest`.
- Se o Google responder **404** (modelo indisponível para a conta), o compatibilizador repete a chamada automaticamente com `gemini-flash-latest` e loga o modelo efetivamente usado em `ai_usage_logs`.

Nunca fixe um id de modelo Gemini novo em Edge Functions individuais: adicione o alias aqui.
