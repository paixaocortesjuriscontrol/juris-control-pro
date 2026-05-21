DELETE FROM publicacoes_djen
WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
  AND monitoramento_id IN (
    SELECT id FROM monitoramentos_djen
    WHERE coordenacao_id = 'f5a0ac48-7461-49c1-9151-219e570831bd'
  );