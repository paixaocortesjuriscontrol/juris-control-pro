-- Relaxar reaper de 3 para 6 minutos para evitar matar execuções legitimamente lentas
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
             's) — worker/VPS derrubado. Execute novamente (checkpoint preservado).',
           updated_at = now()
     WHERE status = 'executando'
       AND (
         (heartbeat_at IS NOT NULL AND heartbeat_at < now() - interval '6 minutes')
         OR (heartbeat_at IS NULL AND iniciado_em IS NOT NULL AND iniciado_em < now() - interval '6 minutes')
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;