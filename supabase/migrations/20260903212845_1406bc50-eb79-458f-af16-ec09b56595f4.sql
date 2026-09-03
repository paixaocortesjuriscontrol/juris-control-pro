CREATE OR REPLACE FUNCTION public.acquire_kurier_execution_lease(
  _exec_id uuid,
  _lease_token text,
  _lease_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _acquired boolean := false;
BEGIN
  UPDATE public.execucoes_agendadas
  SET detalhes = COALESCE(detalhes, '{}'::jsonb) || jsonb_build_object(
    'lease_token', _lease_token,
    'lease_until', (now() + make_interval(secs => GREATEST(30, LEAST(_lease_seconds, 300))))::text,
    'atualizado_em', now()::text
  )
  WHERE id = _exec_id
    AND tipo = 'djen_kurier'
    AND status IN ('pendente', 'executando')
    AND (
      NULLIF(detalhes->>'lease_until', '') IS NULL
      OR (detalhes->>'lease_until')::timestamptz < now()
      OR detalhes->>'lease_token' = _lease_token
    );
  GET DIAGNOSTICS _acquired = ROW_COUNT;
  RETURN _acquired;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_kurier_execution_lease(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_kurier_execution_lease(uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.release_kurier_execution_lease(
  _exec_id uuid,
  _lease_token text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.execucoes_agendadas
  SET detalhes = (COALESCE(detalhes, '{}'::jsonb) - 'lease_token' - 'lease_until')
    || jsonb_build_object('atualizado_em', now()::text)
  WHERE id = _exec_id
    AND tipo = 'djen_kurier'
    AND detalhes->>'lease_token' = _lease_token;
$$;

REVOKE ALL ON FUNCTION public.release_kurier_execution_lease(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_kurier_execution_lease(uuid, text) TO service_role;

UPDATE public.execucoes_agendadas
SET status = 'falhou',
    finalizado_em = now(),
    ultimo_erro = 'Execução interrompida por ausência de atualização do servidor',
    detalhes = COALESCE(detalhes, '{}'::jsonb) || jsonb_build_object(
      'interrompida', true,
      'mensagem_interrupcao', 'Execução interrompida por ausência de atualização do servidor',
      'interrompida_em', now()::text
    )
WHERE tipo = 'djen_kurier'
  AND status IN ('pendente', 'executando')
  AND COALESCE(NULLIF(detalhes->>'atualizado_em', '')::timestamptz, iniciado_em, created_at) < now() - interval '10 minutes';