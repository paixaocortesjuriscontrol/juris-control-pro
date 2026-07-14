ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorrencia_tipo text,
  ADD COLUMN IF NOT EXISTS recorrencia_intervalo int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recorrencia_fim date,
  ADD COLUMN IF NOT EXISTS recorrencia_rrule text;