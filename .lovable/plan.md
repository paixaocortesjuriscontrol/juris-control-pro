## Mudanças

### 1. Edge Function `kurier-consultar-publicacoes`
- Remover o `id_djen: null` forçado na inserção.
- Passar o `idDjen` já extraído via regex do conteúdo.
- Tratar erro de constraint única (código `23505`) como duplicado silencioso, contando em `totalDuplicadas` em vez de falhar.

### 2. Backfill (25/06 a 29/06/2026)
Atualizar `publicacoes_djen` preenchendo `id_djen` a partir do conteúdo somente para `fonte='kurier'` nesse intervalo, pulando linhas que conflitariam com `(coordenacao_id, id_djen)` já existente:

```sql
UPDATE publicacoes_djen p
SET id_djen = sub.id_extraido
FROM (
  SELECT id,
         coordenacao_id,
         (regexp_match(conteudo, 'ID\s*COMUNICA[ÇC][AÃ]O\s*(\d{4,})', 'i'))[1] AS id_extraido
  FROM publicacoes_djen
  WHERE fonte='kurier'
    AND id_djen IS NULL
    AND data_disponibilizacao >= '2026-06-25'
    AND data_disponibilizacao <  '2026-06-30'
) sub
WHERE p.id = sub.id
  AND sub.id_extraido IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM publicacoes_djen p2
    WHERE p2.coordenacao_id = p.coordenacao_id
      AND p2.id_djen = sub.id_extraido
  );
```

### 3. Sem alterações em `ValidaKurier.tsx` agora
A tela já prioriza `id_djen` quando presente; após o backfill o match passa a ser exato automaticamente.
