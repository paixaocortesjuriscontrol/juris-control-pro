DELETE FROM publicacoes_djen
WHERE created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
  AND monitoramento_id IN (
    SELECT id FROM monitoramentos_djen
    WHERE coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5'
  );