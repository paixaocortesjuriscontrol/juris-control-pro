# Corrigir o `fetch failed` no DJEN Termos Servidor

## O que foi verificado agora

Na tabela `execucoes_servidor_falhas` (execução de hoje, 27/07, 12:18–12:20) os itens falhados registram `ultimo_erro: "fetch failed"` — e não apenas no TST: há também `TJBA` e `TRT16` com o mesmo erro. Ou seja, o ajuste anterior (TST começando com `pageSize=10`) atacou o sintoma errado: o problema não é o tamanho da página, é o tratamento do erro de rede.

## Causa confirmada no código

Em `monitor-servidor/engines/paralela.js`, o bloco de recuperação por par (tribunal, monitoramento, dia) só considera erro recuperável quando a mensagem casa com:

```js
const is5xx = /HTTP\s*5\d\d/.test(msg) || /Falha ao consultar VPS/.test(msg);
if (!is5xx || cancelled || signal.aborted) throw firstErr;
```

Quando o proxy da VPS estoura o timeout de 90s (`PROXY_REQUEST_TIMEOUT_MS` em `proxyPool.js`) ou a conexão cai, o undici do Node lança literalmente `fetch failed` / `TimeoutError`. Essa string **não** casa com o teste acima, então:

- o **failover para outra VPS não acontece** (o motor tenta 2 slots alternativos só em 5xx);
- o par vai direto para `execucoes_servidor_falhas` e o item aparece como `⚠ fetch failed` na tela.

É por isso que "antes não acontecia": enquanto as VPS devolviam 5xx, o failover salvava; agora estão devolvendo timeout de rede, que passa pela porta sem tratamento.

## O que fazer

Arquivo único: `monitor-servidor/engines/paralela.js`.

1. Criar um classificador único de erro recuperável, substituindo os testes `is5xx` espalhados:

```js
function isErroRecuperavel(msg) {
  return /HTTP\s*5\d\d/.test(msg)
    || /Falha ao consultar VPS/.test(msg)
    || /fetch failed/i.test(msg)
    || /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|network/i.test(msg);
}
```

2. Usar esse classificador nos três pontos:
   - antes do `throw firstErr` (para habilitar o failover entre VPS em erro de rede);
   - no loop dos slots alternativos (`altErr`);
   - no `catch` externo que grava em `execucoes_servidor_falhas`.

3. Em `buscarPaginado`, aplicar a degradação de página também quando o erro for de rede — hoje ela só é acionada por falha genérica de janela, e o TST já entra em `pageSize=10`, o que anula a degradação. Reverter o TST para o mesmo caminho dos demais tribunais (início em 50, degradando para 10 na falha), já que o `fetch failed` não é causado pelo tamanho da página.

4. Manter o registro em `execucoes_servidor_falhas` apenas quando **todos** os slots tentados falharem — assim a refila continua funcionando como rede de segurança.

## Deploy (importante)

O daemon `monitor-servidor` roda na VPS sob pm2 e **não é atualizado pelo deploy do app**. Para o ajuste anterior (e este) valerem, é preciso na VPS:

```bash
cd <pasta>/monitor-servidor && git pull && pm2 restart jc-monitor-servidor
```

Se isso não foi feito depois do último ajuste, a execução de hoje rodou com o código antigo — o que explica o "não adiantou nada". Vale confirmar antes de julgar o resultado da próxima execução.

## Detalhes técnicos

Sem mudanças de schema, Edge Functions ou frontend. Nenhum comportamento de captura/persistência de publicações é alterado — apenas a classificação de erro e o roteamento de retry entre VPS.
