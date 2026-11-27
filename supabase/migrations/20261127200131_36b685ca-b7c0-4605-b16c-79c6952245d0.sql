CREATE TABLE public.config_judit_franquia (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  limite_consultas integer NOT NULL DEFAULT 4000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.config_judit_franquia TO authenticated;
GRANT ALL ON public.config_judit_franquia TO service_role;
ALTER TABLE public.config_judit_franquia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logados leem franquia" ON public.config_judit_franquia FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insere franquia" ON public.config_judit_franquia FOR INSERT TO authenticated WITH CHECK ((select public.has_role((select auth.uid()), 'admin')));
CREATE POLICY "Admin altera franquia" ON public.config_judit_franquia FOR UPDATE TO authenticated USING ((select public.has_role((select auth.uid()), 'admin'))) WITH CHECK ((select public.has_role((select auth.uid()), 'admin')));
INSERT INTO public.config_judit_franquia (id, limite_consultas) VALUES (true, 4000);