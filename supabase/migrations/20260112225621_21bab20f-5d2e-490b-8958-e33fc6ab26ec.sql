
-- Unificar clientes para Hospital Prontonorte S/A
DO $$
DECLARE
  v_target_id uuid;
  v_source_ids uuid[];
BEGIN
  -- Buscar o ID do cliente destino
  SELECT id INTO v_target_id FROM public.clientes WHERE nome = 'Hospital Prontonorte S/A' LIMIT 1;
  
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Cliente destino "Hospital Prontonorte S/A" não encontrado';
  END IF;
  
  -- Buscar IDs dos clientes a serem unificados
  SELECT array_agg(id) INTO v_source_ids FROM public.clientes 
  WHERE nome IN (
    'HPN, Intensifisio Assistência em Fisioterapia',
    'HPN, Pronto Imagem Serviços Radiológicos LTDA',
    'HPN, TOP SERVICE',
    'KATHEDRAL, HPN'
  );
  
  -- Atualizar processos
  UPDATE public.processos SET cliente_id = v_target_id WHERE cliente_id = ANY(v_source_ids);
  
  -- Atualizar pastas
  UPDATE public.pastas SET cliente_id = v_target_id WHERE cliente_id = ANY(v_source_ids);
  
  -- Remover vínculos de grupos duplicados (manter apenas os do target)
  DELETE FROM public.clientes_grupos WHERE cliente_id = ANY(v_source_ids);
  
  -- Remover clientes duplicados
  DELETE FROM public.clientes WHERE id = ANY(v_source_ids);
  
  RAISE NOTICE 'Unificação concluída. % clientes migrados para Hospital Prontonorte S/A', array_length(v_source_ids, 1);
END $$;
