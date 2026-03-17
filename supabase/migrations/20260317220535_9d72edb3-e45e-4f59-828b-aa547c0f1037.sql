-- Remove duplicates: keep only the most recent row per processo_numero for manual imports
DELETE FROM audiencias_detectadas
WHERE id NOT IN (
  SELECT DISTINCT ON (processo_numero) id
  FROM audiencias_detectadas
  WHERE origem = 'manual' AND processo_numero IS NOT NULL AND processo_numero != ''
  ORDER BY processo_numero, created_at DESC
)
AND origem = 'manual'
AND processo_numero IS NOT NULL
AND processo_numero != '';

-- Set coordenacao_id for all manual audiências that don't have one
UPDATE audiencias_detectadas
SET coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
WHERE origem = 'manual' AND coordenacao_id IS NULL;