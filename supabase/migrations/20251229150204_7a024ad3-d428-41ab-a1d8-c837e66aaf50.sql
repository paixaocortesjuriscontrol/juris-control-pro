
-- Atribuir advogado responsável aos processos baseado no responsável com mais prazos
WITH responsavel_por_processo AS (
  SELECT 
    pr.processo_id,
    pr.responsavel_id,
    COUNT(*) as total_prazos,
    ROW_NUMBER() OVER (PARTITION BY pr.processo_id ORDER BY COUNT(*) DESC) as rn
  FROM prazos pr
  WHERE pr.responsavel_id IS NOT NULL
  AND pr.processo_id IS NOT NULL
  GROUP BY pr.processo_id, pr.responsavel_id
)
UPDATE processos p
SET advogado_responsavel_id = rpp.responsavel_id
FROM responsavel_por_processo rpp
WHERE p.id = rpp.processo_id
AND rpp.rn = 1
AND p.advogado_responsavel_id IS NULL;
