-- Promove a 'encontrada' as linhas que estavam como 'duplicada' mas que NÃO
-- possuem outra linha 'encontrada' equivalente segundo a regra atual do trigger
-- (coordenacao_id + monitoramento_id + dedup_processo_digits + dedup_data_ref + dedup_head_norm).
WITH candidatas AS (
  SELECT d.id
  FROM public.publicacoes_djen d
  WHERE d.status = 'duplicada'
    AND NOT EXISTS (
      SELECT 1
      FROM public.publicacoes_djen e
      WHERE e.status = 'encontrada'
        AND e.id <> d.id
        AND e.coordenacao_id IS NOT DISTINCT FROM d.coordenacao_id
        AND e.monitoramento_id IS NOT DISTINCT FROM d.monitoramento_id
        AND e.dedup_processo_digits IS NOT DISTINCT FROM d.dedup_processo_digits
        AND e.dedup_data_ref IS NOT DISTINCT FROM d.dedup_data_ref
        AND e.dedup_head_norm IS NOT DISTINCT FROM d.dedup_head_norm
    )
),
-- Entre as candidatas, manter apenas UMA por chave de dedup (a mais recente).
-- As demais permanecem 'duplicada' para não quebrar a regra.
escolhidas AS (
  SELECT DISTINCT ON (
    d.coordenacao_id, d.monitoramento_id, d.dedup_processo_digits, d.dedup_data_ref, d.dedup_head_norm
  ) d.id
  FROM public.publicacoes_djen d
  JOIN candidatas c ON c.id = d.id
  ORDER BY d.coordenacao_id, d.monitoramento_id, d.dedup_processo_digits, d.dedup_data_ref, d.dedup_head_norm,
           d.created_at DESC, d.id DESC
)
UPDATE public.publicacoes_djen p
SET status = 'encontrada'
FROM escolhidas e
WHERE p.id = e.id;