CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflows acessíveis pela coordenação" ON public.workflows
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.coordenacoes c
      WHERE c.id = workflows.coordenacao_id AND c.coordenador_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.membros_coordenacao m
      WHERE m.coordenacao_id = workflows.coordenacao_id AND m.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Workflows gerenciáveis pela coordenação" ON public.workflows
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.coordenacoes c
      WHERE c.id = workflows.coordenacao_id AND c.coordenador_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'assistente_coordenador'
    )
  );

CREATE TABLE public.workflow_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  titulo text NOT NULL,
  tipo_item text NOT NULL CHECK (tipo_item IN ('prazo','tarefa','audiencia','evento','parcelamento')),
  tipo_prazo text NOT NULL DEFAULT 'corridos' CHECK (tipo_prazo IN ('corridos','uteis')),
  dias_previsto integer NOT NULL DEFAULT 0,
  dias_fatal integer,
  prioridade public.prioridade_tarefa NOT NULL DEFAULT 'media',
  descricao text,
  exibir_kanban boolean NOT NULL DEFAULT false,
  regra_responsavel text NOT NULL DEFAULT 'predefinido' CHECK (regra_responsavel IN ('predefinido','anterior','iniciador')),
  condicao text NOT NULL DEFAULT 'inicio' CHECK (condicao IN ('inicio','apos_etapa')),
  etapa_anterior_id uuid REFERENCES public.workflow_etapas(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_etapas TO authenticated;
GRANT ALL ON public.workflow_etapas TO service_role;

ALTER TABLE public.workflow_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Etapas de workflow acessíveis pela coordenação" ON public.workflow_etapas
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      WHERE w.id = workflow_etapas.workflow_id
      AND (
        public.has_role(auth.uid(), 'admin') OR
        w.coordenacao_id IN (
          SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
          UNION
          SELECT id FROM public.coordenacoes WHERE coordenador_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Etapas de workflow gerenciáveis pela coordenação" ON public.workflow_etapas
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      WHERE w.id = workflow_etapas.workflow_id
      AND (
        public.has_role(auth.uid(), 'admin') OR
        w.coordenacao_id IN (
          SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
          UNION
          SELECT id FROM public.coordenacoes WHERE coordenador_id = auth.uid()
        )
      )
    )
  );

CREATE TABLE public.workflow_etapa_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid NOT NULL REFERENCES public.workflow_etapas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(etapa_id, usuario_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_etapa_responsaveis TO authenticated;
GRANT ALL ON public.workflow_etapa_responsaveis TO service_role;

ALTER TABLE public.workflow_etapa_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Responsáveis de etapa acessíveis pela coordenação" ON public.workflow_etapa_responsaveis
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workflow_etapas we
      JOIN public.workflows w ON w.id = we.workflow_id
      WHERE we.id = workflow_etapa_responsaveis.etapa_id
      AND (
        public.has_role(auth.uid(), 'admin') OR
        w.coordenacao_id IN (
          SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
          UNION
          SELECT id FROM public.coordenacoes WHERE coordenador_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Responsáveis de etapa gerenciáveis pela coordenação" ON public.workflow_etapa_responsaveis
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workflow_etapas we
      JOIN public.workflows w ON w.id = we.workflow_id
      WHERE we.id = workflow_etapa_responsaveis.etapa_id
      AND (
        public.has_role(auth.uid(), 'admin') OR
        w.coordenacao_id IN (
          SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
          UNION
          SELECT id FROM public.coordenacoes WHERE coordenador_id = auth.uid()
        )
      )
    )
  );

CREATE TABLE public.workflow_etapa_envolvidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid NOT NULL REFERENCES public.workflow_etapas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(etapa_id, usuario_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_etapa_envolvidos TO authenticated;
GRANT ALL ON public.workflow_etapa_envolvidos TO service_role;

ALTER TABLE public.workflow_etapa_envolvidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Envolvidos de etapa acessíveis pela coordenação" ON public.workflow_etapa_envolvidos
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workflow_etapas we
      JOIN public.workflows w ON w.id = we.workflow_id
      WHERE we.id = workflow_etapa_envolvidos.etapa_id
      AND (
        public.has_role(auth.uid(), 'admin') OR
        w.coordenacao_id IN (
          SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
          UNION
          SELECT id FROM public.coordenacoes WHERE coordenador_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Envolvidos de etapa gerenciáveis pela coordenação" ON public.workflow_etapa_envolvidos
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workflow_etapas we
      JOIN public.workflows w ON w.id = we.workflow_id
      WHERE we.id = workflow_etapa_envolvidos.etapa_id
      AND (
        public.has_role(auth.uid(), 'admin') OR
        w.coordenacao_id IN (
          SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
          UNION
          SELECT id FROM public.coordenacoes WHERE coordenador_id = auth.uid()
        )
      )
    )
  );

CREATE TABLE public.workflow_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  iniciado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluida','interrompida')),
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_execucoes TO authenticated;
GRANT ALL ON public.workflow_execucoes TO service_role;

ALTER TABLE public.workflow_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Execuções acessíveis pela coordenação" ON public.workflow_execucoes
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    coordenacao_id IN (
      SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
      UNION
      SELECT id FROM public.coordenacoes WHERE coordenador_id = auth.uid()
    )
  );

CREATE POLICY "Execuções gerenciáveis pela coordenação" ON public.workflow_execucoes
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    coordenacao_id IN (
      SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
      UNION
      SELECT id FROM public.coordenacoes WHERE coordenador_id = auth.uid()
    )
  );

CREATE TABLE public.workflow_execucao_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.workflow_execucoes(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.workflow_etapas(id) ON DELETE CASCADE,
  item_id uuid,
  item_tipo text NOT NULL CHECK (item_tipo IN ('prazo','tarefa','audiencia','evento','parcelamento')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','criada','concluida','interrompida')),
  data_prevista_calculada date,
  data_fatal_calculada date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(execucao_id, etapa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_execucao_etapas TO authenticated;
GRANT ALL ON public.workflow_execucao_etapas TO service_role;

ALTER TABLE public.workflow_execucao_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Execução etapas acessíveis pela coordenação" ON public.workflow_execucao_etapas
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workflow_execucoes we
      WHERE we.id = workflow_execucao_etapas.execucao_id
      AND (
        public.has_role(auth.uid(), 'admin') OR
        we.coordenacao_id IN (
          SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
          UNION
          SELECT id FROM public.coordenacoes WHERE coordenador_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Execução etapas gerenciáveis pela coordenação" ON public.workflow_execucao_etapas
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.workflow_execucoes we
      WHERE we.id = workflow_execucao_etapas.execucao_id
      AND (
        public.has_role(auth.uid(), 'admin') OR
        we.coordenacao_id IN (
          SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
          UNION
          SELECT id FROM public.coordenacoes WHERE coordenador_id = auth.uid()
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_workflows_updated_at BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_workflow_updated_at();

CREATE TRIGGER trg_workflow_etapas_updated_at BEFORE UPDATE ON public.workflow_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_workflow_updated_at();

CREATE TRIGGER trg_workflow_execucoes_updated_at BEFORE UPDATE ON public.workflow_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.update_workflow_updated_at();

CREATE TRIGGER trg_workflow_execucao_etapas_updated_at BEFORE UPDATE ON public.workflow_execucao_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_workflow_updated_at();
