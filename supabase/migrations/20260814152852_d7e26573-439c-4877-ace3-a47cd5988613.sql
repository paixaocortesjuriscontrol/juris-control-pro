UPDATE public.workflow_etapas SET condicao = 'sempre' WHERE condicao = 'inicio';

ALTER TABLE public.workflow_etapas ALTER COLUMN condicao SET DEFAULT 'sempre';

ALTER TABLE public.workflow_etapas DROP CONSTRAINT IF EXISTS workflow_etapas_condicao_check;

ALTER TABLE public.workflow_etapas ADD CONSTRAINT workflow_etapas_condicao_check CHECK (condicao IN ('sempre', 'sucesso_anterior'));