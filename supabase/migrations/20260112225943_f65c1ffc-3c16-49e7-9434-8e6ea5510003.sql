
DO $$
DECLARE
  v_target_id uuid;
  v_source_ids uuid[];
BEGIN
  SELECT id INTO v_target_id FROM public.clientes WHERE nome = 'Centro Radiológico do Gama S/A' LIMIT 1;
  
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Cliente destino não encontrado';
  END IF;
  
  SELECT array_agg(id) INTO v_source_ids FROM public.clientes 
  WHERE nome = 'Centro Radiológico do Gama' AND id != v_target_id;
  
  UPDATE public.processos SET cliente_id = v_target_id WHERE cliente_id = ANY(v_source_ids);
  UPDATE public.pastas SET cliente_id = v_target_id WHERE cliente_id = ANY(v_source_ids);
  DELETE FROM public.clientes_grupos WHERE cliente_id = ANY(v_source_ids);
  DELETE FROM public.clientes WHERE id = ANY(v_source_ids);
END $$;
