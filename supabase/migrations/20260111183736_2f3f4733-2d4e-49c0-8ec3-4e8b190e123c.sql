-- Vincular responsáveis das tarefas aos seus processos na tabela processos_responsaveis
-- Isso corrige tarefas que foram importadas mas não criaram o vínculo

-- Obter a coordenação do Dr. Jhonatan para usar nos novos vínculos
DO $$
DECLARE
  v_coordenacao_jhonatan UUID := '968631d0-6659-46f1-b45d-899892cb0121';
  v_inserted INT := 0;
BEGIN
  -- Inserir vínculos para tarefas que têm processo_id e responsavel_id
  -- mas não têm entrada correspondente em processos_responsaveis
  INSERT INTO public.processos_responsaveis (processo_id, usuario_id, coordenacao_id, papel, ativo)
  SELECT DISTINCT 
    t.processo_id,
    t.responsavel_id,
    COALESCE(p.coordenacao_id, v_coordenacao_jhonatan),
    'Responsável',
    true
  FROM public.tarefas t
  JOIN public.processos p ON p.id = t.processo_id
  WHERE t.processo_id IS NOT NULL 
    AND t.responsavel_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.processos_responsaveis pr 
      WHERE pr.processo_id = t.processo_id AND pr.usuario_id = t.responsavel_id
    )
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE 'Vínculos criados: %', v_inserted;
END $$;

-- Atualizar advogado_responsavel_id dos processos que ainda não têm
UPDATE public.processos p
SET advogado_responsavel_id = (
  SELECT pr.usuario_id 
  FROM public.processos_responsaveis pr 
  WHERE pr.processo_id = p.id AND pr.ativo = true
  ORDER BY pr.created_at
  LIMIT 1
)
WHERE p.advogado_responsavel_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.processos_responsaveis pr 
    WHERE pr.processo_id = p.id AND pr.ativo = true
  );