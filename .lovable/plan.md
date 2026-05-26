## Versão simples

Em vez de shards dinâmicos e re-roteamento ao vivo, faço o mínimo: trato cada **monitoramento de parte** como uma unidade de trabalho independente na fila, igual já fazemos hoje com `(tipo, tribunal)`.

Hoje a unidade é `parte|TST` (1 item na fila, 112 monitoramentos dentro). Vou trocar para `parte|TST|<mon.id>` (112 itens na fila, 1 monitoramento cada). Pronto — o pool de VPSs existente puxa esses 112 itens em paralelo automaticamente, sem código novo de sharding, sem re-balance, sem leftover queue.

```text
ANTES: fila parte tem [parte|TST, parte|STF, parte|STJ, ...]
       Worker pega parte|TST → processa os 112 monitoramentos sozinho.

DEPOIS: fila parte tem [parte|TST|m1, parte|TST|m2, ..., parte|TST|m112,
                        parte|STF|m1, ...]
        Cada VPS livre pega 1 item → 1 monitoramento. Paralelismo natural.
```

## Mudanças mínimas em `useDjenTermosParalelaEngine.ts`

1. **Granularidade da fila só para `tipo=parte`**: ao montar `queues['parte']`, expandir cada tribunal em N entradas (uma por monitoramento aplicável). Outros tipos continuam exatamente como estão.

2. **Track key**: aceita formato estendido `parte|TRIBUNAL|MON_ID`. A UI exibe "TST · parte · <termo_busca>" para essa entrada. Para os outros tipos, segue `tipo|tribunal` igual a hoje.

3. **`processarTribunalTrack`** ganha parâmetro opcional `monId?: string`. Quando presente, filtra `monsParaEsseTrib` para esse único monitoramento. Quando ausente, comportamento atual (todos os mons do tribunal).

4. **Checkpoint**: `unidadesConcluidas` aceita as 3 formas (`tribunal`, `tipo|tribunal`, `tipo|tribunal|monId`). Formatos antigos são ignorados.

5. **Bump**: `public/version.json` → `1.2.0`.

## Por que isso é seguro

- Não muda dedup, validação de parte, anti-429, pool de VPS, steal cross-tipo, nem o caminho de busca por `nomeParte`.
- Reaproveita 100% do código de `processarTermoEmTribunal` e da fila atual — só altera **como a fila é construída** para `tipo=parte`.
- Sem instrumentação nova; sem mexer em `CONFIG`/delays.
- Rollback trivial: voltar a expansão da fila para a forma anterior.

## O que NÃO faço (cortado para reduzir risco)

- Sharding por hash com sub-filas dedicadas.
- Leftover queue / re-shard ao vivo.
- Logs de instrumentação por mon.
- Mudanças em delays.

Se depois quisermos investigar a regressão de velocidade percebida, faço em uma rodada separada com logs dedicados — fora deste plano.

## Arquivos tocados

- `src/hooks/useDjenTermosParalelaEngine.ts`
- `public/version.json`
