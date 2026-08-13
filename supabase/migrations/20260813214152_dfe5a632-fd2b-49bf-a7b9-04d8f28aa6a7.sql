ALTER TABLE public.permissoes_situacao_tipo_tarefa
  ADD COLUMN IF NOT EXISTS comentario_obrigatorio boolean NOT NULL DEFAULT false;