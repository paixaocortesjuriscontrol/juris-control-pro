ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'a_confirmar';
ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'em_execucao';
ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'revisao';
ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'verificado';
ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'concluido_sem_sucesso';