
-- 1) Reaper: marca como 'falhou' execuções executando sem heartbeat há > 3 min
CREATE OR REPLACE FUNCTION public.reaper_execucoes_servidor_travadas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.execucoes_servidor
       SET status = 'falhou',
           finalizado_em = now(),
           erro = COALESCE(erro, '') ||
             CASE WHEN COALESCE(erro,'') = '' THEN '' ELSE ' | ' END ||
             'Heartbeat parado (' ||
             COALESCE(EXTRACT(EPOCH FROM (now() - heartbeat_at))::int, EXTRACT(EPOCH FROM (now() - iniciado_em))::int) ||
             's) — worker/VPS derrubado. Execute novamente.',
           updated_at = now()
     WHERE status = 'executando'
       AND (
         (heartbeat_at IS NOT NULL AND heartbeat_at < now() - interval '3 minutes')
         OR (heartbeat_at IS NULL AND iniciado_em IS NOT NULL AND iniciado_em < now() - interval '3 minutes')
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reaper_execucoes_servidor_travadas() TO service_role;

-- 2) RPC para o botão "Destravar" (autenticado)
CREATE OR REPLACE FUNCTION public.destravar_execucao_servidor(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.execucoes_servidor
     SET status = 'falhou',
         finalizado_em = now(),
         erro = COALESCE(NULLIF(erro,''), 'Destravado manualmente pelo usuário'),
         updated_at = now()
   WHERE id = p_id
     AND status IN ('executando','pendente','agendado');
END;
$$;

GRANT EXECUTE ON FUNCTION public.destravar_execucao_servidor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.destravar_execucao_servidor(uuid) TO service_role;

-- 3) Cron a cada 1 minuto
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('reaper-execucoes-servidor-travadas');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reaper-execucoes-servidor-travadas',
  '* * * * *',
  $$SELECT public.reaper_execucoes_servidor_travadas();$$
);
