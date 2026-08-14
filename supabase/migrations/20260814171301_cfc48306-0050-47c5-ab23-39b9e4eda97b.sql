-- workflow_etapas.tipo_item: aceitar maiúsculas/minúsculas
ALTER TABLE public.workflow_etapas DROP CONSTRAINT IF EXISTS workflow_etapas_tipo_item_check;
ALTER TABLE public.workflow_etapas ADD CONSTRAINT workflow_etapas_tipo_item_check
  CHECK (lower(tipo_item) = ANY (ARRAY['prazo','tarefa','audiencia','evento','parcelamento']));

-- workflow_etapas.tipo_prazo: aceitar dias_corridos/dias_uteis
ALTER TABLE public.workflow_etapas DROP CONSTRAINT IF EXISTS workflow_etapas_tipo_prazo_check;
ALTER TABLE public.workflow_etapas ADD CONSTRAINT workflow_etapas_tipo_prazo_check
  CHECK (lower(replace(tipo_prazo,'dias_','')) = ANY (ARRAY['corridos','uteis']));

-- workflow_execucao_etapas.item_tipo
ALTER TABLE public.workflow_execucao_etapas DROP CONSTRAINT IF EXISTS workflow_execucao_etapas_item_tipo_check;
ALTER TABLE public.workflow_execucao_etapas ADD CONSTRAINT workflow_execucao_etapas_item_tipo_check
  CHECK (item_tipo IS NULL OR lower(item_tipo) = ANY (ARRAY['prazo','tarefa','audiencia','evento','parcelamento']));

-- workflow_execucao_etapas.status: incluir materializada/cancelada
ALTER TABLE public.workflow_execucao_etapas DROP CONSTRAINT IF EXISTS workflow_execucao_etapas_status_check;
ALTER TABLE public.workflow_execucao_etapas ADD CONSTRAINT workflow_execucao_etapas_status_check
  CHECK (status = ANY (ARRAY['pendente','criada','materializada','concluida','cancelada','interrompida']));

-- workflow_execucoes.status: incluir concluido/cancelada
ALTER TABLE public.workflow_execucoes DROP CONSTRAINT IF EXISTS workflow_execucoes_status_check;
ALTER TABLE public.workflow_execucoes ADD CONSTRAINT workflow_execucoes_status_check
  CHECK (status = ANY (ARRAY['em_andamento','concluida','concluido','interrompida','cancelada']));