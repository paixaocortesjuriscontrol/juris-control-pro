
WITH coord AS (SELECT '3e47fc83-3539-4fa7-9fcf-33825120e1b7'::uuid AS id),
alvos AS (
  SELECT pd.id
  FROM public.publicacoes_djen pd
  LEFT JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
  WHERE COALESCE(pd.coordenacao_id, md.coordenacao_id) = (SELECT id FROM coord)
    AND pd.created_at::date = CURRENT_DATE
),
del_leituras AS (
  DELETE FROM public.publicacoes_djen_leituras l
  WHERE l.tabela_origem = 'termo'
    AND l.publicacao_id IN (SELECT id FROM alvos)
  RETURNING 1
)
DELETE FROM public.publicacoes_djen pd
WHERE pd.id IN (SELECT id FROM alvos);
