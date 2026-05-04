-- 1. Reatribuir publicações encontradas
UPDATE publicacoes_djen p
SET coordenacao_id = '9d4e11e2-e81f-45ef-a8d4-977ddf371e18'
FROM monitoramentos_djen m
WHERE p.monitoramento_id = m.id
  AND m.coordenacao_id IN (
    'f73e8ee7-924c-4518-bbdc-62dd77df93a1',
    'd4e33fa2-e663-4d0c-909e-b2e15725591d'
  )
  AND (p.coordenacao_id IS DISTINCT FROM '9d4e11e2-e81f-45ef-a8d4-977ddf371e18');

-- 2. Reatribuir publicações descartadas (se a tabela tiver coordenacao_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='publicacoes_djen_descartadas' AND column_name='coordenacao_id'
  ) THEN
    EXECUTE $sql$
      UPDATE publicacoes_djen_descartadas d
      SET coordenacao_id = '9d4e11e2-e81f-45ef-a8d4-977ddf371e18'
      FROM monitoramentos_djen m
      WHERE d.monitoramento_id = m.id
        AND m.coordenacao_id IN (
          'f73e8ee7-924c-4518-bbdc-62dd77df93a1',
          'd4e33fa2-e663-4d0c-909e-b2e15725591d'
        )
        AND (d.coordenacao_id IS DISTINCT FROM '9d4e11e2-e81f-45ef-a8d4-977ddf371e18');
    $sql$;
  END IF;
END $$;

-- 3. Deduplicar publicações encontradas dentro da coordenação destino
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY
             COALESCE(dedup_processo_digits, regexp_replace(COALESCE(processo_numero,''),'[^0-9]','','g')),
             COALESCE(dedup_data_ref::text, COALESCE(data_disponibilizacao::text, data_publicacao::text, created_at::text)),
             COALESCE(dedup_head_norm, lower(left(COALESCE(conteudo,''),300)))
           ORDER BY
             length(COALESCE(conteudo,'')) DESC,
             lida ASC,
             created_at ASC
         ) AS rn
  FROM publicacoes_djen
  WHERE coordenacao_id = '9d4e11e2-e81f-45ef-a8d4-977ddf371e18'
)
DELETE FROM publicacoes_djen
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 4. Deduplicar descartadas dentro da coordenação destino
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='publicacoes_djen_descartadas' AND column_name='coordenacao_id'
  ) THEN
    EXECUTE $sql$
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY
                   regexp_replace(COALESCE(processo_numero,''),'[^0-9]','','g'),
                   COALESCE(data_publicacao::text, created_at::text),
                   lower(left(COALESCE(conteudo,''),300))
                 ORDER BY length(COALESCE(conteudo,'')) DESC, created_at ASC
               ) AS rn
        FROM publicacoes_djen_descartadas
        WHERE coordenacao_id = '9d4e11e2-e81f-45ef-a8d4-977ddf371e18'
      )
      DELETE FROM publicacoes_djen_descartadas
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    $sql$;
  END IF;
END $$;