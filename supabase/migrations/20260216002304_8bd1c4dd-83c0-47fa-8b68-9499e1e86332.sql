
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS status_tst TEXT;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS transito_julgado_tst TEXT;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS sugestao_providencia_tst TEXT;
