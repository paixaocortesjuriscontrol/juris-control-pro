## Mudança única

Arquivo: `src/hooks/useDjenTermosParalelaEngine.ts`, linha ~1208.

Hoje, quando uma busca volta com 0 resultados, a engine faz **uma segunda tentativa automática** após 1,5s. Útil para palavra-chave (a API às vezes retorna vazio por falha transitória), mas para `tipo === 'processo'` "0 resultados" é o caso normal (o CNJ não existe naquele tribunal) — e o retry dobra o tempo da Paralela.

Alterar a condição do bloco de retry de:

```ts
if (tipo !== 'parte' && !signal.aborted && resultados.length === 0) {
```

para:

```ts
if (tipo !== 'parte' && tipo !== 'processo' && !signal.aborted && resultados.length === 0) {
```

Para `tipo === 'processo'` continua exatamente como hoje: uma única busca por `numeroProcesso` em cada (tribunal × dia), sem retry e sem fallback para palavra-chave.

## Não muda

- Nada de palavra-chave para processo.
- Nada nos outros tipos (advogado, palavra-chave, parte, nome).
- Nada de schema, fila, concorrência ou UI.

## Efeito

Para a coordenação do Dr. Thomás (173 termos `processo` × 26 tribunais × dias), o tempo total deve cair pela metade na parte de processos, sem alterar resultado.