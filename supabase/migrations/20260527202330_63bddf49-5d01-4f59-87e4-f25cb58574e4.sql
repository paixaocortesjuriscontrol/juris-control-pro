
DELETE FROM public.publicacoes_djen p
WHERE p.fonte = 'kurier'
  AND p.created_at::date = CURRENT_DATE
  AND (
    p.coordenacao_id IS NULL
    OR p.coordenacao_id NOT IN (
      SELECT DISTINCT coordenacao_id FROM public.kurier_credencial_coordenacoes
    )
  );
