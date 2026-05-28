ALTER TABLE public.kurier_credencial_coordenacoes
  ADD COLUMN IF NOT EXISTS somente_kurier_only boolean NOT NULL DEFAULT false;