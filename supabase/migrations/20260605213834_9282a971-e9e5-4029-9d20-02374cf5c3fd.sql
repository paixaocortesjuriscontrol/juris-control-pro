ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS prazo_dias integer,
  ADD COLUMN IF NOT EXISTS prazo_unidade text CHECK (prazo_unidade IN ('uteis','corridos')),
  ADD COLUMN IF NOT EXISTS alerta_dias integer,
  ADD COLUMN IF NOT EXISTS alerta_unidade text CHECK (alerta_unidade IN ('uteis','corridos'));