CREATE UNIQUE INDEX IF NOT EXISTS uq_distribuicoes_tst_processo_aba 
ON public.distribuicoes_tst (processo_numero, aba_origem);