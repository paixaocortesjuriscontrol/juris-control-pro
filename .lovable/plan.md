## Problema

Hoje a paginação `continueUntilEmpty` (tanto no Browser `src/utils/pjeComunicaClient.ts` quanto no Servidor `monitor-servidor/engines/paralela.js`) encerra a varredura cedo demais em três situações em que a API PJE Comunica é instável:

1. **1 página vazia** → encerra (mas a API às vezes devolve 1 página vazia "no meio" do stream e volta a trazer itens na próxima).
2. **1 página inteira só de duplicados (`added === 0`)** → encerra (mas a API repete páginas anteriores quando troca de partição interna e depois volta a paginar adiante).
3. **Erro HTTP após N retries** → `break` imediato no Browser (no Servidor lança), perdendo as próximas páginas que poderiam vir OK.

Resultado: dias com discrepâncias pontuais (Vanessa TST, Santander Cível, OSMAR/TRT8) por causa de páginas finais não lidas.

## Mudança

Trocar os critérios "parar na 1ª ocorrência" por **"parar só depois de N ocorrências consecutivas"**, mantendo o teto duro (`maxPages = 1000`) e o anti-loop. Aplicar exatamente a mesma lógica nos dois motores.

### Novos limiares (constantes nomeadas)

- `EMPTY_PAGE_STREAK_LIMIT = 2` → só encerra após **2 páginas vazias consecutivas**.
- `NO_NEW_ITEMS_STREAK_LIMIT = 3` → só encerra após **3 páginas consecutivas sem nenhum id_djen novo**.
- `CONSECUTIVE_FAILED_PAGES_LIMIT = 3` → só encerra após **3 falhas HTTP consecutivas** (depois dos retries internos da página).
- `MAX_PAGES_HARD_CAP = 1000` (mantém o teto atual; só guard-rail).

Qualquer página que volte a trazer item novo zera todos os contadores de streak.

### Comportamento por evento

| Evento na página `p` | Hoje | Depois |
|---|---|---|
| `items.length === 0` | break imediato | `emptyStreak++`; break só quando `emptyStreak >= 2` |
| `items.length > 0` mas `addedOnPage === 0` | break imediato | `noNewStreak++`; break só quando `noNewStreak >= 3` |
| Página com novos itens | continua | zera `emptyStreak` e `noNewStreak`; continua |
| Erro HTTP/timeout após retries da página | break (Browser) / throw (Servidor) | conta `failedStreak++`, pula a página, segue; break só quando `failedStreak >= 3`; resposta marcada `partial=true` com `failedPages` ≥ 1 |
| `p >= MAX_PAGES_HARD_CAP` | break (truncated) | igual |

### Arquivos

- `src/utils/pjeComunicaClient.ts` — função `buscarPjeComunicaPaginado` (loop em `~828-881`): substituir os `break` por contadores de streak; manter `continueUntilEmpty` como única política (o ramo `else` legado fica como está, intocado).
- `monitor-servidor/engines/paralela.js` — função `buscarPaginado` (`~664-718`): mesmas regras; quando exceder `CONSECUTIVE_FAILED_PAGES_LIMIT` ou esgotar retries, retornar o que tiver acumulado em vez de `throw` (caller já agrega `descartadas/incluidas`). Bumpar `ENGINE_VERSION` para marcar o roll-out.

### Garantias

- **Não muda regra de validação** de termo/parte/advogado/conteúdo — só a varredura.
- **Não muda dedup** por `id_djen`.
- **Não muda VPS pool / cooldown / 429 backoff** — só consome o resultado dos retries existentes.
- Mantém cancelamento responsivo (`AbortSignal` continua sendo respeitado no `delay`/`abortableSleep`).
- Hard cap de 1000 páginas e tempo total preservados (não há risco de loop infinito por causa do streak de "vazio" e "sem novos").

### Validação após deploy

1. Re-executar coordenações que vinham com diferença (Vanessa TST, Santander Cível, Bruna GOL) e comparar Servidor × Browser.
2. Conferir `pagesFetched` e `failedPages` no log para confirmar que páginas extras estão sendo lidas (espera-se `pagesFetched` igual ou maior do que hoje).
3. Conferir tempo total por coordenação — esperado +5% a +15% no pior caso (poucas páginas extras), aceitável dado o PAGE_DELAY de 800ms.

### Fora de escopo

- Não alterar engines Kurier / DJEN Pro / Flash / STF (não usam `continueUntilEmpty`).
- Não alterar a edge function `monitorar-djen` (fetch-djen.ts) — só os dois motores ativos hoje.
