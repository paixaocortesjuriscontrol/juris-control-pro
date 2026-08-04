CREATE OR REPLACE FUNCTION public.desfazer_descarte_lote(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_termo integer := 0;
  v_proc integer := 0;
  v_servidor integer := 0;
  v_res jsonb;
  r record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  FOR r IN
    SELECT id FROM public.publicacoes_djen_descartadas
    WHERE lote_descarte_id = p_lote_id
  LOOP
    v_res := public.desfazer_descarte_individual(r.id);
    IF v_res->>'restaurado' = 'termo' THEN
      v_termo := v_termo + 1;
    ELSIF v_res->>'restaurado' = 'processo' THEN
      v_proc := v_proc + 1;
    ELSIF v_res->>'restaurado' = 'servidor' THEN
      v_servidor := v_servidor + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'termo_restaurado', v_termo,
    'processo_restaurado', v_proc,
    'servidor_restaurado', v_servidor,
    'total', v_termo + v_proc + v_servidor
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.desfazer_descarte_lote(uuid) TO authenticated;