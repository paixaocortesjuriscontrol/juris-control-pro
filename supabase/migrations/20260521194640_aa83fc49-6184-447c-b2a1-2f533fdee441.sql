DELETE FROM publicacoes_djen
WHERE id IN (
  SELECT p.id
  FROM publicacoes_djen p
  JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
  WHERE m.coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5'
    AND (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
);