UPDATE public.dados_benner SET status_distribuicao = 'delegada' WHERE status_distribuicao = 'pendente';
UPDATE public.dados_benner SET status_distribuicao = 'finalizada' WHERE status_distribuicao = 'entregue';
ALTER TABLE public.dados_benner ALTER COLUMN status_distribuicao SET DEFAULT 'delegada';