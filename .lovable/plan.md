## Diagnóstico

Sua impressão está correta — no DJEN **Local** ainda está serial por tribunal, mesmo com muitas VPS no pool. O que aparece na tela ("TRF3 Parte • 8 termos • Google VPS 4/6/Hostinger 1/…") é só o histórico da última VPS usada em cada chamada, **não paralelismo real**.

Motivo, em `src/hooks/useDjenTermosParalelaEngine.ts` (bandas 1 e 2, linhas ~2229-2248):

```ts
const pushUnitsPorTipo = (fila, band, trib) => {
  for (const tipo of ORDEM_TIPOS_PRINCIPAIS) {
    ...
    fila.push({ band, tribunal: trib, steps: [{ tipo, monIds: [null] }] });
    //                                                    ^^^^^^ 1 unidade só
  }
};
```

`monIds: [null]` significa **1 única unidade** por (tribunal, tipo). Dentro do worker, `processarTribunalTrack` itera os 8 termos do TRF3/Parte em série. Concorrência efetiva = 1, independente do tamanho do pool.

O servidor (`monitor-servidor/engines/paralela.js`) já resolveu isso em 01/07 com `CHUNK_MAX=8` (sub-lotes) — só o Local ficou pra trás.

## Plano

Replicar a estratégia de **sub-lotes** do servidor no motor local, sem tocar em TST (banda 0 já é 1 unidade por termo) nem em `processo` (banda 3 continua 1 por tribunal).

### Mudanças em `src/hooks/useDjenTermosParalelaEngine.ts`

1. Constante nova no topo do arquivo:
   ```ts
   const CHUNK_MAX = 8; // termos por sub-lote em bandas 1/2 (STF/STJ/TRT/TJ/TRF)
   ```

2. Reescrever `pushUnitsPorTipo` para dividir os monitoramentos daquele (tribunal, tipo) em fatias de até 8 e enfileirar 1 unidade por fatia:
   ```ts
   const monsAtivos = (monsPorTipo.get(tipo) || []).filter(m =>
     expandirTribunaisDoMon(m.tribunais).includes(trib) ||
     expandirTribunaisDoMon(m.tribunais).length === 0
   );
   for (let i = 0; i < monsAtivos.length; i += CHUNK_MAX) {
     const slice = monsAtivos.slice(i, i + CHUNK_MAX);
     fila.push({
       band, tribunal: trib,
       steps: [{ tipo, monIds: slice.map(m => m.id) }],
     });
   }
   ```

3. Adaptar a criação de `tracks` (linhas 2058-2113) para bandas 1/2:
   - Se o (trib, tipo) tem mais de `CHUNK_MAX` termos, criar 1 track por sub-lote (label "N termos • lote k/K").
   - Se tem ≤ CHUNK_MAX, mantém 1 track única com os termos do lote (comportamento atual).
   - `trackKey` ganha o sufixo `|c{k}` (idêntico ao servidor) pra checkpoint não colidir.

4. `processarTribunalTrack` já aceita `monIdAtual` específico — o loop de `step.monIds` no worker (linhas 2363-2397) já itera termo a termo persistindo checkpoint. Basta ele receber os IDs reais em vez de `[null]`.

5. Checkpoint: `unidadesJaConcluidas` passa a comparar chaves com sufixo `|c{k}`. Checkpoints antigos ficam obsoletos apenas para essa execução (o motor já lida com isso graciosamente — refaz o tribunal sem erro).

### Resultado esperado

- **TRF3 Parte** com 8 termos + 8 VPS: hoje = 8 chamadas seriais em 1 VPS. Depois = 8 unidades paralelas, uma por VPS → ~1/N do tempo.
- **TST parte** (banda 0): sem mudança, já rodava paralelo por termo.
- **Processo** (banda 3): sem mudança, continua 1 unidade por tribunal.
- **STF/STJ**: se tiverem >8 termos ganham sub-lotes também.

### Observação

`CHUNK_MAX=8` casa com o servidor. Se quiser posso deixar exposto como config (`localStorage.djen_local_chunk_max`) pra ajustar sem redeploy — só me avise.

Nenhuma mudança em RLS, edge functions, tabelas ou no motor do servidor.