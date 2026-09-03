# Kurier lento (40+ min em duas credenciais) — acelerar a gravação

## O que está acontecendo

Os erros 546 pararam, mas a execução arrasta: no print, 41 min para 1.480 publicações recebidas (24 + 16 lotes) — cerca de 1 minuto por lote de 50, ou ~1,2s por publicação.

O tempo não está na Kurier nem no worker: está no número de idas ao banco. Em `kurier-consultar-publicacoes`, dentro do laço de publicações, cada item faz:

- 1 `INSERT` individual em `publicacoes_djen` (com `.select("id")`) quando houve match de monitoramento;
- mais 1 `INSERT` individual para **cada** coordenação com captura total no login;
- (em backfill) 1 `SELECT` de duplicidade por item e por coordenação.

Com 2–3 coordenações de captura total isso dá 100–150 round trips por lote de 50 — executados um a um, em série. É esse enfileiramento que consome os 40 minutos.

## Correção

1. **Gravar por lote, não por publicação.** Montar a lista de linhas de todas as publicações do lote (match + captura total) e inserir em blocos de 100 com um único `insert ... select("id, hash_conteudo")` por bloco, mapeando o id de volta para cada publicação pelo hash. Isso troca ~150 chamadas por 1–2.
2. **Manter a contagem correta.** Duplicados (23505) passam a ser contados pela diferença entre linhas enviadas e linhas retornadas por bloco; em caso de erro do bloco inteiro, cai no caminho item-a-item atual apenas para aquele bloco, para não perder publicação.
3. **Duplicidade de backfill em uma consulta.** Substituir o `SELECT` por item por um único `SELECT` por lote usando `.in("dedup_processo_digits", [...])` no conjunto do lote, resolvendo tudo em memória.
4. **Junção e raw já são em lote** — ficam como estão.
5. **Aproveitar o ganho de folga.** Com o lote gravando rápido, subir o padrão de lotes por chamada de 2 para 4 em `executar-kurier-agendado`, mantendo a redução automática se voltar a aparecer 546.

Expectativa: os mesmos 24 lotes do `paixaoc` deixam de custar ~25 minutos e passam à casa de 1–3 minutos, dominados pelo tempo da própria API Kurier.

## Detalhes técnicos

- `supabase/functions/kurier-consultar-publicacoes/index.ts`: no laço `for (const p of pubs)`, trocar os `await admin.from(pubTable).insert(...)` (caminho `matched` e laço `capturaTotalCoords`) por acumuladores `pendentesInsert[]` com `{ payload, pubRef, coordId }`; após o laço, gravar em blocos de 100 e só então montar `rawRows` e a junção `publicacoes_djen_execucoes` com os ids devolvidos; o `SELECT` de dup do backfill vira uma consulta única por lote indexada por `coordenacao_id|digits|data_ref`.
- `supabase/functions/executar-kurier-agendado/index.ts`: `DEFAULT_MAX_LOTES` 2 → 4 (lógica adaptativa de 546 inalterada).
- Sem mudança de schema, sem mudança de UI, sem alteração no `monitor-servidor`. A edge function é implantada automaticamente.
