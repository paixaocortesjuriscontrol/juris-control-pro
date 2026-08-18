# Reduzir "Orçamento de 90s excedido (Falha ao consultar VPS DJEN)"

## O que essa mensagem é

Não é erro da VPS. É o **cronômetro do próprio motor**. Cada unidade de busca (tribunal + monitoramento + dia) tem um orçamento de tempo: 90s no geral e 120s nos tribunais lentos (TST, TRT2, TRT15, TJSP, TJRJ, TJMG). Quando o tempo estoura, o motor aborta a requisição, libera a VPS e joga a tupla para refila. O texto "Falha ao consultar VPS DJEN" é só a etiqueta genérica herdada, o que confunde.

## Por que estoura toda hora agora

O tempo é consumido *dentro* da busca paginada, não em uma única chamada:

- Cada 429 (rate limit do DJEN) agora pausa 8s e repete a janela; o backoff dedicado pode somar ~5s + 10s + 15s.
- Somando a pausa de rate limit com as retentativas por janela e o backoff entre janelas, um único par (tribunal, dia) com 2-3 rate limits ultrapassa 90s antes de terminar a paginação.
- Ou seja: o pico de 429 (Fase 3) transformou o watchdog de 90s em disparo frequente, principalmente em tribunais com muitas páginas.

## Correções propostas

1. **Não gastar orçamento com espera de rate limit**: descontar do relógio o tempo dormido em pausas 429/backoff, para o orçamento medir trabalho real e não espera imposta pelo DJEN.
2. **Orçamento proporcional ao volume**: estender o prazo quando a busca já trouxe páginas com sucesso (progresso recente), em vez de cortar no meio de uma paginação produtiva. Teto absoluto para não travar a rodada.
3. **Mensagem honesta**: trocar por "Tempo limite da unidade excedido (Xs) — refilado" e registrar o motivo real (rate limit / rede / tribunal lento), removendo "Falha ao consultar VPS DJEN" quando a VPS não falhou.
4. **Menos 429 na origem**: reduzir a concorrência efetiva por VPS e espaçar levemente as requisições, atacando a causa em vez do sintoma.
5. **Observabilidade**: log agregado por rodada com contagem de estouros por tribunal e tempo médio perdido em rate limit, para medir o efeito.

## Detalhes técnicos

- Arquivo: `monitor-servidor/engines/paralela.js`.
  - `buscarComOrcamento` passa a receber um contador de tempo dormido (compartilhado por unidade) e reagenda o timer descontando esse tempo.
  - `buscarPaginado` incrementa esse contador em `delay(RATE_LIMIT_PAUSE_MS)`, backoff 429 e backoff entre janelas.
  - Extensão de prazo por progresso: se houve página bem-sucedida nos últimos N ms, renova o timer até um teto (`PARALELA_UNIT_BUDGET_MAX_MS`, default 240s).
  - Novos envs opcionais: `PARALELA_UNIT_BUDGET_MAX_MS`, `PARALELA_UNIT_PROGRESS_GRACE_MS`.
- Concorrência: revisar `CONCURRENCY_PARALELA` no `.env` da Hostinger junto com espaçamento entre chamadas do mesmo slot.
- Sem mudança de schema, sem mudança na UI. Deploy é `git pull` + `pm2 restart jc-monitor-servidor` na Hostinger.
