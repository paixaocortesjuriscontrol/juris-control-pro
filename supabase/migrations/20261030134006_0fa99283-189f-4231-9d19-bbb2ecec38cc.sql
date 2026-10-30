CREATE TABLE public.ritos_processuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ritos_processuais_nome_unq ON public.ritos_processuais (lower(nome));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ritos_processuais TO authenticated;
GRANT ALL ON public.ritos_processuais TO service_role;
ALTER TABLE public.ritos_processuais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ritos_select" ON public.ritos_processuais FOR SELECT TO authenticated USING (true);
CREATE POLICY "ritos_insert" ON public.ritos_processuais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ritos_update_admin" ON public.ritos_processuais FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ritos_delete_admin" ON public.ritos_processuais FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
INSERT INTO public.ritos_processuais (nome, created_by) VALUES ('Juizado Especial Cível', null), ('Vara Cível', null);
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS rito_processual text;
CREATE INDEX IF NOT EXISTS idx_processos_rito_processual ON public.processos (rito_processual);