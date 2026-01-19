-- Add new Projuris-specific columns to tarefas table
ALTER TABLE public.tarefas
ADD COLUMN IF NOT EXISTS hora_criacao TEXT,
ADD COLUMN IF NOT EXISTS hora_prevista TEXT,
ADD COLUMN IF NOT EXISTS hora_fatal TEXT,
ADD COLUMN IF NOT EXISTS hora_conclusao TEXT,
ADD COLUMN IF NOT EXISTS link_local TEXT,
ADD COLUMN IF NOT EXISTS identificador_timesheet TEXT,
ADD COLUMN IF NOT EXISTS total_horas_timesheet TEXT,
ADD COLUMN IF NOT EXISTS modulo TEXT,
ADD COLUMN IF NOT EXISTS identificador_modulo TEXT,
ADD COLUMN IF NOT EXISTS situacao_processo TEXT,
ADD COLUMN IF NOT EXISTS instancia TEXT,
ADD COLUMN IF NOT EXISTS descricao_ultimo_andamento TEXT,
ADD COLUMN IF NOT EXISTS partes_ativas TEXT,
ADD COLUMN IF NOT EXISTS partes_passivas TEXT,
ADD COLUMN IF NOT EXISTS outras_partes TEXT,
ADD COLUMN IF NOT EXISTS envolvimento_clientes TEXT,
ADD COLUMN IF NOT EXISTS envolvimento_contrarios TEXT,
ADD COLUMN IF NOT EXISTS orgao TEXT,
ADD COLUMN IF NOT EXISTS orgao_julgador TEXT,
ADD COLUMN IF NOT EXISTS marcadores_vinculo TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.tarefas.hora_criacao IS 'Hora de criação da tarefa (Projuris)';
COMMENT ON COLUMN public.tarefas.hora_prevista IS 'Hora prevista da tarefa (Projuris)';
COMMENT ON COLUMN public.tarefas.hora_fatal IS 'Hora fatal da tarefa (Projuris)';
COMMENT ON COLUMN public.tarefas.hora_conclusao IS 'Hora de conclusão da tarefa (Projuris)';
COMMENT ON COLUMN public.tarefas.link_local IS 'Link ou local da tarefa (Projuris)';
COMMENT ON COLUMN public.tarefas.identificador_timesheet IS 'Identificador do timesheet (Projuris)';
COMMENT ON COLUMN public.tarefas.total_horas_timesheet IS 'Total de horas do timesheet (Projuris)';
COMMENT ON COLUMN public.tarefas.modulo IS 'Módulo da tarefa (Projuris)';
COMMENT ON COLUMN public.tarefas.identificador_modulo IS 'Identificador do módulo (Projuris)';
COMMENT ON COLUMN public.tarefas.situacao_processo IS 'Situação do processo vinculado (Projuris)';
COMMENT ON COLUMN public.tarefas.instancia IS 'Instância do processo (Projuris)';
COMMENT ON COLUMN public.tarefas.descricao_ultimo_andamento IS 'Descrição do último andamento (Projuris)';
COMMENT ON COLUMN public.tarefas.partes_ativas IS 'Partes ativas do processo (Projuris)';
COMMENT ON COLUMN public.tarefas.partes_passivas IS 'Partes passivas do processo (Projuris)';
COMMENT ON COLUMN public.tarefas.outras_partes IS 'Outras partes do processo (Projuris)';
COMMENT ON COLUMN public.tarefas.envolvimento_clientes IS 'Clientes do atendimento (Projuris)';
COMMENT ON COLUMN public.tarefas.envolvimento_contrarios IS 'Contrários do atendimento (Projuris)';
COMMENT ON COLUMN public.tarefas.orgao IS 'Órgão da tarefa (Projuris)';
COMMENT ON COLUMN public.tarefas.orgao_julgador IS 'Órgão julgador (Projuris)';
COMMENT ON COLUMN public.tarefas.marcadores_vinculo IS 'Marcadores do vínculo (Projuris)';