UPDATE public.publicacoes_djen p
   SET coordenacao_id = m.coordenacao_id
  FROM public.monitoramentos_djen m
 WHERE p.monitoramento_id = m.id
   AND p.coordenacao_id IS NULL
   AND m.coordenacao_id IS NOT NULL;