# Judit fora do ar: chave/conta rejeitada (401 USER_NOT_FOUND)

## O que os dados mostram

- Último sucesso da Judit: **hoje, 10:44 UTC (07:44 BRT)**. Depois disso, **86 consultas falharam** nas últimas 24h (`judit_logs`).
- Todas as falhas gravam o mesmo retorno: `{"crawler": null, "cache_lookup": null}` — ou seja, nem o cache (`GET /lawsuits/:cnj`) nem o crawler (`POST /requests`) devolveram nada.
- O log da função `buscar-judit` na consulta do processo 0000999-06.2022.5.23.0037 (22:11 UTC) mostra a causa real:

```text
POST /requests 401: {"error":{"name":"HttpUnauthorizedError","message":"UNAUTHORIZED","data":"USER_NOT_FOUND"}}
```

Ou seja: **a Judit está recusando nossa autenticação**. `USER_NOT_FOUND` é resposta da Judit para chave revogada/rotacionada ou conta suspensa (ex.: falta de saldo/plano). Não é o processo que "não tem dados" — a mensagem que aparece na tela ("Judit não retornou dados para este processo") é apenas o texto genérico que a função devolve quando as duas chamadas voltam vazias, mascarando o erro de autenticação.

Isso afeta todas as telas que usam Judit: Processos e Casos, Distribuição TST, Acompanhamento Especial, anexos e download de documentos.

## Como resolver

### 1. Restabelecer o acesso (fora do código, e é o que realmente destrava)
Confirmar no painel da Judit se a chave atual foi revogada/rotacionada e se a conta/plano está ativo. Com a chave nova em mãos, atualizo o segredo `JUDIT_API_KEY` do projeto — nada mais precisa mudar.

### 2. Mensagem de erro honesta na tela
Hoje qualquer falha vira "Judit não retornou dados para este processo". Vou distinguir os casos nas funções Judit:

- HTTP 401/403 → "Judit recusou a autenticação (chave inválida ou conta sem acesso). Avise o suporte."
- HTTP 429 / 5xx → "Judit temporariamente indisponível, tente novamente em alguns minutos."
- resposta válida porém vazia → mantém a mensagem atual de "sem dados".

### 3. Registro do erro real no log
Gravar em `judit_logs` o status HTTP e o código de erro devolvido pela Judit (hoje isso só aparece no log da Edge Function e se perde). Assim a tela Consumo Judit mostra na hora quando o problema é de credencial.

### 4. Aviso ao suporte
Quando ocorrerem falhas 401/403 repetidas, enviar um e-mail único (com janela de 1x por hora) para `suporte@paixaocortes.adv.br`, no mesmo padrão dos alertas de VPS, para não descobrirmos por reclamação de advogado.

## Detalhes técnicos

- `supabase/functions/buscar-judit/index.ts` e `supabase/functions/busca-judit-processos-e-casos/index.ts`: capturar `response.status` do cache e do `POST /requests`, propagar em `_judit_raw.http_status` / `_judit_raw.judit_error` e escolher a mensagem por faixa de status antes do retorno genérico de "não retornou dados".
- Mesma classificação em `sincronizar-judit-anexos` e `download-anexo-judit` (já leem `r.status`, falta o texto amigável).
- `judit_logs`: preencher `error_message` com `HTTP <status> — <código Judit>` e `raw_response` com o corpo truncado.
- Alerta de suporte reaproveitando o helper de envio de e-mail já usado em `verificar-saude-pool-djen`, com deduplicação por hora.
