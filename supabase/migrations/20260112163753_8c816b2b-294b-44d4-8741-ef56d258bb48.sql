-- Adicionar coluna origem na tabela tarefas para rastrear de onde veio a tarefa
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS origem text;

-- Criar índice para filtrar por origem
CREATE INDEX IF NOT EXISTS idx_tarefas_origem ON public.tarefas(origem);