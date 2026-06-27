## Problema

No `monitor-servidor/engines/paralela.js` (linha 1127), só o tipo `processo` agrupa termos por tribunal:

```js
const key = tipo === "processo" ? `${tipo}|${tribunal}` : `${tipo}|${tribunal}|${m.id}`;
```

Para `parte` e `advogado`, cada termo vira um item/card próprio. Resultado: TRT2 Parte aparece 6+ vezes, multiplicando chamadas à API DJEN e gerando 429.

## Mudança

Voltar a agrupar todos os tipos por `(tipo + tribunal)`, igual ao que era antes:

```js
const key = `${tipo}|${tribunal}`;
```

Isso faz:
- 1 card por (tipo + tribunal) na tela "Tribunais"
- Todos os termos do mesmo tipo/tribunal executam em sequência no mesmo slot/VPS
- Reduz drasticamente o número de chamadas e o risco de rate-limit

## Arquivo

- `monitor-servidor/engines/paralela.js` — alterar a linha 1127 para usar a chave unificada `${tipo}|${tribunal}` (remover o ramo condicional do `processo`).

## Pós-deploy

A VPS precisa de `git pull` + `pm2 restart jc-monitor-servidor` para aplicar.

Nenhuma mudança no frontend, banco ou edge functions.