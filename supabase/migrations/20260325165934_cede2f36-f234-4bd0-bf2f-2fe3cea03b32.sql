
ALTER TABLE public.processos 
ADD COLUMN IF NOT EXISTS responsavel_tst_id UUID REFERENCES auth.users(id) DEFAULT NULL;

COMMENT ON COLUMN public.processos.responsavel_tst_id IS 'ID do usuário responsável pelo prazo TST';
