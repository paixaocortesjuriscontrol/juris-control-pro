UPDATE public.publicacoes_djen_processos p
SET tribunal = dj.tribunal
FROM public.publicacoes_djen dj
WHERE p.tribunal IS NULL
  AND dj.dedup_key = p.dedup_key
  AND dj.tribunal IS NOT NULL;