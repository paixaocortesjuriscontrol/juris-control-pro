ALTER TABLE public.config_deteccao_coordenacao
  ADD COLUMN IF NOT EXISTS destinatarios_audiencias_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS destinatarios_intimacoes_ids uuid[] NOT NULL DEFAULT '{}';