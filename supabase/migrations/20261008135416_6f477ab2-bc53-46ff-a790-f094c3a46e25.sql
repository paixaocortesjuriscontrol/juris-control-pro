ALTER TABLE public.pautas_tst
  ADD COLUMN IF NOT EXISTS semana_inicio date,
  ADD COLUMN IF NOT EXISTS dados_benner_id uuid,
  ADD COLUMN IF NOT EXISTS coordenacao_id uuid,
  ADD COLUMN IF NOT EXISTS processo_digits text GENERATED ALWAYS AS (regexp_replace(coalesce(processo_numero,''),'\D','','g')) STORED;
CREATE INDEX IF NOT EXISTS idx_pautas_tst_digits_data ON public.pautas_tst (processo_digits, data_julgamento);
CREATE INDEX IF NOT EXISTS idx_pautas_tst_semana ON public.pautas_tst (semana_inicio);