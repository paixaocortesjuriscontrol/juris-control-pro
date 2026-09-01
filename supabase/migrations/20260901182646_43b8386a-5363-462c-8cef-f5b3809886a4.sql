DROP TRIGGER IF EXISTS trigger_criar_tarefa_intimacao ON public.intimacoes_detectadas;
DROP TRIGGER IF EXISTS trigger_criar_tarefa_audiencia ON public.audiencias_detectadas;
DROP FUNCTION IF EXISTS public.criar_tarefa_automatica_intimacao() CASCADE;
DROP FUNCTION IF EXISTS public.criar_tarefa_automatica_audiencia() CASCADE;