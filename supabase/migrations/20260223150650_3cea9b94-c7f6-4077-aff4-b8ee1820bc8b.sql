
DELETE FROM publicacoes_djen_descartadas
WHERE id IN (
  SELECT pdd.id
  FROM publicacoes_djen_descartadas pdd
  JOIN monitoramentos_djen md ON md.id = pdd.monitoramento_id
  WHERE md.coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
    AND pdd.created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz
);

DELETE FROM publicacoes_djen
WHERE id IN (
  SELECT pd.id
  FROM publicacoes_djen pd
  JOIN monitoramentos_djen md ON md.id = pd.monitoramento_id
  WHERE md.coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
    AND pd.created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz
);
