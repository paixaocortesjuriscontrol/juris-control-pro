
ALTER TABLE public.processos 
ADD COLUMN IF NOT EXISTS criado_por_tst UUID REFERENCES auth.users(id) DEFAULT NULL;

COMMENT ON COLUMN public.processos.criado_por_tst IS 'Usuário que cadastrou o prazo TST manualmente';
