REVOKE EXECUTE ON FUNCTION public.vincular_pautas_distribuicao(uuid[]) FROM authenticated;
CREATE OR REPLACE FUNCTION public.buscar_pautas_tst_agora()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE n integer;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM membros_coordenacao WHERE user_id = auth.uid() AND coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5')) THEN
    RAISE EXCEPTION 'sem acesso';
  END IF;
  n := public.gerar_pautas_tst_auto(7);
  PERFORM public.vincular_pautas_distribuicao(NULL);
  RETURN n;
END $function$;