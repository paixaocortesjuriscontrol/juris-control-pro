UPDATE public.execucoes_servidor_falhas
SET status = 'pendente', tentativas = 0, updated_at = now()
WHERE dia_brt >= '2026-08-17' AND status = 'abandonado';