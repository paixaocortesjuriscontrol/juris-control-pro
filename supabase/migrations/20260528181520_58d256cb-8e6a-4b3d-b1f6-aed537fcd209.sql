DELETE FROM public.publicacoes_djen p
USING public.coordenacoes c
WHERE p.coordenacao_id = c.id
  AND c.nome ILIKE '%thom%'
  AND p.fonte = 'kurier'
  AND date(p.created_at AT TIME ZONE 'America/Sao_Paulo') = (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')::date
  AND (
    p.monitoramento_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.monitoramentos_djen m
      WHERE m.id = p.monitoramento_id AND m.somente_kurier = true
    )
  );