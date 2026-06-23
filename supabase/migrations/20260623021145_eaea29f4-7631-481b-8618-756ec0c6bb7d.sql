CREATE OR REPLACE FUNCTION public.reset_jobs_orfaos_servidor(
  p_timeout_minutes int DEFAULT 15
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.execucoes_servidor
     SET status = 'pendente',
         worker_id = NULL,
         heartbeat_at = NULL
   WHERE status = 'executando'
     AND COALESCE(heartbeat_at, progresso_atualizado_em, iniciado_em, created_at) < now() - make_interval(mins => GREATEST(COALESCE(p_timeout_minutes, 15), 15));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_jobs_orfaos_servidor(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_jobs_orfaos_servidor(int) TO service_role;