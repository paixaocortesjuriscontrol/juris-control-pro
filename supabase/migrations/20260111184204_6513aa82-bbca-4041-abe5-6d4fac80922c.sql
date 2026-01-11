-- Atribuir todos os processos da coordenação do Dr. Jhonatan que não têm responsável ao próprio Dr. Jhonatan
DO $$
DECLARE
  v_coordenacao_jhonatan UUID := '968631d0-6659-46f1-b45d-899892cb0121';
  v_usuario_jhonatan UUID;
  v_inserted INT := 0;
BEGIN
  -- Obter o ID do Dr. Jhonatan (coordenador da coordenação)
  SELECT coordenador_id INTO v_usuario_jhonatan
  FROM public.coordenacoes
  WHERE id = v_coordenacao_jhonatan;
  
  IF v_usuario_jhonatan IS NULL THEN
    RAISE EXCEPTION 'Coordenador não encontrado para a coordenação';
  END IF;
  
  RAISE NOTICE 'Coordenador ID: %', v_usuario_jhonatan;
  
  -- Inserir vínculos para processos que não têm nenhum responsável
  INSERT INTO public.processos_responsaveis (processo_id, usuario_id, coordenacao_id, papel, ativo)
  SELECT 
    p.id,
    v_usuario_jhonatan,
    v_coordenacao_jhonatan,
    'Responsável',
    true
  FROM public.processos p
  WHERE p.coordenacao_id = v_coordenacao_jhonatan
    AND NOT EXISTS (
      SELECT 1 FROM public.processos_responsaveis pr 
      WHERE pr.processo_id = p.id AND pr.ativo = true
    )
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE 'Processos vinculados ao Dr. Jhonatan: %', v_inserted;
  
  -- Atualizar advogado_responsavel_id dos processos que ainda não têm
  UPDATE public.processos p
  SET advogado_responsavel_id = v_usuario_jhonatan
  WHERE p.coordenacao_id = v_coordenacao_jhonatan
    AND p.advogado_responsavel_id IS NULL;
    
END $$;