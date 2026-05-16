## Objetivo

Trocar o critério de deduplicação das publicações DJEN, hoje chaveado por `(monitoramento_id, hash_conteudo)`, para `(coordenacao_id, hash_conteudo)`. Assim, dentro da mesma coordenação não há duplicatas, mas a mesma publicação **pode** ser inserida em coordenações diferentes (ex.: "Renata Santander" e "Renata com termos do João").

## Migração de banco

Arquivo de migração nova:

```sql
-- 1) Garantir que toda publicação tem coordenação derivada do monitoramento
UPDATE public.publicacoes_djen p
   SET coordenacao_id = m.coordenacao_id
  FROM public.monitoramentos_djen m
 WHERE p.monitoramento_id = m.id
   AND p.coordenacao_id IS NULL
   AND m.coordenacao_id IS NOT NULL;

-- 2) Remover duplicatas legadas dentro da mesma (coord, hash) preservando a mais antiga
DELETE FROM public.publicacoes_djen a
 USING public.publicacoes_djen b
 WHERE a.ctid > b.ctid
   AND a.coordenacao_id IS NOT NULL
   AND a.coordenacao_id = b.coordenacao_id
   AND a.hash_conteudo  = b.hash_conteudo;

-- 3) Trocar o índice único
DROP INDEX IF EXISTS public.idx_publicacoes_djen_hash;
CREATE UNIQUE INDEX idx_publicacoes_djen_coord_hash
  ON public.publicacoes_djen (coordenacao_id, hash_conteudo)
  WHERE coordenacao_id IS NOT NULL;

-- 4) Mesmo tratamento para descartadas (mantém isolamento por coord)
ALTER TABLE public.publicacoes_djen_descartadas
  ADD COLUMN IF NOT EXISTS coordenacao_id uuid;

UPDATE public.publicacoes_djen_descartadas d
   SET coordenacao_id = m.coordenacao_id
  FROM public.monitoramentos_djen m
 WHERE d.monitoramento_id = m.id
   AND d.coordenacao_id IS NULL;

DELETE FROM public.publicacoes_djen_descartadas a
 USING public.publicacoes_djen_descartadas b
 WHERE a.ctid > b.ctid
   AND a.coordenacao_id IS NOT NULL
   AND a.coordenacao_id = b.coordenacao_id
   AND a.hash_conteudo  = b.hash_conteudo;

CREATE UNIQUE INDEX IF NOT EXISTS idx_publicacoes_djen_desc_coord_hash
  ON public.publicacoes_djen_descartadas (coordenacao_id, hash_conteudo)
  WHERE coordenacao_id IS NOT NULL;
```

## Mudanças nos engines (frontend)

Em todos os engines DJEN substituir o conflict target e o "já no banco":

### `src/hooks/useDjenTermosFlashEngine.ts`
- `.select('monitoramento_id, hash_conteudo')` → `.select('coordenacao_id, hash_conteudo').eq('coordenacao_id', mon.coordenacao_id)`
- Set passa a ser `${coordenacao_id}|${hash}`
- `onConflict: 'monitoramento_id,hash_conteudo'` → `'coordenacao_id,hash_conteudo'` (tanto publicações quanto descartadas)
- Garantir que o payload de upsert sempre carrega `coordenacao_id: mon.coordenacao_id`

### `src/hooks/useDjenTermosProEngine.ts`
- Trocar a query `.eq('monitoramento_id', mon.id)` por `.eq('coordenacao_id', mon.coordenacao_id)`
- `onConflict` em publicações e descartadas → `'coordenacao_id,hash_conteudo'`
- Payload inclui `coordenacao_id`

### `src/hooks/useDjenTermosEngine.ts`
- Mesma troca: dedup contra banco por `coordenacao_id`, `onConflict` por `(coordenacao_id, hash_conteudo)`, payload com `coordenacao_id`

### `src/hooks/useDjenTermosParalelaEngine.ts`
- A lookup atual já é por `coordenacao_id + dedup_processo_digits + dedup_data_ref` — manter, mas trocar `onConflict: 'monitoramento_id,hash_conteudo'` para `'coordenacao_id,hash_conteudo'` (publicações e descartadas) e garantir `coordenacao_id` no payload.

### `supabase/functions/monitorar-djen/processing.ts` e `index.ts`
- Substituir `onConflict: 'monitoramento_id,hash_conteudo'` por `'coordenacao_id,hash_conteudo'` e injetar `coordenacao_id` no payload.

### Outras edge functions com upsert de DJEN
- `backfill-djen`, `backfill-djen-job`, `backfill-djen-jina`, `monitorar-djen-processos`, `executar-djet-pautas-agendado`, `limpar-djen-hoje`: ajustar `onConflict` e payload onde gravam em `publicacoes_djen`/`_descartadas`.

## Comportamento esperado após a mudança

- A intimação de 14/05 do processo `0000574-25.2021.5.13.0026` poderá existir em ambas as coordenações da Dra. Renata:
  - Coord. "Renata Santander" via termo `SANTANDER` (parte)
  - Coord. "Renata com termos do João" via termo `SANTANDER` (palavra-chave) ou `Santander` (parte)
- Dentro da mesma coordenação, monitoramentos diferentes que casarem com a mesma publicação continuam **não duplicando** (uma linha por coord+hash).

## Risco e mitigação

- Volume de linhas pode aumentar (uma publicação por coordenação). Aceitável dado isolamento por coordenação.
- A unicidade por `monitoramento_id` deixa de existir; o `monitoramento_id` gravado passa a ser o **primeiro** que casou na coord. Caso isso impacte filtros por monitoramento em listagens, abrir tarefa de UI separada.

## Verificação

1. Rodar migração.
2. Reexecutar DJEN Termos/Pro/Flash para 14/05.
3. Conferir no banco: `SELECT coordenacao_id, monitoramento_id FROM publicacoes_djen WHERE hash_conteudo='56c4645e61058501';` deve retornar 2 linhas (uma por coord da Dra. Renata).
