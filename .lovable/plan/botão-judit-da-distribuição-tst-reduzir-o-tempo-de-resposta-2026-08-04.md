# Botão Judit da Distribuição TST — reduzir o tempo de resposta

## O que o teste mostrou

Rodei o botão de verdade contra o processo 0000399-02.2026.5.10.0006 e conferi os
registros das últimas horas em `judit_logs`.

Logs da execução ao vivo:

```text
21:40:01  modo=sem anexos cnj=0000399-02.2026.5.10.0006 cache_ttl=3d
21:40:03  cache hit (tribunal=TRT10)
21:40:17  retentativa TST (recrawl ttl=0)
```

Tempos reais das últimas consultas (campo `elapsed_ms`):

| Fonte da resposta | Tempo |
| --- | --- |
| `app_cache_instant` | 0,4 s |
| `crawler_tst` (rápido) | 4 – 6 s |
| `crawler_tst` (estourou o limite) | 62 s |
| `fallback_outra_instancia` | 123 – 125 s |

A maioria das consultas do dia caiu na faixa de 62 s ou 124 s — é isso que a
advogada está sentindo.

## Por que demora

1. A tela sempre envia `tribunal: "TST"`. Com esse pedido, o cache da Judit só é
   aceito se já for a instância TST. Processos que ainda só têm TRT (caso
   comum em distribuição recente) descartam o cache e vão para o crawler.
2. O crawler é aguardado por até 60 s (`POLL_TIMEOUT_MS`). Quando a Judit não
   marca `completed` nesse tempo, gastamos os 60 s inteiros e respondemos com o
   que já havia.
3. Se ainda não apareceu nenhuma página do TST, a função dispara uma **segunda**
   rodada de crawler com cache zerado e espera outros 60 s. Daí os ~124 s.

Ou seja: no pior caso o usuário espera duas esperas de 60 s enfileiradas, mesmo
quando os dados que vão preencher o formulário já estavam disponíveis no
primeiro segundo.

## O que fazer

### 1. Responder rápido com o que já existe (principal)

Quando o cache da Judit traz partes e sinais úteis (classe, relator, órgão ou
histórico), responder imediatamente — mesmo que seja TRT e a tela tenha pedido
TST — marcando na resposta que ainda não é a instância TST. O formulário já
preenche o que é comum, e a busca do TST continua disponível pelo botão
"Forçar atualização".

### 2. Cortar a espera enfileirada

- Reduzir a espera do crawler de 60 s para ~25 s por rodada.
- Nunca rodar as duas rodadas em sequência dentro do mesmo clique: a
  retentativa dirigida ao TST passa a acontecer só quando o usuário pede
  atualização forçada, ou em segundo plano depois de a resposta já ter voltado.
- Orçamento total do clique limitado (~30 s), respondendo com o melhor dado
  disponível ao atingir o teto.

### 3. Deixar claro na tela o que aconteceu

No botão/aviso da Distribuição TST, mostrar a origem da resposta: "dados do
cache (TRT) — clique em Forçar atualização para buscar o TST", ou "dados do
TST". Assim a advogada entende por que veio rápido e o que fazer se precisar
do TST atualizado.

### 4. Aproveitar melhor o cache local

O cache do próprio app (`judit_logs`, 3 dias) hoje é ignorado quando a última
resposta boa era de outra instância. Passa a ser aceito com a mesma marcação de
instância, de modo que reabrir o mesmo processo responda em menos de 1 s.

## Detalhes técnicos

- `supabase/functions/buscar-judit/index.ts`
  - `POLL_TIMEOUT_MS`: 60 s → 25 s; orçamento global por requisição.
  - `cacheUsavel`: aceitar cache não-TST quando há sinal extraível, com
    `_judit_meta.instancia_tst = false`.
  - `juditAppCache`: aceitar resposta de outra instância marcando a origem, em
    vez de descartar.
  - Bloco "retentativa TST": só com `force_refresh`, ou disparado
    fire-and-forget após a resposta.
- `src/components/distribuicao-tst/DistribuicaoTstForm.tsx`: ler
  `_judit_meta.fonte` / `instancia_tst` e exibir o aviso de origem.
- Nada muda no custo por consulta: continuamos sem anexos por padrão e sem
  crawler extra em cache-hit.

## Verificação

Repetir a consulta nos processos usados no teste (0000399-02.2026.5.10.0006,
0025139-14.2024.5.24.0003, 0010787-39.2022.5.15.0046) e conferir em
`judit_logs` que `elapsed_ms` cai da faixa de 62–124 s para menos de 30 s, com
o formulário preenchido.
