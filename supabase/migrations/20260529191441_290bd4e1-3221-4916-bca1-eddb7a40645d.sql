
-- Catálogo de TAGs aplicáveis a processos (dados_benner).
CREATE TABLE public.processo_tags_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#6366f1',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX processo_tags_catalogo_nome_uniq
  ON public.processo_tags_catalogo (LOWER(TRIM(nome))) WHERE ativo;

GRANT SELECT ON public.processo_tags_catalogo TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.processo_tags_catalogo TO authenticated;
GRANT ALL ON public.processo_tags_catalogo TO service_role;

ALTER TABLE public.processo_tags_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tags catalogo: read by authenticated"
ON public.processo_tags_catalogo FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tags catalogo: admin/coord insert"
ON public.processo_tags_catalogo FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Tags catalogo: admin/coord update"
ON public.processo_tags_catalogo FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Tags catalogo: admin/coord delete"
ON public.processo_tags_catalogo FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE TRIGGER trg_processo_tags_catalogo_updated_at
BEFORE UPDATE ON public.processo_tags_catalogo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vínculo N:N entre dados_benner e tags.
CREATE TABLE public.dados_benner_processo_tags (
  dado_benner_id UUID NOT NULL REFERENCES public.dados_benner(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.processo_tags_catalogo(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dado_benner_id, tag_id)
);

CREATE INDEX idx_dbpt_tag ON public.dados_benner_processo_tags (tag_id);
CREATE INDEX idx_dbpt_dado ON public.dados_benner_processo_tags (dado_benner_id);

GRANT SELECT ON public.dados_benner_processo_tags TO authenticated;
GRANT INSERT, DELETE ON public.dados_benner_processo_tags TO authenticated;
GRANT ALL ON public.dados_benner_processo_tags TO service_role;

ALTER TABLE public.dados_benner_processo_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DB tags: read by authenticated"
ON public.dados_benner_processo_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "DB tags: admin/coord insert"
ON public.dados_benner_processo_tags FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "DB tags: admin/coord delete"
ON public.dados_benner_processo_tags FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

-- Migra catalogo a partir de situacoes_envio_carga
INSERT INTO public.processo_tags_catalogo (id, nome, cor, ordem, ativo)
SELECT id, nome, '#6366f1', ordem, ativo FROM public.situacoes_envio_carga
ON CONFLICT DO NOTHING;

-- Migra vínculos existentes (situacao_envio_carga_id -> tag com mesmo id)
INSERT INTO public.dados_benner_processo_tags (dado_benner_id, tag_id)
SELECT id, situacao_envio_carga_id FROM public.dados_benner
WHERE situacao_envio_carga_id IS NOT NULL
ON CONFLICT DO NOTHING;
