CREATE TABLE public.remessas_benner_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remessa_id uuid NOT NULL REFERENCES public.remessas_benner(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.processo_tags_catalogo(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (remessa_id, tag_id)
);

CREATE INDEX idx_remessas_benner_tags_remessa ON public.remessas_benner_tags(remessa_id);
CREATE INDEX idx_remessas_benner_tags_tag ON public.remessas_benner_tags(tag_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.remessas_benner_tags TO authenticated;
GRANT ALL ON public.remessas_benner_tags TO service_role;

ALTER TABLE public.remessas_benner_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Remessa tags: read by authenticated"
  ON public.remessas_benner_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Remessa tags: admin/coord insert"
  ON public.remessas_benner_tags FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));

CREATE POLICY "Remessa tags: admin/coord delete"
  ON public.remessas_benner_tags FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));