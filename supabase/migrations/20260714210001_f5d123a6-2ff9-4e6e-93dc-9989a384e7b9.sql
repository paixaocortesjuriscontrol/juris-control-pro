
-- Fase 4: Reagendar vs Nova audiência
CREATE TABLE public.historico_reagendamentos_audiencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audiencia_id uuid NOT NULL REFERENCES public.audiencias_detectadas(id) ON DELETE CASCADE,
  data_anterior timestamp with time zone,
  data_nova timestamp with time zone,
  hora_anterior text,
  hora_nova text,
  tipo_anterior text,
  tipo_novo text,
  modalidade_anterior text,
  modalidade_nova text,
  motivo text,
  alterado_por uuid,
  alterado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.historico_reagendamentos_audiencia TO authenticated;
GRANT ALL ON public.historico_reagendamentos_audiencia TO service_role;

ALTER TABLE public.historico_reagendamentos_audiencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated pode ler historico reagendamentos"
  ON public.historico_reagendamentos_audiencia FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated pode inserir historico reagendamentos"
  ON public.historico_reagendamentos_audiencia FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = alterado_por OR alterado_por IS NULL);

CREATE INDEX idx_hist_reag_audiencia ON public.historico_reagendamentos_audiencia(audiencia_id, alterado_em DESC);

-- Vínculo "originada de" para o fluxo "Nova audiência" (cópia)
ALTER TABLE public.audiencias_detectadas
  ADD COLUMN IF NOT EXISTS originada_de uuid REFERENCES public.audiencias_detectadas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audiencias_originada_de ON public.audiencias_detectadas(originada_de);
