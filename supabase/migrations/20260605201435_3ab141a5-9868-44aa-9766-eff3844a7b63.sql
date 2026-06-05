
-- Tabelas de vínculo para múltiplos responsáveis e envolvidos (acompanhamento)

CREATE TABLE IF NOT EXISTS public.tarefa_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tarefa_id, usuario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_responsaveis TO authenticated;
GRANT ALL ON public.tarefa_responsaveis TO service_role;
ALTER TABLE public.tarefa_responsaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tarefa_responsaveis" ON public.tarefa_responsaveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write tarefa_responsaveis" ON public.tarefa_responsaveis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth delete tarefa_responsaveis" ON public.tarefa_responsaveis FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_tarefa_responsaveis_tarefa ON public.tarefa_responsaveis(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_tarefa_responsaveis_usuario ON public.tarefa_responsaveis(usuario_id);

CREATE TABLE IF NOT EXISTS public.tarefa_envolvidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tarefa_id, usuario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_envolvidos TO authenticated;
GRANT ALL ON public.tarefa_envolvidos TO service_role;
ALTER TABLE public.tarefa_envolvidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tarefa_envolvidos" ON public.tarefa_envolvidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write tarefa_envolvidos" ON public.tarefa_envolvidos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth delete tarefa_envolvidos" ON public.tarefa_envolvidos FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_tarefa_envolvidos_tarefa ON public.tarefa_envolvidos(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_tarefa_envolvidos_usuario ON public.tarefa_envolvidos(usuario_id);

CREATE TABLE IF NOT EXISTS public.evento_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos_agenda(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evento_id, usuario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evento_responsaveis TO authenticated;
GRANT ALL ON public.evento_responsaveis TO service_role;
ALTER TABLE public.evento_responsaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read evento_responsaveis" ON public.evento_responsaveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write evento_responsaveis" ON public.evento_responsaveis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth delete evento_responsaveis" ON public.evento_responsaveis FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_evento_responsaveis_evento ON public.evento_responsaveis(evento_id);
CREATE INDEX IF NOT EXISTS idx_evento_responsaveis_usuario ON public.evento_responsaveis(usuario_id);

CREATE TABLE IF NOT EXISTS public.evento_envolvidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos_agenda(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evento_id, usuario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evento_envolvidos TO authenticated;
GRANT ALL ON public.evento_envolvidos TO service_role;
ALTER TABLE public.evento_envolvidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read evento_envolvidos" ON public.evento_envolvidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write evento_envolvidos" ON public.evento_envolvidos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth delete evento_envolvidos" ON public.evento_envolvidos FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_evento_envolvidos_evento ON public.evento_envolvidos(evento_id);
CREATE INDEX IF NOT EXISTS idx_evento_envolvidos_usuario ON public.evento_envolvidos(usuario_id);

CREATE TABLE IF NOT EXISTS public.audiencia_envolvidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audiencia_id uuid NOT NULL REFERENCES public.audiencias_detectadas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(audiencia_id, usuario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audiencia_envolvidos TO authenticated;
GRANT ALL ON public.audiencia_envolvidos TO service_role;
ALTER TABLE public.audiencia_envolvidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read audiencia_envolvidos" ON public.audiencia_envolvidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write audiencia_envolvidos" ON public.audiencia_envolvidos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth delete audiencia_envolvidos" ON public.audiencia_envolvidos FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_audiencia_envolvidos_audiencia ON public.audiencia_envolvidos(audiencia_id);
CREATE INDEX IF NOT EXISTS idx_audiencia_envolvidos_usuario ON public.audiencia_envolvidos(usuario_id);
