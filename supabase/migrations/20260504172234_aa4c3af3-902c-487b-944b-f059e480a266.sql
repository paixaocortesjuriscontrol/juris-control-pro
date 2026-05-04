WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY coordenacao_id, dedup_processo_digits, dedup_data_ref, dedup_head_norm
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.publicacoes_djen
  WHERE status IN ('encontrada','duplicada')
    AND dedup_data_ref >= CURRENT_DATE - INTERVAL '7 days'
)
UPDATE public.publicacoes_djen p
SET status = (CASE WHEN r.rn = 1 THEN 'encontrada' ELSE 'duplicada' END)::djen_status
FROM ranked r
WHERE p.id = r.id
  AND p.status <> (CASE WHEN r.rn = 1 THEN 'encontrada' ELSE 'duplicada' END)::djen_status;