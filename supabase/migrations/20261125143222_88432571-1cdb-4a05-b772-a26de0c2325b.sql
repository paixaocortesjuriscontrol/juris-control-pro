CREATE TABLE public.tmp_status_projuris_20261125 (chave text PRIMARY KEY, codigo text NOT NULL, conclusao text);
GRANT ALL ON public.tmp_status_projuris_20261125 TO service_role;
ALTER TABLE public.tmp_status_projuris_20261125 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le tmp status projuris" ON public.tmp_status_projuris_20261125 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));