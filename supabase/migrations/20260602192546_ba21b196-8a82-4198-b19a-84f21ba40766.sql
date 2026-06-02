DELETE FROM publicacoes_djen
WHERE id IN (
  SELECT p.id
  FROM publicacoes_djen p
  JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
  WHERE m.coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
    AND p.created_at >= '2026-06-02T03:00:00Z'
    AND p.created_at <  '2026-06-03T03:00:00Z'
);