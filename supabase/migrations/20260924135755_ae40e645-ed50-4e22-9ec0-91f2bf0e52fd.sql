CREATE TABLE public.equipes_tst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.equipes_tst TO authenticated;
GRANT ALL ON public.equipes_tst TO service_role;
ALTER TABLE public.equipes_tst ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipes_tst leitura" ON public.equipes_tst FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipes_tst admin insere" ON public.equipes_tst FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "equipes_tst admin remove" ON public.equipes_tst FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));