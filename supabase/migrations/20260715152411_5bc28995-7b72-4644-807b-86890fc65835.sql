
CREATE TABLE IF NOT EXISTS public.execucoes_acompanhamento_especial (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot INTEGER,
  disparo TEXT NOT NULL DEFAULT 'automatico',
  status TEXT NOT NULL DEFAULT 'executando',
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMPTZ,
  duracao_ms INTEGER,
  total_processos INTEGER NOT NULL DEFAULT 0,
  total_novos_eventos INTEGER NOT NULL DEFAULT 0,
  total_erros INTEGER NOT NULL DEFAULT 0,
  detalhes JSONB,
  erro TEXT,
  invocado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.execucoes_acompanhamento_especial TO authenticated;
GRANT ALL ON public.execucoes_acompanhamento_especial TO service_role;

ALTER TABLE public.execucoes_acompanhamento_especial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated pode ver execucoes acompanhamento especial"
ON public.execucoes_acompanhamento_especial
FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_exec_acomp_especial_iniciado_em
  ON public.execucoes_acompanhamento_especial (iniciado_em DESC);
CREATE INDEX IF NOT EXISTS idx_exec_acomp_especial_status
  ON public.execucoes_acompanhamento_especial (status);
