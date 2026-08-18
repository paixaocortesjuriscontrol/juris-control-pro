# Investigar a lentidão do DJEN Termos Servidor (17-18/08)

## O que já está medido

Duração média por rodada (tabela `execucoes_servidor`):

```text
06-07/08 ....... 11-12 min (média)   pico 24-26 min
10-14/08 ....... 20-27 min (média)   pico 48-76 min
17/08 .......... 37,8 min (média)    pico 106,4 min
18/08 .......... 42,6 min (média)    pico  94,7 min
```

Termos ativos cadastrados: a Coordenação Dra. Beatriz Costa criou 24 termos em 17/08 (todos do tipo `processo`, 1 tribunal cada), saindo de 21 para 45 termos ativos. Nenhuma outra coordenação teve aumento relevante nos últimos 7 dias.

Conclusão parcial: o aumento de termos é real, mas pequeno frente aos ~380 termos ativos, e a curva de lentidão começou antes dele. Ou seja, os novos termos podem estar agravando, não causando. A causa precisa ser medida antes de qualquer ajuste de parâmetro.

## Etapa 1 — Ler o diagnóstico que já existe no motor

A Fase 4 já instrumentou o motor com o log `paralela.diagnostico` (contagem de 429, 5xx, timeouts, tempo dormido em backoff e os 10 tribunais que mais consumiram tempo). Primeiro passo é coletar isso das últimas rodadas na Hostinger e cruzar com o `progresso` das execuções de 17 e 18/08 — sem alterar código.

O que a leitura precisa responder:
1. Quanto do tempo total foi trabalho real e quanto foi espera imposta pelo DJEN (429).
2. Quantas unidades foram abortadas por estouro de orçamento e refiladas (retrabalho puro).
3. Quais tribunais concentram o tempo, e se são os mesmos das rodadas rápidas de 06/08.
4. Quantas unidades a rodada teve em 06/08 versus 17-18/08 (efeito do volume de termos e do sharding).

## Etapa 2 — Registrar o resumo por rodada no banco

Hoje o diagnóstico só existe no log do PM2, que rotaciona. Passa a gravar o resumo agregado no `progresso` da própria execução (bloco `diagnostico`): total de unidades, unidades refiladas, contagem de 429/5xx/timeout, tempo total dormido, e o top de tribunais por tempo. Assim a comparação entre dias deixa de depender de log volátil.

## Etapa 3 — Comparação e correção dirigida

Com os números em mão, aplicar apenas a correção que os dados apontarem:

- Se o peso é **429 (rate limit)**: reduzir a concorrência efetiva por VPS e espaçar as chamadas do mesmo slot — atacar a causa, não o sintoma.
- Se o peso é **refila por estouro de orçamento**: ajustar o teto de orçamento por unidade e a regra de extensão por progresso, para não abortar paginação produtiva.
- Se o peso é **crescimento de unidades**: rever o sharding dos termos do tipo `processo` (agrupar vários processos por requisição em vez de uma unidade por processo × tribunal).
- Se o peso está concentrado em **poucos tribunais**: dar a eles trilha própria, para não bloquearem o restante da onda.

## Etapa 4 — Validar

Rodar uma execução completa após o ajuste e comparar, no mesmo formato, contra a rodada de referência de 06/08 e as de 17-18/08. Critério de sucesso: média por rodada abaixo de 25 min e queda mensurável nas unidades refiladas.

## Detalhes técnicos

- Fonte de duração: `execucoes_servidor` (`iniciado_em`, `finalizado_em`, `progresso`).
- Motor: `monitor-servidor/engines/paralela.js` — o diagnóstico agregado da Fase 4 passa a ser persistido junto do `progresso`, além do log.
- Parâmetros candidatos (só depois da medição): `CONCURRENCY_PARALELA`, `PARALELA_UNIT_BUDGET_MS`, `PARALELA_SLOW_UNIT_BUDGET_MS`, `PARALELA_UNIT_BUDGET_MAX_MS`, `PARALELA_RATE_LIMIT_PAUSE_MS`.
- Sem mudança de schema e sem mudança de UI nas etapas 1-2. Deploy na Hostinger é `git pull` + `pm2 restart jc-monitor-servidor`.
