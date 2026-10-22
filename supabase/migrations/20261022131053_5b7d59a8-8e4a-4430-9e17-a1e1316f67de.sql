CREATE TABLE public.projuris_vinculo_stage (tipo text NOT NULL, chave text NOT NULL, valor text NOT NULL, extra text);
CREATE INDEX ON public.projuris_vinculo_stage (tipo, chave);
GRANT ALL ON public.projuris_vinculo_stage TO service_role;
ALTER TABLE public.projuris_vinculo_stage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente admin" ON public.projuris_vinculo_stage FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));