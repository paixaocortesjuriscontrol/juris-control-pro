
ALTER TABLE public.publicacoes_djen DISABLE TRIGGER trg_set_pub_djen_coord;

WITH lote AS (
  SELECT pd.id, md.coordenacao_id AS cid
  FROM public.publicacoes_djen pd
  JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
  WHERE pd.coordenacao_id IS NULL
  LIMIT 5000
)
UPDATE public.publicacoes_djen pd
SET coordenacao_id = lote.cid
FROM lote
WHERE pd.id = lote.id;

ALTER TABLE public.publicacoes_djen ENABLE TRIGGER trg_set_pub_djen_coord;
