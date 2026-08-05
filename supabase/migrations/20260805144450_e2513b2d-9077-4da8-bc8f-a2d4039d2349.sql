ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'protocolado';
ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'baixado';
ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'minutado_revisao';
ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'reagendado';
ALTER TYPE public.status_tarefa ADD VALUE IF NOT EXISTS 'tratado';

ALTER TABLE public.etiquetas
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_etiquetas_cliente_id ON public.etiquetas(cliente_id);