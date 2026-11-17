CREATE OR REPLACE FUNCTION public.pautas_completar_periodo(_de date, _ate date)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão inválida'; END IF;
  FOR r IN SELECT p.id FROM pautas_tst p WHERE p.data_julgamento BETWEEN _de AND _ate
    AND (has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM membros_coordenacao m WHERE m.usuario_id = auth.uid() AND m.coordenacao_id = p.coordenacao_id))
  LOOP PERFORM pauta_preencher_de_benner(r.id); n := n + 1; END LOOP;
  RETURN n;
END $function$;
REVOKE EXECUTE ON FUNCTION public.pautas_completar_periodo(date,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.pautas_completar_periodo(date,date) TO authenticated;