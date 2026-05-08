DELETE FROM publicacoes_djen p
USING monitoramentos_djen m
WHERE p.monitoramento_id = m.id
  AND m.coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
  AND p.created_at::date = CURRENT_DATE;