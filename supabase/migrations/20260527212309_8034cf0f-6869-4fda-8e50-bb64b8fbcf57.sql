DELETE FROM public.publicacoes_djen p
WHERE p.fonte = 'kurier'
  AND p.created_at::date = CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM public.kurier_credencial_coordenacoes kc
    WHERE kc.coordenacao_id = p.coordenacao_id
  );