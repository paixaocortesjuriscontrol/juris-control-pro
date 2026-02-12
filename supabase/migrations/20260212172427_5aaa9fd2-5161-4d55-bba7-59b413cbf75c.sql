-- Limpar movimentações DataJud históricas (anteriores a 7 dias atrás) importadas hoje por engano
DELETE FROM movimentacoes_datajud 
WHERE created_at >= '2026-02-12' 
  AND data_movimentacao IS NOT NULL 
  AND data_movimentacao < '2026-02-05';