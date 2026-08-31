ALTER TABLE public.eventos_agenda
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS identificador_externo text;

CREATE UNIQUE INDEX IF NOT EXISTS eventos_agenda_identificador_externo_key
  ON public.eventos_agenda (identificador_externo)
  WHERE identificador_externo IS NOT NULL;