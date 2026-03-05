
-- Backfill: update a column to itself to trigger compute_dedup_fields
-- Only last 7 days for speed

UPDATE public.publicacoes_djen SET processo_numero = processo_numero
WHERE dedup_head_norm IS NULL AND created_at >= now() - interval '7 days';

UPDATE public.publicacoes_djen_processos SET processo_numero = processo_numero
WHERE dedup_head_norm IS NULL AND created_at >= now() - interval '7 days';

UPDATE public.publicacoes_djen_descartadas SET processo_numero = processo_numero
WHERE dedup_head_norm IS NULL AND created_at >= now() - interval '7 days';

CREATE INDEX IF NOT EXISTS idx_pub_djen_dedup_key
  ON public.publicacoes_djen (dedup_processo_digits, dedup_data_ref, dedup_head_norm);

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_dedup_key
  ON public.publicacoes_djen_processos (dedup_processo_digits, dedup_data_ref, dedup_head_norm);

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_dedup_key
  ON public.publicacoes_djen_descartadas (dedup_processo_digits, dedup_data_ref, dedup_head_norm);
