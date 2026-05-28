UPDATE public.publicacoes_djen AS p
SET kurier_login = r.login_usado
FROM public.kurier_publicacoes_raw AS r
WHERE p.id = r.publicacao_djen_id
  AND p.fonte = 'kurier'
  AND p.kurier_login IS NULL
  AND r.login_usado IS NOT NULL;