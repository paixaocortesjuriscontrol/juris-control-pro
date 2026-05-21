DELETE FROM public.publicacoes_djen
WHERE id IN (
  SELECT p.id
  FROM public.publicacoes_djen p
  JOIN public.monitoramentos_djen m ON m.id = p.monitoramento_id
  WHERE m.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
    AND p.created_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date) AT TIME ZONE 'America/Sao_Paulo'
);