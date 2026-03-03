
ALTER TABLE public.tarefas 
  ADD COLUMN IF NOT EXISTS data_prevista date,
  ADD COLUMN IF NOT EXISTS data_criacao_projuris date;

COMMENT ON COLUMN public.tarefas.data_prevista IS 'Data prevista da planilha Projuris';
COMMENT ON COLUMN public.tarefas.data_criacao_projuris IS 'Data de criação original da planilha Projuris';
