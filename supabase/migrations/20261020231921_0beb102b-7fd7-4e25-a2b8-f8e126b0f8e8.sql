DO $$
DECLARE
  v_coord uuid := 'f3b3b3b3-234d-48b3-8f3e-e3d956cae927';
  v_usuario uuid;
  v_total integer;
BEGIN
  SELECT coordenador_id INTO v_usuario FROM public.coordenacoes WHERE id = v_coord;
  IF v_usuario IS DISTINCT FROM 'bed324ca-9aea-462c-92b4-09fc174b5e28'::uuid THEN
    RAISE EXCEPTION 'Coordenador da Citibank diverge da conferência; nenhuma alteração aplicada';
  END IF;

  UPDATE public.processos
  SET advogado_responsavel_id = v_usuario
  WHERE coordenacao_id = v_coord
    AND advogado_responsavel_id IS DISTINCT FROM v_usuario;

  INSERT INTO public.processos_responsaveis (processo_id, usuario_id, coordenacao_id, papel, ativo)
  SELECT id, v_usuario, v_coord, 'responsavel', true
  FROM public.processos WHERE coordenacao_id = v_coord
  ON CONFLICT (processo_id, usuario_id) DO UPDATE
  SET coordenacao_id = EXCLUDED.coordenacao_id, papel = EXCLUDED.papel, ativo = true, updated_at = now();

  SELECT count(*) INTO v_total FROM public.processos p
  WHERE p.coordenacao_id = v_coord
    AND (p.advogado_responsavel_id IS DISTINCT FROM v_usuario
      OR NOT EXISTS (SELECT 1 FROM public.processos_responsaveis r
                     WHERE r.processo_id = p.id AND r.usuario_id = v_usuario AND r.ativo = true));
  IF v_total <> 0 THEN
    RAISE EXCEPTION 'Verificação de atribuição falhou em % processos', v_total;
  END IF;
END $$;