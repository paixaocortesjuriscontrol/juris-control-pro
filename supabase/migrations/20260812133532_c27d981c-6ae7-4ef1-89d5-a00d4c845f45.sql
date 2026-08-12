ALTER TABLE public.acompanhamento_especial_divergencias
  ADD COLUMN IF NOT EXISTS avisado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_acomp_div_pendentes_aviso
  ON public.acompanhamento_especial_divergencias (avisado_em, resolvido_em);