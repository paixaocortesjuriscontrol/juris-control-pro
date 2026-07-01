## Objetivo

Reduzir o tempo total da execução `djen_paralela_servidor` de ~40-60 min para ~5-10 min aproveitando as 10 VPS de verdade. Escopo restrito a `monitor-servidor/engines/paralela.js` (respeita `mem://constraints/djen-servidor-isolated-from-browser`).

## Diagnóstico

Execução em curso (`f1d54f45`, 13 min): 10 VPS no pool, mas apenas 6-7 ativas de fato — o resto ocioso "Aguardando VPS…". O gargalo tem 3 camadas somadas:

1. **Cards grandes não fatiáveis** — TST/parte tem 118 termos em **1** unit, presa a **1** VPS (Hostinger 1: 34/118 em 13 min). TST/advogado tinha 28 termos, 1178 descartadas → também demorou muito em 1 chip. Cauda longa: a rodada termina no ritmo da unit mais pesada.
2. **Delays internos conservadores** — `TERM_DELAY=2500ms`, `PAGE_DELAY=800ms`, `PARTE_OR_DELAY=1800ms`. Foram calibrados para 1 VPS; com 10 IPs paralelos falando com a PJE Comunica, cada IP pode ser mais agressivo (rate limit é por IP).
3. **Ordenação por prioridade, não por peso** — dentro de cada banda, `pickNext` pega quem chegou primeiro (`shift`). Os cards mais pesados acabam pegos por último → cauda longa amplificada.

## Escopo

Somente `monitor-servidor/engines/paralela.js`. Nada em `useDjenTermosParalelaEngine.ts`. Nada tocando `publicacoes_djen`. Nada de novo failover, cache ou cross-source rescue.

## Mudanças

### 1. Sharding de cards grandes (ganho principal, esperado ~5×)

Onde: bloco que monta `itens` (linhas 1213-1244).

- Constantes novas (env-configuráveis):
  - `SHARD_SIZE = 12` (default) — máximo de termos por unit.
  - `SHARD_MIN = 6` — não fatiar cards com menos que isso.
- Se `grupo.monitoramentos.length > SHARD_SIZE`, dividir em chunks de `SHARD_SIZE` termos. Cada chunk vira uma unit independente com:
  - `id = "tipo|tribunal|shardN"` (mantém prefixo `tipo|tribunal` para agrupamento na UI)
  - `cardKey = "tipo|tribunal"` (novo campo)
  - `monitoramentoIds` = subconjunto do chunk
  - `shardIdx / shardTotal` (novos campos)
- Cada shard é elegível para **qualquer** VPS livre da pool.

### 2. Agregação no `progresso.itens` para não quebrar UI

Onde: `flushProgresso` (linhas 1311-1346).

- Antes de gravar, colapsar shards do mesmo `cardKey` em 1 item visível:
  - `current = Σ current`, `total = Σ total`
  - `novas / duplicatas / descartadas = Σ`
  - `status = "concluido"` só se **todos** os shards terminaram; senão `"executando"`
  - `via = { multiplas: true, labels: [chips ativos] }` — o `DjenServidorParalelaCard.tsx` já mostra 1 chip por card; adicionar suporte a lista de chips fica como task cosmética separada, mas o texto do 1º shard ativo já é suficiente para não regredir a UI.
- Checkpoint (linhas 1246-1308): salvar unidades concluídas por `shard id` (não por `cardKey`). Ao retomar, cada shard já feito é pulado individualmente. Absorção lê `pi.id` do checkpoint anterior (nova chave `shardN` bate; execuções velhas sem shard viram 1 shard só, compatível).

### 3. Delays mais agressivos (ganho ~30-40%)

Onde: constantes topo do arquivo (linhas 18-20).

Novos defaults, sobreponíveis por env:
- `PARALELA_PAGE_DELAY_MS` 800 → **400**
- `PARALELA_TERM_DELAY_MS` 2500 → **1000**
- `PARALELA_PARTE_OR_DELAY_MS` 1800 → **800**

Justificativa: cada VPS é IP distinto; o rate limit da PJE Comunica é por IP. O motor do Browser (`useDjenTermosParalelaEngine.ts`) roda com essa faixa e não é bloqueado. Retries por 429/5xx (linhas 855-874) mantidos como estão — se a API endurecer, o backoff cobre.

### 4. Scheduling LPT (Largest Processing Time first)

Onde: montagem das bands (linhas 1381-1396) e `pickNext` (linhas 1410-1422).

- Dentro de cada banda, ordenar por `total` desc antes de expor à fila. `pickNext` continua fazendo `shift()`, mas agora o primeiro é o mais pesado da banda de maior prioridade. Elimina cauda longa: o card grande entra primeiro, seus shards distribuídos entre as VPS livres.
- Nenhuma mudança na ordem entre bandas (TST > STF/STJ > demais > processo permanece).

### 5. Failover 5xx com short-circuit (ganho pequeno, previne travas em pico)

Onde: linhas 1511-1527.

- Trocar loop serial por: tentar até 2 slots alternativos aleatórios; se ambos 5xx, cair para `recordFalha` (refila na próxima rodada). O tempo de recuperação por par (mon, dia) cai de até 30-90s para <5s em cenários de pico 5xx.

## Fora de escopo

- Reduzir descartadas (1178 no TST/adv, 1002 no TRT2/adv…) — precisa revisar termos ruidosos por coordenação; não faz parte deste plano.
- Mudanças de UI (`DjenServidorParalelaCard.tsx`) além do que o `progresso` já expõe.
- Mudanças em `monitorar-djen`, engines Kurier/Pautas, ou hooks do Browser.
- Alteração da tabela `publicacoes_djen_servidor` ou constraints.

## Como validar

1. Rodar próxima execução `djen_paralela_servidor` com dias BRT idênticos e comparar tempo total no `execucoes_servidor.resultado` vs. execuções recentes (ex.: `f1d54f45`).
2. Meta: **≤ 10 min** para uma rodada com ~35 cards e ~400 termos totais (dia normal).
3. Conferir no `progresso.itens` que o card TST/parte mostra `current` avançando com múltiplos shards ao mesmo tempo (verificar via query em `progresso->'itens'`).
4. Rodar Comparador Servidor × Browser: a contagem por coordenação **não pode** aumentar/diminuir vs. rodada anterior (mesma dedup, mesma validação; só mudou paralelismo).
5. Verificar `execucoes_servidor_falhas`: não deve crescer significativamente (indicaria que os delays novos derrubaram a API).

## Rollback

Todas as constantes têm env vars. Se algum tribunal começar a devolver 429 em massa, subir `PARALELA_PAGE_DELAY_MS=800` no `.env` do daemon e reiniciar; o comportamento volta ao atual sem redeploy de código.
