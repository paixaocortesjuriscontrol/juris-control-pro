
-- Adiciona o valor 'cancelado' ao enum status_tarefa para permitir cancelar tarefas/prazos
ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'cancelado';
