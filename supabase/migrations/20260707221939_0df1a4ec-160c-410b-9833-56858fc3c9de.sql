
CREATE TABLE IF NOT EXISTS public.config_envio_alertas_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  tipo_tarefa text NOT NULL,
  canal_email boolean NOT NULL DEFAULT false,
  canal_whatsapp boolean NOT NULL DEFAULT false,
  dias_antes integer[] NOT NULL DEFAULT ARRAY[0]::integer[],
  destinatarios_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coordenacao_id, tipo_tarefa)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_envio_alertas_tarefas TO authenticated;
GRANT ALL ON public.config_envio_alertas_tarefas TO service_role;

ALTER TABLE public.config_envio_alertas_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros veem config da sua coordenacao"
ON public.config_envio_alertas_tarefas FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = config_envio_alertas_tarefas.coordenacao_id AND mc.usuario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.coordenacoes c WHERE c.id = config_envio_alertas_tarefas.coordenacao_id AND c.coordenador_id = auth.uid())
);

CREATE POLICY "membros gerenciam config da sua coordenacao"
ON public.config_envio_alertas_tarefas FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = config_envio_alertas_tarefas.coordenacao_id AND mc.usuario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.coordenacoes c WHERE c.id = config_envio_alertas_tarefas.coordenacao_id AND c.coordenador_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = config_envio_alertas_tarefas.coordenacao_id AND mc.usuario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.coordenacoes c WHERE c.id = config_envio_alertas_tarefas.coordenacao_id AND c.coordenador_id = auth.uid())
);

CREATE TRIGGER update_config_envio_alertas_tarefas_updated_at
BEFORE UPDATE ON public.config_envio_alertas_tarefas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
