-- Deletar publicações DJEN de processos de hoje
DELETE FROM publicacoes_djen_processos 
WHERE created_at >= '2026-01-06 00:00:00+00';

-- Deletar audiências detectadas de hoje (origem monitoramento_djen_processos)
DELETE FROM audiencias_detectadas 
WHERE origem = 'monitoramento_djen_processos' 
AND created_at >= '2026-01-06 00:00:00+00';

-- Deletar intimações detectadas de hoje (origem monitoramento_djen_processos)
DELETE FROM intimacoes_detectadas 
WHERE origem = 'monitoramento_djen_processos' 
AND created_at >= '2026-01-06 00:00:00+00';