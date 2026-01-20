-- Limpar runs presos em 'em_andamento' 
UPDATE djen_runs 
SET status = 'cancelado', 
    finalizado_em = now(), 
    motivo_erro = 'Cleanup - run preso sem continuação'
WHERE status = 'em_andamento' 
  AND finalizado_em IS NULL;

-- Limpar metadata de continuação para próxima execução começar do zero
UPDATE configuracoes_monitoramento 
SET metadata = jsonb_set(
  jsonb_set(
    jsonb_set(COALESCE(metadata, '{}'::jsonb), '{has_more}', 'false'),
    '{next_offset}', 'null'
  ),
  '{djen_run}', 'null'
)
WHERE tipo = 'djen';

-- Remover cron job duplicado (23:20 BRT não faz sentido)
SELECT cron.unschedule('monitorar-djen-2320');