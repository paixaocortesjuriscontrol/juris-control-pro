## Objetivo

Hoje, o motor DJEN Paralela cria 1 worker por VPS, cada worker pega um TRIBUNAL inteiro da fila e processa TODOS os tipos (parte, advogado, palavra-chave, processo) sequencialmente nesse tribunal. Isso faz o TST ficar preso em 1 única VPS, processando ~112 monitoramentos de `parte` + outros tipos um a um.

Vou trocar a unidade de trabalho de **`tribunal`** para **`(tipo, tribunal)`**, distribuindo as VPS por tipo de busca para maximizar o paralelismo real.

## Como vai funcionar

```text
ANTES (1 worker/VPS, fila por tribunal):
VPS-A: TST [parte+adv+kw+proc] → STF [parte+adv+kw+proc] → ...
VPS-B: STJ [parte+adv+kw+proc] → ...

DEPOIS (1 worker/VPS, fila por (tipo, tribunal), VPS fixa em 1 tipo):
VPS-A (parte):         TST·parte    → STF·parte    → STJ·parte    → ...
VPS-B (advogado):      TST·adv      → STF·adv      → STJ·adv      → ...
VPS-C (palavra-chave): TST·kw       → STF·kw       → ...
VPS-D (processo):      TST·proc     → STF·proc     → ...
(quando a fila do tipo primário esvazia, a VPS rouba units dos outros tipos)
```

Com 4+ VPS, os 4 tipos rodam em paralelo no mesmo tribunal (TST·parte e TST·adv ao mesmo tempo, em IPs diferentes — sem 429). Com menos VPS, a distribuição é round-robin por tipo e o trabalho continua maximizado.

## Mudanças no código

### `src/hooks/useDjenTermosParalelaEngine.ts`

1. **Track key**: passa de `tribunal` para `${tipo}|${tribunal}` (ex.: `parte|TST`). Cada combinação vira uma linha na UI: "TST · parte", "TST · advogado", etc. Total de tracks = soma de (tribunais aplicáveis a cada tipo).

2. **Build de filas por tipo**:
   - Agrupar `monitoramentos` por `tipo` (com `nome` → `palavra-chave`).
   - Para cada tipo, listar os tribunais aplicáveis (união dos `tribunais` dos monitoramentos daquele tipo).
   - Criar `queues: Record<tipo, string[]>` com tribunais ordenados (TST/STF/STJ primeiro).

3. **Assignment de VPS → tipo primário**: round-robin sobre os tipos presentes. Cada worker recebe `{ via, tipoPrimario }`.

4. **Loop do worker**:
   ```text
   while (alguma fila não vazia):
     1. Tenta pegar próximo tribunal da fila do tipoPrimario.
     2. Se vazia, rouba do próximo tipo com fila não-vazia (round-robin).
     3. Processa (tipo, tribunal) — chama `processarTribunalTrack` filtrando `monsParaEsseTrib` por `mon.tipo === tipo`.
   ```

5. **`processarTribunalTrack(tribunal, tipo, ...)`**: ganha novo parâmetro `tipo`. Filtra `monsParaEsseTrib` por aquele tipo. Atualiza track pela chave `${tipo}|${tribunal}`.

6. **Agregados globais (novas/dup/desc/percentage)**: continuam somando todas as tracks — sem mudança visível além de mais linhas.

7. **Checkpoint**: `tribunaisConcluidos: string[]` vira `unidadesConcluidas: string[]` armazenando `${tipo}|${tribunal}`. Migration silenciosa: checkpoints antigos são ignorados (já caem por idade ou runKey).

8. **Mensagem inicial e `concorrencia`**: passa a indicar `V VPS × T tipos = N workers ativos`, mas N segue limitado por nº de VPS (cada VPS continua sendo 1 worker; o que muda é a granularidade do que ela puxa).

### `public/version.json`
Bump para `1.1.0` (mudança de arquitetura).

## Detalhes técnicos

- **Anti-429**: hoje `HOST_BUCKET_LIMITS['pje-comunica'] = 1` era para limitar paralelismo no mesmo IP. Como cada VPS = IP distinto, 4 VPSs rodando 4 tipos contra o mesmo host é seguro (era exatamente esse o desenho do pool).
- **Sticky por tipo**: evita que a mesma VPS alterne tipos toda hora (cada `tipo` tem um payload de URL diferente — manter sticky ajuda no cache do upstream e na leitura dos logs).
- **Steal cross-tipo**: quando o tipo primário acaba, a VPS não fica ociosa — pega trabalho dos outros tipos, garantindo que a última VPS livre não vire gargalo.
- **`forceVia` e fallback**: continuam idênticos; o `viaId` é repassado para `processarTermoEmTribunal` como hoje.
- **Sem fallback por palavra-chave em `parte`**: já está bloqueado nas alterações anteriores; nada muda aqui.

## Não muda

- Validações por metadados estruturados (parte/advogado).
- Dedup, hash, persistência em `publicacoes_djen`.
- Cooldown global PJE.
- Edge functions e cron — só o motor cliente é alterado.