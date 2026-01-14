-- Limpar cache de hash global para permitir recaptura das publicações de hoje
-- A coluna correta é primeiro_monitoramento_id

-- Remover TODOS os hashes para permitir reprocessamento completo
TRUNCATE TABLE public.publicacoes_djen_global_hash;

-- Limpar descartadas recentes para serem reavaliadas
DELETE FROM public.publicacoes_djen_descartadas
WHERE created_at >= '2026-01-13'::date;