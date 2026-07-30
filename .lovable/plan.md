## Diagnóstico (verificado nos dados)

Comparando as execuções em `execucoes_servidor` (tipo `djen_paralela_servidor`), com o mesmo pool de 13 VPS e o mesmo volume (~606-628 unidades):

```text
23/07  22 min      27/07 07:30  39 min
24/07  24 min      28/07 07:30  58 min
24/07  24 min      29/07 07:30  56 min
24/07  24 min      30/07 07:30  65 min
```

O que mudou junto: as falhas registradas em `execucoes_servidor_falhas` saltaram de ~1-2 por dia (17 a 23/07) para 30-50 por dia a partir de 27/07 — quase todas com erro `fetch failed` (rede/socket derrubado), concentradas em TST, TJMS, TRT20, STJ e TRT1.

E em 27/07 o motor `monitor-servidor/engines/paralela.js` recebeu uma mudança que encarece muito cada falha:

- antes: janela falhou → 1 nova tentativa com `size=10` → segue
- agora: janela falhou → espera 2s → `size=10` → espera 4s → `size=5` → se ainda falhar, backoff exponencial de 2s, 4s, 8s, até 15s por janela
- além disso cada tupla que cai persistentemente ainda tenta **failover em até 2 VPS alternativas**, e depois volta como *unit* de RETRY no fim da execução

Com 2 falhas/dia isso era irrelevante. Com 40 falhas/dia, cada uma consumindo dezenas de segundos de uma das 13 vias (que ficam paradas nesse tempo), o custo agregado explica os 20-40 minutos extras.

## O que fazer

1. **Limitar o custo de cada falha** em `buscarPaginado` (`monitor-servidor/engines/paralela.js`):
   - manter a degradação `50 → 10`, mas tornar o passo `→ 5` condicional (só quando o erro é claramente de payload grande, não em `fetch failed` genérico);
   - reduzir as esperas fixas de 2s/4s para valores curtos (500ms/1s) configuráveis por env;
   - limitar o backoff exponencial entre janelas falhas a um teto bem menor (ex.: 4s em vez de 15s) e reduzir `CONSECUTIVE_FAILED_PAGES_LIMIT` para abortar a tupla mais cedo em vez de insistir.

2. **Orçamento de tempo por unidade**: adicionar um deadline (ex.: 90s configurável via `PARALELA_UNIT_BUDGET_MS`) para cada tupla (tribunal, monitoramento, dia). Estourou o orçamento, a unidade é registrada em `execucoes_servidor_falhas` e liberada — o retry acontece no fim da execução ou na próxima rodada, sem travar uma das 13 vias.

3. **Failover mais barato**: tentar 1 VPS alternativa em vez de 2, e só quando o erro não for `fetch failed` repetido no mesmo tribunal (que indica bloqueio do lado do DJEN, não da VPS).

4. **Observabilidade**: gravar no `resultado` da execução um resumo `{ falhas_por_tribunal, tempo_gasto_em_retries_ms, unidades_estouradas }`, para confirmar o ganho na próxima rodada das 07:30 e detectar cedo se um tribunal específico voltar a degradar.

5. **Validação**: rodar uma execução manual do DJEN Termos Servidor após o ajuste e comparar duração e `novas` com as rodadas de 24/07 (24 min) e 30/07 (65 min).

## Observação

A causa raiz da instabilidade (o DJEN derrubando conexões em TST/TJMS/TRT20/STJ) é externa; o plano acima não a elimina, apenas evita que ela multiplique o tempo total. Se após o ajuste o tempo continuar acima de ~30 min, o próximo passo é investigar as VPS específicas que concentram os `fetch failed` (o campo `via` já é logado por unidade) e eventualmente tirar do pool as que estiverem com rede degradada.
