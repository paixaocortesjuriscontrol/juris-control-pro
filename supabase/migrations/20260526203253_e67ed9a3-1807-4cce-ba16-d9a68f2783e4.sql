DELETE FROM public.publicacoes_djen p
USING public.coordenacoes c
WHERE p.coordenacao_id = c.id
  AND c.nome = 'Coordenação Dr. Thomás'
  AND p.fonte = 'kurier'
  AND p.created_at >= CURRENT_DATE;