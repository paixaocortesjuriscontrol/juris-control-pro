# Mudança mínima: TST começa com `pageSize=10`

Concordo — se fosse VPS, o erro apareceria espalhado nos outros tribunais. O padrão (TST em parte, advogado e palavra-chave, todos com `⚠ fetch failed`) aponta para páginas grandes/lentas do TST estourando o timeout de 90s do fetch.

## O que muda

Em `monitor-servidor/engines/paralela.js`:

1. `buscarPaginado(slot, params, signal)` passa a receber (ou ler de `params.siglaTribunal`) o tribunal.
2. Definir o tamanho inicial de página:

```js
const PAGE_SIZE_INICIAL = tribunal === "TST" ? 10 : 50;
```

3. No loop principal, trocar `fetchWindow(windowIdx, 50)` por `fetchWindow(windowIdx, PAGE_SIZE_INICIAL)`, mantendo a degradação existente para 10 quando falhar (para TST vira no-op, já está em 10).

Cada janela lógica continua sendo de 50 itens — no TST ela passa a ser buscada como 5 sub-páginas de 10, que é exatamente o caminho de degradação que o motor já usa hoje, só que sem gastar antes 4 tentativas de até 90s numa página de 50.

## Efeito esperado

- Some o `fetch failed` no TST causado por timeout em páginas grandes.
- TST fica um pouco mais lento por unit (5 requisições no lugar de 1 por janela), mas com o `PAGE_DELAY_MS` já existente e sem os ~6 min perdidos por janela que falhava.
- Nenhum outro tribunal é afetado.

## Detalhes técnicos

Arquivo único: `monitor-servidor/engines/paralela.js`. Sem mudanças de schema, Edge Functions ou frontend. Deploy é do daemon `monitor-servidor` na VPS.
