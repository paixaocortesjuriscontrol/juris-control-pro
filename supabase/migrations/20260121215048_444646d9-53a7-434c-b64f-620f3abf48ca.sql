-- Script de limpeza de tarefas duplicadas (automáticas/importadas)
-- Mantém a PRIMEIRA tarefa criada de cada grupo de duplicados

-- 1. Criar tabela temporária para backup antes de deletar
CREATE TABLE IF NOT EXISTS public.tarefas_duplicadas_backup (
  id UUID PRIMARY KEY,
  titulo TEXT,
  data_vencimento DATE,
  data_fatal DATE,
  processo_id UUID,
  responsavel_id UUID,
  criado_por UUID,
  tipo_tarefa TEXT,
  origem TEXT,
  created_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  kept_id UUID -- ID da tarefa que foi mantida
);

-- 2. Inserir na tabela de backup as tarefas que serão removidas
INSERT INTO public.tarefas_duplicadas_backup (id, titulo, data_vencimento, data_fatal, processo_id, responsavel_id, criado_por, tipo_tarefa, origem, created_at, kept_id)
SELECT 
  t.id,
  t.titulo,
  t.data_vencimento,
  t.data_fatal,
  t.processo_id,
  t.responsavel_id,
  t.criado_por,
  t.tipo_tarefa,
  t.origem,
  t.created_at,
  keeper.id as kept_id
FROM tarefas t
INNER JOIN (
  -- Subquery para identificar a tarefa mais antiga de cada grupo (a que será MANTIDA)
  SELECT 
    LOWER(TRIM(titulo)) as titulo_norm,
    COALESCE(data_vencimento, data_fatal) as data_ref,
    processo_id,
    responsavel_id,
    tipo_tarefa,
    MIN(created_at) as min_created
  FROM tarefas
  WHERE origem IS NOT NULL
  GROUP BY 
    LOWER(TRIM(titulo)),
    COALESCE(data_vencimento, data_fatal),
    processo_id,
    responsavel_id,
    tipo_tarefa
  HAVING COUNT(*) > 1
) grupos ON 
  LOWER(TRIM(t.titulo)) = grupos.titulo_norm
  AND COALESCE(t.data_vencimento, t.data_fatal) = grupos.data_ref
  AND COALESCE(t.processo_id::text, '') = COALESCE(grupos.processo_id::text, '')
  AND COALESCE(t.responsavel_id::text, '') = COALESCE(grupos.responsavel_id::text, '')
  AND COALESCE(t.tipo_tarefa, '') = COALESCE(grupos.tipo_tarefa, '')
INNER JOIN tarefas keeper ON 
  LOWER(TRIM(keeper.titulo)) = grupos.titulo_norm
  AND COALESCE(keeper.data_vencimento, keeper.data_fatal) = grupos.data_ref
  AND COALESCE(keeper.processo_id::text, '') = COALESCE(grupos.processo_id::text, '')
  AND COALESCE(keeper.responsavel_id::text, '') = COALESCE(grupos.responsavel_id::text, '')
  AND COALESCE(keeper.tipo_tarefa, '') = COALESCE(grupos.tipo_tarefa, '')
  AND keeper.created_at = grupos.min_created
WHERE t.origem IS NOT NULL
  AND t.created_at > grupos.min_created -- Exclui a mais antiga (que será mantida)
ON CONFLICT (id) DO NOTHING;

-- 3. Deletar as duplicatas (mantendo a mais antiga de cada grupo)
DELETE FROM tarefas
WHERE id IN (
  SELECT t.id
  FROM tarefas t
  INNER JOIN (
    SELECT 
      LOWER(TRIM(titulo)) as titulo_norm,
      COALESCE(data_vencimento, data_fatal) as data_ref,
      processo_id,
      responsavel_id,
      tipo_tarefa,
      MIN(created_at) as min_created
    FROM tarefas
    WHERE origem IS NOT NULL
    GROUP BY 
      LOWER(TRIM(titulo)),
      COALESCE(data_vencimento, data_fatal),
      processo_id,
      responsavel_id,
      tipo_tarefa
    HAVING COUNT(*) > 1
  ) grupos ON 
    LOWER(TRIM(t.titulo)) = grupos.titulo_norm
    AND COALESCE(t.data_vencimento, t.data_fatal) = grupos.data_ref
    AND COALESCE(t.processo_id::text, '') = COALESCE(grupos.processo_id::text, '')
    AND COALESCE(t.responsavel_id::text, '') = COALESCE(grupos.responsavel_id::text, '')
    AND COALESCE(t.tipo_tarefa, '') = COALESCE(grupos.tipo_tarefa, '')
  WHERE t.origem IS NOT NULL
    AND t.created_at > grupos.min_created
);