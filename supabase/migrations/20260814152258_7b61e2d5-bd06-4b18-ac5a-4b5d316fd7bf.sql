ALTER TABLE public.workflow_etapas ADD COLUMN responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.workflow_etapas.responsavel_id IS 'Responsável predefinido para esta etapa quando a regra for predefinida';