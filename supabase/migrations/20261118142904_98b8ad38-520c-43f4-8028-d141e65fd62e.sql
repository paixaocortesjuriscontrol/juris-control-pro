ALTER TABLE public.config_acompanhamento_especial
  ADD COLUMN IF NOT EXISTS coordenadores_excluidos_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];