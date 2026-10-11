REVOKE EXECUTE ON FUNCTION public.trg_pautas_apos_djen_servidor() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_pautas_tst_auto(integer) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.buscar_pautas_tst_agora()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  RETURN public.gerar_pautas_tst_auto_wrapper();
END $$;
DROP FUNCTION public.buscar_pautas_tst_agora();
CREATE OR REPLACE FUNCTION public.buscar_pautas_tst_agora()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM membros_coordenacao WHERE user_id = auth.uid() AND coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5')) THEN
    RAISE EXCEPTION 'sem acesso';
  END IF;
  RETURN public.gerar_pautas_tst_auto(7);
END $$;
REVOKE EXECUTE ON FUNCTION public.buscar_pautas_tst_agora() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.buscar_pautas_tst_agora() TO authenticated;