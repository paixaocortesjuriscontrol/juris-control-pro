ALTER TABLE public.permissoes_situacao_tipo_tarefa
  ADD COLUMN IF NOT EXISTS ativa boolean NOT NULL DEFAULT true;