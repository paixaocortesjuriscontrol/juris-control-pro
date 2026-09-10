ALTER TABLE public.comentarios_tarefas ADD COLUMN IF NOT EXISTS is_cobranca boolean NOT NULL DEFAULT false;
ALTER TABLE public.comentarios_eventos ADD COLUMN IF NOT EXISTS is_cobranca boolean NOT NULL DEFAULT false;
ALTER TABLE public.comentarios_audiencias ADD COLUMN IF NOT EXISTS is_cobranca boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_comentarios_tarefas_cobranca ON public.comentarios_tarefas (tarefa_id) WHERE is_cobranca;
CREATE INDEX IF NOT EXISTS idx_comentarios_eventos_cobranca ON public.comentarios_eventos (evento_id) WHERE is_cobranca;
CREATE INDEX IF NOT EXISTS idx_comentarios_audiencias_cobranca ON public.comentarios_audiencias (audiencia_id) WHERE is_cobranca;