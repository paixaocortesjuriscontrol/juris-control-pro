## Objetivo

Tornar o `monitor-servidor/engines/paralela.js` idêntico em comportamento de execução ao DJEN Termos Paralela do browser (`src/hooks/useDjenTermosParalelaEngine.ts`). Hoje as duas engines têm a mesma lógica de matching/validação, mas o **paralelismo é diferente** — e é isso que torna o servidor lento.

## Diferenças que sobraram entre Server e Browser

| Aspecto | Browser (referência) | Server (hoje) |
|---|---|---|
| Granularidade da unit | 1 unit por **(tipo, tribunal, monitoramento)** | 1 unit por **(tipo, tribunal)** agrupando vários monitoramentos. Só TST é dividido. |
| `delay_between_terms` (2500ms) | Aplicado entre units (absorvido pelo paralelismo) | Aplicado **dentro** da unit, entre cada (mon, dia) — vira tempo morto sequencial |
| Retry inicial de falhas | Não existe loop bloqueante | Loop serial usando 1 VPS antes da fila principal |
| Resgate de partes via corpus | Não existe | `buscarPublicacoesParteServidorJaEncontradas` faz query extra de até 5000 linhas por (mon parte, dia, tribunal) |
| Retry em vazio | 1 retry na mesma VPS (1.5s) | 1 retry na mesma VPS + 1 retry em **cada** VPS de fallback (1.5s cada) |

Browser tem `MAX_CONCURRENCY=5`, `delay_between_terms=2500`, `delay_between_pages=1800`, `delay_between_termos_or=1800`. Server já tem esses valores nos defaults — a divergência é só no **modelo de fila**.

## Alterações necessárias (todas em `monitor-servidor/engines/paralela.js`)

### 1. Quebrar units por monitoramento — igual browser

Hoje (linha ~807-808):
```js
const splitTst = tribunal === "TST" && tipo !== "processo";
const key = splitTst ? `${tipo}|${tribunal}|${m.id}` : `${tipo}|${tribunal}`;
```

Mudar para:
```js
const key = tipo === "processo" ? `${tipo}|${tribunal}` : `${tipo}|${tribunal}|${m.id}`;
```

Cada termo vira uma unit. As 6 VPS do pool consomem em paralelo de verdade, como o browser faz.

### 2. Remover o `TERM_DELAY_MS` interno entre (mon, dia)

Com units de 1 monitoramento só, o loop `for (const monId of unit.monIds)` (linha ~1065) terá sempre 1 iteração. O `await delay(TERM_DELAY_MS)` na linha ~1109 vira inútil dentro da unit. Trocar por delay **entre units consumidas pelo mesmo worker** (já é o comportamento natural quando `pickNext` retorna a próxima unit). Implementação: aplicar `TERM_DELAY_MS` no `worker()` ao final do `processUnit`, não dentro do loop.

### 3. Paralelizar o retry inicial de falhas

Hoje (linhas 1014-1056) o retry roda serial em `slots[0]` antes da fila principal — bloqueia ~90s se há 30 falhas pendentes.

Mudar para: ao montar as bandas, adicionar as falhas pendentes como units extras na **banda correspondente** (band 0 se TST, band 1 se STF/STJ, band 2 se demais). Remover o loop pré-fila. Os workers consomem retry e fila nova em paralelo.

### 4. Desabilitar/condicionar o resgate de partes via corpus

`buscarPublicacoesParteServidorJaEncontradas` (linhas 354-394, chamada na 649) não existe no browser e roda por (mon parte, dia, tribunal). Não é necessário para paridade.

Trocar por flag `PARALELA_PARTE_RESCUE_CORPUS=false` (default) — só roda se o env ligar explicitamente. Browser não tem isso.

### 5. Cortar o retry agressivo em fallback slots

Hoje (linhas 615-631) em busca vazia o engine percorre **todas** as VPS de fallback com 1.5s entre cada.

Browser faz só 1 retry na mesma VPS. Trocar o `for (const alt of fallbackSlots)` por: tenta no máximo **1 VPS alternativa** e só quando o tipo é `parte` (caso documentado nas linhas 609-614 — ausência de OSMAR CORTES). Para `advogado`/`palavra-chave`, vazio = vazio.

## Resultado esperado

- Paralelismo real de 6 VPS em vez de 1-2 efetivo.
- Sem tempo morto sequencial dentro de units grandes.
- Sem bloqueio de ~90s no início para retry.
- Tribunais sem resultado deixam de gastar ~9s cada.
- Estimativa: 30-45min → 8-12min em coordenações grandes (mesmo perfil do browser).

## Arquivos

- `monitor-servidor/engines/paralela.js` — única alteração.
- Sem mudança de schema, sem mudança no UI, sem mudança no edge function.
- Após deploy: `git pull && pm2 restart jc-monitor-servidor` na VPS Hostinger.

## Riscos

- Quebrar units cresce o array `itens` no `progresso`. O throttle de 800ms em `flushProgresso` continua suficiente; payload sobe de ~60 para ~300 entradas, ainda dentro do limite do Postgres jsonb.
- Cortar retry de fallback em `advogado`/`palavra-chave` segue o browser exatamente — se o browser não perde, o servidor também não perde.
- Desligar o corpus rescue é seguro porque a regra "1 publicação por (coordenação, id_djen)" já é garantida pelo unique index, e o browser nunca usou esse rescue.
