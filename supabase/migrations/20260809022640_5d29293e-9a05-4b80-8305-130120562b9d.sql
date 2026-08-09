CREATE TABLE IF NOT EXISTS public.acompanhamento_especial_divergencias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  processo_numero text,
  campo text NOT NULL,
  valor_atual text,
  valor_judit text,
  execucao_id uuid,
  detectado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acomp_esp_div_processo ON public.acompanhamento_especial_divergencias(processo_id);
CREATE INDEX IF NOT EXISTS idx_acomp_esp_div_pendentes ON public.acompanhamento_especial_divergencias(resolvido_em, detectado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acomp_esp_div_pendente ON public.acompanhamento_especial_divergencias(processo_id, campo) WHERE resolvido_em IS NULL;

GRANT SELECT, UPDATE ON public.acompanhamento_especial_divergencias TO authenticated;
GRANT ALL ON public.acompanhamento_especial_divergencias TO service_role;

ALTER TABLE public.acompanhamento_especial_divergencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acomp_div_select_auth" ON public.acompanhamento_especial_divergencias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "acomp_div_update_auth" ON public.acompanhamento_especial_divergencias
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);