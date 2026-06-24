
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS acompanhamento_especial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acompanhamento_freq_diaria smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS acompanhamento_com_anexos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acompanhamento_ativado_em timestamptz,
  ADD COLUMN IF NOT EXISTS acompanhamento_ultima_checagem_em timestamptz,
  ADD COLUMN IF NOT EXISTS acompanhamento_ultimo_step_date timestamptz;

ALTER TABLE public.processos
  DROP CONSTRAINT IF EXISTS processos_acompanhamento_freq_chk;
ALTER TABLE public.processos
  ADD CONSTRAINT processos_acompanhamento_freq_chk
  CHECK (acompanhamento_freq_diaria BETWEEN 1 AND 6);

CREATE INDEX IF NOT EXISTS idx_processos_acompanhamento_especial
  ON public.processos (acompanhamento_especial)
  WHERE acompanhamento_especial = true;

CREATE TABLE IF NOT EXISTS public.acompanhamento_especial_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  step_id text,
  step_date timestamptz,
  conteudo text,
  instancia text,
  tribunal text,
  anexos_count integer NOT NULL DEFAULT 0,
  criou_tarefa_id uuid,
  notificou_em timestamptz,
  lido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (processo_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_acomp_esp_eventos_processo ON public.acompanhamento_especial_eventos (processo_id, step_date DESC);
CREATE INDEX IF NOT EXISTS idx_acomp_esp_eventos_lido ON public.acompanhamento_especial_eventos (lido_em);

GRANT SELECT, UPDATE ON public.acompanhamento_especial_eventos TO authenticated;
GRANT ALL ON public.acompanhamento_especial_eventos TO service_role;

ALTER TABLE public.acompanhamento_especial_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eventos visíveis pela coordenação do processo"
ON public.acompanhamento_especial_eventos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.processos p
    WHERE p.id = acompanhamento_especial_eventos.processo_id
      AND (
        p.coordenacao_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.membros_coordenacao mc
          WHERE mc.coordenacao_id = p.coordenacao_id
            AND mc.usuario_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

CREATE POLICY "Marcar como lido pela coordenação"
ON public.acompanhamento_especial_eventos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.processos p
    WHERE p.id = acompanhamento_especial_eventos.processo_id
      AND (
        p.coordenacao_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.membros_coordenacao mc
          WHERE mc.coordenacao_id = p.coordenacao_id
            AND mc.usuario_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

CREATE POLICY "Service role gerencia eventos"
ON public.acompanhamento_especial_eventos
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
