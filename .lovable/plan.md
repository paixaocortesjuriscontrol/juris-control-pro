# Judit em Processos e Casos: resposta rápida (cache primeiro)

## O que está acontecendo

Verifiquei os logs da consulta que você acabou de fazer no processo 0100715-02.2024.5.01.0343:

- início: 01:47:04
- fim: 01:48:09

Ou seja, **65 segundos**. A causa não é o volume de dados (191 andamentos): a função `busca-judit-processos-e-casos` sempre faz o caminho lento, mesmo quando o dado já está pronto. Hoje ela:

1. consulta o cache da Judit (`/lawsuits/{cnj}`) — resposta em ~1s;
2. **mesmo com o cache respondendo**, abre um novo request no crawler (`POST /requests`);
3. fica em polling desse request até ele completar ou até estourar o timeout de 60s.

O passo 3 é o que consome praticamente todo o tempo.

## O que vou mudar

### 1. Caminho rápido quando o cache já tem os dados
Se o cache da Judit responder com dados (partes, andamentos ou órgãos) e o usuário **não** pediu atualização forçada nem anexos, a função devolve imediatamente — em torno de 1 a 3 segundos — com todos os campos e os andamentos normalizados. Nada de crawler, nada de polling.

### 2. Atualização em segundo plano (sem esperar)
Nesse caminho rápido, o pedido ao crawler continua sendo disparado, mas sem bloquear a resposta: ele fica atualizando o cache da Judit para a próxima consulta. O usuário não espera por isso.

### 3. Timeout de polling menor e mais informativo
Quando o crawler realmente é necessário (força atualização, anexos, ou cache vazio), reduzo o tempo máximo de espera de 60s para 35s e devolvo o que já houver, marcando no retorno que o resultado é parcial. Assim a tela nunca fica mais de ~35s travada.

### 4. Sinalização na tela
O retorno passa a indicar a origem (`cache` ou `crawler`) e o tempo gasto. Na tela Processos e Casos o aviso fica explícito: "Judit (cache) — resposta imediata" ou "Judit atualizada pelo crawler". O botão "Judit c/ anexos" segue no caminho completo, porque anexos só existem via crawler.

Nada muda no preenchimento de campos nem na gravação dos andamentos — apenas o tempo de resposta.

## Detalhes técnicos

- `supabase/functions/busca-judit-processos-e-casos/index.ts`
  - após `juditCache`, retornar cedo quando `cached` tem conteúdo e `!forceRefresh && !withAttachments`;
  - disparar `juditCriarRequest` sem `await` do polling nesse caminho (fire-and-forget, com `catch` para não gerar rejeição não tratada);
  - `POLL_TIMEOUT_MS`: 60_000 → 35_000;
  - incluir em `_judit_meta`: `origem` ("cache" | "crawler"), `parcial` (bool) e `elapsed_ms`.
- `src/components/processos/ProcessoVisaoGeralForm.tsx`
  - ajustar as mensagens de toast em `handleFetchJuditOnly` para refletir `_judit_meta.origem`.
