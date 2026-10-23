CREATE TABLE public.acompanhamento_especial_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.acompanhamento_especial_eventos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  lido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, user_id)
);
CREATE INDEX ON public.acompanhamento_especial_leituras(user_id);
GRANT SELECT, INSERT, DELETE ON public.acompanhamento_especial_leituras TO authenticated;
GRANT ALL ON public.acompanhamento_especial_leituras TO service_role;
ALTER TABLE public.acompanhamento_especial_leituras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leituras proprias select" ON public.acompanhamento_especial_leituras FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "leituras proprias insert" ON public.acompanhamento_especial_leituras FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "leituras proprias delete" ON public.acompanhamento_especial_leituras FOR DELETE TO authenticated USING (user_id = auth.uid());