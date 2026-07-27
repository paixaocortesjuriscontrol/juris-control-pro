# Reverter o motor DJEN Termos Servidor ao comportamento anterior

## Contexto

As duas últimas alterações no daemon foram, nesta ordem:

1. TST passando a iniciar a paginação com `pageSize=10` (em vez de 50);
2. Ampliação do classificador de erro recuperável (`isErroRecuperavel`), que passou a tratar `fetch failed`, timeouts e erros de socket como recuperáveis — habilitando failover entre VPS e degradação de página nesses casos.

O efeito colateral de (2) é exatamente o que você descreve: onde antes o par (tribunal, monitoramento, dia) falhava rápido e ia para a fila de falhas, agora cada timeout de 90s vira várias tentativas em VPS alternativas mais degradação de página — multiplicando o tempo total da execução.

Observação: a alteração (1) já foi desfeita no mesmo commit de (2); hoje o TST segue o caminho padrão. O que resta reverter é (2).

## O que fazer

Arquivo único: `monitor-servidor/engines/paralela.js`.

1. Restaurar o teste de erro recuperável ao critério original, estrito:

```js
const is5xx = /HTTP\s*5\d\d/.test(msg) || /Falha ao consultar VPS/.test(msg);
```

2. Aplicar isso nos três pontos que hoje chamam `isErroRecuperavel`:
   - antes do `throw firstErr` (failover entre VPS volta a ocorrer só em 5xx);
   - no loop dos slots alternativos (`altErr`);
   - no `catch` externo que grava em `execucoes_servidor_falhas`.

3. Remover a função `isErroRecuperavel` e o comentário associado, deixando o arquivo idêntico ao estado anterior às duas mudanças.

4. Confirmar que o TST permanece iniciando em `pageSize=50` com a degradação para 10 apenas em falha (comportamento histórico) — nada a alterar aqui.

Resultado: `fetch failed`/timeout volta a ser erro terminal do par, registrado em `execucoes_servidor_falhas` e recuperado pela refila (`falhasRefila.js`), sem consumir tempo em retries encadeados.

## Deploy (necessário)

O daemon roda na VPS sob pm2 e não é atualizado pelo deploy do app:

```bash
cd <pasta>/monitor-servidor && git pull && pm2 restart jc-monitor-servidor
```

Sem esse passo a execução seguinte continua com o código atual.

## Alternativa sem código

Se preferir voltar o projeto inteiro ao ponto anterior às duas mudanças, dá para usar o histórico de versões do chat em vez de editar o arquivo.

## Detalhes técnicos

Sem mudanças de schema, Edge Functions ou frontend. Nenhuma alteração em captura, validação ou persistência de publicações — apenas classificação de erro e roteamento de retry.
