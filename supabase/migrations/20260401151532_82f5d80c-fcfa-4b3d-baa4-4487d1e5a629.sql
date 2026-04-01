UPDATE execucoes_agendadas 
SET status = 'cancelado', 
    finalizado_em = now(), 
    detalhes = jsonb_set(
      COALESCE(detalhes::jsonb, '{}'::jsonb), 
      '{mensagem}', 
      '"Cancelado: execução órfã detectada"'
    )
WHERE tipo = 'djen_pro' 
  AND status = 'executando' 
  AND finalizado_em IS NULL;