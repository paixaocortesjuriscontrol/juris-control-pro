
DELETE FROM publicacoes_djen
WHERE monitoramento_id IN (
  SELECT id FROM monitoramentos_djen WHERE coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
)
AND created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;
