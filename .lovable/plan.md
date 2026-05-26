## Causa real

O botão manual do Kurier (card) chama:

```ts
executar(ymd(dataInicio), ymd(dataFim), coord, monIds, /* modoPersonalizado */ true)
```

→ `executarDjenTermosKurier(false, monIds, coord, dataInicio, dataFim, false, true)`

O scheduler automático chama:

```ts
executarDjenTermosKurier(false, undefined, undefined, hojeYmd, hojeYmd)
```

Sem `modoPersonalizado`. Isso cai em outro caminho da edge function (endpoint diferente) e termina rápido sem buscar direito.

## Mudança

Arquivo: `src/hooks/useDjenTermosKurierScheduler.ts`, linha 92.

Trocar a chamada para passar `modoPersonalizado = true`, mantendo `hoje → hoje`:

```ts
void executarDjenTermosKurier(
  false,         // retomar
  undefined,     // monitoramentoIds
  undefined,     // coordenacaoId
  hojeYmd,       // dataInicioYmd
  hojeYmd,       // dataFimYmd
  false,         // drenarBacklog
  true,          // modoPersonalizado  ← igual ao botão manual
);
```

Nada mais muda. Sem alterações em engine, edge function, banco ou Paralela.

## Efeito

Execução automática do Kurier passa a ser idêntica à manual, restrita ao dia de hoje.