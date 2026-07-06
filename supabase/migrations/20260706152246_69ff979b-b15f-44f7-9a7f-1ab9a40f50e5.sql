
-- Bloco 2: separar Prazo de Tarefa
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS tipo_registro TEXT NOT NULL DEFAULT 'tarefa'
  CHECK (tipo_registro IN ('tarefa','prazo'));

-- Backfill: registros com data_fatal preenchido viram 'prazo'
UPDATE public.tarefas
  SET tipo_registro = 'prazo'
  WHERE data_fatal IS NOT NULL AND tipo_registro = 'tarefa';

CREATE INDEX IF NOT EXISTS idx_tarefas_tipo_registro ON public.tarefas(tipo_registro);

-- Bloco 9: recorrência em eventos
ALTER TABLE public.eventos_agenda
  ADD COLUMN IF NOT EXISTS recorrencia_rrule TEXT,
  ADD COLUMN IF NOT EXISTS recorrencia_ate DATE;

-- Bloco 11: coordenação padrão do usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coordenacao_padrao_id UUID REFERENCES public.coordenacoes(id) ON DELETE SET NULL;
