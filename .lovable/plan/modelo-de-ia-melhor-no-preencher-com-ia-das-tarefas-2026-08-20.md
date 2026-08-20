# Modelo de IA melhor no "Preencher com IA" das tarefas

Hoje o preenchimento automático de tarefas/prazos/eventos/audiências a partir de publicações usa o modelo rápido (`gemini-2.5-flash`, que o compatibilizador redireciona para `gemini-flash-latest`). Para títulos e descrições mais precisos, o preenchimento passa a usar o modelo mais capaz (`gemini-2.5-pro`), já utilizado em outras rotinas do sistema (resumos, análise de prazos, comparação de DJs).

## O que muda

- O botão "Preencher com IA" (tarefas, prazos, eventos e audiências) passa a rodar no modelo Pro, gerando títulos e descrições mais fiéis à publicação e melhor extração de datas/horários.
- Se o Pro falhar por limite de requisições (429) ou indisponibilidade momentânea, a análise é refeita automaticamente no modelo rápido, para o usuário nunca ficar sem resposta.
- Nenhuma mudança em prompts por coordenação, campos preenchidos ou telas: apenas qualidade da sugestão.
- Custo: o Pro é mais caro por token (a tela Consumo IA continua registrando tokens e custo por modelo, já com preço do Pro cadastrado). O uso é pontual (só quando o usuário clica), então o impacto é pequeno.

## Detalhes técnicos

- `supabase/functions/analisar-publicacao-ia/index.ts`: `AI_MODEL` passa a ser `Deno.env.get("GEMINI_MODEL_TAREFAS") || "gemini-2.5-pro"` (variável dedicada, para não mexer no `GEMINI_MODEL` global usado por outras funções).
- Envolver a chamada `geminiChatCompletionsFetch` em uma tentativa única de fallback: em resposta 429/5xx com o modelo Pro, repetir com `gemini-flash-latest` antes de retornar erro ao cliente. Os tratamentos atuais de 429 (créditos esgotados) e 402 continuam válidos após o fallback falhar.
- Manter `_ai_usage` com o modelo efetivamente usado, para o log em `ai_usage_logs` refletir custo correto.
- Testar com uma chamada real da função após a alteração e conferir a resposta.
