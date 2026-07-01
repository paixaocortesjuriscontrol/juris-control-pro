## Objetivo

Fazer o DJEN Local Paralela pinar cada termo/unidade a UMA única VPS (igual ao DJEN Servidor), sem espalhar as chamadas do mesmo termo por várias VPS. Isso é o comportamento que existia antes e que o servidor mantém em `monitor-servidor/engines/paralela.js`.

## O que está acontecendo hoje

Em `src/hooks/useDjenTermosParalelaEngine.ts`, dentro de `executarBusca`, a chamada a `buscarPjeComunicaPaginado` passa:

```
forceVia: forceViaOverride,
fallbackToPool: !!forceViaOverride && forceViaOverride !== DIRECT_SLOT_ID,  // → true
fallbackToDirect: forceViaOverride === DIRECT_SLOT_ID,
```

`fallbackToPool: true` faz o cliente rotacionar para outras VPS do pool quando a VPS "dona" do worker falha em qualquer request (5xx, timeout, "Failed to fetch", 429, etc.). Resultado: o mesmo termo aparece com 3+ chips de VPS (o que a Dra. viu no print) e a execução não fica mais rápida — só embaralha rotas.

O servidor (`monitor-servidor/engines/paralela.js`, linhas ~1500-1528) faz o oposto: cada unit é fixada no slot atribuído; só troca de slot em erro persistente 5xx (`HTTP 5xx` ou "Falha ao consultar VPS"). Isso é o que a Dra. quer replicar.

## Mudança

**Arquivo:** `src/hooks/useDjenTermosParalelaEngine.ts`

Dentro de `processarTermoEmTribunal → executarBusca`, ao chamar `buscarPjeComunicaPaginado`:

- Trocar `fallbackToPool: !!forceViaOverride && forceViaOverride !== DIRECT_SLOT_ID` por `fallbackToPool: false`.
- Manter `fallbackToDirect` só quando a via é o browser direto (comportamento atual).
- Manter `forceVia: forceViaOverride` para pinar a VPS.

Isso faz cada worker usar exclusivamente sua VPS. Se essa VPS falhar, o erro sobe para o worker do engine — que já é isolado dos outros (cada worker é um `via` diferente).

**Sem** adicionar failover 5xx entre VPS no browser por enquanto (o pedido é "como estava antes"; a Dra. não pediu retry cross-VPS e reclama que sobra chamada). O worker que falhar registra `erro` na track; o próximo agendamento reprocessa. Se depois quisermos espelhar o failover 5xx do servidor (linhas 1500-1528 de `paralela.js`), fica como passo separado.

## Fora de escopo

- Motor do servidor (`monitor-servidor/engines/paralela.js`) — já está no comportamento pedido, nada muda.
- Kurier, Flash, Servidor, edge functions — não são afetados.
- UI dos cards da Paralela — o próprio efeito de "1 chip de VPS por track" já aparece automaticamente porque `callsByProxy` deixa de acumular contadores em VPSs alternativas.

## Verificação

- Rodar uma Paralela e checar visualmente que cada track (STJ Parte, TRF1 Parte, etc.) mostra apenas UM chip de VPS na linha inferior, e que o tempo total não piora.
