CREATE OR REPLACE FUNCTION public.buscar_distribuicoes_tst_agora(_dias integer DEFAULT 7)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM membros_coordenacao WHERE usuario_id = auth.uid() AND coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5')) THEN
    RAISE EXCEPTION 'sem acesso';
  END IF;
  RETURN public.gerar_distribuicoes_tst_auto(least(greatest(coalesce(_dias,7),1),
    CASE WHEN has_role(auth.uid(),'admin') THEN 180 ELSE 31 END));
END $$;