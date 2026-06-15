CREATE OR REPLACE FUNCTION public.validar_horarios_djen_servidor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_overlap text[];
BEGIN
  IF NEW.tipo = 'djen_paralela_servidor' AND COALESCE(array_length(NEW.horarios_execucao, 1), 0) > 0 THEN
    SELECT array_agg(DISTINCT h)
      INTO v_overlap
    FROM unnest(NEW.horarios_execucao) h
    WHERE h = ANY (
      COALESCE((
        SELECT array_agg(DISTINCT nh)
        FROM public.configuracoes_monitoramento c
        CROSS JOIN LATERAL unnest(COALESCE(c.horarios_execucao, ARRAY[]::text[])) nh
        WHERE c.tipo IN ('djen', 'djen_paralela')
      ), ARRAY[]::text[])
    );

    IF COALESCE(array_length(v_overlap, 1), 0) > 0 THEN
      RAISE EXCEPTION 'DJEN Servidor não pode usar o mesmo horário do DJEN normal: %', array_to_string(v_overlap, ', ');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_horarios_djen_servidor ON public.configuracoes_monitoramento_servidor;
CREATE TRIGGER trg_validar_horarios_djen_servidor
BEFORE INSERT OR UPDATE OF tipo, horarios_execucao
ON public.configuracoes_monitoramento_servidor
FOR EACH ROW
EXECUTE FUNCTION public.validar_horarios_djen_servidor();

CREATE OR REPLACE FUNCTION public.enfileirar_execucao_servidor(
  p_tipo text,
  p_agendado_para timestamptz DEFAULT now(),
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text;
  v_id uuid;
BEGIN
  IF COALESCE((p_payload->>'manual')::boolean, false) THEN
    v_key := p_tipo || '|manual|' || gen_random_uuid()::text;
  ELSE
    v_key := p_tipo || '|' || to_char(date_trunc('hour', p_agendado_para) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24');
  END IF;

  INSERT INTO public.execucoes_servidor (tipo, agendado_para, payload, dedupe_key)
  VALUES (p_tipo, p_agendado_para, p_payload, v_key)
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enfileirar_execucao_servidor(text, timestamptz, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enfileirar_execucao_servidor(text, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enfileirar_execucao_servidor(text, timestamptz, jsonb) TO service_role;