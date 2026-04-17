
-- Identifica, para cada processo duplicado associado a Eduardo Torres na coordenação Dra. Renata,
-- a linha "mantida" (mais recente, priorizando 'Importação CPF 478') e as linhas a remover.
WITH base AS (
  SELECT db.id, db.processo, db.aba_origem, db.updated_at
  FROM public.dados_benner db
  JOIN public.dados_benner_responsaveis r ON r.dados_benner_id = db.id
  WHERE r.usuario_id = 'e98847c9-9583-43f7-b876-3a148077b8cf'
    AND db.coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
),
duplicados AS (
  SELECT processo FROM base GROUP BY processo HAVING COUNT(*) > 1
),
ranked AS (
  SELECT b.*,
    ROW_NUMBER() OVER (
      PARTITION BY b.processo
      ORDER BY
        CASE WHEN b.aba_origem = 'Importação CPF 478' THEN 0 ELSE 1 END,
        b.updated_at DESC
    ) AS rn
  FROM base b
  WHERE b.processo IN (SELECT processo FROM duplicados)
),
manter AS (SELECT id, processo FROM ranked WHERE rn = 1),
remover AS (SELECT id FROM ranked WHERE rn > 1),
-- Garante Eduardo como responsável nas linhas mantidas (preservando outros responsáveis)
add_eduardo AS (
  INSERT INTO public.dados_benner_responsaveis (dados_benner_id, usuario_id)
  SELECT m.id, 'e98847c9-9583-43f7-b876-3a148077b8cf'
  FROM manter m
  WHERE NOT EXISTS (
    SELECT 1 FROM public.dados_benner_responsaveis r
    WHERE r.dados_benner_id = m.id
      AND r.usuario_id = 'e98847c9-9583-43f7-b876-3a148077b8cf'
  )
  RETURNING 1
),
-- Remove responsáveis das linhas duplicadas
del_resp AS (
  DELETE FROM public.dados_benner_responsaveis
  WHERE dados_benner_id IN (SELECT id FROM remover)
  RETURNING 1
)
-- Remove as próprias linhas duplicadas em dados_benner
DELETE FROM public.dados_benner
WHERE id IN (SELECT id FROM remover);
