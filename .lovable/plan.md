## Objetivo

Adotar o `id_djen` (id oficial retornado pela API do CNJ) como **única chave de deduplicação** das publicações capturadas pelo monitoramento DJEN Paralela, removendo a comparação por conteúdo (`dedup_head_norm` + MD5).

## ⚠️ Observação importante sobre "Pautas Paralela"

A rotina **Pautas Paralela** (`buscar-dejt-pautas`) **não consome a API CNJ** — ela extrai texto de PDFs do DEJT (caderno do TRT). Esses blocos **não têm `id` oficial**, então não é possível aplicar a mesma estratégia ali. Para Pautas, a dedup precisa continuar baseada em hash de conteúdo (que é o que já faz hoje via `sha256(mon.id|tribunal|data|processo|conteudo[:1024])`).

**Confirmação necessária:** você está de acordo em manter Pautas Paralela com a dedup atual (por hash), ou quer que eu proponha algo separado? Por ora o plano abaixo cobre **apenas DJEN Paralela** (API CNJ).

## Plano — DJEN Paralela (id_djen como chave única)

### 1. Schema (migration)

Em `publicacoes_djen`, `publicacoes_djen_descartadas` e `publicacoes_djen_processos`:

- Adicionar `id_djen text` (id retornado pela API CNJ, ex.: `517283542`).
- Criar índice único parcial: `UNIQUE (coordenacao_id, id_djen) WHERE id_djen IS NOT NULL`.
- **Backfill imediato** dos registros existentes: `UPDATE ... SET id_djen = djen_diario_publicacoes.raw_json->>'id'` via join por `hash_global`/`hash_conteudo` quando possível (o id está em `djen_diario_publicacoes.raw_json->>'id'`).
- Manter as colunas antigas (`dedup_head_norm`, `dedup_processo_digits`, `dedup_data_ref`, `dedup_key`) por enquanto, mas **deixar de usá-las** — podemos removê-las numa migration de limpeza depois.

### 2. Triggers

- Substituir `mark_djen_duplicada_on_insert` e `mark_djenp_duplicada_on_insert` por versões simples:
  - Se já existe registro com mesmo `(coordenacao_id, id_djen)` → marca `status = 'duplicada'`.
  - Caso contrário → `status = 'encontrada'`.
  - Sem `id_djen`? Marca `encontrada` (não deveria acontecer após o passo 3).
- Remover a função `normalize_djen_dedup_content` e as referências em `compute_dedup_fields`.

### 3. Edge functions de captura DJEN Paralela

Passar `id_djen: item.raw_json?.id ?? item.id` no insert em todas estas:

- `monitorar-djen` (DJEN Paralela principal)
- `monitorar-djen-processos`
- `monitorar-djen-trigger`
- `buscar-djen`
- `backfill-djen`, `backfill-djen-jina`, `backfill-djen-job`
- `indexar-djen-diario` (já guarda em `djen_diario_publicacoes`; nada muda lá, mas confirmar que o id segue em `raw_json`)

### 4. Reclassificação dos registros de hoje

Após backfill, rodar uma vez:
- Para cada coordenação, identificar grupos com mesmo `id_djen` → manter a primeira como `encontrada`, demais `duplicada`.
- Inversamente, marcar como `encontrada` registros que estavam `duplicada` mas têm `id_djen` único.

### 5. Validação

- Rodar DJEN Paralela novamente para Dra. Janaina Completa.
- Verificar que as 2 publicações do processo `0000023-83.2026.5.10.0016` (ATO ORDINATÓRIO + DESPACHO) aparecem como `encontrada` — elas têm `id_djen` diferentes na origem.

### 6. Limpeza futura (opcional, em outra migration)

Após 1–2 semanas de operação estável:
- Drop colunas `dedup_head_norm`, `dedup_processo_digits`, `dedup_data_ref`, `dedup_key` e índices associados.
- Manter `hash_conteudo` + `publicacoes_djen_global_hash` (servem ao propósito diferente de anti-reprocessamento entre execuções).

## Considerações técnicas

- O `id_djen` da API CNJ é numérico estável (ex.: `517283542`); guardado como `text` para flexibilidade.
- Já existe no banco (em `djen_diario_publicacoes.raw_json->>'id'`), então o backfill é factível para o histórico recente.
- Frontend (`src/utils/djenDedup.ts`) pode ser simplificado depois para também usar `id_djen` em vez de slice de conteúdo — mas não é bloqueante.
- Sem impacto em Pautas Paralela (fonte PDF, sem id oficial).

## Pergunta antes de implementar

Confirma que **Pautas Paralela fica com a dedup atual por hash de conteúdo** (já que não há id oficial em PDF)? Se sim, prossigo com o plano acima focado só em DJEN Paralela.