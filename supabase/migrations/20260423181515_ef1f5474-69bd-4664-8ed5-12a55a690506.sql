
UPDATE public.dados_benner
SET benner_atualizado = false,
    updated_at = now()
WHERE id IN (
  SELECT dbr.dados_benner_id
  FROM public.dados_benner_responsaveis dbr
  WHERE dbr.usuario_id = 'e98847c9-9583-43f7-b876-3a148077b8cf'
);
