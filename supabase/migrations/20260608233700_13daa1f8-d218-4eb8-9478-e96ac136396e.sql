ALTER TABLE public.processos
ADD COLUMN IF NOT EXISTS prazo_fatal_conferido BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS prazo_fatal_conferido_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS prazo_fatal_conferido_por UUID;