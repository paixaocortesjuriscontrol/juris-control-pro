ALTER TABLE public.responsaveis_fixos_tipo_tarefa
ADD COLUMN IF NOT EXISTS envolvidos UUID[] NOT NULL DEFAULT '{}';