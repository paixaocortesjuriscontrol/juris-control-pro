-- Migrar todos os processos do perfil duplicado 'Jhonantan' para o perfil correto 'Jhonatan Gonçalves'
DO $$
DECLARE
  v_perfil_errado UUID := 'ebd0f2e3-8b36-4523-baea-a6dd06307ef4';   -- Jhonantan (duplicado)
  v_perfil_correto UUID := '41294d81-47c9-40f4-9ad5-37f431c702a2';  -- Jhonatan Gonçalves (coordenador)
  v_processos_atualizados INT := 0;
  v_responsaveis_atualizados INT := 0;
  v_tarefas_atualizadas INT := 0;
BEGIN
  -- 1. Atualizar advogado_responsavel_id nos processos
  UPDATE public.processos
  SET advogado_responsavel_id = v_perfil_correto
  WHERE advogado_responsavel_id = v_perfil_errado;
  
  GET DIAGNOSTICS v_processos_atualizados = ROW_COUNT;
  RAISE NOTICE 'Processos atualizados (advogado_responsavel_id): %', v_processos_atualizados;
  
  -- 2. Atualizar processos_responsaveis
  -- Primeiro, remover vínculos duplicados que já existam para o perfil correto
  DELETE FROM public.processos_responsaveis pr1
  WHERE pr1.usuario_id = v_perfil_errado
    AND EXISTS (
      SELECT 1 FROM public.processos_responsaveis pr2 
      WHERE pr2.processo_id = pr1.processo_id 
        AND pr2.usuario_id = v_perfil_correto
    );
  
  -- Depois, atualizar os vínculos restantes para o perfil correto
  UPDATE public.processos_responsaveis
  SET usuario_id = v_perfil_correto
  WHERE usuario_id = v_perfil_errado;
  
  GET DIAGNOSTICS v_responsaveis_atualizados = ROW_COUNT;
  RAISE NOTICE 'Vínculos processos_responsaveis atualizados: %', v_responsaveis_atualizados;
  
  -- 3. Atualizar tarefas (responsavel_id)
  UPDATE public.tarefas
  SET responsavel_id = v_perfil_correto
  WHERE responsavel_id = v_perfil_errado;
  
  GET DIAGNOSTICS v_tarefas_atualizadas = ROW_COUNT;
  RAISE NOTICE 'Tarefas atualizadas: %', v_tarefas_atualizadas;
  
END $$;