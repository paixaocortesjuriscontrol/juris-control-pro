DELETE FROM public.publicacoes_djen
WHERE fonte = 'kurier';

TRUNCATE TABLE public.kurier_publicacoes_raw;
TRUNCATE TABLE public.kurier_execucoes;