DELETE FROM public.publicacoes_djen
WHERE fonte = 'kurier'
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date
      = (now() AT TIME ZONE 'America/Sao_Paulo')::date;