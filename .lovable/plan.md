# Por que a busca das 17h trouxe menos publicações

## O que os dados mostram

Comparando a rodada das 11:40 com a das 17:00 (mesmo dia, 18/08):

```text
                        11:40        17:00
publicações vistas      1.978        1.048
cards da rodada           236          208
páginas lidas           6.111        3.686
descartadas             9.256        5.070
429 (rate limit)        3.600        2.172
tempo dormido em 429   41.464 s     24.959 s
duração                 63 min       39 min
```

A queda é distribuída por todas as coordenações (Santander Trabalhista 186 → 8, Beatriz Costa 89 → 17, Vanessa TST 186 → 61, Vanessa STF/STJ 15 → 0), o que descarta "coordenação parada" e aponta para a rodada inteira ter varrido menos.

## Causa confirmada

A rodada das 17h **não terminou o trabalho**: em `execucoes_servidor_falhas` ela deixou 24 unidades (tribunal × monitoramento) com erro `HTTP 429` — 23 em `pendente` e 1 em `abandonado` (5 tentativas). Entre elas TST (5 unidades), TJSP, TJMG, TJRS, TJRJ, TRT2, TRT5, TRT7, TRT23, TRF1. Na rodada das 11:40 os 429 foram apenas 4 e todos ficaram `resolvido`.

Ou seja: o DJEN devolveu 429 nessas unidades, o refila não conseguiu reprocessá-las antes de a execução fechar, e a rodada foi encerrada como "concluída" mesmo com unidades sem coleta. Por isso menos páginas lidas, menos publicações vistas e duração menor.

Nada foi perdido de forma definitiva — são publicações não buscadas, não publicações apagadas.

## Correção proposta

1. **Reprocessar agora as 24 unidades pendentes** do dia 18/08 (refila dirigido em `execucoes_servidor_falhas`), para fechar o buraco da rodada das 17h.
2. **Não fechar rodada com unidades pendentes**: se ao final existirem falhas `pendente`/`abandonado`, a execução termina como `concluido_parcial` em vez de `concluido`, com o número de unidades faltantes gravado no `progresso.diagnostico`.
3. **Sinalizar na tela Análise DJEN** as colunas de execução parcial (marcador ao lado do horário + tooltip com quantas unidades ficaram sem coleta), para a diferença entre execuções deixar de parecer "publicação desapareceu".
4. **Tratar 429 como espera, não como falha**: unidade que só recebeu 429 volta para a fila com backoff mais longo e sem consumir tentativa do teto de 5, evitando o `abandonado` observado no TST.

## Detalhes técnicos

- Motor: `monitor-servidor/engines/paralela.js` (fechamento da execução e classificação do 429) e `monitor-servidor/falhasRefila.js` (backoff e contagem de tentativas).
- Status parcial gravado em `execucoes_servidor.status` + `progresso.diagnostico.unidades_nao_coletadas`.
- UI: coluna de execução na Análise DJEN (`useExecucoesDoDiaServidor` + tabela por coordenação) passa a expor o status parcial.
- Deploy na Hostinger: `git pull` + `pm2 restart jc-monitor-servidor`.
