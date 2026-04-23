DELETE FROM public.dados_benner
WHERE id NOT IN (
  SELECT dados_benner_id 
  FROM public.dados_benner_responsaveis 
  WHERE usuario_id = 'e98847c9-9583-43f7-b876-3a148077b8cf'
);